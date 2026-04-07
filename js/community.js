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
        votedDevices:[]
      };
    } else {
      // אין סקר פעיל — אפס
      DB.poll = { q:'', opts:[], unitVotes:{}, userVote:null, votedDevices:[] };
    }
    if(cb) cb();
  });
}

/* ═══════════════════════════════════════════════════════════════
   PROFESSIONALS SUPABASE
═══════════════════════════════════════════════════════════════ */
