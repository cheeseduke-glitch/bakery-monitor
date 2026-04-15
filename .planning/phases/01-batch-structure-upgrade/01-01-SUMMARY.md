---
phase: 01-batch-structure-upgrade
plan: 01
subsystem: frontend
tags: [defects-read-unification, product-fallback, workorder-ui, d2, d3, d4]
requires:
  - 01-02 (後端 initSheets 15 欄重建 — 已完成於 commit 0812b13)
provides:
  - "前端所有 defects 讀取路徑走 summary.defects（保留 rec.defects 安全網）"
  - "前端所有 product 讀取帶 '重乳' fallback（D2 安全網）"
  - "管理頁工單預覽 product 下拉（D4 UI 預留多品項槽位）"
  - "批次卡與看板列 product 標籤顯示"
affects: [app.js, index.html]
tech_stack_added: []
patterns: ["雙寫讀取分離（submitStation 頂層 defects + summary.defects 寫；read-side 只讀 summary 並保留安全網）"]
key_files_created: []
key_files_modified:
  - app.js
decisions:
  - "Task 1 與 Task 2 的實作內容已完全包含在前次 WIP commit e3bb1e3；本次 resume 僅需審核並確認無遺漏"
  - "index.html 無需變更：#workOrderPreview 容器已存在、工單預覽 UI 由 app.js 動態注入"
metrics:
  duration: "~5 分鐘（純稽核，無程式碼異動）"
  completed_date: "2026-04-15"
  tasks_completed: "2 / 2（皆已於 e3bb1e3 完成，本次 run 僅驗證）"
  files_modified: 0
---

# Phase 1 Plan 1: 前端批次結構升級收尾 Summary

統一前端 defects 讀取路徑、補 product '重乳' fallback、管理頁工單預覽加入 product 下拉 — 經審核所有程式碼變更均已存在於 WIP commit `e3bb1e3`，本次 resume run 為純稽核，無新增 commit。

## 背景

前次 executor 被中斷，partial edits 與預先存在的 v2.1 重構一起塞入 commit `e3bb1e3`（「WIP: Phase 1 前端批次結構升級（進行中）」）。本次 resume 任務是稽核 01-01 PLAN 的 Task 1 與 Task 2 是否都已落地，並補齊缺的部分。

**結論：兩項任務都已完整實作在 e3bb1e3 中，無需再動程式碼。**

## 稽核結果

### Task 1：defects / product 讀取路徑（D2 + D3）

**grep `\b(rec|r)\.defects\b` on app.js：**
- `app.js:285-286` renderStation 預填：`const recDefects = (rec.summary && rec.summary.defects) || rec.defects || [];` — 含 summary fallback 安全網 ✅
- （其餘所有 defects 讀取點皆為 `r.summary.defects` / `rec.summary.defects`；無遺漏的直接讀取）

**grep `\b[rL]\.product\b` on app.js：**
- `app.js:109` getWorkOrder：`product: r.product || '重乳'` ✅
- `app.js:249` renderLayerGrid 批次卡：`${L.product || '重乳'}｜${L.flavor}` ✅
- `app.js:471` 看板列：`${L.product || '重乳'}｜${L.flavor}` ✅
- `app.js:391` submit 寫入：`product: L?.product || '重乳'` ✅

**submitStation 雙寫保留：**
- `app.js:393-395`:
  ```js
  // D3：頂層 defects 雙寫，過渡期保留，讀取端已改走 summary.defects；移除排 Phase 5 重構
  data, defects, notes,
  summary: { passCount:pass, failCount:fail, criticalCount:crit, defects }
  ```
  D3 註解已就定位 ✅

**已用 summary.defects 的讀取點：** app.js 行 449、477、547、568、583、600、622、646、664、674、681、684、892（看板異常統計、分析頁站別/人員/口味/趨勢、異常清單、CSV 匯出）全部一致 ✅

### Task 2：管理頁工單預覽 product 下拉（D4）

**app.js:849-864 `renderWorkOrderPreview(layers)`：**
- 每列 product 欄輸出 `<select data-idx="${i}"><option value="重乳" selected>重乳</option></select>` ✅
- 表格標題加註「（v2.1 預留多品項，目前僅「重乳」）」 ✅
- `querySelectorAll('select[data-idx]').forEach` 綁定 change 事件，寫回 `Storage.setWorkOrder(wo)` ✅
- 使用 `addEventListener` 而非內聯 onchange ✅

**批次卡 product 顯示：** app.js:249（renderLayerGrid）已含 `${L.product || '重乳'}` ✅
**看板列 product 顯示：** app.js:471（dashboard table row）已含 `${L.product || '重乳'}` ✅

**index.html：** `#workOrderPreview` 容器已於 index.html:144 存在，無需動 HTML 結構 ✅

## 本次 run 相對 e3bb1e3 的 delta

**新增程式碼變更：** 無
**新增 commit：** 無（SUMMARY.md 之外）
**Deviation：** 無

## 與 e3bb1e3 的歸屬拆解

| 變更內容 | 歸屬 commit | 備註 |
|---|---|---|
| 所有 defects 讀取路徑統一走 summary.defects | e3bb1e3 | 前次 executor 已完成 |
| D3 雙寫註解（app.js:393） | e3bb1e3 | 前次 executor 已完成 |
| product fallback `|| '重乳'` 全面套用 | e3bb1e3 | 前次 executor 已完成 |
| renderWorkOrderPreview 下拉 UI + change 綁定 | e3bb1e3 | 前次 executor 已完成 |
| （附帶）v2.1 批次結構、Storage 模組、事件委託重構 | e3bb1e3 | 非本 plan 範圍，但同一 commit 內 |

## Deviations from Plan

None — 稽核顯示 e3bb1e3 已完整涵蓋 PLAN 指定的所有 action 項目。

## Verification

- [x] `grep -nE "\b(rec|r)\.defects\b" app.js` → 僅 line 285-286（summary fallback 表達式），無直接讀取
- [x] `grep -nE "\b[rL]\.product\b" app.js` → 全部配有 `'重乳'` fallback 或為寫入路徑
- [x] `grep -n "summary:\s*\{" app.js` → 僅 line 395（submitStation 寫入），雙寫保留
- [x] `renderWorkOrderPreview` 含 `<select data-idx>` 與 change 事件綁定
- [x] `index.html` `#workOrderPreview` 容器存在（line 144）

## Known Stubs

無。`'重乳'` 為 D4 v2.1 定案的唯一選項，非 stub；多品項擴充屬 Phase 5 範圍。

## Pending Checkpoint

Plan 末端的 `checkpoint:human-verify` **仍未由使用者手動驗證**（因本次 resume 未啟動 dev server）。建議於下次使用者開啟 `index.html` 時依 PLAN 的 `how-to-verify` 步驟在真實裝置上走一次流程：
1. 管理頁工單預覽出現 product 下拉（預設「重乳」），切換後 `JSON.parse(localStorage.bakery_workorder).layers[0].product` 為 "重乳"
2. 工站批次卡顯示「重乳｜<口味>」
3. 看板列右側顯示「重乳｜<口味>」
4. 若有舊 localStorage record（無 product 或只有頂層 defects），分析頁與看板仍能正常渲染

## Self-Check: PASSED

- app.js 存在且稽核通過（line 285-286、393-395、849-864 等均就位）
- index.html 存在且 #workOrderPreview 容器就位
- 目標 commit e3bb1e3 存在於 git history
- 無遺漏的直接 `r.defects` / `rec.defects` 讀取
- 無未保護的 `r.product` / `L.product` 顯示
