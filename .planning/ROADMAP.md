# Roadmap — 起士公爵 生產良率監測系統

**Granularity:** coarse (3-5 phases)
**Execution:** parallel (plans within each phase)
**Milestone goal:** v2.1 上線 + V3 基建（佇列 / 安全 / 多品項）
**Last updated:** 2026-04-15

## Overview

- [ ] **Phase 1: 批次結構 & 資料模型升級** — Record/WorkOrder 加 batchNum/layer/product，遷移舊資料
- [ ] **Phase 2: v2.1 多層複選 UX + Sheet 工單拉取** — 多層 checkbox、CSV 拉取、自動 saveWorkOrder
- [ ] **Phase 3: 離線同步佇列 + 可靠性** — bakery_sync_queue、指數退避、online 事件重試
- [ ] **Phase 4: 安全加固（Token + XSS）** — Script Properties token、innerHTML 清理
- [ ] **Phase 5: 多品項支援 + 重構基建** — PRODUCT_TYPES、模組拆分、驗證器測試、LINE Notify、clasp

## Phase Details

### Phase 1: 批次結構 & 資料模型升級
**Goal**: 把現有「扁平 batch」升到 `{batchNum, layer, product}` 結構，為多層複選與多品項鋪路
**Depends on**: Nothing (first phase)
**Requirements**: R1.1, R1.2, R3.2
**Success Criteria** (what must be TRUE):
  1. 新提交的 Record 帶齊 batchNum/layer/product 欄位
  2. 既有 localStorage 資料能讀能渲染能上雲（舊 product 預設「重乳酪」）
  3. Sheet 記錄表新欄位就緒，上下雲 round-trip 一致
  4. 頂層 defects 已移除，統一用 summary.defects
**Plans**: TBD

Plans:
- [ ] 01-01: Record/WorkOrder schema 擴充 + 遷移 fallback
- [ ] 01-02: Apps Script Sheet 欄位同步 + upsert 驗證

### Phase 2: v2.1 多層複選 UX + Google Sheet 工單拉取
**Goal**: 操作員一次寫多層、班長換 Sheet gid 就換工單
**Depends on**: Phase 1
**Requirements**: R1.3, R2.1, R2.2, R2.3, R2.4, R2.5, R3.1, R3.3
**Success Criteria** (what must be TRUE):
  1. 均質站一次勾 3 層 → localStorage 出現 3 筆 Record
  2. 換 gid 重整 → 當日批次改變；斷網用 1hr 快取
  3. 工單存本地同時推到 Sheets 工單表
  4. 錯誤情境（未公開 Sheet / CSV 格式錯）有對應提示
**Plans**: TBD

Plans:
- [ ] 02-01: 多層複選 UI + 確認 modal + selectedLayers state
- [ ] 02-02: Sheet URL 綁定 + CSV 解析 + 快取 + 觸發流程
- [ ] 02-03: 管理頁工單匯入自動 saveWorkOrder + PRD 文案校正

### Phase 3: 離線同步佇列 + 可靠性
**Goal**: 把 fire-and-forget 同步換成可重試佇列，斷網不丟資料
**Depends on**: Phase 2
**Requirements**: R4.1, R4.2, R4.3, R4.4
**Success Criteria** (what must be TRUE):
  1. 斷網連交 5 筆 → 全進佇列；恢復網路後自動清空
  2. Sheets 後端無重複列
  3. 連 5 次失敗 → 暫停 + sync-bar 顯示 error 與佇列數
  4. 管理頁顯示待同步數與立即重試按鈕
**Plans**: TBD

Plans:
- [ ] 03-01: bakery_sync_queue 結構 + enqueue/flush API + 替換 syncToCloud 呼叫點
- [ ] 03-02: sync-bar 擴充 + online 事件綁定 + 管理頁重試 UI

### Phase 4: 安全加固（Token + XSS）
**Goal**: Apps Script 不再裸奔、修掉前端 XSS 面
**Depends on**: Phase 3
**Requirements**: R5.1, R5.2
**Success Criteria** (what must be TRUE):
  1. 無 token 請求回 401
  2. notes/人員名/defect 名含 <script> 不會執行
  3. 既有功能全回歸
**Plans**: TBD

Plans:
- [ ] 04-01: Token 驗證（Script Properties + cloudFetch + 管理頁設定）
- [ ] 04-02: XSS 修補（innerHTML → textContent/createElement/esc helper）

### Phase 5: 多品項支援 + 重構基建
**Goal**: 打開多品項擴充性；把 app.js 拆成可維護模組；最小測試與後端版控
**Depends on**: Phase 4
**Requirements**: R6.1, R6.2, R6.3, R7, R8.1, R8.2, R8.3, R8.4
**Success Criteria** (what must be TRUE):
  1. 新增「布朗尼」品項只需改 PRODUCT_TYPES，不動 render code
  2. app.js < 300 行，其餘進 js/{config,state,cloud,validators,pages}
  3. npm test 驗證器單元測試全綠
  4. 嚴重異常 → LINE 群收到通知
  5. GAS 原始碼由 clasp 推送，進版控
**Plans**: TBD

Plans:
- [ ] 05-01: PRODUCT_TYPES + 工站動態渲染 + Record product 欄
- [ ] 05-02: app.js 模組拆分
- [ ] 05-03: 驗證器 Vitest 單元測試
- [ ] 05-04: Apps Script LINE Notify（Properties + 條件觸發）
- [ ] 05-05: clasp 後端版本化

## Backlog

- 自動日報（§11.3）
- 品判照片上傳（§11.4）
- QR Code 工單（§11.5）
- 多工廠（§11.6）

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. 批次結構 & 資料模型升級 | 0/2 | Not started | - |
| 2. v2.1 多層複選 UX + Sheet 工單拉取 | 0/3 | Not started | - |
| 3. 離線同步佇列 + 可靠性 | 0/2 | Not started | - |
| 4. 安全加固（Token + XSS） | 0/2 | Not started | - |
| 5. 多品項支援 + 重構基建 | 0/5 | Not started | - |

## Next Action

Run `/gsd-plan-phase 1` to break Phase 1 into executable tasks.
