# Requirements — 起士公爵 生產良率監測系統

**Source of truth:** `SDD.md` v1.1 + `PRD_起士公爵生產良率監測系統.md` v2.1
**Scope for this milestone:** v2.1 落地 + V3 重構路線（§12 步驟 4-6 + §11.1/§9/§10.1）
**Last updated:** 2026-04-15

---

## R1. v2.1 — 批次結構升級（必達）

### R1.1 Record/WorkOrder 資料模型升級
- Record 新增欄位：`batchNum`（1-9）、`layer`（1-3）、`product`（預設 `"重乳"`）
- `batch` 由 `{batchNum}-{layer}` 組成（保留為顯示／唯一鍵的一部分）
- 唯一鍵：`date + batch + station`（batch 已含 layer）
- `round` 不存，由 `Math.ceil(batchNum/3)` 衍生
- 遷移：既有 Record（無 `product`）預設為「重乳酪」

### R1.2 WorkOrder 結構升級
- `WorkOrder.layers[]`：每項 `{ batch, batchNum, layer, product, flavor, notes }`
- 新增 localStorage key：`bakery_workorder_sheet_url`（永久綁定）

### R1.3 多層複選 UX
- 均質／蛋白霜站：層按鈕改 checkbox 樣式，可一次勾多層
- 已記錄的層仍標示綠色「已完成」
- 提交時多選 → 跳確認 modal 列出要寫入層清單
- 整面／烤箱／品判：維持單選
- `AppState.selectedLayers[]` 多選、`AppState.batch` 單選／多選第一個

**Acceptance：** 均質站一次勾 1-1、1-2、1-3，提交後 localStorage 出現 3 筆相同 data 但不同 batch 的 Record。

---

## R2. v2.1 — Google Sheet 工單拉取協議（必達）

### R2.1 URL 綁定與解析
- 管理頁輸入 Sheet URL（edit 或 CSV export 皆可）
- 解析 `spreadsheetId` + `gid`，存 `bakery_workorder_sheet_url`
- 轉為 `https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid={GID}`

### R2.2 CSV 欄位契約
```
A=批次(int) | B=層(int) | C=品項(str) | D=口味(str) | E=備註(str)
第一列標題；第二列起解析；空列視為結束
```

### R2.3 拉取流程 `fetchTodayWorkOrder()`
- 快取命中條件：`date === today && fetchedAt < 1hr 前`
- Miss → fetch CSV → 解析 → 更新快取 → 推送 `saveWorkOrder` 上雲
- 失敗 → fallback 既有快取；無快取則顯示空工單

### R2.4 觸發時機
- 首頁 `route('')` 時若工單快取非當日 → 自動拉
- 管理頁「🔄 重新拉取」→ 強制拉（忽略快取）

### R2.5 錯誤處理
- URL 格式錯誤：解析階段提示
- Sheet 未公開：提示「請設為『知道連結的任何人可檢視』」
- CSV 格式錯：顯示「Sheet 格式錯誤」
- 斷線：fallback 本地快取

**Acceptance：** 換一個 Sheet gid 後，首頁進入自動拉到對應批次；斷網時仍可用上次快取；Sheets 工單表有該日資料。

---

## R3. v2.1 — PRD 差異補實作

### R3.1 工單匯入後自動 `saveWorkOrder`（差異 #3）
- 管理頁存工單 → 自動呼叫 Apps Script `saveWorkOrder` 推上雲

### R3.2 Record `defects` 去重（差異 #4）
- 移除頂層 `defects`；統一由 `summary.defects` 讀取
- 遷移：讀取時 fallback 舊欄位，寫入時只寫新結構

### R3.3 PRD 文案校正
- §10.2「手動同步」→ 改為「自動同步 + 離線佇列」
- §8 明寫「分析頁：優先雲端、fallback 本地」
- §12「單 HTML < 50KB」→ 改為「初次載入 < 100KB」

---

## R4. V3 — 離線同步佇列（SDD §10.1）

### R4.1 佇列資料結構
`localStorage["bakery_sync_queue"]` = `[{ id, record, attempts, lastError, queuedAt }]`

### R4.2 寫入改造
- `submitStation` → `saveRecords`（本地）→ `enqueueSync` → `flushQueue`
- 既有 `syncToCloud` 改為 `enqueueSync + flushQueue` 組合

### R4.3 flushQueue 策略
- `navigator.onLine === false` → return，sync-bar `offline`
- 成功 → 移出佇列
- 失敗 → `attempts++`，指數退避（1/2/4/8/16，max 60 s）
- 連 5 失敗 → 暫停該筆，sync-bar `error` + 佇列數
- `window.addEventListener('online', flushQueue)`
- 管理頁：顯示「待同步 N 筆」+「立即重試」

### R4.4 Upsert 安全
- 後端 upsert by `date+batch+station` 已保證冪等，重送不重複

**Acceptance：** 斷網提交 3 筆 → 佇列 3；網路恢復自動清空；Sheets 無重複列。

---

## R5. V3 — 安全加固（SDD §9.2）

### R5.1 Token 驗證
- Apps Script：`PropertiesService` 存 `SECRET_TOKEN`
- `doGet/doPost` 開頭驗 token，不符回 401
- 前端 `cloudFetch` 帶 `?token=` 或 body.token
- 管理頁設定介面，存 `localStorage["cloud_token"]`

### R5.2 XSS 修補
- 使用者輸入（notes、自訂人員名、defect 名）一律 `textContent`
- 模板拼接改 `document.createElement`
- 或引入 `esc()` helper

---

## R6. V3 — 多品項支援（SDD §11.1）

### R6.1 PRODUCT_TYPES 常數
```js
PRODUCT_TYPES = {
  '重乳酪': { stations: [...], fields: {...} },
  '輕乳酪': {...}, '布朗尼': {...}, '巴斯克': {...}
}
```

### R6.2 工站動態渲染
- 進工站 → 列出今日該站批次 → 依批次 `product` 過濾與渲染 fields
- 批次卡標示品項類別
- 同站當日可處理多品項

### R6.3 資料模型遷移
- Record 加 `product` 欄（Sheets 加欄位）
- 舊資料預設 `"重乳酪"`

---

## R7. V3 — LINE 通知（SDD §11.2）

- Apps Script 端觸發（選項 A）
- `LINE_NOTIFY_TOKEN` 存 `PropertiesService`
- `syncRecords` 若 `criticalCount > 0 || defects.length > 0` → `notifyLine(record)`
- 訊息：`🔴 [站別] {批次}（{口味}）異常\n操作員：{name}\n項目：{defects/異常摘要}\n時間：{timestamp}`
- LINE 失敗不阻擋寫入（try/catch）

---

## R8. V3 — 重構基建（SDD §12 步驟 4-6 + §13）

### R8.1 模組拆分
- `js/config.js` · `state.js` · `cloud.js` · `validators.js` · `pages/{station,dashboard,analytics,admin}.js` · `app.js`

### R8.2 CloudService 類
- 封裝 fetch + 佇列 + 重試

### R8.3 驗證器單元測試
- `validateNum/Time/Sel/Dual` 純函式 → Vitest 或最小 assert

### R8.4 clasp 後端版本化
- `clasp clone/push/deploy`；GAS 原始碼進版控

---

## R9. V3（延後）— 附屬功能

以下列為 backlog，當期不排 phase：
- 自動日報（§11.3）· 照片上傳（§11.4）· QR Code 工單（§11.5）· 多工廠（§11.6）

---

## Out of Scope

- 多租戶 SaaS · OAuth 登入 · 原生 App · 即時 DB · 工作流引擎

## 共用驗收條件

- 任何新功能在桌機 Chrome / 手機 Safari / Android Chrome 三處測過
- 觸控目標 ≥ 44 px
- 初次載入 < 100 KB（gzip 後）
- 所有雲端呼叫失敗都不阻擋本地作業
