import {readFile,writeFile} from 'node:fs/promises';
let html=await readFile('worker/page.html','utf8');
const planner=await readFile('worker/planner.js','utf8');
html=html.replace('/*__PLANNER__*/',planner.replace(/export /g,''));
html=html.replace('/*__CATALOG__*/', 'const officialCatalog = '+await readFile('worker/catalog.json','utf8')+';');
html=html.replace('/*__VILLAGE_SHOPS__*/','const villageShops = '+await readFile('worker/village-shops.json','utf8')+';');
html=html.replace('/*__FALAN_MAP__*/', 'const falanMapImage = '+JSON.stringify('data:image/png;base64,'+(await readFile('worker/falan-map.png')).toString('base64'))+';');
const backend=(await readFile('worker/pet-catalog.js','utf8')).replace('export const','const')+'\n'+(await readFile('worker/backend.js','utf8')).replace("import {petCatalog} from './pet-catalog.js';",'');
await writeFile('worker/index.js','const page = '+JSON.stringify(html)+';\n'+backend+'\nexport default backend;\n');
