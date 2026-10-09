import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const catalog=JSON.parse(await readFile(new URL('../worker/catalog.json',import.meta.url),'utf8'));
const page=await readFile(new URL('../worker/page.html',import.meta.url),'utf8');
const names=['地的水晶碎片','水的水晶碎片','火的水晶碎片','風的水晶碎片'];
const normalize=value=>value.replace(/[的\s]/g,'');
const lookup=(query,type)=>catalog.filter(item=>
  (type==='all'||item.category===type)&&normalize(item.name).includes(normalize(query))
);

for(const name of names){
  const entries=catalog.filter(item=>item.name===name);
  assert.equal(entries.length,1,name+' 必須僅收錄一次');
  assert.equal(entries[0].type,'item',name+' 應為物品');
  assert.equal(entries[0].category,'material',name+' 應屬道具／材料');
  assert.deepEqual(lookup(name,'material').map(item=>item.name),[name]);
  assert.deepEqual(lookup(name,'all').map(item=>item.name),[name]);
  assert.deepEqual(lookup(name.replace('的',''),'all').map(item=>item.name),[name]);
}
assert.match(page,/<select id="catalogtype"[^>]*><option value="all">不限<\/option>/);
console.log('四種水晶碎片的懸賞採購分類、關鍵字查詢與預設不限搜尋檢查通過。');
