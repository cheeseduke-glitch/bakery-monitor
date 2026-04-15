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

// Default work order (from 0414 CSV)
const DEFAULT_WORK_ORDER = [
  {id:'1-A',round:1,oven:'A',flavor:'天使'},
  {id:'1-B',round:1,oven:'B',flavor:'原味'},
  {id:'1-C',round:1,oven:'C',flavor:'原味'},
  {id:'2-A',round:2,oven:'A',flavor:'楓糖'},
  {id:'2-B',round:2,oven:'B',flavor:'玫荔'},
  {id:'2-C',round:2,oven:'C',flavor:'玫荔'},
  {id:'3-A',round:3,oven:'A',flavor:'原巴'},
];

// ========== STATE ==========
let currentOperator = localStorage.getItem('current_operator') || '';
let currentStation = '';
let currentBatch = '';
let dashViewDate = null; // Date object for dashboard view

function getOperators() {
  const saved = localStorage.getItem('bakery_operators');
  return saved ? JSON.parse(saved) : DEFAULT_OPERATORS;
}
function getWorkOrder(forDate) {
  const targetDate = forDate || dateStr;
  const saved = localStorage.getItem('bakery_workorder');
  if (saved) {
    const parsed = JSON.parse(saved);
    if (parsed.date === targetDate) return parsed.batches;
  }
  if (targetDate === dateStr) return DEFAULT_WORK_ORDER;
  // For historical dates, try to find work order from records
  const records = getRecords().filter(r => r.date === targetDate);
  if (records.length) {
    const batchMap = {};
    records.forEach(r => {
      if (!batchMap[r.batch]) batchMap[r.batch] = { id: r.batch, flavor: r.flavor || '' };
    });
    return Object.values(batchMap).map(b => {
      const parts = b.id.split('-');
      return { id: b.id, round: parseInt(parts[0]) || 1, oven: parts[1] || 'A', flavor: b.flavor };
    }).sort((a,b) => a.round - b.round || a.oven.localeCompare(b.oven));
  }
  return [];
}
function getRecords() { return JSON.parse(localStorage.getItem('bakery_records')||'[]'); }
function saveRecords(r) { localStorage.setItem('bakery_records', JSON.stringify(r)); }

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
    dashViewDate = new Date();
    renderDashboard();
  }
  else if (hash === '分析') {
    document.getElementById('page-analytics').classList.add('active');
    initAnalytics();
  }
  else if (hash === '管理') { document.getElementById('page-admin').classList.add('active'); renderAdmin(); }
  else if (STATION_META[hash]) { currentStation = hash; document.getElementById('page-station').classList.add('active'); renderStation(); }
  else { document.getElementById('page-home').classList.add('active'); }

  document.getElementById('homeDate').textContent = dateStr;
  window.scrollTo(0,0);
}

function goHome() { location.hash = ''; }
window.addEventListener('hashchange', route);

// ========== STATION PAGE ==========
function renderStation() {
  const meta = STATION_META[currentStation];
  const header = document.getElementById('stationHeader');
  header.style.background = meta.headerBg;
  document.getElementById('stationTitle').textContent = `${meta.icon} ${currentStation}站`;
  document.getElementById('stationSub').textContent = dateStr;
  currentBatch = '';

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
    <div class="operator-btn ${currentOperator===name?'selected':''}" onclick="selectOp('${name}',this)">
      <span class="avatar">${AVATARS[i]||'👤'}</span>${name}
    </div>`).join('');
}

function selectOp(name, el) {
  currentOperator = name;
  localStorage.setItem('current_operator', name);
  document.querySelectorAll('.operator-btn').forEach(b => b.classList.remove('selected'));
  if (el) el.classList.add('selected');
  document.getElementById('otherOpInput').value = '';
  updateStationSub();
}
function selectOtherOp() {
  const name = document.getElementById('otherOpInput').value.trim();
  if (!name) { showNotify('請輸入姓名','warn'); return; }
  currentOperator = name;
  localStorage.setItem('current_operator', name);
  document.querySelectorAll('.operator-btn').forEach(b => b.classList.remove('selected'));
  updateStationSub();
  showNotify(`✅ ${name}`,'success');
}
function updateStationSub() {
  document.getElementById('stationSub').textContent = currentOperator ? `${currentOperator}｜${dateStr}` : dateStr;
}

function renderBatchGrid() {
  const wo = getWorkOrder();
  const records = getRecords();
  const grid = document.getElementById('batchGrid');
  let html = ''; let lastRound = 0;
  wo.forEach(batch => {
    if (batch.round !== lastRound) { html += `<div class="round-label">第 ${batch.round} 輪</div>`; lastRound = batch.round; }
    const done = records.some(r => r.batch===batch.id && r.station===currentStation && r.date===dateStr);
    const sel = currentBatch === batch.id;
    html += `<div class="batch-btn ${done?'done':''} ${sel?'selected':''}" onclick="selectBatch('${batch.id}')">
      <div class="batch-label">${batch.id}</div>
      <div class="batch-detail">烤箱${batch.oven}｜${batch.flavor}</div></div>`;
  });
  grid.innerHTML = html;
}

function selectBatch(id) {
  if (!currentOperator) { showNotify('請先選擇操作人員','warn'); return; }
  currentBatch = id;
  renderBatchGrid();
  document.getElementById('notesSection').style.display = 'block';
  document.getElementById('submitArea').style.display = 'flex';
  clearFormFields();
  const rec = getRecords().find(r => r.batch===id && r.station===currentStation && r.date===dateStr);
  if (rec) {
    Object.entries(rec.data||{}).forEach(([k,v]) => { const el=document.getElementById(k); if(el)el.value=v; });
    if (rec.defects) rec.defects.forEach(d => { const b=document.querySelector(`.defect-btn[data-defect="${d}"]`); if(b)b.classList.add('active'); });
    if (rec.notes) document.getElementById('stationNotes').value = rec.notes;
    revalidateAll();
  }
}

function renderFormFields() {
  const fields = STATION_FIELDS[currentStation];
  const meta = STATION_META[currentStation];
  let html = `<div class="card"><div class="card-title" style="background:${meta.bg};color:${meta.color}">${meta.icon} ${currentStation}站監控項目</div>`;
  fields.forEach(f => {
    html += `<div class="field"><div class="field-label">${f.label} <span class="badge" id="badge-${f.id}"></span></div>`;
    if (f.std) html += `<div class="field-standard">標準：<span>${f.std}</span></div>`;
    if (f.type==='number') html += `<div class="input-row"><input type="number" id="${f.id}" placeholder="${f.unit}" step="${f.step}" inputmode="decimal" oninput="validateNum('${f.id}',${f.min},${f.max},'${f.unit}')"><span class="input-unit">${f.unit}</span></div>`;
    else if (f.type==='time') html += `<div class="input-row"><input type="number" id="${f.id}_m" placeholder="分" inputmode="numeric" oninput="validateTime('${f.id}',${f.minSec},${f.maxSec})"><span class="input-unit">分</span><input type="number" id="${f.id}_s" placeholder="秒" inputmode="numeric" oninput="validateTime('${f.id}',${f.minSec},${f.maxSec})"><span class="input-unit">秒</span></div>`;
    else if (f.type==='select') { html += `<select id="${f.id}" onchange="validateSel('${f.id}','${f.expected}','${f.critical||''}')">`; f.options.forEach(o => html+=`<option value="${o.value}">${o.text}</option>`); html += `</select>`; }
    else if (f.type==='dual') { html += `<div class="input-row">`; f.sub.forEach(s => html += `<div style="flex:1"><input type="number" id="${s.id}" placeholder="${s.placeholder}" inputmode="numeric" oninput="validateDual('${f.id}')"><div style="font-size:11px;color:#999;text-align:center;margin-top:2px">${s.label}</div></div>`); html += `</div>`; }
    else if (f.type==='defects') { html += `<div class="defect-grid">`; f.items.forEach(it => html += `<div class="defect-btn" data-defect="${it.value}" onclick="toggleDefect(this)"><span class="icon">${it.icon}</span>${it.text}</div>`); html += `</div>`; }
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
  const field=STATION_FIELDS[currentStation].find(f=>f.id===id), b=document.getElementById('badge-'+id), m=document.getElementById('msg-'+id);
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
  STATION_FIELDS[currentStation].forEach(f=>{
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

// ========== SUBMIT ==========
function submitStation() {
  if(!currentBatch){showNotify('請先選擇批次','warn');return}
  if(!currentOperator){showNotify('請先選擇操作人員','warn');return}
  const fields=STATION_FIELDS[currentStation], data={};
  let pass=0,fail=0,crit=0;
  fields.forEach(f=>{
    if(f.type==='number')data[f.id]=document.getElementById(f.id).value;
    else if(f.type==='time'){data[f.id+'_m']=document.getElementById(f.id+'_m').value;data[f.id+'_s']=document.getElementById(f.id+'_s').value}
    else if(f.type==='select')data[f.id]=document.getElementById(f.id).value;
    else if(f.type==='dual')f.sub.forEach(s=>data[s.id]=document.getElementById(s.id).value);
  });
  document.querySelectorAll('#stationForm .badge').forEach(b=>{if(b.textContent==='合格')pass++;else if(b.textContent==='不合格')fail++;else if(b.textContent==='嚴重')crit++});
  const defects=Array.from(document.querySelectorAll('.defect-btn.active')).map(b=>b.dataset.defect);
  const wo=getWorkOrder().find(w=>w.id===currentBatch);
  const record={date:dateStr,timestamp:new Date().toISOString(),operator:currentOperator,station:currentStation,batch:currentBatch,flavor:wo?wo.flavor:'',data,defects,notes:document.getElementById('stationNotes').value,summary:{passCount:pass,failCount:fail,criticalCount:crit,defects}};
  const records=getRecords();
  const idx=records.findIndex(r=>r.batch===currentBatch&&r.station===currentStation&&r.date===dateStr);
  if(idx>=0)records[idx]=record;else records.push(record);
  saveRecords(records);

  const isCrit=crit>0||defects.length>0;
  document.getElementById('modalTitle').textContent=isCrit?'🔴 已記錄 — 請通知主管':fail>0?'🟡 已記錄 — 有異常項目':'✅ 已記錄 — 全部合格';
  let h=`<div class="summary-item"><span>操作人員</span><span>${currentOperator}</span></div>
    <div class="summary-item"><span>工作站</span><span>${currentStation}站</span></div>
    <div class="summary-item"><span>批次</span><span>${currentBatch}（${wo?wo.flavor:''}）</span></div>
    <div class="summary-item"><span>合格</span><span style="color:#27AE60;font-weight:700">${pass} 項</span></div>`;
  if(fail)h+=`<div class="summary-item"><span>異常</span><span style="color:#E67E22;font-weight:700">${fail} 項</span></div>`;
  if(crit)h+=`<div class="summary-item"><span>嚴重</span><span style="color:#E74C3C;font-weight:700">${crit} 項</span></div>`;
  if(defects.length)h+=`<div class="summary-item"><span>外觀不良</span><span style="color:#E74C3C;font-weight:700">${defects.join('、')}</span></div>`;
  document.getElementById('modalContent').innerHTML=h;
  document.getElementById('resultModal').classList.add('show');
  // 自動同步到雲端
  if (getCloudUrl()) syncToCloud();
}

function closeModal() {
  document.getElementById('resultModal').classList.remove('show');
  clearFormFields(); currentBatch=''; renderBatchGrid();
  document.getElementById('notesSection').style.display='none';
  document.getElementById('submitArea').style.display='none';
}

// ========== DASHBOARD ==========
function dashDateShift(delta) {
  dashViewDate.setDate(dashViewDate.getDate() + delta);
  renderDashboard();
}

function renderDashboard() {
  const viewDateStr = fmtDate(dashViewDate);
  const isToday = viewDateStr === dateStr;
  document.getElementById('dashDateLabel').textContent = viewDateStr + (isToday ? ' (今日)' : '');

  const records = getRecords().filter(r => r.date === viewDateStr);
  const wo = getWorkOrder(viewDateStr);
  const sNames = ['均質','蛋白霜','整面','烤箱','品判'];
  let completed = 0, abnormal = 0;

  if (wo.length === 0 && records.length > 0) {
    // Reconstruct work order from records
    const batchMap = {};
    records.forEach(r => {
      if (!batchMap[r.batch]) batchMap[r.batch] = { id: r.batch, flavor: r.flavor || '' };
    });
    const reconstructed = Object.values(batchMap).map(b => {
      const parts = b.id.split('-');
      return { id: b.id, round: parseInt(parts[0]) || 1, oven: parts[1] || 'A', flavor: b.flavor };
    }).sort((a,b) => a.round - b.round || a.oven.localeCompare(b.oven));
    wo.push(...reconstructed);
  }

  wo.forEach(batch => {
    const br = records.filter(r => r.batch === batch.id);
    if (br.length === 5) completed++;
    br.forEach(r => { if (r.summary.failCount > 0 || r.summary.criticalCount > 0 || (r.summary.defects && r.summary.defects.length > 0)) abnormal++ });
  });

  document.getElementById('dashSummary').innerHTML = `
    <div class="summary-card"><div class="num" style="color:var(--brand)">${wo.length}</div><div class="label">${isToday?'今日':'當日'}批次</div></div>
    <div class="summary-card"><div class="num" style="color:#27AE60">${completed}</div><div class="label">完整記錄</div></div>
    <div class="summary-card"><div class="num" style="color:${abnormal?'var(--red)':'#27AE60'}">${abnormal}</div><div class="label">異常站次</div></div>`;

  let t = `<tr><th>批次</th><th>口味</th>`;
  sNames.forEach(s => t += `<th>${s.charAt(0)}</th>`);
  t += `</tr>`;
  let lr = 0;
  wo.forEach(batch => {
    if (batch.round !== lr) { t += `<tr style="background:#e8e8e8"><td colspan="${sNames.length+2}" style="font-weight:700;text-align:left;padding:6px 8px;font-size:12px">第 ${batch.round} 輪</td></tr>`; lr = batch.round; }
    t += `<tr><td style="font-weight:700">${batch.id}</td><td style="font-size:11px">${batch.flavor}</td>`;
    sNames.forEach(s => {
      const rec = records.find(r => r.batch === batch.id && r.station === s);
      if (!rec) { t += `<td><div class="station-cell"><span class="status-dot dot-gray"></span></div></td>` }
      else {
        let dotClass = 'dot-green';
        if (rec.summary.criticalCount > 0 || (rec.summary.defects && rec.summary.defects.length > 0)) dotClass = 'dot-red';
        else if (rec.summary.failCount > 0) dotClass = 'dot-yellow';
        const shortName = rec.operator.replace(/師傅$/, '').slice(-2);
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

  // Show current work order in textarea
  const wo = getWorkOrder();
  if (wo.length) {
    document.getElementById('csvInput').value = wo.map(b => `${b.round},${b.oven},${b.flavor}`).join('\n');
  }
}

// File upload handler
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    document.getElementById('csvInput').value = ev.target.result;
    parseWorkOrder();
  };
  reader.readAsText(file, 'UTF-8');
  e.target.value = ''; // reset for re-upload
}

function parseWorkOrder() {
  const raw = document.getElementById('csvInput').value.trim();
  if(!raw){showNotify('請貼上工單內容','warn');return}

  const batches = [];
  const lines = raw.split('\n');

  // Try simple format first: round,oven,flavor
  let simpleFormat = true;
  for (const line of lines) {
    const parts = line.split(',').map(s=>s.trim());
    if (parts.length >= 3 && /^\d+$/.test(parts[0]) && /^[A-C]$/i.test(parts[1])) {
      batches.push({id:`${parts[0]}-${parts[1].toUpperCase()}`, round:parseInt(parts[0]), oven:parts[1].toUpperCase(), flavor:parts[2]});
    } else { simpleFormat = false; break; }
  }

  if (!simpleFormat) {
    // Parse Google Sheets CSV format
    batches.length = 0;
    let currentRound = 0;

    // Strategy: find layer headers and extract oven-flavor mapping
    // The CSV has 3 oven columns: A (cols ~2-7), B (cols ~9-14), C (cols ~16-21)
    // Flavor appears on "口味" lines at cols 3, 10, 17 approximately

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(',');

      // Detect round marker: column 1 has a number, nearby line has "輪"
      if (cols.length > 1 && /^\d+$/.test(cols[1].trim())) {
        const roundNum = parseInt(cols[1].trim());
        // Check if same row or next row contains "輪"
        if (line.includes('輪') || (i+1 < lines.length && lines[i+1].includes('輪'))) {
          currentRound = roundNum;
        }
      }

      // Detect first layer header per round (contains 烤箱A/B/C)
      if (line.includes('【烤箱') && line.includes('第 1 層')) {
        // Find the flavor lines - look for "口味" in next few lines
        for (let j = i+1; j < Math.min(i+4, lines.length); j++) {
          const fLine = lines[j];
          if (fLine.includes('口味')) {
            const fCols = fLine.split(',');
            // Extract flavors for each oven
            const ovenFlavors = [];
            for (let c = 0; c < fCols.length; c++) {
              if (fCols[c].trim() === '口味' && c+1 < fCols.length) {
                const flavor = fCols[c+1].trim();
                if (flavor) ovenFlavors.push(flavor);
              }
            }

            // Map flavors to ovens A, B, C
            const ovenLetters = ['A', 'B', 'C'];
            ovenFlavors.forEach((fl, idx) => {
              if (idx < 3 && currentRound > 0) {
                const batchId = `${currentRound}-${ovenLetters[idx]}`;
                if (!batches.find(b => b.id === batchId)) {
                  batches.push({id: batchId, round: currentRound, oven: ovenLetters[idx], flavor: fl});
                }
              }
            });
            break;
          }
        }
      }
    }

    // If still no results, try to find date and flavor summary on right side
    if (batches.length === 0) {
      // Fallback: look for pattern like "天,1.0" or "原巴,1.0" on right columns
      const flavorCounts = [];
      for (const line of lines) {
        const cols = line.split(',');
        // Look for columns near the right side with flavor + count pattern
        for (let c = 20; c < cols.length - 1; c++) {
          const name = cols[c].trim();
          const count = parseFloat(cols[c+1]);
          if (name && name.length <= 4 && !isNaN(count) && count > 0 && count === Math.floor(count)
              && !name.includes('@') && !name.includes('吋') && !/\d/.test(name)) {
            flavorCounts.push(name);
          }
        }
      }
      // Group and create simple batches from unique flavors
      if (flavorCounts.length > 0) {
        const uniqueFlavors = [...new Set(flavorCounts)];
        const ovenLetters = ['A','B','C'];
        let round = 1, ovenIdx = 0;
        uniqueFlavors.forEach(fl => {
          batches.push({id:`${round}-${ovenLetters[ovenIdx]}`, round, oven:ovenLetters[ovenIdx], flavor:fl});
          ovenIdx++;
          if (ovenIdx >= 3) { ovenIdx = 0; round++; }
        });
      }
    }
  }

  if (batches.length === 0) {
    showNotify('無法解析工單，請使用簡易格式（每行：輪次,烤箱,口味）','warn');
    return;
  }

  batches.sort((a,b) => a.round-b.round || a.oven.localeCompare(b.oven));
  localStorage.setItem('bakery_workorder', JSON.stringify({date:dateStr, batches}));
  showNotify(`✅ 已匯入 ${batches.length} 個批次`,'success');
  document.getElementById('csvInput').value = batches.map(b=>`${b.round},${b.oven},${b.flavor}`).join('\n');
}

function saveOperators() {
  const ops = document.getElementById('opListInput').value.trim().split('\n').map(s=>s.trim()).filter(Boolean);
  if(!ops.length){showNotify('請至少輸入一位','warn');return}
  localStorage.setItem('bakery_operators', JSON.stringify(ops));
  showNotify(`✅ 已儲存 ${ops.length} 位人員`,'success');
}

// ========== EXPORT ==========
function exportData() {
  const viewDateStr = fmtDate(dashViewDate);
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

// ========== CLOUD SYNC ==========
function getCloudUrl() { return localStorage.getItem('bakery_cloud_url') || ''; }

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
      localStorage.setItem('bakery_cloud_url', url);
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
  localStorage.removeItem('bakery_cloud_url');
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

// ========== INIT ==========
route();
initCloudStatus();
