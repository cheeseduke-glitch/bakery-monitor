---
phase: 02-multi-layer-ux-sheet-fetch
verified: 2026-04-15T00:00:00Z
status: human_needed
score: 4/4 must-haves verified (automated); 3 require human UAT
overrides_applied: 0
human_verification:
  - test: "均質站勾 1-1/1-2/1-3 → 送出 → 跳 confirm → 按確認後 localStorage bakery_records 新增 3 筆 (batch=1-1/1-2/1-3)"
    expected: "3 筆 Record 寫入；按取消時 0 筆且勾選保留；只勾 1 層不跳 modal"
    why_human: "需 DevTools Local Storage 目視驗證 + UI 互動 (SC#1, 02-01 checkpoint)"
  - test: "換 Sheet gid 後首頁自動拉；DevTools Offline → 重新拉仍顯示既有快取工單"
    expected: "當日批次改為新 gid 內容；離線時 fallback 本地快取 (1hr)"
    why_human: "需真實 Google Sheet + 瀏覽器 Network Offline 切換 (SC#2)"
  - test: "首次綁 Sheet → Sheets 工單分頁出現資料；覆蓋後 Sheets 工單分頁更新"
    expected: "雲端工單分頁 upsert 成功；覆蓋路徑 pushWorkOrderToCloud 送達"
    why_human: "需有效 cloudUrl + Apps Script 後端響應 (SC#3, D3 覆蓋分支)"
  - test: "貼 https://example.com → BAD_URL 訊息；綁私有 Sheet → NOT_PUBLIC 訊息；綁空/錯欄位 Sheet → BAD_CSV 訊息"
    expected: "三種橫幅訊息繁中正確 (SC#4, D2)"
    why_human: "需三種不同狀態的 Sheet URL 實測"
---

# Phase 2: v2.1 多層複選 UX + Google Sheet 工單拉取 — Verification Report

**Phase Goal:** 操作員一次寫多層、班長換 Sheet gid 就換工單；PRD 文案同步校正。
**Verified:** 2026-04-15
**Status:** human_needed (automated evidence complete; 4 items require runtime UAT)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | 均質站一次勾 3 層 → localStorage 出現 3 筆 Record | NEEDS-HUMAN-UAT | Code wired: `submitStation` async (app.js:363), D1 guard `selectedLayers.length >= 2` → `await showConfirm` (app.js:367-372), `selectedLayers.forEach` 寫入迴圈 (app.js:389), `saveRecords(records)` (app.js:408). Runtime write of 3 records requires browser UAT per 02-01 SUMMARY checkpoint. |
| 2 | 換 gid 重整 → 當日批次改變；斷網用 1hr 快取 | PARTIAL → NEEDS-HUMAN-UAT | Cache logic present (app.js:823-828: `ONE_HOUR` + `cached.fetchedAt` check). `fetchWorkOrderRaw` throws `NOT_PUBLIC` on `fetch` TypeError (app.js:803-805). Offline fallback path preserves `bakery_workorder` (refreshWorkOrder returns before touching Storage on error, app.js:909-914). Live gid-swap + offline behavior per 02-02 SUMMARY UAT items 4,7. |
| 3 | 工單存本地同時推到 Sheets 工單表 | NEEDS-HUMAN-UAT | Code wired: `pushWorkOrderToCloud(wo)` calls `cloudFetch('POST', url, { action:'saveWorkOrder', date, batches })` (app.js:870-878); called from `refreshWorkOrder` success (app.js:928, 950) and from `saveSheetUrl`→`fetchTodayWorkOrder` path. Apps Script round-trip requires runtime verification. |
| 4 | 錯誤情境 (未公開 Sheet / CSV 格式錯 / URL 錯) 有對應 showNotify 提示 | VERIFIED (code) / NEEDS-HUMAN-UAT (live) | All three messages present verbatim: `BAD_URL`/`NOT_PUBLIC`/`BAD_CSV` codes (app.js:799,804,806,812,814) + map in `notifyWorkOrderError` (app.js:836-843) + early `saveSheetUrl` URL guard using same string (app.js:884). `showNotify` invoked on all catch paths (app.js:898, 912). |

**Score:** 4/4 observable truths have complete code wiring. 3 truths require human UAT to confirm runtime behavior; none FAIL.

### Decision Verification (D1–D4)

| Decision | Status | Evidence |
|----------|--------|----------|
| **D1** showConfirm + ≥2 層攔截 | VERIFIED | `#confirmModal` DOM (index.html:206-212), `.confirm-actions` style (styles.css:152-153), reusable `showConfirm(title, body, ok, cancel) → Promise<boolean>` (app.js:1020-1051) with single-flight guard (`_confirmInFlight`). `submitStation` guard: `if (AppState.selectedLayers.length >= 2) { ... await showConfirm(...); if(!ok) return; }` (app.js:367-372). 1-layer path unchanged. |
| **D2** 三類錯誤 showNotify (BAD_URL / NOT_PUBLIC / BAD_CSV) | VERIFIED | Throws tagged at origin: `BAD_URL` (app.js:799), `NOT_PUBLIC` network (:804) + non-2xx (:806), `BAD_CSV` parse throw (:812) + empty layers (:814). `notifyWorkOrderError` maps all three to correct 繁中 messages (app.js:836-843). Invoked in `saveSheetUrl` (:898) and `refreshWorkOrder` (:912). |
| **D3** 重新拉工單 diff + 三分支 | VERIFIED | `diffWorkOrder` (app.js:846-859) with added/removed/changed + `empty` flag; `formatDiffHtml` (:861-867) with ➕/➖/♻ 彩色. refreshWorkOrder three branches: (a) **首次** `!hasLocal` → direct write + push (app.js:921-930); (b) **無變更** `diff.empty` → `showNotify('工單無變更','ok')` no write (:932-938); (c) **有變更** → `await showConfirm('重新拉工單', ..., '覆蓋', '取消')` → cancel returns, OK writes + pushes (:940-950). Records untouched (Storage.setWorkOrder only). |
| **D4** PRD §10.2 / §8 / §12 文案校正 | VERIFIED | §10.2 「自動同步 + `bakery_sync_queue` + `flushQueue`」 (PRD:349); §8 「優先雲端 (`pullFromCloud`)，fallback 本地 localStorage」 (PRD:267, also reinforced at :350); §12 「初次載入 < 100KB (index.html + styles.css + app.js gzip 後)」 (PRD:399). Legacy strings「手動同步」「單 HTML < 50KB」grep returns 0. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `index.html` | `#confirmModal` DOM | VERIFIED | Lines 206-212: overlay + title + content + 取消/確認 buttons |
| `styles.css` | `.confirm-actions` + `.btn-secondary` | VERIFIED | `.btn-secondary` (:78), `.confirm-actions` flex + 44px min-height (:152-153) |
| `app.js` | `showConfirm`, async submitStation, fetchWorkOrderRaw, notifyWorkOrderError, diffWorkOrder, formatDiffHtml, pushWorkOrderToCloud, refreshWorkOrder three-branch | VERIFIED | All functions present; see line references above |
| `PRD_...md` | §10.2 / §8 / §12 校正 | VERIFIED | Both positive and negative greps confirm |

### Key Link Verification

| From | To | Via | Status |
|------|----|----|--------|
| `submitStation()` | `showConfirm()` | `AppState.selectedLayers.length >= 2` → `await showConfirm(...)` → `if (!ok) return;` | WIRED (app.js:367-372) |
| `refreshWorkOrder()` | `showConfirm()` | `await showConfirm('重新拉工單', formatDiffHtml(diff), '覆蓋', '取消')` | WIRED (app.js:940) |
| `fetchWorkOrderRaw` catch paths | `showNotify()` via `notifyWorkOrderError(err)` | error code → MSG[err.code] | WIRED (app.js:836-843, 898, 912) |
| `refreshWorkOrder` success path | `saveWorkOrder` Apps Script | `pushWorkOrderToCloud(newWo)` → `cloudFetch('POST', url, { action:'saveWorkOrder', date, batches })` | WIRED (app.js:870-878, 928, 950) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `submitStation` records | `records` array | `getRecords()` + `selectedLayers.forEach` push → `saveRecords` → `localStorage.setItem('bakery_records')` | Yes (Storage module real) | FLOWING (code) / NEEDS-HUMAN (runtime verify record count) |
| `refreshWorkOrder` newWo | `raw.wo` from `fetchWorkOrderRaw` | Real `fetch(csvUrl)` → `parseWorkOrderCsv` → layers; stored via `Storage.setWorkOrder` | Yes | FLOWING (code) / NEEDS-HUMAN (live Sheet) |
| `pushWorkOrderToCloud` | `wo.date`, `wo.layers` | `cloudFetch` POST | Depends on Apps Script | FLOWING (code) / NEEDS-HUMAN |

### Behavioral Spot-Checks

SKIPPED — pure browser app, no Node-runnable entry points. All behaviors gated on DOM + localStorage + fetch → belong to human UAT.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| R1.3 | 02-01 | 多層複選 UX + confirm modal | SATISFIED (code) / NEEDS-HUMAN-UAT | submitStation guard, showConfirm reusable |
| R2.1 | 02-02 | URL 綁定與解析 | SATISFIED | `sheetUrlToCsv` + `Storage.setSheetUrl` + BAD_URL guard |
| R2.2 | 02-02 | CSV 欄位契約 | SATISFIED | `parseWorkOrderCsv` inherited from e3bb1e3 |
| R2.3 | 02-02 | fetchTodayWorkOrder 1hr 快取 + fallback | SATISFIED (code) / NEEDS-HUMAN-UAT | app.js:820-833 cache guard |
| R2.4 | 02-02 | 觸發時機 (auto + 手動重拉) | SATISFIED | `route('')` auto + refreshWorkOrder force path |
| R2.5 | 02-02 | 錯誤處理四情境 | SATISFIED | notifyWorkOrderError + NOT_PUBLIC covers 斷線 |
| R3.1 | 02-02 | 工單匯入後自動 saveWorkOrder | SATISFIED (code) / NEEDS-HUMAN-UAT | pushWorkOrderToCloud on first-fetch + override paths |
| R3.3 | 02-03 | PRD 文案校正 | SATISFIED | §10.2 / §8 / §12 all updated |

No orphaned requirements — REQUIREMENTS.md Phase 2 list (R1.3, R2.1-R2.5, R3.1, R3.3) fully mapped.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| app.js | 863-866 | `innerHTML` 注入 via `formatDiffHtml` using layer `product`/`flavor` strings | Info | Acknowledged in 02-02 SUMMARY threat flags; Phase 4 统一 XSS 修補 covers it. Data source is Google Sheet content controlled by 班長 (trust boundary internal). Not a Phase 2 blocker. |
| app.js | 369 | Same re bodyHtml in submitStation (`list` = `selectedLayers.join('、')` fixed-format `batchId`) | Info | Input is固定格式 `"1-1"/"1-2"/"1-3"` strings from DOM state — no user text. Acknowledged 02-01 SUMMARY. |

No blockers. No TODO/FIXME/placeholder in Phase 2 code surface.

### Human Verification Required

See frontmatter `human_verification:` list. Summary:

1. **Multi-layer submit (SC#1)** — browser UAT of 02-01 checkpoint steps 1-6.
2. **gid swap + offline cache (SC#2)** — requires two Sheet gids + DevTools Network offline toggle.
3. **saveWorkOrder 推雲 (SC#3)** — requires live Apps Script endpoint; verify 工單 tab upsert.
4. **三類錯誤橫幅 (SC#4 / D2)** — requires three failing-state Sheet URLs (bad format / private / bad CSV).

02-01 and 02-02 SUMMARY files both list these as `checkpoint:human-verify` pending UAT — flagged per protocol, not FAIL.

### Gaps Summary

No programmatic gaps. All code artifacts exist, are substantive, are wired, and have plausible data flow. The four Success Criteria each have complete code paths but three demand runtime verification (live Google Sheet, live Apps Script endpoint, live offline simulation) that cannot be asserted from static analysis. Classifying as `human_needed` per Step 9 decision tree — pending UAT items from 02-01 and 02-02 SUMMARY checkpoints must be cleared before marking phase `passed`.

D1-D4 all VERIFIED at the code level. PRD text校正 fully closed (R3.3 SATISFIED with both positive & negative grep confirmation).

---

_Verified: 2026-04-15_
_Verifier: Claude (gsd-verifier)_
