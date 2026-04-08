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
  setText('hdr-balance',   num(_calcBalance()));
  setText('bldg-sett-sub', supabaseName || b.name);
  setText('sl-user',       '👤 '+u.name);
  setText('user-sett-sub', 'דירה '+u.unit);
}

/* ═══════════════════════════════════════════════════════════════
   HOME PAGE
═══════════════════════════════════════════════════════════════ */

function _calcBalance(){
  // הכנסות — כל התשלומים המאושרים
  var totalIncome = 0;
  Object.keys(DB.approvedReceipts||{}).forEach(function(k){
    var r = DB.approvedReceipts[k];
    if(r) totalIncome += parseFloat(r.amount)||0;
  });
  // הוצאות — יחסיות לזמן
  // מוצאים את החודש הראשון שיש בו תשלום מאושר
  var now = new Date();
  var earliestMk = null;
  Object.keys(DB.approvedReceipts||{}).forEach(function(k){
    var mk = k.slice(k.indexOf('-')+1);
    if(!earliestMk || mk < earliestMk) earliestMk = mk;
  });
  var monthsActive = 1;
  if(earliestMk){
    var parts = earliestMk.split('-');
    var startYear = parseInt(parts[0])||now.getFullYear();
    var startMonth = parseInt(parts[1])||1;
    monthsActive = (now.getFullYear()-startYear)*12 + (now.getMonth()+1-startMonth) + 1;
    if(monthsActive < 1) monthsActive = 1;
  }
  var MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  var totalExpenses = 0;
  (DB.finance.expenses||[]).forEach(function(e){
    var amt = parseFloat(e.amount)||0;
    if(e.expType==='קבועה'){
      totalExpenses += amt * monthsActive;
    } else {
      // חד פעמית — רק אם החודש שלה כבר עבר או החודש הנוכחי
      var eMonth = MONTHS_HE.indexOf(e.month);
      if(eMonth !== -1 && eMonth <= now.getMonth()) totalExpenses += amt;
      else if(!e.month) totalExpenses += amt;
    }
  });
  return totalIncome - totalExpenses;
}

function _calcMonthIncome(mk){
  var total = 0;
  Object.keys(DB.approvedReceipts||{}).forEach(function(k){
    var r = DB.approvedReceipts[k];
    var keyMk = k.indexOf('-') > -1 ? k.slice(k.indexOf('-')+1) : '';
    if(r && keyMk === mk) total += parseFloat(r.amount)||0;
  });
  return total;
}

function renderHomePage(){
  var tgt = getTargetDate();
  var mk  = monthKey(tgt);
  var monthIncome = _calcMonthIncome(mk);
  var balance = _calcBalance();
  setText('donut-home-num', '₪'+num(balance));
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
  setText('fund-bal-val',     '₪'+num(_calcBalance()));
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
  if(el) el.innerHTML = '';
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

  html += '<button onclick="toggleQuarterlyReport()" style="width:100%;margin-top:12px;padding:10px;background:#EFF6FF;color:#1E40AF;border:none;border-radius:12px;font-size:13px;font-weight:800;cursor:pointer;font-family:var(--font);">📊 דוח רבעוני ▾</button>';
  html += '<div id="quarterly-report" style="display:none;"></div>';
  el.innerHTML = html;
}


function toggleQuarterlyReport(){
  var el = document.getElementById('quarterly-report');
  if(!el) return;
  var isHidden = el.style.display === 'none' || el.style.display === '';
  if(isHidden){
    el.style.display = 'block';
    renderQuarterlyReport();
  } else {
    el.style.display = 'none';
  }
}

function renderQuarterlyReport(){
  var el = document.getElementById('quarterly-report');
  if(!el) return;
  var now = new Date();
  var MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  var html = '<div style="padding:12px 0;">';
  for(var i=2; i>=0; i--){
    var d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    var mk = monthKey(d);
    var mName = fmtMonth(d);
    // הכנסות
    var income = 0;
    Object.keys(DB.approvedReceipts||{}).forEach(function(k){
      var keyMk = k.slice(k.indexOf('-')+1);
      if(keyMk === mk) income += parseFloat(DB.approvedReceipts[k].amount)||0;
    });
    // הוצאות
    var expenses = 0;
    (DB.finance.expenses||[]).forEach(function(e){
      var amt = parseFloat(e.amount)||0;
      if(e.expType==='קבועה'){ expenses += amt; }
      else if(e.month === MONTHS_HE[d.getMonth()]){ expenses += amt; }
    });
    var balance = income - expenses;
    var balColor = balance >= 0 ? '#16A34A' : '#DC2626';
    html += '<div style="border-bottom:1px solid #F1F5F9;padding:10px 0;">'+
      '<div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:8px;">'+mName+'</div>'+
      '<div style="display:flex;gap:8px;">'+
        '<div style="flex:1;background:#F0FDF4;border-radius:10px;padding:10px;text-align:center;">'+
          '<div style="font-size:14px;font-weight:900;color:#16A34A;">₪'+num(income)+'</div>'+
          '<div style="font-size:10px;color:var(--slate);">הכנסות</div>'+
        '</div>'+
        '<div style="flex:1;background:#FEF2F2;border-radius:10px;padding:10px;text-align:center;">'+
          '<div style="font-size:14px;font-weight:900;color:#DC2626;">₪'+num(expenses)+'</div>'+
          '<div style="font-size:10px;color:var(--slate);">הוצאות</div>'+
        '</div>'+
        '<div style="flex:1;background:#F8FAFC;border-radius:10px;padding:10px;text-align:center;">'+
          '<div style="font-size:14px;font-weight:900;color:'+balColor+';">₪'+num(balance)+'</div>'+
          '<div style="font-size:10px;color:var(--slate);">יתרה</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }
  html += '</div>';
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
    var photosHtml = '';
    if(m.photo_url) photosHtml += '<img src="'+m.photo_url+'" style="width:100%;border-radius:10px;margin-top:8px;max-height:160px;object-fit:cover;" alt="תמונת לפני">';
    if(m.photo_after_url) photosHtml += '<div style="font-size:11px;font-weight:700;color:#16A34A;margin-top:6px;">✅ תמונת אחרי:</div><img src="'+m.photo_after_url+'" style="width:100%;border-radius:10px;margin-top:4px;max-height:160px;object-fit:cover;" alt="תמונת אחרי">';
    return '<div class="maint-item done-item">'+
      '<div class="mi-icon">✅</div>'+
      '<div class="mi-body">'+
        '<div class="mi-title">'+escHtml(m.title)+'</div>'+
        '<div class="mi-sub">📍 '+escHtml(m.loc)+' · '+escHtml(m.desc)+'</div>'+
        photosHtml+
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

  var openPhotosHtml = '';
  if(m.photo_url) openPhotosHtml += '<img src="'+m.photo_url+'" style="width:100%;border-radius:10px;margin-top:8px;max-height:160px;object-fit:cover;" alt="תמונת לפני">';
  return '<div class="maint-item">'+
    '<div class="mi-icon">🔧</div>'+
    '<div class="mi-body">'+
      '<div class="mi-title">'+escHtml(m.title)+'</div>'+
      '<div class="mi-sub">📍 '+escHtml(m.loc)+' · '+escHtml(m.desc)+'</div>'+
      openPhotosHtml+
      '<div class="mi-meta">'+
        '<span class="'+priClass+'">'+priTxt+'</span>'+
        '<select class="st-sel" onchange="updateMaintStatus(\''+m.id+'\',this.value)">'+stOpts+'</select>'+
        '<span class="mi-date">'+m.date+'</span>'+
        (ADMIN_ON
          ? '<button class="mark-done-btn" onclick="updateMaintStatus(\''+m.id+'\',\'done\')">✅ סמן כבוצע</button>'+
            '<button class="mark-done-btn" style="background:linear-gradient(135deg,#3B82F6,#1D4ED8);margin-right:4px;" onclick="openOrderProfSheet(\''+m.id+'\',\''+escHtml(m.domain||'')+'\')">הזמן ספק</button>'
