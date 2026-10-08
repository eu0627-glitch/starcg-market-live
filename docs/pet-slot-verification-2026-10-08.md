# 寵物技能欄查證紀錄（2026-10-08）

## 本次新增證據
透過現有 Cloudflare Worker 的固定官方來源查證，成功取得官方市場 HTML 與官方 AJAX 原始寵物資料；這次不再依賴第三方 API 代替官方資料。

- 官方前端：https://member.starcg.net/market.php?lang=zh
- 官方資料：https://member.starcg.net/market.php?ajax=1&page=1&search=%E5%85%94&type=pet&server=all&exact=0&lang=zh
- 取得時間：2026-10-08（Asia/Taipei）
- HTML：HTTP 200，25,816 字元；市場主要 inline script 15,980 字元。
- AJAX：136 隻販售寵物。資料頁會包含同攤其他寵物，因此這不是兔類搜尋結果數。
- Slot 分布：6 格 19 隻、7 格 20 隻、8 格 88 隻、9 格 6 隻、10 格 3 隻。
- 查證輸出只保留寵物名稱、等級及技能/升星相關欄位，不保存賣家帳號與識別資料。

| 名稱 | Slot | HaveSkillLimit | PetAllocPoint 解碼 | 已學技能數 |
| --- | --- | --- | --- | --- |
| 月球火兔 | 8 | 10 | 0/0/0/0/0 | 2 |
| 月球火兔 | 7 | 10 | 1/1/1/1/1 | 2 |
| 月球火兔 | 7 | 10 | 2/2/2/2/2 | 2 |
| 月球地兔 | 8 | 10 | 0/0/0/0/0 | 2 |
| 月球地兔 | 7 | 10 | 1/1/1/1/1 | 2 |
| 月球地兔 | 7 | 10 | 2/2/2/2/2 | 2 |
| 石像怪 | 6 | 10 | 0/0/0/0/0 | 4 |
| 水果蝙蝠 | 10 | 10 | 0/0/0/0/0 | 3 |
| 布偶夏莉 | 6 | 10 | 2/2/2/2/2 | 3 |

已學技能数按 PetSkill1..10 非負有效值計數；-1 不算技能。
同物種存在不同 Slot；Slot 不等於 HaveSkillLimit 或已學技能數，也不能只由升星配點推算。

## 官方前端核對
官方 renderStalls 的寵物區塊實際只引用：
- p.pet_img_num（圖片）
- p.Name（名称）
- p.Lv（等級）
- p.price、p.pricetype（掛價）

本次取得的官方市場前端沒有 Slot、HaveSkillLimit 或 PetSkill 的顯示/解析定義。因此「官方資料具有個別 Slot」已直接證實，但「官方程式明確定義 Slot 為目前總技能欄」尚未取得。不能把這兩種證據說成同一件事。

## 範本比對
https://starcg-market-from-matong.onrender.com/assets/index-DSVf20et.js
- 顯示使用 Number(Slot ?? slot ?? 6)。
- 滿技使用滿星且圖鑑技能欄減目前 Slot 等於 0。
- 缺欄預設 6 的做法不得照搬。
- 圖鑑欄位可以比較物種基準，不能作為個體目前欄數。

## 發布狀態
功能版本維持 v1.2.1。依既有要求，官方欄位定義未完整核實前，個體總技能欄與技能欄篩選仍隱藏。没有宣稱已恢復或發布技能欄功能。
臨時查證端點已移除，既有市價、懸賞、分類、我的最愛與路線功能保留。
既有 npm run check 全部通過。
