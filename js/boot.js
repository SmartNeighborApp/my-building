/* ═══════════════════════════════════════════════════════════════
   boot.js — שכנות טובה · SmartNeighbor
   הפעלת האפליקציה + ניווט + guide overlay
   תלוי ב: config.js, utils.js, db.js, auth.js
═══════════════════════════════════════════════════════════════ */

/* ── App Start ─────────────────────────────────────────────── */
function startApp(){
  document.getElementById('app').classList.add('visible');
  document.getElementById('bottom-nav').classList.add('visible');
  switchTab('home');
  _cleanOldVaadNotices();
  renderAll();
  checkDebtAlert();
}

function _cleanOldVaadNotices(){
  var slug = _getBuildingSlug();
  if(!slug) return;
  var curMonth = (function(){ var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1); })();
  sbClient.from('notices').select('id, auto_delete_month').eq('building_slug', slug).not('auto_delete_month', 'is', null).then(function(res){
    if(res.error || !res.data) return;
    var toDelete = res.data.filter(function(n){ return n.auto_delete_month && n.auto_delete_month !== curMonth; });
    if(!toDelete.length) return;
    var ids = toDelete.map(function(n){ return n.id; });
    sbClient.from('notices').delete().in('id', ids).then(function(){});
  });
}

function renderAll(){
  loadNoticesFromSupabase(function(){
    loadFaultsFromSupabase(function(){
      loadPostsFromSupabase(function(){
        loadPollFromSupabase(function(){
          loadProfessionalsFromSupabase(function(){
            loadPaymentsFromSupabase(function(){
              try{ renderHeader(); }catch(e){}
              try{ renderHomePage(); }catch(e){}
              try{ renderFundPage(); }catch(e){}
              try{ renderFaultsPage(); }catch(e){}
              try{ renderCommunityPage(); }catch(e){}
              try{ renderDocsPage(); }catch(e){}
              try{ renderSettingsPage(); }catch(e){}
              try{ renderProfessionalsPage(); }catch(e){}
            });
          });
        });
      });
    });
  });
}

/* ── Navigation ────────────────────────────────────────────── */
function switchTab(tab){
  var tabs = ['home','fund','faults','community','docs','settings','professionals'];
  tabs.forEach(function(t){
    var page = document.getElementById('page-'+t);
    var nav  = document.getElementById('nav-'+t);
    if(page) page.className = 'page'+(t===tab?' active':'');
    if(nav)  nav.className  = 'nav-btn'+(t===tab?' active':'');
  });
  document.querySelector('.page-scroll').scrollTop=0;
  if(tab==='professionals') renderProfessionalsPage();
  if(tab==='settings') loadPersonalSettings();
}

function updateNavDot(){
  var dot = document.getElementById('nav-settings-dot');
  if(!dot) return;
  var count = DB.pendingPayments ? DB.pendingPayments.length : 0;
  dot.style.display = count>0 ? 'flex' : 'none';
  dot.textContent   = count||'';
}

/* ── Sheet & Toast ─────────────────────────────────────────── */
function openSheet(name){
  var el = document.getElementById('sheet-'+name);
  if(el) el.classList.add('open');
  if(name==='pay') resetPay();
}

function closeSheet(name){
  var el = document.getElementById('sheet-'+name);
  if(el) el.classList.remove('open');
  if(name==='pay'){
    resetPay();
    var cb = document.getElementById('pay-confirm-btn'); if(cb) cb.style.display='block';
    var bl = document.getElementById('pay-back-link'); if(bl) bl.style.display='block';
  }
}

function openNoticeSheet(type){
  _activeNoticeType = type;
  var map = {notice:'ntype-notice',urgent:'ntype-urgent',gift:'ntype-gift',wish:'ntype-wish'};
  document.querySelectorAll('.notice-type-btn').forEach(function(b){ b.classList.remove('selected'); });
  var tb = document.getElementById(map[type]); if(tb) tb.classList.add('selected');
  openSheet('notice');
}

/* ── Guide Overlay ─────────────────────────────────────────── */
function openGuide(){ document.getElementById('guide-overlay').style.display='flex'; }
function closeGuide(){ document.getElementById('guide-overlay').style.display='none'; }

/* ── Install Tab ───────────────────────────────────────────── */
function switchInstallTab(platform){
  document.getElementById('install-steps-ios').style.display     = platform==='ios'     ? 'block':'none';
  document.getElementById('install-steps-android').style.display = platform==='android' ? 'block':'none';
  document.getElementById('tab-ios').className     = 'install-tab'+(platform==='ios'?' active':'');
  document.getElementById('tab-android').className = 'install-tab'+(platform==='android'?' active':'');
}

/* ── Month Navigation ──────────────────────────────────────── */
function changeMonth(dir){ MONTH_OFFSET += dir; renderFundPage(); }

/* ── Debt Alert ────────────────────────────────────────────── */
function checkDebtAlert(){
  try{
    var shown = sessionStorage.getItem('sn19_debt_shown');
    if(shown) return;
    if(!DB.approvedReceipts || Object.keys(DB.approvedReceipts).length===0) return;
    var unit = DB.user.unit;
    var now  = new Date();
    var debtMonths = [];
    for(var i=1;i<=6;i++){
      var d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      var mk = monthKey(d);
      var unitKey = unit+'-'+mk;
      var approved = !!DB.approvedReceipts[unitKey];
      var pending  = DB.pendingPayments.some(function(p){ return p.unit===unit && p.monthKey===mk; });
      if(!approved && !pending){ debtMonths.push(fmtMonth(d)); }
    }
    if(debtMonths.length===0) return;
    sessionStorage.setItem('sn19_debt_shown','1');
    var wrap = document.getElementById('debt-months-wrap');
    if(wrap){ wrap.innerHTML = debtMonths.map(function(m){ return '<span class="debt-month-tag">'+m+'</span>'; }).join(''); }
    setTimeout(function(){ var ov = document.getElementById('debt-overlay'); if(ov) ov.classList.add('open'); }, 1500);
  } catch(e){}
}

/* ── Boot Sequence ─────────────────────────────────────────── */
window.addEventListener('load', function(){
  loadDB();

  setTimeout(function(){
    var ls = document.getElementById('loading-screen');
    if(ls){ ls.style.opacity='0'; setTimeout(function(){ ls.style.display='none'; },500); }

    // בדיקת רישיון
    var today = new Date().toISOString().slice(0,10);
    if(LICENSE_EXPIRY && today > LICENSE_EXPIRY){
      var lo = document.createElement('div');
      lo.className = 'lic-locked-overlay';
      lo.innerHTML = '<div class="lock-icon">🔒</div><div class="lock-title">הרישיון פג תוקף</div><div class="lock-sub">תוקף הרישיון של SmartNeighbor הסתיים.<br>לחידוש הרישיון צרו קשר עם נציג שכנות טובה.</div>';
      document.body.appendChild(lo);
      return;
    }

    // אזהרת פקיעה קרובה
    if(LICENSE_EXPIRY){
      var expDate   = new Date(LICENSE_EXPIRY);
      var todayDate = new Date(today);
      var daysLeft  = Math.round((expDate - todayDate)/(1000*60*60*24));
      var milestones = [30, 14, 7, 1];
      var shouldWarn = daysLeft >= 0 && milestones.some(function(m){ return daysLeft <= m; });
      if(shouldWarn){
        var warnMsg = daysLeft === 0 ? '⚠️ שים לב: המנוי יסתיים היום! נא לפנות לחידוש בהקדם' : '⚠️ שים לב: המנוי יסתיים בעוד '+daysLeft+' ימים. נא לפנות לחידוש בהקדם';
        var wb = document.getElementById('lic-warn-bar');
        if(wb){ wb.textContent = warnMsg; wb.style.display = 'block'; }
      }
    }

    // בדיקת session קיים
    var sess = getSession();
    if(sess && sess.unit){
      DB.user = { name: DB.unitNames[sess.unit]||sess.name, unit:sess.unit };
      var slug = _getBuildingSlug();
      if(slug && sess.unit){
        sbClient.from('residents').select('name').eq('building_slug', slug).eq('unit', sess.unit).then(function(res){
          if(!res.error && res.data && res.data.length>0){
            var freshName = res.data[0].name;
            if(freshName && freshName !== DB.user.name){
              DB.user.name = freshName;
              try{ var s=JSON.parse(localStorage.getItem(SESS_KEY)||'{}'); s.name=freshName; localStorage.setItem(SESS_KEY,JSON.stringify(s)); }catch(e){}
            }
            renderHeader();
          }
        }).catch(function(){});
      }
      startApp();
    } else {
      showAuthScreen();
    }
  }, 1200);
});

/* ── DevTools Protection ───────────────────────────────────── */
document.addEventListener('contextmenu', event => event.preventDefault());
document.onkeydown = function(e){ if(e.keyCode==123||(e.ctrlKey&&e.shiftKey&&e.keyCode=='I'.charCodeAt(0))||(e.ctrlKey&&e.keyCode=='U'.charCodeAt(0))){ return false; } };

/* ── Share App ─────────────────────────────────────────────── */
function _shareApp(){
  var url = 'https://smartneighborapp.github.io/my-building/index.html';
  var text = 'גיליתי אפליקציה מעולה לניהול ועד בית — שכנות טובה! ניהול גבייה, תקלות, קהילה — הכל במקום אחד 🏢';
  if(navigator.share){
    navigator.share({ title:'שכנות טובה', text:text, url:url }).catch(function(){});
  } else {
    try{ navigator.clipboard.writeText(url); showToast('הלינק הועתק — שלחי לחברים! ✅'); } catch(e){ window.open(url,'_blank'); }
  }
}

/* ── Building Card ─────────────────────────────────────────── */
function _showBuildingCard(){
  try{
    var raw = localStorage.getItem('sn_building_data');
    if(!raw){ showToast('לא נמצאו פרטי בניין'); return; }
    var bd = JSON.parse(raw);
    var slug = bd.unique_slug || '';
    var code = bd.access_code || '';
    var url  = 'https://smartneighborapp.github.io/my-building/app.html?b=' + slug;

    // יצירת overlay
    var existing = document.getElementById('building-card-overlay');
    if(existing) existing.remove();

    var ov = document.createElement('div');
    ov.id = 'building-card-overlay';
    ov.style.cssText = 'position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;padding:20px;';
    ov.onclick = function(e){ if(e.target===ov) ov.remove(); };

    ov.innerHTML = '<div style="background:#fff;border-radius:24px;padding:28px 24px;max-width:400px;width:100%;direction:rtl;font-family:var(--font);box-shadow:0 20px 60px rgba(0,0,0,0.3);">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
        '<div style="font-size:18px;font-weight:900;color:#1A3A5C;">🏢 כניסה לבניין</div>' +
        '<button onclick="document.getElementById(\'building-card-overlay\').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94A3B8;">✕</button>' +
      '</div>' +
      '<div style="background:#F8FAFC;border-radius:16px;padding:16px;margin-bottom:16px;text-align:center;">' +
        '<div style="font-size:12px;color:#64748B;margin-bottom:8px;">🔗 הקישור לאפליקציה</div>' +
        '<div style="font-size:13px;font-weight:700;color:#2563EB;word-break:break-all;margin-bottom:12px;">' + url + '</div>' +
        '<button onclick="_copyBuildingUrl(\'' + url + '\')" style="width:100%;padding:10px;background:linear-gradient(135deg,#1A3A5C,#2563EB);color:#fff;border:none;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;font-family:var(--font);">📋 העתק לינק</button>' +
      '</div>' +
      '<div style="background:#FFF9E6;border-radius:16px;padding:16px;text-align:center;">' +
        '<div style="font-size:12px;color:#92400E;margin-bottom:8px;">🔑 קוד גישה — 6 ספרות</div>' +
        '<div style="font-size:36px;font-weight:900;color:#C9A84C;letter-spacing:6px;margin-bottom:12px;">' + code + '</div>' +
        '<button onclick="_copyCode(\'' + code + '\')" style="width:100%;padding:10px;background:linear-gradient(135deg,#C9A84C,#E2C05A);color:#1A3A5C;border:none;border-radius:12px;font-size:14px;font-weight:800;cursor:pointer;font-family:var(--font);">📋 העתק קוד</button>' +
      '</div>' +
      '<button onclick="_shareBuilding(\'' + url + '\',\'' + code + '\')" style="width:100%;margin-top:16px;padding:12px;background:#25D366;color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:900;cursor:pointer;font-family:var(--font);">💬 שלח לדייר בוואטסאפ</button>' +
    '</div>';

    document.body.appendChild(ov);
  } catch(e){ showToast('שגיאה בטעינת פרטי בניין'); }
}

function _copyBuildingUrl(url){
  try{ navigator.clipboard.writeText(url); showToast('הלינק הועתק ✅'); } catch(e){ showToast('לא ניתן להעתיק'); }
}

function _copyCode(code){
  try{ navigator.clipboard.writeText(code); showToast('הקוד הועתק ✅'); } catch(e){ showToast('לא ניתן להעתיק'); }
}

function _shareBuilding(url, code){
  var msg = 'שלום! הוזמנת לאפליקציית ועד הבית שלנו 🏢\n\nלחצו על הקישור:\n' + url + '\n\nקוד גישה: ' + code;
  if(navigator.share){
    navigator.share({ title:'שכנות טובה', text:msg }).catch(function(){});
  } else {
    var wa = 'https://wa.me/?text=' + encodeURIComponent(msg);
    window.open(wa, '_blank');
  }
}
