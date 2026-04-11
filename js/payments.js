/* ═══════════════════════════════════════════════════════════════
   payments.js — שכנות טובה · SmartNeighbor
   תשלומים + קבלות + גבייה
   תלוי ב: config.js, utils.js, db.js
═══════════════════════════════════════════════════════════════ */
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
  var approvedBy   = DB.unitNames[DB.user.unit] || 'ועד בית';
  var slug         = _getBuildingSlug();
  var fee          = DB.building.monthly_fee || 0;
  var totalAmount  = parseFloat(p.amount) || fee;

  // חישוב חודשים מכוסים אוטומטית מהישן לחדש
  var months = _calcCoveredMonths(p.unit, totalAmount, fee);
  var monthLabels = months.map(function(m){ return m.label; }).join(' + ');

  // עדכון הרשומה הקיימת ל-approved + פירוט חודשים
  sbClient.from('payments').update({
    status:        'approved',
    approved_date: approvedDate,
    approved_by:   approvedBy,
    month_label:   monthLabels,
    note:          (p.note||'')+(months.length>1?' | חודשים: '+monthLabels:'')
  }).eq('id', p.id).then(function(res){
    if(res.error){ showToast('שגיאה באישור: '+res.error.message); return; }

    // אם יש יותר מחודש אחד — צור רשומות נוספות לכל חודש
    if(months.length > 1){
      var extraInserts = months.slice(1).map(function(m){
        return sbClient.from('payments').insert([{
          building_slug: slug, unit:p.unit, month_key:m.key,
          status:'approved', amount:String(m.amount),
          method:p.method||'', method_label:p.methodLabel||'',
          month_label:m.label, approved_date:approvedDate, approved_by:approvedBy
        }]);
      });
      Promise.all(extraInserts).then(function(){
        showToast('תשלום אושר ✅ ('+months.length+' חודשים)');
        triggerWATray(p.unit, p.monthKey);
        loadPaymentsFromSupabase(function(){ renderAll(); });
      });
    } else {
      showToast('תשלום אושר ✅');
      triggerWATray(p.unit, p.monthKey);
      loadPaymentsFromSupabase(function(){ renderAll(); });
    }
  });
}

function _calcCoveredMonths(unit, totalAmount, fee){
  // מוצא חודשים שלא שולמו — קודם עד 12 חודשים אחורה, אחר כך עד 12 חודשים קדימה
  // תומך בתשלום חלקי — ממלא חודש אחד לגמרי לפני שעובר לבא אחריו
  var months = [];
  var remaining = totalAmount;
  var now = new Date();

  function _tryMonth(d){
    if(remaining <= 0) return;
    var mk = monthKey(d);
    var alreadyPaidAmt = 0;
    Object.keys(DB.approvedReceipts||{}).forEach(function(k){ var r=DB.approvedReceipts[k]; if(r && r.unit==unit && r.monthKey===mk) alreadyPaidAmt += parseFloat(r.amount)||0; });
    var stillNeeded = fee - alreadyPaidAmt;
    if(stillNeeded <= 0) return;
    var isPending = DB.pendingPayments.some(function(pp){ return pp.unit===unit && pp.monthKey===mk; });
    if(isPending) return;
    var covered = Math.min(remaining, stillNeeded);
    months.push({ key:mk, label:fmtMonth(d), amount:covered, alreadyPaid:alreadyPaidAmt });
    remaining -= covered;
  }

  // חישוב נקודת ההתחלה — start_month מהגדרות הבניין או החודש הנוכחי
  var startMonthsBack = 0;
  if(DB.building && DB.building.startMonth){
    var sm = DB.building.startMonth.split('-');
    var smYear = parseInt(sm[0])||now.getFullYear();
    var smMonth = parseInt(sm[1])||now.getMonth()+1;
    startMonthsBack = (now.getFullYear()-smYear)*12 + (now.getMonth()+1-smMonth);
    if(startMonthsBack < 0) startMonthsBack = 0;
  }
  for(var i=startMonthsBack; i>=0; i--){
    _tryMonth(new Date(now.getFullYear(), now.getMonth()-i, 1));
  }
  for(var j=1; j<=12 && remaining>0; j++){
    _tryMonth(new Date(now.getFullYear(), now.getMonth()+j, 1));
  }

  if(!months.length){
    var d0 = new Date(now.getFullYear(), now.getMonth(), 1);
    months.push({ key:monthKey(d0), label:fmtMonth(d0), amount:totalAmount, alreadyPaid:0 });
  }
  return months;
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
function selectMethod(method){
  _payMethod = method;
  // highlight
  ['bit','paybox','bank','cash','check'].forEach(function(m){
    var b=document.getElementById('pmg-'+m);
    if(b) b.className = 'pmg-btn' + (m===method?' sel':'');
  });

  // show step 2
  document.getElementById('pay-s1').style.display='none';
  document.getElementById('pay-s2').style.display='block';
  document.getElementById('wa-section').style.display='none';

  var ps = DB.paySettings;
  var titles = {bit:'📱 ביט',paybox:'🟢 פייבוקס',bank:'🏦 העברה בנקאית',cash:'💵 מזומן',check:'📝 שיק'};
  setText('pay-title-txt', titles[method]||method);

  // show/hide sub-sections
  var dig = document.getElementById('ps2-digital');
  var bnk = document.getElementById('ps2-bank-box');
  var off = document.getElementById('ps2-offline-form');
  var ref = document.getElementById('opf-ref-wrap');
  dig.style.display='none'; bnk.style.display='none'; off.style.display='none';

  if(method==='bit'){
    dig.style.display='block';
    var url = ps.bit ? 'https://www.bitpay.co.il/app/payme?phone='+ps.bit : '';
    setText('ps2-digital-hint', ps.bit ? 'לחץ להעברה ישירה לחשבון ביט' : '⚠️ לא הוגדר מספר ביט בהגדרות');
    var lb = document.getElementById('ps2-launch-btn');
    if(lb){ lb.onclick = function(){ if(url) window.open(url,'_blank'); else showToast('לא הוגדר מספר ביט'); }; }
  } else if(method==='paybox'){
    dig.style.display='block';
    var pb = ps.paybox||'';
    setText('ps2-digital-hint', pb ? 'לחץ להצטרפות לקבוצת הפייבוקס' : '⚠️ לא הוגדר קישור פייבוקס');
    var lb2 = document.getElementById('ps2-launch-btn');
    if(lb2){ lb2.onclick = function(){ if(pb) window.open(pb,'_blank'); else showToast('לא הוגדר קישור פייבוקס'); }; }
  } else if(method==='bank'){
    bnk.style.display='block';
    setText('bd-bank',    ps.bankName||'—');
    setText('bd-branch',  ps.bankBranch||'—');
    setText('bd-account', ps.bankAccount||'—');
    setText('bd-owner',   ps.bankOwner||'—');
  } else if(method==='cash'){
    off.style.display='block';
    if(ref) ref.style.display='none';
  } else if(method==='check'){
    off.style.display='block';
    if(ref) ref.style.display='block';
  }
}

function launchPay(){
  // handled per method above via ps2-launch-btn onclick
}

function resetPay(){
  _payMethod = null;
  document.getElementById('pay-s1').style.display='block';
  document.getElementById('pay-s2').style.display='none';
  document.getElementById('wa-section').style.display='none';
  ['bit','paybox','bank','cash','check'].forEach(function(m){
    var b=document.getElementById('pmg-'+m); if(b) b.className='pmg-btn';
  });
}

function confirmPay(){
  if(!_payMethod){ showToast('בחר שיטת תשלום'); return; }
  var unit = DB.user.unit;
  var fee  = DB.building.monthly_fee || 0;
  var methodLabels={bit:'ביט',paybox:'פייבוקס',bank:'העברה בנקאית',cash:'מזומן',check:'שיק'};
  var mLbl = methodLabels[_payMethod]||_payMethod;
  // קריאת סכום לפי שיטה
  var amount = fee;
  if(_payMethod==='bit'||_payMethod==='paybox'){ var ae=document.getElementById('opf-amount-digital'); if(ae&&ae.value) amount=parseFloat(ae.value)||fee; }
  else if(_payMethod==='bank'){ var ab=document.getElementById('opf-amount-bank'); if(ab&&ab.value) amount=parseFloat(ab.value)||fee; }
  else { var ao=document.getElementById('opf-amount'); if(ao&&ao.value) amount=parseFloat(ao.value)||fee; }
  var mk = monthKey(new Date());
  var slug = _getBuildingSlug();
  if(!slug){ showToast('שגיאה: לא זוהה בניין'); return; }
  var ref  = (_payMethod==='bank') ? (document.getElementById('opf-ref-bank')?document.getElementById('opf-ref-bank').value:'') : (document.getElementById('opf-ref')?document.getElementById('opf-ref').value:'');
  var note = document.getElementById('opf-note') ? document.getElementById('opf-note').value : '';

  sbClient.from('payments').insert([{
    building_slug: slug,
    unit:         unit,
    month_key:    mk,
    status:       'pending',
    amount:       String(amount),
    method:       _payMethod,
    method_label: mLbl,
    month_label:  fmtMonth(new Date()),
    ref:          ref,
    note:         note
  }]).then(function(res){
    if(res.error){ showToast('שגיאה בדיווח: '+res.error.message); return; }
    loadPaymentsFromSupabase(function(){
      updateNavDot();
      var waEl = document.getElementById('wa-section');
      if(waEl) waEl.style.display='block';
      var confirmBtn = document.getElementById('pay-confirm-btn');
      if(confirmBtn) confirmBtn.style.display='none';
      var backLink = document.getElementById('pay-back-link');
      if(backLink) backLink.style.display='none';
      renderHomePage();
      renderFundPage();
      showToast('דיווח נשלח לועד ✅');
    });
  });
}
function sendWAMessage(){
  var phone = ((DB.paySettings.vaadPhone||DB.paySettings.bit||'').replace(/\D/g,''));
  var unit  = DB.user.unit;
  var name  = DB.unitNames[unit]||DB.user.name;
  var month = fmtMonth(getTargetDate());
  var mLbls = {bit:'ביט',paybox:'פייבוקס',bank:'העברה בנקאית',cash:'מזומן',check:'שיק'};
  var mLbl  = mLbls[_payMethod]||_payMethod||'—';
  var msg   = 'היי, דיווחתי על תשלום ועד בית ל'+DB.building.name+'. דירה: '+unit+', חודש: '+month+', סכום: ₪'+DB.building.monthly_fee+', אמצעי: '+mLbl+'. נא לאשר במערכת.';
  if(phone){
    window.open('https://wa.me/972'+phone.replace(/^0/,'')+'?text='+encodeURIComponent(msg),'_blank');
  } else {
    try{ navigator.clipboard.writeText(msg); } catch(e){}
    showToast('הודעה הועתקה ללוח');
  }
}

/* ═══════════════════════════════════════════════════════════════
   WA TRAY (admin approval)
═══════════════════════════════════════════════════════════════ */
function triggerWATray(unit, mk){
  _waTrayUnit = unit;
  _waTrayMonthKey = mk;
  var name  = DB.unitNames[unit]||('דירה '+unit);
  var month = fmtMonth(getTargetDate());
  setText('wa-receipt-msg', 'האם לשלוח קבלה ל'+name+' (דירה '+unit+') בוואטסאפ על תשלום חודש '+month+'?');
  setTimeout(function(){
    var ov = document.getElementById('wa-receipt-overlay');
    if(ov) ov.classList.add('open');
  }, 500);
}

function sendWATrayReceipt(){
  var unit  = _waTrayUnit;
  var phone = ((DB.residentPhones&&DB.residentPhones[unit]||'').replace(/\D/g,''));
  var unit  = _waTrayUnit;
  var mk    = _waTrayMonthKey;
  var name  = DB.unitNames[unit]||('דירה '+unit);
  var month = mk ? (function(){ var d=new Date(); return HE_MONTHS[parseInt(mk.split('-')[1])-1]+' '+mk.split('-')[0]; })() : '';
  var msg   = 'שלום '+name+', ועד הבית של '+DB.building.name+' אישר את התשלום שלך לחודש '+month+'. תודה! 🏢✅';
  closeWATray();
  if(phone){
    window.open('https://wa.me/972'+phone.replace(/^0/,'')+'?text='+encodeURIComponent(msg),'_blank');
  } else {
    try{ navigator.clipboard.writeText(msg); } catch(e){}
    showToast('הודעה הועתקה (לא הוגדר מספר)');
  }
}

function closeWATray(){
  var ov = document.getElementById('wa-receipt-overlay');
  if(ov) ov.classList.remove('open');
}

/* ═══════════════════════════════════════════════════════════════
   RECEIPT MODAL
═══════════════════════════════════════════════════════════════ */
function showMyReceipt(){
  var unit = DB.user.unit;
  // מוצא את כל הקבלות של הדייר
  var allRecs = [];
  Object.keys(DB.approvedReceipts).forEach(function(k){
    var r = DB.approvedReceipts[k];
    if(Number(r.unit)===Number(unit)) allRecs.push(r);
  });
  if(!allRecs.length){ showToast('קבלה זמינה לאחר אישור הוועד'); return; }
  // מיון לפי תאריך אישור — חדש ראשון
  allRecs.sort(function(a,b){ return (b.approvedDate||'').localeCompare(a.approvedDate||''); });
  var rec = allRecs[0]; // הקבלה האחרונה בלבד
  var receiptNum = (new Date().getFullYear())+''+String(new Date().getMonth()+1).padStart(2,'0')+'-'+unit;
  var totalAmount = parseFloat(rec.amount)||0; // סכום הקבלה הספציפית
  var monthsList  = rec.monthLabel||fmtMonth(getTargetDate());

  setText('receipt-cat-name',    DB.building.name||'הבניין');
  setText('receipt-num-ph',      receiptNum);
  setText('receipt-date-ph',     fmtDate(new Date()));
  setText('receipt-supplier-ph', DB.unitNames[unit]||('דירה '+unit));
  setText('receipt-unit-ph',    'דירה '+unit);
  setText('receipt-month-ph',    monthsList||mk);
  setText('receipt-method-ph',   rec.methodLabel||'—');
  setText('receipt-amount-ph',   '₪'+num(totalAmount));
  setText('receipt-bldg-ph',     DB.building.name||'—');
  setText('receipt-addr-ph',     (DB.building.address||'')+' '+(DB.building.city||''));

  var ov = document.getElementById('receipt-modal');
  if(ov) ov.style.display='flex';
}

function printReceipt(){
  var num    = document.getElementById('receipt-num-ph')   ? document.getElementById('receipt-num-ph').textContent   : '';
  var date   = document.getElementById('receipt-date-ph')  ? document.getElementById('receipt-date-ph').textContent  : '';
  var name   = document.getElementById('receipt-supplier-ph') ? document.getElementById('receipt-supplier-ph').textContent : '';
  var unit   = document.getElementById('receipt-unit-ph')  ? document.getElementById('receipt-unit-ph').textContent  : '';
  var month  = document.getElementById('receipt-month-ph') ? document.getElementById('receipt-month-ph').textContent : '';
  var method = document.getElementById('receipt-method-ph')? document.getElementById('receipt-method-ph').textContent: '';
  var amount = document.getElementById('receipt-amount-ph')? document.getElementById('receipt-amount-ph').textContent: '';
  var bldg   = document.getElementById('receipt-bldg-ph')  ? document.getElementById('receipt-bldg-ph').textContent  : '';
  var addr   = document.getElementById('receipt-addr-ph')  ? document.getElementById('receipt-addr-ph').textContent  : '';

  var html = '<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8">'+
    '<title>קבלה '+num+'</title>'+
    '<style>'+
      'body{font-family:Arial,sans-serif;max-width:400px;margin:40px auto;padding:20px;direction:rtl;}'+
      'h1{font-size:22px;text-align:center;color:#1A3A5C;margin-bottom:4px;}'+
      '.sub{text-align:center;color:#64748B;font-size:13px;margin-bottom:20px;}'+
      '.num{text-align:center;background:#F1F5F9;border-radius:8px;padding:8px;font-weight:900;color:#1A3A5C;margin-bottom:16px;font-size:14px;}'+
      'table{width:100%;border-collapse:collapse;}'+
      'td{padding:10px 8px;border-bottom:1px solid #F1F5F9;font-size:14px;}'+
      'td:first-child{color:#64748B;width:40%;}'+
      'td:last-child{font-weight:700;color:#1A3A5C;}'+
      '.total td{font-size:16px;font-weight:900;color:#1A3A5C;border-top:2px solid #E2E8F0;border-bottom:none;}'+
      '.stamp{margin-top:20px;text-align:center;background:#F0FDF4;border-radius:10px;padding:12px;color:#16A34A;font-weight:700;font-size:13px;}'+
      '.footer{margin-top:16px;text-align:center;color:#94A3B8;font-size:11px;}'+
      '@media print{body{margin:0;}button{display:none;}}'+
    '</style></head><body>'+
    '<h1>🧾 קבלה רשמית</h1>'+
    '<div class="sub">ועד הבית — '+bldg+'</div>'+
    '<div class="num">מספר קבלה: '+num+'</div>'+
    '<table>'+
      '<tr><td>תאריך</td><td>'+date+'</td></tr>'+
      '<tr><td>שם משלם</td><td>'+name+'</td></tr>'+
      '<tr><td>דירה</td><td>'+unit+'</td></tr>'+
      '<tr><td>חודש תשלום</td><td>'+month+'</td></tr>'+
      '<tr><td>אמצעי תשלום</td><td>'+method+'</td></tr>'+
      '<tr class="total"><td>סכום</td><td>'+amount+'</td></tr>'+
    '</table>'+
    '<table style="margin-top:12px;">'+
      '<tr><td>בניין</td><td>'+bldg+'</td></tr>'+
      '<tr><td>כתובת</td><td>'+addr+'</td></tr>'+
    '</table>'+
    '<div class="stamp">✅ התשלום אושר על ידי ועד הבית</div>'+
    '<div class="footer">שכנות טובה · SmartNeighbor · מערכת ניהול בניינים</div>'+
    '<br><button onclick="window.print()" style="width:100%;padding:12px;background:#1A3A5C;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:800;cursor:pointer;">🖨️ הדפס / שמור כ-PDF</button>'+
    '</body></html>';

  var w = window.open('','_blank');
  if(w){ w.document.write(html); w.document.close(); }
}

function closeReceipt(){
  var ov = document.getElementById('receipt-modal');
  if(ov) ov.style.display='none';
}

function v13ShowMyReceipt(){ showMyReceipt(); }

/* ═══════════════════════════════════════════════════════════════
   EXPENSE DETAIL
═══════════════════════════════════════════════════════════════ */
function openExpDetail(idx){
  var e = DB.finance.expenses[idx];
  if(!e) return;
  var dot = document.getElementById('expd-dot');
  if(dot) dot.style.background = e.color;
  setText('expd-title', e.cat);
  setText('r-date',     e.receiptDate||'—');
  setText('r-supplier', e.receiptSupplier||'—');
  setText('r-amount',   '₪'+num(e.amount));
  setText('r-cat',      e.cat);
  setText('r-exptype',  e.expType||'חד פעמית');
  var monthRow = document.getElementById('r-month-row');
  if(e.expType === 'קבועה'){
    setText('r-month', 'כל חודש');
    if(monthRow) monthRow.style.display = '';
  } else {
    setText('r-month', e.month||'—');
    if(monthRow) monthRow.style.display = '';
  }
  var rows = document.getElementById('expd-rows');
  if(rows && e.details) rows.innerHTML = '<div class="exp-detail" style="font-size:12px;color:var(--slate);">'+escHtml(e.details)+'</div>';
  openSheet('expense');
}

/* ═══════════════════════════════════════════════════════════════
   FAULT SHEET SUBMIT
═══════════════════════════════════════════════════════════════ */
function renderQuickPayCard(){
  var ps = DB.paySettings;
  var card = document.getElementById('quick-pay-card');
  var btnsEl = document.getElementById('qpc-btns');
  if(!card || !btnsEl) return;
  var hasAny = ps.bit || ps.paybox;
  card.style.display = hasAny ? 'flex' : 'none';
  var html = '';
  if(ps.bit){
    var phone = ps.bit.replace(/\D/g,'').replace(/^0/,'');
    html += '<button class="qpc-btn qpc-btn-bit" onclick="window.open(\'https://www.bitpay.co.il/app/payme?phone='+phone+'\',\'_blank\')">📱 Bit</button>';
  }
  if(ps.paybox){
    html += '<button class="qpc-btn qpc-btn-paybox" onclick="window.open(\''+escAttr(ps.paybox)+'\',\'_blank\')">🟢 Paybox</button>';
  }
  btnsEl.innerHTML = html;
}

/* ═══════════════════════════════════════════════════════════════
   V21: REPORT PAID BUTTON (from pay banner)
═══════════════════════════════════════════════════════════════ */
function updateReportPaidBtn(mk, unit){
  var btn = document.getElementById('report-paid-btn');
  if(!btn) return;
  var isApproved = !!DB.approvedReceipts[unit+'-'+mk];
  var isPending  = DB.pendingPayments.some(function(p){ return p.unit===unit && p.monthKey===mk; });
  btn.style.display = (!isApproved && !isPending) ? 'inline-flex' : 'none';
}

function reportPaidFromBanner(){
  openSheet('pay');
}



function _openReceipt(i){
  var receipts = window._myReceipts || [];
  var r = receipts[i];
  if(!r) return;
  var unit = r.unit;
  var bldg = DB.building.name||'';
  var addr = (DB.building.address||'')+' '+(DB.building.city||'');
  var rNum = String(r.approvedDate||fmtDate(new Date())).replace(/[^0-9]/g,'')+'-'+unit;
  var w = window.open('','_blank');
  if(!w){ showToast('אפשר חלונות קופצים בדפדפן'); return; }
  w.document.write('<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>קבלה</title>');
  w.document.write('<style>body{font-family:Arial,sans-serif;padding:24px;direction:rtl;max-width:400px;margin:0 auto;}');
  w.document.write('.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F1F5F9;}');
  w.document.write('.lbl{font-size:12px;color:#64748B;}.val{font-size:12px;font-weight:700;color:#1A3A5C;}');
  w.document.write('.total{font-size:20px;font-weight:900;color:#16A34A;}.print-btn{background:#1A3A5C;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;cursor:pointer;width:100%;margin-bottom:16px;}');
  w.document.write('@media print{.print-btn{display:none;}}');
  w.document.write('</style></head><body>');
  w.document.write('<button class="print-btn" onclick="window.print()">&#128424; הדפס / שמור PDF</button>');
  w.document.write('<h2 style="color:#1A3A5C;">&#129534; קבלה #'+rNum+'</h2>');
  w.document.write('<div class="row"><span class="lbl">בניין</span><span class="val">'+bldg+'</span></div>');
  w.document.write('<div class="row"><span class="lbl">כתובת</span><span class="val">'+addr+'</span></div>');
  w.document.write('<div class="row"><span class="lbl">דייר</span><span class="val">'+(DB.unitNames[unit]||'דירה '+unit)+'</span></div>');
  w.document.write('<div class="row"><span class="lbl">דירה</span><span class="val">'+unit+'</span></div>');
  w.document.write('<div class="row"><span class="lbl">חודש תשלום</span><span class="val">'+(r.monthLabel||'')+'</span></div>');
  w.document.write('<div class="row"><span class="lbl">אמצעי תשלום</span><span class="val">'+(r.methodLabel||r.method_label||'')+'</span></div>');
  w.document.write('<div class="row"><span class="lbl">תאריך אישור</span><span class="val">'+(r.approvedDate||r.approved_date||'')+'</span></div>');
  w.document.write('<div class="row"><span class="lbl">אושר על ידי</span><span class="val">'+(r.approvedBy||r.approved_by||'ועד הבית')+'</span></div>');
  w.document.write('<div class="row" style="margin-top:16px;"><span class="lbl" style="font-size:14px;font-weight:800;">סכום ששולם</span><span class="total">&#8362;'+num(r.amount)+'</span></div>');
  w.document.write('<p style="font-size:11px;color:#94A3B8;text-align:center;margin-top:24px;">שכנות טובה · SmartNeighbor</p>');
  w.document.write('</body></html>');
  w.document.close();
}

/* ═══════════════════════════════════════════════════════════════
   RECEIPTS MODALS — קבלות דייר ומנהל
═══════════════════════════════════════════════════════════════ */
function openReceiptsModal(showHidden){
  var el = document.getElementById('receipts-modal-list');
  if(!el) return;
  var unit = DB.user ? DB.user.unit : 0;
  var all = [];
  Object.keys(DB.approvedReceipts||{}).forEach(function(k){ var r=DB.approvedReceipts[k]; if(r&&Number(r.unit)===Number(unit)) all.push(r); });
  all.sort(function(a,b){ return (b.approvedDate||'').localeCompare(a.approvedDate||''); });
  var receipts = showHidden ? all : all.filter(function(r){ return !r.hidden_by_resident; });
  var hiddenCount = all.filter(function(r){ return !!r.hidden_by_resident; }).length;
  if(!receipts.length && !hiddenCount){ el.innerHTML='<div style="text-align:center;color:var(--slate);padding:40px 0;">אין קבלות עדיין</div>'; }
  else if(!receipts.length){ el.innerHTML='<div style="text-align:center;color:var(--slate);padding:40px 0;">כל הקבלות מוסתרות</div>'; }
  else {
    window._myReceipts = all;
    el.innerHTML = receipts.map(function(r,i){
      var globalIdx = all.indexOf(r);
      var isHidden = !!r.hidden_by_resident;
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #F1F5F9;opacity:'+(isHidden?'0.5':'1')+';">'+
        '<div><div style="font-size:14px;font-weight:800;color:var(--navy);">'+escHtml(r.monthLabel||'')+'</div>'+
        '<div style="font-size:11px;color:var(--slate);">'+(r.approvedDate||'')+(r.methodLabel?' · '+escHtml(r.methodLabel):'')+'</div></div>'+
        '<div style="display:flex;align-items:center;gap:8px;">'+
        '<span style="font-size:15px;font-weight:900;color:var(--green);">₪'+num(r.amount)+'</span>'+
        '<button onclick="_openReceipt('+globalIdx+')" style="padding:5px 10px;background:var(--navy);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:800;cursor:pointer;">הדפס</button>'+
        '<button onclick="toggleHideReceipt(\''+String(r.id)+'\','+isHidden+')" style="padding:5px 8px;background:#F1F5F9;color:var(--slate);border:none;border-radius:8px;font-size:11px;cursor:pointer;">'+(isHidden?'הצג':'הסתר')+'</button>'+
        '</div></div>';
    }).join('');
  }
  var toggleLink = document.getElementById('receipts-show-hidden-link');
  if(toggleLink){
    if(hiddenCount>0){ toggleLink.style.display='block'; toggleLink.textContent = showHidden ? 'הסתר קבלות מוסתרות' : 'הצג קבלות מוסתרות ('+hiddenCount+')'; toggleLink.onclick = function(){ openReceiptsModal(!showHidden); }; }
    else { toggleLink.style.display='none'; }
  }
  var modal = document.getElementById('receipts-modal');
  if(modal) modal.style.display='block';
}

function toggleHideReceipt(id, currentlyHidden){
  var newVal = !currentlyHidden;
  sbClient.from('payments').update({ hidden_by_resident: newVal }).eq('id', id).then(function(res){
    if(res.error){ showToast('שגיאה: '+res.error.message); return; }
    loadPaymentsFromSupabase(function(){ openReceiptsModal(newVal ? false : true); });
  });
}

function closeReceiptsModal(){
  var modal = document.getElementById('receipts-modal');
  if(modal) modal.style.display='none';
}

function openAdminReceiptsModal(){
  var el = document.getElementById('admin-receipts-list');
  if(!el) return;
  var all = [];
  Object.keys(DB.approvedReceipts||{}).forEach(function(k){ var r=DB.approvedReceipts[k]; if(r) all.push(r); });
  all.sort(function(a,b){ return (b.approvedDate||'').localeCompare(a.approvedDate||''); });
  if(!all.length){ el.innerHTML='<div style="text-align:center;color:var(--slate);padding:40px 0;">אין קבלות</div>'; }
  else {
    el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px;"><tr style="background:#F8FAFC;"><th style="padding:8px 6px;text-align:right;font-weight:800;">תאריך</th><th style="padding:8px 6px;text-align:right;font-weight:800;">דירה</th><th style="padding:8px 6px;text-align:right;font-weight:800;">חודש</th><th style="padding:8px 6px;text-align:right;font-weight:800;">סכום</th><th style="padding:8px 6px;text-align:right;font-weight:800;">אמצעי</th><th style="padding:8px 6px;"></th></tr>'+
    all.map(function(r,i){
      return '<tr style="border-bottom:1px solid #F1F5F9;">'+
        '<td style="padding:8px 6px;">'+escHtml(r.approvedDate||'')+'</td>'+
        '<td style="padding:8px 6px;font-weight:700;">'+escHtml(String(r.unit))+'</td>'+
        '<td style="padding:8px 6px;">'+escHtml(r.monthLabel||'')+'</td>'+
        '<td style="padding:8px 6px;color:var(--green);font-weight:800;">₪'+num(r.amount)+'</td>'+
        '<td style="padding:8px 6px;">'+escHtml(r.methodLabel||'')+'</td>'+
        '<td style="padding:8px 6px;"><button onclick="window._adminReceipts='+JSON.stringify(all)+';_openAdminReceipt('+i+')" style="padding:4px 8px;background:var(--navy);color:#fff;border:none;border-radius:6px;font-size:10px;cursor:pointer;">הדפס</button></td></tr>';
    }).join('')+'</table>';
    window._adminReceipts = all;
  }
  var modal = document.getElementById('admin-receipts-modal');
  if(modal) modal.style.display='block';
}

function clearReceiptsHistory(){
  var dateEl = document.getElementById('clear-receipts-date');
  if(!dateEl || !dateEl.value){ showToast('נא לבחור תאריך'); return; }
  var cutoff = dateEl.value; // YYYY-MM-DD
  var slug = _getBuildingSlug();
  if(!slug){ showToast('שגיאה: לא זוהה בניין'); return; }
  if(!ADMIN_ON){ showToast('⛔ נדרשת כניסת מנהל'); return; }
  var toDelete = [];
  Object.keys(DB.approvedReceipts||{}).forEach(function(k){
    var r = DB.approvedReceipts[k];
    if(r && r.approvedDate && r.approvedDate <= cutoff) toDelete.push(r);
  });
  if(!toDelete.length){ showToast('אין קבלות לפני תאריך זה'); return; }
  if(!confirm('נמצאו '+toDelete.length+' קבלות לפני '+cutoff+'.\nהפעולה תייצא לאקסל ותמחק לצמיתות. להמשיך?')) return;
  // ייצוא לאקסל לפני מחיקה
  var rows = [['תאריך אישור','דירה','שם','חודש','סכום','אמצעי תשלום']];
  toDelete.forEach(function(r){ rows.push([r.approvedDate||'', r.unit, DB.unitNames[r.unit]||('דירה '+r.unit), r.monthLabel||'', r.amount||'', r.methodLabel||'']); });
  var csv = rows.map(function(r){ return r.join(','); }).join('\n');
  var blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  var a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='קבלות_לפני_'+cutoff+'.csv'; a.click();
  // מחיקה מסופרבייס
  var ids = toDelete.map(function(r){ return r.id; }).filter(Boolean);
  sbClient.from('payments').delete().in('id', ids).then(function(res){
    if(res.error){ showToast('שגיאה במחיקה: '+res.error.message); return; }
    showToast('✅ '+toDelete.length+' קבלות נמחקו לאחר ייצוא');
    document.getElementById('admin-receipts-modal').style.display='none';
    loadPaymentsFromSupabase(function(){ renderAll(); });
  });
}

function _openAdminReceipt(i){
  var all = window._adminReceipts || [];
  var r = all[i];
  if(!r) return;
  var w = window.open('','_blank');
  if(!w){ showToast('אפשר חלונות קופצים'); return; }
  var rNum = String(r.approvedDate||'').replace(/[^0-9]/g,'')+'-'+r.unit;
  w.document.write('<!DOCTYPE html><html dir="rtl"><head><meta charset="UTF-8"><title>קבלה</title>');
  w.document.write('<style>body{font-family:Arial,sans-serif;padding:24px;direction:rtl;max-width:400px;margin:0 auto;}.row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #F1F5F9;}.lbl{font-size:12px;color:#64748B;}.val{font-size:12px;font-weight:700;color:#1A3A5C;}.total{font-size:20px;font-weight:900;color:#16A34A;}.print-btn{background:#1A3A5C;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:14px;cursor:pointer;width:100%;margin-bottom:16px;}@media print{.print-btn{display:none;}}</style></head><body>');
  w.document.write('<button class="print-btn" onclick="window.print()">🖨️ הדפס / שמור PDF</button>');
  w.document.write('<h2 style="color:#1A3A5C;">🧾 קבלה #'+rNum+'</h2>');
  w.document.write('<div class="row"><span class="lbl">בניין</span><span class="val">'+(DB.building.name||'')+'</span></div>');
  w.document.write('<div class="row"><span class="lbl">דירה</span><span class="val">'+r.unit+'</span></div>');
  w.document.write('<div class="row"><span class="lbl">דייר</span><span class="val">'+(DB.unitNames[r.unit]||'דירה '+r.unit)+'</span></div>');
  w.document.write('<div class="row"><span class="lbl">חודש תשלום</span><span class="val">'+(r.monthLabel||'')+'</span></div>');
  w.document.write('<div class="row"><span class="lbl">אמצעי תשלום</span><span class="val">'+(r.methodLabel||'')+'</span></div>');
  w.document.write('<div class="row"><span class="lbl">תאריך אישור</span><span class="val">'+(r.approvedDate||'')+'</span></div>');
  w.document.write('<div class="row"><span class="lbl">אושר על ידי</span><span class="val">'+(r.approvedBy||'ועד הבית')+'</span></div>');
  w.document.write('<div class="row" style="margin-top:16px;"><span class="lbl" style="font-size:14px;font-weight:800;">סכום ששולם</span><span class="total">₪'+num(r.amount)+'</span></div>');
  w.document.write('<p style="font-size:11px;color:#94A3B8;text-align:center;margin-top:24px;">שכנות טובה · SmartNeighbor</p>');
  w.document.write('</body></html>');
  w.document.close();
}
