import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('../public/assets/',import.meta.url);await mkdir(root,{recursive:true});
const urls={states:'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&intrarregiao=UF&qualidade=minima',countries:'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson'};
const datasets={};for(const[key,url]of Object.entries(urls)){const r=await fetch(url,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Cartography ${key}: HTTP ${r.status}`);datasets[key]=await r.json();}
const codes={11:['ro','Rondônia'],12:['ac','Acre'],13:['am','Amazonas'],14:['rr','Roraima'],15:['pa','Pará'],16:['ap','Amapá'],17:['to','Tocantins'],21:['ma','Maranhão'],22:['pi','Piauí'],23:['ce','Ceará'],24:['rn','Rio Grande do Norte'],25:['pb','Paraíba'],26:['pe','Pernambuco'],27:['al','Alagoas'],28:['se','Sergipe'],29:['ba','Bahia'],31:['mg','Minas Gerais'],32:['es','Espírito Santo'],33:['rj','Rio de Janeiro'],35:['sp','São Paulo'],41:['pr','Paraná'],42:['sc','Santa Catarina'],43:['rs','Rio Grande do Sul'],50:['ms','Mato Grosso do Sul'],51:['mt','Mato Grosso'],52:['go','Goiás'],53:['df','Distrito Federal']};
const round=coords=>typeof coords[0]==='number'?coords.map(n=>Math.round(n*100)/100):coords.map(round);
const geometry=g=>({type:g.type,coordinates:round(g.coordinates)});
const states=datasets.states.features.map(f=>({id:codes[f.properties.codarea][0],name:codes[f.properties.codarea][1],geometry:geometry(f.geometry)}));
const names=new Intl.DisplayNames(['pt-BR'],{type:'region'});const exceptional={FRA:'FR',NOR:'NO',TWN:'TW',KOS:'XK'};
const countries=datasets.countries.features.map(f=>{const p=f.properties;let id=/^[A-Z]{2}$/.test(p.ISO_A2)?p.ISO_A2:exceptional[p.ADM0_A3]??p.ADM0_A3;return{id,name:/^[A-Z]{2}$/.test(id)?names.of(id):p.NAME_PT||p.NAME_EN,geometry:geometry(f.geometry),center:[p.LABEL_X,p.LABEL_Y]};});
const france=countries.find(c=>c.id==='FR');const polys=france.geometry.type==='MultiPolygon'?france.geometry.coordinates:[france.geometry.coordinates];const gf=polys.filter(p=>p[0][0][0]<-45&&p[0][0][1]<10);france.geometry.coordinates=polys.filter(p=>!gf.includes(p));countries.push({id:'GF',name:'Guiana Francesa',center:[-53,4],geometry:{type:'MultiPolygon',coordinates:gf}});
if(states.length!==27||new Set(countries.map(c=>c.id)).size!==countries.length||!gf.length)throw Error('Unexpected geographic coverage');
await writeFile(new URL('maps.json',root),JSON.stringify({states,countries}));
console.log(`Cartography: ${states.length} UFs, ${countries.length} country/territory geometries -> ${fileURLToPath(root)}`);
