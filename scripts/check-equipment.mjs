import assert from 'node:assert/strict';
import {backend,matchesEquipment,matchesPetClassification} from '../worker/backend.js';
assert.equal(matchesEquipment({name:'剛毅',type:'item'},'劍','11'),true);
assert.equal(matchesEquipment({name:'青龍刀',type:'item'},'小刀'),false);
assert.equal(matchesEquipment({name:'小圓盾',type:'item'},'盾牌','1'),true);
assert.equal(matchesEquipment({name:'剛毅',type:'pet'},'劍'),false);
assert.equal((await backend.fetch(new Request('https://test/api/search?category=不存在'))).status,400);
assert.equal((await backend.fetch(new Request('https://test/api/search?category=劍&level=999'))).status,400);
const original=globalThis.fetch,requests=[];
globalThis.fetch=async input=>{const u=new URL(input);requests.push(u);return Response.json(u.searchParams.get('page')==='1'?{stalls:[{cdkey:'a',server:2,name:'測試攤'}],itemsByCd:{a:[{Name:'剛毅',price:100,pricetype:0},{Name:'青龍刀',price:5,pricetype:1},{Name:'不存在的劍',price:1,pricetype:0}]},petsByCd:{a:[{Name:'剛毅',price:1,pricetype:0}]}}:{stalls:[],itemsByCd:{},petsByCd:{}})};
try{const result=await backend.fetch(new Request('https://test/api/search?category=劍&level=11&server=S2'));assert.equal(result.status,200);const payload=await result.json();assert.deepEqual(payload.rows.map(r=>r.name),['剛毅']);assert.equal(payload.rows[0].server,'S2');assert.equal(requests[0].searchParams.get('search'),'');assert.equal(requests[0].searchParams.get('server'),'2');assert.equal(payload.truncated,false);}finally{globalThis.fetch=original}
console.log('Equipment API accepts verified categories, rejects invalid levels and excludes unrelated items and pets');

assert.equal(matchesPetClassification({name:'月球地兔',type:'pet'},'金屬系','普卡'),true);
assert.equal(matchesPetClassification({name:'月球火兔',type:'item'},'金屬系','普卡'),false);
assert.equal(matchesPetClassification({name:'未知寵物',type:'pet'},'金屬系','普卡'),false);
assert.equal((await backend.fetch(new Request('https://test/api/search?category=劍&petRace=金屬系'))).status,400);
assert.equal((await backend.fetch(new Request('https://test/api/search?petRace=劍'))).status,400);
