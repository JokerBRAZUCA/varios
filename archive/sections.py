"""Official second-round locations and section totals; never substitute first-round votes."""
import csv,hashlib,io,json,os,pathlib,shutil,tempfile,urllib.request,zipfile,datetime,sqlite3
ROOT=pathlib.Path('/var/lib/eleicaopresidente-archive/public/secoes')
CACHE=pathlib.Path('/var/lib/eleicaopresidente-sections')
ROOT.mkdir(parents=True,exist_ok=True);CACHE.mkdir(parents=True,exist_ok=True)
NOW=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
URLS={'locations':'https://cdn.tse.jus.br/estatistica/sead/odsele/eleitorado_locais_votacao/eleitorado_local_votacao_2026.zip','votes':'https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_2026_BR.zip'}
state={}
try:state=json.loads((CACHE/'state.json').read_text())
except FileNotFoundError:pass
changed=False
for key,url in URLS.items():
 request=urllib.request.Request(url,method='HEAD')
 with urllib.request.urlopen(request,timeout=30) as response:etag=response.headers.get('ETag');modified=response.headers.get('Last-Modified')
 path=CACHE/(key+'.zip')
 if path.exists() and etag and state.get(key,{}).get('etag')==etag:continue
 if shutil.disk_usage(CACHE).free<2*1024**3:raise RuntimeError('Espaço insuficiente; mantendo o último arquivo válido.')
 temp=CACHE/(key+'.zip.tmp')
 with urllib.request.urlopen(url,timeout=90) as response,open(temp,'wb') as output:shutil.copyfileobj(response,output,1024*1024)
 with zipfile.ZipFile(temp) as archive:
  if not any(name.endswith('.csv') for name in archive.namelist()):raise RuntimeError('ZIP sem CSV.')
 os.replace(temp,path);state[key]={'url':url,'etag':etag,'lastModified':modified,'receivedAt':NOW()};changed=True
if not changed and (ROOT/'latest.json').exists():print(json.dumps({'changed':False}));raise SystemExit(0)
def records(key):
 with zipfile.ZipFile(CACHE/(key+'.zip')) as archive:
  for name in archive.namelist():
   if not name.lower().endswith('.csv'):continue
   with archive.open(name) as stream:
    for row in csv.DictReader(io.TextIOWrapper(stream,encoding='iso-8859-1',newline=''),delimiter=';'):yield row
def integer(row,key,default=0):
 try:return int(row.get(key,default))
 except (ValueError,TypeError):return default
database=sqlite3.connect(CACHE/'working.sqlite');database.execute('PRAGMA journal_mode=OFF');database.execute('PRAGMA cache_size=-4096');database.execute('DROP TABLE IF EXISTS votes');database.execute('DROP TABLE IF EXISTS locations');database.execute('CREATE TABLE votes(uf TEXT,city TEXT,z INTEGER,s INTEGER,v13 INTEGER,v22 INTEGER,blank INTEGER,nul INTEGER,other INTEGER,PRIMARY KEY(uf,city,z,s))');database.execute('CREATE TABLE locations(uf TEXT,city TEXT,z INTEGER,s INTEGER,data TEXT,PRIMARY KEY(uf,city,z,s))');vote_rows=0
for row in records('votes'):
 if integer(row,'NR_TURNO')!=2 or integer(row,'CD_CARGO')!=1:continue
 vote_rows+=1;uf=row.get('SG_UF','').lower();key=(uf,str(integer(row,'CD_MUNICIPIO')).zfill(5),integer(row,'NR_ZONA'),integer(row,'NR_SECAO'));candidate=integer(row,'NR_VOTAVEL');quantity=integer(row,'QT_VOTOS')
 if quantity<0:raise RuntimeError('Votação negativa no CSV.')
 values=[0,0,0,0,0];values[{13:0,22:1,95:2,96:3}.get(candidate,4)]=quantity
 database.execute('INSERT INTO votes VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(uf,city,z,s) DO UPDATE SET v13=v13+excluded.v13,v22=v22+excluded.v22,blank=blank+excluded.blank,nul=nul+excluded.nul,other=other+excluded.other',(*key,*values))
database.commit();missing_coordinates={}
for row in records('locations'):
 if integer(row,'NR_TURNO')!=2:continue
 uf=row.get('SG_UF','').lower()
 if len(uf)!=2 or uf=='zz':continue
 code=str(integer(row,'CD_MUNICIPIO')).zfill(5);zone=integer(row,'NR_ZONA');section=integer(row,'NR_SECAO');key=(uf,code,zone,section)
 try:lat=float(row['NR_LATITUDE'].replace(',','.'));lon=float(row['NR_LONGITUDE'].replace(',','.'))
 except (KeyError,ValueError):lat=lon=None
 if lat is None or not(-34<=lat<=6 and -74<=lon<=-32):lat=lon=None;missing_coordinates[uf]=missing_coordinates.get(uf,0)+1
 vote=database.execute('SELECT v13,v22,blank,nul,other FROM votes WHERE uf=? AND city=? AND z=? AND s=?',key).fetchone()
 point={'city':code,'cityName':row.get('NM_MUNICIPIO',''),'zone':zone,'section':section,'principal':integer(row,'NR_SECAO_PRINCIPAL',-1),'local':integer(row,'NR_LOCAL_VOTACAO'),'name':row.get('NM_LOCAL_VOTACAO',''),'address':row.get('DS_ENDERECO',''),'lat':lat,'lon':lon,'electors':max(0,integer(row,'QT_ELEITOR_ELEICAO_FEDERAL')),'votes':dict(zip(['v13','v22','blank','null','other'],vote)) if vote else None}
 database.execute('INSERT OR REPLACE INTO locations VALUES(?,?,?,?,?)',(*key,json.dumps(point,ensure_ascii=False,separators=(',',':'))))
database.commit();ufs=[r[0]for r in database.execute('SELECT DISTINCT uf FROM locations')]
if not ufs:raise RuntimeError('Cadastro sem seções do segundo turno; arquivo anterior preservado.')
refs={};(ROOT/'bundles').mkdir(exist_ok=True)
for uf in ufs:
 points=[json.loads(row[0])for row in database.execute('SELECT data FROM locations WHERE uf=? ORDER BY city,z,s',(uf,))]
 payload={'version':1,'round':2,'uf':uf,'points':points,'missingCoordinates':missing_coordinates.get(uf,0),'voteRecords':sum(p['votes'] is not None for p in points),'sources':state}
 content=json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode();digest=hashlib.sha256(content).hexdigest();target=ROOT/'bundles'/(digest+'.json')
 if not target.exists():target.write_bytes(content)
 refs[uf]={'hash':digest,'sections':len(points),'voteRecords':payload['voteRecords'],'missingCoordinates':payload['missingCoordinates']}
manifest={'version':1,'kind':'sections-index','round':2,'capturedAt':NOW(),'voteRows':vote_rows,'ufs':refs,'sources':state};content=json.dumps(manifest,ensure_ascii=False,separators=(',',':')).encode();digest=hashlib.sha256(content).hexdigest();(ROOT/'bundles'/(digest+'.json')).write_bytes(content)
reference={'version':1,'kind':'sections-bundle','hash':digest,'capturedAt':manifest['capturedAt'],'generatedAt':datetime.datetime.now(datetime.timezone.utc).timestamp()*1000,'voteRows':vote_rows}
(ROOT/'latest.json.tmp').write_text(json.dumps(reference));os.replace(ROOT/'latest.json.tmp',ROOT/'latest.json');(CACHE/'state.json').write_text(json.dumps(state));print(json.dumps({'sections':sum(r['sections']for r in refs.values()),'secondRoundVoteRows':vote_rows,'ufs':len(refs)}));database.close()
