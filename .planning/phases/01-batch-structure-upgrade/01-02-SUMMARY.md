---
phase: 01-batch-structure-upgrade
plan: 02
subsystem: backend/apps-script
tags: [apps-script, sheets, schema, v2.1, D1]
requires:
  - google-apps-script.js (既有 v2.1 部分實作)
provides:
  - initSheets() 舊 header 清空重建（D1 落地）
  - doPost saveWorkOrder dispatch 參數兼容（layers / batches）
  - saveWorkOrder 內部容忍空 list
affects:
  - Google Sheet「記錄」「工單」分頁 schema（部署後生效）
tech-stack:
  patterns:
    - "expectedHeader 陣列比對 → sheet.clear() + appendRow 重建"
    - "doPost 參數 fallback: data.layers || data.batches"
key-files:
  modified:
    - google-apps-script.js
decisions:
  - D1（CONTEXT）在後端實作：偵測舊 header 即清空重建，不做欄位增量搬移
  - saveWorkOrder 在後端兼容 layers/batches 兩種 key，避免前後端部署時差造成錯位
metrics:
  duration_minutes: 5
  completed: 2026-04-15
  tasks_completed: 1
  tasks_pending_checkpoint: 2
---

# Phase 1 Plan 2: Apps Script initSheets 清空重建 & doPost 修復 Summary

把後端 Apps Script 的 `initSheets()` 升級為「偵測舊 header → 清空重建」符合 D1，並修復 `doPost` 把 `saveWorkOrder` 參數從 `data.batches` 對不上函式簽名 `(date, layers)` 的 bug。

## What was built

### Task 1 — initSheets() 清空重建 + doPost 修復（commit `0812b13`）

修改範圍：僅 `google-apps-script.js`。

1. **initSheets() 記錄表**：新增 `expectedRecHeader` 常數（15 欄）。若分頁已存在，取 header 比對；`lastCol < 15` 或 header 不符即 `sheet.clear()` + `appendRow(expectedRecHeader)` + 套用格式 + `setFrozenRows(1)`。對已為 v2.1 正確 schema 的 sheet 為 no-op（idempotent）。
2. **initSheets() 工單表**：同樣手法搭配 `expectedWoHeader`（6 欄）。
3. **doPost dispatch 修復**：`saveWorkOrder(data.date, data.batches)` → `saveWorkOrder(data.date, data.layers || data.batches)`。
4. **saveWorkOrder 內部容錯**：改以 `const list = layers || []`，移除 `!layers` 硬性擋（允許空工單，但仍擋空 date）。
5. **註解**：檔頭加 D1 說明「測試資料可丟、舊 13 欄/5 欄分頁會被清空重建」。

### Task 2 — GAS 部署（checkpoint:human-action）⏸ PENDING MANUAL

Claude 無法透過 CLI 推送 Apps Script（clasp 排在 Phase 5）。需人工：

1. 開啟測試用 Google Sheet → 擴充功能 → Apps Script。
2. 把 `google-apps-script.js` 完整內容貼上覆蓋原本程式碼。
3. Ctrl+S 儲存 → 部署 → 管理部署作業 → 編輯現有部署 → 版本「新版本」→ 部署。
4. 在編輯器手動執行 `initSheets` → 檢查執行記錄無錯、Sheet 分頁為 15 欄 / 6 欄。
5. 再執行一次 `initSheets` 驗證 idempotent（不會重複清空）。

### Task 3 — 端到端 round-trip（checkpoint:human-verify）⏸ PENDING

Requires BOTH plans (01-01 前端 + 01-02 後端) 已部署後才能驗證。步驟見 `01-02-PLAN.md` <how-to-verify>，重點：

- 均質站 + 品判站提交同一批次 → 檢查 Sheet「記錄」欄位正確
- `getRecords` 回傳 JSON 含 `batchNum, layer, product, summary.defects`
- 跨瀏覽器開分析頁 → 雲端資料可還原

## Verification

靜態檢查（Task 1 done criteria）：

```
grep -nE "expectedRecHeader|expectedWoHeader|sheet\.clear\(\)" google-apps-script.js
→ line 23, 27, 36, 39, 40 (記錄)、47, 51, 60, 64 (工單) ✅

grep -nE "data\.layers \|\| data\.batches" google-apps-script.js
→ line 96 ✅
```

- `initSheets()` 含 `expectedRecHeader` / `expectedWoHeader` 比對與 `sheet.clear()` 重建 ✅
- `doPost` dispatch 同時容忍 `layers / batches` ✅
- 程式碼開頭含 D1 註解 ✅
- idempotent（header 相符時不進入 rebuild 分支）✅

## Deviations from Plan

None — 計畫照寫實作。唯一微差異：

- 計畫範例使用 `sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]` 直接取 header；實作使用 `Math.max(lastCol, 15)` 確保即使欄數異常也能安全切片 `slice(0, 15)`。功能等價，較防禦性。
- `saveWorkOrder` 原本 `if (!date || !layers)` 會擋空工單；放寬為只擋 `!date`，允許清空當日工單。這屬於 doPost 兼容修復的合理延伸（前端若送 `batches: []` 也不應 500）。

## Pending manual actions

| Task | Type | Blocker | Resume signal |
|------|------|---------|---------------|
| 2 | human-action | 需手動貼到 GAS editor + 部署 | 部署完成、`initSheets` 手動執行成功 |
| 3 | human-verify | 需 01-01 + 01-02 都部署完才能 round-trip | 觀察到 Sheet 欄位正確 + getRecords JSON 包含 batchNum/layer/product/defects |

## Follow-ups

- 前端 `admin.js` 若日後呼叫 `saveWorkOrder`，建議 payload 使用 `layers` key（與函式簽名對齊）；目前後端已容錯，不急。
- Phase 2 / R3.1 自動 `saveWorkOrder` 推送時再一併 audit 前端送出 key。
- Phase 5 clasp 整合後，部署步驟可自動化，取代目前 Task 2 的人工 checkpoint。

## Commits

- `0812b13` feat(01-02): initSheets 偵測舊 header 清空重建並修復 doPost dispatch

## Self-Check: PASSED

- File exists: `google-apps-script.js` ✅
- Commit exists: `0812b13` ✅
- Static checks: expectedRecHeader / expectedWoHeader / sheet.clear() / data.layers || data.batches 全命中 ✅
