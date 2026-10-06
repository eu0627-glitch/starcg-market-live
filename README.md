# 星詠魔力・市價觀測站 1.0.0

獨立部署版本：GitHub 保存程式，Cloudflare Workers 提供公開網站與查價 API。訪客不需要 GPT 帳號。

## 公開網站的步驟

1. 準備 GitHub 與 Cloudflare 帳號。
2. 在 GitHub 建立名為 `starcg-market` 的儲存庫。公開或私人儲存庫皆可；網站可以公開。
3. 解壓縮部署包，把資料夾裡的檔案上傳至儲存庫根目錄。根目錄應直接看得到 `package.json`、`wrangler.toml`、`worker`、`scripts`。
4. 到 Cloudflare 的 **Workers & Pages** 建立應用程式，使用 **Workers** 流程連接 GitHub，選取該儲存庫。
5. Worker 名稱填 `starcg-market`；建置命令填 `npm run build`；部署命令填 `npx wrangler@4.147.0 deploy`。使用 Node.js 22 或以上。由 Cloudflare 連接流程處理部署授權，不要把帳號金鑰放進程式。
6. 部署成功後，Cloudflare 會提供公開的 `workers.dev` 網址。先試搜，再把實際網址分享給其他人。連接 GitHub 後，可在推送更新時自動部署。

如果更改 Worker 名稱，請同步更改 `wrangler.toml` 的 `name` 與 Cloudflare 設定。

## 用終端機部署

安裝 Node.js 22 或以上，在專案資料夾執行：

```sh
npm run check
npm run dev
```

正式部署至自己的 Cloudflare 帳號：

```sh
npx wrangler@4.147.0 login
npm run deploy
```

部署命令會顯示真正的公開網址。本部署包尚未部署至你的帳號。

## 功能與資料

保留關鍵字查詢、魔幣與魔晶分別統計、最低掛價篩選、寵物條件、歷史成交市場分析、最愛清單及採購順序介面。首頁與 `/api/search`、`/api/history` 在同一個網站，不需要另設跨網域查詢。

最愛與個人清單存在各自的瀏覽器，沒有帳號同步。換網址後，舊網址的最愛不會自動轉移。本包不含使用者個人紀錄。

查價仍依賴 `member.starcg.net`。官方限流或忙碌時，網站會保留近期成功快取並標示更新狀態。這份程式沒有官方資料的永久資料庫。

村莊表是原參考程式的分類標籤，尚未核實為完整 NPC 商店或懸賞物資清單。路線是同地圖採購順序，未驗證障礙物與可通行道路。

GitHub Pages 只能提供靜態網頁，不能執行本專案的查價後端，因此本包採用 GitHub 加 Cloudflare Workers。

## 修改與驗證

修改介面用 `worker/page.html`，修改查價用 `worker/backend.js`。`worker/index.js` 由建置產生，勿直接修改。`npm run check` 使用離線模擬資料驗證，不代表官方服務即時可用。

來源與第三方素材見 `SOURCES.md`；本包未擅自授予第三方素材開源授權。
