---
phase: 02-multi-layer-ux-sheet-fetch
plan: 01
subsystem: ui-submit-flow
tags: [modal, confirm, multi-layer, ux]
requires: []
provides:
  - showConfirm API（Promise<boolean>）
  - '#confirmModal DOM'
  - submitStation 前置 multi-layer guard
affects:
  - 均質/蛋白霜站勾 2 層以上送出流程
tech-stack:
  added: []
  patterns: [confirm-modal-promise, data-action-dispatcher]
key-files:
  created: []
  modified:
    - index.html
    - styles.css
    - app.js
decisions:
  - 沿用既有 .modal-overlay 骨架新增獨立 #confirmModal（不改 #resultModal）
  - showConfirm 以 Promise<boolean> 封裝 OK/Cancel，支援重覆呼叫自動 resolve 前一個為 false
metrics:
  duration: ~15m
  completed: 2026-04-15
  tasks: 2
  files: 3
requirements: [R1.3]
---

# Phase 02 Plan 01: 多層送出確認 modal Summary

One-liner: 新增可重用 `showConfirm` Promise API 與 `#confirmModal`，`submitStation` 勾 2+ 層時先彈確認窗列出將寫入的層。

## Scope Delivered

- `index.html`: 在 `#resultModal` 之後、`#notifyBanner` 之前插入 `#confirmModal`（title / content / 取消 / 確認）。
- `styles.css`: 新增 `.confirm-actions` flex 樣式（gap 12px、margin-top 16px、兩鈕 flex:1 + min-height 44px 手機觸控）。
- `app.js`:
  - 新增 `showConfirm(title, bodyHtml, okLabel='確認', cancelLabel='取消') → Promise<boolean>`。
  - 支援單例：再次呼叫時前一個 promise 自動 resolve(false)。
  - `submitStation` 改為 `async`，在 operator 檢查後、資料收集前，若 `AppState.selectedLayers.length >= 2` 則 `await showConfirm(...)`，false 直接 return。
  - 單層送出路徑完全不觸發 confirm，行為不變。

## Commits

| Task | Description | Hash |
| ---- | ----------- | ---- |
| 1 | 新增 #confirmModal DOM + .confirm-actions 樣式 | a93ed64 |
| 2 | 實作 showConfirm API + submitStation 前置 guard | 1c3656a |

## Verification

**Automated (passed):**
- `grep` 確認 `async function submitStation` 與 `function showConfirm` 皆存在於 app.js
- node 檢查 `selectedLayers.length >= 2` 與 `await showConfirm` 皆出現
- `#confirmModal` 於 index.html、`.confirm-actions` 於 styles.css

**Human-verify checkpoint (flagged, not blocked per protocol):**
Task 3 為 `checkpoint:human-verify`。程式已提交，待使用者於瀏覽器執行下列步驟確認：

1. 均質站 → 選操作人員 → 勾 1-1、1-2、1-3 → 填必填 → 送出 → 跳確認窗「將寫入 3 筆記錄：1-1、1-2、1-3」。
2. 按取消 → 視窗關、勾選保留、localStorage `bakery_records` 無新增。
3. 再送出 → 按確認 → localStorage 新增 3 筆（batch 分別 1-1 / 1-2 / 1-3）。
4. 均質站只勾 1-2 → 送出 → 直接進結果 modal、不跳 confirm。
5. 整面站（單選）勾 1-1 → 送出 → 不跳 confirm。

## Deviations from Plan

None — plan executed as written。`submitStation` 的 data-action dispatcher 呼叫點不處理回傳值，async 化不影響邏輯（plan 已註明可忽略）。

## Threat Flags

無新增安全面。`showConfirm` 的 `bodyHtml` 以 `innerHTML` 注入（plan 已明示呼叫端負責內容，Phase 4 統一 XSS 處理），本 plan 內唯一呼叫端傳入的 `list` 為 `AppState.selectedLayers.join('、')`，元素為 `batchId` 固定格式（如 `"1-1"`），無使用者輸入流入。

## Self-Check

- [x] index.html 含 `#confirmModal`
- [x] styles.css 含 `.confirm-actions`
- [x] app.js 含 `async function submitStation` 與 `function showConfirm`
- [x] 兩個提交皆存在於 git log（a93ed64, 1c3656a）

## Self-Check: PASSED
