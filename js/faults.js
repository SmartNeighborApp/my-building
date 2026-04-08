/* ═══════════════════════════════════════════════════════════════
   FAULT PAGE ADMIN PIN — כניסת מנהל ישירות מעמוד תקלות
═══════════════════════════════════════════════════════════════ */
function openFaultAdminPin(){
  var popup = document.getElementById('fault-admin-pin-popup');
  if(!popup) return;
  // ניקוי שדות
  for(var i=0;i<4;i++){ var b=document.getElementById('fap'+i); if(b) b.value=''; }
  var errEl = document.getElementById('fap-err');
  if(errEl) errEl.style.display='none';
  popup.style.display = 'block';
  setTimeout(function(){ var b=document.getElementById('fap0'); if(b) b.focus(); },200);
}

function fapNext(idx){
  var cur = document.getElementById('fap'+idx);
  if(!cur || cur.value.length < 1) return;
  if(idx < 3){
    var next = document.getElementById('fap'+(idx+1));
    if(next) next.focus();
  } else {
    submitFaultAdminPin();
  }
}

function submitFaultAdminPin(){
  var pin = '';
  for(var i=0;i<4;i++){ var b=document.getElementById('fap'+i); if(b) pin+=b.value; }
  var errEl = document.getElementById('fap-err');
  if(pin !== DB.adminPin){
    if(errEl) errEl.style.display='block';
    for(var j=0;j<4;j++){ var bx=document.getElementById('fap'+j); if(bx) bx.value=''; }
    var b0=document.getElementById('fap0'); if(b0) b0.focus();
    return;
  }
  // קוד נכון — הפעלת מצב מנהל
  if(errEl) errEl.style.display='none';
  ADMIN_ON = true;
  var popup = document.getElementById('fault-admin-pin-popup');
  if(popup) popup.style.display='none';
  var btn = document.getElementById('fault-admin-pin-btn');
  if(btn){ btn.textContent='✅ מנהל פעיל'; btn.style.background='linear-gradient(135deg,#16A34A,#15803D)'; }
  renderFaultsPage();
  renderHomePage();
  showToast('✅ מצב מנהל פעיל');
}


/* ═══════════════════════════════════════════════════════════════
   ORDER PROF FROM FAULT — הזמנת ספק מתוך תקלה
═══════════════════════════════════════════════════════════════ */
var _orderProfFaultId = null;
var _orderProfDomain  = '';
var _selectedProfIds  = [];

function openOrderProfSheet(faultId, domain){
  _orderProfFaultId = faultId;
  _orderProfDomain  = domain || '';
  _selectedProfIds  = [];

  // סינון ספקים לפי תחום
  var profs = (DB.professionals||[]).filter(function(p){
    if(p.is_suspended) return false;
    if(!_orderProfDomain || _orderProfDomain === 'כללי' || _orderProfDomain === 'אחר') return true;
    return (p.cat||'').indexOf(_orderProfDomain) !== -1 || _orderProfDomain.indexOf(p.cat||'') !== -1;
  });

  var domEl = document.getElementById('order-prof-domain-label');
  if(domEl) domEl.textContent = _orderProfDomain || 'כללי';

  var listEl = document.getElementById('order-prof-list');
  if(listEl){
    if(!profs.length){
      listEl.innerHTML = '<div style="text-align:center;color:#94A3B8;padding:16px;">אין ספקים זמינים בתחום זה</div>';
    } else {
      var html = '';
      profs.forEach(function(p){
        html += '<label for="op-chk-'+p.id+'" style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;margin-bottom:6px;background:#F8FAFC;border:1.5px solid #E2E8F0;border-radius:12px;cursor:pointer;transition:all .15s;">'+
          '<div style="display:flex;align-items:center;gap:10px;">'+
            '<div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#EFF6FF,#DBEAFE);display:flex;align-items:center;justify-content:center;font-size:16px;">🔧</div>'+
            '<div>'+
              '<div style="font-size:13px;font-weight:800;color:#1E3A5C;">'+escHtml(p.name)+'</div>'+
              '<div style="font-size:11px;font-weight:600;color:#3B82F6;">'+escHtml(p.cat)+'</div>'+
            '</div>'+
          '</div>'+
          '<input type="checkbox" id="op-chk-'+p.id+'" value="'+p.id+'" '+
            'onchange="toggleOrderProfSelect(this)" '+
            'style="width:20px;height:20px;cursor:pointer;accent-color:#1E3A5C;">'+
        '</label>';
      });
      listEl.innerHTML = html;
    }
  }

  var errEl = document.getElementById('order-prof-err');
  if(errEl) errEl.style.display = 'none';

  var sheet = document.getElementById('sheet-order-prof');
  if(sheet) sheet.classList.add('open');
}

function toggleOrderProfSelect(chk){
  var id = chk.value;
  if(chk.checked){
    if(_selectedProfIds.length >= 3){
      chk.checked = false;
      showToast('ניתן לבחור עד 3 ספקים');
      return;
    }
    _selectedProfIds.push(id);
  } else {
    _selectedProfIds = _selectedProfIds.filter(function(x){ return x !== id; });
  }
  var countEl = document.getElementById('order-prof-count');
  if(countEl) countEl.textContent = _selectedProfIds.length + '/3 נבחרו';
}

function submitOrderProf(){
  if(!_selectedProfIds.length){
    var errEl = document.getElementById('order-prof-err');
    if(errEl){ errEl.textContent = 'נא לבחור לפחות ספק אחד'; errEl.style.display='block'; }
    return;
  }
  var slug = _getBuildingSlug();
  var fault = (DB.maintenance||[]).find(function(m){ return String(m.id)===String(_orderProfFaultId); });
  var faultTitle = fault ? fault.title : 'תקלה בבניין';
  var faultDesc  = fault ? (fault.desc||'') : '';
  var bd = {};
  try{ bd = JSON.parse(localStorage.getItem('sn_building_data')||'{}'); }catch(e){}
  var bldgName = (bd.building_name||DB.building.name||'הבניין') + (bd.address?' · '+bd.address:'') + (bd.city?' '+bd.city:'');

  _selectedProfIds.forEach(function(profId){
    var p = (DB.professionals||[]).find(function(x){ return String(x.id)===String(profId); });
    if(!p) return;
    var faultPhoto = fault ? (fault.photo_url||'') : '';
    var quoteUrl = 'https://smartneighborapp.github.io/my-building/fault-quote.html?slug='+slug+'&prof='+encodeURIComponent(p.name)+'&phone='+encodeURIComponent(p.phone||'')+'&cat='+encodeURIComponent(p.cat)+'&bldg='+encodeURIComponent(bldgName)+'&faultId='+encodeURIComponent(_orderProfFaultId||'')+'&fault='+encodeURIComponent(faultTitle)+'&photo='+encodeURIComponent(faultPhoto);
    var msg = encodeURIComponent('שלום ' + p.name + ', ועד ' + bldgName + ' מזמין אותך להגיש הצעת מחיר לטיפול בתחום ' + _orderProfDomain + '. תיאור: ' + faultTitle + (faultDesc ? ' - ' + faultDesc : '') + '. להגשת הצעה: ' + quoteUrl);
    var phoneClean = (p.phone||'').replace(/^0/,'').replace(/-/g,'');
    setTimeout(function(){ window.open('https://wa.me/972'+phoneClean+'?text='+msg, '_blank'); }, 300);
  });

  var sheet = document.getElementById('sheet-order-prof');
  if(sheet) sheet.classList.remove('open');
  showToast('✅ הזמנה נשלחה ל-' + _selectedProfIds.length + ' ספקים');
}

var _faultPhotoFile = null;
function previewFaultPhoto(input){
  var prev = document.getElementById('fault-photo-preview');
  if(!prev) return;
  if(input.files && input.files[0]){
    _faultPhotoFile = input.files[0];
    var reader = new FileReader();
    reader.onload = function(e){ prev.src=e.target.result; prev.style.display='block'; };
    reader.readAsDataURL(input.files[0]);
  }
}

/* faults.js — שכנות טובה */
function openVaadOrderSheet(profId){
  _vaadOrderProfId = profId;
  var p = (DB.professionals||[]).find(function(x){ return String(x.id)===String(profId); });
  if(!p) return;
  var nameEl = document.getElementById('vaad-order-prof-name');
  if(nameEl) nameEl.textContent = p.name + ' · ' + p.cat;
  // ניקוי PIN
  for(var i=0;i<4;i++){
    var b=document.getElementById('vop'+i); if(b) b.value='';
  }
  var errEl = document.getElementById('vop-err');
  if(errEl) errEl.style.display='none';
  var sheet = document.getElementById('sheet-vaad-order');
  if(sheet) sheet.classList.add('open');
  setTimeout(function(){ var b=document.getElementById('vop0'); if(b) b.focus(); },300);
}

function vopNext(idx){
  var cur = document.getElementById('vop'+idx);
  if(cur && cur.value.length===1){
    if(idx<3){ var next=document.getElementById('vop'+(idx+1)); if(next) next.focus(); }
    else { submitVaadOrder(); }
  }
}

function submitVaadOrder(){
  var pin='';
  for(var i=0;i<4;i++){ var b=document.getElementById('vop'+i); if(b) pin+=b.value; }
  var errEl = document.getElementById('vop-err');

  if(pin !== DB.adminPin){
    if(errEl){ errEl.textContent='קוד מנהל שגוי. נסה שוב'; errEl.style.display='block'; }
    for(var j=0;j<4;j++){ var bx=document.getElementById('vop'+j); if(bx) bx.value=''; }
    var b0=document.getElementById('vop0'); if(b0) b0.focus();
    return;
  }
  if(errEl) errEl.style.display='none';

  var p = (DB.professionals||[]).find(function(x){ return String(x.id)===String(_vaadOrderProfId); });
  if(!p){ showToast('שגיאה: לא נמצא בעל מקצוע'); return; }

  var slug     = _getBuildingSlug();
  var bldgName = (function(){ try{ var bd=JSON.parse(localStorage.getItem('sn_building_data')||'{}'); var n=bd.building_name||DB.building.name||'הבניין'; var a=bd.address||''; var ci=bd.city||DB.building.city||''; return n+(a?' · '+a:'')+(ci?' '+ci:''); }catch(e){ return DB.building.name||'הבניין'; } })();
  var reportUrl = 'https://smartneighborapp.github.io/my-building/fault-report.html?slug='+slug+'&prof='+encodeURIComponent(p.name)+'&cat='+encodeURIComponent(p.cat)+'&bldg='+encodeURIComponent(bldgName);
  var msg      = encodeURIComponent('שלום ' + p.name + ', ועד ' + bldgName + ' מזמין אותך לטיפול בתחום ' + p.cat + '.\nלאחר סיום — דווח דרך הקישור:\n' + reportUrl);
  var phoneClean = (p.phone||'').replace(/^0/,'').replace(/-/g,'');

  // פתח וואטסאפ
  window.open('https://wa.me/972'+phoneClean+'?text='+msg, '_blank');

  // פרסם ב-notices — ייחתך בסוף החודש
  if(slug){
    var noticeRecord = {
      building_slug: slug,
      type:   'notice',
      title:  '🔨 הזמנת בעל מקצוע — ' + p.cat,
      text:   'ועד הבית יצר קשר עם ' + p.name + ' (' + p.cat + ') לתיאום עבודה בבניין.',
      date:   fmtDate(new Date()),
      unit:   DB.user ? DB.user.unit : null,
      auto_delete_month: (function(){
        var d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1);
      })()
    };
    sbClient.from('notices').insert([noticeRecord]).then(function(res){
      if(!res.error){
        loadNoticesFromSupabase(function(){
          renderCommunityPage();
          renderHomePage();
        });
      }
    });
  }

  // סגור sheet + הצג הודעת הצלחה
  var sheet = document.getElementById('sheet-vaad-order');
  if(sheet) sheet.classList.remove('open');
  showToast('✅ הזמנה נשלחה ופורסמה בלוח הבניין');
}

/* ═══════════════════════════════════════════════════════════════
   PERSONAL ORDER — הזמנה אישית לבעל מקצוע
═══════════════════════════════════════════════════════════════ */
var _personalOrderProfId = null;

function openPersonalOrderSheet(profId){
  _personalOrderProfId = profId;
  var p = (DB.professionals||[]).find(function(x){ return String(x.id)===String(profId); });
  if(!p) return;

  // פתח וואטסאפ ישירות בלבד — sheet משוב יפתח בנפרד
  var phoneClean = (p.phone||'').replace(/^0/,'').replace(/-/g,'');
  var bldgName   = (DB.building && DB.building.name) ? DB.building.name : 'הבניין';
  var userName   = (DB.user && DB.user.name)         ? DB.user.name     : 'דייר';
  var userUnit   = (DB.user && DB.user.unit)         ? DB.user.unit     : '';
  var msg = encodeURIComponent('שלום ' + p.name + ', אני ' + userName + (userUnit ? ' מדירה ' + userUnit : '') + ' בבניין ' + bldgName + '. אשמח לקבל הצעת מחיר פרטית עבור ' + p.cat + '. מתי נוח לך?');
  var waUrl = 'https://wa.me/972' + phoneClean + '?text=' + msg;
  window.open(waUrl, '_blank');
}

function openReviewSheet(profId){
  _personalOrderProfId = profId;
  var p = (DB.professionals||[]).find(function(x){ return String(x.id)===String(profId); });
  if(!p) return;

  var el = document.getElementById('personal-order-prof-name');
  if(el) el.textContent = p.name + ' · ' + p.cat;

  // ניקוי שדות
  _poSelectedRating = 0;
  renderPoStars(0);
  var textEl = document.getElementById('po-review-text');
  if(textEl) textEl.value = '';
  var errEl = document.getElementById('po-err');
  if(errEl) errEl.style.display = 'none';

  var sheet = document.getElementById('sheet-personal-order');
  if(sheet){ sheet.classList.add('open'); }
}

var _poSelectedRating = 0;

function renderPoStars(val){
  var wrap = document.getElementById('po-stars-wrap');
  if(!wrap) return;
  var html = '';
  for(var i=1;i<=5;i++){
    html += '<span onclick="selectPoStar('+i+')" style="cursor:pointer;font-size:32px;color:'+(i<=val?'#F59E0B':'#CBD5E1')+';transition:color .15s;">★</span>';
  }
  wrap.innerHTML = html;
}

function selectPoStar(val){
  _poSelectedRating = val;
  renderPoStars(val);
}

function submitPersonalOrder(){
  if(_poSelectedRating === 0){
    var errEl = document.getElementById('po-err');
    if(errEl){ errEl.textContent='נא לבחור דירוג'; errEl.style.display='block'; }
    return;
  }
  var textEl  = document.getElementById('po-review-text');
  var text    = textEl ? (textEl.value||'').trim() : '';
  var slug    = _getBuildingSlug();
  if(!slug){ showToast('שגיאה: לא זוהה בניין'); return; }

  var p = (DB.professionals||[]).find(function(x){ return String(x.id)===String(_personalOrderProfId); });
  if(!p){ showToast('שגיאה: לא נמצא בעל מקצוע'); return; }

  // חישוב דירוג חדש
  var newCount  = (p.rating_count || 0) + 1;
  var newRating = Math.round((((p.rating || 0) * (p.rating_count || 0)) + _poSelectedRating) / newCount * 10) / 10;

  // הוספת ביקורת למערכת reviews
  var review = {
    unit:   DB.user ? DB.user.unit : '',
    name:   DB.user ? DB.user.name : 'דייר',
    rating: _poSelectedRating,
    text:   text,
    date:   fmtDate(new Date())
  };
  var updatedReviews = (p.reviews || []).concat([review]);

  var btn = document.getElementById('po-submit-btn');
  if(btn){ btn.disabled=true; btn.textContent='שומר...'; }

  sbClient.from('professionals').update({
    rating:       newRating,
    rating_count: newCount,
    reviews:      updatedReviews
  }).eq('id', p.id).then(function(res){
    if(btn){ btn.disabled=false; btn.textContent='שלח דירוג ✅'; }
    if(res.error){ showToast('שגיאה בשמירה: '+res.error.message); return; }
    var sheet = document.getElementById('sheet-personal-order');
    if(sheet) sheet.classList.remove('open');
    loadProfessionalsFromSupabase(function(){ renderProfessionalsPage(); });
    showToast('תודה! הדירוג נשמר ✅');
  }).catch(function(){ if(btn){ btn.disabled=false; btn.textContent='שלח דירוג ✅'; } showToast('שגיאת חיבור'); });
}

/* ═══════════════════════════════════════════════════════════════
   COMPLAINT — הגשת תלונה על בעל מקצוע
═══════════════════════════════════════════════════════════════ */
function submitAndSendWA(){
  var name  = (document.getElementById('prof-inp-name').value||'').trim();
  var phone = (document.getElementById('prof-inp-phone').value||'').trim();
  var cat   = (document.getElementById('prof-inp-cat').value||'אחר').trim();
  var notes = (document.getElementById('prof-inp-notes').value||'').trim();
  var area  = (document.getElementById('prof-inp-area') ? document.getElementById('prof-inp-area').value : '').trim();
  var errEl = document.getElementById('prof-sheet-err');

  // ולידציה
  if(!name){ errEl.textContent='נא להזין שם'; errEl.style.display='block'; return; }
  if(!phone){ errEl.textContent='נא להזין טלפון'; errEl.style.display='block'; return; }
  errEl.style.display='none';

  var slug = _getBuildingSlug();
  if(!slug){ showToast('שגיאה: לא זוהה בניין'); return; }

  // 1. שמור ב-Supabase
  sbClient.from('professionals').insert([{
    building_slug: slug,
    name:         name,
    phone:        phone,
    cat:          cat,
    notes:        notes,
    area:         area,
    is_verified:  false,
    rating:       0,
    rating_count: 0
  }]).then(function(res){
    if(res.error){ showToast('שגיאה בשמירה: '+res.error.message); return; }
    loadProfessionalsFromSupabase(function(){ renderProfessionalsPage(); });

    // 2. שלח לינק הסכם בוואטסאפ
    var baseUrl    = 'https://smartneighborapp.github.io/my-building/supplier-form.html';
    var params     = 'slug='+encodeURIComponent(slug)
                   + '&name='+encodeURIComponent(name)
                   + '&phone='+encodeURIComponent(phone)
                   + '&cat='+encodeURIComponent(cat);
    var formUrl    = baseUrl + '?' + params;
    var phoneClean = phone.replace(/^0/,'').replace(/-/g,'');
    var bldgName   = (DB.building && DB.building.name) ? DB.building.name : 'הבניין';
    var msg = encodeURIComponent(
      'שלום ' + name + '! '
      + 'ועד הבית של ' + bldgName + ' מעוניין להוסיף אותך לרשימת ספקי שכנות טובה. '
      + 'אנא מלא את טופס ההסכם בקישור הבא ולחתום עליו: '
      + formUrl
    );
    window.open('https://wa.me/972'+phoneClean+'?text='+msg, '_blank');
    closeSheet('prof');
    showToast('בעל המקצוע נשמר ולינק ההסכם נשלח ✅');
  });
}

// נשמר לתאימות אחורה (שימוש ב-edit בלבד)
function sendAgreementWA(){
  submitAndSendWA();
}

function verifyProf(profId){
  sbClient.from('professionals').update({ is_verified: true }).eq('id', profId).then(function(res){
    if(res.error){ showToast('שגיאה: '+res.error.message); return; }
    loadProfessionalsFromSupabase(function(){ renderProfessionalsPage(); });
    showToast('✅ בעל המקצוע אומת בהצלחה');
  });
}

function submitComplaint(profId, profName){
  var bldg     = (DB.building && DB.building.name) ? DB.building.name : '';
  var userName = (DB.user && DB.user.name) ? DB.user.name : '';
  var userUnit = (DB.user && DB.user.unit) ? String(DB.user.unit) : '';
  var subj = encodeURIComponent('Complaint - SmartNeighbor Supplier');
  var bodyParts = [];
  bodyParts.push('Supplier: ' + profName);
  bodyParts.push('Building: ' + bldg);
  bodyParts.push('Reporter: ' + userName + (userUnit ? ' unit ' + userUnit : ''));
  bodyParts.push('');
  bodyParts.push('Complaint details:');
  var bod = encodeURIComponent(bodyParts.join('\r\n'));
  window.location.href = 'mailto:smartneighbor@gmail.com?subject=' + subj + '&body=' + bod;
  showToast('\u05E0\u05E4\u05EA\u05D7 \u05D0\u05D9\u05DE\u05D9\u05D9\u05DC \u05DC\u05E9\u05DB\u05E0\u05D5\u05EA \u05D8\u05D5\u05D1\u05D4');
}

/* ═══════════════════════════════════════════════════════════════
   FAULT INVOICE — חשבונית לתקלה שבוצעה
═══════════════════════════════════════════════════════════════ */
var _faultInvoiceId    = null;
var _faultInvoiceTitle = '';

function openFaultInvoiceSheet(faultId, faultTitle){
  _faultInvoiceId    = faultId;
  _faultInvoiceTitle = faultTitle;

  var titleEl = document.getElementById('fi-fault-title');
  if(titleEl) titleEl.textContent = faultTitle;

  // מלא קטגוריות מהוצאות קיימות
  var catSel = document.getElementById('fi-cat');
  if(catSel){
    catSel.innerHTML = (DB.expenseCategories||[]).map(function(c){
      return '<option value="'+escAttr(c)+'">'+escHtml(c)+'</option>';
    }).join('');
  }

  // ניקוי שדות
  var amtEl = document.getElementById('fi-amount'); if(amtEl) amtEl.value='';
  var supEl = document.getElementById('fi-supplier'); if(supEl) supEl.value='';
  var errEl = document.getElementById('fi-err'); if(errEl) errEl.style.display='none';

  var sheet = document.getElementById('sheet-fault-invoice');
  if(sheet) sheet.classList.add('open');
  setTimeout(function(){ var el=document.getElementById('fi-supplier'); if(el) el.focus(); },300);
}

function submitFaultInvoice(){
  var supplier = (document.getElementById('fi-supplier').value||'').trim();
  var amountRaw= (document.getElementById('fi-amount').value||'').trim();
  var cat      = (document.getElementById('fi-cat').value||'כללי').trim();
  var errEl    = document.getElementById('fi-err');

  if(!supplier){ errEl.textContent='נא למלא שם ספק'; errEl.style.display='block'; return; }
  var amount = parseFloat(amountRaw);
  if(!amount || amount <= 0){ errEl.textContent='נא להזין סכום תקין'; errEl.style.display='block'; return; }
  errEl.style.display='none';

  var now = new Date();
  var monthHe = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'][now.getMonth()];

  // הוסף להוצאות
  DB.finance.expenses.push({
    cat:             cat,
    amount:          amount,
    color:           COLORS[DB.finance.expenses.length % COLORS.length],
    receiptDate:     fmtDate(now),
    receiptSupplier: supplier,
    details:         'תיקון: ' + _faultInvoiceTitle,
    expType:         'חד פעמית',
    month:           monthHe,
    year:            now.getFullYear()
  });
  saveDB();

  var sheet = document.getElementById('sheet-fault-invoice');
  if(sheet) sheet.classList.remove('open');

  // רענן תצוגה
  renderFundPage();
  renderDocsPage();
  showToast('💰 חשבונית נשמרה בהוצאות ✅');
}

/* ═══════════════════════════════════════════════════════════════
   FAULT → PROF SUGGESTION
═══════════════════════════════════════════════════════════════ */
// מיפוי מיקום → קטגוריות מתאימות
var _LOC_TO_CAT = {
  'מעלית':        ['מעליות'],
  'גינה':          ['גינון'],
  'חדר גנרטור':  ['חשמלאי','שיפוצניק'],
  'גג':            ['שיפוצניק','איטום'],
  'לובי':          ['ניקיון','שיפוצניק','חשמלאי'],
  'חדר מדרגות':  ['ניקיון','שיפוצניק'],
  'חניון':         ['שיפוצניק','חשמלאי'],
  'מרתף':         ['שיפוצניק','אינסטלטור'],
  'דירה שלי':     ['אינסטלטור','חשמלאי','מנעולן','מזגנים','שיפוצניק']
};

function toggleFaultOther(){
  var sel   = document.getElementById('fault-loc');
  var other = document.getElementById('fault-loc-other');
  if(!other) return;
  if(sel && sel.value === 'אחר'){
    other.style.display = 'block';
    setTimeout(function(){ other.focus(); }, 50);
  } else {
    other.style.display = 'none';
    other.value = '';
  }
}

function showProfSuggestion(){
  var loc    = (document.getElementById('fault-loc').value||'').trim();
  var box    = document.getElementById('fault-prof-suggest');
  if(!box) return;

  if(!loc){ box.style.display='none'; return; }

  var cats   = (loc === 'אחר') ? [] : (_LOC_TO_CAT[loc] || []);
  var profs  = (DB.professionals||[]).filter(function(p){
    return cats.length === 0 || cats.indexOf(p.cat) !== -1;
  });

  if(!profs.length){ box.style.display='none'; return; }

  var bldgName = (DB.building && DB.building.name) ? DB.building.name : 'הבניין';
  var catsLabel = (loc === 'אחר') ? 'כל בעלי המקצוע' : (cats.length ? cats.join(' / ') : 'בעל מקצוע');

  var html = '<div style="font-size:12px;font-weight:800;color:#1E40AF;margin-bottom:8px;">🔨 רוצה לקשר לבעל מקצוע? ('+catsLabel+')</div>';
  profs.forEach(function(p){
    var phoneClean = (p.phone||'').replace(/^0/,'').replace(/-/g,'');
    var msg = encodeURIComponent('שלום '+p.name+', אני וועד הבית מבניין '+bldgName+'. יש לנו תקלה ב'+loc+'. נשמח לתיאום. מתי תוכל להגיע?');
    var waUrl = 'https://wa.me/972'+phoneClean+'?text='+msg;
    html +=
      '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #DBEAFE;">'+
        '<div>'+
          '<div style="font-size:13px;font-weight:800;color:#1E3A5C;">'+escHtml(p.name)+'</div>'+
          '<div style="font-size:11px;color:#3B82F6;">'+escHtml(p.cat)+'</div>'+
        '</div>'+
        '<a href="'+waUrl+'" target="_blank" '+
           'style="padding:7px 14px;background:linear-gradient(135deg,#25D366,#128C7E);'+
           'color:#fff;border-radius:10px;text-decoration:none;font-size:12px;font-weight:800;'+
           'font-family:var(--font);white-space:nowrap;">'+
          '💬 צור קשר'+
        '</a>'+
      '</div>';
  });
  html += '<div style="font-size:10px;color:#93C5FD;margin-top:6px;">לחיצה תפתח וואטסאפ — ניתן לסגור ולמשיך לדיווח</div>';

  box.innerHTML  = html;
  box.style.display = 'block';
}

function submitFault(){
  var locSel = document.getElementById('fault-loc');
  var locVal = (locSel ? locSel.value : '').trim();
  var loc = locVal;
  if(locVal === 'אחר'){
    var otherInp = document.getElementById('fault-loc-other');
    var otherVal = (otherInp ? otherInp.value : '').trim();
    loc = otherVal || 'אחר';
  }
  loc = loc;
  var desc = (document.getElementById('fault-desc').value||'').trim();
  var pri  = document.getElementById('fault-pri').value||'med';
  var domain = (document.getElementById('fault-domain') ? document.getElementById('fault-domain').value : '')||'';
  var err  = document.getElementById('fault-err');

  if(!loc||!desc){
    err.textContent='נא למלא מיקום ותיאור';
    err.style.display='block';
    return;
  }
  err.style.display='none';

  var slug = _getBuildingSlug();
  if(!slug){ showToast('שגיאה: לא זוהה בניין'); return; }

  var record = {
    building_slug: slug,
    title:       loc+' — '+desc.slice(0,30),
    loc:         loc,
    description: desc,
    pri:         pri,
    status:      'open',
    date:        fmtDate(new Date()),
    reporter:    DB.user ? DB.user.name : 'דייר',
    unit:        DB.user ? DB.user.unit : null,
    domain:      domain
  };

  function _doInsertFault(photoUrl){
    if(photoUrl) record.photo_url = photoUrl;
    sbClient.from('faults').insert([record]).then(function(res){
      if(res.error){ showToast('שגיאה בשמירת תקלה: '+res.error.message); return; }
      document.getElementById('fault-loc').value='';
      document.getElementById('fault-desc').value='';
      document.getElementById('fault-pri').value='med';
      var domEl = document.getElementById('fault-domain'); if(domEl) domEl.value='';
      var otherInp2 = document.getElementById('fault-loc-other');
      if(otherInp2){ otherInp2.value=''; otherInp2.style.display='none'; }
      var suggestBox = document.getElementById('fault-prof-suggest');
      if(suggestBox) suggestBox.style.display='none';
      var prev = document.getElementById('fault-photo-preview');
      if(prev){ prev.src=''; prev.style.display='none'; }
      var photoInp = document.getElementById('fault-photo');
      if(photoInp) photoInp.value='';
      _faultPhotoFile = null;
      closeSheet('fault');
      loadFaultsFromSupabase(function(){ renderFaultsPage(); renderHomePage(); });
      showToast('תקלה דווחה ✅');
    });
  }
  var photoFile = _faultPhotoFile || null;
  if(photoFile){
    var ext = photoFile.name.split('.').pop() || 'jpg';
    var fileName = slug+'-'+Date.now()+'.'+ext;
    sbClient.storage.from('fault-images').upload(fileName, photoFile, {contentType: photoFile.type, upsert:true}).then(function(res){
      if(res.error){ _doInsertFault(null); return; }
      var urlRes = sbClient.storage.from('fault-images').getPublicUrl(fileName);
      var publicUrl = urlRes.data && urlRes.data.publicUrl ? urlRes.data.publicUrl : null;
      _doInsertFault(publicUrl);
    }).catch(function(){ _doInsertFault(null); });
  } else {
    _doInsertFault(null);
  }
}


/* ═══════════════════════════════════════════════════════════════
   CONTENT MODERATION
═══════════════════════════════════════════════════════════════ */
var _BANNED_WORDS = [
  'טמבל','טיפש','מטומטם','אידיוט','מזדיין','כוסאמק','זין','לזיין',
  'בן זונה','בת זונה','כלבה','כלב','חרא','שיט','שט','פרה','פרות',
  'מנוול','גנב','שקרן','ערבי זבל','יהודי זבל','נאצי','כושי',
  'סתום','לך לעזאזל'
];

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
