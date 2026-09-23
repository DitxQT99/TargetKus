/* TARGETKU — single-page habit/goal tracker
   Data utama disimpan di localStorage agar tetap ada setelah refresh.
   V2: Anti-cheat lock, custom modal, confetti, daily note.
*/
const STORAGE_KEY = "targetku_v1";
const APP_VERSION = 2;

const DAY_NAMES = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
const FULL_DAY_NAMES = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const MOTIVATIONS = [
  "Konsistensi lebih penting daripada sempurna.",
  "Mulai dari satu target yang bisa kamu selesaikan.",
  "Progress kecil tetap progress.",
  "Jangan tunggu mood. Buat langkah berikutnya jadi mudah.",
  "Hari ini tidak harus sempurna untuk tetap berarti."
];

const state = loadState();
let route = "home";
let selectedDate = todayKey();
let calendarCursor = new Date();
let targetSearch = "";
let toastTimer = null;
let confirmHandler = null;
let timerInterval = null;
let timerSeconds = 25 * 60;
let timerMode = "Fokus";
let notifiedMinuteKeys = new Set();

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];

document.addEventListener("DOMContentLoaded", init);

function init(){
  bindGlobal();
  setTimeout(() => {
    $("#splash").classList.add("hidden");
    if(!state.user.onboarded){
      $("#onboarding").classList.remove("hidden");
      prefillOnboarding();
    }else{
      $("#app").classList.remove("hidden");
      render();
    }
  }, 800);
  setInterval(tickReminders, 15000);
  setInterval(()=>{ if(route==="home") render(); }, 60000);
  registerServiceWorker();
  tickReminders();
}

function bindGlobal(){
  $$(".nav-item").forEach(btn=>{
    btn.addEventListener("click",()=>navigate(btn.dataset.route));
  });
  $("#notifyBtn").addEventListener("click", requestNotifications);
  $("#quickAddBtn").addEventListener("click",()=>openTargetModal());
  $("#skipOnboarding").addEventListener("click",()=>finishOnboarding(true));
  $("#onboardingForm").addEventListener("submit",(e)=>{e.preventDefault();finishOnboarding(false);});
  $("#obThreshold").addEventListener("input",()=>$("#obThresholdValue").textContent=$("#obThreshold").value+"%");
  $("#closeTargetModal").addEventListener("click",closeTargetModal);
  $("#cancelTarget").addEventListener("click",closeTargetModal);
  $("#targetForm").addEventListener("submit",saveTargetFromForm);
  $("#targetRecurrence").addEventListener("change",toggleRecurrenceInputs);
  $("#confirmCancel").addEventListener("click",closeConfirm);
  $("#confirmOk").addEventListener("click",()=>{ if(confirmHandler) confirmHandler(); closeConfirm(); });
  $("#inputModalCancel").addEventListener("click", closeInputModal);
  window.addEventListener("keydown",(e)=>{ if(e.key==="Escape"){closeTargetModal();closeConfirm();closeInputModal();} });
  document.addEventListener("change", handleImportFileChange);
}

function defaultState(){
  return {
    version: APP_VERSION,
    user:{name:"", goal:"", wake:"06:30", sleep:"22:30", startDate:todayKey(), onboarded:false},
    settings:{threshold:70, notifications:false, autoTheme:"dark", weekStartsMonday:true, firstDayOfWeek:1},
    targets:[],
    progress:{},
    streak:{current:0,longest:0,lastQualified:null},
    xp:{total:0,level:1},
    achievements:{},
    pauses:[],
    ui:{lastRoute:"home"},
  };
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaultState();
    const data = JSON.parse(raw);
    const base = defaultState();
    return {
      ...base,...data,
      user:{...base.user,...data.user},
      settings:{...base.settings,...data.settings},
      streak:{...base.streak,...data.streak},
      xp:{...base.xp,...data.xp},
      ui:{...base.ui,...data.ui},
    };
  }catch(e){
    console.warn("TARGETKU: data reset karena JSON tidak valid.",e);
    return defaultState();
  }
}
function persist(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function uuid(){
  return "t_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);
}
function todayDate(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
function todayKey(){ return keyFromDate(new Date()); }
function keyFromDate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function dateFromKey(k){ const [y,m,d]=k.split("-").map(Number); return new Date(y,m-1,d); }
function dateLabel(k,opts={day:"numeric",month:"long",year:"numeric"}){
  return new Intl.DateTimeFormat("id-ID",opts).format(dateFromKey(k));
}
function escapeHTML(v){ return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function normalizeDate(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function diffDays(a,b){ return Math.round((normalizeDate(a)-normalizeDate(b))/86400000); }
function formatShortDate(k){ return dateLabel(k,{day:"numeric",month:"short"}); }
function haptic(){ if(navigator.vibrate) navigator.vibrate(18); }

/* ============ ONBOARDING ============ */
function finishOnboarding(skipped){
  const name = skipped ? "" : ($("#obName").value.trim() || "Teman");
  const goal = skipped ? "Membangun rutinitas yang konsisten" : ($("#obGoal").value.trim() || "Membangun rutinitas yang konsisten");
  state.user.name=name;
  state.user.goal=goal;
  state.user.wake=skipped ? "06:30" : $("#obWake").value;
  state.user.sleep=skipped ? "22:30" : $("#obSleep").value;
  state.user.startDate=todayKey();
  state.user.onboarded=true;
  state.settings.threshold=Number($("#obThreshold").value);
  if(!skipped) addStarterTargets();
  persist();
  $("#onboarding").classList.add("hidden");
  $("#app").classList.remove("hidden");
  render();
  toast("TARGETKU siap dipakai ✦");
}
function prefillOnboarding(){
  $("#obName").value=state.user.name||"";
  $("#obGoal").value=state.user.goal||"";
  $("#obWake").value=state.user.wake||"06:30";
  $("#obSleep").value=state.user.sleep||"22:30";
  $("#obThreshold").value=state.settings.threshold||70;
  $("#obThresholdValue").textContent=(state.settings.threshold||70)+"%";
}
function addStarterTargets(){
  const add=(title,category,time)=>state.targets.push({id:uuid(),title,category,time,recurrence:"daily",days:[],customEvery:1,customUnit:"days",reminder: time ? "atTime":"off",note:"",createdAt:Date.now(),active:true});
  if($("#starterMeal").checked){
    add("Sarapan","Makan","07:30");
    add("Makan utama","Makan","12:30");
    add("Camilan / jeda","Makan","15:30");
  }
  if($("#starterActivity").checked){
    add("Aktivitas fisik","Olahraga","16:30");
    add("Stretching","Kesehatan","17:30");
  }
  if($("#starterRest").checked){
    add("Jeda tanpa layar","Personal","21:00");
    add("Persiapan tidur","Tidur","22:00");
  }
}

/* ============ NAVIGATION ============ */
function navigate(r){
  route=r; state.ui.lastRoute=r; persist();
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.route===r));
  render();
  $("#view").focus({preventScroll:true});
  window.scrollTo({top:0,behavior:"smooth"});
}

function render(){
  if(!state.user.onboarded) return;
  const view=$("#view");
  if(route==="home") view.innerHTML=renderHome();
  else if(route==="targets") view.innerHTML=renderTargets();
  else if(route==="calendar") view.innerHTML=renderCalendar();
  else if(route==="stats") view.innerHTML=renderStats();
  else if(route==="profile") view.innerHTML=renderProfile();
  bindView();
  updateNotifyButton();
}

/* ============ TARGET LOGIC ============ */
function activeTargetsForDate(k){
  const d=dateFromKey(k);
  return state.targets.filter(t=>t.active!==false && targetScheduledOn(t,d));
}
function targetScheduledOn(t,d){
  const dow=d.getDay();
  if(t.recurrence==="daily") return true;
  if(t.recurrence==="weekdays") return dow>=1 && dow<=5;
  if(t.recurrence==="weekly") return (t.days||[]).map(Number).includes(dow);
  if(t.recurrence==="custom"){
    const created=normalizeDate(new Date(t.createdAt||Date.now()));
    const gap=diffDays(d,created);
    if(gap<0) return false;
    const every=Math.max(1,Number(t.customEvery||1));
    const step=t.customUnit==="weeks"?every*7:every;
    return gap%step===0;
  }
  return true;
}
function ensureDay(k){
  if(!state.progress[k]) state.progress[k]={done:{},notes:""};
  return state.progress[k];
}
function isDone(k,id){ return !!(state.progress[k]?.done?.[id]); }

/* ===== ANTI-CHEAT: LOCK ON CHECK ===== */
function toggleTarget(k,id){
  const t = state.targets.find(x=>x.id===id); if(!t) return;
  if(!targetScheduledOn(t,dateFromKey(k))) return;
  const today = todayKey();

  if(k < today){
    toast("Tanggal lampau terkunci — tidak bisa diubah.");
    return;
  }
  if(k > today){
    toast("Belum waktunya. Fokus hari ini dulu ✦");
    return;
  }

  const day = ensureDay(k);
  const was = !!day.done[id];

  if(was){
    toast("Sudah selesai ✓ — terkunci, tidak bisa dibatalkan.");
    return;
  }

  day.done[id] = {at:Date.now()};
  haptic();
  persist();
  updateDerived();
  render();
  toast("Target selesai ✓");
  const p = progressForDate(k);
  if(p.total>0 && p.pct>=100) celebrate();
}

function progressForDate(k){
  const ts=activeTargetsForDate(k);
  if(!ts.length) return {pct:0,done:0,total:0};
  const done=ts.filter(t=>isDone(k,t.id)).length;
  return {pct:Math.round(done/ts.length*100),done,total:ts.length};
}
function isPaused(k){ return state.pauses.includes(k); }
function qualifyDate(k){
  if(isPaused(k)) return true;
  const p=progressForDate(k);
  return p.total>0 && p.pct>=state.settings.threshold;
}
function updateDerived(){
  const today=todayKey();
  let current=0;
  let cursor=dateFromKey(today);
  if(isPaused(today)){}
  else if(qualifyDate(today)) current=1;
  else current=0;
  let d=addDays(cursor,-1);
  while(true){
    const k=keyFromDate(d);
    if(isPaused(k)){ d=addDays(d,-1); continue; }
    if(qualifyDate(k)){current++;d=addDays(d,-1);continue;}
    break;
  }
  let longest=0,run=0;
  const dates=Object.keys(state.progress).sort();
  let prev=null;
  for(const k of dates){
    if(!state.targets.some(t=>targetScheduledOn(t,dateFromKey(k)))) continue;
    if(isPaused(k)) continue;
    if(qualifyDate(k)){
      if(prev && diffDays(dateFromKey(k),dateFromKey(prev))===1) run++;
      else run=1;
      longest=Math.max(longest,run);
      prev=k;
    }else{run=0;prev=null;}
  }
  const doneCount=Object.values(state.progress).reduce((sum,day)=>sum+Object.keys(day.done||{}).length,0);
  const oldLevel=state.xp.level;
  state.xp.total=doneCount*10;
  state.xp.level=Math.max(1,Math.floor(state.xp.total/100)+1);
  state.streak.current=current;
  state.streak.longest=longest;
  if(qualifyDate(today)) state.streak.lastQualified=today;
  updateAchievements();
  if(oldLevel<state.xp.level) toast(`Naik level! Level ${state.xp.level} ✦`);
  persist();
}
function weeklyPercent(anchorKey=todayKey()){
  const anchor=dateFromKey(anchorKey);
  const monday=addDays(anchor,-((anchor.getDay()+6)%7));
  const vals=[];
  for(let i=0;i<7;i++) vals.push(progressForDate(keyFromDate(addDays(monday,i))));
  const scheduled=vals.filter(v=>v.total>0);
  if(!scheduled.length) return 0;
  return Math.round(scheduled.reduce((a,v)=>a+v.pct,0)/scheduled.length);
}
function monthlyPercent(year,month){
  let total=0,sum=0,count=0;
  const d=new Date(year,month,1);
  while(d.getMonth()===month){
    const p=progressForDate(keyFromDate(d));
    if(p.total){sum+=p.pct;count++;}
    total++;d.setDate(d.getDate()+1);
  }
  return count?Math.round(sum/count):0;
}
function activeDaysCount(){
  return Object.keys(state.progress).filter(k=>progressForDate(k).total>0 && (Object.keys(state.progress[k].done||{}).length>0 || isPaused(k))).length;
}
function totalCompleted(){
  return Object.values(state.progress).reduce((n,d)=>n+Object.keys(d.done||{}).length,0);
}
function updateAchievements(){
  const s=state.streak.longest;
  const milestones=[3,7,14,30,60,100];
  milestones.forEach(m=>{if(s>=m) state.achievements[m]=true;});
}

/* ============ CONFETTI CELEBRATION ============ */
function celebrate(){
  const canvas = document.createElement("canvas");
  canvas.className = "confetti-canvas";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio||1;
  canvas.width = window.innerWidth*dpr;
  canvas.height = window.innerHeight*dpr;
  canvas.style.width = window.innerWidth+"px";
  canvas.style.height = window.innerHeight+"px";
  ctx.scale(dpr,dpr);
  const W = window.innerWidth, H = window.innerHeight;
  const colors = ["#9b8cff","#6f5cff","#50d890","#ffca67","#ff6878","#ffffff"];
  const particles = Array.from({length:110},()=>({
    x: W/2 + (Math.random()-0.5)*260,
    y: H/2 + (Math.random()-0.5)*80,
    vx: (Math.random()-0.5)*15,
    vy: -Math.random()*16-5,
    size: Math.random()*7+4,
    color: colors[Math.floor(Math.random()*colors.length)],
    rot: Math.random()*Math.PI,
    vr: (Math.random()-0.5)*0.35,
    life: 1
  }));
  let frames = 0;
  (function loop(){
    frames++;
    ctx.clearRect(0,0,W,H);
    particles.forEach(p=>{
      p.x += p.vx; p.y += p.vy; p.vy += 0.38; p.rot += p.vr; p.life -= 0.011;
      ctx.save();
      ctx.translate(p.x,p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = Math.max(0,p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*0.6);
      ctx.restore();
    });
    if(frames<180) requestAnimationFrame(loop);
    else canvas.remove();
  })();
}

/* ============ RENDER HOME ============ */
function renderHome(){
  const k=todayKey(), p=progressForDate(k), week=weeklyPercent(k);
  const name=escapeHTML(state.user.name||"Teman");
  const motivation=MOTIVATIONS[dateFromKey(k).getDate()%MOTIVATIONS.length];
  const grouped={};
  activeTargetsForDate(k).forEach(t=>(grouped[t.category]??=[]).push(t));
  const categories=Object.keys(grouped);
  return `
    <section class="hero">
      <div class="greeting">
        <div class="eyebrow">${dateLabel(k,{weekday:"long",day:"numeric",month:"long"})}</div>
        <h1>Halo, ${name} 👋</h1>
        <p>${escapeHTML(state.user.goal||"Tetap konsisten hari ini.")}</p>
      </div>
      <div class="hero-row">
        <div class="progress-ring-wrap">
          <div class="progress-ring" style="--p:${p.pct}">
            <div class="inner"><div class="num">${p.pct}%</div><div class="caption">Hari Ini</div></div>
          </div>
          <div class="metric-stack">
            <div class="metric"><b>🔥 ${state.streak.current}</b><span>streak saat ini</span></div>
            <div class="metric"><b>🎯 ${week}%</b><span>target mingguan</span></div>
            <div class="metric"><b>${p.done}/${p.total}</b><span>target selesai</span></div>
            <div class="metric"><b>Lv. ${state.xp.level}</b><span>${state.xp.total} XP</span></div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="week-strip">${renderWeekStrip(k)}</div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Target Hari Ini</h2><button class="link-btn" data-action="focus">Fokus →</button></div>
      <div class="card target-list">${categories.length?categories.map(cat=>renderCategory(cat,grouped[cat],k)).join(""):renderEmptyInline()}</div>
    </section>

    <section class="section">
      <div class="section-head"><h2>Lanjutkan</h2></div>
      <div class="quick-grid">
        <div class="card quick-card" data-action="openTarget"><div class="quick-icon">＋</div><b>Tambah Target</b><span>Buat rutinitas baru</span></div>
        <div class="card quick-card" data-action="focus"><div class="quick-icon">🎯</div><b>Fokus Hari Ini</b><span>Selesaikan yang penting</span></div>
        <div class="card quick-card" data-action="timer"><div class="quick-icon">⏱</div><b>Focus Timer</b><span>25 menit fokus</span></div>
        <div class="card quick-card" data-action="reminders"><div class="quick-icon">🔔</div><b>Pengingat</b><span>Atur notifikasi</span></div>
      </div>
    </section>

    <section class="section"><div class="quote">“${motivation}”</div></section>

    <section class="section">
      <div class="section-head"><h2>Progress Minggu Ini</h2><button class="link-btn" data-route="stats">Lihat statistik →</button></div>
      <div class="card" style="padding:14px">
        <div class="progress-bar"><span style="width:${week}%"></span></div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:10px;color:var(--muted)">
          <span>Senin</span><b style="color:var(--text)">${week}%</b><span>Minggu</span>
        </div>
      </div>
    </section>
  `;
}
function renderCategory(cat,arr,k){
  return `<div class="category-block">
    <div class="category-title">${categoryIcon(cat)} ${escapeHTML(cat)}</div>
    ${arr.map(t=>renderTask(t,k)).join("")}
  </div>`;
}
function renderTask(t,k){
  const done = isDone(k,t.id);
  const locked = done;
  const time = t.time ? `<span class="pill">⏰ ${t.time}</span>` : "";
  const lockTag = locked ? `<span class="locked-badge">🔒 terkunci</span>` : "";
  return `<div class="task-card">
    <button class="check-btn ${done?"done":""}" data-action="toggle" data-id="${t.id}" aria-label="${done?"Terkunci":"Selesaikan"} ${escapeHTML(t.title)}" ${locked?"aria-disabled=\"true\"":""}>${done?"✓":""}</button>
    <div class="task-main">
      <div class="task-title ${done?"done":""}"><span class="title-text">${escapeHTML(t.title)}</span>${lockTag}</div>
      <div class="task-meta">${time}<span class="pill">${recurrenceLabel(t)}</span></div>
    </div>
    <div class="task-actions"><button class="more-btn" data-action="editTarget" data-id="${t.id}" aria-label="Edit target">⋯</button></div>
  </div>`;
}
function categoryIcon(cat){
  return ({Makan:"🍽️",Olahraga:"🏃",Kesehatan:"✦",Tidur:"😴",Belajar:"📚",Personal:"◌",Lainnya:"•"})[cat]||"•";
}
function renderEmptyInline(){return `<div class="empty-state" style="margin:10px"><div class="empty-icon">✦</div><h3>Belum ada target</h3><p>Tambahkan target pertama dari tombol +.</p></div>`}
function renderWeekStrip(k){
  const anchor=dateFromKey(k), monday=addDays(anchor,-((anchor.getDay()+6)%7));
  return Array.from({length:7},(_,i)=>{
    const d=addDays(monday,i), key=keyFromDate(d), p=progressForDate(key);
    return `<div class="day-cell ${key===todayKey()?"today":""} ${key===selectedDate?"selected":""}" data-date="${key}">
      <div class="dow">${DAY_NAMES[d.getDay()]}</div><div class="d">${d.getDate()}</div><div class="mini"><span style="width:${p.pct}%"></span></div>
    </div>`;
  }).join("");
}

/* ============ TARGETS PAGE ============ */
function renderTargets(){
  const list=state.targets.filter(t=>t.active!==false && (t.title.toLowerCase().includes(targetSearch.toLowerCase()) || t.category.toLowerCase().includes(targetSearch.toLowerCase())));
  return `
    <div class="page-head">
      <div><div class="eyebrow">MANAGE</div><h1>Target</h1><p>Atur rutinitas, frekuensi, dan pengingat.</p></div>
      <button class="btn primary" data-action="openTarget">＋ Target</button>
    </div>
    <div class="toolbar section">
      <input id="targetSearch" class="search" placeholder="Cari target…" value="${escapeHTML(targetSearch)}">
      <button class="btn ghost" data-action="openFocus">Fokus</button>
    </div>
    <section class="section card">
      ${list.length?list.map(renderTargetRow).join(""):renderEmptyInline()}
    </section>
    <section class="section card">
      <div style="padding:16px">
        <div class="section-head"><h2>Focus Timer</h2><button class="link-btn" data-action="timer">Buka</button></div>
        <div class="timer"><div class="mode">${timerMode}</div><div class="time">${formatTimer(timerSeconds)}</div><div class="timer-actions"><button class="btn primary" data-action="timerToggle">${timerInterval?"Pause":"Mulai"}</button><button class="btn ghost" data-action="timerReset">Reset</button></div></div>
      </div>
    </section>
  `;
}
function renderTargetRow(t){
  const rem=t.reminder==="off"?"Tanpa pengingat":t.time?`${reminderLabel(t.reminder)} • ${t.time}`:"Pengingat tidak diatur";
  return `<div class="target-row">
    <div class="quick-icon">${categoryIcon(t.category)}</div>
    <div class="grow"><h3>${escapeHTML(t.title)}</h3><p>${escapeHTML(t.category)} • ${recurrenceLabel(t)} • ${escapeHTML(rem)}</p>${t.note?`<div class="note" style="margin-top:5px">${escapeHTML(t.note)}</div>`:""}</div>
    <div class="row-actions"><button class="mini-btn" data-action="editTarget" data-id="${t.id}" aria-label="Edit">✎</button><button class="mini-btn" data-action="deleteTarget" data-id="${t.id}" aria-label="Hapus">×</button></div>
  </div>`;
}

/* ============ CALENDAR ============ */
function renderCalendar(){
  const y=calendarCursor.getFullYear(), m=calendarCursor.getMonth();
  const first=new Date(y,m,1), last=new Date(y,m+1,0);
  const startOffset=state.settings.firstDayOfWeek===1?((first.getDay()+6)%7):first.getDay();
  const cells=[];
  for(let i=0;i<startOffset;i++){
    const d=addDays(first,-(startOffset-i)); cells.push(renderCalDay(d,true));
  }
  for(let day=1;day<=last.getDate();day++) cells.push(renderCalDay(new Date(y,m,day),false));
  while(cells.length<42){const d=addDays(last,cells.length - (startOffset+last.getDate()) + 1);cells.push(renderCalDay(d,true));}
  const selectedP=progressForDate(selectedDate);
  const noteVal = escapeHTML(state.progress[selectedDate]?.notes||"");
  return `
    <div class="page-head"><div><div class="eyebrow">RIWAYAT</div><h1>Kalender</h1><p>Tap tanggal untuk melihat checklist dan progress.</p></div><button class="btn ghost" data-action="todayCalendar">Hari ini</button></div>
    <section class="section card">
      <div class="cal-header"><button class="icon-btn" data-action="prevMonth">‹</button><h2>${MONTH_NAMES[m]} ${y}</h2><button class="icon-btn" data-action="nextMonth">›</button></div>
      <div class="calendar">
        <div class="weekdays">${(state.settings.firstDayOfWeek===1?["Sen","Sel","Rab","Kam","Jum","Sab","Min"]:["Min","Sen","Sel","Rab","Kam","Jum","Sab"]).map(x=>`<div>${x}</div>`).join("")}</div>
        <div class="cal-grid">${cells.join("")}</div>
      </div>
      <div class="calendar-legend"><span class="legend-dot"><i></i> progress</span><span>○ kosong</span><span>✓ target berhasil</span></div>
    </section>
    <section class="section card detail-card">
      <div class="eyebrow">${dateLabel(selectedDate,{weekday:"long"})}</div>
      <h3>${dateLabel(selectedDate,{day:"numeric",month:"long",year:"numeric"})}</h3>
      <p>${selectedP.done}/${selectedP.total} target selesai • ${selectedP.pct}% progress ${isPaused(selectedDate)?"• hari pause":""}</p>
      <div style="margin-top:13px" class="target-list">
        ${activeTargetsForDate(selectedDate).map(t=>renderTask(t,selectedDate)).join("") || renderEmptyInline()}
      </div>
      <div style="margin-top:14px">
        <label>Catatan hari ini
          <textarea id="dailyNote" maxlength="300" rows="3" placeholder="Refleksi singkat, mood, atau apa yang mau diperbaiki…">${noteVal}</textarea>
        </label>
      </div>
    </section>
  `;
}
function renderCalDay(d,other){
  const key=keyFromDate(d), p=progressForDate(key);
  return `<div class="cal-day ${other?"other":""} ${key===todayKey()?"today":""} ${key===selectedDate?"selected":""}" data-date="${key}">
    <div class="cal-num">${d.getDate()}</div>
    <div class="cal-score"><span style="width:${p.pct}%"></span></div>
  </div>`;
}

/* ============ STATS ============ */
function renderStats(){
  const today=dateFromKey(todayKey()), week=weeklyPercent(), month=monthlyPercent(today.getFullYear(),today.getMonth());
  const vals=[];for(let i=6;i>=0;i--){const d=addDays(today,-i);const k=keyFromDate(d);vals.push({k,p:progressForDate(k)});}
  const max=100;
  const avg=vals.filter(x=>x.p.total).length?Math.round(vals.filter(x=>x.p.total).reduce((s,x)=>s+x.p.pct,0)/vals.filter(x=>x.p.total).length):0;
  return `
    <div class="page-head"><div><div class="eyebrow">ANALYTICS</div><h1>Statistik</h1><p>Lihat pola progress tanpa harus mengejar angka sempurna.</p></div></div>
    <section class="stats-grid section">
      <div class="card stat-card"><b>${totalCompleted()}</b><span>Total target selesai</span></div>
      <div class="card stat-card"><b>${activeDaysCount()}</b><span>Hari aktif</span></div>
      <div class="card stat-card"><b>${state.streak.current}</b><span>Current streak</span></div>
      <div class="card stat-card"><b>${state.streak.longest}</b><span>Longest streak</span></div>
    </section>
    <section class="section card chart">
      <div class="section-head"><h2>7 Hari Terakhir</h2><b style="font-size:12px">${avg}% avg</b></div>
      <div class="chart-bars">${vals.map(x=>`<div class="bar-col"><div class="bar-value">${x.p.pct}%</div><div class="bar" style="height:${Math.max(3,(x.p.pct/max)*115)}px"></div><div class="bar-label">${DAY_NAMES[dateFromKey(x.k).getDay()]}</div></div>`).join("")}</div>
    </section>
    <section class="section stats-grid">
      <div class="card stat-card"><b>${week}%</b><span>Progress minggu ini</span></div>
      <div class="card stat-card"><b>${month}%</b><span>Progress bulan ini</span></div>
      <div class="card stat-card"><b>${state.xp.total}</b><span>XP</span></div>
      <div class="card stat-card"><b>Lv. ${state.xp.level}</b><span>Level</span></div>
    </section>
    <section class="section card" style="padding:16px">
      <div class="section-head"><h2>Milestone</h2><span class="badge-tag">${state.streak.longest} hari terbaik</span></div>
      <div class="milestones">${[3,7,14,30,60,100].map(m=>`<div class="milestone" style="opacity:${state.achievements[m]?"1":".38"}"><div class="badge">${state.achievements[m]?"🔥":"○"}</div><b>${m} hari</b><span>${state.achievements[m]?"tercapai":"belum tercapai"}</span></div>`).join("")}</div>
    </section>
    <section class="section"><div class="insight">${buildInsight()}</div></section>
    <section class="section card" style="padding:16px">
      <div class="section-head"><h2>Fokus yang sering selesai</h2></div>
      ${renderCategoryStats()}
    </section>
  `;
}
function buildInsight(){
  const cats={};
  for(const k of Object.keys(state.progress)){
    for(const t of activeTargetsForDate(k)){
      if(isDone(k,t.id)) cats[t.category]=(cats[t.category]||0)+1;
    }
  }
  const top=Object.entries(cats).sort((a,b)=>b[1]-a[1])[0];
  if(!top) return "Belum cukup data untuk membuat insight. Selesaikan beberapa target dulu, lalu lihat kembali bagian ini.";
  return `${categoryIcon(top[0])} Kategori yang paling sering kamu selesaikan sejauh ini adalah <b>${escapeHTML(top[0])}</b> dengan ${top[1]} penyelesaian. Gunakan pola itu untuk membantu menyusun rutinitas yang realistis.`;
}
function renderCategoryStats(){
  const cats=[...new Set(state.targets.map(t=>t.category))];
  if(!cats.length) return renderEmptyInline();
  return cats.map(cat=>{
    const ts=state.targets.filter(t=>t.category===cat);
    const possible=Object.keys(state.progress).reduce((n,k)=>n+activeTargetsForDate(k).filter(t=>ts.some(x=>x.id===t.id)).length,0);
    const done=Object.values(state.progress).reduce((n,d)=>n+Object.keys(d.done||{}).filter(id=>ts.some(x=>x.id===id)).length,0);
    const pct=possible?Math.round(done/possible*100):0;
    return `<div style="padding:10px 0;border-top:1px solid var(--line)"><div style="display:flex;justify-content:space-between;font-size:11px"><span>${categoryIcon(cat)} ${escapeHTML(cat)}</span><b>${pct}%</b></div><div class="progress-bar" style="margin-top:7px;height:6px"><span style="width:${pct}%"></span></div></div>`;
  }).join("");
}

/* ============ PROFILE ============ */
function renderProfile(){
  const name=state.user.name||"Teman";
  return `
    <div class="page-head"><div><div class="eyebrow">ACCOUNT</div><h1>Profil</h1><p>Pengaturan dan data TARGETKU.</p></div></div>
    <section class="card profile-card">
      <div class="profile-row">
        <div class="profile-avatar">${escapeHTML(name.charAt(0).toUpperCase()||"T")}</div>
        <div><h2>${escapeHTML(name)}</h2><p>${escapeHTML(state.user.goal)}</p></div>
      </div>
      <div class="stats-grid" style="margin-top:15px">
        <div class="metric"><b>${state.streak.current}</b><span>streak</span></div>
        <div class="metric"><b>${state.streak.longest}</b><span>terbaik</span></div>
        <div class="metric"><b>${activeDaysCount()}</b><span>hari aktif</span></div>
        <div class="metric"><b>${state.xp.total}</b><span>XP</span></div>
      </div>
    </section>

    <section class="section card">
      <div class="settings-list">
        <div class="setting"><div><h4>Edit Profil</h4><p>Nama, target utama, jam bangun & tidur.</p></div><button class="mini-btn" data-action="editProfile">✎</button></div>
        <div class="setting"><div><h4>Ambang hari berhasil</h4><p>Minimal progress untuk mempertahankan streak: ${state.settings.threshold}%.</p></div><button class="mini-btn" data-action="threshold">%</button></div>
        <div class="setting"><div><h4>Notifikasi</h4><p>${notificationStatusText()}</p></div><label class="switch"><input type="checkbox" id="notifSwitch" ${state.settings.notifications?"checked":""}><i></i></label></div>
        <div class="setting"><div><h4>Hari istirahat / Pause</h4><p>Gunakan tanggal tertentu agar tidak dihitung sebagai gagal.</p></div><button class="mini-btn" data-action="pauseToday">${isPaused(todayKey())?"✓":"+"}</button></div>
        <div class="setting"><div><h4>Buka Kunci Hari Ini</h4><p>Batalkan centang hari ini kalau salah tekan. Darurat saja.</p></div><button class="mini-btn" data-action="unlockToday">🔓</button></div>
        <div class="setting"><div><h4>Export Data</h4><p>Unduh backup dalam JSON.</p></div><button class="mini-btn" data-action="export">↓</button></div>
        <div class="setting"><div><h4>Import Data</h4><p>Pulihkan backup JSON dengan validasi.</p></div><button class="mini-btn" data-action="import">↑</button></div>
        <div class="setting"><div><h4>Reset Progress</h4><p>Hapus seluruh target, riwayat, XP, dan streak.</p></div><button class="btn danger" data-action="reset">Reset</button></div>
      </div>
      <input id="importFile" type="file" accept="application/json" class="hidden">
    </section>

    <section class="section card" style="padding:16px">
      <div class="section-head"><h2>Tentang Anti-Cheat</h2></div>
      <p class="note">Setiap target yang sudah dicentang akan <b>terkunci 🔒</b> dan tidak bisa dibatalkan, supaya streak dan XP benar-benar mencerminkan usahamu. Kalau salah tekan, gunakan <b>Buka Kunci Hari Ini</b> di atas dengan bijak.</p>
    </section>

    <section class="section card" style="padding:16px">
      <div class="section-head"><h2>Tentang notifikasi web</h2></div>
      <p class="note">TARGETKU dapat meminta izin notifikasi melalui browser. Saat halaman aktif, pengingat bisa diperiksa otomatis. Notifikasi latar belakang pada web tidak dapat dijamin hanya dengan localStorage; untuk pengiriman yang andal ketika aplikasi benar-benar tertutup, diperlukan push service/backend.</p>
    </section>

    <section class="section card" style="padding:16px">
      <div class="section-head"><h2>Focus Timer</h2><button class="link-btn" data-action="timer">Buka</button></div>
      <div class="timer"><div class="mode">${timerMode}</div><div class="time">${formatTimer(timerSeconds)}</div><div class="timer-actions"><button class="btn primary" data-action="timerToggle">${timerInterval?"Pause":"Mulai"}</button><button class="btn ghost" data-action="timerReset">Reset</button></div></div>
    </section>
  `;
}
function notificationStatusText(){
  if(!("Notification" in window)) return "Browser ini tidak mendukung Notifications API.";
  if(Notification.permission==="granted") return "Izin notifikasi aktif.";
  if(Notification.permission==="denied") return "Izin ditolak di browser.";
  return "Belum diaktifkan.";
}

/* ============ BIND VIEW ============ */
function bindView(){
  const view=$("#view");
  view.querySelectorAll("[data-route]").forEach(el=>el.addEventListener("click",()=>navigate(el.dataset.route)));
  view.querySelectorAll("[data-date]").forEach(el=>el.addEventListener("click",()=>{
    selectedDate=el.dataset.date;
    if(route==="calendar"){
      const d=dateFromKey(selectedDate);calendarCursor=new Date(d.getFullYear(),d.getMonth(),1);
    }
    render();
  }));
  view.querySelectorAll("[data-action]").forEach(el=>el.addEventListener("click",handleAction));
  $("#targetSearch")?.addEventListener("input",(e)=>{targetSearch=e.target.value;renderTargetsOnly();});
  $("#dailyNote")?.addEventListener("input",(e)=>{
    const day = ensureDay(selectedDate);
    day.notes = e.target.value;
    persist();
  });
  $("#notifSwitch")?.addEventListener("change", async e=>{
    if(e.target.checked){state.settings.notifications=true;await requestNotifications();}else state.settings.notifications=false;
    persist();render();
  });
}
function renderTargetsOnly(){
  const y=window.scrollY;
  $("#view").innerHTML=renderTargets();bindView();window.scrollTo(0,y);
}
function handleAction(e){
  const a=e.currentTarget.dataset.action,id=e.currentTarget.dataset.id;
  if(a==="toggle") toggleTarget(route==="calendar"?selectedDate:todayKey(),id);
  else if(a==="openTarget") openTargetModal();
  else if(a==="editTarget") openTargetModal(id);
  else if(a==="deleteTarget") confirmDeleteTarget(id);
  else if(a==="focus"||a==="openFocus") openFocus();
  else if(a==="reminders") showReminderManager();
  else if(a==="timer") showTimerModal();
  else if(a==="prevMonth"){calendarCursor.setMonth(calendarCursor.getMonth()-1);render();}
  else if(a==="nextMonth"){calendarCursor.setMonth(calendarCursor.getMonth()+1);render();}
  else if(a==="todayCalendar"){selectedDate=todayKey();calendarCursor=new Date();render();}
  else if(a==="editProfile") editProfile();
  else if(a==="threshold") editThreshold();
  else if(a==="pauseToday") togglePause(todayKey());
  else if(a==="unlockToday") confirmUnlockToday();
  else if(a==="export") exportData();
  else if(a==="import") $("#importFile").click();
  else if(a==="reset") confirmReset();
  else if(a==="timerToggle") timerToggle();
  else if(a==="timerReset") timerReset();
}

/* ============ MODAL: TARGET ============ */
function openTargetModal(id=null){
  $("#targetModal").classList.remove("hidden");
  $("#targetForm").reset();
  $("#targetId").value="";
  $("#targetModalEyebrow").textContent=id?"EDIT TARGET":"TARGET BARU";
  $("#targetModalTitle").textContent=id?"Edit Target":"Tambah Target";
  $("#targetRecurrence").value="daily";
  $("#targetReminder").value="off";
  $("#weeklyDaysBox").classList.add("hidden");
  $("#customRecurrenceBox").classList.add("hidden");
  $$("#weeklyDaysBox input").forEach(i=>i.checked=false);
  if(id){
    const t=state.targets.find(x=>x.id===id);if(!t)return;
    $("#targetId").value=t.id;
    $("#targetTitle").value=t.title;
    $("#targetCategory").value=t.category;
    $("#targetTime").value=t.time||"";
    $("#targetRecurrence").value=t.recurrence||"daily";
    $("#targetReminder").value=t.reminder||"off";
    $("#targetNote").value=t.note||"";
    $("#customEvery").value=t.customEvery||2;
    $("#customUnit").value=t.customUnit||"days";
    (t.days||[]).forEach(d=>{const box=$(`#weeklyDaysBox input[value="${d}"]`);if(box)box.checked=true;});
    toggleRecurrenceInputs();
  }
  setTimeout(()=>$("#targetTitle").focus(),50);
}
function closeTargetModal(){$("#targetModal").classList.add("hidden")}
function toggleRecurrenceInputs(){
  const v=$("#targetRecurrence").value;
  $("#weeklyDaysBox").classList.toggle("hidden",v!=="weekly");
  $("#customRecurrenceBox").classList.toggle("hidden",v!=="custom");
}
function saveTargetFromForm(e){
  e.preventDefault();
  const title=$("#targetTitle").value.trim();
  if(!title) return toast("Nama target wajib diisi.");
  const recurrence=$("#targetRecurrence").value;
  const days=$$("#weeklyDaysBox input:checked").map(i=>Number(i.value));
  if(recurrence==="weekly" && !days.length) return toast("Pilih minimal satu hari.");
  const id=$("#targetId").value;
  const record={
    id:id||uuid(),title,category:$("#targetCategory").value,time:$("#targetTime").value,
    recurrence,days,customEvery:Math.max(1,Number($("#customEvery").value||1)),customUnit:$("#customUnit").value,
    reminder:$("#targetReminder").value,note:$("#targetNote").value.trim(),
    createdAt:id?(state.targets.find(t=>t.id===id)?.createdAt||Date.now()):Date.now(),active:true
  };
  if(id){
    const idx=state.targets.findIndex(t=>t.id===id);if(idx>=0)state.targets[idx]=record;
  }else state.targets.push(record);
  persist();closeTargetModal();render();toast(id?"Target diperbarui ✓":"Target ditambahkan ✓");
}
function confirmDeleteTarget(id){
  const t=state.targets.find(x=>x.id===id);if(!t)return;
  askConfirm("Hapus target?",`“${t.title}” akan dihapus dari daftar. Riwayat lama tetap berada di data progress.`,()=>{
    state.targets=state.targets.filter(x=>x.id!==id);persist();render();toast("Target dihapus");
  });
}
function askConfirm(title,msg,fn){
  $("#confirmTitle").textContent=title;
  $("#confirmMessage").textContent=msg;
  confirmHandler=fn;
  $("#confirmModal").classList.remove("hidden");
}
function closeConfirm(){confirmHandler=null;$("#confirmModal").classList.add("hidden")}

/* ============ CUSTOM INPUT MODAL ============ */
function openInputModal({eyebrow="EDIT",title="",desc="",fields=[],onSubmit}){
  $("#inputModalEyebrow").textContent = eyebrow;
  $("#inputModalTitle").textContent = title;
  const descEl = $("#inputModalDesc");
  descEl.textContent = desc || "";
  descEl.classList.toggle("hidden", !desc);
  const wrap = $("#inputModalFields");
  wrap.innerHTML = fields.map(f=>{
    const common = `id="im_${f.name}" placeholder="${escapeHTML(f.placeholder||"")}"`;
    if(f.type==="textarea"){
      return `<label>${escapeHTML(f.label)}<textarea ${common} maxlength="${f.maxlength||250}">${escapeHTML(f.value||"")}</textarea></label>`;
    }
    if(f.type==="range"){
      return `<label>${escapeHTML(f.label)}<div class="range-row"><input id="im_${f.name}" type="range" min="${f.min??0}" max="${f.max??100}" step="${f.step??1}" value="${f.value??0}"><strong id="im_${f.name}_v">${f.value??0}${f.unit||""}</strong></div></label>`;
    }
    return `<label>${escapeHTML(f.label)}<input ${common} type="${f.type||"text"}" value="${escapeHTML(f.value??"")}" maxlength="${f.maxlength||80}" ${f.required?"required":""}></label>`;
  }).join("");
  fields.forEach(f=>{
    if(f.type==="range"){
      const el = document.getElementById(`im_${f.name}`);
      const val = document.getElementById(`im_${f.name}_v`);
      el?.addEventListener("input",()=>val.textContent = el.value + (f.unit||""));
    }
  });
  $("#inputModalForm").onsubmit = (e)=>{
    e.preventDefault();
    const data = {};
    fields.forEach(f=>{
      const el = document.getElementById(`im_${f.name}`);
      data[f.name] = (f.type==="number"||f.type==="range") ? Number(el.value) : el.value;
    });
    closeInputModal();
    onSubmit && onSubmit(data);
  };
  $("#inputModal").classList.remove("hidden");
  setTimeout(()=>wrap.querySelector("input,textarea,select")?.focus(),120);
}
function closeInputModal(){ $("#inputModal").classList.add("hidden"); }

/* ============ FOCUS MODE ============ */
function openFocus(){
  const k=todayKey(), p=progressForDate(k), remaining=activeTargetsForDate(k).filter(t=>!isDone(k,t.id));
  const html=`<div class="page-head"><div><div class="eyebrow">MODE FOKUS</div><h1>Fokus Hari Ini</h1><p>${p.done}/${p.total} target selesai • ${p.pct}%</p></div></div>
  <section class="focus-hero"><div style="font-size:30px">🎯</div><h2>${remaining.length?remaining.length+" target tersisa":"Semua target selesai!"}</h2><p>${remaining.length?"Selesaikan satu per satu.":"Hari ini sudah beres."}</p></section>
  <section class="section focus-list">${remaining.map(t=>`<div class="focus-item"><button class="check-btn" data-action="toggle" data-id="${t.id}"></button><div class="task-main"><div class="task-title"><span class="title-text">${escapeHTML(t.title)}</span></div><div class="task-meta">${t.time?`<span class="pill">⏰ ${t.time}</span>`:""}<span class="pill">${escapeHTML(t.category)}</span></div></div></div>`).join("")||`<div class="quote">Kamu sudah menyelesaikan semua target untuk hari ini. Mantap ✦</div>`}</section>
  <button class="btn primary" style="width:100%;margin-top:12px" id="completeAllFocus">Selesaikan Semua</button>
  <button class="btn ghost" style="width:100%;margin-top:8px" id="backHomeFocus">Kembali</button>`;
  $("#view").innerHTML=html;bindView();
  $("#completeAllFocus").addEventListener("click",()=>{
    const rem=activeTargetsForDate(todayKey()).filter(t=>!isDone(todayKey(),t.id));
    if(!rem.length)return toast("Tidak ada target tersisa.");
    askConfirm("Selesaikan semua?",`Ini akan menandai ${rem.length} target sebagai selesai untuk hari ini. Setelah itu terkunci.`,()=>{
      const day=ensureDay(todayKey());
      rem.forEach(t=>day.done[t.id]={at:Date.now()});
      persist();updateDerived();openFocus();
      toast("Semua target ditandai selesai ✓");
      const p=progressForDate(todayKey());
      if(p.total>0 && p.pct>=100) celebrate();
    });
  });
  $("#backHomeFocus").addEventListener("click",()=>navigate("home"));
}

/* ============ REMINDER MANAGER ============ */
function showReminderManager(){
  const rems=state.targets.filter(t=>t.active!==false && t.time && t.reminder!=="off");
  const html=`<div class="page-head"><div><div class="eyebrow">REMINDER</div><h1>Pengingat</h1><p>Atur dan cek target yang punya waktu pengingat.</p></div></div>
  <section class="section card">${rems.length?rems.map(t=>`<div class="target-row"><div class="quick-icon">🔔</div><div class="grow"><h3>${escapeHTML(t.title)}</h3><p>${t.time} • ${escapeHTML(reminderLabel(t.reminder))}</p></div><button class="mini-btn" data-action="editTarget" data-id="${t.id}">✎</button></div>`).join(""):renderEmptyInline()}</section>
  <section class="section card" style="padding:16px"><div class="section-head"><h2>Izin notifikasi</h2><button class="btn primary" id="requestNotifInline">Aktifkan</button></div><p class="note">${escapeHTML(notificationStatusText())}</p></section>
  <section class="section"><div class="quote">Catatan: browser harus mengizinkan notifikasi. Untuk pengiriman saat aplikasi benar-benar tertutup, solusi web yang andal memerlukan push service/backend.</div></section>`;
  $("#view").innerHTML=html;bindView();
  $("#requestNotifInline").addEventListener("click",requestNotifications);
}
function requestNotifications(){
  if(!("Notification" in window)){toast("Browser ini belum mendukung notifikasi web.");return;}
  Notification.requestPermission().then(permission=>{
    state.settings.notifications=permission==="granted";persist();updateNotifyButton();render();
    toast(permission==="granted"?"Notifikasi aktif ✓":"Izin notifikasi belum diberikan.");
  });
}
function updateNotifyButton(){
  const b=$("#notifyBtn");if(!b)return;
  if(!("Notification" in window)){ b.textContent="🔕"; b.title="Browser tidak mendukung notifikasi"; return; }
  const granted=Notification.permission==="granted" && state.settings.notifications;
  b.textContent = granted ? "🔔" : "🔕";
  b.title = granted ? "Notifikasi aktif" : "Aktifkan notifikasi";
}
function tickReminders(){
  if(!state.settings.notifications) return;
  if(!("Notification" in window) || Notification.permission!=="granted") return;
  const now=new Date(), today=todayKey(), minute=`${today}_${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
  state.targets.filter(t=>t.active!==false&&t.time&&t.reminder!=="off"&&targetScheduledOn(t,now)).forEach(t=>{
    const [h,m]=t.time.split(":").map(Number);
    let total=h*60+m;
    if(t.reminder==="10m") total-=10;
    if(t.reminder==="30m") total-=30;
    const current=now.getHours()*60+now.getMinutes();
    if(total===current && !isDone(today,t.id) && !notifiedMinuteKeys.has(minute+"_"+t.id)){
      notifiedMinuteKeys.add(minute+"_"+t.id);
      new Notification("TARGETKU • Pengingat",{body:`${t.title}${t.time?` • ${t.time}`:""}`,tag:"targetku-"+t.id});
    }
  });
  if(notifiedMinuteKeys.size>200) notifiedMinuteKeys=new Set([...notifiedMinuteKeys].slice(-50));
}

/* ============ PROFILE ACTIONS ============ */
function editProfile(){
  openInputModal({
    eyebrow:"EDIT PROFIL",
    title:"Perbarui Profil",
    desc:"Semua perubahan langsung tersimpan di perangkat ini.",
    fields:[
      {name:"name", label:"Nama", value:state.user.name||"", maxlength:40, placeholder:"Namamu"},
      {name:"goal", label:"Target utama", value:state.user.goal||"", maxlength:60, placeholder:"Contoh: lebih konsisten"},
      {name:"wake", label:"Jam bangun", type:"time", value:state.user.wake||"06:30"},
      {name:"sleep", label:"Jam tidur", type:"time", value:state.user.sleep||"22:30"}
    ],
    onSubmit:(d)=>{
      state.user.name = (d.name||"").trim().slice(0,40) || "Teman";
      state.user.goal = (d.goal||"").trim().slice(0,60) || "Membangun rutinitas yang konsisten";
      state.user.wake = d.wake||"06:30";
      state.user.sleep = d.sleep||"22:30";
      persist();render();toast("Profil diperbarui ✓");
    }
  });
}
function editThreshold(){
  openInputModal({
    eyebrow:"PENGATURAN",
    title:"Ambang Hari Berhasil",
    desc:"Minimum progress agar hari dihitung berhasil dan streak terjaga.",
    fields:[
      {name:"threshold", label:"Minimum progress", type:"range", min:10, max:100, step:5, value:state.settings.threshold, unit:"%"}
    ],
    onSubmit:(d)=>{
      state.settings.threshold = Math.round(d.threshold/5)*5;
      persist();updateDerived();render();
      toast(`Ambang diatur ke ${state.settings.threshold}%`);
    }
  });
}
function togglePause(k){
  const idx=state.pauses.indexOf(k);
  if(idx>=0){state.pauses.splice(idx,1);toast("Hari pause dibatalkan");}
  else{state.pauses.push(k);toast("Hari ini ditandai sebagai pause");}
  persist();updateDerived();render();
}
function confirmUnlockToday(){
  const p = progressForDate(todayKey());
  if(p.done===0){ toast("Belum ada yang dicentang hari ini."); return; }
  askConfirm(
    "Buka Kunci Hari Ini?",
    `Ini akan menghapus ${p.done} centang hari ini agar bisa diulang. Gunakan hanya jika benar-benar salah tekan.`,
    ()=>{
      const day = state.progress[todayKey()];
      if(day){ day.done = {}; }
      persist(); updateDerived(); render();
      toast("Kunci hari ini dibuka. Silakan ulangi dari awal.");
    }
  );
}
function confirmReset(){
  askConfirm("Reset semua data?", "Semua target, riwayat progress, XP, streak, dan pengaturan akan dihapus.",()=>{
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });
}
function exportData(){
  const payload={...state,exportedAt:new Date().toISOString(),app:"TARGETKU",version:APP_VERSION};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`targetku-backup-${todayKey()}.json`;document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(a.href);toast("Backup JSON dibuat.");
}

/* ============ IMPORT ============ */
function handleImportFileChange(e){
  if(e.target.id!=="importFile") return;
  const file=e.target.files?.[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      if(data?.app!=="TARGETKU" || !data?.user || !Array.isArray(data.targets) || typeof data.progress!=="object") throw new Error("format");
      const base=defaultState();
      Object.assign(state,base,data);
      state.version=APP_VERSION;
      persist();updateDerived();render();toast("Data berhasil diimport ✓");
    }catch(err){toast("File backup tidak valid.");}
    e.target.value="";
  };
  reader.readAsText(file);
}

/* ============ TIMER ============ */
function timerToggle(){
  if(timerInterval){clearInterval(timerInterval);timerInterval=null;render();return;}
  timerInterval=setInterval(()=>{
    timerSeconds--;
    if(timerSeconds<=0){
      clearInterval(timerInterval);timerInterval=null;
      timerMode=timerMode==="Fokus"?"Istirahat":"Fokus";
      timerSeconds=timerMode==="Fokus"?25*60:5*60;
      haptic();
      if("Notification" in window && Notification.permission==="granted") new Notification("TARGETKU",{body:timerMode==="Istirahat"?"Waktunya istirahat 5 menit.":"Waktunya kembali fokus."});
      toast(timerMode==="Istirahat"?"Focus selesai — istirahat 5 menit.":"Istirahat selesai — kembali fokus.");
    }
    if(route==="targets"||route==="profile") render();
  },1000);
  render();
}
function timerReset(){
  if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
  timerSeconds=timerMode==="Fokus"?25*60:5*60;render();
}
function showTimerModal(){
  askConfirm("Focus Timer", "Gunakan halaman Target atau Profil untuk menjalankan timer Pomodoro.", ()=>navigate("targets"));
}
function formatTimer(sec){const m=Math.floor(sec/60),s=sec%60;return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;}

/* ============ HELPERS ============ */
function recurrenceLabel(t){
  if(t.recurrence==="daily")return"Setiap hari";
  if(t.recurrence==="weekdays")return"Senin–Jumat";
  if(t.recurrence==="weekly")return(t.days||[]).map(Number).sort().map(i=>DAY_NAMES[i]).join(", ");
  if(t.recurrence==="custom")return`Setiap ${t.customEvery} ${t.customUnit==="weeks"?"minggu":"hari"}`;
  return"Lainnya";
}
function reminderLabel(v){return({off:"Tanpa pengingat",atTime:"Saat waktu target","10m":"10 menit sebelumnya","30m":"30 menit sebelumnya"})[v]||v}
function registerServiceWorker(){
  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{}));
  }
}
function toast(msg){
  const el=$("#toast");if(!el)return;
  clearTimeout(toastTimer);
  el.textContent=msg;
  el.classList.add("show");
  toastTimer=setTimeout(()=>el.classList.remove("show"),2200);
}