---
phase: 02-multi-layer-ux-sheet-fetch
plan: 03
subsystem: docs
tags: [prd, documentation, v2.1]
requires: []
provides:
  - "PRD §10.2 文案與 SDD v1.1 / 實際程式一致（自動同步 + bakery_sync_queue）"
  - "PRD §8 明寫分析頁資料來源（pullFromCloud → localStorage fallback）"
  - "PRD §12 效能 NFR 改為多檔 gzip < 100KB"
affects: []
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - "PRD_起士公爵生產良率監測系統.md"
decisions:
  - "保留 §10.2 備註『v2.1 已完成前端寫入，佇列機制於 Phase 3 補實作』以正確標記實作階段落差"
  - "§8 資料來源說明放在 §8 章節頂部（§8.1 之前），同時於 §10.2 讀取時機內補一次，確保讀者從兩個入口都能看到"
  - "附錄 A『單 HTML 檔』描述未改（屬另一章節，不在 plan 授權範圍內），已留作後續清理"
metrics:
  duration: "~3m"
  completed: "2026-04-15"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 2 Plan 03: PRD v2.1 文案校正 Summary

**一句話：** 依 D4 校正 `PRD_起士公爵生產良率監測系統.md` §10.2 / §8 / §12 三處文案，消除 PRD ↔ SDD v1.1 ↔ 實際程式之間的敘述落差。

## 完成的任務

| Task | 名稱 | Commit | 檔案 |
|------|------|--------|------|
| 1 | 校正 PRD §10.2 / §8 / §12 三處文案 | 2133bfa | PRD_起士公爵生產良率監測系統.md |

## 變更內容

### §10.2 同步機制
- **原：** 「斷網時存在 localStorage，上線後**手動**同步」
- **新：** 「斷網時存在 localStorage，上線後**自動**同步（記錄進 `bakery_sync_queue` 佇列，由 `flushQueue` 於網路恢復時重送；v2.1 已完成前端寫入，佇列機制於 Phase 3 補實作）」
- **讀取時機：** 補述「分析頁資料來源：優先雲端 `pullFromCloud`，fallback 本地 localStorage」

### §8 數據分析規格
- 於章節頂部（§8.1 之前）新增一行：「**分析頁資料來源：** 優先雲端 (`pullFromCloud`)，fallback 本地 localStorage。」

### §12 非功能需求
- **原：** 效能 — 「單 HTML 檔 < 50KB，秒開」
- **新：** 效能 — 「初次載入 < 100KB（index.html + styles.css + app.js gzip 後），秒開」

## 驗證

- grep `手動同步` → 0 命中 ✅
- grep `單 HTML < 50KB` / `50KB` → 0 命中 ✅
- grep `自動同步 | bakery_sync_queue | flushQueue` → 命中（§10.2 + §6.1 架構圖）✅
- grep `pullFromCloud | 優先雲端` → 命中 §8 與 §10.2 ✅
- grep `100KB` → 命中 §12 ✅
- `git diff --stat` HEAD~1..HEAD 僅列出 PRD 檔案 ✅

## 偏離計畫

無。計畫照原文執行，無觸發 Rule 1-4 之情境。

## 備註

- `app.js`、`.planning/ROADMAP.md` 有其他平行 agent 的修改，本 plan 未 stage 也未 commit 這些檔案。
- 提交時 Git 提示 CRLF 轉換警告（Windows 平台正常行為），檔案內容無語義變化。

## Self-Check: PASSED

- 檔案存在：`PRD_起士公爵生產良率監測系統.md` ✅
- Commit 存在：`2133bfa` ✅
- SUMMARY 路徑：`.planning/phases/02-multi-layer-ux-sheet-fetch/02-03-SUMMARY.md` ✅
