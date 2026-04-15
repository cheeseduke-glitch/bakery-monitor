# Phase 2: v2.1 多層複選 UX + Google Sheet 工單拉取 — Context

**Phase goal:** 操作員一次寫多層、班長換 Sheet gid 就換工單；PRD 文案同步校正。
**Requirements covered:** R1.3, R2.1–R2.5, R3.1, R3.3
**Discussion date:** 2026-04-15
**Status of code:** 大部分已在 commit `e3bb1e3` 實作（`MULTI_LAYER_STATIONS`、`selectedLayers`、工站多選切換、`fetchTodayWorkOrder`、`parseWorkOrderCsv`、`sheetUrlToCsv`、`saveWorkOrder` 自動推送皆存在）。本 Phase 實際工作：**補確認 modal、補錯誤訊息顯示、補重新拉取覆蓋 UX、PRD 文案校正**。

---

## Canonical refs

- `SDD.md` §4.2（多層 UX）、§6.5（Sheet 拉取協議）、§10（PRD 差異）
- `PRD_起士公爵生產良率監測系統.md` v2.1 §10.2 / §8 / §12（待校正三處）
- `.planning/REQUIREMENTS.md` R1.3 / R2.1-R2.5 / R3.1 / R3.3
- `.planning/phases/01-batch-structure-upgrade/01-CONTEXT.md`（D3 雙寫過渡 / D4 product 下拉仍適用）
- 既有程式：`app.js`（Storage 模組、AppState、renderLayerGrid、fetchTodayWorkOrder、renderWorkOrderPreview）

---

## Locked decisions（下游 agent 不得再問）

### D1. 多層送出確認 modal — 勾 2 層以上才彈
- 情境：均質/蛋白霜一批可能做 1~3 層不等。
- 行為：
  - `AppState.selectedLayers.length === 1` → 直接送出（現行行為保留）
  - `AppState.selectedLayers.length >= 2` → **先彈確認視窗**，列出「將寫入 N 筆：1-1、1-2、1-3」+ 「確認 / 取消」兩鈕
  - 使用者按確認才進入既有 `submitStation` 寫入迴圈
- 視窗樣式：沿用既有 modal 元件（`#resultModal` 或新增一個 `#confirmModal`），手機觸控尺寸 ≥ 44px
- 取消後停留原頁面，勾選狀態不清除（讓使用者微調）

### D2. Sheet 拉取錯誤 — `showNotify` 橫幅三種對應訊息
- 錯誤情境 → 訊息（繁中）：
  - **URL 格式錯**（`sheetUrlToCsv` 回傳 null）→ `showNotify('工單 URL 格式錯誤，請確認是 Google Sheet 連結', 'error')`
  - **fetch 失敗 / HTTP 非 2xx**（通常 Sheet 未公開）→ `showNotify('無法讀取 Sheet，請確認已設為「知道連結的任何人可檢視」', 'error')`
  - **CSV 解析失敗**（`parseWorkOrderCsv` throw 或空陣列）→ `showNotify('Sheet 欄位格式錯誤，請確認第一列為標題、從第二列開始填', 'error')`
- 橫幅顯示 3~5 秒後自動消失；不阻擋使用者操作
- fallback 行為不變：拉取失敗時維持既有本地快取

### D3. 重新拉工單 — 彈確認窗顯示新/舊工單差異
- 情境：本地已有當日工單，使用者按管理頁「🔄 重新拉工單」。
- 行為：
  1. fetch 新工單 CSV 並解析
  2. 比對本地快取 vs 新工單 → 列出差異：
     - ➕ 新增層：`1-3 重乳｜玫荔`
     - ➖ 刪除層：`2-1 重乳｜天使`
     - ♻ 變更層：`1-1 重乳｜天使 → 重乳｜原味`
  3. 彈 confirm modal 顯示差異清單 + 「覆蓋 / 取消」兩鈕
  4. 使用者按覆蓋才 `Storage.setWorkOrder(newWo)` 並推送 `saveWorkOrder`
- 邊界：
  - 兩者完全相同 → 不彈窗，直接 `showNotify('工單無變更', 'ok')`
  - 本地無工單（首次拉）→ 不彈差異窗，直接寫入
- **記錄不動**：既有 `bakery_records` 不受影響（upsert key `date+batch+station` 獨立於工單）

### D4. PRD 文案校正 — Phase 2 順手改完
- 修 `PRD_起士公爵生產良率監測系統.md` 三處：
  - §10.2：「離線存 localStorage，上線後**手動**同步」→ 「離線存 localStorage，上線後**自動**同步（記錄進 `bakery_sync_queue` 佇列，由 `flushQueue` 於網路恢復時重送）」
  - §8：補「分析頁資料來源：優先雲端 (`pullFromCloud`)，fallback 本地 localStorage」
  - §12：「單 HTML < 50KB」→ 「初次載入 < 100KB（index.html + styles.css + app.js gzip 後）」
- 非功能性任務，放入 Phase 2 的文件任務中

---

## Specifics（實作細節提示）

- **確認 modal 元件**：評估是否沿用 `#resultModal` 的 show/hide 機制，或新增獨立 `#confirmModal`（可重用於 D1 + D3）。推薦後者——行為不同。
- **差異比對演算法**：以 `batch` 為 key 做 diff（set intersection / difference / symmetric difference）；變更的判定為 `product`/`flavor` 任一不同。
- **Sheet fetch 錯誤分類**：
  - null from `sheetUrlToCsv` → 歸類 URL 錯
  - `resp.ok === false` → 歸類 Sheet 未公開
  - `parseWorkOrderCsv` throw 或 `layers.length === 0` → 歸類 CSV 格式錯
- **showNotify 已存在**：`app.js` 有 `showNotify(msg, level)`；`level` 可用 `'ok'|'warn'|'error'|'critical'`

---

## Gray areas explicitly deferred

| Item | Reason | Where it goes |
|---|---|---|
| 離線同步佇列（`bakery_sync_queue`） | Phase 3 | Phase 3 |
| Token / XSS | Phase 4 | Phase 4 |
| 多品項（PRODUCT_TYPES） | Phase 5 | Phase 5 |
| 管理頁「清除本地資料」按鈕 | Phase 1 D2 衍生，已在 Backlog | Phase 2 可順便做（非必要） |
| 頂層 `defects` 欄位移除 | Phase 1 D3 過渡 | Phase 5 重構收尾 |

---

## Prior-phase decisions still in effect

- **Phase 1 D3**：頂層 `defects` 雙寫維持，此 Phase 不改動寫入結構。
- **Phase 1 D4**：product 欄位 UI 下拉只有「重乳」，本 Phase 新增的工單 import / 比對邏輯沿用。

---

## Open questions for planner

無重大疑問。Planner 可依以下要點分 plan：

1. **Confirm modal 元件** — 新增可重用 `showConfirm(title, bodyHtml, okLabel, cancelLabel)` API
2. **Submit 流程** — `submitStation` 前置：若 `selectedLayers.length >= 2` 先 `showConfirm` → 同意才繼續
3. **fetchTodayWorkOrder 錯誤分類** — 把現有 catch 細化為三種 error class + 對應 showNotify
4. **「重新拉工單」覆蓋流程** — 在 `renderAdmin` 的按鈕 handler 加入差異比對 + 確認
5. **PRD 文案修正** — 直接編輯 md 檔

---

## Next step

Run `/gsd-plan-phase 2`.
