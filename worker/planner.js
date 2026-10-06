export function readPosition(coords){
  const match=String(coords).match(/^(.*?)\s*\[?東[:：\s]+(\d+)\s*[,、，]?\s*南[:：\s]+(\d+)/);
  return match?{map:match[1].trim()||'未標示地圖',x:Number(match[2]),y:Number(match[3])}:null;
}
export function mergeNeeds(batch){
  const result=new Map();
  for(const item of batch){
    const quantity=Number(item.quantity),owned=Number(item.owned||0),times=Number(item.times||1);
    if(!item.name||!Number.isSafeInteger(quantity)||quantity<1||!Number.isSafeInteger(owned)||owned<0||!Number.isSafeInteger(times)||times<1||!Number.isSafeInteger(quantity*times))throw Error('每個品項需填寫正整數需求量、任務次數與非負已有數量。');
    const key=JSON.stringify([item.name,item.type||'item',item.variant||'']);
    const old=result.get(key)||{key,name:item.name,type:item.type||'item',variant:item.variant||'',needed:0,owned:0,budget:0};
    old.needed+=quantity*times;old.owned=Math.max(old.owned,owned);
    if(item.budget)old.budget=old.budget?Math.min(old.budget,Number(item.budget)):Number(item.budget);
    result.set(key,old);
  }
  return [...result.values()].map(item=>({...item,missing:Math.max(0,item.needed-item.owned)}));
}
export function gridDistance(a,b){return Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))}
function allocate(needs,shops,unitMode){
  const purchases=[],missing=[];let cost=0;
  for(const need of needs){
    let remaining=need.missing;
    const stock=[];
    shops.forEach(shop=>shop.rows.forEach(row=>{
      if(row.name!==need.name||row.type!==need.type||(need.variant&&row.variant!==need.variant))return;
      const unitPrice=row.priceBasis==='official'&&unitMode==='lot'?row.price/row.quantity:row.price;
      if(need.budget&&unitPrice>need.budget)return;
      stock.push({row,shop,unitPrice});
    }));
    stock.sort((a,b)=>a.unitPrice-b.unitPrice);
    for(const entry of stock){
      if(remaining<=0)break;
      const isLot=entry.row.priceBasis==='official'&&unitMode==='lot';
      const quantity=isLot?entry.row.quantity:Math.min(remaining,entry.row.quantity),amount=isLot?entry.row.price:quantity*entry.unitPrice;
      purchases.push({name:need.name,type:need.type,quantity,required:Math.min(remaining,quantity),overbuy:Math.max(0,quantity-remaining),price:amount,unitPrice:entry.unitPrice,shopId:entry.shop.id});
      cost+=amount;remaining=Math.max(0,remaining-quantity);
    }
    if(remaining)missing.push({name:need.name,quantity:remaining});
  }
  return {purchases,missing,cost,complete:missing.length===0};
}
function routeHeuristic(shops,start,returnToStart){
  const remaining=[...shops],route=[];let current=start;
  while(remaining.length){let best=0;for(let i=1;i<remaining.length;i++)if(gridDistance(current,remaining[i])<gridDistance(current,remaining[best]))best=i;current=remaining.splice(best,1)[0];route.push(current)}
  const length=r=>r.reduce((s,p,i)=>s+gridDistance(i?r[i-1]:start,p),0)+(returnToStart&&r.length?gridDistance(r.at(-1),start):0);
  let improved=true,pass=0;
  while(improved&&pass++<20){improved=false;for(let a=0;a<route.length-1;a++)for(let b=a+1;b<route.length;b++){const candidate=[...route.slice(0,a),...route.slice(a,b+1).reverse(),...route.slice(b+1)];if(length(candidate)<length(route)){route.splice(0,route.length,...candidate);improved=true}}}
  return {route,distance:length(route)};
}
export function planShopping(batch,rows,options){
  const needs=mergeNeeds(batch),start={x:Number(options.x),y:Number(options.y)};
  if(!Number.isSafeInteger(start.x)||!Number.isSafeInteger(start.y)||start.x<0||start.y<0)throw Error('請填寫有效的起點座標。');
  const groups=new Map();let excluded=0;
  for(const row of rows){
    if(row.status!=='listing'||row.server!==options.server||row.currency!==options.currency||!needs.some(n=>n.name===row.name&&n.type===row.type))continue;
    const position=readPosition(row.coords);
    if(!position||position.map!==options.map){excluded++;continue}
    const id=JSON.stringify([row.server,position.map,row.stallId||row.stall,position.x,position.y]);
    if(!groups.has(id))groups.set(id,{id,...position,server:row.server,name:row.stall||'未命名攤位',rows:[]});
    groups.get(id).rows.push(row);
  }
  const shops=[...groups.values()],availability=allocate(needs,shops,options.unitMode),warnings=[];
  if(excluded)warnings.push(excluded+' 筆其他地圖／缺少座標的物品未納入此路線。');
  if(!needs.some(n=>n.missing))return {needs,route:[],purchases:[],missing:[],cost:0,distance:0,complete:true,exact:true,warnings};
  if(!availability.complete){const used=shops.filter(s=>availability.purchases.some(p=>p.shopId===s.id));return {...availability,...routeHeuristic(used,start,options.returnToStart),needs,exact:false,warnings:[...warnings,'目前資料無法購足全部需求；以下只列可購買項目。']}}
  if(shops.length>12){
    // Keep all stock. Build a covering subset instead of silently discarding sellers.
    let selected=[],remaining=[...shops];
    while(!allocate(needs,selected,options.unitMode).complete&&remaining.length){
      const current=allocate(needs,selected,options.unitMode);let bestIndex=0,best=-Infinity;
      remaining.forEach((shop,i)=>{const after=allocate(needs,[...selected,shop],options.unitMode),beforeMissing=current.missing.reduce((s,r)=>s+r.quantity,0),afterMissing=after.missing.reduce((s,r)=>s+r.quantity,0),gain=beforeMissing-afterMissing;
        const distance=gridDistance(selected.at(-1)||start,shop),delta=Math.max(1,after.cost-current.cost);
        const score=options.strategy==='price'?gain/delta:options.strategy==='stops'?gain:gain/(1+distance);if(score>best){best=score;bestIndex=i}});
      selected.push(remaining.splice(bestIndex,1)[0]);
    }
    const allocation=allocate(needs,selected,options.unitMode),used=selected.filter(s=>allocation.purchases.some(p=>p.shopId===s.id));
    return {...allocation,...routeHeuristic(used,start,options.returnToStart),needs,exact:false,warnings:[...warnings,'候選攤位超過 12 個，採啟發式配貨與路線；不保證全域最短或最低價。']};
  }
  const n=shops.length,size=1<<n,dp=Array.from({length:size},()=>new Float64Array(n).fill(Infinity)),parent=Array.from({length:size},()=>new Int16Array(n).fill(-1));
  for(let i=0;i<n;i++)dp[1<<i][i]=gridDistance(start,shops[i]);
  for(let mask=1;mask<size;mask++)for(let end=0;end<n;end++)if(mask&(1<<end)){
    const previous=mask^(1<<end);if(!previous)continue;
    for(let before=0;before<n;before++)if(previous&(1<<before)){const d=dp[previous][before]+gridDistance(shops[before],shops[end]);if(d<dp[mask][end]){dp[mask][end]=d;parent[mask][end]=before}}
  }
  let best=null;
  const score=(allocation,distance,count)=>options.strategy==='price'?[allocation.cost,distance,count]:options.strategy==='stops'?[count,distance,allocation.cost]:[distance,allocation.cost,count];
  const better=(a,b)=>{for(let i=0;i<a.length;i++){if(a[i]<b[i])return true;if(a[i]>b[i])return false}return false};
  for(let mask=1;mask<size;mask++){
    const selected=shops.filter((_,i)=>mask&(1<<i)),allocation=allocate(needs,selected,options.unitMode);if(!allocation.complete)continue;
    let endpoint=-1,distance=Infinity;
    for(let i=0;i<n;i++)if(mask&(1<<i)){const d=dp[mask][i]+(options.returnToStart?gridDistance(shops[i],start):0);if(d<distance){distance=d;endpoint=i}}
    const rank=score(allocation,distance,selected.length);if(!best||better(rank,best.rank))best={mask,endpoint,distance,allocation,rank};
  }
  const order=[];let mask=best.mask,end=best.endpoint;
  while(end>=0){order.push(shops[end]);const previous=parent[mask][end];mask^=1<<end;end=previous}order.reverse();
  if(options.unitMode==='lot')warnings.push('整堆疊配貨採單價排序，可能多買；不保證整組採購金額最低。');
  return {...best.allocation,route:order,distance:best.distance,needs,exact:options.unitMode!=='lot',warnings};
}
