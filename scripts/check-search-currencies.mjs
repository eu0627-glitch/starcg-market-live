import vm from 'node:vm';import assert from 'node:assert/strict';import worker from '../worker/index.js';import {normalizeMarket,petDetails,unpackPetGrades} from '../worker/backend.js';
const html=await (await worker.fetch(new Request('https://test/'))).text(),script=html.match(/<script>([\s\S]*)<\/script>/)[1];
const elements=new Map();for(const m of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){const [tag,attrs,id]=[m[1],m[2],m[3]];let value=attrs.match(/\bvalue="([^"]*)"/)?.[1]||'';if(tag==='select'){const rest=html.slice(m.index+m[0].length).split('</select>')[0],o=rest.match(/<option(?:\s[^>]*)?>([^<]*)/);value=o?.[0].match(/value="([^"]*)"/)?.[1]??o?.[1]??'';}elements.set(id,{value,checked:/\bchecked\b/.test(attrs),innerHTML:'',textContent:'',hidden:false,dataset:{},classList:{toggle(){}},addEventListener(){}})}
const c=vm.createContext({document:{getElementById:id=>{assert(elements.has(id),'Missing ID '+id);return elements.get(id)},querySelectorAll:()=>[]},localStorage:{getItem:()=>null,setItem(){}},setTimeout:()=>0,setInterval:()=>0,clearInterval(){},Date,URL,URLSearchParams,Blob,confirm:()=>true});vm.runInContext(script,c);
assert.equal(elements.has('petskillsenabled'),false);assert.equal(elements.has('petskills'),true);assert.equal(elements.get('petskills').value,'all');assert.equal(elements.get('currency').value,'all');assert.equal(elements.get('exact').checked,false);
const base={name:'月球水兔',nickname:'火兔',variant:'',type:'pet',quantity:1,server:'S1',date:new Date().toISOString()};c.fixtures=[{...base,status:'sold',currency:'魔幣',price:100},{...base,status:'sold',currency:'魔晶',price:3},{...base,status:'listing',currency:'魔幣',price:200,stall:'同攤位'},{...base,status:'listing',currency:'魔晶',price:5,stall:'同攤位'}];
vm.runInContext(`data=fixtures;$('sourceMode').value='local';$('query').value='火兔';$('variant').value=JSON.stringify(['月球水兔','']);$('listingmode').value='cheapest';render();`,c);
assert.equal(vm.runInContext('sold.length',c),2);assert.match(elements.get('daily').innerHTML,/成交均價/);assert.match(elements.get('min').innerHTML,/魔幣 · 100/);assert.match(elements.get('min').innerHTML,/魔晶 · 3/);assert.match(elements.get('listings').innerHTML,/200 <span[^>]*>魔幣/);assert.match(elements.get('listings').innerHTML,/5 <span[^>]*>魔晶/);assert.match(elements.get('listings').innerHTML,/火兔/);assert.equal((elements.get('chart').innerHTML.match(/<svg/g)||[]).length,2);
vm.runInContext(`$('query').value='月球';`,c);assert.equal(vm.runInContext('filterRows(data,undefined,false).length',c),4);vm.runInContext(`$('exact').checked=true`,c);assert.equal(vm.runInContext('filterRows(data,undefined,false).length',c),0);vm.runInContext(`$('query').value='火兔'`,c);assert.equal(vm.runInContext('filterRows(data,undefined,false).length',c),4);
vm.runInContext(`$('exact').checked=false;$('query').value='火兔';data.push({...fixtures[0],name:'[月球火兔]升星銀卡',nickname:'',type:'item'});$('variant').value='all';variants();render();`,c);assert.equal(elements.get('variant').value,'all');assert.match(elements.get('listings').innerHTML,/火兔/);assert.equal(elements.get('min').textContent,'請選物品');assert.equal(vm.runInContext('filterRows(data).length',c),5);
c.lowestFixtures=[...c.fixtures.filter(r=>r.status==='listing'),{...base,status:'listing',currency:'魔幣',price:200,stall:'同價第二攤'}];assert.equal(vm.runInContext("lowestListings(lowestFixtures,['魔幣']).length",c),2);assert.equal(vm.runInContext("lowestListings(lowestFixtures,['魔晶']).length",c),1);assert.equal(vm.runInContext("lowestListings(lowestFixtures,['魔幣','魔晶']).length",c),3);
vm.runInContext(`$('lowgem').checked=true;render()`,c);assert.doesNotMatch(elements.get('listings').innerHTML,/200 <span/);assert.match(elements.get('listings').innerHTML,/5 <span/);vm.runInContext(`$('lowgem').checked=false`,c);
const rabbit=petDetails({Name:'月球地兔',Lv:1,Hp:98,ForcePoint:68,Vital:500,Str:700,Tough:280,Quick:480,Magic:140,AllocPoint:0x1784e4c6,PetAllocPoint:0,HaveSkillLimit:10});assert.deepEqual(rabbit.grades,[23,33,14,19,6]);assert.equal(rabbit.totalGrades,95);assert.equal(rabbit.stars,10);assert.deepEqual(rabbit.bp,[5,7,2.8,4.8,1.4]);assert.equal(petDetails({Name:'舞蹈花妖',PetAllocPoint:0x5145145}).stars,25);assert.equal(petDetails({Name:'舞蹈花妖',PetAllocPoint:0x5145145,HaveSkillLimit:10}).skills,null);assert.deepEqual(petDetails({Name:'月球地兔',AllocPoint:26*2**24+36*2**18+16*2**12+22*2**6+10,PetAllocPoint:0}).drops,[0,0,0,0,0]);assert.equal(petDetails({}).stars,null);assert.equal(unpackPetGrades(-1),null);c.rabbit=rabbit;assert.equal(rabbit.skills,null);assert.equal(petDetails({Name:'月球火兔',PetAllocPoint:0,HaveSkillLimit:10}).skills,null);assert.doesNotMatch(vm.runInContext('petSummary(rabbit)',c),/總技能欄/);assert.deepEqual(rabbit.drops,[3,3,2,3,4]);assert.match(vm.runInContext('petSummary(rabbit)',c),/總星數 10 星.*掉檔 -15/);assert.doesNotMatch(vm.runInContext('petSummary(rabbit)',c),/未提供/);assert.match(vm.runInContext('petSummary({drops:[0,0,0,0,0]})',c),/滿檔/);assert.match(vm.runInContext('petSummary({drops:[2,1,0,4,0]})',c),/掉檔 -7.*體力 -2.*力量 -1.*速度 -4/);assert.equal(elements.has('records'),false);assert.equal(elements.has('sort'),false);
// Pet controls combine conditions; unknown fields never satisfy a filter.
c.petFixtures=[{...base,status:'listing',currency:'魔幣',price:100,pet:{stars:25,skills:8,drops:[0,0,0,0,0],level:10}},{...base,status:'listing',currency:'魔幣',price:120,pet:{stars:25,skills:8,drops:[0,0,0,0,0],level:11}},{...base,status:'listing',currency:'魔晶',price:3,pet:{stars:25,skills:8,drops:[0,0,0,0,0],level:20}},{...base,status:'listing',currency:'魔晶',price:4,pet:{stars:24,skills:8,drops:[0,0,0,0,0],level:21}},{...base,status:'listing',currency:'魔幣',price:140,pet:{stars:25,skills:null,drops:null,level:11}},{...base,status:'sold',currency:'魔幣',price:160}];
vm.runInContext(`data=petFixtures;$('type').value='pet';$('petfullstar').checked=true;$('petfullgrade').checked=true;selectedPetLevels.add(11);$('variant').value='all';render()`,c);
assert.equal(vm.runInContext('listings.length',c),2);assert.equal(vm.runInContext('sold.length',c),0);assert.match(elements.get('quality').textContent,/未附能力的成交不納入/);
vm.runInContext('selectedPetLevels.clear();selectedPetLevels.add(1);render()',c);assert.equal(vm.runInContext('listings.length',c),1);
vm.runInContext(`$('petfullstar').checked=false;$('petfullgrade').checked=false;selectedPetLevels.clear();$('type').value='all';data=fixtures;`,c);
for(const id of ['batchowned','batchtimes','budget','returnstart','autobatch','interval'])assert.equal(elements.has(id),false);
vm.runInContext(`$('catalogtype').value='material';$('catalogquery').value='妖草血';catalogRender()`,c);assert.match(elements.get('catalogitems').innerHTML,/妖草的血/);assert.doesNotMatch(elements.get('catalogitems').innerHTML,/長劍/);
vm.runInContext(`$('village').value='聖拉魯卡村';villageRender()`,c);for(const name of ['精煉的鋼錠','精煉的銀錠','實用的長劍','實用的斧頭'])assert.match(elements.get('villagegoods').innerHTML,new RegExp(name));assert.doesNotMatch(elements.get('villagegoods').innerHTML,/番茄|水龍|紅帽/);
const beforeVillageBatch=vm.runInContext('JSON.stringify(batch)',c);vm.runInContext(`toggleVillage('v0-0');toggleVillage('v0-1');villageNeeds[0].quantity=3;villageNeedRender()`,c);assert.equal(vm.runInContext('villageNeeds.length',c),2);assert.match(elements.get('villageshops').innerHTML,/精煉的鋼錠/);assert.equal(vm.runInContext('JSON.stringify(batch)',c),beforeVillageBatch);
vm.runInContext(`$('village').value='伊爾村';villageRender()`,c);assert.match(elements.get('villagegoods').innerHTML,/番茄/);assert.doesNotMatch(elements.get('villagegoods').innerHTML,/精煉的鋼錠/);assert.match(elements.get('villageshops').innerHTML,/精煉的鋼錠/);assert.equal(vm.runInContext('villageNeeds[0].quantity',c),3);vm.runInContext(`toggleVillage('v0-1')`,c);assert.equal(vm.runInContext('villageNeeds.length',c),1);
vm.runInContext(`$('catalogtype').value='equipment';catalogControls();$('catalogcategory').value='劍';$('catalogquery').value='';catalogRender()`,c);assert.match(elements.get('catalogitems').innerHTML,/長劍/);assert.doesNotMatch(elements.get('catalogitems').innerHTML,/羽毛袍/);
vm.runInContext(`toggleCatalog(officialCatalog.findIndex(r=>r.name==='長劍'));batch[0].quantity=4;batchRender();$('catalogtype').value='pet';catalogControls()`,c);assert.equal(vm.runInContext('batch.length',c),1);assert.equal(vm.runInContext('batch[0].quantity',c),4);assert.doesNotMatch(elements.get('catalogcategory').innerHTML,/劍|斧|盾牌/);assert.match(elements.get('batchitems').innerHTML,/value="4"/);assert.equal(elements.get('selectedcount').textContent,'2 項');vm.runInContext(`toggleCatalog(officialCatalog.findIndex(r=>r.name==='長劍'))`,c);assert.equal(vm.runInContext('batch.length',c),0);
assert.equal(elements.has('addselected'),false);assert.equal(elements.has('demoRoute'),false);
console.log('Direct multi-selection, cancellation, cross-village quantities, separate sourcing and pet-specific classifications passed');

assert.match(html,/<h1>市價觀測站<\/h1>/);assert.match(html,/<summary>使用說明<\/summary>/);
// A slow history request must not block visible listings.
// A failed commodity stays unknown; retry fetches only that commodity and retains successful shops.
vm.runInContext(`batch=[{name:'長劍',type:'item',quantity:1},{name:'羽毛袍',type:'item',quantity:1}];$('batchsource').value='official';$('routeserver').value='S1';$('routecurrency').value='魔幣';$('routemap').value='法蘭城';$('startx').value='242';$('starty').value='100';$('startpoint').value='W2';$('startpoint').onchange()`,c);
assert.equal(elements.get('startx').value,72);assert.equal(elements.get('starty').value,123);
const batchCalls=[];let failRobe=true;c.fetch=async path=>{const name=new URL(path,'https://test').searchParams.get('q');batchCalls.push(name);return name==='羽毛袍'&&failRobe?Response.json({error:'S1 官方連線回應 503'},{status:502}):Response.json({rows:[{name,type:'item',quantity:1,status:'listing',currency:'魔幣',price:100,priceBasis:'unit',server:'S1',stall:'賣 '+name,coords:'法蘭城 [東:154 南:102]'}],warnings:[]})};
await vm.runInContext('runBatch()',c);assert.deepEqual(batchCalls,['長劍','羽毛袍']);assert.match(elements.get('batchfailures').innerHTML,/重試這項商品/);assert.doesNotMatch(elements.get('batchfailures').innerHTML,/503/);assert.match(elements.get('batchresult').innerHTML,/尚未查明/);assert.match(elements.get('routesteps').innerHTML,/長劍/);assert.doesNotMatch(elements.get('routesteps').innerHTML,/估算距離/);assert.match(elements.get('routemapview').innerHTML,/data:image\/png;base64/);assert.match(elements.get('routemapview').innerHTML,/viewBox="0 0 960 685"/);
failRobe=false;await vm.runInContext("runBatch('羽毛袍')",c);assert.deepEqual(batchCalls,['長劍','羽毛袍','羽毛袍']);assert.equal(elements.get('batchfailures').innerHTML,'');assert.match(elements.get('routesteps').innerHTML,/長劍/);assert.match(elements.get('routesteps').innerHTML,/羽毛袍/);assert.match(elements.get('batchresult').innerHTML,/已找到可購足/);
assert.doesNotMatch(elements.get('villageshops').innerHTML,/data-villagesearch/);
// All servers are queried once per item; plans cannot combine stock across servers.
const serverCalls=[];c.fetch=async path=>{const u=new URL(path,'https://test');serverCalls.push(u.searchParams.get('server'));const name=u.searchParams.get('q');return Response.json({rows:[{name,type:'item',quantity:1,status:'listing',currency:'魔幣',price:100,priceBasis:'unit',server:name==='長劍'?'S1':'S2',stall:name,coords:'法蘭城 [東:154 南:102]'}],warnings:[]})};
vm.runInContext("$('routeserver').value='all'",c);await vm.runInContext('runBatch()',c);assert.deepEqual(serverCalls,['all','all']);for(const server of ['S1','S2','S3'])assert.match(elements.get('batchresult').innerHTML,new RegExp(server+' · 魔幣 採購方案'));assert.doesNotMatch(elements.get('batchresult').innerHTML,/已找到可購足全部需求的方案/);
vm.runInContext("$('routeserver').value='S2'",c);await vm.runInContext('runBatch()',c);assert.deepEqual(serverCalls.slice(-2),['S2','S2']);assert.doesNotMatch(elements.get('routesteps').innerHTML,/長劍/);
let finishHistory;const pendingHistory=new Promise(resolve=>finishHistory=resolve);
c.fetch=async path=>path.startsWith('/api/search')?Response.json({rows:[{...base,name:'月球火兔',nickname:'',status:'listing',currency:'魔幣',price:70000,stall:'測試攤位'}],warnings:[]}):pendingHistory;
vm.runInContext(`$('sourceMode').value='official';$('query').value='火兔';$('type').value='all';$('currency').value='all';$('exact').checked=false;`,c);
const pendingSearch=vm.runInContext('search()',c);await new Promise(resolve=>setImmediate(resolve));
assert.match(elements.get('listings').innerHTML,/月球火兔/);assert.match(elements.get('status').textContent,/歷史成交查詢中/);
finishHistory(Response.json({rows:[],total:0}));await pendingSearch;const beforeFilter=elements.get('listings').innerHTML;c.fetch=()=>{throw Error('Filters must not request upstream')};vm.runInContext(`$('currency').value='魔幣';$('currency').onchange();$('type').onchange();$('server').onchange()`,c);assert.match(elements.get('listings').innerHTML,/月球火兔/);
c.fetch=async path=>path.startsWith('/api/search')?Response.json({error:'官方服務繁忙'},{status:502}):Response.json({rows:[],total:0});await vm.runInContext('search()',c);assert.match(elements.get('listings').innerHTML,/不能判定是否有販售攤位/);assert.doesNotMatch(elements.get('listings').innerHTML,/匯入資料/);assert.match(elements.get('listingcount').textContent,/攤位數量未知/);
const normalized=normalizeMarket({stalls:[{cdkey:'a'}],itemsByCd:{},petsByCd:{a:[{Name:'月球水兔',UserPetName:'地兔',price:100,pricetype:0}]}},1,new Date().toISOString());assert.equal(normalized[0].nickname,'地兔');assert.equal(normalized[0].name,'月球水兔');
const allServerRows=normalizeMarket({stalls:[{cdkey:'g',server:1},{cdkey:'c',server:3}],itemsByCd:{g:[{ITEM_TRUENAME:'月球火兔卡片',price:120,pricetype:0,ITEM_REMAIN:1}],c:[{ITEM_TRUENAME:'月球火兔卡片',price:2,pricetype:1,ITEM_REMAIN:1}]},petsByCd:{}},'all',new Date().toISOString());assert.deepEqual(allServerRows.map(r=>[r.server,r.currency]),[['S1','魔幣'],['S3','魔晶']]);
const original=globalThis.fetch;const queries=[];globalThis.fetch=async input=>{const u=new URL(input),currency=u.searchParams.get('currency');queries.push(currency);return Response.json({logs:[{id:currency,item_name:'月球水兔',buff:'購買寵物',qty:1,unit_gross_price:currency==='gold'?100:3,ts:1791214355,pricetype:currency==='gold'?0:1}],totalFiltered:1})};
const response=await worker.fetch(new Request('https://test/api/history?q=月球水兔&currency=all&days=7'));assert.equal(response.status,200);const payload=await response.json();assert.equal(payload.rows.length,2);assert.deepEqual(new Set(queries),new Set(['gold','gem']));assert.equal(payload.perCurrency['魔晶'].loaded,1);globalThis.fetch=original;
console.log('Combined currency search, separate statistics/charts, per-currency lowest listing, partial names, pet nicknames and immediate listings before slow history passed.');
// Official category lookup: names without a weapon keyword and misleading names stay in their real category.
assert.equal(vm.runInContext("equipmentCatalog.find(e=>e.name==='剛毅').category",c),'劍');
assert.equal(vm.runInContext("equipmentCatalog.find(e=>e.name==='青龍刀').category",c),'劍');
assert.equal(vm.runInContext("equipmentCatalog.find(e=>e.name==='小圓盾').level",c),1);
c.equipmentFixtures=[{...base,name:'剛毅',nickname:'',type:'item',status:'listing',price:100,currency:'魔幣'},{...base,name:'長劍',nickname:'',type:'item',status:'listing',price:50,currency:'魔晶'},{...base,name:'不存在的劍',nickname:'',type:'item',status:'listing',price:1,currency:'魔幣'},{...base,name:'剛毅',nickname:'',type:'pet',status:'listing',price:1,currency:'魔幣'}];
vm.runInContext(`$('sourceMode').value='local';$('currency').value='all';$('server').value='all';$('equipmentcategory').value='劍';$('equipmentlevel').value='all';$('type').value='equipment';$('query').value='';$('variant').value='all';data=equipmentFixtures;`,c);
assert.equal(vm.runInContext('filterRows(data).length',c),2);
vm.runInContext(`$('equipmentlevel').value='11'`,c);assert.equal(vm.runInContext('filterRows(data)[0].name',c),'剛毅');assert.equal(vm.runInContext('filterRows(data).length',c),1);
let equipmentRequests=[];c.fetch=async path=>{equipmentRequests.push(path);return Response.json({rows:c.equipmentFixtures,total:0,warnings:[]})};
vm.runInContext(`$('sourceMode').value='official';$('server').value='S2';$('equipmentlevel').value='all';$('lowgold').checked=false;$('lowgem').checked=false;`,c);
await vm.runInContext('search()',c);assert.equal(equipmentRequests.length,1);const categoryRequest=new URL(equipmentRequests[0],'https://test');assert.equal(categoryRequest.searchParams.get('category'),'劍');assert.equal(categoryRequest.searchParams.get('q'),'');assert.equal(categoryRequest.searchParams.get('server'),'S2');assert.equal(vm.runInContext('listings.length',c),0); // Fixture rows belong to S1, so none may leak into S2.
equipmentRequests=[];vm.runInContext(`$('server').value='all';$('equipmentname').value='剛毅';`,c);await vm.runInContext("$('equipmentname').onchange()",c);assert.equal(equipmentRequests.length,2);assert.equal(new URL(equipmentRequests[1],'https://test').searchParams.get('q'),'剛毅');assert.equal(new URL(equipmentRequests[0],'https://test').searchParams.get('exact'),'1');
vm.runInContext(`clearEquipment();$('query').value='火兔';`,c);assert.equal(elements.get('equipmentcategory').value,'');
console.log('Official equipment category, level, single-server request and item-specific history checks passed');

vm.runInContext(`marketIncomplete=true;marketState='ready';liveRows=[];render()`,c);assert.match(elements.get('listings').innerHTML,/查詢未完整，不能判定/);

// Switching to pets clears equipment state without overriding the user's chosen type.
vm.runInContext(`$('equipmentcategory').value='劍';$('query').value='長劍';$('type').value='pet';$('type').onchange()`,c);assert.equal(elements.get('type').value,'pet');assert.equal(elements.get('equipmentcategory').value,'');assert.equal(elements.get('equipmentcategoryfield').hidden,true);assert.equal(elements.get('equipmentcategory').disabled,true);assert.equal(elements.get('query').value,'');
vm.runInContext(`$('type').value='equipment';$('type').onchange()`,c);assert.equal(elements.get('equipmentcategoryfield').hidden,false);assert.equal(elements.get('equipmentcategory').disabled,false);
assert.doesNotMatch(elements.get('villageshops').innerHTML,/選擇村莊與物資/);

// Pet classification uses catalog names and excludes items and unknown metadata.
vm.runInContext(`$('type').value='pet';$('type').onchange();$('petrace').value='金屬系';$('petcard').value='普卡';petClassControls()`,c);assert.equal(elements.get('equipmentcategoryfield').hidden,true);assert.equal(elements.get('petracefield').hidden,false);assert.match(elements.get('petname').innerHTML,/月球水兔/);assert.doesNotMatch(elements.get('petname').innerHTML,/迷你蝙蝠/);
assert.equal(vm.runInContext("matchesPetClass({name:'月球水兔',type:'pet'})",c),true);assert.equal(vm.runInContext("matchesPetClass({name:'月球水兔',type:'item'})",c),false);assert.equal(vm.runInContext("matchesPetClass({name:'未知寵物',type:'pet'})",c),false);
equipmentRequests=[];c.fetch=async path=>{equipmentRequests.push(path);return Response.json({rows:[],total:0,warnings:[]})};vm.runInContext(`$('sourceMode').value='official';$('query').value=''`,c);await vm.runInContext('search()',c);assert.equal(equipmentRequests.length,1);assert.equal(new URL(equipmentRequests[0],'https://test').searchParams.get('petRace'),'金屬系');assert.equal(new URL(equipmentRequests[0],'https://test').searchParams.has('category'),false);
equipmentRequests=[];vm.runInContext(`$('petname').value='月球水兔'`,c);await vm.runInContext("$('petname').onchange()",c);assert.equal(equipmentRequests.length,2);assert.equal(new URL(equipmentRequests[1],'https://test').searchParams.get('q'),'月球水兔');
vm.runInContext(`$('type').value='equipment';$('type').onchange()`,c);assert.equal(elements.get('petracefield').hidden,true);assert.equal(elements.get('petrace').value,'');assert.equal(elements.get('equipmentcategoryfield').hidden,false);
console.log('Pet race/card/name controls, mutual exclusion and item-specific history passed');

assert.doesNotMatch(html.slice(0,html.indexOf('id="release-notes"')),/自訂採購商品|村莊領取清單|id="addbatch"/);
vm.runInContext(`$('type').value='item';$('type').onchange();$('query').value='長劍';$('exact').checked=true;data=equipmentFixtures;`,c);assert.equal(vm.runInContext('filterRows(data).length',c),0);assert.equal(elements.get('equipmentcategoryfield').hidden,true);
vm.runInContext(`$('type').value='all';$('type').onchange()`,c);assert.equal(elements.get('equipmentcategoryfield').hidden,true);assert.equal(elements.get('petracefield').hidden,true);

// Individual Slot regression: engine limits and learned skills must never override it.
for(const slot of [6,7,8,9,10])assert.equal(petDetails({Name:'月球地兔',Slot:slot,HaveSkillLimit:10,PetSkill1:7300,PetAllocPoint:34087042}).skills,slot);
for(const slot of [undefined,null,'',0,-1,7.5,'bad'])assert.equal(petDetails({Name:'月球地兔',Slot:slot,HaveSkillLimit:10}).skills,null);
assert.equal(petDetails({Name:'月球地兔',Slot:'7'}).skills,7);
assert.equal(petDetails({Name:'月球地兔',slot:7}).skills,7);
const fullStarPoints=[24,18,12,6,0].reduce((sum,shift)=>sum+3*2**shift,0);
assert.equal(petDetails({Name:'月球地兔',Slot:8,PetAllocPoint:fullStarPoints}).fullSkills,true);
assert.equal(petDetails({Name:'月球地兔',Slot:7,PetAllocPoint:fullStarPoints}).fullSkills,false);
assert.equal(petDetails({Name:'月球地兔',Slot:8,PetAllocPoint:0}).fullSkills,false);
assert.equal(petDetails({Name:'未收錄的寵物',Slot:8,PetAllocPoint:fullStarPoints}).fullSkills,null);
c.slotFixtures=[
 {...base,pet:{skills:7,fullSkills:false}},
 {...base,pet:{skills:8,fullSkills:true}},
 {...base,pet:{skills:8,fullSkills:false}},
 {...base,pet:{skills:null,fullSkills:null}}
];
vm.runInContext(`$('type').value='pet';$('petfullstar').checked=false;$('petfullgrade').checked=false;selectedPetLevels.clear();$('petskills').value='7';$('petfullskills').checked=false;`,c);
assert.equal(vm.runInContext('slotFixtures.filter(matchesPetConditions).length',c),1);
vm.runInContext(`$('petskills').value='8';$('petfullskills').checked=true;`,c);
assert.equal(vm.runInContext('slotFixtures.filter(matchesPetConditions).length',c),1);
assert.match(vm.runInContext('petSummary(slotFixtures[0].pet)',c),/總技能欄 7/);
assert.doesNotMatch(vm.runInContext('petSummary(slotFixtures[3].pet)',c),/總技能欄/);
vm.runInContext(`$('type').value='item'`,c);
assert.equal(vm.runInContext('slotFixtures.filter(matchesPetConditions).length',c),4);
console.log('Actual Slot counts, invalid/missing data, full-skill rule and combined slot filters passed');
