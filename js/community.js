/* ═══════════════════════════════════════════════════════════════
   community.js — שכנות טובה · SmartNeighbor
   קהילה + הודעות + פוסטים + סקרים
   תלוי ב: config.js, utils.js, db.js
═══════════════════════════════════════════════════════════════ */
function moderateText(text){
  var lower = (text||'').toLowerCase();
  for(var i=0;i<_BANNED_WORDS.length;i++){
    if(lower.indexOf(_BANNED_WORDS[i])!==-1) return false;
  }
  return true;
}

function showModToast(){
  var t = document.getElementById('mod-toast');
  if(!t) return;
  t.textContent = '🙏 נראה שהשתמשת במילה לא מתאימה. בואו נשמור על שיח מכבד בשכונה שלנו';
  t.classList.add('show');
  setTimeout(function(){ t.classList.remove('show'); }, 4000);
}

/* ═══════════════════════════════════════════════════════════════
   NOTICE SUBMIT
═══════════════════════════════════════════════════════════════ */
function selectNoticeType(btn, type){
  _activeNoticeType = type;
  document.querySelectorAll('.notice-type-btn').forEach(function(b){ b.classList.remove('selected'); });
  if(btn) btn.classList.add('selected');
}

function loadNoticesFromSupabase(cb){
  var slug = _getBuildingSlug();
  if(!slug){ if(cb) cb(); return; }
  sbClient.from('notices').select('*').eq('building_slug', slug).order('date', {ascending:false}).then(function(res){
    if(!res.error && res.data) DB.notices = res.data;
    if(cb) cb();
  });
}

function deleteNotice(id, ownerUnit){
  var canDelete = ADMIN_ON || (DB.user && DB.user.unit && DB.user.unit === ownerUnit);
  if(!canDelete){ showToast('אין הרשאה למחוק הודעה זו'); return; }
  if(!confirm('למחוק את ההודעה?')) return;
  sbClient.from('notices').delete().eq('id', id).then(function(res){
    if(res.error){ showToast('שגיאה במחיקה'); return; }
    loadNoticesFromSupabase(function(){
      renderCommunityPage();
      renderHomePage();
    });
    showToast('הודעה נמחקה');
  });
}

function submitNotice(){
  var title = (document.getElementById('notice-title-input').value||'').trim();
  var text  = (document.getElementById('notice-text-input').value||'').trim();
  var err   = document.getElementById('notice-err');
  if(!title||!text){
    err.textContent='נא למלא כותרת ותוכן';
    err.style.display='block';
    return;
  }
  err.style.display='none';
  if(!moderateText(title)||!moderateText(text)){ showModToast(); return; }
  var slug = _getBuildingSlug();
  if(!slug){ showToast('שגיאה: לא זוהה בניין'); return; }
  var record = {
    building_slug: slug,
    type: _activeNoticeType,
    title: title,
    text: text,
    date: fmtDate(new Date()),
    unit: DB.user ? DB.user.unit : null
  };
  sbClient.from('notices').insert([record]).then(function(res){
    if(res.error){ showToast('שגיאה בשמירה: '+res.error.message); return; }
    document.getElementById('notice-title-input').value='';
    document.getElementById('notice-text-input').value='';
    closeSheet('notice');
    loadNoticesFromSupabase(function(){
      renderCommunityPage();
      renderHomePage();
    });
    showToast('הודעה פורסמה ✅');
  });
}

/* ═══════════════════════════════════════════════════════════════
   POSTS SUBMIT
═══════════════════════════════════════════════════════════════ */
function loadPostsFromSupabase(cb){
  var slug = _getBuildingSlug();
  if(!slug){ if(cb) cb(); return; }
  sbClient.from('posts').select('*').eq('building_slug', slug).order('created_at', {ascending:false}).then(function(res){
    if(!res.error && res.data) DB.posts = res.data;
    if(cb) cb();
  });
}

function deletePost(id, ownerUnit){
  var canDelete = ADMIN_ON || (DB.user && DB.user.unit && String(DB.user.unit) === String(ownerUnit));
  if(!canDelete){ showToast('אין הרשאה למחוק פוסט זה'); return; }
  if(!confirm('למחוק את הפוסט?')) return;
  sbClient.from('posts').delete().eq('id', id).then(function(res){
    if(res.error){ showToast('שגיאה במחיקה'); return; }
    loadPostsFromSupabase(function(){
      renderCommunityPage();
      renderHomePage();
    });
    showToast('פוסט נמחק');
  });
}

function submitPost(type){
  var slug = _getBuildingSlug();
  if(!slug){ showToast('שגיאה: לא זוהה בניין'); return; }
  var record = null;

  if(type==='gift'){
    var item = (document.getElementById('gift-item').value||'').trim();
    var desc = (document.getElementById('gift-desc').value||'').trim();
    if(!item){ showToast('נא למלא שם פריט'); return; }
    if(!moderateText(item)||!moderateText(desc)){ showModToast(); return; }
    record = {
      building_slug: slug,
      type: 'gift',
      author: DB.unitNames[DB.user.unit] || DB.user.name,
      unit: String(DB.user.unit),
      text: '🎁 '+item+(desc?' — '+desc:''),
      date: fmtDate(new Date())
    };
    document.getElementById('gift-item').value='';
    document.getElementById('gift-desc').value='';
    closeSheet('gift');
  } else if(type==='wish'){
    var name  = (document.getElementById('wish-name').value||'').trim();
    var event = (document.getElementById('wish-event').value||'').trim();
    if(!name||!event){ showToast('נא למלא שם ואירוע'); return; }
    if(!moderateText(name)||!moderateText(event)){ showModToast(); return; }
    record = {
      building_slug: slug,
      type: 'wish',
      author: DB.unitNames[DB.user.unit] || DB.user.name,
      unit: String(DB.user.unit),
      text: '🎉 מזל טוב ל'+name+' על '+event,
      date: fmtDate(new Date())
    };
    document.getElementById('wish-name').value='';
    document.getElementById('wish-event').value='';
    closeSheet('wish');
  }

  if(!record) return;
  sbClient.from('posts').insert([record]).then(function(res){
    if(res.error){ showToast('שגיאה בפרסום: '+res.error.message); return; }
    loadPostsFromSupabase(function(){
      renderCommunityPage();
      renderHomePage();
    });
    showToast('פורסם ✅');
  });
}
/* ═══════════════════════════════════════════════════════════════
   POLLS SUPABASE
═══════════════════════════════════════════════════════════════ */
function loadPollFromSupabase(cb){
  var slug = _getBuildingSlug();
  if(!slug){ if(cb) cb(); return; }
  sbClient.from('polls').select('*').eq('building_slug', slug).eq('is_active', true).order('created_at', {ascending:false}).limit(1).then(function(res){
    if(!res.error && res.data && res.data.length > 0){
      var r = res.data[0];
      // ממיר מבנה סופרבייס למבנה DB.poll הפנימי
      DB.poll = {
        id:          r.id,
        q:           r.question,
        opts:        (r.options || []).map(function(o){ return {label:o.label, votes:o.votes||0}; }),
        unitVotes:   r.unit_votes || {},
        userVote:    null,
        votedDevices:[],
        createdBy:   r.created_by || '',
        creatorUnit: r.creator_unit || null
      };
    } else {
      // אין סקר פעיל — אפס
      DB.poll = { q:'', opts:[], unitVotes:{}, userVote:null, votedDevices:[] };
    }
    if(cb) cb();
  });
}

function deletePoll(){
  var poll = DB.poll;
  if(!poll || !poll.id) return;
  var unit = DB.user ? DB.user.unit : null;
  var canDelete = ADMIN_ON || (unit && poll.creatorUnit && unit === poll.creatorUnit);
  if(!canDelete){ showToast('אין הרשאה למחוק סקר זה'); return; }
  if(!confirm('למחוק את הסקר?')) return;
  sbClient.from('polls').update({is_active:false}).eq('id', String(poll.id)).then(function(res){
    if(res.error){ showToast('שגיאה במחיקה: '+res.error.message); return; }
    showToast('הסקר נמחק');
    loadPollFromSupabase(function(){ renderCommunityPage(); });
  });
}

/* ═══════════════════════════════════════════════════════════════
   MEDIATION — בוררות שכנותית
═══════════════════════════════════════════════════════════════ */
function openMediationSheet(){
  var el = document.getElementById('mediation-step1');
  if(el) el.style.display='block';
  var el2 = document.getElementById('mediation-step2');
  if(el2) el2.style.display='none';
  var el3 = document.getElementById('mediation-result-wrap');
  if(el3) el3.style.display='none';
  var ta = document.getElementById('med-text-a');
  if(ta) ta.value='';
  var inp = document.getElementById('med-session-input');
  if(inp) inp.value='';
  openSheet('mediation');
}

function _genSessionId(){
  return Math.random().toString(36).substring(2,8).toUpperCase();
}

function submitMediationSideA(){
  var text = (document.getElementById('med-text-a').value||'').trim();
  if(!text){ showToast('נא לכתוב את הצד שלך'); return; }
  var slug = _getBuildingSlug();
  if(!slug){ showToast('שגיאה: לא זוהה בניין'); return; }
  var unit = DB.user ? DB.user.unit : 0;
  var sessionId = _genSessionId();
  showToast('שומר...');
  sbClient.from('mediations').insert([{
    building_slug: slug,
    session_id: sessionId,
    unit_a: unit,
    text_a: text
  }]).then(function(res){
    if(res.error){ showToast('שגיאה: '+res.error.message); return; }
    // הצג קוד סשן לשיתוף
    var codeEl = document.getElementById('med-session-code');
    if(codeEl) codeEl.textContent = sessionId;
    document.getElementById('mediation-step1').style.display='none';
    document.getElementById('mediation-step1-done').style.display='block';
    showToast('נשמר ✅ שתף את הקוד עם הצד השני');
  });
}

function switchToMediationJoin(){
  document.getElementById('mediation-step1').style.display='none';
  document.getElementById('mediation-step1-done').style.display='none';
  document.getElementById('mediation-step2').style.display='block';
}

function submitMediationSideB(){
  var sessionId = (document.getElementById('med-session-input').value||'').trim().toUpperCase();
  var text = (document.getElementById('med-text-b').value||'').trim();
  if(!sessionId){ showToast('נא להזין קוד סשן'); return; }
  if(!text){ showToast('נא לכתוב את הצד שלך'); return; }
  var slug = _getBuildingSlug();
  var unit = DB.user ? DB.user.unit : 0;
  showToast('מחפש סשן...');
  sbClient.from('mediations').select('*').eq('building_slug', slug).eq('session_id', sessionId).is('text_b', null).then(function(res){
    if(res.error || !res.data || !res.data.length){ showToast('קוד לא נמצא או כבר שומש'); return; }
    var med = res.data[0];
    if(med.unit_a === unit){ showToast('לא ניתן להיות שני הצדדים'); return; }
    sbClient.from('mediations').update({ unit_b: unit, text_b: text }).eq('id', String(med.id)).then(function(res2){
      if(res2.error){ showToast('שגיאה: '+res2.error.message); return; }
      _runMediation(med.id, med.text_a, text);
    });
  });
}

function _runMediation(medId, textA, textB){
  var resultWrap = document.getElementById('mediation-result-wrap');
  var resultEl   = document.getElementById('mediation-result-text');
  if(resultWrap) resultWrap.style.display='block';
  if(resultEl)   resultEl.textContent = '⏳ AI בוחן את המצב...';
  document.getElementById('mediation-step2').style.display='none';

  var prompt = 'אתה יועץ משפטי ומגשר שכנותי מנוסה בדיני מקרקעין ישראלי.\n\n' +
    'קיבלת שני צדדים בסכסוך שכנים:\n\n' +
    'צד א: ' + textA + '\n\n' +
    'צד ב: ' + textB + '\n\n' +
    'הנחיות חובה:\n' +
    '1. פסוק לפי המסגרת המשפטית הישראלית הרלוונטית, לפי הסדר: חוק המקרקעין תשכ"ט-1969, חוק הבתים המשותפים, תקנות ניהול הבית המשותף, פקודת הנזיקין (מטרד, רשלנות, גזל), חוק מניעת מפגעים סביבתיים תשנ"ב-1992 (רעש/ריח/עשן), חוק החוזים תשל"ג-1973 (הסכמות ופשרות), וחוקי עזר עירוניים רלוונטיים — ציין סעיפים מדויקים בלבד\n' +
    '2. אם אינך בטוח בסעיף חוק מדויק — אמור זאת במפורש. אל תמציא סעיפים\n' +
    '3. אם הנושא מורכב — המלץ לפנות לעורך דין\n' +
    '4. לאחר הניתוח המשפטי — הצע דרך גישור מפשרת מתוך רצון לשמור על שכנות טובה\n' +
    '5. הטון יהיה מכבד, מפשר ולא מריבתי\n' +
    '6. כתוב בעברית בלבד\n\n' +
    'מבנה התשובה:\n' +
    '⚖️ ניתוח משפטי\n' +
    '🤝 המלצה לגישור';

  fetch('https://sn-ai-proxy.shirit-coach.workers.dev', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  }).then(function(r){ return r.json(); }).then(function(data){
    var txt = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : 'לא התקבלה תשובה';
    if(resultEl) resultEl.textContent = txt;
    // שמור תוצאה בסופרבייס
    sbClient.from('mediations').update({ result: txt }).eq('id', String(medId)).then(function(){});
  }).catch(function(e){
    if(resultEl) resultEl.textContent = 'שגיאה בתקשורת עם AI. נסה שוב.';
  });
}

/* ═══════════════════════════════════════════════════════════════
   VAAD QUESTIONS — שאלות לוועד
═══════════════════════════════════════════════════════════════ */
function submitVaadQuestion(){
  var text = (document.getElementById('vaad-question-input').value||'').trim();
  if(!text){ showToast('נא לכתוב שאלה'); return; }
  var slug = _getBuildingSlug();
  if(!slug){ showToast('שגיאה: לא זוהה בניין'); return; }
  var unit = DB.user ? DB.user.unit : 0;
  showToast('שולח שאלה...');
  sbClient.from('vaad_questions').insert([{ building_slug:slug, unit:unit, question:text, status:'pending' }]).then(function(res){
    if(res.error){ showToast('שגיאה: '+res.error.message); return; }
    document.getElementById('vaad-question-input').value='';
    showToast('השאלה נשלחה לוועד ✅');
    loadVaadQuestions();
  });
}

function loadVaadQuestions(){
  var slug = _getBuildingSlug();
  if(!slug) return;
  var pendingWrap = document.getElementById('vaad-pending-wrap');
  var publicWrap  = document.getElementById('vaad-public-wrap');

  // טען פסיקות ציבוריות לכולם
  sbClient.from('vaad_questions').select('*').eq('building_slug',slug).eq('status','published').order('created_at',{ascending:false}).then(function(res){
    if(res.error || !res.data){ if(publicWrap) publicWrap.innerHTML='<div style="font-size:12px;color:var(--slate);">אין פסיקות ציבוריות עדיין</div>'; return; }
    if(!publicWrap) return;
    if(!res.data.length){ publicWrap.innerHTML='<div style="font-size:12px;color:var(--slate);">אין פסיקות ציבוריות עדיין</div>'; return; }
    publicWrap.innerHTML = res.data.map(function(q){
      return '<div id="vq-'+q.id+'" style="background:#F8FAFC;border-radius:12px;padding:12px;margin-bottom:10px;border:1.5px solid #E2E8F0;">' +
        '<div style="font-size:12px;font-weight:800;color:var(--navy);margin-bottom:6px;">❓ '+escHtml(q.question)+'</div>' +
        '<div style="font-size:12px;color:#1E293B;line-height:1.6;white-space:pre-wrap;">'+escHtml(q.answer)+'</div>' +
        '<button onclick="document.getElementById(\'vq-'+q.id+'\').style.display=\'none\'" style="margin-top:8px;padding:4px 12px;background:#F1F5F9;color:#64748B;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font);">הסתר</button>' +
      '</div>';
    }).join('');
  });

  // טען שאלות ממתינות — למנהל בלבד
  if(!ADMIN_ON) return;
  if(!pendingWrap) return;
  sbClient.from('vaad_questions').select('*').eq('building_slug',slug).eq('status','pending').order('created_at',{ascending:false}).then(function(res){
    if(res.error || !res.data || !res.data.length){ pendingWrap.innerHTML='<div style="font-size:12px;color:var(--slate);">אין שאלות ממתינות</div>'; return; }
    pendingWrap.innerHTML = res.data.map(function(q){
      return '<div style="background:#FFFBEB;border-radius:12px;padding:12px;margin-bottom:10px;border:1.5px solid #FDE68A;">' +
        '<div style="font-size:12px;font-weight:800;color:var(--navy);margin-bottom:8px;">דירה '+q.unit+': '+escHtml(q.question)+'</div>' +
        '<div style="display:flex;gap:8px;">' +
          '<button onclick="approveVaadQuestion(\''+q.id+'\',\''+escHtml(q.question)+'\')" style="flex:1;padding:8px;background:linear-gradient(135deg,#7C3AED,#A78BFA);color:#fff;border:none;border-radius:8px;font-size:11px;font-weight:800;cursor:pointer;font-family:var(--font);">✅ שלח ל-AI ופרסם</button>' +
          '<button onclick="rejectVaadQuestion(\''+q.id+'\')" style="flex:1;padding:8px;background:#FEE2E2;color:#EF4444;border:none;border-radius:8px;font-size:11px;font-weight:800;cursor:pointer;font-family:var(--font);">✕ דחה</button>' +
        '</div>' +
      '</div>';
    }).join('');
  });
}

function approveVaadQuestion(id, question){
  var slug = _getBuildingSlug();
  showToast('שולח ל-AI...');
  var prompt = 'אתה יועץ מומחה לדיני בתים משותפים בישראל.\n\n' +
    'ענה על השאלה הבאה של דייר לפי החוק הישראלי בלבד:\n\n' +
    'שאלה: ' + question + '\n\n' +
    'הנחיות חובה:\n' +
    '1. ענה לפי: חוק המקרקעין תשכ"ט-1969, חוק הבתים המשותפים, תקנות ניהול הבית המשותף, חוק החוזים תשל"ג-1973\n' +
    '2. ציין סעיפים מדויקים בלבד — אל תמציא סעיפים\n' +
    '3. אם אינך בטוח — אמור זאת במפורש\n' +
    '4. כתוב בעברית בלבד, בשפה פשוטה וברורה\n' +
    '5. הטון יהיה מכבד ומקצועי';
  fetch('https://sn-ai-proxy.shirit-coach.workers.dev', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:1000, messages:[{ role:'user', content:prompt }] })
  }).then(function(r){ return r.json(); }).then(function(data){
    var answer = (data.content && data.content[0] && data.content[0].text) ? data.content[0].text : 'לא התקבלה תשובה';
    sbClient.from('vaad_questions').update({ answer:answer, status:'published' }).eq('id',String(id)).then(function(res){
      if(res.error){ showToast('שגיאה בשמירה'); return; }
      showToast('פורסם לכל הדיירים ✅');
      loadVaadQuestions();
    });
  }).catch(function(){ showToast('שגיאה בתקשורת עם AI'); });
}

function rejectVaadQuestion(id){
  if(!confirm('לדחות שאלה זו?')) return;
  sbClient.from('vaad_questions').update({ status:'rejected' }).eq('id',String(id)).then(function(res){
    if(res.error){ showToast('שגיאה'); return; }
    showToast('השאלה נדחתה');
    loadVaadQuestions();
  });
}

function sendMediationWA(sessionId){
  var unitVal = (document.getElementById('med-wa-unit-input').value||'').trim();
  if(!unitVal){ showToast('נא להזין מספר דירה'); return; }
  var unit = parseInt(unitVal);
  if(!unit){ showToast('מספר דירה לא תקין'); return; }
  var slug = _getBuildingSlug();
  sbClient.from('residents').select('phone,name').eq('building_slug', slug).eq('unit', unit).limit(1).then(function(res){
    if(res.error || !res.data || !res.data.length){ showToast('לא נמצא דייר בדירה ' + unit); return; }
    var phone = res.data[0].phone;
    if(!phone){ showToast('אין טלפון רשום לדירה ' + unit); return; }
    var cleanPhone = phone.replace(/\D/g,'');
    if(cleanPhone.charAt(0)==='0') cleanPhone = '972' + cleanPhone.substring(1);
    var senderName = (DB.user ? DB.user.name : 'שכן/ה') || 'שכן/ה';
    var senderUnit = DB.user ? DB.user.unit : '';
    var msg = encodeURIComponent(
      'שלום! ' + senderName + ' מדירה ' + senderUnit + ' פתח/ה הליך בוררות שכנותית באפליקציית הבניין.\n\n' +
      'קוד הסשן: *' + sessionId + '*\n\n' +
      'כיצד להשתמש:\n' +
      '1. פתח את אפליקציית הבניין\n' +
      '2. לחץ על "קהילה" ואז "בוררות"\n' +
      '3. לחץ "יש לי קוד מהצד השני"\n' +
      '4. הזן את הקוד: ' + sessionId + '\n' +
      '5. כתוב את עמדתך — ה-AI יפסוק\n\n' +
      'תודה 🤝'
    );
    window.location.href = 'https://wa.me/' + cleanPhone + '?text=' + msg;
  });
}

/* ═══════════════════════════════════════════════════════════════
   PROFESSIONALS SUPABASE
═══════════════════════════════════════════════════════════════ */
