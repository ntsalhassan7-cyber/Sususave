/* Susu schedule logic. Loads in the browser (window.SusuLogic) and in Node (module.exports),
   so the server and the apps compute the same rounds and amounts. */
(function(root,factory){
  if(typeof module==="object"&&module.exports)module.exports=factory();
  else root.SusuLogic=factory();
})(typeof self!=="undefined"?self:this,function(){
"use strict";
function pad(n){return String(n).padStart(2,'0');}
function round2(v){return Math.round(v*100)/100;}
function parseDate(str){var p=String(str).split('-').map(Number);return new Date(p[0],p[1]-1,p[2],12);}
function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function roundDate(start,k,every,unit){
  var d=new Date(start.getTime());
  if(unit==='months'){
    var day=start.getDate();
    d.setDate(1);
    d.setMonth(start.getMonth()+k*every);
    var last=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
    d.setDate(Math.min(day,last));
  } else {
    d.setDate(start.getDate()+k*every*(unit==='weeks'?7:1));
  }
  return d;
}
function buildSchedule(s){
  var n=s.n,total=n*s.cycles,start=parseDate(s.start),rounds=[];
  for(var r=0;r<total;r++){
    var turn=r%n,member=turn,date=roundDate(start,r,s.every,s.unit);
    var contributors=[],pot=0;
    for(var m=0;m<n;m++){
      if(m===member&&!s.self)continue;
      contributors.push(m);pot+=s.base;
    }
    pot=round2(pot);
    var fee=round2(pot*s.fee/100);
    rounds.push({r:r,cycle:Math.floor(r/n)+1,turn:turn,member:member,date:date,iso:iso(date),contributors:contributors,pot:pot,fee:fee,net:round2(pot-fee)});
  }
  return rounds;
}
function clamp(v,lo,hi,d){v=Number(v);if(!isFinite(v))return d;return Math.min(hi,Math.max(lo,v));}
function cleanSettings(o,today){
  o=(o&&typeof o==='object')?o:{};
  var units=['days','weeks','months'];
  return {
    name:typeof o.name==='string'?o.name.slice(0,60):'',
    desc:typeof o.desc==='string'?o.desc.slice(0,160):'',
    cur:typeof o.cur==='string'?o.cur.slice(0,6):'GH\u20b5',
    base:clamp(o.base,0,1e9,50),
    every:Math.round(clamp(o.every,1,365,1)),
    unit:units.indexOf(o.unit)>=0?o.unit:'weeks',
    start:/^\d{4}-\d{2}-\d{2}$/.test(o.start||'')?o.start:today,
    cycles:Math.round(clamp(o.cycles,1,10,1)),
    n:Math.round(clamp(o.n,2,30,4)),
    fee:clamp(o.fee,0,100,0),
    self:o.self===false?false:true,
    open:o.open===false?false:true
  };
}
function toSched(st){return {n:st.n,cycles:st.cycles,every:st.every,unit:st.unit,start:st.start,base:st.base,fee:st.fee,self:st.self};}
/* Collection order: a drawn place (after the admin shuffles) comes first, then joining order. */
function sortRoster(roster){
  function key(m){return (m.slot===null||m.slot===undefined||!isFinite(m.slot))?Infinity:Number(m.slot);}
  return roster.slice().sort(function(a,b){return (key(a)-key(b))||(a.joinedAt-b.joinedAt)||(a.uid<b.uid?-1:a.uid>b.uid?1:0);});
}
function rosterSlots(roster,n){
  var sorted=sortRoster(roster),slots=sorted.slice(0,n);
  while(slots.length<n)slots.push(null);
  return {sorted:sorted,slots:slots,extra:sorted.slice(n)};
}
function normUser(u){return String(u||'').trim().toLowerCase();}
function validUser(u){return /^[a-z0-9][a-z0-9_.-]{2,19}$/.test(u);}
function cleanMember(id,o){
  o=(o&&typeof o==='object')?o:{};
  return {uid:id,
    fullName:typeof o.fullName==='string'&&o.fullName.trim()?o.fullName.trim().slice(0,60):'Member',
    username:typeof o.username==='string'?o.username.slice(0,20):'',
    avatar:Math.min(19,Math.max(0,Math.round(Number(o.avatar))||0)),
    joinedAt:Number(o.joinedAt)||0,
    slot:(o.slot===null||o.slot===undefined||o.slot==='')?null:Number(o.slot)};
}
function ticksOn(pct,count){return Math.round(Math.max(0,Math.min(100,pct))/100*count);}
return {pad:pad,round2:round2,parseDate:parseDate,iso:iso,buildSchedule:buildSchedule,clamp:clamp,cleanSettings:cleanSettings,toSched:toSched,sortRoster:sortRoster,rosterSlots:rosterSlots,normUser:normUser,validUser:validUser,cleanMember:cleanMember,ticksOn:ticksOn};
});
