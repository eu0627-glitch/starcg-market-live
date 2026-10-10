import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {petCatalog} from '../worker/pet-catalog.js';
import {petClassification} from '../worker/pet-classification.js';
import {makePetDirectory,directoryMatchesType,directoryMatchesQuery} from '../worker/pet-directory.js';
const raw=JSON.parse(await readFile(new URL('../worker/catalog.json',import.meta.url),'utf8'));
const page=await readFile(new URL('../worker/page.html',import.meta.url),'utf8');
const full=makePetDirectory(raw,petClassification,petCatalog);
const bounty=full.filter(r=>directoryMatchesType(r,'bountypet'));
const allPets=full.filter(r=>directoryMatchesType(r,'pet'));
assert.equal(new Set(bounty.map(r=>r.name)).size,bounty.length,'懸賞名單不應重複');
assert.equal(bounty.length,31,'已知懸賞至少 31 種');
for(const name of ['鳥人','液態史萊姆','地獄看門犬','黃色口臭鬼','鐵剪螃蟹']){
 assert(bounty.some(r=>r.name===name),'漏掉已知懸賞：'+name);
 assert(allPets.some(r=>r.name===name),'漏掉圖鑑採購：'+name);
}
for(const name of Object.keys(petClassification))assert(allPets.some(r=>r.name===name),'漏掉圖鑑：'+name);
for(const name of Object.keys(petCatalog))assert(allPets.some(r=>r.name===name),'漏掉能力名錄：'+name);
assert(allPets.length>=Object.keys(petClassification).length);
assert(allPets.filter(r=>directoryMatchesQuery(r,'鳥人')).some(r=>r.name==='鳥人'));
assert(allPets.filter(r=>directoryMatchesQuery(r,'烈風鳥人')).some(r=>r.name==='烈風鳥人'));
assert(bounty.filter(r=>directoryMatchesQuery(r,'鳥人')).some(r=>r.name==='鳥人'));
assert(full.some(r=>r.type==='item'&&r.name==='地的水晶碎片'));
assert.match(page,/value="bountypet">已知懸賞任務寵物/);
assert.match(page,/id="petpool"/);
assert.match(page,/id="petnamesearch"/);
assert.match(page,/id="release-notes" open><summary>1\.2\.5 版修正紀錄/);
console.log('寵物名錄測試通過；圖鑑 '+allPets.length+' 種、已知懸賞 '+bounty.length+' 種（含鳥人）。');
