// 採購清單的共同寵物名錄：圖鑑資料與懸賞名單分開維護。
// 舊攻略頁不是最新懸賞的完整來源；非懸賞名單寵物也能透過「全部寵物」選取。
export function makePetDirectory(catalog, classification, abilities) {
  const petMap = new Map();
  const allNames = new Set([...Object.keys(classification), ...Object.keys(abilities)]);
  for (const name of allNames) {
    const metadata = classification[name] || {};
    petMap.set(name, {name, type:'pet', category:'pet', grade:metadata.card || '', source:'https://guide.starcg.net/pets/gallery', bounty:false});
  }
  for (const entry of catalog.filter(row => row.type === 'pet')) {
    const prev = petMap.get(entry.name);
    petMap.set(entry.name, {...prev, ...entry, type:'pet', category:'pet', bounty:true});
  }
  return [...catalog.filter(row => row.type !== 'pet'), ...petMap.values()];
}
export function directoryMatchesType(row, type) {
  if (type === 'all') return true;
  if (type === 'bountypet') return row.type === 'pet' && row.bounty === true;
  return row.category === type;
}
export function directoryMatchesQuery(row, query) {
  const needle = String(query||'').replace(/[的\s]/g,'');
  return !needle || String(row.name||'').replace(/[的\s]/g,'').includes(needle);
}
