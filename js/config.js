/* ═══════════════════════════════════════════════════════════════
   config.js — שכנות טובה · SmartNeighbor
   קבועים + אתחול Supabase
   ⚠️ לא לשנות ערכים אלו ללא אישור
═══════════════════════════════════════════════════════════════ */

/* ── Supabase ──────────────────────────────────────────────── */
var SUPABASE_URL = 'https://fsvyryhtnogzyycijukp.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdnlyeWh0bm9nenl5Y2lqdWtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNzA3MjQsImV4cCI6MjA4ODc0NjcyNH0.l2JD0pJ6CgCveN1aZUoWxN16eRoWl19ZWNx8GVXJZqk';
var sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ── Session & Storage Keys ────────────────────────────────── */
var SESS_KEY = 'sn19_sess';
var DB_KEY   = 'sn22_db';

/* ── Business Constants ────────────────────────────────────── */
var LICENSE_EXPIRY = '2027-03-12';
var FLAT_PRICE     = 11;

/* ── App State ─────────────────────────────────────────────── */
var MONTH_OFFSET = 0;
var ADMIN_ON     = false;
var _payMethod   = null;
var _activeNoticeType = 'notice';
var _waTrayUnit  = null;
var _waTrayMonthKey = null;

/* ── Hebrew Months ─────────────────────────────────────────── */
var HE_MONTHS = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];

/* ── Professionals Categories ──────────────────────────────── */
var PROF_CATS = ['הכל','אינסטלטור','חשמלאי','מנעולן','מעליות','גינון','ניקיון','צבע','מזגנים','שיפוצניק','עו"ד','רו"ח','מאפרת','מעצב/ת פנים','צלם/ת','מטפל/ת','מדריך/ה','אחר'];
var PROF_ICONS = {'אינסטלטור':'🚿','חשמלאי':'⚡','מנעולן':'🔑','מעליות':'🛗','גינון':'🌿','ניקיון':'🧹','צבע':'🖌️','מזגנים':'❄️','שיפוצניק':'🏗️','עו"ד':'⚖️','רו"ח':'📊','מאפרת':'💄','מעצב/ת פנים':'🎨','צלם/ת':'📷','מטפל/ת':'🌿','מדריך/ה':'🏋️','אחר':'📋'};
var COLORS = ['#3B82F6','#F59E0B','#22C55E','#8B5CF6','#EF4444','#14B8A6','#F97316','#EC4899','#06B6D4','#84CC16'];

/* ── Fault Location → Suggested Professional Category ─────── */
var LOC_TO_CAT = {'מעלית':['מעליות'],'גינה':['גינון'],'חדר גנרטור':['חשמלאי','שיפוצניק'],'גג':['שיפוצניק'],'לובי':['ניקיון','שיפוצניק','חשמלאי'],'חדר מדרגות':['ניקיון','שיפוצניק'],'חניון':['שיפוצניק','חשמלאי'],'מרתף':['שיפוצניק','אינסטלטור'],'דירה שלי':['אינסטלטור','חשמלאי','מנעולן','מזגנים','שיפוצניק']};

/* ── Banned Words (moderation) ─────────────────────────────── */
var BANNED_WORDS = ['טמבל','טיפש','מטומטם','אידיוט','מזדיין','כוסאמק','זין','לזיין','בן זונה','בת זונה','כלבה','כלב','חרא','שיט','שט','פרה','פרות','מנוול','גנב','שקרן','ערבי זבל','יהודי זבל','נאצי','כושי','סתום','לך לעזאזל'];
