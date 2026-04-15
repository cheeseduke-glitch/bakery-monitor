---
phase: 01-batch-structure-upgrade
verified: 2026-04-15T00:00:00Z
status: human_needed
score: 4/4 code-verifiable; 3 of 4 require GAS deployment + human UAT to fully close
re_verification:
  previous_status: none
  previous_score: n/a
gaps: []
human_verification:
  - test: "Apps Script 部署並手動執行 initSheets()"
    expected: "Sheet「記錄」分頁為 15 欄 header；「工單」分頁為 6 欄 header；再次執行為 no-op（idempotent）"
    why_human: "GAS 無 CLI；clasp 排在 Phase 5；必須在 Apps Script 編輯器手動貼碼 → 部署 → 執行"
  - test: "端到端 round-trip：均質站 + 品判站提交 1-1 → 檢查 Sheet → getRecords → 分析頁"
    expected: "Sheet 列含 batchNum=1 / layer=1 / product=「重乳」 / 外觀不良=「泡泡」；getRecords JSON 含 summary.defects:['泡泡']；跨瀏覽器開分析頁能還原"
    why_human: "需啟動真實 Web App URL 並走瀏覽器互動流程；自動化需 headless + GAS 部署，超出本 Phase 工具鏈"
  - test: "舊 localStorage record（無 product 或只有頂層 defects）渲染"
    expected: "看板與分析頁仍能正確顯示該 record；product 顯示「重乳」；異常色點仍亮起"
    why_human: "需手機實機 DevTools 注入舊 schema 測試資料；本機 localStorage 已被重構刷新"
  - test: "管理頁 product 下拉變更寫回 localStorage"
    expected: "切換下拉 → DevTools console: JSON.parse(localStorage.bakery_workorder).layers[0].product === '重乳'"
    why_human: "UI 互動＋localStorage 讀取；無 headless 測試環境"
---

# Phase 1: 批次結構 & 資料模型升級 Verification Report

**Phase Goal:** 把現有「扁平 batch」模型升到 `{batchNum, layer, product}` 結構，為多層複選與多品項鋪路。
**Verified:** 2026-04-15
**Status:** human_needed （程式碼層面全部通過；GAS 部署 + 端到端 round-trip 需人工 UAT）

---

## Goal Achievement — Success Criteria 逐項評分

### SC1. 新提交的 Record 帶齊 batchNum/layer/product 欄位 — **PASS**

`app.js:384-396` `submitStation` 構造 record：

```js
batch: batchId_,
batchNum: L?.batchNum || parseBatchId(batchId_).batchNum,   // line 389
layer:   L?.layer    || parseBatchId(batchId_).layer,       // line 390
product: L?.product  || '重乳',                             // line 391
flavor:  L?.flavor   || '',
data, defects, notes,
summary: { passCount:pass, failCount:fail, criticalCount:crit, defects }  // line 395
```

- 三欄皆必寫；`batchNum`/`layer` 有 `parseBatchId` 雙重保底；`product` 永遠 fallback 到 `'重乳'`。
- `batch = "{batchNum}-{layer}"` 與 SDD §3 唯一鍵定義一致（`app.js:54 batchId()`）。

**Evidence files:** `app.js:53-57`（helpers）、`app.js:384-396`（submit 寫入）

---

### SC2. 既有 localStorage 資料能讀能渲染能上雲（舊 product 預設「重乳」） — **PARTIAL → NEEDS-HUMAN-UAT**

**Code-verifiable NOW（通過）：**
- `app.js:109` `getWorkOrder`：`product: r.product || '重乳'` ✓
- `app.js:249` renderLayerGrid 批次卡：`${L.product || '重乳'}` ✓
- `app.js:471` 看板列：`${L.product || '重乳'}` ✓
- `app.js:285-286` renderStation defects 預填安全網：
  `const recDefects = (rec.summary && rec.summary.defects) || rec.defects || [];` ✓
- 所有分析頁統計（`app.js:547, 568, 583, 600, 622, 646, 664, 674, 681, 684`）統一走 `r.summary.defects` ✓
- CSV 匯出（`app.js:892`）也用 `r.summary.defects` ✓
- 上雲路徑：`syncRecords` rowOf 第 8 欄 `r.product || '重乳'`（`google-apps-script.js:146`）保底 ✓

**NEEDS-HUMAN-UAT：** 實際「舊 schema record（無 product 欄、無 summary.defects）」在看板／分析頁正確渲染，只能在實機 DevTools 手動注入舊資料後重整驗證。CONTEXT D2 明言舊 localStorage 為測試資料可丟，安全網存在但非主要路徑。

**Note on ROADMAP wording discrepancy:** ROADMAP.md line 24 寫 `"重乳酪"`，但 CONTEXT D4 與實際程式碼一致採用 `"重乳"`（兩字）。以 D4 為準，程式碼與 CONTEXT／PLAN frontmatter 對齊。此差異應於 ROADMAP 校正。

---

### SC3. Sheet 記錄表新欄位就緒，上下雲 round-trip 一致 — **PARTIAL → NEEDS-HUMAN-UAT**

**Code-verifiable NOW（通過）：**

- `google-apps-script.js:19-84` `initSheets()`：含 `expectedRecHeader`（15 欄）與 `expectedWoHeader`（6 欄）比對 → `sheet.clear()` 重建邏輯，符合 D1。
- `google-apps-script.js:144-150` `syncRecords.rowOf` 輸出 15 欄，順序與 CONTEXT spec 一致：
  `[date, ts, op, station, batch, batchNum, layer, product, flavor, pass, fail, crit, defects.join('、'), notes, raw]`
- `google-apps-script.js:194-213` `getRecords` 讀回 15 欄，含 `product: data[i][7] || '重乳'`（line 202）、`summary.defects: defects`（line 211）。
- `google-apps-script.js:246-250` `saveWorkOrder` 寫入 6 欄 `[date, batch, batchNum, layer, product, flavor]`，含 `L.product || '重乳'` fallback。
- `google-apps-script.js:256-275` `getWorkOrder` 讀回 6 欄含 product fallback。
- `google-apps-script.js:96` doPost dispatch 兼容 `data.layers || data.batches`。
- Upsert key `date|batch|station`（`google-apps-script.js:136, 153-156`），符合 SDD §3 唯一鍵。
- Idempotent 重建邏輯（比對 header 相符時 no-op）。

**NEEDS-HUMAN-UAT：** initSheets 真正在 GAS 編輯器執行、舊 13 欄分頁清空重建結果、實際 Web App round-trip（submit → Sheet 列 → getRecords JSON 回讀）全欄一致 — 這一整串都需人工部署 Apps Script 後跑一次。Plan 01-02 checkpoints 2 & 3 仍為 PENDING。

---

### SC4. 頂層 defects 已移除，統一用 summary.defects（per D3 雙寫，讀取統一） — **PASS**

注意 D3 明確要求「此 Phase **雙寫**，讀取統一」— 頂層 `defects` **不**移除，只要求讀取端全部走 `summary.defects`。

**Code-verifiable NOW（通過）：**

- **寫入端（雙寫保留）：** `app.js:393-395`：
  ```js
  // D3：頂層 defects 雙寫，過渡期保留，讀取端已改走 summary.defects；移除排 Phase 5 重構
  data, defects, notes,
  summary: { passCount:pass, failCount:fail, criticalCount:crit, defects }
  ```
  D3 註解就定位 ✓。GAS rowOf 第 13 欄來自 `r.summary.defects`（line 148），不讀頂層 ✓。

- **讀取端：** grep `\b(rec|r)\.defects\b`（不含 summary）：
  - `app.js:285-286` renderStation：`(rec.summary && rec.summary.defects) || rec.defects || []` — summary 優先，頂層僅作舊資料安全網 ✓
  - 其餘所有讀取（看板 `449, 477`、分析頁 `547, 568, 583, 600, 622, 646, 664, 674, 681, 684`、CSV `892`）全走 `r.summary.defects` ✓
  - **無任何直接 `r.defects` 讀取不帶 summary fallback。**

- ROADMAP Backlog line 103 已記錄「移除頂層 defects（Phase 1 D3 雙寫過渡，待 Phase 5 重構時收尾）」 ✓

---

## Decisions D1-D4 反映檢查

| Decision | 規範 | 程式碼位置 | 狀態 |
|---|---|---|---|
| **D1** Sheet 舊 header 清空重建 | initSheets 偵測舊 header → clear + 重建 | `google-apps-script.js:4`（檔頭註解）、`19-84`（initSheets 含 expectedRecHeader/expectedWoHeader、sheet.clear()、idempotent 比對） | ✓ 程式碼落地；部署/執行待人工 UAT |
| **D2** 舊 localStorage 忽略（保留 runtime fallback） | `r.product \|\| '重乳'` 安全網、不做資料遷移 | `app.js:109, 249, 391, 471`；`google-apps-script.js:146, 202, 247, 268` | ✓ 安全網散佈；「清除本地資料」按鈕延後至 Phase 2（ROADMAP Backlog line 104） |
| **D3** 頂層 defects 雙寫過渡 | submitStation 雙寫；讀取統一 summary.defects | 寫：`app.js:393-395`（含 D3 註解）；讀：見 SC4 | ✓ 完全落地 |
| **D4** product 下拉「重乳」單選 | 管理頁工單預覽 product `<select>` 僅一個 option | `app.js:849-864` renderWorkOrderPreview：`<select data-idx="${i}"><option value="重乳" ...>重乳</option></select>` + `select[data-idx]` change 委派寫回 Storage.setWorkOrder | ✓ 程式碼落地；UI 互動寫回 localStorage 待人工驗證 |

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `app.js` | defects summary 統一、product fallback、product 下拉 UI、D3 註解 | ✓ VERIFIED | 見 SC1-SC4 行號引用 |
| `google-apps-script.js` | initSheets 清空重建、syncRecords/getRecords 15 欄、saveWorkOrder/getWorkOrder 6 欄、dispatch 兼容 | ✓ VERIFIED (code) / ⏸ NOT DEPLOYED | 檔案存在且正確；GAS 部署待人工 |
| `index.html` | `#workOrderPreview` 容器存在 | ✓ VERIFIED | SUMMARY 01-01 確認 line 144 容器就位 |

## Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `app.js submitStation` | `Record.summary.defects` | summary 物件構造 | ✓ WIRED | `app.js:395` |
| `app.js renderDashboard/Analytics` | `r.summary.defects` | 直接讀 summary | ✓ WIRED | 12+ 處讀取全走 summary |
| `initSheets()` | 記錄 sheet 15 欄 header | Sheet.clear() + appendRow | ✓ WIRED (code) | `google-apps-script.js:38-43` |
| `initSheets()` | 工單 sheet 6 欄 header | Sheet.clear() + appendRow | ✓ WIRED (code) | `google-apps-script.js:62-67` |
| `syncRecords()` | summary.defects → row[12] | rowOf 第 13 欄 | ✓ WIRED | `google-apps-script.js:148` |
| `getRecords()` → frontend | `record.summary.defects` | split('、') + rawData | ✓ WIRED | `google-apps-script.js:190, 211` |
| `doPost saveWorkOrder` dispatch | `data.layers` with `data.batches` fallback | parameter兼容 | ✓ WIRED | `google-apps-script.js:96` |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| 批次卡 `renderLayerGrid` | `L.product` | `getWorkOrder()` → localStorage workorder | ✓ (fallback '重乳') | ✓ FLOWING |
| 看板列 | `L.product`, `rec.summary.defects` | localStorage records + workorder | ✓ | ✓ FLOWING |
| 管理頁下拉 | `layers[i].product` | `fetchTodayWorkOrder` / Storage.setWorkOrder | ✓ | ✓ FLOWING（寫回待人工驗證） |
| Sheet 記錄行 | 15 欄 rowOf output | submitStation records | ⏸ | 需部署後 UAT |

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| R1.1 | 01-01, 01-02 | Record 加 batchNum/layer/product；舊資料 fallback | ✓ SATISFIED (code) | app.js:389-391；GAS rowOf/getRecords |
| R1.2 | 01-01, 01-02 | WorkOrder.layers[] 新結構 | ✓ SATISFIED | app.js:96-115, 769-784；GAS saveWorkOrder |
| R3.2 | 01-01, 01-02 | defects 去重（讀取統一 summary） | ✓ SATISFIED (per D3 雙寫過渡) | app.js:285-286, 393-395 |

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| (無) | — | 無 TODO/FIXME/placeholder stub；無 hardcoded 空陣列污染；`'重乳'` fallback 為 D4 定案非 stub | ℹ️ Info | — |

## Behavioral Spot-Checks

Skipped: 無 CLI 可執行的 runnable entry point（純瀏覽器前端 + GAS 後端；後端需部署才能呼叫）。靜態 grep 已覆蓋所有行號引用。

## Human Verification Required

1. **Apps Script 部署 + initSheets 手動執行**（Plan 01-02 checkpoint 2）
   - 貼碼到 GAS 編輯器 → 部署新版本 → 執行 `initSheets` → 檢查 15 欄 / 6 欄 header 出現、舊資料被清空；再執行一次驗證 idempotent。

2. **端到端 round-trip**（Plan 01-02 checkpoint 3）
   - 均質站 1-1 提交 → 檢查 Sheet「記錄」列 15 欄正確（batchNum=1, layer=1, product=「重乳」）
   - 品判站 1-1 提交含「泡泡」defect → 外觀不良欄位顯示「泡泡」
   - DevTools 檢查 `?action=getRecords` 回傳 JSON 含 `batchNum, layer, product, summary.defects:['泡泡']`
   - 換瀏覽器開分析頁驗證雲端可還原

3. **舊 localStorage 相容性**（Plan 01-01 checkpoint）
   - 手機 DevTools 注入無 product / 無 summary.defects 的舊 record → 重整 → 看板與分析頁正常渲染，product 顯示「重乳」。

4. **管理頁 product 下拉寫回**
   - 拉取工單 → 預覽出現 product 下拉 → 切換值 → `JSON.parse(localStorage.bakery_workorder).layers[0].product === '重乳'`。

## Gaps Summary

**程式碼層面：無 gap。** 所有 4 個 Success Criteria 在 `app.js` 與 `google-apps-script.js` 中皆已實作正確；D1-D4 四個決策都可由具體行號背書；R1.1 / R1.2 / R3.2 三個需求完整覆蓋；無 TODO/stub。

**部署與 UAT 層面：** Plan 01-02 的兩個 blocking checkpoints（GAS 部署、端到端 round-trip）尚未執行，依使用者指示不視為 FAIL，標記為 NEEDS-HUMAN-UAT。Plan 01-01 的 `checkpoint:human-verify`（管理頁 UI + 舊資料渲染）亦為 PENDING。

**文件微差：** ROADMAP.md:24 寫「重乳酪」，程式碼與 CONTEXT D4 統一用「重乳」；建議 ROADMAP 校正以避免 Phase 2+ 混淆。此為文件 hygiene，非 Phase 1 交付 gap。

**Phase 結論：** Phase 1 程式碼交付**完成**；等候 3 項人工 UAT 關卡確認後即可正式 mark complete。

---

_Verified: 2026-04-15_
_Verifier: Claude (gsd-verifier)_
