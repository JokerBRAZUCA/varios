import {archiveJson,digestToken} from './archive.mjs';
const cache=new Map();
export async function loadMunicipalBundle(context){
 const ref=context.historical?context.resources?.municipalBundle:await archiveJson('municipios/latest.json');
 if(!ref)return null;if(!/^[a-f0-9]{64}$/.test(ref.hash)||ref.kind!=='municipal-bundle')throw Error('Referência municipal inválida.');
 let promise=cache.get(ref.hash);if(!promise){promise=(async()=>{const response=await fetch('/historico/municipios/bundles/'+ref.hash+'.json',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Conjunto municipal indisponível.');const text=await response.text();if(text.length>12000000||await digestToken(text)!==ref.hash)throw Error('Integridade municipal inválida.');const bundle=JSON.parse(text);if(bundle.version!==1||bundle.kind!=='municipal-results'||!Array.isArray(bundle.rows)||bundle.rows.length>6000)throw Error('Formato municipal inválido.');return bundle;})().catch(e=>{cache.delete(ref.hash);throw e;});cache.set(ref.hash,promise);if(cache.size>5)cache.delete(cache.keys().next().value);}
 return {...await promise,reference:ref};
}
