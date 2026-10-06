# 資料與素材來源

- 官方攤位與成交：https://member.starcg.net/market.php?lang=zh 、https://member.starcg.net/marketrecord.php 。運行時查詢。
- 法蘭城地圖與座標參考：https://github.com/Baconrad/StarCG-Market-Assistant ，`web/public/map.png` 與 `web/src/components/MapViewer.vue`。本包的 `worker/falan-map.png` 保留參考地圖；第三方權利屬原權利人，公開使用應確認授權。
- 村莊分類來自使用者提供的參考程式；來源校驗見 `worker/village-source.json`，不包含原執行檔。
- 商品與寵物對照表為既有專案整理資料，見 `worker/catalog.json`、`worker/pet-catalog.js`。這次部署整理未重新校正數值。
