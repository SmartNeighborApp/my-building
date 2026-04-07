/* professionals.js — שכנות טובה · SmartNeighbor */
function setProfSearch(q){ _profSearchTerm=(q||'').trim().toLowerCase(); renderProfessionalsPage(); }

function renderProfessionalsPage(){
  // כפתור הוספה — לכולם
  var addBtn = document.getElementById('prof-add-btn-wrap');
  if(addBtn) addBtn.style.display = 'block';

  // סרגל סינון
  var filterBar = document.getElementById('prof-filter-bar');
  if(filterBar){
    filterBar.innerHTML = PROF_CATS.map(function(c){
      var active = c===_profFilterCat;
      return '<button onclick="setProfFilter(\''+c+'\')" style="flex-shrink:0;padding:6px 14px;border-radius:20px;border:none;font-size:12px;font-weight:800;font-family:var(--font);cursor:pointer;background:'+(active?'var(--navy)':'#F1F5F9')+';color:'+(active?'#fff':'var(--slate)')+';">'+c+'</button>';
    }).join('');
  }

  // רשימה
  var list = document.getElementById('prof-list');
  if(!list) return;
  var profs = DB.professionals || [];
  if(_profFilterCat !== 'הכל'){
    profs = profs.filter(function(p){ return p.cat === _profFilterCat; });
  }
  if(_profSearchTerm){ profs = profs.filter(function(p){ return [p.name,p.cat,p.notes,p.area].join(' ').toLowerCase().indexOf(_profSearchTerm)!==-1; }); }
  if(!profs.length){
    list.innerHTML = '<div class="empty-state" style="margin-top:40px;">אין בעלי מקצוע עדיין 🔨<br><span style="font-size:12px;color:var(--slate);">לחץ על הכפתור למטה להוספה</span></div>';
    return;
  }
  // מיון: מאומתים ראשונים, אחר כך לפי דירוג
  profs = profs.slice().sort(function(a,b){
    if(a.is_verified && !b.is_verified) return -1;
    if(!a.is_verified && b.is_verified) return 1;
    return (b.rating||0) - (a.rating||0);
  });
  list.innerHTML = profs.map(function(p){
    var stars = '';
    for(var i=1;i<=5;i++){
      stars += '<span onclick="rateProfessional('+p.id+','+i+')" style="cursor:pointer;font-size:18px;color:'+(i<=(p.rating||0)?'#F59E0B':'#CBD5E1')+';">★</span>';
    }
    var avgRating = p.rating ? p.rating.toFixed(1) : '—';
    var isAdmin = ADMIN_ON;
    var phoneClean = (p.phone||'').replace(/^0/,'').replace(/-/g,'');
    var bldgName   = (DB.building && DB.building.name) ? DB.building.name : 'הבניין';
    var userName   = (DB.user && DB.user.name)         ? DB.user.name     : 'דייר';
    var userUnit   = (DB.user && DB.user.unit)         ? DB.user.unit     : '';
    var waBase     = 'https://wa.me/972' + phoneClean;
    var msgVaad    = encodeURIComponent('שלום ' + p.name + ', אני וועד הבית מבניין ' + bldgName + '. נשמח לתיאום עבודה בתחום ' + p.cat + '. מתי תוכל להגיע?');
    var msgPersonal= encodeURIComponent('שלום ' + p.name + ', אני ' + userName + (userUnit ? ' מדירה ' + userUnit : '') + ' בבניין ' + bldgName + '. אשמח לקבל הצעת מחיר פרטית עבור ' + p.cat + '. מתי נוח לך?');

    // ביקורות דיירים
    var reviews = p.reviews || [];
    var reviewsHtml = '';
    if(reviews.length){
      reviewsHtml = '<div style="margin-top:10px;border-top:1px solid #F1F5F9;padding-top:8px;">';
      reviews.slice(-2).forEach(function(rv){
        var rvStars = '';
        for(var s=1;s<=5;s++) rvStars += '<span style="font-size:12px;color:'+(s<=rv.rating?'#F59E0B':'#CBD5E1')+';">★</span>';
        reviewsHtml +=
          '<div style="margin-bottom:6px;">'+
            '<div style="display:flex;align-items:center;gap:6px;">'+rvStars+
              '<span style="font-size:11px;color:var(--slate);">דירה '+rv.unit+'</span>'+
              '<span style="font-size:10px;color:#CBD5E1;margin-right:auto;">'+rv.date+'</span>'+
            '</div>'+
            (rv.text ? '<div style="font-size:12px;color:#374151;margin-top:2px;">'+escHtml(rv.text)+'</div>' : '')+
          '</div>';
      });
      reviewsHtml += '</div>';
    }

    return '<div style="background:#fff;border-radius:16px;padding:16px;margin-bottom:12px;box-shadow:0 1px 6px rgba(0,0,0,.07);">'+
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;">'+
        '<div style="display:flex;align-items:center;gap:10px;">'+
          '<div style="width:44px;height:44px;border-radius:12px;background:#EFF6FF;display:flex;align-items:center;justify-content:center;font-size:22px;">'+
            (PROF_ICONS[p.cat]||'📋')+
          '</div>'+
          '<div>'+
            '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">'+
              '<span style="font-size:14px;font-weight:900;color:var(--navy);">'+escHtml(p.name)+'</span>'+
              (p.is_verified && !p.is_suspended
                ? '<span style="background:#DCFCE7;color:#16A34A;font-size:10px;font-weight:800;padding:2px 7px;border-radius:20px;border:1px solid #BBF7D0;">✅ מאומת שכנות טובה</span>'
                : p.is_suspended
                  ? '<span style="background:#FEE2E2;color:#DC2626;font-size:10px;font-weight:800;padding:2px 7px;border-radius:20px;border:1px solid #FECACA;">⏸ מושהה</span>'
                  : p.agreement_data
                    ? '<span style="background:#FEF3C7;color:#D97706;font-size:10px;font-weight:800;padding:2px 7px;border-radius:20px;border:1px solid #FDE68A;">⏳ ממתין לאישור</span>'
                    : '')+
              (p.is_network
                ? '<span style="background:#EFF6FF;color:#2563EB;font-size:10px;font-weight:800;padding:2px 7px;border-radius:20px;border:1px solid #BFDBFE;">🌐 רשת שכנות טובה</span>'
                : '')+
            '</div>'+
            '<div style="font-size:12px;color:var(--slate);margin-top:1px;">'+escHtml(p.cat)+(p.area ? ' · 📍 '+escHtml(p.area) : '')+'</div>'+
          '</div>'+
        '</div>'+
        (isAdmin ? '<button onclick="openProfSheet('+p.id+')" style="padding:5px 10px;background:#F1F5F9;border:none;border-radius:8px;font-size:11px;font-weight:800;cursor:pointer;font-family:var(--font);color:var(--slate);">✏️ עריכה</button>' : '')+
        (isAdmin && !p.is_verified ? '<button data-pid="'+escAttr(String(p.id))+'" onclick="verifyProf(this.getAttribute(\'data-pid\'))" style="padding:5px 10px;background:#DCFCE7;border:1px solid #BBF7D0;border-radius:8px;font-size:11px;font-weight:800;cursor:pointer;font-family:var(--font);color:#16A34A;margin-right:4px;">✅ אמת</button>' : '')+
      '</div>'+
      (p.notes ? '<div style="margin-top:8px;font-size:12px;color:var(--slate);background:#F8FAFC;border-radius:8px;padding:7px 10px;">'+escHtml(p.notes)+'</div>' : '')+
      '<div style="display:flex;gap:8px;margin-top:12px;">'+
        '<button data-pid="'+escAttr(String(p.id))+'" onclick="openVaadOrderSheet(this.getAttribute(\'data-pid\'))" style="flex:1;padding:10px;background:linear-gradient(135deg,#1A3A5C,#2563EB);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;font-family:var(--font);">🏢 הזמנת ועד</button>'+
        '<button data-pid="'+escAttr(String(p.id))+'" onclick="openPersonalOrderSheet(this.getAttribute(\'data-pid\'))" style="flex:1;padding:10px;background:linear-gradient(135deg,#25D366,#128C7E);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;font-family:var(--font);">💬 הזמנה אישית</button>'+
        '<button data-pid="'+escAttr(String(p.id))+'" onclick="openReviewSheet(this.getAttribute(\'data-pid\'))" style="flex:1;padding:10px;background:#F1F5F9;color:var(--navy);border:none;border-radius:10px;font-size:13px;font-weight:800;cursor:pointer;font-family:var(--font);">📝 משוב</button>'+
      '</div>'+
      '<div style="margin-top:8px;text-align:left;">'+
        '<button data-pid="'+escAttr(String(p.id))+'" data-pname="'+escAttr(p.name)+'" onclick="submitComplaint(this.getAttribute(\'data-pid\'),this.getAttribute(\'data-pname\'))" style="padding:4px 10px;background:none;border:1px solid #FCA5A5;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;color:#EF4444;font-family:var(--font);">🚨 הגשת תלונה</button>'+
      '</div>'+
      '<div style="display:flex;align-items:center;gap:6px;margin-top:10px;">'+
        stars+
        '<span style="font-size:12px;color:var(--slate);margin-right:4px;">'+avgRating+'</span>'+
        '<span style="font-size:11px;color:#CBD5E1;">('+p.rating_count+' דירוגים)</span>'+
        (isAdmin ? '<button onclick="deleteProf('+p.id+')" style="margin-right:auto;padding:4px 10px;background:none;border:1px solid #FCA5A5;border-radius:8px;font-size:11px;font-weight:800;cursor:pointer;color:#EF4444;font-family:var(--font);">🗑️ מחק</button>' : '')+
      '</div>'+
      reviewsHtml+
    '</div>';
  }).join('');
}

function setProfFilter(cat){
  _profFilterCat = cat;
  renderProfessionalsPage();
}

function openProfSheet(id){
  _profEditId = id || null;
  var title = document.getElementById('prof-sheet-title');
  if(title) title.textContent = id ? '✏️ עריכת בעל מקצוע' : '🔨 הוסף בעל מקצוע';
  var errEl = document.getElementById('prof-sheet-err');
  if(errEl){ errEl.style.display='none'; errEl.textContent=''; }

  if(id){
    var p = (DB.professionals||[]).find(function(x){ return x.id===id; });
    if(p){
      document.getElementById('prof-inp-name').value  = p.name  || '';
      document.getElementById('prof-inp-phone').value = p.phone || '';
      document.getElementById('prof-inp-cat').value   = p.cat   || 'אחר';
      document.getElementById('prof-inp-notes').value = p.notes || '';
      var areaEl = document.getElementById('prof-inp-area'); if(areaEl) areaEl.value = p.area || '';
    }
  } else {
    document.getElementById('prof-inp-name').value  = '';
    document.getElementById('prof-inp-phone').value = '';
    document.getElementById('prof-inp-cat').value   = 'אינסטלטור';
    document.getElementById('prof-inp-notes').value = '';
    var areaElNew = document.getElementById('prof-inp-area'); if(areaElNew) areaElNew.value = '';
  }
  // (agreement wrap הוסר — הכפתור תמיד מוצג)
  openSheet('prof');
}

function submitProf(){
  var name  = (document.getElementById('prof-inp-name').value||'').trim();
  var phone = (document.getElementById('prof-inp-phone').value||'').trim();
  var cat   = (document.getElementById('prof-inp-cat').value||'אחר').trim();
  var notes = (document.getElementById('prof-inp-notes').value||'').trim();
  var errEl = document.getElementById('prof-sheet-err');

  if(!name){ errEl.textContent='נא להזין שם'; errEl.style.display='block'; return; }
  if(!phone){ errEl.textContent='נא להזין טלפון'; errEl.style.display='block'; return; }
  errEl.style.display='none';

  var slug = _getBuildingSlug();
  if(!slug){ showToast('שגיאה: לא זוהה בניין'); return; }

  var isEdit = !!_profEditId;
  var editId = _profEditId;
  _profEditId = null;
  closeSheet('prof');

  if(isEdit){
    // עדכון רשומה קיימת
    var areaUpd = (document.getElementById('prof-inp-area') ? document.getElementById('prof-inp-area').value : '').trim();
    sbClient.from('professionals').update({
      name: name, phone: phone, cat: cat, notes: notes, area: areaUpd
    }).eq('id', editId).then(function(res){
      if(res.error){ showToast('שגיאה בעדכון: '+res.error.message); return; }
      loadProfessionalsFromSupabase(function(){ renderProfessionalsPage(); });
      showToast('בעל המקצוע עודכן ✅');
    });
  } else {
    // הוספת רשומה חדשה
    var area = (document.getElementById('prof-inp-area') ? document.getElementById('prof-inp-area').value : '').trim();
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
      if(res.error){ showToast('שגיאה בהוספה: '+res.error.message); return; }
      loadProfessionalsFromSupabase(function(){ renderProfessionalsPage(); });
      showToast('בעל המקצוע נוסף ✅');
    });
  }
}

function deleteProf(id){
  if(!confirm('למחוק את בעל המקצוע?')) return;
  sbClient.from('professionals').delete().eq('id', id).then(function(res){
    if(res.error){ showToast('שגיאה במחיקה: '+res.error.message); return; }
    loadProfessionalsFromSupabase(function(){ renderProfessionalsPage(); });
    showToast('בעל המקצוע נמחק');
  });
}

function rateProfessional(id, stars){
  var p = (DB.professionals||[]).find(function(x){ return x.id===id; });
  if(!p) return;
  // חישוב ממוצע אמיתי
  var newCount  = (p.rating_count || 0) + 1;
  var newRating = Math.round((((p.rating || 0) * (p.rating_count || 0)) + stars) / newCount * 10) / 10;
  // עדכון מקומי מיידי
  p.rating       = newRating;
  p.rating_count = newCount;
  renderProfessionalsPage();
  // כתיבה לסופרבייס
  sbClient.from('professionals').update({
    rating:       newRating,
    rating_count: newCount
  }).eq('id', id).then(function(res){
    if(res.error){ showToast('שגיאה בשמירת דירוג: '+res.error.message); }
    else { showToast('דירוג נשמר ✅'); }
  });
}

