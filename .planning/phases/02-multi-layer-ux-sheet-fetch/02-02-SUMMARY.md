---
phase: 02-multi-layer-ux-sheet-fetch
plan: 02
subsystem: workorder-fetch-ux
tags: [error-handling, diff, confirm-modal, sheet-fetch, workorder]
requires:
  - showConfirm API（02-01 提供）
  - cloudFetch saveWorkOrder 協議（既有 e3bb1e3）
provides:
  - fetchWorkOrderRaw（純拉取，不寫 Storage）
  - notifyWorkOrderError（BAD_URL / NOT_PUBLIC / BAD_CSV 三類繁中對應）
  - diffWorkOrder / formatDiffHtml（工單差異比對與 HTML 組裝）
  - pushWorkOrderToCloud helper（包裝 cloudFetch saveWorkOrder）
  - refreshWorkOrder 三分支（首次 / 無變更 / 有變更 confirm 覆蓋）
affects:
  - 管理頁「🔄 重新拉工單」流程
  - 「儲存並拉取」錯誤橫幅顯示
tech-stack:
  added: []
  patterns: [error-code-classification, diff-then-confirm, raw-fetch-helper]
key-files:
  created: []
  modified:
    - app.js
decisions:
  - fetchWorkOrderRaw 抽離純拉取邏輯，fetchTodayWorkOrder 改為其之上的快取寫入層
  - 錯誤三分類以 err.code（BAD_URL/NOT_PUBLIC/BAD_CSV）標記，呼叫端統一交給 notifyWorkOrderError
  - 網路 exception（fetch TypeError）歸類 NOT_PUBLIC（user 難以區分，訊息覆蓋足夠）
  - refreshWorkOrder 不再直接呼叫 fetchTodayWorkOrder（否則會先寫入再 diff）；改用 fetchWorkOrderRaw 先拿 raw，再由 diff 流程決定是否 setWorkOrder
  - 新增 pushWorkOrderToCloud 小包裝，重用既有 cloudFetch({action:'saveWorkOrder'})，避免與 syncToCloud 重工
metrics:
  duration: ~15m
  completed: 2026-04-15
  tasks: 2
  files: 1
requirements: [R2.1, R2.2, R2.3, R2.4, R2.5, R3.1]
---

# Phase 02 Plan 02: Sheet 拉取錯誤三分類 + 重新拉工單 diff 流程 Summary

One-liner: fetchWorkOrderRaw 拋出 `code`-標記錯誤（BAD_URL/NOT_PUBLIC/BAD_CSV），refreshWorkOrder 改走「先 raw → diff → showConfirm → 覆蓋 + 推雲」三分支流程。

## Scope Delivered

- **Task 1 — 錯誤分類（D2）**
  - `fetchWorkOrderRaw()`：新 helper，URL/fetch/parse 每個失敗點 throw 標記 `err.code` 的 Error。
  - `fetchTodayWorkOrder()`：改為 1hr 快取判斷 → 否則呼叫 `fetchWorkOrderRaw()` → `Storage.setWorkOrder(raw.wo)`。錯誤自動向上冒泡（含 code）。
  - `notifyWorkOrderError(err)`：依 `err.code` 對應繁中訊息，fallback 顯示 `err.message`。
  - `saveSheetUrl()`：早期 URL 格式檢查訊息升級為 BAD_URL 正式文案；catch 內新增 `notifyWorkOrderError(err)`，sheetStatus 紅字保留。
  - `refreshWorkOrder()` catch 內同步使用 `notifyWorkOrderError(err)`。

- **Task 2 — 重新拉工單 diff 流程（D3）**
  - `diffWorkOrder(oldLayers, newLayers)`：以 `batch` key 做 added / removed / changed 比對，空 diff 以 `empty:true` 標記。
  - `formatDiffHtml(diff)`：組 ➕/➖/♻ 彩色 HTML，max-height 300px 捲動。
  - `pushWorkOrderToCloud(wo)`：包裝 `cloudFetch('POST', url, { action:'saveWorkOrder', date, batches })`，失敗只 console.warn 不阻斷 UX。
  - `refreshWorkOrder()` 重寫：
    1. `fetchWorkOrderRaw()` → 失敗 `notifyWorkOrderError` return。
    2. 本地無當日快取 → 直接 `Storage.setWorkOrder` + `pushWorkOrderToCloud` + 綠字成功訊息。
    3. diff 為空 → `showNotify('工單無變更','ok')`，不覆蓋、不推送。
    4. diff 非空 → `await showConfirm('重新拉工單', formatDiffHtml(diff), '覆蓋', '取消')`；使用者取消則 return。
    5. 使用者覆蓋 → `Storage.setWorkOrder(newWo)` + `renderWorkOrderPreview` + 綠字成功訊息 + `pushWorkOrderToCloud`。

## Commits

| Task | Description | Hash |
| ---- | ----------- | ---- |
| 1+2  | 工單拉取錯誤分三類 + refreshWorkOrder diff 確認流程（單次合併提交） | 95d6b30 |

## Verification

**Automated (passed):**
- `grep` 確認 `BAD_URL` / `NOT_PUBLIC` / `BAD_CSV` 三 code 皆出現於 app.js（分佈於 `fetchWorkOrderRaw` 拋擲點與 `notifyWorkOrderError` map）
- 繁中三訊息「工單 URL 格式錯誤」/「無法讀取 Sheet」/「Sheet 欄位格式錯誤」皆存在
- `diffWorkOrder` / `formatDiffHtml` / `pushWorkOrderToCloud` / `notifyWorkOrderError` 四新 helper 存在
- `showConfirm('重新拉工單' ... '覆蓋'` 流程接通
- 「工單無變更」訊息存在

**Human-verify checkpoint (flagged, code committed per protocol):**
Task 3 為 `checkpoint:human-verify`。程式已提交於 `95d6b30`，待使用者於瀏覽器執行以下步驟確認：

1. Sheet URL 貼 `https://example.com` 拉取 → 橫幅顯示「工單 URL 格式錯誤，請確認是 Google Sheet 連結」。
2. 綁一份未公開 Sheet → 拉取 → 橫幅顯示「無法讀取 Sheet，請確認已設為『知道連結的任何人可檢視』」。
3. 綁公開但欄位錯／空 Sheet → 拉取 → 橫幅顯示「Sheet 欄位格式錯誤，請確認第一列為標題、從第二列開始填」。
4. DevTools Network Offline → 按「🔄 重新拉工單」→ 橫幅顯示 NOT_PUBLIC 訊息；既有 `bakery_workorder` 本地快取不變。
5. 首次綁 Sheet 成功拉取 → 不彈 diff modal；`bakery_workorder` 寫入；Sheets 工單分頁出現資料。
6. 不改 Sheet，再按「🔄 重新拉工單」→ showNotify「工單無變更」；不彈 modal。
7. 改 Sheet 一列 flavor 或新增一列 → 重新拉 → 跳 showConfirm，顯示 ♻/➕ 差異列。
8. 按「取消」→ 本地 `bakery_workorder` 不變；Sheets 工單分頁不變。
9. 再按一次重新拉 → 按「覆蓋」→ 本地更新；Sheets 工單分頁出現新版（saveWorkOrder 推送成功）。

## Deviations from Plan

**1. [合併提交] Task 1 與 Task 2 合併為單次 commit `95d6b30`**
- **Found during:** 執行階段
- **Issue:** 因工作區 git commit 權限受限（只能透過 gsd-tools commit 輔助），Task 1 與 Task 2 兩組變更在單次 Edit 後一起進入工作樹，未做分次 staging。
- **Fix:** 以單次 commit 涵蓋兩 task；訊息內明列兩 task 內容；本 SUMMARY 的 Commits 表格亦標示 `1+2`。
- **Impact:** 低 — 檔案只有 app.js，diff 可在該 commit 內自行切分閱讀；不影響功能。

## Threat Flags

無新增安全面。`formatDiffHtml` 的 `innerHTML` 注入來源為 `parseWorkOrderCsv` 產出的 layer 欄位（batch/product/flavor/notes），屬使用者透過 Google Sheet 可控內容——與 02-01 相同，已知此 phase 的 XSS 統一處理延至 Phase 4。此處未新增額外管道。

## Self-Check

- [x] app.js 含 `BAD_URL` / `NOT_PUBLIC` / `BAD_CSV`
- [x] app.js 含三繁中錯誤訊息字串
- [x] app.js 含 `diffWorkOrder` / `formatDiffHtml` / `notifyWorkOrderError` / `pushWorkOrderToCloud`
- [x] app.js 含 `showConfirm('重新拉工單'` 與「工單無變更」
- [x] 提交 `95d6b30` 存在於 git log

## Self-Check: PASSED
