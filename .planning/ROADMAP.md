# Roadmap — 起士公爵 生產良率監測系統

**Granularity:** coarse（3-5 phases）
**Execution:** parallel（各 phase 內的 plans）
**Milestone goal:** v2.1 上線 + V3 基建（佇列 / 安全 / 多品項）
**Last updated:** 2026-04-15

---

## Phase 1 — v2.1 批次結構 & 資料模型升級

**Goal:** 把現有「扁平 batch」模型升到 `{batchNum, layer, product}` 結構，為多層複選與多品項鋪路。

**Covers requirements:** R1.1, R1.2, R3.2

**Key tasks:**
- Record schema 擴充：`batchNum`、`layer`、`product`
- `batch` 由 `{batchNum}-{layer}` 組成；唯一鍵保持
- WorkOrder `layers[]` 改為多層陣列
- 移除頂層 `defects`，統一 `summary.defects`（讀寫雙向 fallback）
- 舊資料遷移：缺 `product` → `"重乳酪"`
- Apps Script Sheet 欄位同步擴充

**Success criteria:**
- 既有 localStorage 資料能讀、能渲染、能上雲
- 新提交的 Record 完整帶齊新欄位
- Sheet 記錄表多出對應欄位，上下雲可互通

**Verification:** 單元級手測 + 雲端 round-trip 測試

---

## Phase 2 — v2.1 多層複選 UX + Google Sheet 工單拉取

**Goal:** 讓操作員一次寫多層、班長換 Sheet gid 就換工單。

**Covers requirements:** R1.3, R2.1–R2.5, R3.1, R3.3

**Plans（可並行）:**
- Plan 2a — 多層複選 UI（均質/蛋白霜 checkbox 樣式、確認 modal、`selectedLayers`）
- Plan 2b — Sheet 工單拉取（URL 解析、CSV parse、快取 1hr、管理頁 UI、自動/手動觸發、錯誤處理）
- Plan 2c — 管理頁工單匯入自動 `saveWorkOrder` + PRD 文案校正

**Success criteria:**
- 均質站一次勾 3 層 → localStorage 出現 3 筆 Record
- 換 gid 重整 → 當日批次改變；斷網用快取
- 工單存本地同時推到 Sheets 工單表

**Verification:** 手機實機走查 + 斷網測試

---

## Phase 3 — V3 離線同步佇列 + 可靠性

**Goal:** 把「失敗就吞」的 fire-and-forget 同步換成可重試佇列，斷網也不丟資料。

**Covers requirements:** R4.1–R4.4

**Key tasks:**
- `bakery_sync_queue` 結構 + enqueue API
- `flushQueue`：指數退避、上限、`online` 事件綁定
- sync-bar 擴充：`offline` / `error N 筆` / 立即重試按鈕
- 替換 `syncToCloud` 呼叫點
- 管理頁「待同步 N 筆」顯示

**Success criteria:**
- 斷網連交 5 筆 → 全進佇列；恢復網路後自動清空
- 後端 Sheets 無重複列
- 連 5 次失敗 → 暫停 + UI 顯示 error

**Verification:** DevTools 離線模式 + 併發壓力測

---

## Phase 4 — V3 安全加固（Token + XSS）

**Goal:** 讓 Apps Script Web App 不再「誰知道網址誰能寫」，修掉現有 XSS 面。

**Covers requirements:** R5.1, R5.2

**Plans（可並行）:**
- Plan 4a — Token 驗證（Script Properties + `doGet/doPost` 驗證 + 前端 `cloud_token` + 管理頁設定）
- Plan 4b — XSS 修補（審查所有 `innerHTML` 使用者輸入點 → `textContent`/`createElement`/`esc()`）

**Success criteria:**
- 無 token 請求回 401
- `notes`、人員名、defect 名含 `<script>` 不會執行
- 現有功能全回歸過

**Verification:** 手工攻擊測試 + curl 401 驗證

---

## Phase 5 — V3 多品項支援 + 重構基建

**Goal:** 打開多品項擴充性，順勢把 `app.js` 拆成可維護模組，並引入最小測試。

**Covers requirements:** R6.1–R6.3, R8.1–R8.4, R7（LINE 通知）

**Plans（可並行）:**
- Plan 5a — `PRODUCT_TYPES` 常數 + 工站動態渲染 + Record/Sheets `product` 欄
- Plan 5b — `app.js` 拆分：`config/state/cloud/validators/pages/*`
- Plan 5c — 驗證器 Vitest 單元測試（純函式）
- Plan 5d — Apps Script LINE Notify（Properties + 條件觸發）
- Plan 5e — `clasp` 後端版本化

**Success criteria:**
- 新增一個品項（如「布朗尼」）只需改 `PRODUCT_TYPES`，不動 render code
- `app.js` 行數降至 < 300（其他進子模組）
- `npm test` 驗證器全綠
- 異常提交 → LINE 群收到通知

**Verification:** 新增假品項 smoke test + CI 跑測試

---

## Backlog（不排 phase）

- 自動日報（§11.3）
- 品判照片上傳（§11.4）
- QR Code 工單（§11.5）
- 多工廠（§11.6）

---

## Dependency Graph

```
Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5
(schema)    (v2.1 UX)   (queue)     (security)  (V3 core)
```

Phase 1 是所有後續的前置；Phase 2-5 依序但 phase 內 plans 可並行。

## Next Action

Run `/gsd-plan-phase 1` to break Phase 1 into executable tasks.
