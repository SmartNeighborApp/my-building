/* ═══════════════════════════════════════════════════════════════
   auth.js — שכנות טובה · SmartNeighbor
   כניסה: OTP 6 ספרות + PIN דייר + רישום
   תלוי ב: config.js, utils.js, db.js
   ⚠️ לא לגעת בפונקציות initOtpBoxes ו-checkAccess!
═══════════════════════════════════════════════════════════════ */

/* ── Trial & License ───────────────────────────────────────── */
function checkTrialExpiry(building){
  if(!building) return false;
  try{
    var status = (building.paid_status || 'trial').toLowerCase();
    if(status === 'active') return false;
    var shouldBlock = (status === 'blocked');
    if(!shouldBlock && status === 'trial'){
      if(!building.created_at) return false;
      var createdDate = new Date(building.created_at);
      var now = new Date();
      var diffDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
      if(diffDays < 30) return false;
      shouldBlock = true;
    }
    if(!shouldBlock) return false;
    var accessModal = document.getElementById('sb-access-modal');
    if(accessModal) accessModal.style.display = 'none';
    var existing = document.getElementById('trial-expired-overlay');
    if(existing) existing.remove();
    var msg = (status === 'blocked') ? 'הגישה לבניין זה הושהתה זמנית. לפרטים צרו קשר:' : 'תקופת הניסיון הסתיימה. להסדרת תשלום והמשך שימוש, אנא צרו קשר במייל:';
    var title = (status === 'blocked') ? 'הגישה חסומה' : 'תקופת הניסיון הסתיימה';
    var overlay = document.createElement('div');
    overlay.id = 'trial-expired-overlay';
    overlay.style.cssText = ['position:fixed','inset:0','z-index:99998','background:linear-gradient(160deg,#0F2744 0%,#1A3A5C 60%,#1E4D8C 100%)','display:flex','flex-direction:column','align-items:center','justify-content:center',"font-family:'Heebo',sans-serif",'direction:rtl','padding:24px','text-align:center'].join(';');
    overlay.innerHTML = '<div style="font-size:64px;margin-bottom:16px;">🔒</div><div style="font-size:24px;font-weight:900;color:#fff;margin-bottom:12px;">'+title+'</div><div style="font-size:15px;color:rgba(255,255,255,.75);line-height:1.8;max-width:380px;margin-bottom:28px;">'+msg+'<br><strong style="color:#C9A84C;">ssmartneighbor@gmail.com</strong></div><a href="mailto:ssmartneighbor@gmail.com" style="display:inline-flex;align-items:center;gap:10px;padding:16px 28px;background:linear-gradient(135deg,#C9A84C,#E2C05A);color:#1A3A5C;border-radius:16px;font-size:16px;font-weight:900;text-decoration:none;box-shadow:0 8px 28px rgba(201,168,76,.45);margin-bottom:12px;">✉️ שלח מייל ←</a><div style="font-size:11px;color:rgba(255,255,255,.35);margin-top:20px;">© 2026 SmartNeighbor · שכנות טובה</div>';
    document.body.appendChild(overlay);
    return true;
  } catch(e){ console.warn('checkTrialExpiry error:', e); return false; }
}

/* ── Apply Building & Open App ─────────────────────────────── */
function _applyBuildingAndOpen(building){
  if(checkTrialExpiry(building)) return;
  try{
    localStorage.setItem('sn_building_data', JSON.stringify(building));
    localStorage.setItem('sn_access_verified', '1');
  } catch(e){}
  if(DB && DB.building){
    DB.building.name        = building.building_name || '';
    DB.building.city        = building.city || '';
    DB.building.total_units = parseInt(building.units_count) || 0;
    if(building.monthly_fee !== undefined && building.monthly_fee !== null){
      var fee = parseFloat(building.monthly_fee);
      if(!isNaN(fee) && fee > 0) DB.building.monthly_fee = fee;
    }
  }
  if(building.vaad_unit && DB && DB.user){ DB.user.unit = parseInt(building.vaad_unit) || DB.user.unit; }
  saveDB();
  var sbModal = document.getElementById('sb-access-modal');
  if(sbModal){ sbModal.style.display = 'none'; }
  var sess = getSession();
  if(sess && sess.unit){ DB.user = { name: sess.name || 'דייר', unit: sess.unit }; startApp(); return; }
  var authScr = document.getElementById('auth-screen');
  if(authScr){
    authScr.style.display = 'flex';
    var sub = document.getElementById('auth-sub-txt');
    var hint = document.getElementById('auth-hint-txt');
    var tot = DB.building.total_units;
    if(sub) sub.textContent = 'הזן את מספר הדירה שלך כדי להיכנס';
    if(hint && tot > 0) hint.textContent = 'מספר דירה בין 1 ל-' + tot;
    setTimeout(function(){ var inp = document.getElementById('phone-input'); if(inp) inp.focus(); }, 300);
  }
}

/* ── Lockout (Rate Limit) ──────────────────────────────────── */
var _lockoutTimer = null;
function _getLockoutState(){ try{ var raw = localStorage.getItem('sn_lockout'); if(!raw) return null; return JSON.parse(raw); } catch(e){ return null; } }
function _setLockoutState(obj){ try{ localStorage.setItem('sn_lockout', JSON.stringify(obj)); } catch(e){} }
function _clearLockoutState(){ try{ localStorage.removeItem('sn_lockout'); } catch(e){} }
function _lockoutSecondsLeft(){ var st = _getLockoutState(); if(!st || !st.until) return 0; var left = Math.ceil((st.until - Date.now()) / 1000); return left > 0 ? left : 0; }

function _startLockoutCountdown(){
  var timerDiv = document.getElementById('sb-lockout-timer');
  var countdownSpan = document.getElementById('sb-lockout-countdown');
  var btn = document.querySelector('#sb-access-modal button[onclick="checkAccess()"]');
  var inp = document.getElementById('sb-access-input');
  if(_lockoutTimer) clearInterval(_lockoutTimer);
  function _tick(){
    var left = _lockoutSecondsLeft();
    if(left <= 0){ clearInterval(_lockoutTimer); _lockoutTimer = null; _clearLockoutState(); if(timerDiv) timerDiv.style.display='none'; if(btn){ btn.disabled=false; btn.style.opacity='1'; btn.style.cursor='pointer'; } if(inp) inp.disabled=false; return; }
    var mm = String(Math.floor(left/60)).padStart(2,'0');
    var ss = String(left % 60).padStart(2,'0');
    if(countdownSpan) countdownSpan.textContent = 'נסה שוב בעוד ' + mm + ':' + ss;
    if(timerDiv) timerDiv.style.display='block';
    if(btn){ btn.disabled=true; btn.style.opacity='0.45'; btn.style.cursor='not-allowed'; }
    if(inp) inp.disabled=true;
  }
  _tick();
  _lockoutTimer = setInterval(_tick, 1000);
}

function _recordFailedAttempt(){ var st = _getLockoutState() || { attempts:0, until:0 }; if(st.until && Date.now() < st.until) return true; st.attempts = (st.attempts||0)+1; if(st.attempts >= 5){ st.until = Date.now()+5*60*1000; st.attempts=0; } _setLockoutState(st); return !!(st.until && Date.now() < st.until); }
function _resetFailedAttempts(){ _clearLockoutState(); }

/* ── OTP Boxes — ⚠️ לא לגעת! ──────────────────────────────── */
function initOtpBoxes(){
  var boxes = [];
  for(var i=0;i<6;i++) boxes.push(document.getElementById('otp'+i));
  if(!boxes[0]) return;
  function syncHidden(){ var val = boxes.map(function(b){return b.value||'';}).join(''); var h = document.getElementById('sb-access-input'); if(h) h.value = val; }
  function clearErrors(){ boxes.forEach(function(b){ b.classList.remove('otp-error'); }); }
  boxes.forEach(function(box, idx){
    box.addEventListener('input', function(){
      clearErrors();
      var v = box.value.replace(/\D/g,'');
      box.value = v ? v[v.length-1] : '';
      if(box.value) box.classList.add('otp-filled');
      else box.classList.remove('otp-filled');
      syncHidden();
      if(box.value && idx < 5) boxes[idx+1].focus();
      if(boxes.every(function(b){return b.value.length===1;})) checkAccess();
    });
    box.addEventListener('keydown', function(e){
      if(e.key==='Backspace'){ if(box.value){ box.value=''; box.classList.remove('otp-filled'); syncHidden(); } else if(idx>0){ boxes[idx-1].focus(); boxes[idx-1].value=''; boxes[idx-1].classList.remove('otp-filled'); syncHidden(); } }
      if(e.key==='Enter') checkAccess();
      if(e.key==='ArrowLeft' && idx>0) boxes[idx-1].focus();
      if(e.key==='ArrowRight' && idx<5) boxes[idx+1].focus();
    });
    box.addEventListener('paste', function(e){
      e.preventDefault();
      var txt = (e.clipboardData||window.clipboardData).getData('text').replace(/\D/g,'').slice(0,6);
      for(var j=0;j<6;j++){ boxes[j].value=txt[j]||''; if(boxes[j].value) boxes[j].classList.add('otp-filled'); else boxes[j].classList.remove('otp-filled'); }
      syncHidden();
      var next = Math.min(txt.length, 5);
      boxes[next].focus();
      if(txt.length===6) checkAccess();
    });
    box.addEventListener('focus', function(){ box.select(); });
  });
}

/* ── Check Access (OTP) — ⚠️ לא לגעת! ────────────────────── */
function checkAccess(){
  var boxes = [];
  for(var i=0;i<6;i++){ var b=document.getElementById('otp'+i); if(b) boxes.push(b); }
  var code;
  if(boxes.length===6){ code = boxes.map(function(b){return b.value||'';}).join(''); }
  else { var inp0=document.getElementById('sb-access-input'); code=String((inp0&&inp0.value||'').trim()); }
  var err = document.getElementById('sb-access-err');
  var loading = document.getElementById('sb-access-loading');
  if(_lockoutSecondsLeft()>0){ _startLockoutCountdown(); return; }
  code = String(code).trim();
  if(code.length !== 6 || !/^\d{6}$/.test(code)){ err.textContent='יש להזין קוד בן 6 ספרות'; err.style.display='block'; boxes.forEach(function(b){ b.classList.add('otp-error'); }); return; }
  err.style.display='none';
  boxes.forEach(function(b){ b.classList.remove('otp-error'); });
  loading.style.display='block';
  sbClient.from('buildings').select('*').eq('access_code', Number(code)).then(function(res){
    loading.style.display='none';
    if(res.error || !res.data || res.data.length===0){
      loading.style.display='block';
      sbClient.from('buildings').select('*').eq('access_code', code).then(function(res2){
        loading.style.display='none';
        if(res2.error || !res2.data || res2.data.length===0){ var locked=_recordFailedAttempt(); if(locked){ _startLockoutCountdown(); } else { err.textContent='קוד בניין לא נמצא במערכת'; err.style.display='block'; boxes.forEach(function(b){ b.classList.add('otp-error'); }); } return; }
        _resetFailedAttempts(); _applyBuildingAndOpen(res2.data[0]);
      }).catch(function(e2){ loading.style.display='none'; err.textContent='שגיאת חיבור — נסה שוב'; err.style.display='block'; });
      return;
    }
    _resetFailedAttempts(); _applyBuildingAndOpen(res.data[0]);
  }).catch(function(e){ loading.style.display='none'; err.textContent='שגיאת חיבור — נסה שוב'; err.style.display='block'; });
}

/* ── Slug from URL ─────────────────────────────────────────── */
function checkSlugFromUrl(){
  var slug='';
  try{ var params=new URLSearchParams(window.location.search); slug=(params.get('b')||'').trim(); } catch(e){}
  if(!slug) return false;
  var loading=document.getElementById('sb-access-loading');
  var err=document.getElementById('sb-access-err');
  if(loading) loading.style.display='block';
  if(err) err.style.display='none';
  sbClient.from('buildings').select('*').eq('unique_slug', String(slug)).then(function(res){
    if(loading) loading.style.display='none';
    if(res.error){ return; }
    if(!res.data || res.data.length===0){ if(err){ err.textContent='הקישור אינו תקין — נא להזין קוד גישה ידנית'; err.style.display='block'; } return; }
    _applyBuildingAndOpen(res.data[0]);
  }).catch(function(e){ if(loading) loading.style.display='none'; });
  return true;
}

/* ── DOM Ready ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function(){
  initOtpBoxes();
  if(_lockoutSecondsLeft()>0){ _startLockoutCountdown(); }
  var slugFound = checkSlugFromUrl();
  if(slugFound) return;
  var verified='';
  try{ verified=localStorage.getItem('sn_access_verified')||''; } catch(e){}
  if(verified==='1'){
    try{
      var raw=localStorage.getItem('sn_building_data');
      if(raw){
        var bld=JSON.parse(raw);
        var cachedSlug=bld&&bld.unique_slug;
        if(cachedSlug){
          sbClient.from('buildings').select('*').eq('unique_slug',cachedSlug).then(function(res){
            if(!res.error&&res.data&&res.data.length>0){ var freshBuilding=res.data[0]; try{ localStorage.setItem('sn_building_data',JSON.stringify(freshBuilding)); }catch(e){} if(checkTrialExpiry(freshBuilding)) return; }
            else { if(checkTrialExpiry(bld)) return; }
            var modal=document.getElementById('sb-access-modal'); if(modal) modal.style.display='none';
            var hdrBldg=document.getElementById('hdr-bldg'); if(hdrBldg&&bld&&bld.building_name) hdrBldg.textContent=bld.building_name;
          }).catch(function(){ if(checkTrialExpiry(bld)) return; var modal=document.getElementById('sb-access-modal'); if(modal) modal.style.display='none'; });
        } else { if(checkTrialExpiry(bld)) return; var modal=document.getElementById('sb-access-modal'); if(modal) modal.style.display='none'; }
      } else { var modal2=document.getElementById('sb-access-modal'); if(modal2) modal2.style.display='none'; }
    } catch(ex){ var modal3=document.getElementById('sb-access-modal'); if(modal3) modal3.style.display='none'; }
  }
});

/* ── Auth Screen ───────────────────────────────────────────── */
function showAuthScreen(){ document.getElementById('auth-screen').style.display='flex'; }

var _pinUnit = 0;
var _pinSelectedIdx = 0;
var _sbResidents = [];

function handleLogin(){
  var raw=(document.getElementById('phone-input').value||'').trim();
  var unit=parseInt(raw,10);
  var tot=DB.building.total_units;
  if(!unit||unit<1||(tot>0&&unit>tot)){ showToast(tot>0?'הזן מספר דירה בין 1 ל-'+tot:'הזן מספר דירה תקין'); return; }
  _pinUnit=unit;
  var slug=_getBuildingSlug();
  if(!slug){ var existing=getUnitResidents(unit); if(!existing||!existing.residents||existing.residents.length===0){ openRegModal(unit); } else { openPinLoginModal(unit,existing.residents); } return; }
  var loginBtn=document.querySelector('#auth-phone-wrap .auth-btn');
  if(loginBtn){ loginBtn.disabled=true; loginBtn.textContent='בודק...'; }
  sbClient.from('residents').select('*').eq('building_slug',slug).eq('unit',unit).then(function(res){
    if(loginBtn){ loginBtn.disabled=false; loginBtn.textContent='כניסה ←'; }
    if(res.error||!res.data||res.data.length===0){ openRegModal(unit); } else { openPinLoginModal(unit,res.data); }
  }).catch(function(){ if(loginBtn){ loginBtn.disabled=false; loginBtn.textContent='כניסה ←'; } showToast('שגיאת חיבור — נסה שוב'); });
}

/* ── Registration ──────────────────────────────────────────── */
function _unitRegKey(unit){ return 'sn21_residents_'+unit; }
function getUnitResidents(unit){ try{ var raw=localStorage.getItem(_unitRegKey(unit)); return raw?JSON.parse(raw):null; }catch(e){ return null; } }
function saveUnitResidents(unit,data){ try{ localStorage.setItem(_unitRegKey(unit),JSON.stringify(data)); }catch(e){} }

function openRegModal(unit){
  document.getElementById('reg-unit-label').textContent=unit;
  ['reg-name-1','reg-phone-1','reg-sa-1','reg-name-2','reg-phone-2','reg-sa-2'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; });
  ['reg-sq-1','reg-sq-2'].forEach(function(id){ var el=document.getElementById(id); if(el) el.selectedIndex=0; });
  document.getElementById('reg-second-block').classList.remove('visible');
  document.getElementById('reg-add-second-btn').textContent='+ הוסף דייר שני לאותה דירה (בן/בת זוג)';
  var err=document.getElementById('reg-err'); if(err) err.style.display='none';
  document.getElementById('reg-modal').classList.add('open');
}
function closeRegModal(){ document.getElementById('reg-modal').classList.remove('open'); }
function toggleSecondResident(){
  var block=document.getElementById('reg-second-block');
  var btn=document.getElementById('reg-add-second-btn');
  var vis=block.classList.contains('visible');
  if(vis){ block.classList.remove('visible'); btn.textContent='+ הוסף דייר שני לאותה דירה (בן/בת זוג)'; ['reg-name-2','reg-phone-2','reg-sa-2'].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=''; }); var sq2=document.getElementById('reg-sq-2'); if(sq2) sq2.selectedIndex=0; }
  else { block.classList.add('visible'); btn.textContent='✕ הסר דייר שני'; }
}

function submitRegistration(){
  var errEl=document.getElementById('reg-err');
  function showErr(msg){ errEl.textContent=msg; errEl.style.display='block'; }
  errEl.style.display='none';
  var name1=(document.getElementById('reg-name-1').value||'').trim();
  var phone1=(document.getElementById('reg-phone-1').value||'').trim();
  var sq1=(document.getElementById('reg-sq-1').value||'').trim();
  var sa1=(document.getElementById('reg-sa-1').value||'').trim();
  if(!name1){ showErr('נא למלא שם מלא לדייר הראשון'); return; }
  if(!phone1){ showErr('נא למלא מספר טלפון לדייר הראשון'); return; }
  if(!sq1){ showErr('נא לבחור שאלת אבטחה'); return; }
  if(!sa1){ showErr('נא למלא תשובה לשאלת האבטחה'); return; }
  var digits1=phone1.replace(/\D/g,'');
  var pin1=digits1.slice(-4);
  if(pin1.length<4){ showErr('מספר הטלפון קצר מדי'); return; }
  var residentsToSave=[{ name:name1, phone:phone1, pin:pin1, security_question:sq1, security_answer:sa1.toLowerCase() }];
  var secondVisible=document.getElementById('reg-second-block').classList.contains('visible');
  if(secondVisible){
    var name2=(document.getElementById('reg-name-2').value||'').trim();
    var phone2=(document.getElementById('reg-phone-2').value||'').trim();
    var sq2=(document.getElementById('reg-sq-2').value||'').trim();
    var sa2=(document.getElementById('reg-sa-2').value||'').trim();
    if(!name2){ showErr('נא למלא שם מלא לדייר השני'); return; }
    if(!phone2){ showErr('נא למלא מספר טלפון לדייר השני'); return; }
    if(!sq2){ showErr('נא לבחור שאלת אבטחה לדייר השני'); return; }
    if(!sa2){ showErr('נא למלא תשובה לשאלת האבטחה של הדייר השני'); return; }
    var digits2=phone2.replace(/\D/g,'');
    var pin2=digits2.slice(-4);
    if(pin2.length<4){ showErr('מספר הטלפון של הדייר השני קצר מדי'); return; }
    residentsToSave.push({ name:name2, phone:phone2, pin:pin2, security_question:sq2, security_answer:sa2.toLowerCase() });
  }
  var slug=_getBuildingSlug();
  if(!slug){ showErr('שגיאה: לא נמצא מזהה בניין. נסה לטעון מחדש.'); return; }
  var btn=document.querySelector('#reg-modal .auth-modal-submit');
  if(btn){ btn.disabled=true; btn.textContent='שומר...'; }
  var savePromises=residentsToSave.map(function(r){ return sbClient.from('residents').insert({ building_slug:slug, unit:_pinUnit, name:r.name, phone:r.phone, pin:r.pin, security_question:r.security_question, security_answer:r.security_answer }); });
  Promise.all(savePromises).then(function(results){
    var hasError=results.some(function(res){ return res.error; });
    if(hasError){ if(btn){ btn.disabled=false; btn.textContent='סיום רישום ←'; } showErr('שגיאה בשמירה — נסה שוב'); return; }
    saveUnitResidents(_pinUnit,{ residents:residentsToSave });
    if(!DB.unitNames[_pinUnit]||DB.unitNames[_pinUnit]==='דייר '+_pinUnit){ DB.unitNames[_pinUnit]=residentsToSave[0].name; saveDB(); }
    closeRegModal(); _loginAs(_pinUnit,residentsToSave[0]);
  }).catch(function(e){ if(btn){ btn.disabled=false; btn.textContent='סיום רישום ←'; } showErr('שגיאת חיבור — נסה שוב'); });
}

/* ── PIN Login ─────────────────────────────────────────────── */
function openPinLoginModal(unit,residents){
  _pinUnit=unit; _pinSelectedIdx=0; _sbResidents=residents||[];
  document.getElementById('pin-unit-label').textContent=unit;
  for(var i=0;i<4;i++){ var b=document.getElementById('pml'+i); if(b) b.value=''; }
  var errEl=document.getElementById('pin-login-err'); if(errEl) errEl.style.display='none';
  _closeIdVerify();
  var selEl=document.getElementById('pin-resident-select');
  var nameEl=document.getElementById('pin-selected-name');
  if(residents.length===1){ selEl.style.display='none'; nameEl.textContent='שלום, '+residents[0].name+' 👋'; _pinSelectedIdx=0; }
  else { selEl.style.display='flex'; nameEl.textContent=''; var html=''; residents.forEach(function(r,i){ html+='<button class="pmrs-btn'+(i===0?' active':'')+'" onclick="selectPinResident('+i+')">'+escHtml(r.name)+'</button>'; }); selEl.innerHTML=html; }
  document.getElementById('pin-login-modal').classList.add('open');
  setTimeout(function(){ var b=document.getElementById('pml0'); if(b) b.focus(); },300);
}
function closePinLoginModal(){ document.getElementById('pin-login-modal').classList.remove('open'); _closeIdVerify(); }
function selectPinResident(idx){ _pinSelectedIdx=idx; document.querySelectorAll('.pmrs-btn').forEach(function(b,i){ b.className='pmrs-btn'+(i===idx?' active':''); }); for(var i=0;i<4;i++){ var b=document.getElementById('pml'+i); if(b) b.value=''; } var errEl=document.getElementById('pin-login-err'); if(errEl) errEl.style.display='none'; setTimeout(function(){ var b=document.getElementById('pml0'); if(b) b.focus(); },50); }
function pinModalNext(idx){ var cur=document.getElementById('pml'+idx); if(cur&&cur.value.length===1){ if(idx<3){ var next=document.getElementById('pml'+(idx+1)); if(next) next.focus(); } else { submitPinLogin(); } } }

function _loginAs(unit, resident){
  var name = resident.name || DB.unitNames[unit] || 'דייר '+unit;
  DB.user = { name: name, unit: unit };
  saveDB();
  try{ localStorage.setItem(SESS_KEY, JSON.stringify({unit:unit, name:name, ts:Date.now()})); } catch(e){}
  document.getElementById('auth-screen').style.display='none';
  startApp();
  if(!resident.pin){ setTimeout(function(){ openSetPinModal(); }, 600); }
}

function submitPinLogin(){
  var pin='';
  for(var i=0;i<4;i++){ var b=document.getElementById('pml'+i); if(b) pin+=b.value; }
  if(pin.length<4){ showToast('הזן 4 ספרות'); return; }
  var residents=_sbResidents||[];
  if(residents.length===0){ var data=getUnitResidents(_pinUnit); if(!data||!data.residents){ showToast('שגיאה — נסה שוב'); return; } residents=data.residents; }
  var resident=residents[_pinSelectedIdx];
  if(!resident){ showToast('שגיאה — נסה שוב'); return; }
  var errEl=document.getElementById('pin-login-err');
  if(resident.pin!==pin){ errEl.textContent='קוד PIN שגוי. נסה שוב'; errEl.style.display='block'; for(var j=0;j<4;j++){ var bx=document.getElementById('pml'+j); if(bx) bx.value=''; } var b0=document.getElementById('pml0'); if(b0) b0.focus(); return; }
  errEl.style.display='none'; closePinLoginModal(); _loginAs(_pinUnit,resident);
}

/* ── ID Verify (Forgot PIN) ────────────────────────────────── */
function toggleIdVerify(){
  var sec=document.getElementById('id-verify-section');
  if(sec.classList.contains('visible')){ _closeIdVerify(); }
  else {
    sec.classList.add('visible');
    var resident=(_sbResidents||[])[_pinSelectedIdx];
    var qEl=document.getElementById('id-verify-question');
    if(qEl&&resident&&resident.security_question){ var qMap={'pet':'שם חיית המחמד הראשונה שלך','street':'שם הרחוב שגדלת בו','school':'שם בית הספר הראשון שלמדת בו','nickname':'כינוי הילדות שלך','city':'שם העיר שבה נולדת'}; qEl.textContent='❓ '+(qMap[resident.security_question]||resident.security_question); } else if(qEl) { qEl.textContent=''; }
    var inp=document.getElementById('id-verify-input'); if(inp){ inp.value=''; inp.focus(); }
    document.getElementById('id-verify-result').classList.remove('visible');
    document.getElementById('id-verify-fail').classList.remove('visible');
    document.getElementById('id-wa-btn').classList.remove('visible');
  }
}
function _closeIdVerify(){ var sec=document.getElementById('id-verify-section'); if(sec) sec.classList.remove('visible'); var r=document.getElementById('id-verify-result'); if(r) r.classList.remove('visible'); var f=document.getElementById('id-verify-fail'); if(f) f.classList.remove('visible'); var w=document.getElementById('id-wa-btn'); if(w) w.classList.remove('visible'); var inp=document.getElementById('id-verify-input'); if(inp) inp.value=''; }

function verifySecurityAnswer(){
  var ansVal=(document.getElementById('id-verify-input').value||'').trim().toLowerCase();
  if(!ansVal){ showToast('נא למלא תשובה'); return; }
  var residents=_sbResidents||[];
  if(residents.length===0){ var data=getUnitResidents(_pinUnit); if(data&&data.residents) residents=data.residents; }
  var resident=residents[_pinSelectedIdx]; if(!resident) return;
  var resultEl=document.getElementById('id-verify-result');
  var failEl=document.getElementById('id-verify-fail');
  var waBtn=document.getElementById('id-wa-btn');
  if(ansVal===(resident.security_answer||'').toLowerCase()){ resultEl.textContent='✅ אימות הצליח! קוד ה-PIN שלך הוא: '+resident.pin; resultEl.classList.add('visible'); failEl.classList.remove('visible'); waBtn.classList.remove('visible'); }
  else { resultEl.classList.remove('visible'); failEl.classList.add('visible'); waBtn.classList.add('visible'); }
}
function contactVaadForPin(){ var phone=((DB.paySettings.vaadPhone||'').replace(/\D/g,'')); var data=getUnitResidents(_pinUnit); var name=(data&&data.residents&&data.residents[_pinSelectedIdx])?data.residents[_pinSelectedIdx].name:'דייר'; var msg='שלום ועד הבית, אני '+name+' מדירה '+_pinUnit+' ב'+DB.building.name+'. שכחתי את קוד ה-PIN ולא הצלחתי לאמת בשאלת האבטחה. אשמח לעזרה.'; if(phone){ window.open('https://wa.me/972'+phone.replace(/^0/,'')+'?text='+encodeURIComponent(msg),'_blank'); } else { try{ navigator.clipboard.writeText(msg); }catch(e){} showToast('הודעה הועתקה — לא הוגדר טלפון ועד'); } }

/* ── Set PIN (first login) ─────────────────────────────────── */
function openSetPinModal(){ document.getElementById('set-pin-inp').value=''; document.getElementById('set-pin-confirm').value=''; document.getElementById('set-pin-sq').selectedIndex=0; document.getElementById('set-pin-sa').value=''; var errEl=document.getElementById('set-pin-err'); if(errEl) errEl.style.display='none'; document.getElementById('set-pin-modal').classList.add('open'); setTimeout(function(){ var b=document.getElementById('set-pin-inp'); if(b) b.focus(); },300); }

function submitSetPin(){
  var pin1=(document.getElementById('set-pin-inp').value||'').trim();
  var pin2=(document.getElementById('set-pin-confirm').value||'').trim();
  var sq=(document.getElementById('set-pin-sq').value||'').trim();
  var sa=(document.getElementById('set-pin-sa').value||'').trim();
  var errEl=document.getElementById('set-pin-err');
  function showErr(msg){ errEl.textContent=msg; errEl.style.display='block'; }
  errEl.style.display='none';
  if(!/^\d{4}$/.test(pin1)){ showErr('קוד PIN חייב להיות 4 ספרות'); return; }
  if(pin1!==pin2){ showErr('הקודים אינם תואמים — נסה שוב'); return; }
  if(!sq){ showErr('נא לבחור שאלת אבטחה'); return; }
  if(!sa){ showErr('נא למלא תשובה לשאלת האבטחה'); return; }
  var slug=_getBuildingSlug(); if(!slug){ showErr('שגיאה — לא נמצא מזהה בניין'); return; }
  var btn=document.querySelector('#set-pin-modal .auth-modal-submit'); if(btn){ btn.disabled=true; btn.textContent='שומר...'; }
  _getMySupabaseId(function(id){
    var done=function(res){ if(btn){ btn.disabled=false; btn.textContent='שמור וכנס לאפליקציה ←'; } if(res.error){ showErr('שגיאה בשמירה — נסה שוב'); return; } document.getElementById('set-pin-modal').classList.remove('open'); showToast('קוד PIN נקבע בהצלחה ✅'); };
    if(!id){ sbClient.from('residents').insert({ building_slug:slug, unit:_pinUnit||DB.user.unit, name:DB.user.name||'דייר', phone:'', pin:pin1, security_question:sq, security_answer:sa.toLowerCase() }).then(done).catch(function(){ if(btn){ btn.disabled=false; btn.textContent='שמור וכנס לאפליקציה ←'; } showErr('שגיאת חיבור'); }); return; }
    sbClient.from('residents').update({ pin:pin1, security_question:sq, security_answer:sa.toLowerCase() }).eq('id',id).then(done).catch(function(){ if(btn){ btn.disabled=false; btn.textContent='שמור וכנס לאפליקציה ←'; } showErr('שגיאת חיבור'); });
  });
}

/* ── Personal Settings ─────────────────────────────────────── */
function _personalMsg(msg, ok){ var el=document.getElementById('personal-msg'); if(!el) return; el.textContent=msg; el.style.display='block'; el.style.background=ok?'rgba(16,185,129,.12)':'rgba(239,68,68,.1)'; el.style.color=ok?'var(--green)':'var(--rose)'; setTimeout(function(){ el.style.display='none'; },3000); }

function _getMySupabaseId(cb){ var slug=_getBuildingSlug(); var unit=DB.user?DB.user.unit:0; if(!slug||!unit){ cb(null); return; } sbClient.from('residents').select('id,name').eq('building_slug',slug).eq('unit',unit).then(function(res){ if(res.error||!res.data||res.data.length===0){ cb(null); return; } var byName=res.data.find(function(r){ return r.name===DB.user.name; }); cb((byName||res.data[0]).id); }).catch(function(){ cb(null); }); }

function loadPersonalSettings(){ var slug=_getBuildingSlug(); var unit=DB.user?DB.user.unit:0; if(!slug||!unit) return; sbClient.from('residents').select('name,phone,security_question,security_answer').eq('building_slug',slug).eq('unit',unit).then(function(res){ if(res.error||!res.data||res.data.length===0) return; var r=res.data[0]; var ni=document.getElementById('personal-name-inp'); var pi=document.getElementById('personal-phone-inp'); var ui=document.getElementById('personal-unit-inp'); var si=document.getElementById('personal-sq'); var ai=document.getElementById('personal-sa'); if(ni&&r.name) ni.value=r.name; if(pi&&r.phone) pi.value=r.phone; if(ui) ui.value=unit; if(si&&r.security_question) si.value=r.security_question; if(ai&&r.security_answer) ai.value=r.security_answer; }).catch(function(){}); }

function saveAllPersonal(){
  var newName=(document.getElementById('personal-name-inp').value||'').trim();
  var newUnit=parseInt(document.getElementById('personal-unit-inp').value||'0',10);
  var newPhone=(document.getElementById('personal-phone-inp').value||'').trim();
  var curPin=(document.getElementById('personal-pin-cur').value||'').trim();
  var newPin=(document.getElementById('personal-pin-new').value||'').trim();
  var newSq=(document.getElementById('personal-sq').value||'').trim();
  var newSa=(document.getElementById('personal-sa').value||'').trim();
  if(!newName){ _personalMsg('נא למלא שם מלא',false); return; }
  var pinChange=curPin||newPin;
  if(pinChange&&!/^\d{4}$/.test(curPin)){ _personalMsg('קוד נוכחי חייב להיות 4 ספרות',false); return; }
  if(pinChange&&!/^\d{4}$/.test(newPin)){ _personalMsg('קוד חדש חייב להיות 4 ספרות',false); return; }
  _getMySupabaseId(function(id){
    var applyResult=function(res){ if(res.error){ _personalMsg('שגיאה בשמירה',false); return; } DB.user.name=newName; if(newUnit&&newUnit!==DB.user.unit) DB.user.unit=newUnit; saveDB(); try{ var s=JSON.parse(localStorage.getItem(SESS_KEY)||'{}'); s.name=newName; if(newUnit) s.unit=newUnit; localStorage.setItem(SESS_KEY,JSON.stringify(s)); }catch(e){} renderHeader(); _personalMsg('✅ הפרטים עודכנו בהצלחה',true); document.getElementById('personal-pin-cur').value=''; document.getElementById('personal-pin-new').value=''; };
    var doSave=function(pinToSet){ var payload={name:newName}; if(newPhone) payload.phone=newPhone; if(newSq) payload.security_question=newSq; if(newSa) payload.security_answer=newSa; if(pinToSet) payload.pin=pinToSet; if(id){ sbClient.from('residents').update(payload).eq('id',id).then(applyResult).catch(function(){ _personalMsg('שגיאת חיבור',false); }); } else { var slug=_getBuildingSlug(); payload.building_slug=slug; payload.unit=DB.user.unit; sbClient.from('residents').insert(payload).then(applyResult).catch(function(){ _personalMsg('שגיאת חיבור',false); }); } };
    if(pinChange&&id){ sbClient.from('residents').select('pin').eq('id',id).then(function(res){ if(res.error||!res.data||!res.data[0]){ _personalMsg('שגיאה',false); return; } if(res.data[0].pin!==curPin){ _personalMsg('קוד נוכחי שגוי',false); return; } doSave(newPin); }).catch(function(){ _personalMsg('שגיאת חיבור',false); }); }
    else { doSave(pinChange?newPin:null); }
  });
}

function handleLogout(){ if(!confirm('לצאת מהחשבון?')) return; try{ localStorage.removeItem(SESS_KEY); localStorage.removeItem('sn_access_verified'); localStorage.removeItem('sn_building_data'); }catch(e){} ADMIN_ON=false; window.location.href='/my-building/index.html'; }
