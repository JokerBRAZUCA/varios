import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync, sign} from 'node:crypto';
import {normalize, verifyJws, TSE_KEY} from '../public/tse.mjs';
const fixture = () => ({ele:'6258',t:'2',f:'o',tpabr:'br',cdabr:'br',dg:'25/10/2026',hg:'17:00:00',tf:'n',s:{ts:'10',st:'5',pst:'50,00'},v:{vv:'100'},carg:[{cd:'1',agr:[{par:[{sg:'TESTE',cand:[{nmu:'Candidato teste A',vap:'60',pvap:'60,00'},{nmu:'Candidato teste B',vap:'40',pvap:'40,00'}]}]}]}]});
test('converts official nested structure and Brazilian decimal values', () => {
 const data=normalize(fixture()); assert.equal(data.progress,50); assert.equal(data.candidates[0].votes,60); assert.equal(data.validVotes,100);
});
test('rejects different elections, rounds, scopes and unofficial data', () => {
 for (const [field,value] of [['ele','6257'],['t','1'],['f','s'],['cdabr','sp'],['tpabr','uf']]) assert.throws(()=>normalize({...fixture(),[field]:value}));
});
test('rejects malformed, negative and out-of-range values', () => {
 for(const value of ['NaN','Infinity','-1','101',null,true,'50abc']) {const raw=fixture();raw.s.pst=value; assert.throws(()=>normalize(raw));}
});
test('rejects missing candidates and inconsistent sections',()=>{
 const raw=fixture();raw.carg=[];assert.throws(()=>normalize(raw));
 const raw2=fixture();raw2.s.st='11';assert.throws(()=>normalize(raw2));
});
test('verifies signatures and rejects modified payloads or wrong keys',async()=>{
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');
 const key={...publicKey.export({format:'jwk'}),kid:'test',alg:'EdDSA',use:'sig',key_ops:['verify']};
 const enc=(value)=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const header=enc({alg:'EdDSA',kid:'test'}), payload=enc(fixture());
 const input=`${header}.${payload}`, token=`${input}.${sign(null,Buffer.from(input),privateKey).toString('base64url')}`;
 assert.equal((await verifyJws(token,key)).ele,'6258');
 await assert.rejects(verifyJws(`${header}.${enc({...fixture(),ele:'9999'})}.${token.split('.')[2]}`,key));
 await assert.rejects(verifyJws(token,TSE_KEY));
 await assert.rejects(verifyJws('not-a-jws',key));
});
