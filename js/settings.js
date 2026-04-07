/* settings.js — שכנות טובה */
function pinNext(el, nextIdx){
  if(el.value.length===1){
    var next = document.getElementById('pin'+nextIdx);
    if(next) next.focus();
  }
}

function pinSubmitAuto(){
  var v = '';
  for(var i=0;i<4;i++){ var b=document.getElementById('pin'+i); if(b) v+=b.value; }
  if(v.length===4) submitPin();
}

function submitPin(){
  var v = '';
  for(var i=0;i<4;i++){ var b=document.getElementById('pin'+i); if(b) v+=b.value; }
  var err = document.getElementById('pin-error-msg');
  if(v !== DB.adminPin){
    if(err){ err.textContent='קוד שגוי. נסה שוב'; err.style.display='block'; }
    for(var j=0;j<4;j++){ var bx=document.getElementById('pin'+j); if(bx) bx.value=''; }
    var pin0=document.getElementById('pin0'); if(pin0) pin0.focus();
    return;
  }
  ADMIN_ON = true;
  if(err) err.style.display='none';
  showToast('✅ כניסת מנהל הצליחה');
  renderSettingsPage();
  renderCommunityPage();
  updateNavDot();
}

function lockAdmin(){
  ADMIN_ON = false;
  for(var i=0;i<4;i++){ var b=document.getElementById('pin'+i); if(b) b.value=''; }
  renderSettingsPage();
  renderCommunityPage();
  updateNavDot();
  showToast('🔒 ממשק ועד ננעל');
}

function savePin(){
  var v = (document.getElementById('new-pin-inp').value||'').trim();
  if(v.length<4 || v.length>6 || !/^\d+$/.test(v)){
    showToast('קוד חייב להיות 4-6 ספרות'); return;
  }
  DB.adminPin = v;
  saveDB();
  document.getElementById('new-pin-inp').value='';
  showToast('קוד מנהל עודכן ✅');
}

/* ═══════════════════════════════════════════════════════════════
   BUILDING / PAY SETTINGS
═══════════════════════════════════════════════════════════════ */
function saveBuildingConfig(){
  var nm = (document.getElementById('admin-bldg-name').value||'').trim()||DB.building.name;
  var un = parseInt(document.getElementById('admin-units').value, 10);
  if(isNaN(un) || un < 1) un = DB.building.total_units;
  var fe = parseInt(document.getElementById('admin-fee').value, 10);
  if(isNaN(fe) || fe < 0) fe = DB.building.monthly_fee;
  DB.building.name        = nm;
  DB.building.total_units = un;
  DB.building.monthly_fee = fe;
  saveDB();
  updateCfgLive();
  renderHeader();
  showToast('הגדרות בניין עודכנו ✅');
}

function savePaySettings(){
  DB.paySettings.vaadPhone   = (document.getElementById('admin-vaad-phone').value||'').trim();
  DB.paySettings.bit         = (document.getElementById('admin-bit').value||'').trim();
  DB.paySettings.paybox      = (document.getElementById('admin-paybox').value||'').trim();
  DB.paySettings.bankName    = (document.getElementById('admin-bank-name').value||'').trim();
  DB.paySettings.bankBranch  = (document.getElementById('admin-bank-branch').value||'').trim();
  DB.paySettings.bankAccount = (document.getElementById('admin-bank-account').value||'').trim();
  DB.paySettings.bankOwner   = (document.getElementById('admin-bank-owner').value||'').trim();
  saveDB();
  showToast('הגדרות תשלום נשמרו ✅');
}

/* ═══════════════════════════════════════════════════════════════
   BUDGET MANAGER
═══════════════════════════════════════════════════════════════ */
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

function switchNewDocTab(type){
  _newDocType = type;
  document.getElementById('new-doc-tab-text').className = 'doc-type-tab'+(type==='text'?' active':'');
  document.getElementById('new-doc-tab-link').className = 'doc-type-tab'+(type==='link'?' active':'');
  document.getElementById('new-doc-text-wrap').style.display = type==='text' ? 'block' : 'none';
  document.getElementById('new-doc-link-wrap').style.display = type==='link' ? 'flex' : 'none';
}

function addCustomDoc(){
  var title = (document.getElementById('new-doc-title').value||'').trim();
  if(!title){ showToast('נא להזין כותרת'); return; }
  var cat   = (document.getElementById('new-doc-cat') ? document.getElementById('new-doc-cat').value : '')||'';
  if(_newDocType==='text'){
    var text = (document.getElementById('new-doc-text').value||'').trim();
    if(!text){ showToast('נא להזין תוכן'); return; }
    DB.customDocs.push({
      id: DB.customDocSeq++, type:'text',
      title: title, text: text, cat: cat,
      date: fmtDate(new Date())
    });
  } else {
    var link = (document.getElementById('new-doc-link').value||'').trim();
    if(!link){ showToast('נא להזין קישור'); return; }
    DB.customDocs.push({
      id: DB.customDocSeq++, type:'link',
      title: title, link: link, cat: cat,
      date: fmtDate(new Date())
    });
  }
  saveDB();
  document.getElementById('new-doc-title').value = '';
  document.getElementById('new-doc-text').value  = '';
  document.getElementById('new-doc-link').value  = '';
  showToast('📋 פורסם לדיירים ✅');
  renderDocCatManager();
  renderCustomDocsAdmin();
  renderDocsPage();
}

function deleteCustomDoc(id){
  if(!confirm('למחוק פרסום זה?')) return;
  DB.customDocs = DB.customDocs.filter(function(d){ return d.id!==id; });
  saveDB();
  showToast('נמחק');
  renderDocCatManager();
  renderCustomDocsAdmin();
  renderDocsPage();
}

function renderCustomDocsAdmin(){
  var el = document.getElementById('custom-docs-admin-list');
  if(!el) return;
  var docs = DB.customDocs||[];
  if(!docs.length){
    el.innerHTML = '<div class="empty-state" style="padding:12px 0;">אין פרסומים עדיין</div>';
    return;
  }
  var html = '';
  docs.slice().reverse().forEach(function(d){
    var preview = d.type==='link'
      ? '<span style="font-size:11px;color:var(--blue);">🔗 '+escHtml(d.link.length>45?d.link.slice(0,45)+'...':d.link)+'</span>'
      : '<span style="font-size:11px;color:var(--slate);">'+escHtml(d.text.length>80?d.text.slice(0,80)+'...':d.text)+'</span>';
    html += '<div class="cdoc-card'+(d.type==='link'?' is-link':'')+'">'+
      '<div class="cdoc-title">'+
        '<span>'+(d.type==='link'?'🔗':'📋')+' '+escHtml(d.title)+'</span>'+
        '<button class="cdoc-del-btn" onclick="deleteCustomDoc('+d.id+')">🗑️ מחק</button>'+
      '</div>'+
      '<div style="margin-top:4px;">'+preview+'</div>'+
      '<div class="cdoc-date">פורסם: '+escHtml(d.date)+'</div>'+
    '</div>';
  });
  el.innerHTML = html;
}

function saveDriveLink(){
  var v = (document.getElementById('admin-drive-link').value||'').trim();
  DB.driveLink = v;
  saveDB();
  showToast(v ? 'קישור Drive נשמר ✅' : 'קישור נמחק');
  renderDocsPage();
}

/* ── EXPENSE DETAILS FORM (admin) ────────────────────────────── */
/* ═══════════════════════════════════════════════════════════════
   CATEGORY MANAGERS
═══════════════════════════════════════════════════════════════ */
function renderExpCatManager(){
  var el = document.getElementById('exp-cat-manager');
  if(!el) return;
  var html = '';
  (DB.expenseCategories||[]).forEach(function(c,i){
    html += '<div class="cat-row">'+
      '<input class="admin-inp" value="'+escAttr(c)+'" oninput="DB.expenseCategories['+i+']=this.value">'+
      '<button class="cat-del-btn" onclick="DB.expenseCategories.splice('+i+',1);saveDB();renderExpCatManager()">🗑️</button></div>';
  });
  html += '<button class="cat-add-btn" onclick="DB.expenseCategories.push(\'חדשה\');saveDB();renderExpCatManager()">+ הוסף קטגוריה</button>';
  el.innerHTML = html;
}

function renderDocCatManager(){
  var el = document.getElementById('doc-cat-manager');
  if(!el) return;
  var html = '';
  (DB.docCategories||[]).forEach(function(c,i){
    // count docs in this category
    var catDocs = (DB.customDocs||[]).filter(function(d){ return d.cat===c; });
    html +=
      '<div style="background:#fff;border-radius:12px;border:1.5px solid #E2E8F0;margin-bottom:8px;overflow:hidden;">'+
        '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#F8FAFC;">'+
          '<span style="font-size:14px;">📁</span>'+
          '<input class="admin-inp" style="flex:1;background:transparent;border:none;padding:4px 0;font-weight:700;" value="'+escAttr(c)+'" oninput="DB.docCategories['+i+']=this.value">'+
          (catDocs.length?'<span style="font-size:10px;background:#EFF6FF;color:var(--blue);padding:3px 8px;border-radius:8px;font-weight:800;">'+catDocs.length+' מסמכים</span>':'')+
          '<button class="cat-del-btn" onclick="DB.docCategories.splice('+i+',1);saveDB();renderDocCatManager()">🗑️</button>'+
        '</div>'+
        // docs in this category
        (catDocs.length ? catDocs.map(function(d){
          return '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-top:1px solid #F1F5F9;">'+
            '<span style="font-size:13px;">'+(d.type==='link'?'🔗':'📋')+'</span>'+
            '<span style="flex:1;font-size:12px;font-weight:700;color:var(--navy);">'+escHtml(d.title)+'</span>'+
            '<span style="font-size:10px;color:var(--slate);">'+escHtml(d.date)+'</span>'+
            '<button class="cdoc-del-btn" onclick="deleteCustomDoc('+d.id+')">🗑️</button>'+
          '</div>';
        }).join('') : '')+
      '</div>';
  });
  html += '<button class="cat-add-btn" onclick="DB.docCategories.push(\'חדשה\');saveDB();renderDocCatManager()">+ הוסף קטגוריה</button>';
  el.innerHTML = html;
  // populate category select in the add form
  var sel = document.getElementById('new-doc-cat');
  if(sel){
    var prev = sel.value;
    sel.innerHTML = '<option value="">ללא קטגוריה</option>';
    (DB.docCategories||[]).forEach(function(c){
      sel.innerHTML += '<option value="'+escAttr(c)+'"'+(prev===c?' selected':'')+'>'+escHtml(c)+'</option>';
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   PIN
═══════════════════════════════════════════════════════════════ */
function exportCSV(type){
  var rows = [];
  var bom  = '\uFEFF';
  var year = new Date().getFullYear();
  var b    = DB.building;

  if(type==='income'){
    rows.push(['חודש','דירה','שם','סכום','שיטה','תאריך אישור']);
    Object.keys(DB.approvedReceipts).forEach(function(k){
      var r = DB.approvedReceipts[k];
      rows.push([r.monthLabel||k, r.unit, r.name||'', r.amount, r.methodLabel||'', r.approvedDate||'']);
    });
  }

  if(type==='expenses'){
    rows.push(['קטגוריה','ספק','סכום','תאריך']);
    DB.finance.expenses.forEach(function(e){
      rows.push([e.cat, e.receiptSupplier||'', e.amount, e.receiptDate||'']);
    });
  }

  if(type==='full'){
    // ── כותרת ──
    rows.push(['דוח שנתי — ועד בית', b.name||'', '', '', '', '']);
    rows.push(['שנה:', year, 'כתובת:', b.city||'', 'מספר דירות:', b.total_units||'']);
    rows.push(['תאריך הפקה:', fmtDate(new Date()), '', '', '', '']);
    rows.push([]);

    // ── סיכום כללי ──
    var totalIncome  = 0;
    Object.keys(DB.approvedReceipts).forEach(function(k){ totalIncome += Number(DB.approvedReceipts[k].amount)||0; });
    var totalExpenses = 0;
    DB.finance.expenses.forEach(function(e){ totalExpenses += (Number(e.amount)||0) * (e.expType==='קבועה' ? 12 : 1); });
    var balance = totalIncome - totalExpenses;

    rows.push(['══ סיכום כללי ══','','','','','']);
    rows.push(['סה"כ הכנסות (ועד):', totalIncome+'₪', '', 'סה"כ הוצאות:', totalExpenses+'₪', '']);
    rows.push(['יתרה:', balance+'₪', balance>=0?'✅ עודף':'⚠️ גירעון', '', '', '']);
    rows.push([]);

    // ── הכנסות לפי חודש ──
    rows.push(['══ הכנסות לפי חודש ══','','','','','']);
    rows.push(['חודש','דירה','שם','סכום','שיטה','תאריך אישור']);
    // קבץ לפי חודש
    var byMonth = {};
    Object.keys(DB.approvedReceipts).forEach(function(k){
      var r = DB.approvedReceipts[k];
      var m = r.monthLabel||k;
      if(!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(r);
    });
    Object.keys(byMonth).sort().forEach(function(m){
      var monthTotal = 0;
      byMonth[m].forEach(function(r){
        rows.push([m, 'דירה '+r.unit, r.name||'', r.amount+'₪', r.methodLabel||'', r.approvedDate||'']);
        monthTotal += Number(r.amount)||0;
      });
      rows.push(['סה"כ '+m, '', '', monthTotal+'₪', '', '']);
      rows.push([]);
    });

    // ── הוצאות לפי חודש ──
    var MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
    rows.push(['══ הוצאות לפי חודש ══','','','','','']);
    rows.push(['חודש','קטגוריה','ספק','סוג','סכום','']);
    MONTHS_HE.forEach(function(m){
      var monthExpenses = [];
      // הוצאות קבועות — מופיעות בכל חודש
      DB.finance.expenses.forEach(function(e){
        if(e.expType==='קבועה') monthExpenses.push(e);
      });
      // הוצאות חד פעמיות — רק אם החודש שלהן תואם
      DB.finance.expenses.forEach(function(e){
        if(e.expType!=='קבועה' && e.month===m) monthExpenses.push(e);
      });
      if(monthExpenses.length){
        var mTotal = 0;
        monthExpenses.forEach(function(e){
          rows.push([m, e.cat, e.receiptSupplier||'', e.expType||'חד פעמית', e.amount+'₪', '']);
          mTotal += Number(e.amount)||0;
        });
        rows.push(['סה"כ '+m,'','','',mTotal+'₪','']);
        rows.push([]);
      }
    });

    // ── הוצאות לפי קטגוריה ──
    rows.push(['══ הוצאות לפי קטגוריה ══','','','','','']);
    rows.push(['קטגוריה','ספק','סוג','סכום שנתי','','']);
    var byCat = {};
    DB.finance.expenses.forEach(function(e){
      if(!byCat[e.cat]) byCat[e.cat]=0;
      byCat[e.cat] += (Number(e.amount)||0) * (e.expType==='קבועה' ? 12 : 1);
      rows.push([e.cat, e.receiptSupplier||'', e.expType||'חד פעמית', e.amount+'₪ '+(e.expType==='קבועה'?'(×12)':'('+( e.month||'—')+')'),'','']);
    });
    rows.push([]);
    rows.push(['סיכום לפי קטגוריה','','','','','']);
    Object.keys(byCat).forEach(function(c){ rows.push([c, '', '', byCat[c]+'₪','','']); });
    rows.push([]);

    // ── חייבים ──
    var totalUnits = b.total_units || 24;
    var debtors = [];
    for(var u=1; u<=totalUnits; u++){
      // בדיקה אם שילם לפחות תשלום אחד מאושר
      var paid = Object.keys(DB.approvedReceipts).some(function(k){ return DB.approvedReceipts[k].unit==u; });
      if(!paid) debtors.push(u);
    }
    rows.push(['══ דיירים שלא שילמו (חייבים) ══','','','','','']);
    rows.push(['דירה','שם','','','','']);
    if(debtors.length){
      debtors.forEach(function(u){
        rows.push(['דירה '+u, DB.unitNames[u]||'לא ידוע','','','','']);
      });
    } else {
      rows.push(['✅ כל הדיירים שילמו','','','','','']);
    }
    rows.push([]);

    // ── תקלות ──
    rows.push(['══ תקלות שנה ══','','','','','']);
    rows.push(['כותרת','מיקום','עדיפות','סטטוס','תאריך','מדווח']);
    (DB.maintenance||[]).forEach(function(m){
      var st = m.status==='open'?'פתוח':m.status==='progress'?'בטיפול':'טופל';
      rows.push([m.title||'', m.loc||'', m.pri||'', st, m.date||'', m.reporter||'']);
    });
    rows.push([]);

    // ── בעלי מקצוע ──
    if((DB.professionals||[]).length){
      rows.push(['══ בעלי מקצוע ══','','','','','']);
      rows.push(['שם','קטגוריה','טלפון','הערות','דירוג','']);
      DB.professionals.forEach(function(p){
        rows.push([p.name||'', p.cat||'', p.phone||'', p.notes||'', p.rating?p.rating+'/5':'—','']);
      });
    }
  }

  var csv = bom + rows.map(function(r){ return r.map(function(c){ return '"'+(String(c||'').replace(/"/g,'""'))+'"'; }).join(','); }).join('\n');
  var bl  = new Blob([csv],{type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(bl);
  var a   = document.createElement('a');
  a.href  = url;
  a.download = 'vaad-bait-'+(type==='full'?'annual-report':type)+'-'+new Date().getFullYear()+'.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('קובץ יוצא ✅');
}

/* ═══════════════════════════════════════════════════════════════
   דוח שנתי — PDF מעוצב להדפסה
═══════════════════════════════════════════════════════════════ */
function exportAnnualPDF(){
  var year = new Date().getFullYear();
  var b    = DB.building;

  var totalIncome = 0;
  Object.keys(DB.approvedReceipts).forEach(function(k){ totalIncome += Number(DB.approvedReceipts[k].amount)||0; });
  var totalExpenses = 0;
  DB.finance.expenses.forEach(function(e){ totalExpenses += (Number(e.amount)||0) * (e.expType==='קבועה' ? 12 : 1); });
  var balance = totalIncome - totalExpenses;

  // חייבים
  var totalUnits = b.total_units||24;
  var debtors = [];
  for(var u=1;u<=totalUnits;u++){
    var paid = Object.keys(DB.approvedReceipts).some(function(k){ return DB.approvedReceipts[k].unit==u; });
    if(!paid) debtors.push(u);
  }

  // הכנסות לפי חודש
  var byMonth = {};
  Object.keys(DB.approvedReceipts).forEach(function(k){
    var r = DB.approvedReceipts[k];
    var m = r.monthLabel||k;
    if(!byMonth[m]) byMonth[m]={total:0,rows:[]};
    byMonth[m].total += Number(r.amount)||0;
    byMonth[m].rows.push(r);
  });

  // הוצאות לפי חודש (לדוח PDF)
  var MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
  var byExpMonth = {};
  MONTHS_HE.forEach(function(m){
    var monthExpenses = [];
    DB.finance.expenses.forEach(function(e){
      if(e.expType==='קבועה') monthExpenses.push(e);
      else if(e.month===m) monthExpenses.push(e);
    });
    if(monthExpenses.length) byExpMonth[m] = monthExpenses;
  });

  // הוצאות לפי קטגוריה — קבועה x12
  var byCat = {};
  DB.finance.expenses.forEach(function(e){
    if(!byCat[e.cat]) byCat[e.cat]=0;
    byCat[e.cat] += (Number(e.amount)||0) * (e.expType==='קבועה' ? 12 : 1);
  });

  var monthRows = Object.keys(byMonth).sort().map(function(m){
    var rr = byMonth[m].rows.map(function(r){
      return '<tr><td>'+escHtml(m)+'</td><td>דירה '+r.unit+'</td><td>'+escHtml(r.name||'')+'</td><td>'+escHtml(r.methodLabel||'')+'</td><td style="text-align:left;">₪'+num(r.amount)+'</td></tr>';
    }).join('');
    return rr + '<tr class="subtotal"><td colspan="4">סה"כ '+escHtml(m)+'</td><td style="text-align:left;">₪'+num(byMonth[m].total)+'</td></tr>';
  }).join('');

  // שורות הוצאות לפי חודש בPDF
  var expRows = MONTHS_HE.map(function(m){
    if(!byExpMonth[m]) return '';
    var mTotal = 0;
    var mHtml = byExpMonth[m].map(function(e){
      mTotal += Number(e.amount)||0;
      var typeBadge = e.expType==='קבועה'
        ? '<span style="font-size:10px;background:#DBEAFE;color:#1E40AF;border-radius:4px;padding:1px 5px;">קבועה</span>'
        : '<span style="font-size:10px;background:#F1F5F9;color:#475569;border-radius:4px;padding:1px 5px;">חד פעמית</span>';
      return '<tr><td>'+escHtml(m)+'</td><td>'+escHtml(e.cat)+'</td><td>'+escHtml(e.receiptSupplier||'—')+'</td><td>'+typeBadge+'</td><td style="text-align:left;">₪'+num(e.amount)+'</td></tr>';
    }).join('');
    return mHtml + '<tr class="subtotal"><td colspan="4">סה"כ '+escHtml(m)+'</td><td style="text-align:left;">₪'+num(mTotal)+'</td></tr>';
  }).join('');

  var catRows = DB.finance.expenses.map(function(e){
    var typeBadge = e.expType==='קבועה'
      ? '<span style="font-size:10px;background:#DBEAFE;color:#1E40AF;border-radius:4px;padding:1px 5px;">קבועה</span>'
      : '<span style="font-size:10px;background:#F1F5F9;color:#475569;border-radius:4px;padding:1px 5px;">חד פעמית</span>';
    var annualAmt = (Number(e.amount)||0) * (e.expType==='קבועה' ? 12 : 1);
    var detail = e.expType==='קבועה'
      ? '₪'+num(e.amount)+'/חודש &rarr; סה"כ שנתי: ₪'+num(annualAmt)
      : '₪'+num(annualAmt);
    return '<tr><td>'+escHtml(e.cat)+'</td><td>'+typeBadge+'</td><td style="text-align:left;">'+detail+'</td></tr>';
  }).join('');
  var grandTotal = DB.finance.expenses.reduce(function(a,e){ return a+(Number(e.amount)||0)*(e.expType==='קבועה'?12:1); },0);
  catRows += '<tr class="subtotal"><td colspan="2">סה"כ הוצאות שנתיות</td><td style="text-align:left;">₪'+num(grandTotal)+'</td></tr>';

  var debtorRows = debtors.length
    ? debtors.map(function(u){ return '<tr><td>דירה '+u+'</td><td>'+(DB.unitNames[u]||'לא ידוע')+'</td></tr>'; }).join('')
    : '<tr><td colspan="2" style="color:green;font-weight:bold;">✅ כל הדיירים שילמו</td></tr>';

  var maintRows = (DB.maintenance||[]).map(function(m){
    var st = m.status==='open'?'פתוח':m.status==='progress'?'בטיפול':'טופל';
    return '<tr><td>'+escHtml(m.title||'')+'</td><td>'+escHtml(m.loc||'')+'</td><td>'+escHtml(st)+'</td><td>'+escHtml(m.date||'')+'</td></tr>';
  }).join('') || '<tr><td colspan="4">אין תקלות רשומות</td></tr>';

  var profRows = (DB.professionals||[]).map(function(p){
    return '<tr><td>'+escHtml(p.name||'')+'</td><td>'+escHtml(p.cat||'')+'</td><td>'+escHtml(p.phone||'')+'</td><td>'+(p.rating?p.rating+'/5':'—')+'</td></tr>';
  }).join('') || '<tr><td colspan="4">אין בעלי מקצוע רשומים</td></tr>';

  var html = '<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="UTF-8">'+
  '<title>דוח שנתי '+year+' — '+escHtml(b.name||'')+'</title>'+
  '<style>'+
    'body{font-family:Arial,sans-serif;font-size:15px;color:#0f172a;margin:0;padding:24px;direction:rtl;}'+
    'h1{font-size:22px;color:#1E40AF;margin-bottom:4px;}'+
    '.subtitle{color:#1e293b;font-size:14px;margin-bottom:24px;}'+
    '.summary{display:flex;gap:16px;margin-bottom:28px;flex-wrap:wrap;}'+
    '.sum-box{flex:1;min-width:140px;border-radius:10px;padding:14px 18px;background:#EFF6FF;}'+
    '.sum-box.green{background:#F0FDF4;}.sum-box.red{background:#FEF2F2;}.sum-box.orange{background:#FFFBEB;}'+
    '.sum-label{font-size:13px;color:#1e293b;margin-bottom:4px;}'+
    '.sum-val{font-size:20px;font-weight:bold;color:#1E40AF;}'+
    '.sum-box.green .sum-val{color:#16A34A;}.sum-box.red .sum-val{color:#DC2626;}.sum-box.orange .sum-val{color:#D97706;}'+
    'h2{font-size:15px;color:#1E40AF;border-bottom:2px solid #DBEAFE;padding-bottom:6px;margin-top:28px;}'+
    'table{width:100%;border-collapse:collapse;margin-bottom:16px;}'+
    'th{background:#DBEAFE;color:#1e3a8a;padding:8px 10px;text-align:right;font-size:13px;font-weight:bold;}'+
    'td{padding:7px 10px;border-bottom:1px solid #E2E8F0;font-size:13px;color:#0f172a;}'+
    'tr:hover td{background:#F8FAFC;}'+
    'tr.subtotal td{background:#DBEAFE;font-weight:bold;}'+
    '.footer{margin-top:32px;text-align:center;font-size:12px;color:#475569;border-top:1px solid #E2E8F0;padding-top:12px;}'+
    '@media print{body{padding:8px;}button{display:none;}}'+
    '.print-btn{background:#1E40AF;color:#fff;border:none;border-radius:8px;padding:10px 22px;font-size:14px;cursor:pointer;margin-bottom:20px;}'+
  '</style></head><body>'+
  '<button class="print-btn" onclick="window.print()">🖨️ הדפס / שמור PDF</button>'+
  '<h1>📊 דוח שנתי '+year+'</h1>'+
  '<div class="subtitle">בניין: '+escHtml(b.name||'')+'&nbsp;·&nbsp;'+escHtml(b.city||'')+'&nbsp;·&nbsp;'+b.total_units+' דירות&nbsp;·&nbsp;הופק: '+fmtDate(new Date())+'</div>'+

  '<div class="summary">'+
    '<div class="sum-box green"><div class="sum-label">סה"כ הכנסות</div><div class="sum-val">₪'+num(totalIncome)+'</div></div>'+
    '<div class="sum-box red"><div class="sum-label">סה"כ הוצאות</div><div class="sum-val">₪'+num(totalExpenses)+'</div></div>'+
    '<div class="sum-box '+(balance>=0?'green':'orange')+'"><div class="sum-label">יתרה</div><div class="sum-val">₪'+num(balance)+'</div></div>'+
    '<div class="sum-box orange"><div class="sum-label">דיירים חייבים</div><div class="sum-val">'+debtors.length+'</div></div>'+
  '</div>'+

  '<h2>💳 הכנסות לפי חודש</h2>'+
  '<table><tr><th>חודש</th><th>דירה</th><th>שם</th><th>שיטת תשלום</th><th>סכום</th></tr>'+monthRows+'</table>'+

  '<h2>📤 הוצאות לפי חודש</h2>'+
  '<table><tr><th>חודש</th><th>קטגוריה</th><th>ספק</th><th>סוג</th><th>סכום</th></tr>'+expRows+'</table>'+
  '<table><tr><th>קטגוריה</th><th>סוג</th><th>סכום</th></tr>'+catRows+'</table>'+

  '<h2>⚠️ דיירים שלא שילמו</h2>'+
  '<table><tr><th>דירה</th><th>שם</th></tr>'+debtorRows+'</table>'+

  '<h2>🔧 תקלות</h2>'+
  '<table><tr><th>תקלה</th><th>מיקום</th><th>סטטוס</th><th>תאריך</th></tr>'+maintRows+'</table>'+

  '<h2>🔨 בעלי מקצוע</h2>'+
  '<table><tr><th>שם</th><th>קטגוריה</th><th>טלפון</th><th>דירוג</th></tr>'+profRows+'</table>'+

  '<div class="footer">הדוח הופק על ידי מערכת שכנות טובה · SmartNeighbor · '+fmtDate(new Date())+'</div>'+
  '</body></html>';

  var win = window.open('','_blank');
  if(win){ win.document.write(html); win.document.close(); }
  else { showToast('אפשר לפתוח חלונות קופצים בדפדפן'); }
}

/* ═══════════════════════════════════════════════════════════════
   SYNC: JSON EXPORT / IMPORT
═══════════════════════════════════════════════════════════════ */
function exportSyncJSON(){
  try{
    // גרסה 2 — כולל DB מלא (הגדרות, הוצאות, adminPin, הגדרות תשלום)
    // הערה: notices/faults/posts/professionals/payments נשמרים בסופרבייס ולא בקובץ זה
    var syncPayload = {
      _version: 2,
      _exportedAt: new Date().toISOString(),
      _building: DB.building.name,
      db: DB,
      residents: {}
    };
    // איסוף כל רישומי הדיירים מ-localStorage
    for(var i=0; i<localStorage.length; i++){
      var k = localStorage.key(i);
      if(k && k.indexOf('sn21_residents_')===0){
        try{ syncPayload.residents[k] = JSON.parse(localStorage.getItem(k)); } catch(e){}
      }
    }
    var json = JSON.stringify(syncPayload, null, 2);
    var bl   = new Blob([json],{type:'application/json;charset=utf-8;'});
    var url  = URL.createObjectURL(bl);
    var a    = document.createElement('a');
    var dateStr = new Date().toISOString().slice(0,10);
    a.href     = url;
    a.download = 'smartneighbor-sync-'+dateStr+'.json';
    a.click();
    URL.revokeObjectURL(url);
    _showSyncStatus('✅ הקובץ יוצא בהצלחה! שלח אותו למכשיר השני.', 'success');
  } catch(e){
    _showSyncStatus('❌ שגיאה בייצוא: '+e.message, 'error');
  }
}

function importSyncJSON(event){
  var file = event.target.files && event.target.files[0];
  if(!file){ return; }
  var reader = new FileReader();
  reader.onload = function(e){
    try{
      var payload = JSON.parse(e.target.result);
      // בדיקת מבנה — תומך גם בגרסה 1 (ישנה) וגם בגרסה 2 (עדכנית)
      if(!payload._version || !payload.db || !payload.db.building){
        _showSyncStatus('❌ קובץ לא תקין — ודא שזה קובץ סנכרון של SmartNeighbor', 'error');
        return;
      }
      if(!confirm('ייבוא נתונים מ"'+payload._building+'" (יוצא ב-'+payload._exportedAt.slice(0,10)+').\nהנתונים הנוכחיים יוחלפו. להמשיך?')){
        event.target.value='';
        return;
      }
      // ייבוא DB — שמירה תחת מפתח sn22_db הנוכחי
      localStorage.setItem(DB_KEY, JSON.stringify(payload.db));
      // ייבוא רישומי דיירים
      if(payload.residents){
        Object.keys(payload.residents).forEach(function(k){
          try{ localStorage.setItem(k, JSON.stringify(payload.residents[k])); } catch(ex){}
        });
      }
      // ניקוי session — המשתמש יתחבר מחדש
      try{ localStorage.removeItem(SESS_KEY); } catch(ex){}
      _showSyncStatus('✅ ייבוא הצליח! הדף יטען מחדש...', 'success');
      setTimeout(function(){ location.reload(); }, 1800);
    } catch(ex){
      _showSyncStatus('❌ שגיאה בקריאת הקובץ: '+ex.message, 'error');
    }
    event.target.value='';
  };
  reader.readAsText(file);
}

function _showSyncStatus(msg, type){
  var el = document.getElementById('sync-status');
  if(!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  el.style.background = type==='success' ? '#DCFCE7' : '#FEE2E2';
  el.style.color      = type==='success' ? '#166534' : '#DC2626';
  el.style.border     = type==='success' ? '1px solid #86EFAC' : '1px solid #FECACA';
  setTimeout(function(){ el.style.display='none'; }, 5000);
}

function copyField(id){
  var el = document.getElementById(id);
  if(!el) return;
  try{ navigator.clipboard.writeText(el.textContent||el.value); } catch(e){}
  showToast('הועתק ✅');
}

function copyAllBank(){
  var ps = DB.paySettings;
  var txt = 'בנק: '+ps.bankName+'\nסניף: '+ps.bankBranch+'\nחשבון: '+ps.bankAccount+'\nשם: '+ps.bankOwner;
  try{ navigator.clipboard.writeText(txt); } catch(e){}
  showToast('פרטי בנק הועתקו ✅');
}

/* ═══════════════════════════════════════════════════════════════
   SHEETS
═══════════════════════════════════════════════════════════════ */
function renderResidentsList(){
  var el = document.getElementById('residents-list-admin');
  if(!el) return;
  var slug = _getBuildingSlug();
  // שליפת נתוני דיירים מסופרבייס כולל טלפון
  if(slug){
    sbClient.from('residents').select('unit,name,phone').eq('building_slug',slug).then(function(res){
      if(!res.error && res.data){
        res.data.forEach(function(r){
          if(r.name) DB.unitNames[r.unit] = r.name;
          if(r.phone){ if(!DB.residentPhones) DB.residentPhones={}; DB.residentPhones[r.unit] = r.phone; }
        });
      }
      _doRenderResidentsList();
    }).catch(function(){ _doRenderResidentsList(); });
  } else { _doRenderResidentsList(); }
}

function _doRenderResidentsList(){
  var el = document.getElementById('residents-list-admin');
  if(!el) return;
  var mk = monthKey(getTargetDate());
  var tot = DB.building.total_units;
  var html = '';
  for(var i=1;i<=tot;i++){
    var name  = DB.unitNames[i]||('דייר '+i);
    var phone = (DB.residentPhones && DB.residentPhones[i])||'';
    var cleanPhone = phone.replace(/\D/g,'').replace(/^0/,'972');
    var wa1 = phone ? 'window.open(\'https://wa.me/'+cleanPhone+'\',\'_blank\')' : 'showToast(\'לא הוזן מספר לדירה '+i+'\')';
    var reminderMsg = encodeURIComponent('שלום, נשמח להסדרת תשלום הוועד. תודה!');
    var wa2 = phone ? 'window.open(\'https://wa.me/'+cleanPhone+'?text='+reminderMsg+'\',\'_blank\')' : 'showToast(\'לא הוזן מספר לדירה '+i+'\')';
    html += '<div class="res-row">'+
      '<div class="res-unit-badge">'+i+'</div>'+
      '<div style="flex:1;min-width:0;">'+
        '<div class="res-name">'+escHtml(name)+'</div>'+
        (phone?'<div class="res-phone">📞 '+escHtml(phone)+'</div>':'<div class="res-phone" style="color:#CBD5E1;">אין טלפון</div>')+
      '</div>'+
      '<button class="res-wa-btn" onclick="'+wa1+'" title="פתח WhatsApp">💬</button>'+
      '<button class="res-reminder-btn" onclick="'+wa2+'">📲 תזכורת</button>'+
    '</div>';
  }
  el.innerHTML = html || '<div class="empty-state">אין דיירים</div>';
}

function saveResidentEntry(){
  var unit = parseInt(document.getElementById('res-inp-unit').value)||0;
  var name = (document.getElementById('res-inp-name').value||'').trim();
  var phone= (document.getElementById('res-inp-phone').value||'').trim();
  if(!unit || unit<1 || unit>DB.building.total_units){ showToast('דירה לא תקינה'); return; }
  if(!DB.residentPhones) DB.residentPhones={};
  if(name) DB.unitNames[unit] = name;
  if(phone) DB.residentPhones[unit] = phone;
  saveDB();
  document.getElementById('res-inp-unit').value='';
  document.getElementById('res-inp-name').value='';
  document.getElementById('res-inp-phone').value='';
  showToast('דייר נשמר ✅');
  renderResidentsList();
  renderAdminCollBoard();
}
/* ═══════════════════════════════════════════════════════════════
   COLLECTION CENTER — מרכז גבייה חכם
═══════════════════════════════════════════════════════════════ */
function initCollectionCenter(){
  var sel = document.getElementById('cc-month-sel');
  if(!sel) return;
  var now = new Date();
  var html = '';
  for(var i=-2;i<=1;i++){
    var d = new Date(now.getFullYear(), now.getMonth()+i, 1);
    var mk = monthKey(d);
    var lbl = fmtMonth(d);
    html += '<option value="'+mk+'"'+(i===0?' selected':'')+'>'+lbl+'</option>';
  }
  sel.innerHTML = html;
  renderCollectionCenter();
}

function renderCollectionCenter(){
  var sel = document.getElementById('cc-month-sel');
  if(!sel) return;
  var mk  = sel.value || monthKey(new Date());
  var fee = DB.building.monthly_fee || 0;
  var tot = DB.building.total_units || 0;
  var slug = _getBuildingSlug();

  // בניית טבלה
  var rows = [];
  for(var i=1;i<=tot;i++){
    var name  = DB.unitNames[i]||('דירה '+i);
    var phone = (DB.residentPhones&&DB.residentPhones[i])||'—';
    // סכום ששולם לחודש זה
    var paidAmt = 0;
    Object.keys(DB.approvedReceipts||{}).forEach(function(k){ var r=DB.approvedReceipts[k]; if(r&&Number(r.unit)===i&&r.monthKey===mk) paidAmt+=parseFloat(r.amount)||0; });
    var isPending = DB.pendingPayments.some(function(p){ return p.unit===i && p.monthKey===mk; });
    var debt = Math.max(0, fee - paidAmt);
    var status = paidAmt>=fee ? 'paid' : (isPending ? 'pending' : (paidAmt>0 ? 'partial' : 'unpaid'));
    rows.push({unit:i, name:name, phone:phone, paidAmt:paidAmt, debt:debt, status:status});
  }

  // סיכום
  var totalPaid   = rows.filter(function(r){ return r.status==='paid'; }).length;
  var totalDebt   = rows.reduce(function(s,r){ return s+r.debt; },0);
  var totalIncome = rows.reduce(function(s,r){ return s+r.paidAmt; },0);
  var sumEl = document.getElementById('cc-summary');
  if(sumEl) sumEl.innerHTML = '<div style="flex:1;background:#F0FDF4;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:18px;font-weight:900;color:var(--green);">'+totalPaid+'/'+tot+'</div><div style="font-size:11px;color:var(--slate);">שילמו</div></div><div style="flex:1;background:#FFF7ED;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:18px;font-weight:900;color:var(--orange);">₪'+num(totalIncome)+'</div><div style="font-size:11px;color:var(--slate);">גבוי</div></div><div style="flex:1;background:#FFF1F2;border-radius:10px;padding:10px;text-align:center;"><div style="font-size:18px;font-weight:900;color:var(--rose);">₪'+num(totalDebt)+'</div><div style="font-size:11px;color:var(--slate);">חסר</div></div>';

  // טבלה
  var stLbls = {paid:'✅ שולם',pending:'⏳ ממתין',partial:'🔶 חלקי',unpaid:'❌ חסר'};
  var stCols = {paid:'#16A34A',pending:'#F59E0B',partial:'#EA580C',unpaid:'#E11D48'};
  var thtml = '<table style="width:100%;border-collapse:collapse;font-size:12px;">';
  thtml += '<tr style="background:#F8FAFC;"><th style="padding:8px 6px;text-align:right;font-weight:800;color:var(--navy);">דירה</th><th style="padding:8px 6px;text-align:right;font-weight:800;color:var(--navy);">שם</th><th style="padding:8px 6px;text-align:right;font-weight:800;color:var(--navy);">שולם</th><th style="padding:8px 6px;text-align:right;font-weight:800;color:var(--navy);">חוב</th><th style="padding:8px 6px;text-align:right;font-weight:800;color:var(--navy);">סטטוס</th></tr>';
  rows.forEach(function(r){
    thtml += '<tr style="border-bottom:1px solid #F1F5F9;">'+
      '<td style="padding:8px 6px;font-weight:700;">'+r.unit+'</td>'+
      '<td style="padding:8px 6px;">'+escHtml(r.name)+'</td>'+
      '<td style="padding:8px 6px;color:var(--green);font-weight:700;">₪'+num(r.paidAmt)+'</td>'+
      '<td style="padding:8px 6px;color:var(--rose);font-weight:700;">'+(r.debt>0?'₪'+num(r.debt):'—')+'</td>'+
      '<td style="padding:8px 6px;color:'+stCols[r.status]+';font-weight:800;">'+stLbls[r.status]+'</td></tr>';
  });
  thtml += '</table>';
  var tEl = document.getElementById('cc-table');
  if(tEl) tEl.innerHTML = thtml;

  // רשימת חייבים לתזכורת
  var debtors = rows.filter(function(r){ return r.status!=='paid' && r.phone!=='—'; });
  var rEl = document.getElementById('cc-reminders-list');
  if(rEl){
    if(!debtors.length){ rEl.innerHTML='<div style="color:var(--green);font-weight:700;">✅ כל הדיירים שילמו!</div>'; }
    else { rEl.innerHTML = debtors.map(function(r){ return '<div style="padding:4px 0;border-bottom:1px solid #F1F5F9;">'+escHtml(r.name)+' (דירה '+r.unit+') — חוב: ₪'+num(r.debt)+'</div>'; }).join(''); }
  }
  var btn = document.getElementById('cc-send-all-btn');
  if(btn) btn.style.display = debtors.length ? 'block' : 'none';
  window._ccDebtors = debtors;
  window._ccMonthKey = mk;
}

function sendAllReminders(){
  var debtors = window._ccDebtors || [];
  var mk = window._ccMonthKey || monthKey(new Date());
  var bldg = DB.building.name||'הבניין';
  var monthLbl = (function(){ var p=mk.split('-'); return (HE_MONTHS[parseInt(p[1])-1]||'')+' '+p[0]; })();
  if(!debtors.length){ showToast('אין חייבים לשליחה'); return; }
  // שולח אחד אחד — פותח וואטסאפ לכל חייב בהפרש של שניה
  debtors.forEach(function(r,i){
    setTimeout(function(){
      var phone = r.phone.replace(/\D/g,'').replace(/^0/,'');
      var msg = 'שלום '+r.name+', ועד הבית של '+bldg+' מזכיר לך שתשלום דמי הועד לחודש '+monthLbl+' עדיין לא התקבל. סכום לתשלום: ₪'+num(r.debt)+'. נא לשלם בהקדם דרך האפליקציה. תודה 🏢';
      window.open('https://wa.me/972'+phone+'?text='+encodeURIComponent(msg),'_blank');
    }, i*800);
  });
  showToast('שולח תזכורות ל-'+debtors.length+' דיירים...');
}

function exportCollectionCSV(){
  var sel = document.getElementById('cc-month-sel');
  var mk  = sel ? sel.value : monthKey(new Date());
  var fee = DB.building.monthly_fee||0;
  var tot = DB.building.total_units||0;
  var rows = [['דירה','שם','טלפון','שולם','חוב','סטטוס']];
  var stLbls = {paid:'שולם',pending:'ממתין',partial:'חלקי',unpaid:'חסר'};
  for(var i=1;i<=tot;i++){
    var name  = DB.unitNames[i]||('דירה '+i);
    var phone = (DB.residentPhones&&DB.residentPhones[i])||'';
    var paidAmt = 0;
    Object.keys(DB.approvedReceipts||{}).forEach(function(k){ var r=DB.approvedReceipts[k]; if(r&&Number(r.unit)===i&&r.monthKey===mk) paidAmt+=parseFloat(r.amount)||0; });
    var isPending = DB.pendingPayments.some(function(p){ return p.unit===i&&p.monthKey===mk; });
    var debt = Math.max(0,fee-paidAmt);
    var status = paidAmt>=fee?'paid':(isPending?'pending':(paidAmt>0?'partial':'unpaid'));
    rows.push([i,name,phone,paidAmt,debt,stLbls[status]]);
  }
  var csv = rows.map(function(r){ return r.join(','); }).join('\n');
  var blob = new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href=url; a.download='גבייה_'+mk+'.csv'; a.click();
  URL.revokeObjectURL(url);
}
