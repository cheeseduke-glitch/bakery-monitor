// ========== CONFIG ==========
const DEFAULT_OPERATORS = ['張宏霖師傅','楊百瀚師傅','黃宥欣','阿鶯','佩榆'];
const AVATARS = ['👨‍🍳','🧑‍🍳','👩‍🍳','👩‍🍳','🧑‍🍳','👤','👤','👤','👤','👤'];

const today = new Date();
const dateStr = `${today.getFullYear()}/${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}`;

const STATION_META = {
  '均質': { color:'#2E6B4F', bg:'#E8F5EE', icon:'🥣', headerBg:'linear-gradient(135deg,#2E6B4F,#5BA67A)' },
  '蛋白霜': { color:'#8B6914', bg:'#FFF8E1', icon:'☁️', headerBg:'linear-gradient(135deg,#8B6914,#D4A017)' },
  '整面': { color:'#3A7D5C', bg:'#E0F2E9', icon:'🍰', headerBg:'linear-gradient(135deg,#3A7D5C,#6DBF8B)' },
  '烤箱': { color:'#8B3A2F', bg:'#FDEDEC', icon:'🔥', headerBg:'linear-gradient(135deg,#8B3A2F,#C0392B)' },
  '品判': { color:'#5B4080', bg:'#F3EFF8', icon:'👨‍🍳', headerBg:'linear-gradient(135deg,#5B4080,#7B5EA7)' },
};

const STATION_FIELDS = {
  '均質': [
    { id:'cheeseTemp', label:'乳酪溫度', unit:'℃', type:'number', step:'0.1', std:'13℃ ~ 15℃', min:13, max:15 },
    { id:'homogTime', label:'乳酪均質時間', type:'time', std:"8'30 ~ 9'00", minSec:510, maxSec:540 },
  ],
  '蛋白霜': [
    { id:'whipTime', label:'快速打發時間', type:'time', std:"5'20（固定）", minSec:305, maxSec:335 },
    { id:'meringueWt', label:'蛋白霜比重', unit:'g', type:'number', step:'0.1', std:'68g ~ 70g', min:68, max:70 },
    { id:'foldCount', label:'拌合次數', unit:'下', type:'number', step:'1', std:'55 ~ 60 下', min:55, max:60 },
  ],
  '整面': [
    { id:'cutBubble', label:'筷子切泡', type:'select', std:'約 3 圈',
      options:[{value:'',text:'請選擇'},{value:'約3圈',text:'約 3 圈（標準）'},{value:'少於3圈',text:'少於 3 圈'},{value:'多於3圈',text:'多於 3 圈'}], expected:'約3圈' },
  ],
  '烤箱': [
    { id:'ovenTemp', label:'烘烤溫度（上火/下火）', type:'dual', std:'上火 230℃ / 下火 120℃',
      sub:[{id:'ovenTempUp',placeholder:'上火',label:'上火',target:230,tolerance:5},{id:'ovenTempDown',placeholder:'下火',label:'下火',target:120,tolerance:5}] },
    { id:'bakeTime', label:'烘烤時間', type:'dual', std:'進爐 25分 + 轉盤後 35~40分',
      sub:[{id:'bakeTime1',placeholder:'進爐',label:'進爐(分)',target:25,tolerance:2},{id:'bakeTime2',placeholder:'轉盤後',label:'轉盤後(分)',min:35,max:40}] },
  ],
  '品判': [
    { id:'doneness', label:'出爐熟度', type:'select', std:'觸摸後中心回彈',
      options:[{value:'',text:'請選擇'},{value:'中心回彈',text:'✅ 中心回彈（標準）'},{value:'中心偏軟',text:'⚠️ 中心偏軟（未熟）'},{value:'中心偏硬',text:'⚠️ 中心偏硬（過熟）'},{value:'完全不回彈',text:'🔴 完全不回彈（嚴重）'}],
      expected:'中心回彈', critical:'完全不回彈' },
    { id:'colorCard', label:'出爐顏色', unit:'色卡', type:'number', step:'1', std:'色卡 4 ~ 6', min:4, max:6 },
    { id:'defects', label:'外觀不良（有問題請點選）', type:'defects',
      items:[{value:'泡泡',icon:'🫧',text:'表面有泡泡'},{value:'裂開',icon:'💔',text:'裂開'},{value:'過黑',icon:'🔥',text:'過黑（上色過深）'},{value:'烤不熟',icon:'🥶',text:'烤不熟'}] },
  ],
};

// v2.1: 站別輸入模式（多層複選 vs 單層）
const MULTI_LAYER_STATIONS = new Set(['均質', '蛋白霜']);

// 工單空預設（v2.1 改為 layer 粒度；實際工單由 Google Sheet 拉取）
const DEFAULT_WORK_ORDER = [];

// v2.1 批次結構工具
function roundOf(batchNum) { return Math.ceil(batchNum / 3); }
function batchId(batchNum, layer) { return `${batchNum}-${layer}`; }
function parseBatchId(id) {
  const [b, l] = String(id).split('-').map(n => parseInt(n));
  return { batchNum: b || 0, layer: l || 0 };
}

// ========== STORAGE ==========
// 集中管理所有 localStorage 讀寫，避免 key 字串散落各處
const Storage = {
  getRecords()          { return JSON.parse(localStorage.getItem('bakery_records')||'[]'); },
  setRecords(r)         { localStorage.setItem('bakery_records', JSON.stringify(r)); },
  getOperators()        { const s=localStorage.getItem('bakery_operators'); return s?JSON.parse(s):DEFAULT_OPERATORS; },
  setOperators(ops)     { localStorage.setItem('bakery_operators', JSON.stringify(ops)); },
  getWorkOrderRaw()     { const s=localStorage.getItem('bakery_workorder'); return s?JSON.parse(s):null; },
  setWorkOrder(wo)      { localStorage.setItem('bakery_workorder', JSON.stringify(wo)); },
  getCurrentOperator()  { return localStorage.getItem('current_operator')||''; },
  setCurrentOperator(n) { localStorage.setItem('current_operator', n); },
  getCloudUrl()         { return localStorage.getItem('bakery_cloud_url')||''; },
  setCloudUrl(u)        { localStorage.setItem('bakery_cloud_url', u); },
  clearCloudUrl()       { localStorage.removeItem('bakery_cloud_url'); },
  getSheetUrl()         { return localStorage.getItem('bakery_workorder_sheet_url')||''; },
  setSheetUrl(u)        { localStorage.setItem('bakery_workorder_sheet_url', u); },
  clearSheetUrl()       { localStorage.removeItem('bakery_workorder_sheet_url'); },
};

// ========== STATE ==========
const AppState = {
  operator: Storage.getCurrentOperator(),
  station: '',
  batch: '',                // 單選站用（batch ID: "1-1"）
  selectedLayers: [],       // 多選站用（["1-1","1-2","1-3"]）
  dashDate: null,           // 看板檢視日期
};

// ========== DATA HELPERS ==========
function getRecords() { return Storage.getRecords(); }
function saveRecords(r) { Storage.setRecords(r); }
function getOperators() { return Storage.getOperators(); }
// v2.1: 回傳 layer 陣列 [{batch, batchNum, layer, product, flavor, notes}]
function getWorkOrder(forDate) {
  const targetDate = forDate || dateStr;
  const wo = Storage.getWorkOrderRaw();
  if (wo && wo.date === targetDate && Array.isArray(wo.layers)) return wo.layers;
  if (targetDate === dateStr) return DEFAULT_WORK_ORDER;
  // 歷史日期：從記錄反推工單
  const records = getRecords().filter(r => r.date === targetDate);
  if (records.length) {
    const seen = {};
    records.forEach(r => {
      if (!seen[r.batch]) {
        const { batchNum, layer } = parseBatchId(r.batch);
        seen[r.batch] = {
          batch: r.batch,
          batchNum: r.batchNum || batchNum,
          layer: r.layer || layer,
          product: r.product || '重乳',
          flavor: r.flavor || '',
          notes: ''
        };
      }
    });
    return Object.values(seen).sort((a,b) => a.batchNum - b.batchNum || a.layer - b.layer);
  }
  return [];
}

// ========== DATE HELPERS ==========
function fmtDate(d) {
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}
function parseDate(s) {
  const p = s.split('/');
  return new Date(parseInt(p[0]), parseInt(p[1])-1, parseInt(p[2]));
}
function toInputDate(s) {
  return s.replace(/\//g, '-');
}
function fromInputDate(s) {
  return s.replace(/-/g, '/');
}

// Get all unique dates from records
function getAllRecordDates() {
  const dates = new Set();
  getRecords().forEach(r => dates.add(r.date));
  return [...dates].sort();
}

// ========== ROUTING ==========
function route() {
  const hash = decodeURIComponent(location.hash.replace('#',''));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  if (hash === '看板') {
    document.getElementById('page-dashboard').classList.add('active');
    AppState.dashDate = new Date();
    renderDashboard();
  }
  else if (hash === '分析') {
    document.getElementById('page-analytics').classList.add('active');
    initAnalytics();
  }
  else if (hash === '管理') { document.getElementById('page-admin').classList.add('active'); renderAdmin(); }
  else if (STATION_META[hash]) { AppState.station = hash; document.getElementById('page-station').classList.add('active'); renderStation(); }
  else {
    document.getElementById('page-home').classList.add('active');
    autoFetchWorkOrderIfStale();   // v2.1: 首頁自動拉工單（非阻塞）
  }

  document.getElementById('homeDate').textContent = dateStr;
  window.scrollTo(0,0);
}

function autoFetchWorkOrderIfStale() {
  if (!Storage.getSheetUrl()) return;
  fetchTodayWorkOrder(false).catch(err => console.warn('工單自動拉取失敗:', err.message));
}

function goHome() { location.hash = ''; }
window.addEventListener('hashchange', route);

// ========== STATION PAGE ==========
function renderStation() {
  const meta = STATION_META[AppState.station];
  const header = document.getElementById('stationHeader');
  header.style.background = meta.headerBg;
  const isMulti = MULTI_LAYER_STATIONS.has(AppState.station);
  document.getElementById('stationTitle').textContent = `${meta.icon} ${AppState.station}站${isMulti ? '（可多選層）' : ''}`;
  document.getElementById('stationSub').textContent = dateStr;
  AppState.batch = '';
  AppState.selectedLayers = [];

  // v2.1: 首頁若未自動拉，進工站再試一次
  autoFetchWorkOrderIfStale();

  renderOperatorGrid();
  renderBatchGrid();
  renderFormFields();
  document.getElementById('notesSection').style.display = 'none';
  document.getElementById('submitArea').style.display = 'none';
}

function renderOperatorGrid() {
  const ops = getOperators();
  const grid = document.getElementById('operatorGrid');
  grid.innerHTML = ops.map((name,i) => `
    <div class="operator-btn ${AppState.operator===name?'selected':''}" data-op-name="${name}">
      <span class="avatar">${AVATARS[i]||'👤'}</span>${name}
    </div>`).join('');
}

function selectOp(name, el) {
  AppState.operator = name;
  Storage.setCurrentOperator(name);
  document.querySelectorAll('.operator-btn').forEach(b => b.classList.remove('selected'));
  if (el) el.classList.add('selected');
  document.getElementById('otherOpInput').value = '';
  updateStationSub();
}
function selectOtherOp() {
  const name = document.getElementById('otherOpInput').value.trim();
  if (!name) { showNotify('請輸入姓名','warn'); return; }
  AppState.operator = name;
  Storage.setCurrentOperator(name);
  document.querySelectorAll('.operator-btn').forEach(b => b.classList.remove('selected'));
  updateStationSub();
  showNotify(`✅ ${name}`,'success');
}
function updateStationSub() {
  document.getElementById('stationSub').textContent = AppState.operator ? `${AppState.operator}｜${dateStr}` : dateStr;
}

// v2.1: 每層一個按鈕，分輪顯示。多選站用 checkbox 樣式；單選站用 radio 樣式。
function renderBatchGrid() {
  const wo = getWorkOrder();
  const records = getRecords();
  const grid = document.getElementById('batchGrid');
  const isMulti = MULTI_LAYER_STATIONS.has(AppState.station);

  if (!wo.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;padding:20px;text-align:center;color:#888">
      尚無工單。請到<a href="#管理" style="color:var(--brand);font-weight:600">管理設定</a>綁定 Sheet。
    </div>`;
    return;
  }

  let html = ''; let lastRound = 0;
  wo.forEach(L => {
    const r = roundOf(L.batchNum);
    if (r !== lastRound) { html += `<div class="round-label">第 ${r} 輪</div>`; lastRound = r; }
    const done = records.some(x => x.batch===L.batch && x.station===AppState.station && x.date===dateStr);
    const sel = isMulti ? AppState.selectedLayers.includes(L.batch) : AppState.batch === L.batch;
    const mark = isMulti ? (sel ? '☑' : '☐') : '';
    html += `<div class="batch-btn ${done?'done':''} ${sel?'selected':''}" data-batch-id="${L.batch}">
      <div class="batch-label">${mark} ${L.batch}</div>
      <div class="batch-detail">${L.product || '重乳'}｜${L.flavor}</div></div>`;
  });
  grid.innerHTML = html;
}

function selectBatch(id) {
  if (!AppState.operator) { showNotify('請先選擇操作人員','warn'); return; }
  const isMulti = MULTI_LAYER_STATIONS.has(AppState.station);

  if (isMulti) {
    const i = AppState.selectedLayers.indexOf(id);
    if (i >= 0) AppState.selectedLayers.splice(i, 1);
    else AppState.selectedLayers.push(id);
    AppState.batch = AppState.selectedLayers[0] || '';
  } else {
    AppState.batch = id;
    AppState.selectedLayers = [id];
  }

  renderBatchGrid();

  if (!AppState.selectedLayers.length) {
    document.getElementById('notesSection').style.display = 'none';
    document.getElementById('submitArea').style.display = 'none';
    return;
  }

  document.getElementById('notesSection').style.display = 'block';
  document.getElementById('submitArea').style.display = 'flex';
  clearFormFields();

  // 預填：以第一個已選層的既有記錄
  const first = AppState.selectedLayers[0];
  const rec = getRecords().find(r => r.batch===first && r.station===AppState.station && r.date===dateStr);
  if (rec) {
    Object.entries(rec.data||{}).forEach(([k,v]) => { const el=document.getElementById(k); if(el)el.value=v; });
    // D3：讀取端統一走 summary.defects，保留 rec.defects 作為舊資料安全網
    const recDefects = (rec.summary && rec.summary.defects) || rec.defects || [];
    recDefects.forEach(d => { const b=document.querySelector(`.defect-btn[data-defect="${d}"]`); if(b)b.classList.add('active'); });
    if (rec.notes) document.getElementById('stationNotes').value = rec.notes;
    revalidateAll();
  }
}

function renderFormFields() {
  const fields = STATION_FIELDS[AppState.station];
  const meta = STATION_META[AppState.station];
  let html = `<div class="card"><div class="card-title" style="background:${meta.bg};color:${meta.color}">${meta.icon} ${AppState.station}站監控項目</div>`;
  fields.forEach(f => {
    html += `<div class="field"><div class="field-label">${f.label} <span class="badge" id="badge-${f.id}"></span></div>`;
    if (f.std) html += `<div class="field-standard">標準：<span>${f.std}</span></div>`;
    if (f.type==='number') html += `<div class="input-row"><input type="number" id="${f.id}" placeholder="${f.unit}" step="${f.step}" inputmode="decimal"><span class="input-unit">${f.unit}</span></div>`;
    else if (f.type==='time') html += `<div class="input-row"><input type="number" id="${f.id}_m" placeholder="分" inputmode="numeric"><span class="input-unit">分</span><input type="number" id="${f.id}_s" placeholder="秒" inputmode="numeric"><span class="input-unit">秒</span></div>`;
    else if (f.type==='select') { html += `<select id="${f.id}">`; f.options.forEach(o => html+=`<option value="${o.value}">${o.text}</option>`); html += `</select>`; }
    else if (f.type==='dual') { html += `<div class="input-row">`; f.sub.forEach(s => html += `<div style="flex:1"><input type="number" id="${s.id}" placeholder="${s.placeholder}" inputmode="numeric"><div style="font-size:11px;color:#999;text-align:center;margin-top:2px">${s.label}</div></div>`); html += `</div>`; }
    else if (f.type==='defects') { html += `<div class="defect-grid">`; f.items.forEach(it => html += `<div class="defect-btn" data-defect="${it.value}"><span class="icon">${it.icon}</span>${it.text}</div>`); html += `</div>`; }
    html += `<div class="validation-msg" id="msg-${f.id}"></div></div>`;
  });
  html += `</div>`;
  document.getElementById('stationForm').innerHTML = html;
}

// ========== VALIDATION ==========
function validateNum(id,min,max,unit) {
  const v=parseFloat(document.getElementById(id).value), b=document.getElementById('badge-'+id), m=document.getElementById('msg-'+id);
  if(isNaN(v)){b.textContent='';m.textContent='';return}
  if(v>=min&&v<=max){b.textContent='合格';b.className='badge badge-pass';m.textContent=''}
  else{b.textContent='不合格';b.className='badge badge-fail';m.textContent=`⚠️ ${v<min?`低於${(min-v).toFixed(1)}${unit}`:`高於${(v-max).toFixed(1)}${unit}`}`;m.className='validation-msg warn'}
}
function validateTime(id,minS,maxS) {
  const mm=parseInt(document.getElementById(id+'_m').value)||0, ss=parseInt(document.getElementById(id+'_s').value)||0, t=mm*60+ss;
  const b=document.getElementById('badge-'+id), m=document.getElementById('msg-'+id);
  if(!document.getElementById(id+'_m').value&&!document.getElementById(id+'_s').value){b.textContent='';m.textContent='';return}
  if(t>=minS&&t<=maxS){b.textContent='合格';b.className='badge badge-pass';m.textContent=`${mm}分${ss}秒`;m.className='validation-msg ok'}
  else{b.textContent='不合格';b.className='badge badge-fail';m.textContent=`⚠️ ${mm}分${ss}秒（偏離標準）`;m.className='validation-msg warn'}
}
function validateSel(id,exp,crit) {
  const v=document.getElementById(id).value, b=document.getElementById('badge-'+id), m=document.getElementById('msg-'+id);
  if(!v){b.textContent='';m.textContent='';return}
  if(v===exp){b.textContent='合格';b.className='badge badge-pass';m.textContent=''}
  else if(crit&&v===crit){b.textContent='嚴重';b.className='badge badge-critical';m.textContent='🔴 嚴重異常，請立即通知主管！';m.className='validation-msg error';showNotify('🔴 嚴重異常！請立即通知主管！','critical')}
  else{b.textContent='不合格';b.className='badge badge-fail';m.textContent='⚠️ 請通知班長確認';m.className='validation-msg warn'}
}
function validateDual(id) {
  const field=STATION_FIELDS[AppState.station].find(f=>f.id===id), b=document.getElementById('badge-'+id), m=document.getElementById('msg-'+id);
  let issues=[];
  field.sub.forEach(s=>{const v=parseInt(document.getElementById(s.id).value);if(isNaN(v))return;if(s.target!==undefined){if(v<s.target-(s.tolerance||0)||v>s.target+(s.tolerance||0))issues.push(`${s.label} ${v}（標準${s.target}）`)}else if(s.min!==undefined){if(v<s.min||v>s.max)issues.push(`${s.label} ${v}（標準${s.min}~${s.max}）`)}});
  if(!field.sub.some(s=>document.getElementById(s.id).value)){b.textContent='';m.textContent='';return}
  if(!issues.length){b.textContent='合格';b.className='badge badge-pass';m.textContent=''}
  else{b.textContent='不合格';b.className='badge badge-fail';m.textContent=`⚠️ ${issues.join('、')}`;m.className='validation-msg warn'}
}
function toggleDefect(el) {
  el.classList.toggle('active');
  const a=document.querySelectorAll('.defect-btn.active');
  if(a.length) showNotify(`🔴 不良：${Array.from(a).map(b=>b.dataset.defect).join('、')}，請通知主管！`,'critical');
}
function revalidateAll() {
  STATION_FIELDS[AppState.station].forEach(f=>{
    if(f.type==='number')validateNum(f.id,f.min,f.max,f.unit);
    else if(f.type==='time')validateTime(f.id,f.minSec,f.maxSec);
    else if(f.type==='select')validateSel(f.id,f.expected,f.critical||'');
    else if(f.type==='dual')validateDual(f.id);
  });
}
function clearFormFields() {
  document.querySelectorAll('#stationForm input[type="number"]').forEach(e=>e.value='');
  document.querySelectorAll('#stationForm select').forEach(e=>e.selectedIndex=0);
  document.querySelectorAll('#stationForm .badge').forEach(b=>{b.textContent='';b.className='badge'});
  document.querySelectorAll('#stationForm .validation-msg').forEach(m=>m.textContent='');
  document.querySelectorAll('.defect-btn').forEach(b=>b.classList.remove('active'));
  const notes=document.getElementById('stationNotes'); if(notes)notes.value='';
}

// ========== SUBMIT （v2.1：支援多層批量寫入） ==========
async function submitStation() {
  if(!AppState.selectedLayers.length){showNotify('請先選擇批次/層','warn');return}
  if(!AppState.operator){showNotify('請先選擇操作人員','warn');return}
  // D1：勾 2 層以上先彈確認窗
  if (AppState.selectedLayers.length >= 2) {
    const list = AppState.selectedLayers.join('、');
    const body = `<p>將寫入 <b>${AppState.selectedLayers.length}</b> 筆記錄：</p><p style="font-size:14px;color:#666">${list}</p>`;
    const ok = await showConfirm(`確認寫入 ${AppState.station}站`, body, '確認送出', '取消');
    if (!ok) return;
  }
  const fields=STATION_FIELDS[AppState.station], data={};
  let pass=0,fail=0,crit=0;
  fields.forEach(f=>{
    if(f.type==='number')data[f.id]=document.getElementById(f.id).value;
    else if(f.type==='time'){data[f.id+'_m']=document.getElementById(f.id+'_m').value;data[f.id+'_s']=document.getElementById(f.id+'_s').value}
    else if(f.type==='select')data[f.id]=document.getElementById(f.id).value;
    else if(f.type==='dual')f.sub.forEach(s=>data[s.id]=document.getElementById(s.id).value);
  });
  document.querySelectorAll('#stationForm .badge').forEach(b=>{if(b.textContent==='合格')pass++;else if(b.textContent==='不合格')fail++;else if(b.textContent==='嚴重')crit++});
  const defects=Array.from(document.querySelectorAll('.defect-btn.active')).map(b=>b.dataset.defect);
  const notes=document.getElementById('stationNotes').value;
  const timestamp=new Date().toISOString();
  const wo=getWorkOrder();

  const records=getRecords();
  const writtenLayers=[];
  AppState.selectedLayers.forEach(batchId_ => {
    const L = wo.find(w => w.batch === batchId_);
    const record = {
      date: dateStr, timestamp,
      operator: AppState.operator,
      station: AppState.station,
      batch: batchId_,
      batchNum: L?.batchNum || parseBatchId(batchId_).batchNum,
      layer: L?.layer || parseBatchId(batchId_).layer,
      product: L?.product || '重乳',
      flavor: L?.flavor || '',
      // D3：頂層 defects 雙寫，過渡期保留，讀取端已改走 summary.defects；移除排 Phase 5 重構
      data, defects, notes,
      summary: { passCount:pass, failCount:fail, criticalCount:crit, defects }
    };
    const idx = records.findIndex(r => r.batch===batchId_ && r.station===AppState.station && r.date===dateStr);
    if (idx >= 0) records[idx] = record; else records.push(record);
    writtenLayers.push(batchId_);
  });
  saveRecords(records);

  const isCrit=crit>0||defects.length>0;
  const count=writtenLayers.length;
  document.getElementById('modalTitle').textContent=isCrit?'🔴 已記錄 — 請通知主管':fail>0?'🟡 已記錄 — 有異常項目':'✅ 已記錄 — 全部合格';
  let h=`<div class="summary-item"><span>操作人員</span><span>${AppState.operator}</span></div>
    <div class="summary-item"><span>工作站</span><span>${AppState.station}站</span></div>
    <div class="summary-item"><span>寫入層數</span><span>${count} 筆</span></div>
    <div class="summary-item"><span>層清單</span><span style="font-size:12px">${writtenLayers.join('、')}</span></div>
    <div class="summary-item"><span>合格</span><span style="color:#27AE60;font-weight:700">${pass} 項</span></div>`;
  if(fail)h+=`<div class="summary-item"><span>異常</span><span style="color:#E67E22;font-weight:700">${fail} 項</span></div>`;
  if(crit)h+=`<div class="summary-item"><span>嚴重</span><span style="color:#E74C3C;font-weight:700">${crit} 項</span></div>`;
  if(defects.length)h+=`<div class="summary-item"><span>外觀不良</span><span style="color:#E74C3C;font-weight:700">${defects.join('、')}</span></div>`;
  document.getElementById('modalContent').innerHTML=h;
  document.getElementById('resultModal').classList.add('show');
  if (getCloudUrl()) syncToCloud();
}

function closeModal() {
  document.getElementById('resultModal').classList.remove('show');
  clearFormFields();
  AppState.batch=''; AppState.selectedLayers=[];
  renderBatchGrid();
  document.getElementById('notesSection').style.display='none';
  document.getElementById('submitArea').style.display='none';
}

// ========== DASHBOARD ==========
function dashDateShift(delta) {
  AppState.dashDate.setDate(AppState.dashDate.getDate() + delta);
  renderDashboard();
}

// v2.1: 看板粒度為 layer。每列一層，5 站欄位，同批次連續顯示，輪次分隔。
function renderDashboard() {
  const viewDateStr = fmtDate(AppState.dashDate);
  const isToday = viewDateStr === dateStr;
  document.getElementById('dashDateLabel').textContent = viewDateStr + (isToday ? ' (今日)' : '');

  const records = getRecords().filter(r => r.date === viewDateStr);
  let wo = getWorkOrder(viewDateStr);
  const sNames = ['均質','蛋白霜','整面','烤箱','品判'];
  const totalLayers = wo.length;
  let completedLayers = 0, abnormalStations = 0;

  wo.forEach(L => {
    const rs = records.filter(r => r.batch === L.batch);
    if (rs.length === sNames.length) completedLayers++;
    rs.forEach(r => { if (r.summary.failCount > 0 || r.summary.criticalCount > 0 || (r.summary.defects && r.summary.defects.length > 0)) abnormalStations++ });
  });

  document.getElementById('dashSummary').innerHTML = `
    <div class="summary-card"><div class="num" style="color:var(--brand)">${totalLayers}</div><div class="label">${isToday?'今日':'當日'}層數</div></div>
    <div class="summary-card"><div class="num" style="color:#27AE60">${completedLayers}</div><div class="label">完整記錄</div></div>
    <div class="summary-card"><div class="num" style="color:${abnormalStations?'var(--red)':'#27AE60'}">${abnormalStations}</div><div class="label">異常站次</div></div>`;

  let t = `<tr><th>批次-層</th><th>品項/口味</th>`;
  sNames.forEach(s => t += `<th>${s.charAt(0)}</th>`);
  t += `</tr>`;

  let lastRound = 0, lastBatchNum = 0;
  wo.forEach(L => {
    const r = roundOf(L.batchNum);
    if (r !== lastRound) {
      t += `<tr style="background:#e8e8e8"><td colspan="${sNames.length+2}" style="font-weight:700;text-align:left;padding:6px 8px;font-size:12px">第 ${r} 輪</td></tr>`;
      lastRound = r; lastBatchNum = 0;
    }
    const firstOfBatch = L.batchNum !== lastBatchNum;
    lastBatchNum = L.batchNum;
    const batchLabelStyle = firstOfBatch ? 'font-weight:700' : 'font-weight:700;color:#999';
    t += `<tr><td style="${batchLabelStyle}">${L.batch}</td><td style="font-size:11px">${L.product || '重乳'}｜${L.flavor}</td>`;
    sNames.forEach(s => {
      const rec = records.find(x => x.batch === L.batch && x.station === s);
      if (!rec) { t += `<td><div class="station-cell"><span class="status-dot dot-gray"></span></div></td>` }
      else {
        let dotClass = 'dot-green';
        if (rec.summary.criticalCount > 0 || (rec.summary.defects && rec.summary.defects.length > 0)) dotClass = 'dot-red';
        else if (rec.summary.failCount > 0) dotClass = 'dot-yellow';
        const shortName = (rec.operator||'').replace(/師傅$/, '').slice(-2);
        t += `<td><div class="station-cell"><span class="status-dot ${dotClass}"></span><span class="op-name">${shortName}</span></div></td>`;
      }
    });
    t += `</tr>`;
  });

  if (wo.length === 0) {
    t += `<tr><td colspan="${sNames.length+2}" style="padding:24px;color:#999">此日期無工單或記錄資料</td></tr>`;
  }
  document.getElementById('dashTable').innerHTML = t;
}

// ========== ANALYTICS ==========
function initAnalytics() {
  const dates = getAllRecordDates();
  const toEl = document.getElementById('analyticsTo');
  const fromEl = document.getElementById('analyticsFrom');

  toEl.value = toInputDate(dateStr);
  if (dates.length > 0) {
    // Default: last 7 days or earliest record
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    const earliest = parseDate(dates[0]);
    fromEl.value = toInputDate(fmtDate(weekAgo > earliest ? weekAgo : earliest));
  } else {
    fromEl.value = toInputDate(dateStr);
  }
  renderAnalytics();
}

async function renderAnalytics() {
  const fromStr = fromInputDate(document.getElementById('analyticsFrom').value);
  const toStr = fromInputDate(document.getElementById('analyticsTo').value);
  const fromD = parseDate(fromStr), toD = parseDate(toStr);
  toD.setHours(23, 59, 59);

  const container = document.getElementById('analyticsContent');
  container.innerHTML = '<div style="text-align:center;padding:40px;color:#888">載入中...</div>';

  // 優先從雲端拉取資料
  let allRecords;
  const cloudRecords = await pullFromCloud(fromStr, toStr);
  if (cloudRecords && cloudRecords.length > 0) {
    allRecords = cloudRecords;
  } else {
    allRecords = getRecords().filter(r => {
      const d = parseDate(r.date);
      return d >= fromD && d <= toD;
    });
  }

  if (allRecords.length === 0) {
    container.innerHTML = `<div class="card" style="text-align:center;padding:40px;color:#999">
      <div style="font-size:40px;margin-bottom:12px">📭</div>
      此期間尚無記錄資料<br><small>請先在各工作站填寫生產監測資料</small></div>`;
    return;
  }

  const sNames = ['均質','蛋白霜','整面','烤箱','品判'];
  const uniqueDates = [...new Set(allRecords.map(r => r.date))].sort();
  const totalRecords = allRecords.length;
  let totalPass = 0, totalFail = 0, totalCrit = 0;
  allRecords.forEach(r => {
    totalPass += r.summary.passCount || 0;
    totalFail += r.summary.failCount || 0;
    totalCrit += r.summary.criticalCount || 0;
    if (r.summary.defects && r.summary.defects.length > 0) totalCrit++;
  });
  const totalChecks = totalPass + totalFail + totalCrit;
  const overallPassRate = totalChecks > 0 ? (totalPass / totalChecks * 100) : 0;

  let html = '';

  // Summary cards
  html += `<div class="card"><div class="card-title">📋 概覽（${fromStr} ~ ${toStr}）</div>
    <div class="stat-grid" style="padding:0 16px 16px">
      <div class="stat-card"><div class="stat-num" style="color:var(--brand)">${uniqueDates.length}</div><div class="stat-label">記錄天數</div></div>
      <div class="stat-card"><div class="stat-num" style="color:var(--blue)">${totalRecords}</div><div class="stat-label">記錄筆數</div></div>
      <div class="stat-card"><div class="stat-num" style="color:${overallPassRate>=90?'#27AE60':overallPassRate>=70?'var(--yellow)':'var(--red)'}">${overallPassRate.toFixed(1)}%</div><div class="stat-label">整體良率</div></div>
      <div class="stat-card"><div class="stat-num" style="color:${totalCrit?'var(--red)':'#27AE60'}">${totalCrit}</div><div class="stat-label">嚴重異常</div></div>
    </div></div>`;

  // Pass rate by station
  html += `<div class="card"><div class="card-title">🏭 各站良率</div><div style="padding:0 16px 16px"><div class="bar-chart">`;
  sNames.forEach(s => {
    const stationRecs = allRecords.filter(r => r.station === s);
    let sp = 0, sf = 0, sc = 0;
    stationRecs.forEach(r => { sp += r.summary.passCount||0; sf += r.summary.failCount||0; sc += r.summary.criticalCount||0; if(r.summary.defects&&r.summary.defects.length>0)sc++; });
    const total = sp + sf + sc;
    const rate = total > 0 ? (sp / total * 100) : 0;
    const cls = rate >= 90 ? 'good' : rate >= 70 ? 'warn' : 'bad';
    html += `<div class="bar-row"><span class="bar-label">${s}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${Math.max(rate,3)}%"><span class="bar-value">${rate.toFixed(0)}%</span></div></div><span class="bar-value-outside">${stationRecs.length}筆</span></div>`;
  });
  html += `</div></div></div>`;

  // Pass rate by operator
  const operators = [...new Set(allRecords.map(r => r.operator))];
  if (operators.length > 0) {
    html += `<div class="card"><div class="card-title">👥 人員良率</div><div style="padding:0 16px 16px"><div class="bar-chart">`;
    operators.forEach(op => {
      const opRecs = allRecords.filter(r => r.operator === op);
      let sp = 0, sf = 0, sc = 0;
      opRecs.forEach(r => { sp += r.summary.passCount||0; sf += r.summary.failCount||0; sc += r.summary.criticalCount||0; if(r.summary.defects&&r.summary.defects.length>0)sc++; });
      const total = sp + sf + sc;
      const rate = total > 0 ? (sp / total * 100) : 0;
      const cls = rate >= 90 ? 'good' : rate >= 70 ? 'warn' : 'bad';
      const shortName = op.replace(/師傅$/, '');
      html += `<div class="bar-row"><span class="bar-label">${shortName}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${Math.max(rate,3)}%"><span class="bar-value">${rate.toFixed(0)}%</span></div></div><span class="bar-value-outside">${opRecs.length}筆</span></div>`;
    });
    html += `</div></div></div>`;
  }

  // Pass rate by flavor
  const flavors = [...new Set(allRecords.map(r => r.flavor).filter(Boolean))];
  if (flavors.length > 0) {
    html += `<div class="card"><div class="card-title">🧀 口味別良率</div><div style="padding:0 16px 16px"><div class="bar-chart">`;
    flavors.forEach(fl => {
      const flRecs = allRecords.filter(r => r.flavor === fl);
      let sp = 0, sf = 0, sc = 0;
      flRecs.forEach(r => { sp += r.summary.passCount||0; sf += r.summary.failCount||0; sc += r.summary.criticalCount||0; if(r.summary.defects&&r.summary.defects.length>0)sc++; });
      const total = sp + sf + sc;
      const rate = total > 0 ? (sp / total * 100) : 0;
      const cls = rate >= 90 ? 'good' : rate >= 70 ? 'warn' : 'bad';
      html += `<div class="bar-row"><span class="bar-label">${fl}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${Math.max(rate,3)}%"><span class="bar-value">${rate.toFixed(0)}%</span></div></div><span class="bar-value-outside">${flRecs.length}筆</span></div>`;
    });
    html += `</div></div></div>`;
  }

  // Cross analysis: operator × station
  if (operators.length > 1 && allRecords.length > 5) {
    html += `<div class="card"><div class="card-title">📊 人員 × 工作站 交叉分析</div>
      <div style="padding:0 12px 16px;overflow-x:auto"><table class="detail-table"><tr><th>人員</th>`;
    sNames.forEach(s => html += `<th>${s}</th>`);
    html += `<th>總計</th></tr>`;
    operators.forEach(op => {
      const shortName = op.replace(/師傅$/, '');
      html += `<tr><td style="font-weight:700">${shortName}</td>`;
      let opTotal = 0, opPass = 0;
      sNames.forEach(s => {
        const recs = allRecords.filter(r => r.operator === op && r.station === s);
        let sp = 0, st = 0;
        recs.forEach(r => { sp += r.summary.passCount||0; st += (r.summary.passCount||0) + (r.summary.failCount||0) + (r.summary.criticalCount||0) + ((r.summary.defects&&r.summary.defects.length>0)?1:0); });
        opTotal += st; opPass += sp;
        const rate = st > 0 ? (sp / st * 100) : -1;
        if (rate < 0) html += `<td style="color:#ccc">-</td>`;
        else html += `<td style="color:${rate>=90?'#27AE60':rate>=70?'#E67E22':'#E74C3C'};font-weight:700">${rate.toFixed(0)}%</td>`;
      });
      const totalRate = opTotal > 0 ? (opPass / opTotal * 100) : 0;
      html += `<td style="font-weight:700">${totalRate.toFixed(0)}%</td></tr>`;
    });
    html += `</table></div></div>`;
  }

  // Cross analysis: flavor × station
  if (flavors.length > 1 && allRecords.length > 5) {
    html += `<div class="card"><div class="card-title">🧀 口味 × 工作站 交叉分析</div>
      <div style="padding:0 12px 16px;overflow-x:auto"><table class="detail-table"><tr><th>口味</th>`;
    sNames.forEach(s => html += `<th>${s}</th>`);
    html += `<th>總計</th></tr>`;
    flavors.forEach(fl => {
      html += `<tr><td style="font-weight:700">${fl}</td>`;
      let flTotal = 0, flPass = 0;
      sNames.forEach(s => {
        const recs = allRecords.filter(r => r.flavor === fl && r.station === s);
        let sp = 0, st = 0;
        recs.forEach(r => { sp += r.summary.passCount||0; st += (r.summary.passCount||0) + (r.summary.failCount||0) + (r.summary.criticalCount||0) + ((r.summary.defects&&r.summary.defects.length>0)?1:0); });
        flTotal += st; flPass += sp;
        const rate = st > 0 ? (sp / st * 100) : -1;
        if (rate < 0) html += `<td style="color:#ccc">-</td>`;
        else html += `<td style="color:${rate>=90?'#27AE60':rate>=70?'#E67E22':'#E74C3C'};font-weight:700">${rate.toFixed(0)}%</td>`;
      });
      const totalRate = flTotal > 0 ? (flPass / flTotal * 100) : 0;
      html += `<td style="font-weight:700">${totalRate.toFixed(0)}%</td></tr>`;
    });
    html += `</table></div></div>`;
  }

  // Daily trend
  if (uniqueDates.length > 1) {
    html += `<div class="card"><div class="card-title">📅 每日良率趨勢</div><div style="padding:0 16px 16px"><div class="bar-chart">`;
    uniqueDates.forEach(d => {
      const dayRecs = allRecords.filter(r => r.date === d);
      let sp = 0, st = 0;
      dayRecs.forEach(r => { sp += r.summary.passCount||0; st += (r.summary.passCount||0) + (r.summary.failCount||0) + (r.summary.criticalCount||0) + ((r.summary.defects&&r.summary.defects.length>0)?1:0); });
      const rate = st > 0 ? (sp / st * 100) : 0;
      const cls = rate >= 90 ? 'good' : rate >= 70 ? 'warn' : 'bad';
      const shortDate = d.slice(5); // MM/DD
      html += `<div class="bar-row"><span class="bar-label">${shortDate}</span><div class="bar-track"><div class="bar-fill ${cls}" style="width:${Math.max(rate,3)}%"><span class="bar-value">${rate.toFixed(0)}%</span></div></div><span class="bar-value-outside">${dayRecs.length}筆</span></div>`;
    });
    html += `</div></div></div>`;
  }

  // Anomaly detail list
  const anomalies = allRecords.filter(r => r.summary.failCount > 0 || r.summary.criticalCount > 0 || (r.summary.defects && r.summary.defects.length > 0));
  if (anomalies.length > 0) {
    html += `<div class="card"><div class="card-title">⚠️ 異常明細（共 ${anomalies.length} 筆）</div>
      <div style="padding:0 12px 16px;overflow-x:auto"><table class="detail-table">
      <tr><th>日期</th><th>批次</th><th>口味</th><th>站</th><th>人員</th><th>狀態</th></tr>`;
    anomalies.slice(0, 50).forEach(r => {
      const shortName = r.operator.replace(/師傅$/, '').slice(-2);
      const isCrit = r.summary.criticalCount > 0 || (r.summary.defects && r.summary.defects.length > 0);
      const status = isCrit ? `<span style="color:var(--red)">🔴 嚴重</span>` : `<span style="color:#E67E22">🟡 異常</span>`;
      const detail = [];
      if (r.summary.defects && r.summary.defects.length) detail.push(r.summary.defects.join('、'));
      if (r.notes) detail.push(r.notes);
      html += `<tr><td>${r.date.slice(5)}</td><td>${r.batch}</td><td>${r.flavor||''}</td><td>${r.station}</td><td>${shortName}</td><td>${status}</td></tr>`;
      if (detail.length) html += `<tr><td colspan="6" style="color:#888;font-size:11px;padding:2px 6px 6px">↳ ${detail.join('；')}</td></tr>`;
    });
    if (anomalies.length > 50) html += `<tr><td colspan="6" style="color:#999;text-align:center">...還有 ${anomalies.length-50} 筆</td></tr>`;
    html += `</table></div></div>`;
  }

  container.innerHTML = html;
}

// ========== ADMIN ==========
function renderAdmin() {
  const base = location.href.split('#')[0];
  const links = document.getElementById('stationLinks');
  links.innerHTML = [
    {hash:'均質',label:'🥣 均質站',desc:'張貼在均質工位旁'},
    {hash:'蛋白霜',label:'☁️ 蛋白霜站',desc:'張貼在打蛋白工位旁'},
    {hash:'整面',label:'🍰 整面站',desc:'張貼在整面工位旁'},
    {hash:'烤箱',label:'🔥 烤箱站',desc:'張貼在烤箱旁'},
    {hash:'品判',label:'👨‍🍳 出爐品判',desc:'主廚使用'},
    {hash:'看板',label:'📊 當日看板',desc:'班長/主管/會報'},
    {hash:'分析',label:'📈 數據分析',desc:'良率統計與趨勢'},
  ].map(s=>`<li><a href="#${s.hash}">${s.label}<span style="font-weight:400;font-size:12px;color:var(--gray-dark);margin-left:8px">${s.desc}</span></a></li>`).join('');

  document.getElementById('opListInput').value = getOperators().join('\n');

  // Cloud URL
  const cloudUrl = getCloudUrl();
  document.getElementById('cloudUrlInput').value = cloudUrl;
  if (cloudUrl) {
    document.getElementById('cloudStatus').textContent = '✅ 已連接';
    document.getElementById('cloudStatus').style.color = '#27AE60';
  }

  // v2.1: Sheet URL
  const sheetUrl = Storage.getSheetUrl();
  document.getElementById('sheetUrlInput').value = sheetUrl;
  const sheetStatus = document.getElementById('sheetStatus');
  if (sheetUrl) {
    sheetStatus.textContent = '✅ 已綁定';
    sheetStatus.style.color = '#27AE60';
    renderWorkOrderPreview(getWorkOrder());
  } else {
    sheetStatus.textContent = '尚未綁定 Sheet';
    sheetStatus.style.color = '#888';
  }
}

// v2.1: Google Sheet 工單綁定與拉取 -----------------------------------------

// 解析任意 Google Sheet URL → CSV export URL
function sheetUrlToCsv(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) return null;
  const id = m[1];
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : '0';
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

// 極簡 CSV parser（處理引號與逗號，不處理跨行引號）
function parseCsvLine(line) {
  const out = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i+1] === '"') { cur += '"'; i++; }
      else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out.map(s => s.trim());
}

// 解析 CSV 為 layers[]
function parseWorkOrderCsv(csv) {
  const lines = csv.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('Sheet 沒有資料');
  const layers = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const batchNum = parseInt(cols[0]);
    const layer = parseInt(cols[1]);
    const product = (cols[2] || '重乳').trim();
    const flavor = (cols[3] || '').trim();
    const notes = (cols[4] || '').trim();
    if (!batchNum || !layer) continue;
    layers.push({
      batch: batchId(batchNum, layer),
      batchNum, layer, product, flavor, notes
    });
  }
  layers.sort((a,b) => a.batchNum - b.batchNum || a.layer - b.layer);
  return layers;
}

// 拉取今日工單（1 小時快取）
async function fetchTodayWorkOrder(force) {
  const url = Storage.getSheetUrl();
  if (!url) return null;
  const cached = Storage.getWorkOrderRaw();
  const ONE_HOUR = 60 * 60 * 1000;
  if (!force && cached && cached.date === dateStr && cached.fetchedAt
      && (Date.now() - new Date(cached.fetchedAt).getTime() < ONE_HOUR)) {
    return cached.layers;
  }
  const csvUrl = sheetUrlToCsv(url);
  if (!csvUrl) throw new Error('URL 格式無效');
  const resp = await fetch(csvUrl);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}（Sheet 是否已設為公開？）`);
  const csv = await resp.text();
  const layers = parseWorkOrderCsv(csv);
  const wo = { date: dateStr, sourceUrl: url, fetchedAt: new Date().toISOString(), layers };
  Storage.setWorkOrder(wo);
  return layers;
}

async function saveSheetUrl() {
  const url = document.getElementById('sheetUrlInput').value.trim();
  if (!url) { showNotify('請貼上 Sheet 網址', 'warn'); return; }
  if (!sheetUrlToCsv(url)) { showNotify('URL 格式錯誤', 'warn'); return; }
  Storage.setSheetUrl(url);
  document.getElementById('sheetStatus').textContent = '拉取中...';
  try {
    const layers = await fetchTodayWorkOrder(true);
    document.getElementById('sheetStatus').style.color = '#27AE60';
    document.getElementById('sheetStatus').textContent = `✅ 已拉取 ${layers.length} 層`;
    renderWorkOrderPreview(layers);
    showNotify(`✅ 工單已拉取（${layers.length} 層）`, 'success');
  } catch (err) {
    document.getElementById('sheetStatus').style.color = 'var(--red)';
    document.getElementById('sheetStatus').textContent = '❌ ' + err.message;
  }
}

async function refreshWorkOrder() {
  if (!Storage.getSheetUrl()) { showNotify('尚未綁定 Sheet', 'warn'); return; }
  document.getElementById('sheetStatus').textContent = '重新拉取中...';
  try {
    const layers = await fetchTodayWorkOrder(true);
    document.getElementById('sheetStatus').style.color = '#27AE60';
    document.getElementById('sheetStatus').textContent = `✅ 已更新 ${layers.length} 層`;
    renderWorkOrderPreview(layers);
    showNotify('✅ 工單已更新', 'success');
  } catch (err) {
    document.getElementById('sheetStatus').style.color = 'var(--red)';
    document.getElementById('sheetStatus').textContent = '❌ ' + err.message;
  }
}

function disconnectSheet() {
  Storage.clearSheetUrl();
  document.getElementById('sheetUrlInput').value = '';
  document.getElementById('sheetStatus').textContent = '已解除綁定';
  document.getElementById('workOrderPreview').innerHTML = '';
  showNotify('已解除 Sheet 綁定', 'success');
}

function renderWorkOrderPreview(layers) {
  const el = document.getElementById('workOrderPreview');
  if (!layers || !layers.length) { el.innerHTML = ''; return; }
  // D4：product 欄改為下拉，目前僅「重乳」，為 V3 多品項預留位置
  const rows = layers.map((l, i) => `<tr><td>${l.batch}</td><td><select data-idx="${i}"><option value="重乳"${(l.product||'重乳')==='重乳'?' selected':''}>重乳</option></select></td><td>${l.flavor}</td></tr>`).join('');
  el.innerHTML = `<table class="detail-table"><thead><tr><th>批次-層</th><th>品項（v2.1 預留多品項，目前僅「重乳」）</th><th>口味</th></tr></thead><tbody>${rows}</tbody></table>`;
  el.querySelectorAll('select[data-idx]').forEach(sel => {
    sel.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.idx);
      const wo = Storage.getWorkOrderRaw();
      if (!wo || !wo.layers || !wo.layers[idx]) return;
      wo.layers[idx].product = e.target.value || '重乳';
      Storage.setWorkOrder(wo);
    });
  });
}

function saveOperators() {
  const ops = document.getElementById('opListInput').value.trim().split('\n').map(s=>s.trim()).filter(Boolean);
  if(!ops.length){showNotify('請至少輸入一位','warn');return}
  Storage.setOperators(ops);
  showNotify(`✅ 已儲存 ${ops.length} 位人員`,'success');
}

// ========== EXPORT ==========
function exportData() {
  const viewDateStr = fmtDate(AppState.dashDate);
  const records = getRecords().filter(r => r.date === viewDateStr);
  if(!records.length){showNotify('此日期尚無記錄','warn');return}
  downloadCSV(records, `生產監測_${viewDateStr.replace(/\//g,'')}.csv`);
}

function exportAllData() {
  const records = getRecords();
  if(!records.length){showNotify('尚無任何記錄','warn');return}
  downloadCSV(records, `生產監測_全部_${dateStr.replace(/\//g,'')}.csv`);
}

function downloadCSV(records, filename) {
  let csv = '\uFEFF日期,時間,操作人員,工作站,批次,口味,合格數,異常數,嚴重數,外觀不良,備註,原始數據\n';
  records.forEach(r => {
    csv += `${r.date},${r.timestamp},${r.operator},${r.station},${r.batch},${r.flavor||''},`;
    csv += `${r.summary.passCount},${r.summary.failCount},${r.summary.criticalCount},`;
    csv += `"${(r.summary.defects||[]).join('、')}","${r.notes||''}","${JSON.stringify(r.data).replace(/"/g,'""')}"\n`;
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
  a.download = filename;
  a.click();
  showNotify('✅ CSV 已下載','success');
}

// ========== NOTIFY ==========
function showNotify(text,type) {
  const b=document.getElementById('notifyBanner');
  b.textContent=text;b.className=`notify-banner ${type}`;b.style.display='block';
  setTimeout(()=>b.style.display='none',4000);
}

// ========== CONFIRM MODAL（可重用，供多層送出 / 重新拉工單差異等 flow 使用） ==========
let _confirmInFlight = null;
function showConfirm(title, bodyHtml, okLabel, cancelLabel) {
  okLabel = okLabel || '確認';
  cancelLabel = cancelLabel || '取消';
  // 若有前一個未決的 confirm，先自動 resolve(false)
  if (_confirmInFlight) { try { _confirmInFlight(false); } catch(e){} _confirmInFlight = null; }
  const overlay = document.getElementById('confirmModal');
  const titleEl = document.getElementById('confirmTitle');
  const contentEl = document.getElementById('confirmContent');
  const okBtn = document.getElementById('confirmOkBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');
  titleEl.textContent = title || '';
  contentEl.innerHTML = bodyHtml || '';
  okBtn.textContent = okLabel;
  cancelBtn.textContent = cancelLabel;
  overlay.classList.add('show');
  return new Promise(resolve => {
    const cleanup = (val) => {
      overlay.classList.remove('show');
      okBtn.removeEventListener('click', onOk);
      cancelBtn.removeEventListener('click', onCancel);
      _confirmInFlight = null;
      resolve(val);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    _confirmInFlight = cleanup;
  });
}

// ========== CLOUD SYNC ==========
function getCloudUrl() { return Storage.getCloudUrl(); }

function updateSyncUI(state, text) {
  const bar = document.getElementById('syncBar');
  const dot = document.getElementById('syncDot');
  const txt = document.getElementById('syncText');
  if (!bar) return;
  bar.className = 'sync-bar ' + state;
  dot.className = 'sync-dot ' + (state === 'online' ? 'on' : state === 'syncing' ? 'spin' : 'off');
  txt.textContent = text;
}

async function cloudFetch(method, url, body) {
  const opts = { method, redirect: 'follow' };
  if (method === 'POST') {
    opts.headers = { 'Content-Type': 'text/plain' };
    opts.body = JSON.stringify(body);
  }
  const resp = await fetch(url, opts);
  return resp.json();
}

async function saveCloudUrl() {
  const url = document.getElementById('cloudUrlInput').value.trim();
  if (!url) { showNotify('請輸入 URL','warn'); return; }
  const statusEl = document.getElementById('cloudStatus');
  statusEl.textContent = '測試連線中...';
  statusEl.style.color = '#2E86C1';
  try {
    const result = await cloudFetch('POST', url, { action: 'init' });
    if (result.status === 'ok') {
      Storage.setCloudUrl(url);
      statusEl.textContent = '✅ 連線成功！資料將自動同步到 Google Sheets。';
      statusEl.style.color = '#27AE60';
      updateSyncUI('online', '已連接雲端');
      showNotify('✅ 雲端連線成功','success');
      // 立即進行首次同步
      syncToCloud();
    } else {
      statusEl.textContent = '❌ 連線失敗：' + (result.message || '未知錯誤');
      statusEl.style.color = 'var(--red)';
    }
  } catch (err) {
    statusEl.textContent = '❌ 無法連線：' + err.message;
    statusEl.style.color = 'var(--red)';
  }
}

function disconnectCloud() {
  Storage.clearCloudUrl();
  document.getElementById('cloudUrlInput').value = '';
  document.getElementById('cloudStatus').textContent = '已斷開雲端連線';
  updateSyncUI('offline', '未連接雲端');
  showNotify('已斷開雲端','success');
}

async function syncToCloud() {
  const url = getCloudUrl();
  if (!url) return;
  updateSyncUI('syncing', '同步中...');
  try {
    // 上傳本地記錄
    const records = getRecords();
    if (records.length > 0) {
      await cloudFetch('POST', url, { action: 'syncRecords', records });
    }
    // 上傳今日工單
    const wo = getWorkOrder();
    if (wo.length > 0) {
      await cloudFetch('POST', url, { action: 'saveWorkOrder', date: dateStr, batches: wo });
    }
    // 上傳人員名單
    const ops = getOperators();
    await cloudFetch('POST', url, { action: 'saveOperators', operators: ops });

    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
    updateSyncUI('online', `已同步 ${timeStr}`);
  } catch (err) {
    updateSyncUI('error', '同步失敗');
    console.error('Sync error:', err);
  }
}

async function pullFromCloud(from, to) {
  const url = getCloudUrl();
  if (!url) return null;
  try {
    const result = await cloudFetch('GET', `${url}?action=getRecords&from=${from}&to=${to}`, null);
    if (result.status === 'ok') return result.records;
  } catch (err) { console.error('Pull error:', err); }
  return null;
}

function manualSync() {
  const url = getCloudUrl();
  if (!url) {
    location.hash = '#管理';
    showNotify('請先設定 Google Sheets 雲端連線','warn');
    return;
  }
  syncToCloud();
}

function initCloudStatus() {
  const url = getCloudUrl();
  if (url) {
    updateSyncUI('online', '已連接雲端');
    // 頁面載入時自動同步一次
    syncToCloud();
  }
}

// ========== HELPERS（替代原本 onclick 內聯邏輯） ==========
function clearTodayRecords() {
  if (!confirm('確定清除今日所有記錄？此操作無法復原。')) return;
  saveRecords(getRecords().filter(x => x.date !== dateStr));
  showNotify('已清除今日記錄', 'success');
}
// ========== EVENT DELEGATION ==========
function bindDelegatedEvents() {
  // click：批次/人員/不良點選 + 通用 data-action
  document.addEventListener('click', (e) => {
    const op = e.target.closest('.operator-btn');
    if (op && op.dataset.opName) { selectOp(op.dataset.opName, op); return; }
    const bt = e.target.closest('.batch-btn');
    if (bt && bt.dataset.batchId) { selectBatch(bt.dataset.batchId); return; }
    const df = e.target.closest('.defect-btn');
    if (df) { toggleDefect(df); return; }
    const ac = e.target.closest('[data-action]');
    if (ac) {
      const fn = window[ac.dataset.action];
      if (typeof fn === 'function') {
        const arg = ac.dataset.arg;
        fn(arg !== undefined ? (isNaN(arg) ? arg : Number(arg)) : undefined);
      }
    }
  });

  // 工站表單 input/change：依當前工站的欄位定義分派驗證器
  const form = document.getElementById('stationForm');
  const dispatchValidate = (e) => {
    const id = e.target.id;
    if (!id) return;
    const fields = STATION_FIELDS[AppState.station] || [];
    const baseId = id.replace(/_(m|s)$/, '');
    const field = fields.find(f => f.id === baseId || f.id === id || (f.sub && f.sub.some(s => s.id === id)));
    if (!field) return;
    if (field.type === 'number') validateNum(field.id, field.min, field.max, field.unit);
    else if (field.type === 'time') validateTime(field.id, field.minSec, field.maxSec);
    else if (field.type === 'dual') validateDual(field.id);
    else if (field.type === 'select') validateSel(field.id, field.expected, field.critical || '');
  };
  form.addEventListener('input', dispatchValidate);
  form.addEventListener('change', dispatchValidate);

}

// ========== INIT ==========
bindDelegatedEvents();
route();
initCloudStatus();
