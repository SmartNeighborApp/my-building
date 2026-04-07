/* ═══════════════════════════════════════════════════════════════
   utils.js — שכנות טובה · SmartNeighbor
   פונקציות עזר — משמשות את כל הקבצים האחרים
   תלוי ב: config.js
═══════════════════════════════════════════════════════════════ */

/* ── DOM Helpers ───────────────────────────────────────────── */
function setText(id, txt){
  var el = document.getElementById(id);
  if(el) el.textContent = txt;
}
function setHTML(id, html){
  var el = document.getElementById(id);
  if(el) el.innerHTML = html;
}
function val(id, v){
  var el = document.getElementById(id);
  if(el) el.value = v;
}

/* ── Number & String Helpers ───────────────────────────────── */
function num(n){
  return (+(n||0)).toLocaleString('he-IL');
}
function escHtml(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function escAttr(s){
  return String(s||'').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

/* ── Date Helpers ──────────────────────────────────────────── */
function nowDate(){ return new Date(); }
function getTargetDate(){
  var d = new Date();
  d.setMonth(d.getMonth() + MONTH_OFFSET);
  return d;
}
function monthKey(d){ return d.getFullYear()+'-'+(d.getMonth()+1); }
function fmtMonth(d){ return HE_MONTHS[d.getMonth()]+' '+d.getFullYear(); }
function fmtDate(d){ return ('0'+d.getDate()).slice(-2)+'/'+('0'+(d.getMonth()+1)).slice(-2)+'/'+d.getFullYear(); }
function isCurrentMonth(d){ var n=new Date(); return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear(); }

/* ── Toast Notification ────────────────────────────────────── */
function showToast(msg){
  var t = document.getElementById('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 2600);
}

function showModToast(){
  var t = document.getElementById('mod-toast');
  if(!t) return;
  t.textContent = '🙏 נראה שהשתמשת במילה לא מתאימה. בואו נשמור על שיח מכבד בשכונה שלנו';
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 4000);
}

/* ── Content Moderation ────────────────────────────────────── */
function moderateText(text){
  var lower = (text||'').toLowerCase();
  for(var i=0;i<BANNED_WORDS.length;i++){
    if(lower.indexOf(BANNED_WORDS[i])!==-1) return false;
  }
  return true;
}

/* ── App Reset ─────────────────────────────────────────────── */
function resetApp(){
  try{
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(SESS_KEY);
    localStorage.removeItem('sn_access_verified');
    localStorage.removeItem('sn_building_data');
  } catch(e){}
  window.location.href = '/my-building/index.html';
}
