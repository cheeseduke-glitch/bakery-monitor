# 起士公爵 生產良率監測系統

## What This Is

手機優先的烘焙廠生產良率即時監測系統。操作員在 5 個工站（均質/蛋白霜/整面/烤箱/品判）逐批次輸入檢查項目，系統即時驗證合格/異常/嚴重，並以看板矩陣呈現當日全批次狀態；管理員可匯入工單、管理人員、檢視分析報表。純 HTML/CSS/JS 靜態站（GitHub Pages）＋ Google Apps Script ＋ Google Sheets。

**當前版本：** V2 已上線；v2.1（批次結構 + Sheet 綁定 + 多層複選）設計中；V3 為前瞻藍圖。

## Core Value

**在烘焙現場，讓異常在發生的那一刻被看見，讓當日產線狀態一眼可見。** 零依賴、離線可用、手機優先。

## Context

- **單一使用者群體：** 內部烘焙廠操作員 + 班長。非公開產品、無對外開放。
- **現場環境：** 手套、沾粉、光線強，UI 需大觸控目標、單欄佈局。
- **部署：** 前端 GitHub Pages（`main` push 自動發布），後端 GAS 手動部署。
- **權威文件：** `SDD.md`（v1.1）、`PRD_起士公爵生產良率監測系統.md`（v2.1）。
- **現況程式：** `index.html` + `styles.css` + `app.js`（~913 行）+ `google-apps-script.js`（~275 行）。

## Requirements

### Validated（V2 已上線，由現有程式證實）

- ✓ 5 工站表單 + 即時驗證（合格/異常/嚴重三級徽章）— existing
- ✓ localStorage 為單一事實來源，離線可用 — existing
- ✓ 看板矩陣顯示當日批次 × 工站狀態 — existing
- ✓ 日期導航（切換歷史日） — existing
- ✓ 分析頁（區間統計 + 圖表） — existing
- ✓ 管理頁：工單匯入（CSV）、人員管理、雲端 URL 設定 — existing
- ✓ Google Apps Script + Sheets 雲端同步（`syncRecords`、`getRecords`、`saveWorkOrder` 等 action） — existing
- ✓ 同步狀態列（online/offline/syncing/error） — existing
- ✓ Upsert by `date+batch+station`（LockService 防併發） — existing
- ✓ hash routing（中文 hash） — existing

### Active（v2.1 + V3，待實作）

**v2.1（批次結構修正 + Sheet 綁定 — 最近期）**
- [ ] 批次結構：`batch = {batchNum}-{layer}`，Record 加 `batchNum`/`layer`/`product` 欄位
- [ ] 均質/蛋白霜多層複選 UI（checkbox 樣式 + 確認 modal）
- [ ] Google Sheet 工單拉取：URL 綁定 + CSV export + 自動快取（1hr TTL）
- [ ] 首頁/管理頁觸發拉取、失敗 fallback 本地快取
- [ ] 工單匯入後自動 `saveWorkOrder` 推上雲端（修補 §10 差異 #3）
- [ ] Record 模型整併：移除頂層 `defects`，統一用 `summary.defects`（差異 #4）

**V3（優先序見 §11）**
- [ ] 多品項支援：`PRODUCT_TYPES` 動態 schema（重乳酪/輕乳酪/布朗尼/巴斯克）
- [ ] 離線同步佇列 + 指數退避重試（`bakery_sync_queue`，修補 §10.1）
- [ ] LINE Notify 異常通知（Apps Script 端觸發）
- [ ] Token 驗證機制（Script Properties + 前端 `cloud_token`）
- [ ] XSS 修補：`innerHTML` → `textContent` / `createElement`
- [ ] 自動日報（每日 18:00 `MailApp`）
- [ ] 品判站照片上傳（Canvas 壓縮 + Drive）
- [ ] QR Code 工單
- [ ] 多工廠支援（`factory_id`）
- [ ] 驗證器單元測試（Vitest）
- [ ] `clasp` 後端版本化

### Out of Scope

- 公開多租戶 SaaS — 本系統為單廠內部工具
- 使用者帳號登入系統 — V3 改用 Token；完整 OAuth 留給未來
- 原生 App — 手機瀏覽器已滿足現場需求
- 即時資料庫（Firebase 等） — Sheets 已足夠，零依賴是硬約束
- 複雜工作流引擎 — 線性工站流程即可

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 零依賴純靜態站 | 現場電腦/手機環境受限；無 build 簡化部署 | ✓ V2 上線驗證 |
| localStorage 為單一事實來源 | 離線可用、網路不穩現場能繼續作業 | ✓ V2 上線驗證 |
| Apps Script + Sheets 當後端 | 無伺服器維運、Sheet 同時當 UI | ✓ V2 上線驗證 |
| Upsert by `date+batch+station` | 允許重傳、離線佇列安全 | ✓ V2 驗證；V3 佇列沿用 |
| LINE 通知走 Apps Script 端 | Token 不暴露、前端關也會通知 | — 待 V3 實作 |
| 工單拉取不經 Apps Script 代理 | Sheet CSV export 回 CORS `*`，可直接 fetch | — 待 v2.1 實作 |
| 批次結構改 `{batchNum}-{layer}` | 支援多層烤盤、為多品項鋪路 | — 待 v2.1 實作 |
| 多品項用 `PRODUCT_TYPES` 動態 schema | 每品項監控項目不同，寫死無法擴充 | — 待 V3 實作 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-15 after initialization (brownfield, seeded from SDD v1.1)*
