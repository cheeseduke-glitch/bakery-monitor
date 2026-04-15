# 起士公爵 生產良率監測系統 — SDD（系統設計文件）

**版本：** v1.1
**對應 PRD：** v2.1（2026/04/15）
**撰寫日期：** 2026/04/15
**狀態：** V2 已上線、v2.1 批次結構修正 + Sheet 綁定設計中、V3 藍圖

**v1.1 變更：** 配合 PRD v2.1
- §3 資料模型：Record/WorkOrder 加 `batchNum`/`layer`/`product` 欄位
- §6 雲端同步：新增 §6.5 Google Sheet 工單拉取協議
- §4 前端架構：新增多層複選 UX 設計
- §11.1 多品項架構不變（已預留）

> 本文件為 PRD 的工程實作對照與 V3 前瞻設計。
> 所有「現況」描述以 main 分支實際程式為準，「PRD 差異」段落列出與 PRD 不一致處。

---

## 0. 目錄

1. 系統概觀
2. 檔案結構與模組分工
3. 資料模型
4. 前端架構設計
5. 後端 (Apps Script) 架構設計
6. 雲端同步協定
7. 路由與頁面設計
8. 驗證與異常分級邏輯
9. 安全設計
10. PRD 與實作差異清單
11. V3 設計藍圖
12. 重構路線圖
13. 測試策略
14. 部署與發布流程

---

## 1. 系統概觀

### 1.1 高階架構（V2 現況）

```
┌──────────────────────────────────────────────┐
│ 前端（GitHub Pages 靜態站）                   │
│   index.html  ─┬─  styles.css                │
│                └─  app.js                    │
│                       │                      │
│                  localStorage（離線快取）      │
└────────────────────┬─────────────────────────┘
                     │ HTTPS fetch (POST/GET)
                     ▼
┌──────────────────────────────────────────────┐
│ Google Apps Script (Web App)                 │
│   doGet / doPost  →  Sheet API               │
└────────────────────┬─────────────────────────┘
                     ▼
┌──────────────────────────────────────────────┐
│ Google Sheets                                │
│   〔記錄〕〔工單〕〔人員〕                      │
└──────────────────────────────────────────────┘
```

### 1.2 設計原則

| 原則 | 落實方式 |
|---|---|
| 零依賴 | 純 HTML/CSS/JS，無 build step、無 npm |
| 離線可用 | localStorage 為單一事實來源，雲端為備份/聚合 |
| 手機優先 | 觸控目標 ≥ 44px、單欄佈局、`position:sticky` header |
| 即時驗證 | 輸入當下計算合格/異常/嚴重 → 立即視覺回饋 |
| 簡單部署 | 推 main → GitHub Pages 自動發布 |

---

## 2. 檔案結構與模組分工

### 2.1 現況檔案

```
bakery-form/
├── index.html              # 215 行  HTML 結構（5 個 page）
├── styles.css              # 151 行  全域樣式
├── app.js                  # 913 行  全部前端邏輯
├── google-apps-script.js   # 275 行  後端（部署到 Apps Script）
├── PRD_起士公爵生產良率監測系統.md
└── SDD.md                  # 本文件
```

### 2.2 `app.js` 內部分區（依現有區塊註解）

| 區塊 | 行數區間（約） | 職責 |
|---|---|---|
| CONFIG | 366–420 | 工站常數、欄位定義、預設工單 |
| STATE | 422–456 | 全域變數、localStorage 讀寫 |
| DATE HELPERS | 457–477 | 日期格式轉換 |
| ROUTING | 479–502 | hash 路由 |
| STATION PAGE | 504–598 | 工站表單渲染與選擇邏輯 |
| VALIDATION | 600–649 | 即時驗證 + 徽章顯示 |
| SUBMIT | 651–692 | 記錄寫入 + 雲端同步觸發 |
| DASHBOARD | 694–759 | 看板矩陣渲染 |
| ANALYTICS | 761–~1000 | 統計報表計算與圖表 |
| ADMIN | ~1000–1200 | 工單匯入、人員管理、雲端設定 |
| CLOUD SYNC | ~1200–end | `cloudFetch` / `syncToCloud` / `pullFromCloud` |
| BOOT | end | `route()` + `initCloudStatus()` |

> V3 重構時將拆為 `state.js` / `cloud.js` / `pages/*.js`，見 §12。

---

## 3. 資料模型

### 3.1 Record（單筆生產記錄）— v2.1

```ts
{
  date: "2026/04/15",                    // YYYY/MM/DD（顯示與 key）
  timestamp: "2026-04-15T08:30:00.000Z", // ISO 8601
  operator: "張宏霖師傅",
  station: "均質" | "蛋白霜" | "整面" | "烤箱" | "品判",
  batch: "1-1",                          // {batchNum}-{layer}
  batchNum: 1,                           // 1~9
  layer: 1,                              // 1~3（上/中/下）
  product: "重乳",                        // v2.1 新增；先固定「重乳」
  flavor: "天使",                         // 從工單帶入
  data: {                                // 各站原始輸入（key 對應 STATION_FIELDS[*].id）
    cheeseTemp: "14.2",
    homogTime_m: "8", homogTime_s: "45",
  },
  defects: ["泡泡", "裂開"],             // 僅品判站有值
  notes: "備註自由文字",
  summary: {
    passCount: 2,
    failCount: 0,
    criticalCount: 0,
    defects: ["泡泡", "裂開"]
  }
}
```

**唯一鍵：** `date + batch + station`（batch 已含 layer）

**輪次（round）不存，衍生：** `Math.ceil(batchNum / 3)`

**均質/蛋白霜多層批量寫入：** 前端一次提交 → 寫出 N 筆相同 data、不同 `batch`/`layer` 的 Record。

### 3.2 WorkOrder（每日工單）— v2.1

```ts
// localStorage key: "bakery_workorder"
{
  date: "2026/04/15",
  sourceUrl: "https://docs.google.com/.../edit",  // 來源 Sheet URL
  fetchedAt: "2026-04-15T07:00:00.000Z",          // 快取時間
  layers: [
    { batch: "1-1", batchNum: 1, layer: 1, product: "重乳", flavor: "天使", notes: "" },
    { batch: "1-2", batchNum: 1, layer: 2, product: "重乳", flavor: "原味", notes: "" },
    { batch: "1-3", batchNum: 1, layer: 3, product: "重乳", flavor: "楓糖", notes: "" },
    // ...
  ]
}
```

**Sheet 設定 key：** `localStorage["bakery_workorder_sheet_url"]` 永久綁定。

### 3.3 Operators（人員清單）

```ts
// localStorage key: "bakery_operators"
["張宏霖師傅", "楊百瀚師傅", "黃宥欣", "阿鶯", "佩榆"]
```

### 3.4 STATION_FIELDS（驗證規則來源）

宣告式 schema，欄位類型：`number | time | select | dual | defects`。
驗證器 (`validateNum/Time/Sel/Dual`) 依 type 分派。**新增監控項目只需改此常數**。

### 3.5 localStorage Keys 一覽

| Key | 用途 | 寫入時機 |
|---|---|---|
| `bakery_records` | 全部記錄陣列 | 每次提交 |
| `bakery_workorder` | 當日工單（快取） | 管理頁匯入 / 首頁自動拉取 |
| `bakery_workorder_sheet_url` | v2.1 綁定的 Sheet URL | 管理頁設定 |
| `bakery_operators` | 人員清單 | 管理頁編輯 |
| `current_operator` | 上次選擇的人員（記住） | 工站選人時 |
| `bakery_cloud_url` | Apps Script Web App URL | 管理頁設定 |

---

## 4. 前端架構設計

### 4.1 頁面狀態機（hash routing）

```
location.hash 變化 → route() → 隱藏所有 .page → 顯示對應 page → 呼叫 render*()
```

| hash | page id | render 函式 |
|---|---|---|
| `` / `#` | page-home | （無，靜態） |
| `#均質`/`#蛋白霜`/`#整面`/`#烤箱`/`#品判` | page-station | `renderStation()` |
| `#看板` | page-dashboard | `renderDashboard()` |
| `#分析` | page-analytics | `initAnalytics()` → `renderAnalytics()` |
| `#管理` | page-admin | `renderAdmin()` |

### 4.2 工站頁狀態流（v2.1）

```
進入工站 → renderOperatorGrid → renderLayerGrid → (使用者選層)
       → 依站別：
          ├─ 均質/蛋白霜：多選（checkbox 樣式），可一次勾多個層
          └─ 整面/烤箱/品判：單選
       → 顯示表單欄位 + 預填既有記錄（多選時以第一個已選層為預填來源）
       → (使用者輸入) → onInput → validate*() → 更新徽章
       → submitStation → 寫 N 筆 localStorage（多選 N，單選 1）
                       → 開 modal → 觸發 syncToCloud
```

**多層選擇 UI：**
- 均質/蛋白霜站：層按鈕改為 checkbox 樣式（已記錄的層仍標示綠色「已完成」）
- 提交時若多選：跳確認 modal 列出要寫入的層清單
- 其他站：維持單選，選中的其他層自動取消

**AppState 擴充：**
```js
AppState.selectedLayers = []   // 多選站用：['1-1', '1-2', '1-3']
AppState.batch = '1-1'         // 單選站用（保留）或多選時取第一個
```

### 4.3 全域變數（待重構）

| 變數 | 用途 | 重構目標 |
|---|---|---|
| `currentOperator` | 當前選擇人員 | 收進 `AppState` |
| `currentStation` | 當前工站 | 收進 `AppState` |
| `currentBatch` | 當前批次 | 收進 `AppState` |
| `dashViewDate` | 看板檢視日期 | 收進 `DashboardState` |

---

## 5. 後端 (Apps Script) 架構設計

### 5.1 入口

| 方法 | action 參數 | 用途 |
|---|---|---|
| `doPost` | `syncRecords` | 上傳記錄（批次 upsert） |
| `doPost` | `saveWorkOrder` | 覆蓋指定日期工單 |
| `doPost` | `saveOperators` | 覆蓋人員清單 |
| `doPost` | `init` | 連線測試 |
| `doGet` | `getRecords?from&to` | 拉取記錄區間 |
| `doGet` | `getWorkOrder?date` | 拉取指定日工單 |
| `doGet` | `getOperators` | 拉取人員 |
| `doGet` | `getRecordDates` | 拉取所有有資料的日期 |
| `doGet` | `ping` | 健康檢查 |

### 5.2 並發控制

`doPost` 用 `LockService.getScriptLock()` 等待 15 秒，避免兩個工站同時同步覆蓋。

### 5.3 Sheet 結構初始化

`initSheets()` 在每次請求開頭執行，缺表自動建立 → 使用者只需建空 Sheets 即可上線。

### 5.4 Upsert 演算法

1. 全表 `getDataRange().getValues()` 載入記憶體
2. 建立 `existingKeys = Set("date|batch|station")`
3. 逐筆判斷：在 set 內 → 找列覆寫；不在 → 累積到 `newRows` 一次 `setValues` 寫入

**已知效能限制：** 記錄量達數萬筆時 `getDataRange` 會慢，V3 需改為 indexed query 或分表（按月分）。

---

## 6. 雲端同步協定

### 6.1 寫入流程（現況）

```
submitStation()
  └─ saveRecords(localStorage)
  └─ if (getCloudUrl()) syncToCloud()
        └─ POST {action:"syncRecords", records:[單筆]}
        └─ 失敗：僅 console 警告，無重試、無佇列
```

### 6.2 讀取流程（分析頁）

```
renderAnalytics()
  └─ pullFromCloud(from, to)
        └─ GET ?action=getRecords&from&to
  └─ 若雲端有資料：使用雲端
  └─ 若雲端空或失敗：fallback 到 localStorage
```

### 6.3 同步狀態列

UI 顯示四種狀態：`online / offline / syncing / error`，由 `initCloudStatus` 啟動 ping。

### 6.4 已知缺口（見 §10）

- 無離線佇列：斷網時提交的記錄只在 localStorage，需手動「全量同步」按鈕補推
- 工單匯入未自動 `saveWorkOrder` 上雲
- 同步失敗無 retry/backoff

### 6.5 Google Sheet 工單拉取協議（v2.1 新增）

**綁定：** 管理頁輸入 Sheet URL（標準 edit URL 或 CSV export URL 皆可）→ 系統解析出 `spreadsheetId` 與 `gid`，存入 `bakery_workorder_sheet_url`。

**URL 解析：**
```
https://docs.google.com/spreadsheets/d/{ID}/edit#gid={GID}
  ↓ 轉換
https://docs.google.com/spreadsheets/d/{ID}/export?format=csv&gid={GID}
```

**Sheet 欄位契約：**
```
A=批次(int) | B=層(int) | C=品項(str) | D=口味(str) | E=備註(str)
第一列為標題，從第二列開始解析
空列跳過（批次為空即視為結束或分隔）
```

**拉取流程：**
```
fetchTodayWorkOrder()
  ├─ 1. 讀 bakery_workorder 快取，若 today && fetchedAt < 1 hour 前 → 直接用
  ├─ 2. 無快取 or 過期 → fetch CSV export URL
  ├─ 3. 解析 CSV → layers[]
  ├─ 4. 更新快取（date, sourceUrl, fetchedAt, layers）
  ├─ 5. 同步推送到 Apps Script 工單表（saveWorkOrder）
  └─ 6. 失敗則 fallback 到既有快取，無快取則顯示空工單
```

**觸發時機：**
- 首頁 `route('')` 時若工單快取非當日 → 自動拉
- 管理頁「🔄 重新拉取」按鈕 → 強制拉（忽略快取）

**CORS 注意：** `docs.google.com/.../export` 對跨域 fetch 回應 `Access-Control-Allow-Origin: *`，可直接從瀏覽器拉取，不需經 Apps Script 代理。

**錯誤處理：**
| 情境 | 處理 |
|---|---|
| URL 格式錯誤 | 解析階段提示使用者 |
| Sheet 未公開 | fetch 失敗，提示「請設為『知道連結的任何人可檢視』」 |
| CSV 欄位格式不對 | 解析過程 try/catch，顯示「Sheet 格式錯誤」 |
| 網路斷線 | fallback 本地快取 |

---

## 7. 路由與頁面設計

採用 hash routing 避免 GitHub Pages 路徑改寫問題。中文 hash 透過 `decodeURIComponent` 處理。

**頁面切換不重新載入 JS**，所有 render 函式為 idempotent（重複呼叫狀態正確）。

---

## 8. 驗證與異常分級邏輯

### 8.1 即時驗證流程

```
input event
  └─ validateNum/Time/Sel/Dual(id, ...)
        └─ 計算合格/異常/嚴重
        └─ 更新 #badge-{id}: badge-pass | badge-fail | badge-critical
        └─ 更新 #msg-{id}: validation-msg ok | warn | error
        └─ 嚴重者：showNotify('critical') 紅色頂部橫幅
```

### 8.2 提交時統計

```js
fields.forEach(f => 統計徽章類別)
記錄 summary = { passCount, failCount, criticalCount, defects }
```

### 8.3 看板異常判定

```
任一站 summary.failCount > 0 || criticalCount > 0 || defects.length > 0
   → 該站 dot 變色（黃/紅）
```

---

## 9. 安全設計

### 9.1 現況（V2）

| 面向 | 現況 | 風險 |
|---|---|---|
| 認證 | 無 | 任何人取得網址即可寫入 |
| Apps Script 存取 | 「所有人」 | 同上 |
| API key | 無 | — |
| XSS | `innerHTML` 多處串接使用者輸入（備註、defect 名稱） | 中等：內部使用，外部攻擊面低 |
| HTTPS | GitHub Pages 強制 | OK |

### 9.2 V3 安全加固設計

**Token 驗證機制：**

1. Apps Script 端設定 `const SECRET_TOKEN = "..."`（Script Properties 儲存）
2. 前端 `cloudFetch` 在每次請求帶 `?token=` 或 body `token` 欄位
3. `doGet/doPost` 開頭驗 token，不符回 401
4. Token 由管理員在管理頁設定，存 localStorage `cloud_token`

**XSS 修補：**

- 使用者輸入（`notes`、自訂人員名）一律走 `textContent`
- 模板拼接以 `document.createElement` 取代 `innerHTML`
- 或引入極小型 escape helper：`function esc(s){return String(s).replace(/[&<>"']/g, c => MAP[c])}`

---

## 10. PRD 與實作差異清單

| # | PRD 描述 | 實際實作 | 處置建議 |
|---|---|---|---|
| 1 | §10.2「離線存 localStorage，上線後**手動**同步」 | 提交即自動 POST，無離線佇列 | **已決策：** 修 PRD 為「自動同步」+ 補實作離線佇列（見下方 §10.1） |
| 2 | 分析頁資料來源未明寫 | 優先雲端，fallback 本地 | **補 PRD** §8 加註資料來源優先序 |
| 3 | §3 V2「工單匯入 CSV」 | 僅存 localStorage，未推到 Sheets 工單表 | **補實作**：管理頁存工單後自動 `saveWorkOrder` |
| 4 | Record 資料模型 | `defects` 同時存頂層與 `summary.defects` | **補實作**：去掉頂層 `defects`，統一從 `summary` 讀 |
| 5 | §13「無使用者驗證」標為已知限制 | 同 PRD | V3 引入 Token，見 §9.2 |
| 6 | §12 效能「單 HTML < 50KB」 | 拆檔後三檔合計 ~55KB（gzip 後更小） | **修 PRD** 改為「初次載入 < 100KB」 |

### 10.1 離線佇列設計（補實作）

**localStorage 結構：**
```ts
// key: "bakery_sync_queue"
[
  { id: "uuid", record: {...Record}, attempts: 0, lastError: null, queuedAt: ISO }
]
```

**寫入流程：**
```
submitStation()
  └─ saveRecords(localStorage)         // 永遠先寫本地（單一事實來源）
  └─ enqueueSync(record)               // 推入佇列
  └─ flushQueue()                      // 嘗試立即送出
```

**flushQueue 邏輯：**
1. 若離線（`navigator.onLine === false`）→ 直接 return，標記 sync-bar 為 `offline`
2. 逐筆 POST：
   - 成功 → 從佇列移除
   - 失敗 → `attempts++`、紀錄 `lastError`、指數退避（1s, 2s, 4s, 8s, 16s, max 60s）
   - 連續失敗 5 次 → 暫停該筆，sync-bar 顯示 `error` + 顯示佇列數
3. `online` 事件監聽：網路回來自動 `flushQueue()`
4. 管理頁顯示「待同步：N 筆」+「立即重試」按鈕

**唯一鍵保護：** 後端 upsert 已用 `date+batch+station`，重送不會重複。

**取代現有 `syncToCloud`：** 現有實作改為呼叫 `enqueueSync` + `flushQueue`，介面對 caller 透明。

---

## 11. V3 設計藍圖

### 11.1 多品項支援（最高優先）

**現況問題：** `STATION_FIELDS` 寫死「重乳酪」的監控項目；批次無品項類型概念。

**設計：**

```js
const PRODUCT_TYPES = {
  '重乳酪': {
    stations: ['均質','蛋白霜','整面','烤箱','品判'],
    fields: { 均質: [...], 蛋白霜: [...], ... }   // 即現有 STATION_FIELDS
  },
  '輕乳酪': { stations: [...], fields: {...} },
  '布朗尼': { ... },
  '巴斯克': { ... }
};
```

**批次帶品項類型：**
```ts
WorkOrder.batches[i] = {
  id: "1-A", round: 1, oven: "A",
  flavor: "天使",
  product: "重乳酪"      // ← 新增
}
```

**Record 帶品項：**
```ts
Record.product = "重乳酪"  // 新增；Sheets 加一欄
```

**路由變化（已決策）：** 工站頁進入後，列出「今日該站要做的批次」並自動依各批次品項過濾。
- 選批次後，依該批次的 `product` 動態渲染對應 fields
- 同一工站當天可能處理多種品項（例：烤箱站今天烤重乳酪也烤巴斯克），UI 需在批次卡上標示品項類別

**遷移：** 既有 Record 無 `product` 欄 → 預設視為「重乳酪」。

### 11.2 LINE 通知

**選項 A（推薦）：Apps Script 端觸發**
- `syncRecords` 收到 `criticalCount > 0` 或 `defects.length > 0` → 呼叫 LINE Notify API
- 優點：即使前端關掉也會通知；Token 安全保管在 Script Properties
- 缺點：與 Sheets 寫入同步，慢一點

**選項 B：前端直接呼叫**
- `submitStation` 異常時 fetch LINE Notify
- 缺點：Token 暴露在前端、CORS 問題

→ **採選項 A（已決策）**

**實作要點：**
- LINE Notify Token 存於 Apps Script Properties Service（`PropertiesService.getScriptProperties()`）
- `syncRecords` 寫入後，若 `criticalCount > 0 || defects.length > 0`，呼叫 `notifyLine(record)`
- 訊息格式：`🔴 [站別] {批次}（{口味}）異常\n操作員：{name}\n項目：{defects/異常摘要}\n時間：{timestamp}`
- 失敗不阻擋寫入（try/catch 包住 LINE 呼叫）

### 11.3 自動報表

Apps Script 內建 `Time-driven trigger`，每日 18:00 跑 `dailyReport()`：
- 統計當日 Records → 渲染 HTML 表 → `MailApp.sendEmail`
- 收件人在 Script Properties 設定

### 11.4 照片上傳（品判站）

- HTML `<input type="file" accept="image/*" capture="environment">`
- 壓縮：Canvas resize 至 1024px 寬、JPEG quality 0.7
- 儲存：上傳到 Google Drive 資料夾，Apps Script 端用 `DriveApp.createFile`
- Record 加 `photoUrl` 欄

### 11.5 QR Code 工單

- 班長端：管理頁產生當日 QR（內含 `#工單?date=2026-04-15`）
- 操作員：掃碼直接帶入工單
- 用 `qrcode.js`（< 5KB）

### 11.6 多工廠

- localStorage 加 `factory_id`
- Apps Script 依 `factory_id` 選擇不同 Sheet 檔案（或同 Sheet 加欄位）
- 路由 `#工廠選擇`

---

## 12. 重構路線圖

承接「需要重構」評估，分 5 步驟，每步可獨立合併、可獨立回滾。

| # | 任務 | 預估 | 狀態 |
|---|---|---|---|
| 1 | 拆檔：`index.html` / `styles.css` / `app.js` | 1h | ✅ 已完成 |
| 2 | 封裝 `AppState` + `Storage` 模組，消除全域變數 | 3h | ✅ 已完成 |
| 3 | 改 `addEventListener` + 事件委託，移除內聯 `onclick` | 2h | ✅ 已完成 |
| 4 | 抽出 `CloudService` 類，加離線佇列 + 重試 | 4h | ⏳ |
| 5 | XSS 防護：`innerHTML` → `textContent` / `createElement` | 2h | ⏳ |
| 6 | **v2.1 批次結構**：batch+layer、多層複選、Sheet 綁定、後端 schema | 6h | ⏳ |

完成步驟 2–5 後，`app.js` 可進一步拆為：
```
js/
├── config.js       # STATION_FIELDS, PRODUCT_TYPES, AVATARS
├── state.js        # AppState, Storage
├── cloud.js        # CloudService
├── validators.js   # validateNum/Time/Sel/Dual
├── pages/
│   ├── station.js
│   ├── dashboard.js
│   ├── analytics.js
│   └── admin.js
└── app.js          # boot + router
```

---

## 13. 測試策略

### 13.1 現況：純手動

V2 沒有自動測試。每次發版前手動跑：
1. 5 個工站各填一筆，確認徽章正確
2. 看板顯示對應狀態
3. 切日期前後翻、確認歷史資料正確
4. 分析頁區間查詢
5. 管理頁匯入 CSV、雲端同步測試

### 13.2 V3 建議引入

- **驗證器單元測試**：`validateNum/Time/Sel/Dual` 為純函式，最易測。用 Vitest 或最小 `assert` 即可
- **資料模型 contract test**：給定 Record 物件，檢查必填欄位
- **Apps Script 端**：用 `clasp` 把後端搬出 GAS 編輯器 → 可用 Jest mock `SpreadsheetApp`

---

## 14. 部署與發布流程

### 14.1 前端

```
git push origin main  →  GitHub Actions（Pages）  →  https://cheeseduke-glitch.github.io/bakery-monitor/
```

無 build step，HTML 直接服務。

### 14.2 後端（Apps Script）

目前手動：複製 `google-apps-script.js` 內容 → 貼到 GAS 編輯器 → 點「部署」。

**改進建議：** 引入 [`clasp`](https://github.com/google/clasp)：
```bash
clasp login
clasp clone <scriptId>
clasp push
clasp deploy
```
讓後端也版本化、可 PR review。

### 14.3 版本標記

每次發版打 git tag：`v2.0`、`v2.1`...，PRD 與 SDD 的版本欄同步更新。

---

## 附錄 A：詞彙表

| 詞 | 定義 |
|---|---|
| 批次（Batch） | 一爐烘烤的單位，編號 `{round}-{oven}` |
| 輪次（Round） | 一天內第幾批次烘烤 |
| 工站（Station） | 均質/蛋白霜/整面/烤箱/品判 五個檢查點 |
| 工單（WorkOrder） | 一天的批次計劃清單 |
| 良率 | 合格檢查項目數 / 總檢查項目數 |
| 嚴重（Critical） | 出爐熟度「完全不回彈」或有外觀不良 |

## 附錄 B：相關文件

- [PRD](./PRD_起士公爵生產良率監測系統.md) — 產品需求
- [google-apps-script.js](./google-apps-script.js) — 後端原始碼
- GitHub: https://github.com/cheeseduke-glitch/bakery-monitor
