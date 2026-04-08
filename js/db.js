/* ═══════════════════════════════════════════════════════════════
   db.js — שכנות טובה · SmartNeighbor
   ניהול נתונים מקומי + כל קריאות Supabase
   תלוי ב: config.js, utils.js
═══════════════════════════════════════════════════════════════ */

/* ── DB Object ─────────────────────────────────────────────── */
var DB = null;

function defaultDB(){
  return {
    user:{ name:'דייר', unit:0 },
    building:{ name:'', city:'', total_units:0, monthly_fee:0 },
    finance:{ income:0, balance:0, expenses:[] },
    paidMonths:{}, unitPaid:{}, unitNames:{},
    pendingPayments:[], approvedReceipts:{},
    expenseCategories:['ניקיון','חשמל','גינה','ביטוח','מעלית','שרברב','כללי'],
    docCategories:['ביטוחים','פרוטוקולים','חוזים','דוחות','אחר'],
    paySettings:{ bit:'', paybox:'', bankName:'', bankBranch:'', bankAccount:'', bankOwner:'', vaadPhone:'' },
    adminPin:'1234',
    maintenance:[], maintenanceSeq:1,
    notices:[], posts:[], postSeq:1,
    poll:{ q:'', opts:[], userVote:null, votedDevices:[], unitVotes:{} },
    docs:[], residentPhones:{},
    customDocs:[], customDocSeq:1,
    professionals:[], profSeq:1,
    driveLink:''
  };
}

function loadDB(){
  try{
    var raw = localStorage.getItem(DB_KEY);
    if(raw){ DB = JSON.parse(raw); migrateDB(); }
    else { DB = defaultDB(); saveDB(); }
  } catch(e){ DB = defaultDB(); saveDB(); }
}

function saveDB(){
  try{ localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch(e){}
}

function migrateDB(){
  var d = defaultDB();
  if(!DB.building)          DB.building = d.building;
  if(!DB.finance)           DB.finance  = d.finance;
  if(!DB.unitNames)         DB.unitNames = d.unitNames;
  if(!DB.pendingPayments)   DB.pendingPayments = [];
  if(!DB.approvedReceipts)  DB.approvedReceipts = {};
  if(!DB.expenseCategories || !DB.expenseCategories.length) DB.expenseCategories = d.expenseCategories;
  if(!DB.docCategories || !DB.docCategories.length)         DB.docCategories = d.docCategories;
  if(!DB.paySettings)       DB.paySettings = d.paySettings;
  if(DB.paySettings.vaadPhone===undefined) DB.paySettings.vaadPhone='';
  if(!DB.adminPin)          DB.adminPin = '1234';
  if(!DB.maintenance)       DB.maintenance = d.maintenance;
  if(!DB.maintenanceSeq)    DB.maintenanceSeq = d.maintenanceSeq;
  if(!DB.notices)           DB.notices = d.notices;
  if(!DB.posts)             DB.posts = d.posts;
  if(!DB.postSeq)           DB.postSeq = d.postSeq;
  if(!DB.poll)              DB.poll = d.poll;
  if(!DB.docs)              DB.docs = d.docs;
  if(!DB.paidMonths)        DB.paidMonths = {};
  if(!DB.unitPaid)          DB.unitPaid = {};
  if(!DB.user)              DB.user = d.user;
  if(!DB.finance.expenses || !DB.finance.expenses.length) DB.finance.expenses = d.finance.expenses;
  if(!DB.residentPhones)    DB.residentPhones = {};
  if(!DB.poll.votedDevices) DB.poll.votedDevices = [];
  if(!DB.poll.unitVotes)    DB.poll.unitVotes = {};
  if(!DB.driveLink)         DB.driveLink = '';
  if(!DB.customDocs)        DB.customDocs = [];
  if(!DB.customDocSeq)      DB.customDocSeq = 1;
  if(!DB.professionals)     DB.professionals = [];
  if(!DB.profSeq)           DB.profSeq = 1;
  DB.finance.expenses.forEach(function(e){
    if(!e.receiptSupplier) e.receiptSupplier='';
    if(!e.expType)  e.expType  = 'חד פעמית';
    if(!e.month)    e.month    = '';
    if(!e.receiptDate)     e.receiptDate='';
    if(!e.details)         e.details='';
  });
}

/* ── Session ───────────────────────────────────────────────── */
function getSession(){
  try{ var raw = localStorage.getItem(SESS_KEY); return raw ? JSON.parse(raw) : null; }
  catch(e){ return null; }
}

/* ── Building Slug ─────────────────────────────────────────── */
function _getBuildingSlug(){
  try{
    var params = new URLSearchParams(window.location.search);
    var slugUrl = (params.get('b')||'').trim();
    if(slugUrl) return slugUrl;
    var raw = localStorage.getItem('sn_building_data');
    if(raw){ var bd = JSON.parse(raw); if(bd && bd.unique_slug) return bd.unique_slug; }
  } catch(e){}
  return '';
}

/* ── Load from Supabase ────────────────────────────────────── */
function loadFaultsFromSupabase(cb){
  var slug = _getBuildingSlug();
  if(!slug){ if(cb) cb(); return; }
  sbClient.from('faults').select('*').eq('building_slug', slug).order('created_at', {ascending:false}).then(function(res){
    if(!res.error && res.data){
      DB.maintenance = res.data.map(function(r){
        return { id:r.id, title:r.title, loc:r.loc, desc:r.description, pri:r.pri, status:r.status, date:r.date, reporter:r.reporter, unit:r.unit, doneAt:r.done_at, completionDate:r.completion_date, photo_url:r.photo_url||null, photo_after_url:r.photo_after_url||null, domain:r.domain||'' };
      });
    }
    if(cb) cb();
  });
}

function loadNoticesFromSupabase(cb){
  var slug = _getBuildingSlug();
  if(!slug){ if(cb) cb(); return; }
  sbClient.from('notices').select('*').eq('building_slug', slug).order('date', {ascending:false}).then(function(res){
    if(!res.error && res.data) DB.notices = res.data;
    if(cb) cb();
  });
}

function loadPostsFromSupabase(cb){
  var slug = _getBuildingSlug();
  if(!slug){ if(cb) cb(); return; }
  sbClient.from('posts').select('*').eq('building_slug', slug).order('created_at', {ascending:false}).then(function(res){
    if(!res.error && res.data) DB.posts = res.data;
    if(cb) cb();
  });
}

function loadPollFromSupabase(cb){
  var slug = _getBuildingSlug();
  if(!slug){ if(cb) cb(); return; }
  sbClient.from('polls').select('*').eq('building_slug', slug).eq('is_active', true).order('created_at', {ascending:false}).limit(1).then(function(res){
    if(!res.error && res.data && res.data.length > 0){
      var r = res.data[0];
      DB.poll = { id:r.id, q:r.question, opts:(r.options||[]).map(function(o){ return {label:o.label, votes:o.votes||0}; }), unitVotes:r.unit_votes||{}, userVote:null, votedDevices:[] };
    } else {
      DB.poll = { q:'', opts:[], unitVotes:{}, userVote:null, votedDevices:[] };
    }
    if(cb) cb();
  });
}

function loadProfessionalsFromSupabase(cb){
  var slug = _getBuildingSlug();
  if(!slug){ if(cb) cb(); return; }
  var buildingCity = (DB.building && DB.building.city) ? DB.building.city : '';
  sbClient.from('professionals').select('*').order('created_at', {ascending:true}).then(function(res){
    if(!res.error && res.data){
      DB.professionals = res.data.filter(function(r){
        if(r.building_slug === slug) return true;
        if(buildingCity && r.service_cities){
          var cities = [];
          try{ cities = typeof r.service_cities === 'string' ? JSON.parse(r.service_cities) : r.service_cities; }catch(e){}
          if(Array.isArray(cities) && cities.indexOf(buildingCity) !== -1) return true;
        }
        return false;
      }).map(function(r){
        return { id:r.id, name:r.name||'', phone:r.phone||'', cat:r.cat||'אחר', notes:r.notes||'', area:r.area||'', service_cities:r.service_cities||[], is_verified:r.is_verified||false, is_suspended:r.is_suspended||false, agreement_data:r.agreement_data||null, rating:r.rating||0, rating_count:r.rating_count||0, reviews:r.reviews||[], is_network:r.building_slug !== slug };
      });
    }
    if(cb) cb();
  });
}

function loadPaymentsFromSupabase(cb){
  var slug = _getBuildingSlug();
  if(!slug){ if(cb) cb(); return; }
  sbClient.from('payments').select('*').eq('building_slug', slug).order('created_at', {ascending:false}).then(function(res){
    if(!res.error && res.data){
      DB.pendingPayments  = [];
      DB.approvedReceipts = {};
      res.data.forEach(function(r){
        var mk   = r.month_key || '';
        var unit = r.unit != null ? Number(r.unit) : r.unit;
        if(r.status === 'pending'){
          DB.pendingPayments.push({ id:r.id, unit:unit, monthKey:mk, method:r.method||'', methodLabel:r.method_label||'', amount:r.amount||'', monthLabel:r.month_label||'', ref:r.ref||'', note:r.note||'', ts:new Date(r.created_at).getTime() });
        } else if(r.status === 'approved'){
          DB.approvedReceipts[unit+'-'+mk] = { id:r.id, name:DB.unitNames[unit]||('דירה '+unit), unit:unit, amount:r.amount||'', method:r.method||'', methodLabel:r.method_label||'', monthLabel:r.month_label||'', approvedDate:r.approved_date||'', approvedBy:r.approved_by||'', building:DB.building?DB.building.name:'' };
        }
      });
    }
    if(cb) cb();
  });
}

/* ═══════════════════════════════════════════════════════════════
   EXPENSES — Supabase CRUD
   טעינה, שמירה, עדכון, מחיקה של הוצאות
═══════════════════════════════════════════════════════════════ */

function loadExpensesFromSupabase(cb){
  var slug = _getBuildingSlug();
  if(!slug){ if(cb) cb(); return; }
  sbClient.from('expenses').select('*').eq('building_slug', slug).order('created_at', {ascending:true}).then(function(res){
    if(!res.error && res.data){
      DB.finance.expenses = res.data.map(function(r){
        return {
          id:              r.id,
          cat:             r.cat             || 'כללי',
          amount:          r.amount          || 0,
          expType:         r.exp_type        || 'חד פעמית',
          month:           r.month           || '',
          year:            r.year            || new Date().getFullYear(),
          receiptDate:     r.receipt_date    || '',
          receiptSupplier: r.receipt_supplier|| '',
          details:         r.details         || '',
          photo_url:       r.photo_url       || null,
          invoice_link:    r.invoice_link    || null,
          fault_id:        r.fault_id        || null,
          source:          r.source          || 'manual',
          color:           '#3B82F6'
        };
      });
    }
    if(cb) cb();
  });
}

function saveExpenseToSupabase(expense, cb){
  var slug = _getBuildingSlug();
  if(!slug){ if(cb) cb(null); return; }
  var record = {
    building_slug:    slug,
    cat:              expense.cat             || 'כללי',
    amount:           expense.amount          || 0,
    exp_type:         expense.expType         || 'חד פעמית',
    month:            expense.month           || '',
    year:             expense.year            || new Date().getFullYear(),
    receipt_date:     expense.receiptDate     || '',
    receipt_supplier: expense.receiptSupplier || '',
    details:          expense.details         || '',
    photo_url:        expense.photo_url       || null,
    invoice_link:     expense.invoice_link    || null,
    fault_id:         expense.fault_id        || null,
    source:           expense.source          || 'manual'
  };
  sbClient.from('expenses').insert([record]).select().then(function(res){
    if(!res.error && res.data && res.data[0]){
      if(cb) cb(res.data[0].id);
    } else {
      if(cb) cb(null);
    }
  });
}

function updateExpenseInSupabase(id, fields){
  if(!id) return;
  var record = {};
  if(fields.cat             !== undefined) record.cat              = fields.cat;
  if(fields.amount          !== undefined) record.amount           = fields.amount;
  if(fields.expType         !== undefined) record.exp_type         = fields.expType;
  if(fields.month           !== undefined) record.month            = fields.month;
  if(fields.year            !== undefined) record.year             = fields.year;
  if(fields.receiptDate     !== undefined) record.receipt_date     = fields.receiptDate;
  if(fields.receiptSupplier !== undefined) record.receipt_supplier = fields.receiptSupplier;
  if(fields.details         !== undefined) record.details          = fields.details;
  sbClient.from('expenses').update(record).eq('id', id).then(function(){});
}

function deleteExpenseFromSupabase(id){
  if(!id) return;
  sbClient.from('expenses').delete().eq('id', id).then(function(){});
}
