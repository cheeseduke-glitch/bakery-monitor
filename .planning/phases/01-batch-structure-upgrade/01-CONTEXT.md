# Phase 1: 批次結構 & 資料模型升級 — Context

**Phase goal:** 把現有「扁平 batch」模型升到 `{batchNum, layer, product}` 結構，為多層複選與多品項鋪路。
**Requirements covered:** R1.1, R1.2, R3.2
**Discussion date:** 2026-04-15
**Status of code:** 已部分實作 — `app.js` 與 `google-apps-script.js` 中 `batchNum`/`layer`/`product` 欄位、`batchId()`/`parseBatchId()`/`roundOf()` 輔助函式、15 欄 Sheet 寫入都已存在。本 Phase 實際工作為：補齊遷移／初始化邏輯、整併 defects 重複欄位、補 UI 綁定。

---

## Canonical refs（下游 agent 必讀）

- `SDD.md` §3（資料模型）、§6.5（Sheet 拉取協議）、§10（PRD 差異）
- `PRD_起士公爵生產良率監測系統.md` v2.1
- `.planning/REQUIREMENTS.md` R1.1 / R1.2 / R3.2
- 既有程式：`app.js`（~913 行；CONFIG/STATE/STATION PAGE/SUBMIT 區塊）
- 既有程式：`google-apps-script.js`（`initSheets()`, `syncRecords()`, `saveWorkOrder()`, `getRecords()`）

---

## Decisions（已鎖定，下游 agent 不得再問）

### D1. Google Sheet 記錄分頁 — 清空重建
- 使用者確認：目前雲端 Sheet 為測試資料，可直接**清空並以新 schema 重建**。
- 實作意涵：`initSheets()` 如偵測到舊 header（13 欄）→ 清除該分頁重建 15 欄 header；或改由使用者手動刪掉舊分頁後由程式自動建。
- 不需要設計「欄位增量補齊」或「資料搬移」邏輯。

### D2. localStorage 舊記錄 — 忽略
- 使用者確認：手機瀏覽器內既有 `bakery_records` 為測試資料，**不需遷移、不需向後相容**。
- 實作意涵：程式可假設所有進入系統的記錄皆為新 schema。Runtime fallback（`r.product || '重乳'`）可保留作為安全網但不是主要路徑。
- 發版前建議提示操作員清除瀏覽器資料（或在管理頁加「清除本地資料」按鈕）以避免舊資料污染看板。

### D3. 頂層 `defects` 欄位 — 雙寫過渡期後移除（C）
- 方案：此 Phase 內維持現狀（`defects` 與 `summary.defects` 雙寫），直到新 schema 穩定後（Phase 2 或之後）再移除頂層 `defects`。
- 實作意涵：此 Phase **不**刪除頂層 `defects` 寫入；但要求**讀取端一律從 `summary.defects` 讀**，確保未來移除頂層時畫面不受影響。
- 追蹤：在 ROADMAP Backlog 加「移除頂層 defects」一項，排入 v2.1 收尾或 Phase 5 重構時處理。

### D4. `product` 欄位在 v2.1 的 UI 表現（C）
- UI 顯示品項下拉選單，但**選項只有「重乳」一個**，為 V3 多品項預留位置。
- 位置：工單匯入介面（管理頁）應顯示 product 欄；工站頁批次卡上顯示品項標籤（`app.js` 既有 `L.product` 渲染已可呈現）。
- 資料層：Record/WorkOrder 欄位值統一為字串「重乳」；不允許空字串（預設值寫入時補）。

---

## Specifics（從 SDD 提煉，供規劃參考）

- **唯一鍵**：`date + batch + station`，其中 `batch = "{batchNum}-{layer}"`。
- **`round` 不存**：由 `Math.ceil(batchNum/3)` 即時衍生。
- **WorkOrder 結構**：`layers[]` 每項 `{ batch, batchNum, layer, product, flavor, notes }`。
- **Sheet「記錄」欄位順序（15 欄）**：
  `date | timestamp | operator | station | batch | batchNum | layer | product | flavor | pass | fail | critical | defects | notes | raw`
- **Sheet「工單」欄位順序（6 欄）**：
  `date | batch | batchNum | layer | product | flavor`
- **Upsert 仍以 `date|batch|station` 當 key**（batch 已含 layer，無需加 layer 到 key）。

---

## Gray areas explicitly deferred

| Item | Reason | Where it goes |
|---|---|---|
| 多層複選 UI | 屬於 Phase 2 範圍 | Phase 2 |
| Sheet URL 綁定/CSV 拉取 | 屬於 Phase 2 範圍 | Phase 2 |
| 離線同步佇列 | 屬於 Phase 3 | Phase 3 |
| Token 驗證 | Phase 4 | Phase 4 |
| 多品項（PRODUCT_TYPES） | Phase 5 | Phase 5 |
| 頂層 `defects` 欄位移除 | 此 Phase 保留雙寫過渡 | Backlog 或 Phase 5 重構 |

---

## Deferred ideas（討論過程出現的非此 Phase 項目）

- 管理頁「清除本地資料」按鈕 — D2 衍生，避免舊測試資料污染。建議排入 Phase 2 管理頁工作。

---

## Open questions for research/planner

無。SDD 已說明充分，且既有程式已給出明確實作方向。Planner 可直接依以下要點分 plan：

1. **程式碼稽核**：確認 `app.js` 所有讀取 `defects` 的路徑是否已改為 `summary.defects`；列出還需修改的點。
2. **`initSheets()` 重建邏輯**：新增偵測舊 header → 清分頁 → 寫新 header。
3. **Apps Script 部署**：同步更新後端並跑端到端驗證（前端送出 → Sheets 讀回 → 分析頁顯示）。
4. **UI 綁定**：工單匯入（管理頁）的 product 下拉；批次卡 product 顯示樣式。

---

## Next step

Run `/gsd-plan-phase 1` to break Phase 1 into executable plans.
