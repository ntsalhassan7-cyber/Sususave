/* Susu member app: join the group, see your turn, the schedule and your payments. */
(function(){
'use strict';
var U=window.Susu,S=U.state,V=U.v,$=U.$,esc=U.esc,fmt=U.fmt,ic=U.ic,av=U.av,ghost=U.ghost;
var PAGES=['home','schedule','payments'];
var NAMES={home:'Home',schedule:'Schedule',payments:'Payments'};

var SHELL=
'<div class="us">'+
  '<header class="us-hero"><div class="us-in">'+
    '<div class="us-top">'+
      '<a class="us-brand" href="#home"><span class="us-logo" aria-hidden="true">'+U.RING+'</span><span>Susu</span></a>'+
      '<nav class="navpill" id="us-nav" aria-label="Pages"></nav>'+
      '<div class="us-actions" id="us-actions"></div>'+
    '</div>'+
    '<div class="us-greet" id="us-greet"></div>'+
  '</div></header>'+
  '<main class="us-main">'+
    '<div class="notice" id="us-msg" hidden><h2 tabindex="-1" id="us-msg-h"></h2><p id="us-msg-p"></p><div id="us-msg-a"></div></div>'+
    '<section id="us-home" hidden><div class="ug" id="us-home-root"></div></section>'+
    '<section id="us-schedule" hidden><div class="ug" id="us-sched-root"></div></section>'+
    '<section id="us-payments" hidden><div class="ug" id="us-pay-root"></div></section>'+
  '</main>'+
  '<footer class="foot"><div class="kente" aria-hidden="true"></div><p>Shared live with everyone in the group.</p></footer>'+
'</div>';

function mount(root){
  var page='',lastPage='',first=true,chromeSig='';
  var live=true,openRounds={},offs=[];
  function on(el,ev,fn,opt){el.addEventListener(ev,fn,opt);offs.push(function(){el.removeEventListener(ev,fn,opt);});}

  document.body.classList.add('app-user');
  root.innerHTML=SHELL;

  function pageFromHash(){
    var h=(location.hash||'').replace('#','');
    return PAGES.indexOf(h)>=0?h:'';
  }

  /* ---------- render ---------- */
  function render(){
    if(!live)return;
    var focusSel=U.snapFocus();
    var msgH='',msgP='',msgA='';
    if(S.fatal){msgH='We could not open Susu';msgP=S.fatal;msgA='<button type="button" class="btn" data-act="reload">Try again</button>';}
    else if(!S.ready){msgH='Opening your group';msgP='One moment.';}
    else if(!S.settings){
      msgH='Your group is not ready yet';msgP='The admin has not finished setting up the group. Check again soon.';
      msgA='<button type="button" class="btn" data-act="reload">Check again</button>';
    }
    else if(!V.mine){msgH='Taking you to the login page';msgP='One moment.';}
    var view=msgH?'msg':pageFromHash()||'home';
    page=view;
    var entering=view!==lastPage;
    $('us-msg').hidden=view!=='msg';
    PAGES.forEach(function(p){$('us-'+p).hidden=p!==view;});
    if(view==='msg'){$('us-msg-h').textContent=msgH;$('us-msg-p').textContent=msgP;$('us-msg-a').innerHTML=msgA;}
    chrome(view);
    if(view==='home')renderHome();
    else if(view==='schedule')renderSchedule();
    else if(view==='payments')renderPay();
    if(entering&&!first){
      window.scrollTo(0,0);
      U.focusHead(view==='msg'?$('us-msg'):$('us-greet'));
    } else U.restoreFocus(focusSel);
    if(S.ready||S.fatal)first=false;
    lastPage=view;
  }

  function chrome(view){
    var st=S.settings,gname=st&&st.name.trim()?st.name.trim():'Your susu group';
    var actions='';
    if(V.mine)actions+='<button type="button" class="chip" data-act="signout">'+ic('out')+'Sign out</button>';
    var greet='';
    if(view==='home'||view==='schedule'||view==='payments'){
      var hr=new Date().getHours(),hello=hr<12?'Good morning':hr<17?'Good afternoon':'Good evening';
      var title=view==='home'?hello+', '+esc(U.firstName(V.mine)):NAMES[view];
      var sub=view==='home'?'Here\u2019s where your susu group stands today.':esc(gname);
      greet='<div class="greet-who">'+av(V.mine.avatar,'l')+'<div><h1>'+title+'</h1><p>'+sub+'</p></div></div>';
    }
    var nav=(view==='home'||view==='schedule'||view==='payments')?'<ul>'+PAGES.map(function(p){
      return '<li><a href="#'+p+'"'+(p===view?' aria-current="page"':'')+'>'+ic(p)+'<span>'+NAMES[p]+'</span></a></li>';
    }).join('')+'</ul>':'';
    var sig=view+'|'+actions+'|'+greet+'|'+nav;
    if(sig===chromeSig)return;
    chromeSig=sig;
    $('us-actions').innerHTML=actions;
    $('us-greet').innerHTML=greet;
    $('us-greet').hidden=!greet;
    $('us-nav').innerHTML=nav;
  }
  function heroCard(){
    var st=S.settings,rd=V.sched[V.focusIdx],col=V.slots[rd.member],me=U.myIdx(),isMe=me>=0&&rd.member===me,t=U.groupTotals(),tpct=t.planned>0?Math.min(100,Math.round(t.saved/t.planned*100)):0;
    var gname=st.name.trim()||'Your susu group';
    return '<div class="card hero"><p class="eyebrow">'+esc(gname).toUpperCase()+' \u00b7 ROUND '+(rd.r+1)+' OF '+V.sched.length+'</p>'+
      '<p class="big">'+esc(fmt(rd.pot))+'</p><p class="lead">Collective pot for this round</p>'+
      '<a class="glass" href="#schedule">'+ic('arrow')+(isMe?'You collect this round':esc(U.slotName(rd.member))+' collects this round')+'</a>'+
      '<div class="meter" style="margin-top:22px" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+tpct+'" aria-label="Group savings"><span style="width:'+tpct+'%"></span></div>'+
      '<p class="prog"><span>'+esc(fmt(t.saved))+' saved so far</span><span>'+tpct+'% of '+esc(fmt(t.planned))+'</span></p></div>';
  }
  on(root,'click',function(e){
    var b=e.target.closest('[data-act]');if(!b)return;
    var a=b.dataset.act;
    if(a==='signout')U.signout();
    else if(a==='reload')location.reload();
  });


  /* ---------- MoMo number, so the admin can send you the pot ---------- */
  function momoCard(){
    var me=S.me||{},nets={mtn:'MTN MoMo',vodafone:'Telecel Cash',airteltigo:'AT Money'};
    var opts=['mtn','vodafone','airteltigo'].map(function(k){return '<option value="'+k+'"'+(me.provider===k?' selected':'')+'>'+nets[k]+'</option>';}).join('');
    return '<form class="card" id="momo-form" autocomplete="off"><div class="sec-head"><h3>Your MoMo number</h3>'+(me.phone?'<span class="pill ok">Saved</span>':'<span class="pill warn">Not added</span>')+'</div>'+
      '<p class="hint">'+(S.momo.enabled?'When it is your turn, the admin can send the pot straight to this number.':'The admin can use this number to send you the pot once mobile money is switched on.')+'</p>'+
      '<div class="momo-row" style="margin-top:12px"><select id="momo-net" aria-label="Network">'+opts+'</select><input id="momo-phone" type="tel" inputmode="numeric" maxlength="10" placeholder="0241234567" aria-label="Mobile money number" value="'+esc(me.phone||'')+'" style="flex:1;min-width:150px"><button type="submit" class="btn primary" id="momo-save">Save</button></div>'+
      '<p class="status" id="momo-status" aria-live="polite"></p></form>';
  }
  on($('us-pay-root'),'submit',async function(e){
    var f=e.target.closest('#momo-form');if(!f)return;e.preventDefault();
    var btn=$('momo-save');btn.disabled=true;
    var msg=await U.saveMomo($('momo-phone').value.trim(),$('momo-net').value);
    if(!live)return;btn.disabled=false;
    $('momo-status').className='status'+(msg?' err':'');
    U.say('momo-status',msg||'Saved.',5000);
  });

  /* ---------- extra cards ---------- */
  function membersCard(){
    var st=S.settings,open=Math.max(0,st.n-V.roster.length);
    return '<div class="card"><div class="sec-head"><h3>Who is in the group</h3><span class="pill '+(open?'warn':'ok')+'">'+(open?open+' open':'Full')+'</span></div>'+
      '<div class="avgrid">'+V.slots.map(function(m,i){return m?'<div class="avcell">'+av(m.avatar,'')+'<small>'+esc(U.firstName(m))+'</small><i>'+(i+1)+'</i></div>':'<div class="avcell">'+ghost('')+'<small class="cap">Open</small><i>'+(i+1)+'</i></div>';}).join('')+'</div>'+
      '<p class="hint" style="margin-top:12px">The number is the order people collect in.</p></div>';
  }
  function upcomingCard(){
    var from=V.nextIdx>=0?V.nextIdx:V.sched.length,list=V.sched.slice(from,from+3),me=U.myIdx();
    return '<div class="card"><div class="sec-head"><h3>Coming up</h3><a class="viewall" href="#schedule">View all '+ic('right')+'</a></div>'+
      (list.length?'<div class="feed">'+list.map(function(r){var m=V.slots[r.member],isMe=me>=0&&r.member===me;return '<div class="act'+(isMe?' is-me':'')+'">'+(m?av(m.avatar,''):ghost(''))+'<div class="t"><b>'+esc(U.slotName(r.member))+(isMe?' (you)':'')+'</b><small>Round '+(r.r+1)+' \u00b7 '+esc(U.fmtShort(r.date))+'</small></div><div class="a num" style="color:var(--fg)">'+esc(fmt(r.net))+'<small>'+U.rel(r.date)+'</small></div></div>';}).join('')+'</div>':'<p class="hint">Every round is finished.</p>')+'</div>';
  }
  function standingCard(me){
    var st=S.settings,due=0,paid=0,late=0,next=null;
    V.sched.forEach(function(r){
      if(r.contributors.indexOf(me)<0)return;
      var p=U.isPaid(r.r,V.mine);
      if(r.iso<U.today){due++;if(p)paid++;else late++;}
      else if(!p&&!next)next=r;
    });
    var pct=due?Math.round(paid/due*100):100;
    return '<div class="card"><div class="sec-head"><h3>Your standing</h3><span class="pill '+(late?'bad':'ok')+'">'+(late?late+' late':'On track')+'</span></div>'+
      '<div class="stand"><div><p class="cap">Paid on time</p><p class="v num">'+pct+'%</p><p class="s">'+paid+' of '+due+' due</p></div>'+
      '<div><p class="cap">Owing now</p><p class="v num">'+esc(fmt(U.round2(late*st.base)))+'</p><p class="s">'+late+(late===1?' round':' rounds')+'</p></div>'+
      '<div><p class="cap">Next payment</p><p class="v">'+(next?esc(U.fmtDM(next.date)):'–')+'</p><p class="s">'+(next?U.rel(next.date):'Nothing due')+'</p></div></div></div>';
  }
  function groupPaceCard(){
    var done=V.sched.filter(function(r){return !!S.outMap[r.r];}).length,total=V.sched.length,pct=total?Math.round(done/total*100):0;
    return '<div class="card"><div class="sec-head"><h3>Group progress</h3><span class="pill accent">'+pct+'%</span></div><p class="goal-n">'+done+' of '+total+' rounds paid out</p><div class="meter" style="margin-top:12px"><span style="width:'+pct+'%"></span></div><p class="prog"><span>'+(total-done)+' to go</span><span>'+esc(U.fmtDM(V.sched[total-1].date))+' '+V.sched[total-1].date.getFullYear()+'</span></p></div>';
  }

  /* ---------- home ---------- */
  function pickup(rd,isMeNow){
    var col=V.slots[rd.member];
    return '<div class="dashed'+(isMeNow?' me':'')+'"><p class="cap">'+(V.nextIdx>=0?'Next pickup info':'Last pickup info')+'</p><div class="pickrow">'+(col?av(col.avatar,'s'):ghost('s'))+'<b>'+esc(U.slotName(rd.member))+(isMeNow?' (you)':'')+'</b><span class="d">'+ic('cal')+esc(U.fmtDM(rd.date))+' \u00b7 '+U.rel(rd.date)+'</span></div></div>';
  }
  function goal(icon,label,title,pct,amount,of){
    return '<div class="goal"><span class="goal-ic" aria-hidden="true">'+ic(icon)+'</span><div class="goal-t"><p class="cap">'+label+'</p><p class="goal-n">'+title+'</p>'+
      '<p class="goal-p">'+pct+'%</p><div class="meter"><span style="width:'+pct+'%"></span></div>'+
      '<p class="goal-a"><b class="num">'+amount+'</b>'+(of?' <span>/ '+of+'</span>':'')+'</p></div></div>';
  }
  function actRows(ev,emptyText){
    if(!ev.length)return '<p class="hint" style="padding:12px 0">'+emptyText+'</p>';
    return ev.map(function(x){
      var what=x.type==='dep'?'Deposited':x.type==='col'?'Collected':'Joined the group';
      var who=x.m.uid===S.uid&&x.type!=='col'?'You':x.m.fullName;
      return '<div class="act">'+av(x.m.avatar,'')+'<div class="t"><b>'+esc(who)+'</b><small>'+what+' \u00b7 '+esc(U.fmtWhen(x.t))+'</small></div>'+
        (x.amt?'<div class="a num">+'+esc(fmt(x.amt))+'</div>':'')+'</div>';
    }).join('');
  }
  function renderHome(){
    var root=$('us-home-root'),st=S.settings,me=U.myIdx(),rd=V.sched[V.focusIdx],isMeNow=me>=0&&rd.member===me;
    var myRounds=V.sched.filter(function(r){return r.member===me;}),myNext=me<0?null:(myRounds.filter(function(r){return r.iso>=U.today;})[0]||myRounds[myRounds.length-1]);
    var t=U.groupTotals(),tpct=t.planned>0?Math.min(100,Math.round(t.saved/t.planned*100)):0,badge=U.groupBadge();
    var gname=st.name.trim()||'Your susu group';
    var desc=st.desc.trim()||('Everyone pays '+fmt(st.base)+' every '+U.perText(st)+'. One member collects the whole pot each round, in turn, until everyone has had a go.');
    var left=heroCard()+'<div class="card group-card"><div class="m-id"><div class="emblem" aria-hidden="true">'+U.RING+'</div><div class="t"><h2>'+esc(gname)+'</h2><span class="'+badge[1]+'">'+esc(badge[0])+'</span></div></div>'+
      '<div class="pot"><p class="amount num">'+esc(fmt(rd.pot))+'</p><p class="cap">collected each round</p></div>'+
      '<ul class="facts"><li>'+ic('cal')+esc(V.sched[0].date.toLocaleDateString('en-GB'))+'</li><li>'+ic('people')+st.n+'</li><li>'+ic('coin')+esc(fmt(st.base))+' / '+esc(U.perText(st))+'</li></ul>'+
      '<div class="sec"><h3>Description</h3><p>'+esc(desc)+'</p></div></div>';
    var right=pickup(rd,isMeNow);
    if(me>=0){
      var mineAll=V.sched.filter(function(r){return r.contributors.indexOf(me)>=0;});
      var paidCount=mineAll.filter(function(r){return U.isPaid(r.r,V.mine);}).length;
      var ppct=mineAll.length?Math.round(paidCount/mineAll.length*100):0;
      var turnPct=0;
      if(myNext){
        var done=V.nextIdx<0?V.sched.length:V.nextIdx;
        turnPct=myNext.r===0?(done>0?100:0):Math.min(100,Math.round(done/myNext.r*100));
      }
      left+='<div class="sec-head"><h3>Your susu</h3><a class="viewall" href="#payments">View all '+ic('right')+'</a></div><div class="goals">'+
        goal('target','Group plan',esc(gname),tpct,esc(fmt(t.saved)),esc(fmt(t.planned)))+
        goal('wallet','Your payments',paidCount+' of '+mineAll.length+' paid',ppct,esc(fmt(paidCount*st.base)),esc(fmt(mineAll.length*st.base)))+
        (myNext?goal('clock','Your turn to collect',esc(U.fmtDM(myNext.date))+' \u00b7 '+U.rel(myNext.date),turnPct,esc(fmt(myNext.net)),''):'')+
      '</div>';
      var owes=rd.contributors.indexOf(me)>=0,paid=U.isPaid(rd.r,V.mine);
      right+='<div class="pair"><div class="mini"><span class="icoc" aria-hidden="true">'+ic('target')+'</span><p class="cap">Your payment, round '+(rd.r+1)+'</p>'+(owes?'<p class="v num">'+esc(fmt(st.base))+'</p><p><span class="pill '+(paid?'ok':rd.iso<U.today?'bad':'warn')+'">'+(paid?'Paid':rd.iso<U.today?'Not yet paid':'Due '+esc(U.fmtDM(rd.date)))+'</span></p>':'<p class="v">Nothing to pay</p><p class="s">You collect this round.</p>')+'</div>'+
        '<div class="mini"><span class="icoc" aria-hidden="true">'+ic('clock')+'</span><p class="cap">Your turn to collect</p>'+(myNext?'<p class="v num">'+esc(fmt(myNext.net))+'</p><p class="s">'+esc(U.fmtDM(myNext.date))+' \u00b7 '+U.rel(myNext.date)+'</p>':'<p class="v">&ndash;</p>')+'</div></div>';
    } else {
      right+='<div class="note-card"><p class="hint">The group size is smaller than the number of people who joined, so you have no place yet. Ask the admin.</p></div>';
    }
    if(me>=0)right+=standingCard(me);
    right+=upcomingCard();
    right+='<div class="card"><div class="sec-head"><h3>Recent activities</h3></div><p class="hint">Here are your recent activities across your group.</p><div class="feed">'+actRows(U.activity(true),'Nothing yet. Payments and collections will show here.')+'</div></div>';
    right+='<div class="cta2"><a class="btn" href="#schedule">See schedule</a><a class="btn primary" href="#payments">My payments</a></div>';
    left+=membersCard();
    root.innerHTML='<div class="col c7">'+left+'</div><div class="col c5">'+right+'</div>';
  }

  /* ---------- schedule ---------- */
  function renderSchedule(){
    var root=$('us-sched-root'),st=S.settings,rd=V.sched[V.focusIdx],me=U.myIdx(),isMeNow=me>=0&&rd.member===me;
    var list='',lastCycle=0;
    V.sched.forEach(function(r){
      if(st.cycles>1&&r.cycle!==lastCycle)list+='<div class="cyc">Time round '+r.cycle+' of '+st.cycles+'</div>';
      lastCycle=r.cycle;
      var m=V.slots[r.member],isMe=me>=0&&r.member===me,done=!!S.outMap[r.r];
      list+='<div class="act'+(isMe?' is-me':'')+(r.r===V.nextIdx?' next':'')+'">'+(m?av(m.avatar,''):ghost(''))+'<div class="t"><b>'+esc(U.slotName(r.member))+(isMe?' (you)':'')+'</b><small>Round '+(r.r+1)+' \u00b7 '+esc(U.fmtShort(r.date))+' '+r.date.getFullYear()+'</small></div><div class="a num">'+esc(fmt(r.net))+'<small>'+(done?'Paid out':U.rel(r.date))+'</small></div></div>';
    });
    root.innerHTML='<div class="col c7"><div class="card"><div class="sec-head"><h3>Every collection</h3></div><p class="hint">'+st.n+' people, '+esc(U.intervalText(st))+'. '+(V.roster.length<st.n?(st.n-V.roster.length)+(st.n-V.roster.length===1?' place is':' places are')+' still open.':'The group is full.')+'</p><div class="feed">'+list+'</div></div></div>'+
      '<div class="col c5">'+pickup(rd,isMeNow)+groupPaceCard()+membersCard()+'<div class="card" style="display:grid;gap:10px"><h3>Share the schedule</h3><p class="hint">Copy every round as text to paste into a group chat.</p><button type="button" class="btn primary wide" id="copy">'+ic('copy')+'Copy schedule to share</button><p class="status" id="status" role="status"></p><textarea id="copybox" class="copybox" hidden readonly aria-label="Schedule text"></textarea></div></div>';
  }
  on(root,'click',function(e){if(e.target.closest('#copy'))U.copySchedule('status','copybox');});

  /* ---------- payments ---------- */
  function renderPay(){
    var root=$('us-pay-root'),st=S.settings,me=U.myIdx(),t=U.groupTotals(),tpct=t.planned>0?Math.min(100,Math.round(t.saved/t.planned*100)):0;
    var saved='<div class="card saved"><p class="cap">Saved by the group so far</p><p class="big num">'+esc(fmt(t.saved))+'</p><div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+tpct+'" aria-label="Group savings"><span style="width:'+tpct+'%"></span></div><p class="prog"><span>'+tpct+'% of the plan</span><span>Paid out: '+esc(fmt(t.out))+'</span></p></div>';
    if(me<0){root.innerHTML='<div class="col c12">'+saved+'<div class="note-card"><p class="hint">You do not have a place in the group yet.</p></div></div>';return;}
    var left='';
    var collect=V.sched.filter(function(r){return r.member===me;});
    if(collect.length){
      var pick=collect.filter(function(r){return r.iso>=U.today;})[0]||collect[collect.length-1];
      left+='<div class="card"><div class="sec-head"><h3>Rounds you collect</h3></div><p class="hint">Only you and the admin can see who has paid in these rounds. Tap a person once they pay you.</p><div class="mypay">';
      collect.forEach(function(rd){
        var open=openRounds[rd.r]===undefined?rd.r===pick.r:openRounds[rd.r],s=U.roundStats(rd);
        left+='<details class="mine" data-r="'+rd.r+'"'+(open?' open':'')+'><summary><span>Round '+(rd.r+1)+' \u00b7 '+esc(U.fmtShort(rd.date))+'</span><span class="pill '+(S.outMap[rd.r]?'ok':'')+'">'+(S.outMap[rd.r]?'Received':s.pc+' of '+s.need+' paid')+'</span></summary>'+U.tilesHTML(rd,'member')+
          '<div class="meter" style="margin-top:14px"><span style="width:'+U.pctOf(rd,s)+'%"></span></div><p class="prog"><span>'+s.pc+' of '+s.need+' paid</span><span>'+esc(fmt(s.got))+' of '+esc(fmt(rd.pot))+'</span></p>'+U.actionsHTML(rd,'member')+'</details>';
      });
      left+='</div></div>';
    }
    var mine2=V.sched.filter(function(r){return r.contributors.indexOf(me)>=0;});
    var paidCount=mine2.filter(function(r){return U.isPaid(r.r,V.mine);}).length;
    var list='';
    mine2.forEach(function(rd){
      var p=U.isPaid(rd.r,V.mine),late=!p&&rd.iso<U.today,c=V.slots[rd.member],rec=S.payMap[rd.r+'_'+V.mine.uid],q=S.payPending[rd.r+'_'+V.mine.uid];
      var lab=p?(rec.method==='momo'?'Paid by MoMo':'Paid'):q&&q.status==='pending'?'Confirming':late?'Not yet':'Coming up';
      list+='<div class="act'+(rd.r===V.focusIdx?' is-me':'')+'">'+(c?av(c.avatar,''):ghost(''))+'<div class="t"><b>Round '+(rd.r+1)+' to '+esc(U.slotName(rd.member))+'</b><small>'+esc(U.fmtShort(rd.date))+' '+rd.date.getFullYear()+'</small>'+(p||rd.r>V.focusIdx?'':U.momoHTML(rd))+'</div><div class="a num" style="color:var(--fg)">'+esc(fmt(st.base))+'<small><span class="pill '+(p?'ok':late?'bad':q?'warn':'')+'">'+lab+'</span></small></div></div>';
    });
    var right='<div class="card"><div class="sec-head"><h3>Your payments</h3></div><p class="hint">'+paidCount+' of '+mine2.length+' paid \u00b7 '+esc(fmt(paidCount*st.base))+' so far. '+(S.momo.enabled?'Pay by MoMo from here, or hand cash to the collector and they will mark it.':'Hand your cash to the collector or the admin, and they will mark it here.')+'</p><div class="feed">'+list+'</div></div>'+momoCard();
    var top='<div class="ug2">'+saved+standingCard(me)+'</div>';
    root.innerHTML='<div class="col c12">'+top+'</div><div class="col c7">'+(left||right)+'</div><div class="col c5">'+(left?right:'')+upcomingCard()+'</div>';
  }
  on($('us-pay-root'),'click',function(e){U.handleTrack(e,'member');});
  on($('us-pay-root'),'toggle',function(e){
    var d=e.target;if(d&&d.classList&&d.classList.contains('mine'))openRounds[d.dataset.r]=d.open;
  },true);

  /* ---------- wiring ---------- */
  on(window,'hashchange',function(){if(U.appFor(location.hash)==='user')render();});
  offs.push(U.onChange(render));
  U.boot();
  render();

  return function unmount(){
    live=false;
    offs.forEach(function(f){f();});
    document.body.classList.remove('app-user');
    root.innerHTML='';
  };
}
window.SusuUser={mount:mount};
})();
