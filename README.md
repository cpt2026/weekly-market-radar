# 每週市場 Radar

公開唯讀的每週市場風險 Dashboard，使用 ChatGPT Sites 託管。本機檔案是唯一資料來源；網站沒有資料庫、登入或編輯功能。

## 日常使用

- 修改監察項目：編輯 `radar_parameters.md`，或直接用自然語言叫 Codex 新增、修改、停用或刪除參數。
- 下載並合併最新 VIX／ETF 周數據：`npm run refresh`
- 本機預覽：`npm run dev`
- 驗證：`npm test`

## 主要檔案

- `radar_parameters.md`：監察定義、門檻及資料治理規則
- `data/weekly_snapshots.json`：已驗證歷史快照
- `scripts/refresh-market-data.mjs`：可重跑的 VIX／ETF 更新程式
- `app/`：Dashboard 網站
- `.openai/hosting.json`：固定 Sites 專案連接

若資料、測試或建置失敗，不應發佈；正式網站會保留上一個成功版本。
