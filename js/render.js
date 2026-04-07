/* ═══════════════════════════════════════════════════════════════
   render.js — שכנות טובה · SmartNeighbor
   כל פונקציות הרינדור — מה שרואים על המסך
   תלוי ב: config.js, utils.js, db.js
═══════════════════════════════════════════════════════════════ */
function renderHeader(){
  var b = DB.building;
  var u = DB.user;
  // שם הבניין — מועדף מ-Supabase (sn_building_data) אם קיים
  var supabaseName = '';
  var supabaseCity = '';
  try{
    var sbRaw = localStorage.getItem('sn_building_data');
    if(sbRaw){
      var sbData = JSON.parse(sbRaw);
      supabaseName = sbData.building_name || '';
      supabaseCity = sbData.city || '';
    }
  } catch(e){}
  var cityDisplay = supabaseCity || b.city || '';
  setText('hdr-bldg',      supabaseName || b.name);
  setText('hdr-bldg-sub',  cityDisplay + (cityDisplay ? ' · ' : '') + b.total_units+' דיירים');
  setText('hdr-name',      u.name.split(' ')[0]);
  setText('hdr-greeting',  'דירה '+u.unit);
  setText('hdr-balance',   num(DB.finance.balance));
  setText('bldg-sett-sub', supabaseName || b.name);
  setText('sl-user',       '👤 '+u.name);
  setText('user-sett-sub', 'דירה '+u.unit);
}

/* ═══════════════════════════════════════════════════════════════
   HOME PAGE
═══════════════════════════════════════════════════════════════ */

function _calcMonthIncome(mk){
  var total = 0;
  Object.keys(DB.approvedReceipts||{}).forEach(function(k){
    var r = DB.approvedReceipts[k];
    if(r && r.monthKey === mk) total += parseFloat(r.amount)||0;
  });
  return total;
}

function renderHomePage(){
  var tgt = getTargetDate();
  var mk  = monthKey(tgt);
  var monthIncome = _calcMonthIncome(mk);
  setText('donut-home-num', '₪'+num(DB.finance.balance));
  setText('income-lbl',     '₪'+num(monthIncome));
  var unit= DB.user.unit;
  var tot = DB.building.total_units;
  var paidCount = countPaid(mk);
  var pct = Math.round(paidCount/tot*100);
  setText('donut-home', pct+'%');

  // quick pay card
  renderQuickPayCard();

  // pay banner
  updatePayBanner(mk, unit);
  updateReportPaidBtn(mk, unit);

  // maintenance (show max 3)
  var maint = getActiveMaint().slice(0,3);
  var html = '';
  maint.forEach(function(m){
    html += renderMaintItem(m, false);
  });
  if(!html) html = '<div class="empty-state">אין תקלות פתוחות ✅</div>';
  setHTML('home-maint', html);

  // notices
  var nhtml = '';
  DB.notices.slice(0,2).forEach(function(n){
    nhtml += renderNoticeRow(n);
  });
  setHTML('home-notices', nhtml||'<div class="empty-state">אין הודעות</div>');

  // posts
  // (community posts are shown in community tab only — no separate section on home page)
}

/* ═══════════════════════════════════════════════════════════════
   FUND PAGE
═══════════════════════════════════════════════════════════════ */
function renderFundPage(){
  var tgt = getTargetDate();
  var mk  = monthKey(tgt);
  var isCur = isCurrentMonth(tgt);
  var lbl = isCur ? 'חודש נוכחי' : (MONTH_OFFSET<0?'חודש קודם':'חודש עתידי');
  setText('fund-month-lbl',   lbl);
  setText('fund-month-badge', fmtMonth(tgt));
  var fundIncome = _calcMonthIncome(mk);
  setText('fund-bal-val',     '₪'+num(DB.finance.balance));
  setText('fund-income-val',  '₪'+num(fundIncome));

  // resident summary
  var unit = DB.user.unit;
  var tot  = DB.building.total_units;
  var paidCount = countPaid(mk);
  var pct = Math.round(paidCount/tot*100);
  setText('rcs-paid-val',  paidCount);
  setText('rcs-total-val', tot);
  setText('rcs-pct-val',   pct+'%');

  // my status
  updatePayBanner(mk, unit);
  updateMyPill(mk, unit);

  // dots
  renderCollDots(mk);

  // payment history (12 months)
  renderPayHistory(unit);

  // donut
  renderDonut('donut-fund', DB.finance.expenses, 'donut-fund-num', 'donut-fund-lbl', 'fund-legend');
  renderExpList();
}

function updatePayBanner(mk, unit){
  var unitKey = unit+'-'+mk;
  var isApproved = !!DB.approvedReceipts[unitKey];
  var isPending  = DB.pendingPayments.some(function(p){ return p.unit===unit && p.monthKey===mk; });
  var banner = document.getElementById('pay-banner');
  if(!banner) return;

  banner.className = 'pay-banner';
  var icon = document.getElementById('pb-icon');
  var text = document.getElementById('pb-text');
  var sub  = document.getElementById('pb-sub');
  var pnow = document.getElementById('pay-now-btn');
  var vr   = document.getElementById('view-receipt-btn');

  if(isApproved){
    banner.classList.add('paid');
    if(icon) icon.textContent='✅';
    if(text) text.textContent='תשלום אושר על ידי ועד הבית';
    if(sub)  sub.textContent='חודש '+fmtMonth(getTargetDate());
    if(pnow) pnow.style.display='none';
    if(vr)   vr.style.display='block';
  } else if(isPending){
    banner.classList.add('pending');
    if(icon) icon.textContent='⏳';
    if(text) text.textContent='דיווח התקבל — ממתין לאישור ועד';
    if(sub)  sub.textContent='חודש '+fmtMonth(getTargetDate());
    if(pnow){ pnow.textContent='💳 עדכן דיווח'; pnow.style.display='inline-flex'; }
    if(vr)   vr.style.display='none';
  } else {
    banner.classList.add('unpaid');
    if(icon) icon.textContent='💳';
    if(text) text.textContent='ועד הבית ממתין לתשלום';
    if(sub)  sub.textContent='₪'+DB.building.monthly_fee+' לחודש '+fmtMonth(getTargetDate());
    if(pnow){ pnow.textContent='💳 לתשלום'; pnow.style.display='inline-flex'; }
    if(vr)   vr.style.display='none';
  }
}

function updateMyPill(mk, unit){
  var unitKey = unit+'-'+mk;
  var isApproved = !!DB.approvedReceipts[unitKey];
  var isPending  = DB.pendingPayments.some(function(p){ return p.unit===unit && p.monthKey===mk; });
  var pill = document.getElementById('my-status-pill');
  if(!pill) return;
  pill.className = 'my-pill-compact';
  if(isApproved){
    pill.classList.add('paid');
    setHTML('my-status-pill','<span>✅</span><span>שולם</span>');
  } else if(isPending){
    pill.classList.add('pending');
    setHTML('my-status-pill','<span>⏳</span><span>ממתין</span>');
  } else {
    pill.classList.add('unpaid');
    setHTML('my-status-pill','<span>⏰</span><span>טרם שולם</span>');
  }
}

function renderCollDots(mk){
  var el = document.getElementById('coll-dots-public');
  if(!el) return;
  var tot = DB.building.total_units;
  var html = '';
  for(var i=1;i<=tot;i++){
    var unitKey = i+'-'+mk;
    var cls = 'unit-dot';
    if(DB.approvedReceipts[unitKey]) cls+=' paid';
    else if(DB.pendingPayments.some(function(p){ return p.unit===i && p.monthKey===mk; })) cls+=' pending';
    else cls+=' unpaid';
    html += '<div class="'+cls+'" title="דירה '+i+'">'+i+'</div>';
  }
  el.innerHTML = html;
}

function countPaid(mk){
  var c = 0;
  var tot = DB.building.total_units;
  for(var i=1;i<=tot;i++){
    if(DB.approvedReceipts[i+'-'+mk]) c++;
  }
  return c;
}

function renderPayHistory(unit){
  var el = document.getElementById('pay-grid');
  if(!el) return;
  var now = new Date();
  var html = '';
  for(var i=-5;i<=6;i++){
    var d = new Date(now.getFullYear(), now.getMonth()+i, 1);
    var mk = monthKey(d);
    var unitKey = unit+'-'+mk;
    var paid = !!DB.approvedReceipts[unitKey];
    var pending = DB.pendingPayments.some(function(p){ return p.unit===unit && p.monthKey===mk; });
    var cls = paid ? 'pay-cell paid' : (pending ? 'pay-cell' : 'pay-cell unpaid');
    var icon = paid ? '✅' : (pending ? '⏳' : '');
    var shortMo = HE_MONTHS[d.getMonth()].slice(0,3);
    html += '<div class="'+cls+'"><span class="pay-mo">'+shortMo+'</span><span class="pay-icon">'+icon+'</span></div>';
  }
  el.innerHTML = html;
}

function renderDonut(svgId, expenses, numId, lblId, legId){
  var svg = document.getElementById(svgId);
  if(!svg) return;
  var total = expenses.reduce(function(a,e){ return a+e.amount; },0);
  if(numId) setText(numId, '₪'+num(total));
  if(lblId) setText(lblId, 'הוצאות');
  var cx=55, cy=55, r=42, sw=16;
  var circ = 2*Math.PI*r;
  var off  = 0;
  var paths = '';
  expenses.forEach(function(e){
    var pct = total>0 ? e.amount/total : 0;
    var dash = pct*circ;
    var gap  = circ-dash;
    paths += '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none"'+
      ' stroke="'+e.color+'" stroke-width="'+sw+'"'+
      ' stroke-dasharray="'+dash.toFixed(2)+' '+gap.toFixed(2)+'"'+
      ' stroke-dashoffset="'+(-off*circ).toFixed(2)+'"'+
      ' transform="rotate(-90 '+cx+' '+cy+')" />';
    off += pct;
  });
  svg.innerHTML = paths;
  if(legId){
    var legEl = document.getElementById(legId);
    if(legEl){
      var lhtml = '';
      expenses.forEach(function(e){
        var pct = total>0 ? Math.round(e.amount/total*100) : 0;
        lhtml += '<div class="legend-item">'+
          '<div class="legend-dot" style="background:'+e.color+'"></div>'+
          '<span class="legend-cat">'+e.cat+'</span>'+
          '<span class="legend-pct">'+pct+'%</span></div>';
      });
      legEl.innerHTML = lhtml;
    }
  }
}

function renderExpList(){
  var el = document.getElementById('fund-exp-list');
  if(!el) return;

  var MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  var now = new Date();
  var curYear = now.getFullYear();

  // איסוף שנים שיש בהן הוצאות חד פעמיות
  var extraYears = {};
  DB.finance.expenses.forEach(function(e){
    if(e.expType !== 'קבועה' && e.month){
      // אנחנו שומרים שנה רק אם יש שדה year, אחרת נניח שנה נוכחית
      var yr = e.year ? parseInt(e.year) : curYear;
      if(yr !== curYear) extraYears[yr] = true;
    }
  });
  var years = Object.keys(extraYears).map(Number).sort();
  years.push(curYear);

  var html = '';

  years.forEach(function(year){
    if(years.length > 1){
      html += '<div style="font-size:12px;font-weight:700;color:var(--slate);padding:10px 0 6px;border-bottom:1px solid var(--border);margin-bottom:8px;">'+year+'</div>';
    }

    // רשת קוביות — 3 בשורה
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">';

    MONTHS_HE.forEach(function(m){
      // הוצאות קבועות תמיד
      var recurring = DB.finance.expenses.filter(function(e){ return e.expType==='קבועה'; });
      // הוצאות חד פעמיות של חודש זה ושנה זו
      var oneTime = DB.finance.expenses.filter(function(e){
        var eYear = e.year ? parseInt(e.year) : curYear;
        return e.expType !== 'קבועה' && e.month === m && eYear === year;
      });
      var allExp = recurring.concat(oneTime);
      var total = allExp.reduce(function(a,e){ return a + (Number(e.amount)||0); }, 0);
      var hasOneTime = oneTime.length > 0;
      var isCurrentMonth = (m === MONTHS_HE[now.getMonth()] && year === curYear);

      var cardBg = isCurrentMonth ? '#EFF6FF' : '#F8FAFC';
      var borderCol = isCurrentMonth ? '#93C5FD' : '#E2E8F0';
      var totalColor = isCurrentMonth ? '#1E40AF' : '#1E3A5F';

      html += '<div onclick="toggleExpMonth(&quot;'+m+'-'+year+'&quot;)" style="background:'+cardBg+';border:1.5px solid '+borderCol+';border-radius:10px;padding:8px 6px;cursor:pointer;transition:box-shadow 0.15s;">'+
        '<div style="font-size:11px;font-weight:700;color:var(--slate);margin-bottom:4px;text-align:center;">'+m+'</div>'+
        '<div style="font-size:14px;font-weight:900;color:'+totalColor+';text-align:center;">₪'+num(total)+'</div>'+
        (hasOneTime ? '<div style="font-size:9px;color:#F59E0B;text-align:center;margin-top:2px;">+'+oneTime.length+' חד פעמית</div>' :
                      '<div style="font-size:9px;color:#94A3B8;text-align:center;margin-top:2px;">🔄 קבועות</div>')+
        '</div>';
    });

    html += '</div>';

    // פאנל פירוט — מוסתר כברירת מחדל
    MONTHS_HE.forEach(function(m){
      var recurring = DB.finance.expenses.filter(function(e){ return e.expType==='קבועה'; });
      var oneTime = DB.finance.expenses.filter(function(e){
        var eYear = e.year ? parseInt(e.year) : curYear;
        return e.expType !== 'קבועה' && e.month === m && eYear === year;
      });
      var allExp = recurring.concat(oneTime);
      var total = allExp.reduce(function(a,e){ return a+(Number(e.amount)||0); },0);

      html += '<div id="exp-month-'+m+'-'+year+'" style="display:none;margin-bottom:10px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;overflow:hidden;">';
      html += '<div style="padding:8px 12px;background:#E8F0F8;font-size:12px;font-weight:700;color:var(--navy);display:flex;justify-content:space-between;align-items:center;">'+
        '<span>'+m+' '+year+'</span>'+
        '<span>סה"כ: ₪'+num(total)+'</span>'+
        '</div>';

      allExp.forEach(function(e, i){
        var idx = DB.finance.expenses.indexOf(e);
        var typeBadge = e.expType==='קבועה'
          ? '<span style="font-size:9px;background:#DBEAFE;color:#1E40AF;border-radius:3px;padding:1px 5px;">קבועה</span>'
          : '<span style="font-size:9px;background:#FEF9C3;color:#92400E;border-radius:3px;padding:1px 5px;">חד פעמית</span>';
        var bg = i%2===0 ? '#FFFFFF' : '#F8FAFC';
        html += '<div onclick="openExpDetail('+idx+')" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:'+bg+';cursor:pointer;border-top:1px solid #F1F5F9;">'+
          '<div style="width:10px;height:10px;border-radius:3px;flex-shrink:0;background:'+e.color+';"></div>'+
          '<div style="flex:1;min-width:0;">'+
            '<div style="font-size:12px;font-weight:700;color:var(--navy);">'+escHtml(e.cat)+'</div>'+
            '<div style="font-size:10px;color:var(--slate);display:flex;gap:4px;align-items:center;">'+typeBadge+(e.receiptSupplier?'<span>· '+escHtml(e.receiptSupplier)+'</span>':'')+'</div>'+
          '</div>'+
          '<div style="font-size:13px;font-weight:900;color:var(--navy);">₪'+num(e.amount)+'</div>'+
        '</div>';
      });

      html += '</div>';
    });
  });

  el.innerHTML = html;
}

function toggleExpMonth(key){
  var el = document.getElementById('exp-month-'+key);
  if(!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

/* ═══════════════════════════════════════════════════════════════
   FAULTS PAGE
═══════════════════════════════════════════════════════════════ */
function getActiveMaint(){
  var now = Date.now();
  return (DB.maintenance||[]).filter(function(m){
    if(m.status==='done' && m.doneAt){
      try{ if(now-m.doneAt > 48*3600*1000) return false; } catch(e){}
    }
    return true;
  });
}

function renderFaultsPage(){
  var el = document.getElementById('full-maint');
  if(!el) return;
  // הצג/הסתר באנר הנחיה למנהל
  var hint = document.getElementById('faults-admin-hint');
  if(hint) hint.style.display = ADMIN_ON ? 'none' : 'flex';
  var items = getActiveMaint();
  var html = '';
  items.forEach(function(m){
    html += renderMaintItem(m, true);
  });
  if(!html) html = '<div class="empty-state">🎉 אין תקלות פתוחות</div>';
  el.innerHTML = html;

  // תקלות שבוצעו — לחשבונית (למנהל בלבד)
  if(ADMIN_ON){
    var now = Date.now();
    var doneFaults = (DB.maintenance||[]).filter(function(m){
      return m.status==='done';
    });
    if(doneFaults.length){
      var doneHtml = '<div style="margin-top:20px;padding:0 2px;">'+
        '<div style="font-size:13px;font-weight:800;color:var(--slate);margin-bottom:8px;">✅ תקלות שבוצעו — להנפקת חשבונית</div>';
      doneFaults.forEach(function(m){
        var dateStr = m.completionDate ? fmtDate(new Date(m.completionDate)) : (m.date||'');
        doneHtml +=
          '<div style="background:#F0FDF4;border-radius:14px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;justify-content:space-between;gap:10px;">'+
            '<div>'+
              '<div style="font-size:13px;font-weight:800;color:var(--navy);">'+escHtml(m.title)+'</div>'+
              '<div style="font-size:11px;color:var(--slate);margin-top:2px;">'+escHtml(m.loc||'')+(dateStr?' · '+dateStr:'')+'</div>'+
            '</div>'+
            '<button onclick="openFaultInvoiceSheet(\''+m.id+'\',\''+escHtml(m.title)+'\')" '+
              'style="padding:8px 14px;background:linear-gradient(135deg,#F59E0B,#D97706);color:#fff;border:none;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;font-family:var(--font);white-space:nowrap;">'+
              '💰 חשבונית'+
            '</button>'+
          '</div>';
      });
      doneHtml += '</div>';
      el.innerHTML += doneHtml;
    }
  }
}

function renderMaintItem(m, showAdmin){
  var priClass = 'pri-badge pri-'+m.pri;
  var priTxt   = m.pri==='high'?'דחוף':m.pri==='med'?'רגיל':'נמוך';

  // ── Done state ──────────────────────────────────────────────
  if(m.status==='done'){
    var doneDate = m.doneAt ? new Date(m.doneAt) : null;
    var doneDateStr = doneDate
      ? ('0'+doneDate.getDate()).slice(-2)+'/'+('0'+(doneDate.getMonth()+1)).slice(-2)+'/'+doneDate.getFullYear()+
        ' '+('0'+doneDate.getHours()).slice(-2)+':'+('0'+doneDate.getMinutes()).slice(-2)
      : '—';
    var remainStr = '';
    if(m.doneAt){
      var msLeft = (m.doneAt + 48*3600*1000) - Date.now();
      if(msLeft > 0){
        var hLeft = Math.floor(msLeft/3600000);
        var mLeft = Math.floor((msLeft%3600000)/60000);
        remainStr = 'נעלם בעוד '+hLeft+'ש\' '+mLeft+'ד\'';
      }
    }
    return '<div class="maint-item done-item">'+
      '<div class="mi-icon">✅</div>'+
      '<div class="mi-body">'+
        '<div class="mi-title">'+escHtml(m.title)+'</div>'+
        '<div class="mi-sub">📍 '+escHtml(m.loc)+' · '+escHtml(m.desc)+'</div>'+
        '<div class="mi-meta">'+
          '<span class="done-badge">✔ בוצע</span>'+
          '<span class="done-time-pill">🕒 '+doneDateStr+'</span>'+
          (remainStr?'<span class="done-time-pill" style="color:#92400E;background:#FEF3C7;border-color:#FDE68A;">⏳ '+remainStr+'</span>':'')+
          (ADMIN_ON?'<button class="reopen-btn" onclick="updateMaintStatus(\''+m.id+'\',\'open\')">↩ פתח מחדש</button>':'')+
          (ADMIN_ON?'<button class="mark-done-btn" style="background:linear-gradient(135deg,#F59E0B,#D97706);margin-right:4px;" onclick="openFaultInvoiceSheet(\''+m.id+'\',\''+escHtml(m.title)+'\')" >💰 חשבונית</button>':'')+
        '</div>'+
      '</div></div>';
  }

  // ── Open / In-progress state ────────────────────────────────
  var stOpts = ADMIN_ON
    ? '<option value="open"  '+(m.status==='open'  ?'selected':'')+'>פתוח</option>'+
      '<option value="inprog"'+(m.status==='inprog'?'selected':'')+'>בטיפול</option>'
    : '<option value="open"  '+(m.status==='open'  ?'selected':'')+'>פתוח</option>'+
      '<option value="inprog"'+(m.status==='inprog'?'selected':'')+'>בטיפול</option>';

  return '<div class="maint-item">'+
    '<div class="mi-icon">🔧</div>'+
    '<div class="mi-body">'+
      '<div class="mi-title">'+escHtml(m.title)+'</div>'+
      '<div class="mi-sub">📍 '+escHtml(m.loc)+' · '+escHtml(m.desc)+'</div>'+
      '<div class="mi-meta">'+
        '<span class="'+priClass+'">'+priTxt+'</span>'+
        '<select class="st-sel" onchange="updateMaintStatus(\''+m.id+'\',this.value)">'+stOpts+'</select>'+
        '<span class="mi-date">'+m.date+'</span>'+
        (ADMIN_ON
          ? '<button class="mark-done-btn" onclick="updateMaintStatus(\''+m.id+'\',\'done\')">✅ סמן כבוצע</button>'
          : '')+
      '</div>'+
    '</div></div>';
}

function updateMaintStatus(id, status){
  if(status==='done' && !ADMIN_ON){
    showToast('⛔ סגירת תקלה מחייבת כניסת מנהל');
    renderFaultsPage(); return;
  }
  var updates = { status: status };
  if(status==='done'){
    updates.done_at = Date.now();
    updates.completion_date = new Date().toISOString();
  } else {
    updates.done_at = null;
    updates.completion_date = null;
  }
  sbClient.from('faults').update(updates).eq('id', id).then(function(res){
    if(res.error){ showToast('שגיאה: '+res.error.message); return; }
    // עדכן גם ב-DB המקומי
    var m = DB.maintenance.find(function(x){ return x.id===id; });
    if(m){
      m.status = status;
      m.doneAt = updates.done_at;
      m.completionDate = updates.completion_date;
    }
    if(status==='done') showToast('✅ תקלה סומנה כבוצעה — תיעלם אחרי 48 שעות');
    else showToast('סטטוס עודכן ✅');
    renderFaultsPage();
    renderHomePage();
  });
}

/* ═══════════════════════════════════════════════════════════════
   COMMUNITY PAGE
═══════════════════════════════════════════════════════════════ */
function renderCommunityPage(){
  // poll
  renderPoll();

  // notices feed (new card style)
  var nhtml = '';
  DB.notices.forEach(function(n){ nhtml += renderPostCard(n, 'notice'); });
  setHTML('comm-notices-feed', nhtml||'<div class="empty-state">אין הודעות</div>');

  // posts feed (new card style)
  var phtml = '';
  DB.posts.forEach(function(p){ phtml += renderPostCard(p, 'post'); });
  setHTML('comm-posts-feed', phtml||'<div class="empty-state">אין פוסטים</div>');

  // (backward compatibility calls removed — full-notices and full-posts elements no longer in DOM)
}

function renderPostCard(item, kind){
  var isNotice = kind==='notice';
  var type = item.type||'notice';
  var badgeLabels = {wish:'🎉 איחולים',gift:'🎁 מסירה/השאלה',notice:'📢 הודעה',urgent:'🚨 דחוף'};
  var badgeCls    = {wish:'comm-badge-wish',gift:'comm-badge-gift',notice:'comm-badge-notice',urgent:'comm-badge-urgent'};
  var avatarIcons = {wish:'🎉',gift:'🎁',notice:'📢',urgent:'🚨'};
  var bLbl  = badgeLabels[type]||'💬 פוסט';
  var bCls  = badgeCls[type]||'comm-badge-notice';
  var aIcon = avatarIcons[type]||'💬';
  var author = item.author || 'ועד הבית';
  var unit   = item.unit   ? ' · דירה '+item.unit : '';
  var canDel = isNotice
    ? (ADMIN_ON || (DB.user && DB.user.unit && DB.user.unit === item.unit))
    : (ADMIN_ON || (DB.user && DB.user.unit && String(DB.user.unit) === String(item.unit)));
  var delFn  = isNotice ? 'deleteNotice' : 'deletePost';
  var delBtn = canDel ? '<button onclick="'+delFn+'(\''+item.id+'\','+item.unit+')" style="margin-top:8px;padding:4px 10px;background:none;border:1px solid #FCA5A5;border-radius:8px;font-size:11px;font-weight:800;cursor:pointer;color:#EF4444;font-family:var(--font);">🗑️ מחק</button>' : '';
  return '<div class="post-card">'+
    '<span class="comm-type-badge '+bCls+'">'+bLbl+'</span>'+
    '<div class="post-card-header">'+
      '<div class="post-card-avatar '+type+'">'+aIcon+'</div>'+
      '<div><div class="post-card-author">'+escHtml(author)+unit+'</div>'+
      '<div class="post-card-time">'+escHtml(item.date||'')+'</div></div>'+
    '</div>'+
    (item.title?'<div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:3px;">'+escHtml(item.title)+'</div>':'') +
    '<div class="post-card-text">'+escHtml(item.text||item.desc||'')+'</div>'+
    delBtn+
  '</div>';
}

function renderNoticeRow(n){
  return '<div class="notice-row'+(n.type==='urgent'?' urgent':'')+'">'+
    '<div class="notice-title">'+(n.type==='urgent'?'🚨 ':'')+escHtml(n.title)+'</div>'+
    '<div class="notice-text">'+escHtml(n.text)+'</div>'+
    '<div class="notice-date">'+n.date+'</div></div>';
}

function renderPostRow(p){
  var icons = {wish:'🎉',gift:'🎁',notice:'📢',urgent:'🚨'};
  var ic = icons[p.type]||'💬';
  return '<div class="post-row">'+
    '<div class="post-icon">'+ic+'</div>'+
    '<div><div class="post-author">'+escHtml(p.author)+' · דירה '+p.unit+'</div>'+
    '<div class="post-text">'+escHtml(p.text)+'</div>'+
    '<div class="post-time">'+p.date+'</div></div></div>';
}

function renderPoll(){
  var poll = DB.poll;
  if(!poll) return;

  // הצג/הסתר כפתור סקר חדש לפי מצב מנהל
  var newPollBtn = document.getElementById('new-poll-btn');
  if(newPollBtn) newPollBtn.style.display = ADMIN_ON ? 'inline-block' : 'none';

  // אין סקר פעיל
  if(!poll.q || !poll.opts || !poll.opts.length){
    setHTML('poll-q', '<span style="color:var(--slate);font-size:12px;">אין סקר פעיל כרגע</span>');
    setHTML('poll-opts', '');
    setText('poll-footer', '');
    return;
  }

  setText('poll-q', poll.q);
  var total = poll.opts.reduce(function(a,o){ return a+o.votes; },0);

  // הצבעה לפי דירה
  var unit = DB.user ? DB.user.unit : null;
  var unitKey = unit ? String(unit) : null;
  var unitVotes = poll.unitVotes || {};
  var myVoteIdx = (unitKey && unitVotes[unitKey] !== undefined) ? unitVotes[unitKey] : null;
  var hasVoted = myVoteIdx !== null;

  var phtml = '';
  if(hasVoted){
    phtml = '<div class="voted-already">✅ דירה '+unit+' הצביעה: "'+escHtml(poll.opts[myVoteIdx].label)+'"</div>';
    poll.opts.forEach(function(o,i){
      var pct = total>0 ? Math.round(o.votes/total*100) : 0;
      var sel = i===myVoteIdx ? ' selected' : '';
      phtml += '<div class="poll-opt'+sel+'" style="cursor:default;">'+
        '<div style="display:flex;justify-content:space-between;">'+
        '<span style="font-size:13px;font-weight:700;">'+escHtml(o.label)+'</span>'+
        '<span style="font-size:12px;color:var(--slate);">'+pct+'%</span></div>'+
        '<div class="poll-bar-bg"><div class="poll-bar-fill" style="width:'+pct+'%;background:var(--blue);"></div></div></div>';
    });
    phtml += '<button class="change-vote-btn" onclick="changeVote()">↩ שנה הצבעה</button>';
  } else {
    poll.opts.forEach(function(o,i){
      var pct = total>0 ? Math.round(o.votes/total*100) : 0;
      phtml += '<div class="poll-opt" onclick="votePoll('+i+')">'+
        '<div style="display:flex;justify-content:space-between;">'+
        '<span style="font-size:13px;font-weight:700;">'+escHtml(o.label)+'</span>'+
        '<span style="font-size:12px;color:var(--slate);">'+pct+'%</span></div>'+
        '<div class="poll-bar-bg"><div class="poll-bar-fill" style="width:'+pct+'%;background:var(--blue);"></div></div></div>';
    });
  }
  setHTML('poll-opts', phtml);
  var votingUnits = Object.keys(unitVotes).length;
  setText('poll-footer', votingUnits+' דירות הצביעו · '+total+' הצבעות');
}

function votePoll(idx){
  var poll = DB.poll;
  if(!poll || !poll.id) return;
  var unit = DB.user ? DB.user.unit : null;
  if(!unit){ showToast('נא להיכנס קודם'); return; }
  var unitKey = String(unit);
  if(!poll.unitVotes) poll.unitVotes = {};
  // עדכון מקומי מיידי לתצוגה
  poll.unitVotes[unitKey] = idx;
  poll.opts[idx].votes++;
  renderPoll();
  // כתיבה לסופרבייס
  var updatedOptions   = poll.opts.map(function(o){ return {label:o.label,votes:o.votes}; });
  var updatedUnitVotes = poll.unitVotes;
  sbClient.from('polls').update({
    options:    updatedOptions,
    unit_votes: updatedUnitVotes
  }).eq('id', poll.id).then(function(res){
    if(res.error){ showToast('שגיאה בשמירת הצבעה: '+res.error.message); return; }
    showToast('הצבעתך נרשמה ✅');
  });
}

function changeVote(){
  var poll = DB.poll;
  if(!poll || !poll.id) return;
  var unit = DB.user ? DB.user.unit : null;
  if(!unit) return;
  var unitKey = String(unit);
  if(!poll.unitVotes) return;
  var prevIdx = poll.unitVotes[unitKey];
  if(prevIdx === undefined || prevIdx === null) return;
  // עדכון מקומי מיידי לתצוגה
  if(poll.opts[prevIdx]) poll.opts[prevIdx].votes = Math.max(0, poll.opts[prevIdx].votes-1);
  delete poll.unitVotes[unitKey];
  renderPoll();
  // כתיבה לסופרבייס
  var updatedOptions   = poll.opts.map(function(o){ return {label:o.label,votes:o.votes}; });
  var updatedUnitVotes = poll.unitVotes;
  sbClient.from('polls').update({
    options:    updatedOptions,
    unit_votes: updatedUnitVotes
  }).eq('id', poll.id).then(function(res){
    if(res.error){ showToast('שגיאה בעדכון הצבעה: '+res.error.message); return; }
    showToast('ניתן להצביע מחדש 🔄');
  });
}

/* ─── POLL ADMIN: יצירת סקר חדש ────────────────────────────── */
var _pollOptCount = 2;

function togglePollCreateForm(){
  var form = document.getElementById('poll-create-form');
  if(!form) return;
  var isOpen = form.style.display !== 'none';
  if(!isOpen){
    _pollOptCount = 2;
    var q = document.getElementById('poll-new-q');
    if(q) q.value = '';
    _renderPollOptInputs();
  }
  form.style.display = isOpen ? 'none' : 'block';
}

function _renderPollOptInputs(){
  var el = document.getElementById('poll-new-opts-list');
  if(!el) return;
  var html = '';
  for(var i=0;i<_pollOptCount;i++){
    html += '<div class="poll-opt-input-row">'+
      '<input class="admin-inp" id="poll-new-opt-'+i+'" type="text" placeholder="אפשרות '+(i+1)+'...">'+
      (_pollOptCount>2?'<button class="poll-opt-del" onclick="removePollOptInput('+i+')">✕</button>':'')+
    '</div>';
  }
  el.innerHTML = html;
}

function addPollOptInput(){
  var vals=[];
  for(var i=0;i<_pollOptCount;i++){
    var e=document.getElementById('poll-new-opt-'+i); if(e) vals.push(e.value);
  }
  _pollOptCount++;
  _renderPollOptInputs();
  for(var j=0;j<vals.length;j++){
    var inp=document.getElementById('poll-new-opt-'+j); if(inp) inp.value=vals[j];
  }
}

function removePollOptInput(idx){
  var vals=[];
  for(var i=0;i<_pollOptCount;i++){
    var e=document.getElementById('poll-new-opt-'+i); if(e) vals.push(e.value);
  }
  vals.splice(idx,1);
  _pollOptCount=Math.max(2,_pollOptCount-1);
  _renderPollOptInputs();
  for(var j=0;j<vals.length;j++){
    var inp=document.getElementById('poll-new-opt-'+j); if(inp) inp.value=vals[j];
  }
}

function createNewPoll(){
  if(!ADMIN_ON){ showToast('נדרשת כניסת מנהל'); return; }
  var slug = _getBuildingSlug();
  if(!slug){ showToast('שגיאה: לא זוהה בניין'); return; }
  var q=(document.getElementById('poll-new-q').value||'').trim();
  if(!q){ showToast('נא להזין שאלת סקר'); return; }
  var opts=[];
  for(var i=0;i<_pollOptCount;i++){
    var inp=document.getElementById('poll-new-opt-'+i);
    var v=inp?(inp.value||'').trim():'';
    if(v) opts.push({label:v,votes:0});
  }
  if(opts.length<2){ showToast('נדרשות לפחות 2 אפשרויות'); return; }
  // בטל סקרים קודמים ואז הוסף חדש
  sbClient.from('polls').update({is_active:false}).eq('building_slug', slug).then(function(){
    sbClient.from('polls').insert([{
      building_slug: slug,
      question:      q,
      options:       opts,
      unit_votes:    {},
      is_active:     true
    }]).then(function(res){
      if(res.error){ showToast('שגיאה בפרסום סקר: '+res.error.message); return; }
      loadPollFromSupabase(function(){
        togglePollCreateForm();
        renderCommunityPage();
        showToast('📊 סקר חדש פורסם ✅');
      });
    });
  });
}

/* ═══════════════════════════════════════════════════════════════
   DOCS PAGE
═══════════════════════════════════════════════════════════════ */
function renderDocsPage(){
  var html = '';
  DB.docs.forEach(function(d){
    html += '<div class="doc-row">'+
      '<span class="doc-icon">📄</span>'+
      '<div class="doc-info"><div class="doc-name">'+escHtml(d.name)+'</div>'+
      '<div class="doc-meta">'+d.cat+' · '+d.date+' · '+d.size+'</div></div>'+
      '<span class="doc-dl" onclick="showToast(\''+escHtml(d.name)+'\')">👁️</span></div>';
  });
  html += '<div class="doc-row" style="border-top:1px solid #F1F5F9;margin-top:4px;padding-top:10px;">'+
    '<span class="doc-icon">📋</span>'+
    '<div class="doc-info">'+
      '<div class="doc-name" style="color:var(--navy);">מדיניות פרטיות ותנאי שימוש — שכנות טובה</div>'+
      '<div class="doc-meta">מסמך רשמי · מרץ 2026</div>'+
    '</div>'+
    '<span class="doc-dl" onclick="window.open(\'terms.html\',\'_blank\')" title="צפייה" style="cursor:pointer;">👁️</span>'+
  '</div>';
  setHTML('docs-list', html||'<div class="empty-state">אין מסמכים</div>');

  // drive link
  var driveEl = document.getElementById('docs-drive-section');
  if(driveEl){
    if(DB.driveLink){
      driveEl.style.display='block';
      var dlinkEl = document.getElementById('docs-drive-link-a');
      if(dlinkEl){ dlinkEl.href=DB.driveLink; }
    } else {
      driveEl.style.display='none';
    }
  }

  // custom docs — published by vaad
  var cdocEl = document.getElementById('custom-docs-section');
  var cdocList = document.getElementById('custom-docs-list');
  var docs = DB.customDocs||[];
  if(cdocEl) cdocEl.style.display = docs.length ? 'block' : 'none';
  if(cdocList){
    if(!docs.length){
      cdocList.innerHTML = '<div class="empty-state">אין פרסומים עדיין</div>';
    } else {
      var chtml = '';
      docs.slice().reverse().forEach(function(d){
        if(d.type==='link'){
          chtml += '<div class="cdoc-card is-link">'+
            '<div class="cdoc-title">🔗 '+escHtml(d.title)+'</div>'+
            '<a class="cdoc-link-btn" href="'+escHtml(d.link)+'" target="_blank">'+
              '<span style="font-size:20px;">📂</span>'+
              '<div><div style="font-size:13px;font-weight:800;">פתח מסמך</div>'+
              '<div style="font-size:11px;color:var(--slate);margin-top:1px;">'+escHtml(d.link.length>40?d.link.slice(0,40)+'...':d.link)+'</div></div>'+
              '<span style="margin-right:auto;font-size:18px;">←</span>'+
            '</a>'+
            '<div class="cdoc-date">פורסם: '+escHtml(d.date)+'</div>'+
          '</div>';
        } else {
          chtml += '<div class="cdoc-card">'+
            '<div class="cdoc-title">📋 '+escHtml(d.title)+'</div>'+
            '<div class="cdoc-text">'+escHtml(d.text)+'</div>'+
            '<div class="cdoc-date">פורסם: '+escHtml(d.date)+'</div>'+
          '</div>';
        }
      });
      cdocList.innerHTML = chtml;
    }
  }

  // receipts
  var rhtml = '';
  DB.finance.expenses.forEach(function(e){
    rhtml += '<div class="doc-row" style="align-items:flex-start;">'+
      '<span class="doc-icon" style="margin-top:2px;">🧾</span>'+
      '<div class="doc-info" style="flex:1;">'+
        '<div class="doc-name">'+escHtml(e.cat)+'</div>'+
        '<div class="doc-meta">'+(e.receiptDate||'—')+' · '+(escHtml(e.receiptSupplier)||'ספק לא צוין')+'</div>'+
        (e.details?'<div style="font-size:11px;color:var(--slate);margin-top:2px;">'+escHtml(e.details)+'</div>':'')+
      '</div>'+
      '<div style="text-align:left;flex-shrink:0;">'+
        '<div style="font-size:14px;font-weight:900;color:var(--navy);">₪'+num(e.amount)+'</div>'+
      '</div>'+
    '</div>';
  });
  setHTML('docs-receipts-list', rhtml||'<div class="empty-state">אין הוצאות</div>');

  // reports
  setHTML('docs-reports-list','<div class="doc-row"><span class="doc-icon">📊</span><div class="doc-info"><div class="doc-name">דוח גבייה חודשי</div><div class="doc-meta">ינואר 2026</div></div><span class="doc-dl" onclick="exportCSV(\'full\')">⬇️</span></div>');
}

/* ═══════════════════════════════════════════════════════════════
   SETTINGS PAGE
═══════════════════════════════════════════════════════════════ */
function renderSettingsPage(){
  // admin show/hide
  document.querySelectorAll('.admin-only').forEach(function(el){
    el.style.display = ADMIN_ON ? 'block' : 'none';
  });
  document.getElementById('pin-locked-ui').style.display  = ADMIN_ON ? 'none' : 'block';
  document.getElementById('pin-unlocked-ui').style.display = ADMIN_ON ? 'block' : 'none';

  if(ADMIN_ON){
    // prefill fields
    val('admin-bldg-name', DB.building.name);
    val('admin-units',     DB.building.total_units);
    val('admin-fee',       DB.building.monthly_fee);
    val('admin-vaad-phone', DB.paySettings.vaadPhone||'');
    val('admin-bit',       DB.paySettings.bit||'');
    val('admin-paybox',    DB.paySettings.paybox||'');
    val('admin-bank-name', DB.paySettings.bankName||'');
    val('admin-bank-branch',DB.paySettings.bankBranch||'');
    val('admin-bank-account',DB.paySettings.bankAccount||'');
    val('admin-bank-owner', DB.paySettings.bankOwner||'');
    updateCfgLive();
    renderAdminCollBoard();
    renderBudgetManager();
    renderExpCatManager();
    renderDocCatManager();
    renderResidentsList();
    renderAdminFaultsList();
    renderCustomDocsAdmin();
    // drive link prefill
    val('admin-drive-link', DB.driveLink||'');
    initCollectionCenter();
  }
}

function updateCfgLive(){
  var u = document.getElementById('admin-units');
  var f = document.getElementById('admin-fee');
  var uv = u ? (u.value||DB.building.total_units) : DB.building.total_units;
  var fv = f ? (f.value||DB.building.monthly_fee) : DB.building.monthly_fee;
  var el = document.getElementById('cfg-units-live');
  if(el) el.textContent = uv+' דירות | ₪'+fv+' לחודש';
}

function renderAdminCollBoard(){
  var mk  = monthKey(getTargetDate());
  var tot = DB.building.total_units;
  var paidCount = countPaid(mk);
  var unpaid = tot - paidCount;
  var miss   = unpaid * DB.building.monthly_fee;
  var pct    = Math.round(paidCount/tot*100);

  setText('adm-paid-val',    paidCount);
  setText('adm-unpaid-val',  unpaid);
  setText('adm-missing-val', '₪'+num(miss));
  setText('coll-paid-count', paidCount+' שילמו');
  setText('coll-missing-amt','₪'+num(miss)+' חסר');
  var bar = document.getElementById('coll-bar');
  if(bar) bar.style.width = pct+'%';

  // pending
  var pendSec = document.getElementById('pending-payments-section');
  var pendList= document.getElementById('pending-list');
  if(DB.pendingPayments && DB.pendingPayments.length>0 && pendSec && pendList){
    pendSec.style.display='block';
    var badge = document.getElementById('pending-count-badge');
    if(badge){ badge.textContent=DB.pendingPayments.length; badge.style.display='inline-flex'; }
    var phtml='';
    DB.pendingPayments.forEach(function(p,i){
      phtml += '<div class="pending-row">'+
        '<span class="unit-num">'+p.unit+'</span>'+
        '<span style="font-size:12px;font-weight:700;flex:1;">'+escHtml(DB.unitNames[p.unit]||('דירה '+p.unit))+'</span>'+
        '<span class="method-pill">'+escHtml(p.methodLabel)+'</span>'+
        '<span style="font-size:12px;font-weight:800;">₪'+num(p.amount||DB.building.monthly_fee)+'</span>'+
        '<button class="pnd-approve" onclick="approvePayment('+i+')">✔ אשר</button>'+
        '<button class="pnd-reject"  onclick="rejectPayment('+i+')">✕</button></div>';
    });
    pendList.innerHTML = phtml;
  } else if(pendSec){
    pendSec.style.display='none';
  }

  // unit list
  var ulEl = document.getElementById('admin-unit-list');
  if(!ulEl) return;
  var uhtml = '';
  for(var i=1;i<=tot;i++){
    var unitKey = i+'-'+mk;
    var isApproved = !!DB.approvedReceipts[unitKey];
    var isPending  = DB.pendingPayments.some(function(p){ return p.unit===i && p.monthKey===mk; });
    var st = isApproved?'paid':(isPending?'pending':'unpaid');
    var stLbl = isApproved?'✅ שולם':(isPending?'⏳ ממתין':'טרם שולם');
    var name = DB.unitNames[i]||('דירה '+i);
    uhtml += '<div class="unit-admin-row">'+
      '<span class="unit-num">'+i+'</span>'+
      '<span class="unit-name">'+escHtml(name)+'</span>'+
      '<span class="status-pill '+st+'">'+stLbl+'</span>';
    if(!isApproved){
      uhtml += '<button class="quick-approve-btn" onclick="quickApprove('+i+')">✔</button>';
    }
    uhtml += '</div>';
  }
  ulEl.innerHTML = uhtml;
  updateNavDot();
}

function approvePayment(idx){
  if(!ADMIN_ON){ showToast('⛔ אישור תשלום מחייב כניסת מנהל'); return; }
  var p = DB.pendingPayments[idx];
  if(!p || !p.id) return;
  var approvedDate = fmtDate(new Date());
  var approvedBy   = DB.unitNames[DB.user.unit] || ('ועד בית');
  sbClient.from('payments').update({
    status:        'approved',
    approved_date: approvedDate,
    approved_by:   approvedBy
  }).eq('id', p.id).then(function(res){
    if(res.error){ showToast('שגיאה באישור: '+res.error.message); return; }
    showToast('תשלום אושר ✅');
    triggerWATray(p.unit, p.monthKey);
    loadPaymentsFromSupabase(function(){ renderAll(); });
  });
}

function quickApprove(unit){
  if(!ADMIN_ON){ showToast('⛔ אישור תשלום מחייב כניסת מנהל'); return; }
  var mk   = monthKey(getTargetDate());
  var slug = _getBuildingSlug();
  if(!slug){ showToast('שגיאה: לא זוהה בניין'); return; }
  var approvedBy = DB.unitNames[DB.user ? DB.user.unit : 0] || 'ועד בית';
  // מחק pending קיים לאותה דירה+חודש אם יש, ואז הוסף approved
  sbClient.from('payments').delete()
    .eq('building_slug', slug).eq('unit', unit).eq('month_key', mk).eq('status','pending')
    .then(function(){
      sbClient.from('payments').insert([{
        building_slug: slug,
        unit:         unit,
        month_key:    mk,
        status:       'approved',
        amount:       String(DB.building.monthly_fee),
        method:       'admin',
        method_label: 'אישור ידני',
        month_label:  fmtMonth(getTargetDate()),
        approved_date: fmtDate(new Date()),
        approved_by:  approvedBy
      }]).then(function(res){
        if(res.error){ showToast('שגיאה באישור: '+res.error.message); return; }
        showToast('✅ דירה '+unit+' אושרה');
        triggerWATray(unit, mk);
        loadPaymentsFromSupabase(function(){
          renderSettingsPage();
          renderFundPage();
          renderHomePage();
        });
      });
    });
}

function rejectPayment(idx){
  if(!ADMIN_ON){ showToast('⛔ נדרשת כניסת מנהל'); return; }
  var p = DB.pendingPayments[idx];
  if(!p || !p.id) return;
  sbClient.from('payments').delete().eq('id', p.id).then(function(res){
    if(res.error){ showToast('שגיאה במחיקה: '+res.error.message); return; }
    showToast('דיווח נדחה');
    loadPaymentsFromSupabase(function(){ renderSettingsPage(); });
  });
}

function saveCollectionData(){
  saveDB();
  showToast('💾 נשמר');
  renderSettingsPage();
}

/* ═══════════════════════════════════════════════════════════════
   BUDGET MANAGER
═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   ADMIN FAULTS LIST (settings page)
═══════════════════════════════════════════════════════════════ */
function renderAdminFaultsList(){
  var el = document.getElementById('admin-faults-list');
  if(!el) return;
  var items = getActiveMaint();
  if(!items.length){
    el.innerHTML = '<div class="empty-state">🎉 אין תקלות פתוחות כרגע</div>';
    return;
  }
  var html = '';
  items.forEach(function(m){
    var priTxt = m.pri==='high'?'🔴 דחוף':m.pri==='med'?'🟡 רגיל':'🟢 נמוך';
    if(m.status==='done'){
      // תקלה שכבר בוצעה — מציגה טיימר
      var doneDate = m.doneAt ? new Date(m.doneAt) : null;
      var doneDateStr = doneDate
        ? ('0'+doneDate.getDate()).slice(-2)+'/'+('0'+(doneDate.getMonth()+1)).slice(-2)+'/'+doneDate.getFullYear()+
          ' '+('0'+doneDate.getHours()).slice(-2)+':'+('0'+doneDate.getMinutes()).slice(-2)
        : '—';
      var remainStr = '';
      if(m.doneAt){
        var msLeft = (m.doneAt + 48*3600*1000) - Date.now();
        if(msLeft > 0){
          var hLeft = Math.floor(msLeft/3600000);
          var mLeft = Math.floor((msLeft%3600000)/60000);
          remainStr = 'נעלמת בעוד '+hLeft+'ש\' '+mLeft+'ד\'';
        }
      }
      html +=
        '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #F1F5F9;">'+
          '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#DCFCE7,#A7F3D0);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">✅</div>'+
          '<div style="flex:1;min-width:0;">'+
            '<div style="font-size:13px;font-weight:800;color:#166534;text-decoration:line-through;opacity:.8;">'+escHtml(m.title)+'</div>'+
            '<div style="font-size:11px;color:var(--slate);margin-top:2px;">📍 '+escHtml(m.loc)+'</div>'+
            '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;align-items:center;">'+
              '<span class="done-badge">✔ בוצע '+doneDateStr+'</span>'+
              (remainStr?'<span class="done-time-pill" style="color:#92400E;background:#FEF3C7;border-color:#FDE68A;">⏳ '+remainStr+'</span>':'')+
              '<button class="reopen-btn" onclick="updateMaintStatusFromAdmin(\''+m.id+'\',\'open\')">↩ פתח מחדש</button>'+
            '</div>'+
          '</div>'+
        '</div>';
    } else {
      // תקלה פתוחה — מציגה כפתור "סמן כבוצע"
      html +=
        '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-bottom:1px solid #F1F5F9;">'+
          '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#EFF6FF,#DBEAFE);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">🔧</div>'+
          '<div style="flex:1;min-width:0;">'+
            '<div style="font-size:13px;font-weight:800;color:var(--navy);">'+escHtml(m.title)+'</div>'+
            '<div style="font-size:11px;color:var(--slate);margin-top:2px;">📍 '+escHtml(m.loc)+' · '+escHtml(m.desc)+'</div>'+
            '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center;">'+
              '<span style="font-size:10px;font-weight:700;">'+priTxt+'</span>'+
              '<span style="font-size:10px;color:var(--slate);">'+m.date+'</span>'+
              '<button class="mark-done-btn" onclick="updateMaintStatusFromAdmin(\''+m.id+'\',\'done\')">✅ סמן כבוצע</button>'+
            '</div>'+
          '</div>'+
        '</div>';
    }
  });
  el.innerHTML = html;
}

function updateMaintStatusFromAdmin(id, status){
  var updates = { status: status };
  if(status==='done'){
    updates.done_at = Date.now();
    updates.completion_date = new Date().toISOString();
  } else {
    updates.done_at = null;
    updates.completion_date = null;
  }
  sbClient.from('faults').update(updates).eq('id', id).then(function(res){
    if(res.error){ showToast('שגיאה בעדכון סטטוס'); return; }
    // עדכן גם ב-DB המקומי
    var m = DB.maintenance.find(function(x){ return x.id===id; });
    if(m){
      m.status = status;
      m.doneAt = updates.done_at;
      m.completionDate = updates.completion_date;
    }
    if(status==='done') showToast('✅ תקלה סומנה כבוצעה — הדיירים יראו טיימר של 48 שעות');
    else showToast('↩ תקלה נפתחה מחדש');
    renderAdminFaultsList();
    renderFaultsPage();
    renderHomePage();
  });
}

var COLORS=['#3B82F6','#F59E0B','#22C55E','#8B5CF6','#EF4444','#14B8A6','#F97316','#EC4899','#06B6D4','#84CC16'];

function renderBudgetManager(){
  var el = document.getElementById('budget-rows-container');
  if(!el) return;
  var MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  var html = '';
  DB.finance.expenses.forEach(function(e,i){
    var typeOpts = ['קבועה','חד פעמית'].map(function(t){
      return '<option value="'+t+'"'+(e.expType===t?' selected':'')+'>'+t+'</option>';
    }).join('');
    var monthSel = '';
    if(e.expType !== 'קבועה'){
      var mOpts = '<option value=""'+((!e.month)?' selected':'')+'">—חודש—</option>';
      MONTHS.forEach(function(m){
        mOpts += '<option value="'+m+'"'+(e.month===m?' selected':'')+'>'+m+'</option>';
      });
      monthSel = '<select class="admin-inp" style="width:88px;" onchange="DB.finance.expenses['+i+'].month=this.value;saveDB()">'+mOpts+'</select>';
    } else {
      monthSel = '<span style="font-size:11px;color:var(--slate);width:88px;text-align:center;display:inline-block;">כל חודש</span>';
    }
    html += '<div class="budget-row" style="flex-wrap:wrap;gap:4px;">'+
      '<div class="br-color" style="background:'+e.color+'" onclick="cycleBrColor('+i+')"></div>'+
      '<input class="admin-inp" style="flex:1;min-width:80px;" value="'+escAttr(e.cat)+'" oninput="DB.finance.expenses['+i+'].cat=this.value;updateBudgetTotal()" onblur="saveDB()">'+
      '<input class="admin-inp" style="width:80px;" type="number" value="'+e.amount+'" oninput="DB.finance.expenses['+i+'].amount=+this.value||0;updateBudgetTotal()" onblur="saveDB()">'+
      '<select class="admin-inp" style="width:88px;" onchange="DB.finance.expenses['+i+'].expType=this.value;saveDB();renderBudgetManager()">'+typeOpts+'</select>'+
      monthSel+
      '<button class="br-del" onclick="delBudgetRow('+i+')">🗑️</button></div>';
  });
  el.innerHTML = html;
  updateBudgetTotal();
}

function cycleBrColor(i){
  var cur = COLORS.indexOf(DB.finance.expenses[i].color);
  DB.finance.expenses[i].color = COLORS[(cur+1)%COLORS.length];
  saveDB();
  renderBudgetManager();
}

function addBudgetRow(){
  DB.finance.expenses.push({cat:'חדש', amount:0, color:COLORS[DB.finance.expenses.length%COLORS.length], receiptDate:fmtDate(new Date()), receiptSupplier:'', details:'', expType:'חד פעמית', month:''});
  saveDB();
  renderBudgetManager();
}

function delBudgetRow(i){
  DB.finance.expenses.splice(i,1);
  saveDB();
  renderBudgetManager();
}

function updateBudgetTotal(){
  var tot = DB.finance.expenses.reduce(function(a,e){ return a+e.amount; },0);
  setText('budget-total-val','₪'+num(tot));
}

function saveBudget(){
  saveDB();
  showToast('תקציב עודכן ✅');
  renderFundPage();
  renderDocsPage();
}

/* ── DRIVE LINK ───────────────────────────────────────────────── */
/* ═══════════════════════════════════════════════════════════════
   CUSTOM DOCS MANAGER
═══════════════════════════════════════════════════════════════ */
var _newDocType = 'text'; // 'text' | 'link'

