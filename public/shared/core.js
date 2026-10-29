/* Susu shared core: the group's live data from the server, and helpers.
   The login, admin and member apps all load this one file. The schedule maths lives
   in shared/logic.js, which the server uses too. */
(function(){
'use strict';
var Susu=window.Susu={};
var L=window.SusuLogic;
var pad=L.pad,round2=L.round2,parseDate=L.parseDate,iso=L.iso,buildSchedule=L.buildSchedule,clamp=L.clamp,cleanSettings=L.cleanSettings,toSched=L.toSched,rosterSlots=L.rosterSlots,normUser=L.normUser,validUser=L.validUser,ticksOn=L.ticksOn;
Object.assign(Susu,{pad:pad,round2:round2,parseDate:parseDate,iso:iso,buildSchedule:buildSchedule,clamp:clamp,cleanSettings:cleanSettings,toSched:toSched,normUser:normUser,validUser:validUser,ticksOn:ticksOn});


var today=Susu.today=iso(new Date());
var $=Susu.$=function(id){return document.getElementById(id);};

/* ---------- where this page was opened from ----------
   "root": the shared Susu link (all apps live behind one link, switched by the address).
   "login" / "admin" / "user": that app's own folder opened on its own. */
var ENTRY=Susu.entry=window.SUSU_ENTRY||'root';
Susu.link=function(app,page){
  var hash=app==='admin'?(page?'admin-'+page:'admin'):app==='login'?(page||'login'):(page||'home');
  if(ENTRY==='root'||ENTRY===app)return '#'+hash;
  return '../'+app+'/index.html#'+hash;
};
var USER_PAGES=['home','schedule','payments'];
/* Which app an address asks for. */
Susu.appFor=function(hash){
  var h=String(hash||'').replace('#','');
  if(/^admin/.test(h))return 'admin';
  if(USER_PAGES.indexOf(h)>=0)return 'user';
  return 'login';
};

/* ---------- browser storage (only remembers who is signed in on this device) ---------- */
var LS='susu-tool:v3:';
Susu.lsGet=function(k){try{return localStorage.getItem(LS+k);}catch(e){return null;}};
Susu.lsSet=function(k,v){try{if(v===null)localStorage.removeItem(LS+k);else localStorage.setItem(LS+k,v);}catch(e){}};

/* ---------- icons ---------- */
var IC={
  home:'<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>',
  schedule:'<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  payments:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 11h18M7 15h3"/>',
  group:'<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  people:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3.2 3.2 0 0 1 0 6M18 14.3c1.8.7 3 2.5 3 4.7"/>',
  coin:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/>',
  cal:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  arrow:'<path d="M7 17L17 7M9 7h8v8"/>',
  left:'<path d="M15 5l-7 7 7 7"/>',
  right:'<path d="M9 5l7 7-7 7"/>',
  swap:'<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  out:'<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  wallet:'<path d="M4 7a2 2 0 0 1 2-2h11v4"/><rect x="4" y="7" width="16" height="12" rx="2"/><circle cx="16" cy="13" r="1.3"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>'
};
Susu.IC=IC;
Susu.ic=function(k,cls){return '<svg class="i'+(cls?' '+cls:'')+'" viewBox="0 0 24 24" aria-hidden="true">'+IC[k]+'</svg>';};
Susu.RING='<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.5"/><circle class="d" cx="12" cy="4.5" r="1.7"/><circle class="d" cx="19.5" cy="12" r="1.7"/><circle class="d" cx="12" cy="19.5" r="1.7"/><circle class="d" cx="4.5" cy="12" r="1.7"/></svg>';

/* ---------- avatars ---------- */
var AV=Susu.AV=[
 ['Sun','<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>'],
 ['Moon','<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4 6.8 6.8 0 0 0 20 14.5z"/>'],
 ['Star','<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.2 1 5.9L12 17l-5.2 2.8 1-5.9L3.5 9.7l5.9-.8z"/>'],
 ['Leaf','<path d="M5 19C5 10.5 10 5 20 4c0 10-5.5 15-14 15"/><path d="M5 19l8-8"/>'],
 ['Heart','<path d="M12 20s-7.5-4.5-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.5-7.5 10-7.5 10z"/>'],
 ['Flame','<path d="M12 3c.8 3.8 5.5 6 5.5 11a5.5 5.5 0 0 1-11 0c0-2.2 1-3.6 2.2-4.6.2 1.8 1 2.8 2.1 3C10.2 8.6 10.5 5.5 12 3z"/>'],
 ['Drop','<path d="M12 3s6.5 6.5 6.5 11a6.5 6.5 0 0 1-13 0C5.5 9.5 12 3 12 3z"/>'],
 ['Mountain','<path d="M2.5 19l6.5-11 4 6.5 2.5-3.5 6 8z"/>'],
 ['Wave','<path d="M3 9c3-3 6 3 9 0s6 3 9 0M3 15c3-3 6 3 9 0s6 3 9 0"/>'],
 ['Flower','<circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="6.5" r="3"/><circle cx="12" cy="17.5" r="3"/><circle cx="6.5" cy="12" r="3"/><circle cx="17.5" cy="12" r="3"/>'],
 ['Tree','<path d="M12 3l6 8h-3.5l4.5 6H5l4.5-6H6z"/><path d="M12 17v4"/>'],
 ['House','<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>'],
 ['Coin','<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>'],
 ['Key','<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>'],
 ['Crown','<path d="M4 17L3 8l5 4 4-7 4 7 5-4-1 9z"/><path d="M4 20.5h16"/>'],
 ['Fish','<path d="M3 12c4-6.5 11-6.5 15 0-4 6.5-11 6.5-15 0z"/><path d="M18 12l3.5-4v8z"/><path d="M8 11h.01"/>'],
 ['Drum','<ellipse cx="12" cy="7.5" rx="7" ry="2.5"/><path d="M5 7.5v9c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-9M8 10l3 8M16 10l-3 8"/>'],
 ['Sprout','<path d="M12 21v-9"/><path d="M12 12C12 8 9 6 4.5 6 4.5 10 7.5 12 12 12z"/><path d="M12 14c0-3.2 2.2-5.2 7-5.2 0 3.4-2.5 5.2-7 5.2z"/>'],
 ['Gem','<path d="M6 4h12l4 6-10 11L2 10z"/><path d="M2 10h20M9 4l3 6 3-6"/>'],
 ['Bolt','<path d="M13 2.5L4.5 14H11l-1 7.5L19.5 10H13z"/>']
];
Susu.av=function(i,size){
  var a=AV[(i>=0&&i<20)?i:0];
  return '<span class="av '+(size||'')+'" style="--h:'+((i*18+150)%360)+'" role="img" aria-label="'+a[0]+' icon"><svg viewBox="0 0 24 24" aria-hidden="true">'+a[1]+'</svg></span>';
};
Susu.ghost=function(size){return '<span class="ghost '+(size||'')+'"></span>';};
Susu.pickerHTML=function(){
  return AV.map(function(a,i){
    return '<label class="pick"><input type="radio" name="avatar" value="'+i+'" aria-label="'+a[0]+'"><span>'+Susu.av(i,'')+'</span></label>';
  }).join('');
};

/* ---------- text and numbers ---------- */
var S,V;
function esc(t){return String(t).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmtC(v,cur){
  var txt=v.toLocaleString(undefined,{minimumFractionDigits:(Math.round(v*100)%100===0)?0:2,maximumFractionDigits:2});
  cur=(cur||'').trim();return (cur?cur+' ':'')+txt;
}
function fmt(v){return fmtC(v,S.settings?S.settings.cur:'');}
function fmtDate(d){return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric'});}
function fmtShort(d){return d.toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'});}
function fmtDM(d){return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});}
function fmtWhen(t){
  var d=new Date(t);if(!t||isNaN(d))return '';
  if(iso(d)===today)return d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  return fmtDM(d);
}
function rel(d){
  var days=Math.round((d-parseDate(today))/86400000);
  if(days===0)return 'today';if(days===1)return 'tomorrow';if(days===-1)return 'yesterday';
  return days>0?'in '+days+' days':(-days)+' days ago';
}
function intervalText(st){return st.every===1?'every '+st.unit.replace(/s$/,''):'every '+st.every+' '+st.unit;}
function perText(st){return st.every===1?st.unit.replace(/s$/,''):st.every+' '+st.unit;}
function firstName(m){return m.fullName.split(' ')[0];}
function slotName(i){var m=V.slots[i];return m?m.fullName:'Place '+(i+1)+' (open)';}
function freqKey(st){
  if(st.unit==='days'&&st.every===1)return 'd1';
  if(st.unit==='weeks'&&st.every===1)return 'w1';
  if(st.unit==='weeks'&&st.every===2)return 'w2';
  if(st.unit==='months'&&st.every===1)return 'm1';
  return 'custom';
}
var timers={};
function say(id,msg,ms){
  var el=$(id);if(!el)return;el.textContent=msg;clearTimeout(timers[id]);
  if(ms)timers[id]=setTimeout(function(){el.textContent='';},ms);
}
Object.assign(Susu,{esc:esc,fmtC:fmtC,fmt:fmt,fmtDate:fmtDate,fmtShort:fmtShort,fmtDM:fmtDM,fmtWhen:fmtWhen,rel:rel,intervalText:intervalText,perText:perText,firstName:firstName,slotName:slotName,freqKey:freqKey,say:say});

/* ---------- live group data ----------
   Everything comes from GET /api/state. The page asks again every few seconds and after
   every change it makes, so admin and members see the same numbers. */
S=Susu.state={uid:null,role:'',isAdmin:false,me:null,ready:false,fatal:'',offline:false,
  code:'',settings:null,membersAll:[],payMap:{},outMap:{}};
V=Susu.v={roster:[],mine:null,slots:[],extra:[],sched:[],nextIdx:-1,focusIdx:0};
var subs=[];
Susu.onChange=function(fn){subs.push(fn);return function(){subs=subs.filter(function(f){return f!==fn;});};};
function emit(){
  derive();
  subs.slice().forEach(function(f){try{f();}catch(e){if(window.console)console.error(e);}});
}
function derive(){
  V.roster=S.membersAll;
  V.mine=S.role==='member'?(V.roster.filter(function(m){return m.uid===S.uid;})[0]||null):null;
  if(!S.settings){V.slots=[];V.extra=[];V.sched=[];V.nextIdx=-1;V.focusIdx=0;return;}
  var rs=rosterSlots(V.roster,S.settings.n);
  V.slots=rs.slots;V.extra=rs.extra;
  V.sched=buildSchedule(toSched(S.settings));
  V.nextIdx=-1;
  for(var i=0;i<V.sched.length;i++){if(V.sched[i].iso>=today){V.nextIdx=i;break;}}
  V.focusIdx=V.nextIdx>=0?V.nextIdx:V.sched.length-1;
}

/* Talk to the server. Resolves to the JSON body; rejects with an Error whose message is
   the server's plain-language reason. */
async function api(method,path,body){
  var res;
  try{
    res=await fetch(path,{method:method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,credentials:'same-origin'});
  }catch(e){throw new Error('We could not reach the server. Check your connection and try again.');}
  var json={};try{json=await res.json();}catch(e){}
  if(res.status===401){applySignedOut();}
  if(!res.ok){var err=new Error(json.error||'Something went wrong. Try again.');err.status=res.status;throw err;}
  return json;
}
Susu.api=api;
function applySignedOut(){
  S.uid=null;S.role='';S.isAdmin=false;S.me=null;S.code='';S.settings=null;S.membersAll=[];
  S.payMap={};S.outMap={};S.ready=true;S.offline=false;
  emit();
}
/* Put a /api/state answer into S. */
function applyState(st){
  if(!st||!st.me){applySignedOut();return;}
  S.me=st.me;S.uid=st.me.uid;S.role=st.me.role;S.isAdmin=st.me.role==='admin';
  S.code=st.group.code;
  S.settings=st.group.settings?cleanSettings(st.group.settings,today):null;
  S.membersAll=(st.members||[]).map(function(m){return L.cleanMember(m.uid,m);});
  S.payMap={};Object.keys(st.payments||{}).forEach(function(k){var p=st.payments[k];if(p.status==='paid')S.payMap[k]=p;});
  S.outMap={};Object.keys(st.payouts||{}).forEach(function(k){var o=st.payouts[k];if(o.status==='paid')S.outMap[k]=o;});
  S.ready=true;S.offline=false;S.fatal='';
  emit();
}
Susu.applyState=applyState;
var booted=false,pollTimer=null,refreshing=null;
Susu.refresh=function(){
  if(refreshing)return refreshing;
  refreshing=(async function(){
    try{var st=await api('GET','/api/state');applyState(st);}
    catch(e){
      if(e.status===401)return;
      if(!S.ready){S.fatal=e.message;S.ready=true;}
      S.offline=true;emit();
    }
    finally{refreshing=null;}
  })();
  return refreshing;
};
Susu.boot=function(){
  if(booted)return;booted=true;
  emit();
  Susu.refresh();
  pollTimer=setInterval(function(){if(document.visibilityState!=='hidden'&&S.role)Susu.refresh();},8000);
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&S.role)Susu.refresh();});
};

/* ---------- derived numbers ---------- */
/* The signed-in member, never the admin (admins and members have separate ids). */
function isMe(m){return !!(m&&S.role==='member'&&m.uid===S.uid);}
function myIdx(){for(var i=0;i<V.slots.length;i++){if(isMe(V.slots[i]))return i;}return -1;}
function isPaid(r,m){return !!S.payMap[r+'_'+m.uid];}
function roundStats(rd){
  var pc=0,need=0;
  rd.contributors.forEach(function(i){need++;var m=V.slots[i];if(m&&isPaid(rd.r,m))pc++;});
  return {pc:pc,need:need,got:round2(pc*S.settings.base)};
}
function groupTotals(){
  var saved=0,planned=0,out=0;
  V.sched.forEach(function(rd){var st=roundStats(rd);saved+=st.got;planned+=rd.pot;if(S.outMap[rd.r])out+=rd.net;});
  return {saved:round2(saved),planned:round2(planned),out:round2(out)};
}
function pctOf(rd,st){return rd.pot>0?Math.min(100,Math.round(st.got/rd.pot*100)):0;}
function groupBadge(){
  var st=S.settings;
  if(!st)return ['Setting up','pill'];
  if(st.start<=today)return ['Collecting','pill ok'];
  if(V.roster.length>=st.n)return ['Group full','pill ok'];
  if(st.open===false)return ['Sign-ups closed','pill'];
  var k=st.n-V.roster.length;return [k+(k===1?' place open':' places open'),'pill warn'];
}
function activity(forMember){
  var ev=[];
  Object.keys(S.payMap).forEach(function(k){
    var p=S.payMap[k],rd=V.sched[p.r],m=V.roster.filter(function(x){return x.uid===p.uid;})[0];
    if(!rd||!m||!isFinite(p.at))return;
    if(forMember&&m.uid!==S.uid)return;
    ev.push({t:p.at,type:'dep',m:m,rd:rd,amt:p.amount||S.settings.base,by:p.by||''});
  });
  Object.keys(S.outMap).forEach(function(r){
    var rd=V.sched[+r],o=S.outMap[r];if(!rd||!o)return;
    var m=V.slots[rd.member];if(!m||!isFinite(o.at))return;
    ev.push({t:o.at,type:'col',m:m,rd:rd,amt:o.amount||rd.net,by:o.by||''});
  });
  if(forMember)V.roster.forEach(function(m){if(m.joinedAt)ev.push({t:m.joinedAt,type:'join',m:m,amt:0});});
  ev.sort(function(a,b){return b.t-a.t;});
  return ev.slice(0,forMember?6:8);
}
function onTimeRate(){
  var due=0,paid=0;
  V.sched.forEach(function(r){
    if(r.iso>today)return;
    r.contributors.forEach(function(i){var m=V.slots[i];if(!m)return;due++;if(isPaid(r.r,m))paid++;});
  });
  return due?{pct:Math.round(paid/due*100),due:due,paid:paid}:null;
}
function roundStatus(rd){
  if(S.outMap[rd.r])return ['Paid out','pill ok'];
  if(rd.r===V.nextIdx)return ['Next','pill line'];
  if(rd.iso<today)return ['Past','pill'];
  return ['Upcoming','pill'];
}
function canMark(rd,mode){
  if(mode==='admin')return S.isAdmin;
  return isMe(V.slots[rd.member]);
}
Object.assign(Susu,{isMe:isMe,myIdx:myIdx,isPaid:isPaid,roundStats:roundStats,groupTotals:groupTotals,pctOf:pctOf,groupBadge:groupBadge,activity:activity,onTimeRate:onTimeRate,roundStatus:roundStatus,canMark:canMark});


/* ---------- writes (each answers with the fresh state) ---------- */
var busy={};
async function change(method,path,body){
  try{applyState(await api(method,path,body));return '';}
  catch(e){return e.message;}
}
Susu.change=change;
Susu.saveSettings=function(draft){return change('PUT','/api/settings',draft);};
Susu.toggleOpen=function(){return change('POST','/api/settings/open');};
Susu.memberLink=async function(u,reset){try{return await api('GET','/api/members/'+encodeURIComponent(u)+'/link'+(reset?'?reset=1':''));}catch(e){return {error:e.message};}};
Susu.shuffle=function(){return change('POST','/api/members/shuffle');};
Susu.removeMember=function(u){return change('DELETE','/api/members/'+encodeURIComponent(u));};
Susu.resetMemberPassword=async function(u,pw){try{await api('POST','/api/members/'+encodeURIComponent(u)+'/password',{password:pw});return '';}catch(e){return e.message;}};
Susu.togglePaid=async function(r,u){
  var key=r+'_'+u;if(busy[key])return '';busy[key]=1;
  var msg=await change('POST','/api/payments/cash',{r:r,uid:u,on:!S.payMap[key]});
  busy[key]=0;if(msg)Susu.toast(msg);return msg;
};
Susu.markAll=async function(r,mode){
  var rd=V.sched[r];if(!rd||!canMark(rd,mode))return '';
  var us=rd.contributors.map(function(i){return V.slots[i];}).filter(Boolean);
  var all=us.length>0&&us.every(function(m){return isPaid(r,m);});
  var msg=await change('POST','/api/payments/all',{r:r,on:!all});
  if(msg)Susu.toast(msg);return msg;
};
Susu.togglePayout=async function(r){
  var key='r'+r;if(busy[key])return '';busy[key]=1;
  var msg=await change('POST','/api/payouts/cash',{r:r,on:!S.outMap[r]});
  busy[key]=0;if(msg)Susu.toast(msg);return msg;
};

/* Short message at the bottom of the page when something could not be done. */
var toastTimer=null;
Susu.toast=function(msg){
  var el=document.getElementById('susu-toast');
  if(!el){el=document.createElement('div');el.id='susu-toast';el.className='toast';el.setAttribute('role','status');document.body.appendChild(el);}
  el.textContent=msg;el.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.classList.remove('show');},5000);
};

/* ---------- accounts ---------- */
/* Members: the group's join code, then a username and password inside that group. */
Susu.groupLookup=async function(code){
  try{return await api('GET','/api/group/'+encodeURIComponent(code));}
  catch(e){return {error:e.message};}
};
/* 'free' | 'taken' | '' (could not tell) */
Susu.usernameState=async function(code,u){
  try{var r=await api('GET','/api/group/'+encodeURIComponent(code)+'/username/'+encodeURIComponent(u));return r.taken?'taken':'free';}
  catch(e){return '';}
};
/* Each returns an error message, or '' when signed in. */
Susu.signup=function(code,full,u,pw,avatar){return change('POST','/api/member/signup',{code:code,fullName:full,username:u,password:pw,avatar:avatar});};
Susu.signin=function(code,u,pw){return change('POST','/api/member/login',{code:code,username:u,password:pw});};
Susu.adminCreate=function(u,pw,groupName){return change('POST','/api/admin/signup',{username:u,password:pw,groupName:groupName});};
Susu.adminSignin=function(u,pw){return change('POST','/api/admin/login',{username:u,password:pw});};
Susu.changePassword=async function(cur,pw){try{await api('PUT','/api/me/password',{current:cur,password:pw});return '';}catch(e){return e.message;}};

/* ---------- sessions: the server's cookie says who is signed in ---------- */
Susu.role=function(){
  if(!S.ready)return '';
  if(S.role==='admin')return 'admin';
  if(S.role==='member'&&V.mine)return 'member';
  return '';
};
Susu.signout=async function(){
  try{await api('POST','/api/logout');}catch(e){}
  applySignedOut();
  location.replace(Susu.link('login'));
};

/* ---------- route guard ----------
   #admin... needs an admin session, #home / #schedule / #payments need a member session,
   anything else is the login page. A signed-in person who lands on the login page goes
   straight to their own app. Until the server has answered, the login page shows a
   short "opening" state and no redirect happens. */
Susu.guard=function(want){
  if(!S.ready)return want==='login'?'login':'wait';
  var r=Susu.role();
  if(want==='admin'&&r!=='admin')return 'login';
  if(want==='user'&&r!=='member')return 'login';
  if(want==='login'&&r)return r==='admin'?'admin':'user';
  return want;
};
Susu.startRouter=function(el,apps){
  var cur='',stop=null;
  function route(){
    var want=ENTRY==='root'?Susu.appFor(location.hash):ENTRY,to=Susu.guard(want);
    if(to==='wait')to='login';
    else if(to!==want){location.replace(Susu.link(to));if(ENTRY==='root')route();return;}
    if(to===cur)return;
    if(stop)stop();
    cur=to;stop=apps[to].mount(el);
  }
  window.addEventListener('hashchange',function(){route();if(S.role)Susu.refresh();});
  Susu.onChange(route);
  Susu.boot();
  route();
};

/* ---------- schedule text to share ---------- */
Susu.scheduleText=function(){
  var st=S.settings,L=[];
  L.push((st.name.trim()||'Susu group').toUpperCase());
  L.push(st.n+' people, '+intervalText(st)+', '+fmt(st.base)+' each');L.push('');
  var last=0;
  V.sched.forEach(function(rd){
    if(rd.cycle!==last){last=rd.cycle;if(rd.cycle>1)L.push('');if(st.cycles>1)L.push('Time round '+rd.cycle);}
    L.push('Round '+(rd.r+1)+' - '+fmtDate(rd.date)+' - '+slotName(rd.member)+' (number '+(rd.member+1)+') collects '+fmt(rd.net));
  });
  return L.join('\n');
};
Susu.copySchedule=function(statusId,boxId){
  if(!S.settings)return;
  var txt=Susu.scheduleText(),box=$(boxId);
  function fb(){box.hidden=false;box.value=txt;box.focus();box.select();say(statusId,'Select the text below and copy it (Ctrl+C, or Cmd+C on a Mac).',6000);}
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(function(){box.hidden=true;say(statusId,'Copied. You can paste it into a message.',4000);},fb);
    else fb();
  }catch(e){fb();}
};

/* ---------- payment tiles, shared by both apps ---------- */
/* "admin:boss" or "member:Ama Mensah" -> "the admin" / "Ama" */
function byName(by){
  by=String(by||'');
  if(by.indexOf('admin:')===0)return 'the admin';
  if(by.indexOf('member:')===0){var n=by.slice(7).trim();return n===S.me.name?'you':n.split(' ')[0];}
  return '';
}
Susu.byName=byName;
Susu.tilesHTML=function(rd,mode){
  var mark=canMark(rd,mode);
  return '<ul class="pay">'+rd.contributors.map(function(i){
    var m=V.slots[i];
    if(!m)return '<li><div class="tile open">'+Susu.ghost('')+'<span class="nm">Open place '+(i+1)+'<small>Not joined yet</small></span><span class="st">Waiting</span></div></li>';
    var p=S.payMap[rd.r+'_'+m.uid],on=!!p;
    var sub=on?'Cash, '+esc(fmtWhen(p.at))+(byName(p.by)?' \u00b7 by '+esc(byName(p.by)):''):esc(fmt(S.settings.base));
    var inner=Susu.av(m.avatar,'')+'<span class="nm">'+esc(m.fullName)+(isMe(m)?' (you)':'')+'<small>'+sub+'</small></span><span class="st"><i aria-hidden="true">\u2713</i>'+(on?'Paid':'Not yet')+'</span>';
    return mark?'<li><button type="button" class="tile" data-act="paid" data-r="'+rd.r+'" data-u="'+esc(m.uid)+'" aria-pressed="'+on+'" title="'+(on?'Tap to unmark':'Tap once the cash is handed over')+'">'+inner+'</button></li>':'<li><div class="tile'+(on?' on':'')+'">'+inner+'</div></li>';
  }).join('')+'</ul>';
};
Susu.actionsHTML=function(rd,mode){
  if(!canMark(rd,mode))return '';
  var st=roundStats(rd),col=V.slots[rd.member],o=S.outMap[rd.r],out=!!o,everyone=st.pc===st.need&&st.need>0,me=isMe(col);
  var h='<div class="actions"><button type="button" class="btn wide" data-act="all" data-r="'+rd.r+'">'+(everyone?'Clear all marks for this round':'Mark everyone as paid')+'</button>';
  if(col){
    if(out)h+='<button type="button" class="btn wide" data-act="out" data-r="'+rd.r+'" aria-pressed="true">\u2713 Cash received by '+(me?'you':esc(firstName(col)))+' \u00b7 '+esc(fmtWhen(o.at))+' (tap to undo)</button>';
    else h+='<button type="button" class="btn primary wide" data-act="out" data-r="'+rd.r+'" aria-pressed="false">'+(me?'I have received the cash':'Mark cash as handed to '+esc(firstName(col)))+'</button>';
  }
  return h+'</div>';
};
/* Handles a click on a payment tile or action. Returns true when it did something. */
Susu.handleTrack=function(e,mode){
  var b=e.target.closest('button[data-act]');if(!b)return false;
  var a=b.dataset.act,r=+b.dataset.r,rd=V.sched[r];
  if(a==='paid'){if(rd&&canMark(rd,mode))Susu.togglePaid(r,b.dataset.u);return true;}
  if(a==='all'){Susu.markAll(r,mode);return true;}
  if(a==='out'){if(rd&&canMark(rd,mode))Susu.togglePayout(r);return true;}
  return false;
};

/* ---------- focus helpers so live updates do not steal the keyboard ---------- */
Susu.snapFocus=function(){
  var a=document.activeElement;
  if(!a||a===document.body)return null;
  if(a.id)return '#'+a.id;
  var d=a.dataset;
  if(d&&d.act)return '[data-act="'+d.act+'"]'+(d.u?'[data-u="'+d.u+'"]':'')+(d.r!==undefined?'[data-r="'+d.r+'"]':'');
  return null;
};
Susu.restoreFocus=function(sel){
  if(!sel)return;
  try{var el=document.querySelector(sel);if(el&&el!==document.activeElement)el.focus({preventScroll:true});}catch(e){}
};
Susu.focusHead=function(sec){
  if(!sec)return;
  var hs=sec.querySelectorAll('h1,h2');
  for(var i=0;i<hs.length;i++){if(hs[i].offsetParent!==null){hs[i].setAttribute('tabindex','-1');hs[i].focus({preventScroll:true});return;}}
};
})();
