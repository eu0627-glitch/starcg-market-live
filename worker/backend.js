import {petCatalog} from './pet-catalog.js';
import {equipmentCatalog} from './equipment-catalog.js';
export function matchesEquipment(row,category,level='all') {
  return row.type==='item' && equipmentCatalog.some(e=>e.name===row.name&&e.category===category&&(level==='all'||e.level===Number(level)));
}
const queryCache = new Map(),inFlight=new Map();let upstreamTail=Promise.resolve(),nextUpstreamAt=0,upstreamCooldownUntil=0;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function officialFetch(url,options){const task=upstreamTail.catch(()=>{}).then(async()=>{if(Date.now()<upstreamCooldownUntil)throw Error('官方服務正在限制查詢或暫時忙碌，請稍後重試。');await delay(Math.max(0,nextUpstreamAt-Date.now()));const {timeoutMs=12000,...fetchOptions}=options;const response=await fetch(url,{...fetchOptions,signal:AbortSignal.timeout(timeoutMs)});nextUpstreamAt=Date.now()+1000;if([429,503].includes(response.status)){const seconds=Number(response.headers.get('retry-after'));upstreamCooldownUntil=Date.now()+Math.min(120000,Math.max(30000,Number.isFinite(seconds)?seconds*1000:0));throw Error(response.status===429?'官方限制查詢頻率，請稍後重試。':'官方查詢服務暫時忙碌，請稍後重試。')}return response});upstreamTail=task.then(()=>{},()=>{});return task}
async function cachedQuery(key,loader,ttl,retry=false){if(inFlight.has(key))return inFlight.get(key);const task=(async()=>{let cached=queryCache.get(key);const cacheUrl='https://starcg-query-cache.invalid/v2?key='+encodeURIComponent(key);if(!cached&&globalThis.caches?.default){try{const r=await caches.default.match(cacheUrl);if(r)cached=await r.json()}catch{}}if(cached&&Date.now()-cached.time<ttl&&!(retry&&(cached.result.stale||cached.result.warnings?.length))){queryCache.set(key,cached);return {...cached.result,cached:true}}try{const result=await loader(cached?.result);const entry={time:Date.now(),result};if(queryCache.size>100)queryCache.clear();queryCache.set(key,entry);if(globalThis.caches?.default){try{await caches.default.put(cacheUrl,Response.json(entry,{headers:{'cache-control':'public,max-age=3600'}}))}catch{}}return result}catch(e){if(cached&&Date.now()-cached.time<3600000)return {...cached.result,cached:true,stale:true,warnings:[...(cached.result.warnings||[]),'官方暫時無法更新，目前保留上次成功查得的資料。']};throw e}})();inFlight.set(key,task);try{return await task}finally{inFlight.delete(key)}}
export function searchHistory(q,days,currency,type,retry=false){return cachedQuery(JSON.stringify(['history-v2',q,days,currency]),cached=>searchHistoryUncached(q,days,currency,type,retry,cached),300000,retry)}

export function normalizeHistory(logs) {
  if(!Array.isArray(logs))throw new Error('官方成交欄位格式不符。');
  return logs.flatMap(log=>{
    let name=String(log.item_name||'').trim().replace(/^\[([\s\S]*)\]$/,'$1');
    const quantity=Number(log.qty),price=Number(log.unit_gross_price),ts=Number(log.ts),currency=Number(log.pricetype);
    if(!name||!Number.isSafeInteger(quantity)||quantity<1||!Number.isFinite(price)||price<=0||!Number.isFinite(ts)||ts<=0||![0,1].includes(currency))return [];
    return [{name,variant:'',type:/購買寵物|购买宠物/.test(String(log.buff))?'pet':'item',currency:currency===0?'魔幣':'魔晶',price,quantity,server:'',date:new Date(ts*1000).toISOString(),status:'sold',source:'official',id:String(log.id),priceBasis:'unit',specificationStatus:''}];
  });
}
async function searchHistoryUncached(q,days,currency,type,retry=false,seed=null) {
  if(currency==='all') {
    const currencies=['魔幣','魔晶'],results=[];for(const c of currencies){try{results.push({status:'fulfilled',value:await searchHistory(q,days,c,type,retry)})}catch(reason){results.push({status:'rejected',reason})}}const rows=[],warnings=[],perCurrency={};let total=0,truncated=false,ok=0;
    results.forEach((r,i)=>{const c=currencies[i];if(r.status==='fulfilled'){ok++;rows.push(...r.value.rows);warnings.push(...(r.value.warnings||[]).map(w=>c+'：'+w));total+=r.value.total;truncated ||= r.value.truncated;perCurrency[c]={total:r.value.total,loaded:r.value.rows.length,truncated:r.value.truncated}}else{warnings.push(c+' 成交查詢失敗：'+r.reason.message);perCurrency[c]={error:r.reason.message}}});
    if(!ok)throw new Error(warnings.join('；'));
    return {rows:rows.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date)),total,truncated,warnings,perCurrency,stale:results.some(r=>r.status==='fulfilled'&&r.value.stale),fetchedAt:new Date(Math.min(...results.filter(r=>r.status==='fulfilled').map(r=>Date.parse(r.value.fetchedAt)))).toISOString(),note:'魔幣與魔晶各自查詢、分別統計。'};
  }
  const resume=retry&&seed?.warnings?.length&&Number.isInteger(seed.nextPage),rows=resume?[...seed.rows]:[],ids=new Set(rows.map(r=>r.id)),warnings=[];let total=resume?seed.total:0,truncated=false,nextPage=resume?seed.nextPage:1;
  try{
  for(let pageNo=nextPage;pageNo<=6;pageNo++){
    nextPage=pageNo;
    const u=new URL('https://member.starcg.net/marketrecord.php');
    u.search=new URLSearchParams({lang:'zh',ajax:'1',page:String(pageNo),search:q,range:days==='all'?'all':days+'d',currency:currency==='all'?'all':currency==='魔晶'?'gem':'gold',type:'all',sort:'time_desc'}).toString();
    const response=await officialFetch(u,{headers:{'X-Requested-With':'XMLHttpRequest','Accept':'application/json'},timeoutMs:25000});
    if(!response.ok)throw new Error('成交來源回應 '+response.status);
    let payload;try{payload=await response.json()}catch{throw new Error('官方成交來源未回傳有效資料。')}
    if(!Array.isArray(payload.logs))throw new Error('成交資料格式不符。');
    total=Number(payload.totalFiltered)||0;
    const normalized=normalizeHistory(payload.logs);let added=0;
    normalized.forEach(r=>{if(!ids.has(r.id)){ids.add(r.id);rows.push(r);added++}});
    if(!payload.logs.length||!added||pageNo*50>=total){truncated=!!payload.resultsTruncated;break}
    if(pageNo===6)truncated=true;
  }
  }catch(e){if(!rows.length)throw e;truncated=true;warnings.push(e.message+' 已保留取得的成交資料。')}
  const result={rows,total,truncated,warnings,nextPage,fetchedAt:new Date().toISOString(),cached:false,note:'官方種類篩選可能漏記，先查同名道具與寵物，再由介面篩選；成交單價採官方買方支付金額；不使用賣方扣稅後收入。官方成交未提供分流與能力細節，成交比較採全分流同名資料。'};
  return result;
}
function numericField(object,key){const value=object[key];if(value===null||value===undefined||value==='')return null;const number=Number(value);return Number.isFinite(number)?number:null}
export function unpackPetGrades(value){const n=Number(value);if(value===null||value===undefined||value===''||!Number.isInteger(n)||n<0||n>0xffffffff)return null;return [24,18,12,6,0].map(shift=>Math.floor(n/2**shift)%64)}
export function petDetails(pet){const grades=unpackPetGrades(pet.AllocPoint),starGrades=unpackPetGrades(pet.PetAllocPoint),species=petCatalog[String(pet.Name||'').trim()];const candidate=species&&grades?species.grades.map((n,i)=>n-grades[i]):null,drops=candidate&&candidate.every(n=>Number.isInteger(n)&&n>=0&&n<=4)?candidate:null;const innate=species?25-(species.full-species.grades.reduce((a,b)=>a+b,0)):null,starCount=innate!==null&&starGrades?innate+starGrades.reduce((a,b)=>a+b,0):null,stars=starCount!==null&&starCount>=0&&starCount<=25?starCount:null;
// Species catalog values are not the current slot count of an individual listing.
// No verified listing field is available yet; do not substitute catalog or engine limits.
const skills=null;return {level:numericField(pet,'Lv'),hp:numericField(pet,'Hp'),mp:numericField(pet,'ForcePoint'),bp:['Vital','Str','Tough','Quick','Magic'].map(key=>{const n=numericField(pet,key);return n===null?null:n/100}),grades,stars,starGrades,drops,totalGrades:grades?grades.reduce((a,b)=>a+b,0)+(starGrades?starGrades.reduce((a,b)=>a+b,0):0):null,attributes:['Attrib_Earth','Attrib_Water','Attrib_Fire','Attrib_Wind'].map(key=>numericField(pet,key)),skills};}
export function normalizeMarket(payload, server, fetchedAt) {
  if (!Array.isArray(payload?.stalls) || !payload.itemsByCd || !payload.petsByCd) throw new Error('官方回傳格式不符，無法安全讀取價格。');
  const stalls=new Map(payload.stalls.map(s=>[String(s.cdkey),s]));
  const rows=[];
  for (const [type,groups] of [['item',payload.itemsByCd],['pet',payload.petsByCd]]) {
    for(const [cdkey,entries] of Object.entries(groups)) {
      if(!Array.isArray(entries)) throw new Error('官方物品欄位格式不符。');
      const stall=stalls.get(String(cdkey));
      if(!stall) continue;
      for(const item of entries) {
        const name=String(item.Name || item.ITEM_TRUENAME || item.name || '').trim();
        const price=Number(item.price),priceType=Number(item.pricetype),stack=type==='pet'?1:Number(item.ITEM_REMAIN||1);
        if(!name || !Number.isFinite(price) || price<=0 || ![0,1].includes(priceType) || !Number.isSafeInteger(stack) || stack<1) continue;
        rows.push({name,nickname:type==='pet'?String(item.UserPetName||'').trim():'',variant:'',type,currency:priceType===0?'魔幣':'魔晶',price,quantity:stack,stack,server:[1,2,3].includes(Number(stall.server||server))?'S'+Number(stall.server||server):'',date:fetchedAt,status:'listing',stall:String(stall.name||stall.Name||''),stallId:String(cdkey),coords:String(stall.coords||''),priceBasis:type==='pet'||stack===1?'unit':'official',source:'official',pet:type==='pet'?petDetails(item):null,specificationStatus:type==='pet'?'':(Number.isFinite(Number(item.ITEM_LEVEL))?'等級 '+Number(item.ITEM_LEVEL):'道具')});
      }
    }
  }
  return rows;
}
async function fetchServer(q,server,exact) {
  const fetchedAt=new Date().toISOString(),rows=[],seenPages=new Set();
  let truncated=false;const warnings=[];try{
  for(let page=1;page<=10;page++) {
    const url=new URL('https://member.starcg.net/market.php');
    url.search=new URLSearchParams({ajax:'1',page:String(page),search:q,type:'all',server:String(server),exact:exact?'1':'0',lang:'zh'}).toString();
    const response=await officialFetch(url,{headers:{'Accept':'application/json','X-Requested-With':'XMLHttpRequest','Referer':'https://member.starcg.net/market.php'},timeoutMs:7000});
    if(!response.ok) throw new Error((server==='all'?'全部分流':'S'+server)+' 官方連線回應 '+response.status);
    const text=await response.text();
    let payload;
    try {payload=JSON.parse(text)} catch {throw new Error((server==='all'?'全部分流':'S'+server)+' 官方未回傳查價資料（可能暫時無法連線）。')}
    const pageRows=normalizeMarket(payload,server,fetchedAt);
    if(!payload.stalls.length) break;
    const signature=JSON.stringify(payload);
    if(seenPages.has(signature)) break;
    seenPages.add(signature);rows.push(...pageRows);
    if(page===10) truncated=true;
  }
  }catch(error){if(!rows.length)throw error;truncated=true;warnings.push(error.message+'；已保留本分流取得的攤位。')}
  return {rows,truncated,warnings};
}
export function searchMarket(q,servers,exact){return cachedQuery(JSON.stringify(['market-v2',q,servers,exact]),()=>searchMarketUncached(q,servers,exact),120000)}
async function searchMarketUncached(q,servers,exact) {
  const requested=servers.length===3?['all']:servers;
  const results=await Promise.allSettled(requested.map(s=>fetchServer(q,s,exact)));
  const rows=[],warnings=[];let successful=0,truncated=false;
  results.forEach((r,i)=>{if(r.status==='fulfilled'){successful++;rows.push(...r.value.rows);truncated ||= r.value.truncated;warnings.push(...r.value.warnings)}else warnings.push(r.reason?.message||(requested[i]==='all'?'全部分流':'S'+requested[i])+' 查詢失敗')});
  if(!successful)throw new Error(warnings.join('；'));
  const result={rows,warnings,truncated,cached:false,fetchedAt:new Date().toISOString(),priceNote:'官方掛價依原程式欄位呈現；堆疊價格的計價方式尚待對照確認，因此不與歷史每件單價混算。',source:'https://member.starcg.net/market.php?lang=zh'};
  return result;
}
export const backend={async fetch(request) {
  const u=new URL(request.url);
  if(u.pathname==='/api/history') {
    const q=(u.searchParams.get('q')||'').trim(),days=u.searchParams.get('days')||'30',currency=u.searchParams.get('currency')||'all',type=u.searchParams.get('type')||'all';
    if(!q||q.length>80||!['7','30','90','all'].includes(days)||!['all','魔幣','魔晶'].includes(currency)||!['all','item','pet'].includes(type))return Response.json({error:'查詢參數格式錯誤。'},{status:400});
    try{return Response.json(await searchHistory(q,days,currency,type,u.searchParams.get('retry')==='1'),{headers:{'cache-control':'no-store'}})}catch(e){return Response.json({error:e.message},{status:502})}
  }
  if(u.pathname==='/api/search') {
    const q=(u.searchParams.get('q')||'').trim(),server=u.searchParams.get('server')||'all',category=u.searchParams.get('category')||'',level=u.searchParams.get('level')||'all';
    if(category&&!equipmentCatalog.some(e=>e.category===category))return Response.json({error:'裝備分類格式錯誤。'},{status:400});
    if(level!=='all'&&(!category||!/^\d+$/.test(level)||!equipmentCatalog.some(e=>e.category===category&&e.level===Number(level))))return Response.json({error:'裝備級別格式錯誤。'},{status:400});
    if((!q&&!category)||q.length>80)return Response.json({error:'請輸入物品名稱或選擇裝備分類。'},{status:400});
    if(!['all','S1','S2','S3'].includes(server))return Response.json({error:'分流格式錯誤。'},{status:400});
    try {const result=await searchMarket(q,server==='all'?[1,2,3]:[Number(server.slice(1))],q&&u.searchParams.get('exact')==='1');return Response.json(category?{...result,rows:result.rows.filter(row=>matchesEquipment(row,category,level)),category,level}:result,{headers:{'cache-control':'no-store'}})}
    catch(e){return Response.json({error:e.message,status:'upstream_unavailable'},{status:502,headers:{'cache-control':'no-store'}})}
  }
  if(u.pathname!=='/')return new Response('Not found',{status:404});
  return new Response(page,{headers:{'content-type':'text/html; charset=utf-8','x-content-type-options':'nosniff','referrer-policy':'no-referrer'}});
}};
