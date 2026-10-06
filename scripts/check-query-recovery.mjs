import assert from 'node:assert/strict';
import {searchMarket,searchHistory} from '../worker/backend.js';
const oldFetch=globalThis.fetch,oldNow=Date.now,oldTimer=globalThis.setTimeout;let clock=oldNow();Date.now=()=>clock;globalThis.setTimeout=(fn)=>{queueMicrotask(fn);return 1};
try{
 let calls=0,release;globalThis.fetch=async()=>{calls++;return await new Promise(r=>release=r)};
 const a=searchMarket('dedupe-test',[1,2,3],false),b=searchMarket('dedupe-test',[1,2,3],false);await new Promise(r=>setImmediate(r));assert.equal(calls,1);release(Response.json({stalls:[],itemsByCd:{},petsByCd:{}}));await Promise.all([a,b]);assert.equal((await searchMarket('dedupe-test',[1,2,3],false)).cached,true);assert.equal(calls,1);
 const requested=[];let broken=true;const makeLog=(id,currency)=>({id,item_name:'recovery-test',qty:1,unit_gross_price:100,ts:1791214355,pricetype:currency==='gold'?0:1,buff:'購買道具'});
 globalThis.fetch=async input=>{const u=new URL(input),currency=u.searchParams.get('currency'),page=Number(u.searchParams.get('page'));requested.push([currency,page]);if(currency==='gold'&&page===2&&broken)return new Response('',{status:503});return Response.json({totalFiltered:currency==='gold'?100:1,logs:currency==='gold'?Array.from({length:50},(_,i)=>makeLog((page-1)*50+i,currency)):[makeLog('gem',currency)]})};
 const partial=await searchHistory('recovery-test','30','all','all');assert.equal(partial.rows.length,50);assert.equal(partial.truncated,true);assert(partial.warnings.length);assert.deepEqual(requested,[['gold',1],['gold',2]]);assert(partial.perCurrency['魔晶'].error);
 broken=false;clock+=31000;const resumed=await searchHistory('recovery-test','30','all','pet',true);assert.equal(resumed.rows.length,101);assert.equal(resumed.warnings.length,0);assert.deepEqual(requested,[['gold',1],['gold',2],['gold',2],['gem',1]]);assert.equal(new Set(resumed.rows.map(r=>r.currency+':'+r.id)).size,101);
 await searchHistory('recovery-test','30','all','item');assert.equal(requested.length,4);
 console.log('Concurrent request coalescing, successful-result caching, cooldown, partial history retention and failed-page continuation passed.');
}finally{globalThis.fetch=oldFetch;Date.now=oldNow;globalThis.setTimeout=oldTimer}
