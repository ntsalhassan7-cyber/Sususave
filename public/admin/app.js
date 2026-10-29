/* Susu admin app: set up the group, see who joined, the schedule and the payments dashboard. */
(function(){
'use strict';
var U=window.Susu,S=U.state,V=U.v,$=U.$,esc=U.esc,fmt=U.fmt,ic=U.ic,av=U.av,ghost=U.ghost;
var PAGES=['group','people','schedule','payments'];
var NAMES={group:'Group',people:'People',schedule:'Schedule',payments:'Payments'};
var TITLE={group:'Tell us about <b>your group</b>',people:'Who is <b>in the group</b>',schedule:'Who collects, <b>and when</b>',payments:'Track <b>payments</b> at a glance'};

var SHELL=
'<div class="ad">'+
  '<header class="ad-bar"><div class="ad-bar-in">'+
    '<a class="ad-brand" href="#admin"><span class="ad-logo" aria-hidden="true">'+U.RING+'</span><span>Susu <b>Admin</b></span></a>'+
    '<nav class="navpill" id="ad-nav" aria-label="Admin pages"></nav>'+
    '<div class="ad-who" id="ad-who"></div>'+
  '</div></header>'+
  '<main class="ad-main">'+
    '<div class="notice" id="ad-msg" hidden><h2 tabindex="-1" id="ad-msg-h"></h2><p id="ad-msg-p"></p><div id="ad-msg-a"></div></div>'+
    '<div id="ad-pages" hidden>'+
      '<div class="ad-head"><div><p class="eyebrow" id="ad-gname">Group admin</p><h1 id="ad-title"></h1></div><span id="ad-badge"></span></div>'+
      '<section id="ad-group" hidden>'+
        '<div class="g">'+
          '<form class="card c7" id="setup" autocomplete="off">'+
            '<div class="q"><label for="group">What is your group called? <span class="opt">(optional)</span></label><input id="group" type="text" maxlength="60" placeholder="For example, Market Susu"></div>'+
            '<div class="q"><label for="desc">What is it for? <span class="opt">(optional, shown to members)</span></label><input id="desc" type="text" maxlength="160" placeholder="For example, Saving together for school fees"></div>'+
            '<div class="q"><label for="n">How many people are in the group?</label>'+
              '<div class="stepper"><button type="button" class="round-btn" id="n-minus" aria-label="One fewer person">&minus;</button><input id="n" type="number" min="2" max="30" step="1" inputmode="numeric"><button type="button" class="round-btn" id="n-plus" aria-label="One more person">+</button></div>'+
              '<p class="hint" id="n-note"></p></div>'+
            '<div class="q"><label for="base">How much does each person put in?</label>'+
              '<div class="moneyrow"><input id="cur" type="text" maxlength="6" aria-label="Currency symbol" placeholder="GH\u20b5"><input id="base" type="number" min="0" step="any" inputmode="decimal"></div></div>'+
            '<div class="q"><label for="freq">How often does everyone pay in?</label>'+
              '<select id="freq"><option value="d1">Every day</option><option value="w1">Every week</option><option value="w2">Every 2 weeks</option><option value="m1">Every month</option><option value="custom">Something else</option></select>'+
              '<div class="inline" id="custom-freq" hidden><span>Every</span><input id="every" type="number" min="1" max="365" step="1" inputmode="numeric" aria-label="Number"><select id="unit" aria-label="Days, weeks or months"><option value="days">days</option><option value="weeks">weeks</option><option value="months">months</option></select></div></div>'+
            '<div class="q"><label for="start">When is the first collection?</label><input id="start" type="date"></div>'+
            '<details class="more"><summary>More options</summary>'+
              '<div class="q"><label for="cycles">How many times should it go all the way round?</label><input id="cycles" type="number" min="1" max="10" step="1" inputmode="numeric"><p class="hint">After everyone has collected once, it starts again from number 1.</p></div>'+
              '<div class="q"><label for="fee">Should the collector keep a small fee? <span class="opt">(percent of the pot)</span></label><input id="fee" type="number" min="0" max="100" step="any" inputmode="decimal"></div>'+
              '<div class="q check"><input id="self" type="checkbox"><label for="self">The person collecting also pays in that round</label></div>'+
            '</details>'+
          '</form>'+
          '<div class="stack c5">'+
            '<div class="card hero" id="g-preview" aria-live="polite"></div>'+
            '<div class="card" style="display:grid;gap:12px">'+
              '<button type="button" class="btn primary wide" id="save">Save group</button>'+
              '<p class="status" id="save-status" role="status"></p>'+
              '<a class="btn wide" id="save-next" href="#admin-people" hidden>Next: see who has joined</a>'+
            '</div>'+
          '</div>'+
        '</div>'+
      '</section>'+
      '<section id="ad-people" hidden><div class="g" id="ad-people-root"></div></section>'+
      '<section id="ad-schedule" hidden><div class="g" id="ad-sched-root"></div></section>'+
      '<section id="ad-payments" hidden><div class="g" id="ad-pay-root"></div></section>'+
    '</div>'+
  '</main>'+
  '<footer class="foot"><div class="kente" aria-hidden="true"></div><p>Shared live with everyone in the group.</p></footer>'+
'</div>';

function mount(root){
  var page='',lastPage='',first=true,chromeSig='';
  var draft=null,dirty=false,saving=false,customFreq=false;
  var rmConfirm='',shuffleConfirm=false,viewRound=0,timers={},live=true;
  var offs=[];
  function on(el,ev,fn,opt){el.addEventListener(ev,fn,opt);offs.push(function(){el.removeEventListener(ev,fn,opt);});}

  document.body.classList.add('app-admin');
  root.innerHTML=SHELL;

  function pageFromHash(){
    var h=(location.hash||'').replace('#','');
    var p=h.replace(/^admin-?/,'');
    return PAGES.indexOf(p)>=0?p:'';
  }
  function defaultPage(){return S.settings?'people':'group';}

  /* ---------- render ---------- */
  function render(){
    if(!live)return;
    var focusSel=U.snapFocus();
    var msgH='',msgP='',msgA='';
    if(S.fatal){msgH='We could not open the admin app';msgP=S.fatal;msgA='<button type="button" class="btn primary" data-act="retry">Try again</button>';}
    else if(!S.ready){msgH='Opening your group';msgP='One moment.';}
    else if(!S.isAdmin){
      msgH='This is the admin app';
      msgP='Only the person who runs the group can open it.';
      msgA='<button type="button" class="btn primary" data-act="signout">Back to the login page</button>';
    }
    var showMsg=!!msgH;
    $('ad-msg').hidden=!showMsg;$('ad-pages').hidden=showMsg;
    if(showMsg){
      $('ad-msg-h').textContent=msgH;$('ad-msg-p').textContent=msgP;$('ad-msg-a').innerHTML=msgA;
      chrome('');page='';
      return;
    }
    page=pageFromHash()||defaultPage();
    var entering=page!==lastPage;
    PAGES.forEach(function(p){$('ad-'+p).hidden=p!==page;});
    chrome(page);
    if(page==='group')renderGroup(entering);
    else if(page==='people')renderPeople();
    else if(page==='schedule')renderSchedule();
    else if(page==='payments'){if(entering)viewRound=V.focusIdx;renderPay();}
    if(entering&&!first){window.scrollTo(0,0);U.focusHead($('ad-title').parentNode);}
    else U.restoreFocus(focusSel);
    first=false;lastPage=page;
  }

  function chrome(view){
    var st=S.settings,badge=U.groupBadge();
    $('ad-title').innerHTML=TITLE[view]||'';
    $('ad-gname').textContent=st&&st.name.trim()?st.name.trim():'Group admin';
    $('ad-badge').innerHTML=view?'<span class="'+badge[1]+'">'+esc(badge[0])+'</span>':'';
    var who=(S.isAdmin?'<span class="pill accent">Admin</span>':'')+'<button type="button" class="btn small" data-act="signout">'+ic('out')+'Sign out</button>';
    var sig=view+'|'+who;
    if(sig===chromeSig)return;
    chromeSig=sig;
    $('ad-who').innerHTML=who;
    $('ad-nav').innerHTML=view?'<ul>'+PAGES.map(function(p){
      return '<li><a href="#admin-'+p+'"'+(p===view?' aria-current="page"':'')+'>'+ic(p)+'<span>'+NAMES[p]+'</span></a></li>';
    }).join('')+'</ul>':'';
  }

  /* ---------- shared pieces ---------- */
  function needGroup(){
    return '<div class="card c12" style="display:grid;gap:12px;justify-items:start"><h3>Save your group first</h3><p class="hint">Answer the questions on the Group page so members have something to join.</p><a class="btn primary" href="#admin-group">Go to Group</a></div>';
  }
  function ticks(pct,count){
    count=count||40;var n=U.ticksOn(pct,count),h='';
    for(var i=0;i<count;i++)h+='<i class="'+(i<n?'on':i===n&&n<count?'end':'')+'"></i>';
    return '<div class="ticks" aria-hidden="true">'+h+'</div>';
  }
  function statTile(label,value,cap,href){
    var icon={'Saved so far':'wallet','Paid out':'arrow','This round':'coin','Still to pay':'clock','Joined':'people','Open places':'target','First collection':'cal','Each round':'coin','Finishes':'cal'}[label]||'coin';
    return '<div class="card stat"><div class="stat-top"><span class="icoc" aria-hidden="true">'+ic(icon)+'</span>'+(href?'<a class="corner" href="'+href+'" aria-label="Open '+label+'">'+ic('arrow')+'</a>':'')+'</div><p class="v num">'+value+'</p><p class="c">'+cap+'</p></div>';
  }

  /* ---------- group ---------- */
  function fillForm(){
    var d=draft;
    $('group').value=d.name;$('desc').value=d.desc;$('cur').value=d.cur;$('n').value=d.n;$('base').value=d.base;
    customFreq=U.freqKey(d)==='custom';
    $('freq').value=U.freqKey(d);
    $('custom-freq').hidden=!customFreq;
    $('every').value=d.every;$('unit').value=d.unit;
    $('start').value=d.start;$('cycles').value=d.cycles;$('fee').value=d.fee;$('self').checked=d.self;
  }
  function numv(id,lo,hi,cur,int){
    var v=parseFloat($(id).value);
    if(!isFinite(v))return cur;
    v=Math.min(hi,Math.max(lo,v));return int?Math.round(v):v;
  }
  function readForm(){
    var d=draft;
    d.name=$('group').value;d.desc=$('desc').value;d.cur=$('cur').value;d.base=numv('base',0,1e9,d.base);
    d.start=$('start').value||d.start;d.cycles=numv('cycles',1,10,d.cycles,true);
    d.fee=numv('fee',0,100,d.fee);d.self=$('self').checked;d.n=numv('n',2,30,d.n,true);
    if(customFreq){d.every=numv('every',1,365,d.every,true);d.unit=$('unit').value;}
  }
  function updateGroupUI(){
    var d=draft,rs=U.buildSchedule(U.toSched(d)),f=rs[0],last=rs[rs.length-1];
    var filled=Math.min(V.roster.length,d.n),pct=Math.round(filled/d.n*100);
    $('g-preview').innerHTML='<p class="eyebrow">Preview</p><p class="hero-h">Your susu <b>at a glance</b></p>'+
      '<div class="kpis"><div><b class="num">'+esc(U.fmtC(f.net,d.cur))+'</b><span>collected each round'+(f.fee>0?' after the fee':'')+'</span></div><div><b class="num">'+d.n+' rounds</b><span>until everyone has collected once</span></div><div><b class="num">'+esc(U.fmtDM(last.date))+' '+last.date.getFullYear()+'</b><span>last collection'+(d.cycles>1?' ('+d.cycles+' times round)':'')+'</span></div></div>'+
      ticks(pct)+'<div class="scale"><span>'+filled+' of '+d.n+' places filled</span><span>'+esc(U.intervalText(d))+'</span></div>';
    $('n-note').textContent=V.roster.length>d.n?V.roster.length+' people have already joined, so '+(V.roster.length-d.n)+' will have no place.':'';
    var b=$('save');
    b.disabled=saving;
    b.textContent=saving?'Saving\u2026':!S.settings?'Save group and open sign-ups':dirty?'Save changes':'Saved';
    $('save-next').hidden=!S.settings||dirty;
  }
  function renderGroup(entering){
    if(entering||!draft){draft=U.cleanSettings(S.settings||{},U.today);dirty=false;fillForm();U.say('save-status','');}
    else if(!dirty){draft=U.cleanSettings(S.settings||{},U.today);}
    updateGroupUI();
  }
  on($('setup'),'input',function(){readForm();dirty=true;updateGroupUI();});
  on($('setup'),'change',function(e){
    if(e.target.id==='freq'){
      var v=$('freq').value;
      if(v==='custom')customFreq=true;
      else{customFreq=false;draft.unit=v[0]==='d'?'days':v[0]==='w'?'weeks':'months';draft.every=v==='w2'?2:1;$('every').value=draft.every;$('unit').value=draft.unit;}
      $('custom-freq').hidden=!customFreq;
    }
    if($('start').value==='')$('start').value=draft.start;
    readForm();dirty=true;updateGroupUI();
  });
  on($('setup'),'submit',function(e){e.preventDefault();});
  function setN(nn){draft.n=Math.min(30,Math.max(2,nn));$('n').value=draft.n;dirty=true;updateGroupUI();}
  on($('n-minus'),'click',function(){readForm();setN(draft.n-1);});
  on($('n-plus'),'click',function(){readForm();setN(draft.n+1);});
  on($('save'),'click',async function(){
    if(saving)return;
    readForm();saving=true;updateGroupUI();
    var firstSave=!S.settings;
    var msg=await U.saveSettings(draft);
    if(!msg){
      dirty=false;
      $('save-status').className='status';
      U.say('save-status',firstSave?'Saved. Members can now join with the code '+S.code+'.':'Saved.',6000);
    } else {$('save-status').className='status err';U.say('save-status',msg,8000);}
    saving=false;updateGroupUI();
  });


  /* ---------- extra cards ---------- */
  function lateList(){
    /* members with unpaid rounds whose date has passed */
    var out=[];
    V.slots.forEach(function(m,i){
      if(!m)return;var late=0,owed=0;
      V.sched.forEach(function(r){if(r.iso<U.today&&r.contributors.indexOf(i)>=0&&!U.isPaid(r.r,m)){late++;owed+=S.settings.base;}});
      if(late)out.push({m:m,late:late,owed:U.round2(owed)});
    });
    return out.sort(function(a,b){return b.late-a.late;});
  }
  function lateCard(){
    var L=lateList();
    return '<div class="card"><div class="card-head"><h3>Behind on payments</h3><span class="pill '+(L.length?'bad':'ok')+'">'+(L.length?L.length+(L.length===1?' person':' people'):'Nobody')+'</span></div>'+
      (L.length?'<div class="feed">'+L.slice(0,6).map(function(x){return '<div class="act">'+av(x.m.avatar,'')+'<div class="t"><b>'+esc(x.m.fullName)+'</b><small>'+x.late+(x.late===1?' round':' rounds')+' not paid</small></div><div class="a num" style="color:var(--bad)">'+esc(fmt(x.owed))+'</div></div>';}).join('')+'</div>':'<p class="hint">Everyone has paid every round that is due. Members who miss a past round appear here.</p>')+'</div>';
  }
  function upcomingCard(){
    var from=V.nextIdx>=0?V.nextIdx:V.sched.length,list=V.sched.slice(from,from+4);
    return '<div class="card"><div class="card-head"><h3>Coming up</h3><a class="viewall" href="#admin-schedule">All rounds '+ic('right')+'</a></div>'+
      (list.length?'<div class="feed">'+list.map(function(r){var m=V.slots[r.member];return '<div class="act">'+(m?av(m.avatar,''):ghost(''))+'<div class="t"><b>'+esc(U.slotName(r.member))+'</b><small>Round '+(r.r+1)+' \u00b7 '+esc(U.fmtShort(r.date))+'</small></div><div class="a num" style="color:var(--fg)">'+esc(fmt(r.net))+'<small>'+U.rel(r.date)+'</small></div></div>';}).join('')+'</div>':'<p class="hint">Every round is finished.</p>')+'</div>';
  }
  function settingsCard(){
    var st=S.settings;
    var rows=[['Each person pays',fmt(st.base)+' '+U.intervalText(st)],['Group size',st.n+' people'],['Starts',U.fmtDate(U.parseDate(st.start))],['Times round',String(st.cycles)],['Collector fee',st.fee>0?st.fee+'% of the pot':'None'],['Collector pays in',st.self?'Yes':'No']];
    return '<div class="card"><div class="card-head"><h3>Group settings</h3><a class="viewall" href="#admin-group">Change '+ic('right')+'</a></div><dl class="kv">'+rows.map(function(r){return '<div><dt>'+esc(r[0])+'</dt><dd>'+esc(r[1])+'</dd></div>';}).join('')+'</dl></div>';
  }
  function cycleCard(){
    var done=V.sched.filter(function(r){return !!S.outMap[r.r];}).length,total=V.sched.length,pct=total?Math.round(done/total*100):0;
    var past=V.nextIdx<0?total:V.nextIdx;
    return '<div class="card"><div class="card-head"><h3>Cycle progress</h3><span class="pill accent">'+pct+'%</span></div>'+
      '<p class="hero-h" style="margin:0"><b>'+done+'</b> of '+total+' rounds paid out</p>'+
      '<div class="meter" style="margin-top:14px"><span style="width:'+pct+'%"></span></div>'+
      '<p class="prog"><span>'+past+' '+(past===1?'round':'rounds')+' due so far</span><span>'+(total-past)+' to go</span></p></div>';
  }
  function latestJoinedCard(){
    var list=V.roster.slice().sort(function(a,b){return b.joinedAt-a.joinedAt;}).slice(0,5);
    return '<div class="card"><div class="card-head"><h3>Latest to join</h3></div>'+(list.length?'<div class="feed">'+list.map(function(m){return '<div class="act">'+av(m.avatar,'')+'<div class="t"><b>'+esc(m.fullName)+'</b><small>@'+esc(m.username)+'</small></div><div class="a" style="color:var(--muted);font-weight:500">'+esc(U.fmtWhen(m.joinedAt))+'</div></div>';}).join('')+'</div>':'<p class="hint">Nobody has joined yet. Share the Susu link to get started.</p>')+'</div>';
  }
  function topSaversCard(){
    var st=S.settings,list=V.slots.filter(Boolean).map(function(m,i){var idx=V.slots.indexOf(m),paid=0;V.sched.forEach(function(r){if(r.contributors.indexOf(idx)>=0&&U.isPaid(r.r,m))paid+=st.base;});return {m:m,paid:U.round2(paid)};}).sort(function(a,b){return b.paid-a.paid;}).slice(0,5);
    var max=list.length?Math.max(list[0].paid,1):1;
    return '<div class="card"><div class="card-head"><h3>Top savers</h3></div>'+(list.length?'<div class="rank">'+list.map(function(x,i){return '<div class="rank-row">'+av(x.m.avatar,'s')+'<div class="rank-t"><b>'+esc(x.m.fullName)+'</b><div class="meter"><span style="width:'+Math.round(x.paid/max*100)+'%"></span></div></div><span class="num rank-v">'+esc(fmt(x.paid))+'</span></div>';}).join('')+'</div>':'<p class="hint">Payments will rank members here.</p>')+'</div>';
  }

  /* ---------- people ---------- */
  function renderPeople(){
    var root=$('ad-people-root'),st=S.settings;
    if(!st){root.innerHTML=needGroup();return;}
    var n=st.n,filled=Math.min(V.roster.length,n),pct=Math.round(filled/n*100),open=st.open!==false,full=V.roster.length>=n;
    function rmBtn(m){return '<button type="button" class="btn small" data-act="link" data-u="'+esc(m.uid)+'" title="Copy a sign-in link to send to this member">'+ic('copy')+'Link</button> <button type="button" class="btn small" data-act="pw" data-u="'+esc(m.uid)+'" title="Set a new password for this member">Password</button> <button type="button" class="btn small'+(rmConfirm===m.uid?' danger':'')+'" data-act="rm" data-u="'+esc(m.uid)+'">'+(rmConfirm===m.uid?'Tap again to remove':'Remove')+'</button>';}
    var rows=V.slots.map(function(m,i){
      if(!m)return '<div class="lrow pp"><span class="c-no">'+(i+1)+'</span><span class="c-who">'+ghost('')+'<span><b class="c-dim">Open place</b><small>Waiting for someone to join</small></span></span><span class="c-meta"></span><span class="c-act"></span></div>';
      return '<div class="lrow pp"><span class="c-no">'+(i+1)+'</span><span class="c-who">'+av(m.avatar,'')+'<span><b>'+esc(m.fullName)+'</b><small>@'+esc(m.username)+'</small></span></span><span class="c-meta c-dim">Joined '+esc(U.fmtDM(new Date(m.joinedAt)))+'</span><span class="c-act">'+rmBtn(m)+'</span></div>';
    }).join('');
    var ex=V.extra.length?'<h3 style="margin:22px 0 4px">No place yet</h3><p class="hint">The group size is smaller than the number of people who joined. Raise it on the Group page to give them a place.</p>'+V.extra.map(function(m){
      return '<div class="lrow pp"><span class="c-no">&ndash;</span><span class="c-who">'+av(m.avatar,'')+'<span><b>'+esc(m.fullName)+'</b><small>@'+esc(m.username)+'</small></span></span><span class="c-meta"></span><span class="c-act">'+rmBtn(m)+'</span></div>';
    }).join(''):'';
    var openCount=Math.max(0,n-V.roster.length),f=V.sched[0];
    root.innerHTML=
      '<div class="stack c5"><div class="tiles2">'+
        statTile('Joined','<b>'+V.roster.length+'</b>','people with an account')+
        statTile('Open places','<b>'+openCount+'</b>',openCount===1?'place waiting':'places waiting')+
        statTile('First collection',esc(U.fmtDM(f.date)),esc(U.rel(f.date)),'#admin-schedule')+
        statTile('Each round','<b>'+esc(fmt(f.pot))+'</b>',esc(U.intervalText(st)),'#admin-payments')+
      '</div></div>'+
      '<div class="card hero c7"><div class="card-head" style="margin-bottom:0"><div><p class="eyebrow">Places filled</p><p class="hero-h"><b>'+filled+'</b> of '+n+' people have joined</p></div>'+
        '<button type="button" class="btn small" data-act="open">'+(open?'Close sign-ups':'Open sign-ups')+'</button></div>'+
        ticks(pct)+'<div class="scale"><span>'+(full?'The group is full. ':'')+(open?'Sign-ups are open.':'Sign-ups are closed.')+'</span><span>'+pct+'%</span></div></div>'+
      '<div class="card c8"><div class="card-head"><h3>Members in collection order</h3>'+(V.roster.length>=2?'<button type="button" class="btn small'+(shuffleConfirm?' danger':'')+'" data-act="shuffle">'+ic('swap')+(shuffleConfirm?'Tap again to draw a new order':'Shuffle the order')+'</button>':'')+'</div><div>'+
        '<div class="lhead pp"><span>No.</span><span>Member</span><span>Joined</span><span></span></div>'+rows+ex+
        '<p class="hint" style="margin-top:14px">'+(V.roster.some(function(m){return m.slot!==null;})?'This order was drawn at random. Anyone who joins later goes to the end.':'People collect in the order they joined. Shuffle to draw the order at random instead.')+' You can shuffle until the first pot is handed over.</p></div></div>'+
      '<div class="stack c4"><div class="card"><div class="card-head"><h3>Join code</h3></div><div class="code-box"><b id="join-code">'+esc(S.code)+'</b><button type="button" class="btn small" data-act="copycode">'+ic('copy')+'Copy</button></div><p class="hint" style="margin-top:10px">Members type this code on the login page to join or sign in. Share it with the link to this site.</p><p class="status" id="code-status" aria-live="polite"></p></div>'+latestJoinedCard()+'<div class="card"><h3>How people join</h3><ol class="how"><li>Send each member the link to this site and the join code above.</li><li>They choose Member, type the code, and create an account with their name, a username, a password and an icon. If that is hard for someone, create the account for them, then tap <b>Link</b> next to their name and send them that link: tapping it signs them in with no typing.</li><li>They get the next free number. You do not type any names, and number 1 collects first.</li></ol></div></div>'+
      '<div class="c7">'+settingsCard()+'</div><div class="c5">'+upcomingCard()+'</div>';
  }
  on($('ad-people-root'),'click',async function(e){
    var b=e.target.closest('button');if(!b)return;
    var act=b.dataset.act;
    if(act==='open'){await U.toggleOpen();}
    else if(act==='shuffle'){
      if(!shuffleConfirm){shuffleConfirm=true;clearTimeout(timers.sh);timers.sh=setTimeout(function(){shuffleConfirm=false;render();},4000);render();return;}
      shuffleConfirm=false;clearTimeout(timers.sh);
      var smsg=await U.shuffle();
      U.toast(smsg||'New order drawn. Number 1 collects first.');
    }
    else if(act==='copycode'){
      var code=S.code;
      try{await navigator.clipboard.writeText(code);U.say('code-status','Copied.',3000);}catch(ex){U.say('code-status','Select the code and copy it.',4000);}
    }
    else if(act==='link'){
      var lm=S.membersAll.filter(function(x){return x.uid===b.dataset.u;})[0];
      var lk=await U.memberLink(b.dataset.u);
      if(lk.error){U.toast(lk.error);return;}
      try{await navigator.clipboard.writeText(lk.url);U.toast('Link copied. Send it to '+U.firstName(lm)+' on WhatsApp. Tapping it signs them in, no password needed.');}
      catch(ex){window.prompt('Copy this sign-in link and send it to '+lm.fullName+':',lk.url);}
    }
    else if(act==='pw'){
      var m=S.membersAll.filter(function(x){return x.uid===b.dataset.u;})[0];
      var pw=window.prompt('New password for '+(m?m.fullName:'this member')+' (at least 6 characters). Tell them to change it after signing in.');
      if(pw===null)return;
      var msg=await U.resetMemberPassword(b.dataset.u,pw);
      U.toast(msg||'Password changed for '+(m?m.fullName:'the member')+'.');
    }
    else if(act==='rm'){
      var u=b.dataset.u;
      if(rmConfirm!==u){rmConfirm=u;clearTimeout(timers.rm);timers.rm=setTimeout(function(){rmConfirm='';render();},4000);render();return;}
      rmConfirm='';clearTimeout(timers.rm);
      var rmsg=await U.removeMember(u);
      if(rmsg)U.toast(rmsg);
      render();
    }
  });

  /* ---------- schedule ---------- */
  function renderSchedule(){
    var root=$('ad-sched-root'),st=S.settings;
    if(!st){root.innerHTML=needGroup();return;}
    var rd=V.sched[V.focusIdx],m=V.slots[rd.member],last=V.sched[V.sched.length-1];
    var pct=Math.round(rd.turn/st.n*100);
    var rows=V.sched.map(function(r){
      var mm=V.slots[r.member],s=U.roundStatus(r);
      return '<div class="lrow sc'+(r.r===V.nextIdx?' is-next':'')+'"><span class="c-meta"><span>Round '+(r.r+1)+'</span><span class="c-dim c-date">'+ic('cal')+esc(U.fmtShort(r.date))+' '+r.date.getFullYear()+'</span></span>'+
        '<span class="c-who">'+(mm?av(mm.avatar,'s'):ghost('s'))+'<span><b'+(mm?'':' class="c-dim"')+'>'+esc(U.slotName(r.member))+'</b><small>Number '+(r.member+1)+(st.cycles>1?' \u00b7 time round '+r.cycle:'')+'</small></span></span>'+
        '<span class="c-amt num">'+esc(fmt(r.net))+'</span><span class="c-st"><span class="'+s[1]+'">'+s[0]+'</span></span></div>';
    }).join('');
    root.innerHTML=
      '<div class="card hero c8"><p class="eyebrow">'+(V.nextIdx>=0?'Next collection':'Last collection')+'</p>'+
      '<div class="who-big">'+(m?av(m.avatar,'l'):ghost('l'))+'<div style="min-width:0"><p class="hero-h" style="margin:0"><b>'+esc(U.slotName(rd.member))+'</b> collects '+esc(fmt(rd.net))+'</p><p class="muted" style="margin-top:4px">'+esc(U.fmtDate(rd.date))+' \u00b7 '+U.rel(rd.date)+'</p></div></div>'+
      ticks(pct)+'<div class="scale"><span>Turn '+(rd.turn+1)+' of '+st.n+'</span><span>Time round '+rd.cycle+' of '+st.cycles+'</span></div></div>'+
      '<div class="stack c4">'+statTile('Each round','<b>'+esc(fmt(rd.pot))+'</b>',st.n+' people, '+esc(U.intervalText(st)))+
        statTile('Finishes',esc(U.fmtDM(last.date)),esc(U.fmtDate(last.date)))+'</div>'+
      '<div class="c4">'+cycleCard()+'</div><div class="c4">'+upcomingCard()+'</div><div class="c4">'+lateCard()+'</div>'+
      '<div class="card c12"><div class="card-head"><h3>All rounds</h3><button type="button" class="btn small primary" id="copy">'+ic('copy')+'Copy schedule to share</button></div>'+
      '<p class="status" id="status" role="status"></p><textarea id="copybox" class="copybox" hidden readonly aria-label="Schedule text"></textarea>'+
      '<div class="lhead sc"><span>Round</span><span>Collector</span><span>Amount</span><span>Status</span></div>'+rows+'</div>';
  }
  on(root,'click',function(e){if(e.target.closest('#copy'))U.copySchedule('status','copybox');});

  /* ---------- payments dashboard ---------- */
  function barsChart(){
    var st=S.settings,from=Math.max(0,Math.min(viewRound-5,V.sched.length-10)),list=V.sched.slice(from,from+10);
    return '<div class="bars" role="img" aria-label="Share of each round paid in, rounds '+(from+1)+' to '+(from+list.length)+'">'+list.map(function(r){
      var s=U.roundStats(r),p=U.pctOf(r,s);
      return '<div class="bar'+(r.r===viewRound?' cur':'')+(S.outMap[r.r]?' done':'')+'" title="Round '+(r.r+1)+': '+p+'% paid in"><span class="track"><span class="fill" style="height:'+Math.max(p,4)+'%"></span></span><small>R'+(r.r+1)+'</small></div>';
    }).join('')+'</div>';
  }
  function gauge(ot){
    var p=ot?ot.pct:0;
    return '<div class="gauge"><svg viewBox="0 0 200 112" aria-hidden="true"><defs><linearGradient id="ad-gauge-g" x1="0" x2="1"><stop offset="0" class="g0"/><stop offset="1" class="g1"/></linearGradient></defs>'+
      '<path class="g-track" d="M18 100 A82 82 0 0 1 182 100" pathLength="100"/>'+
      (p>0?'<path class="g-fill" d="M18 100 A82 82 0 0 1 182 100" pathLength="100" stroke-dasharray="'+p+' 100"/>':'')+
      '</svg><p class="gauge-v num">'+(ot?ot.pct+'%':'&ndash;')+'</p></div>';
  }
  function donut(t){
    var held=Math.max(0,U.round2(t.saved-t.out)),toCome=Math.max(0,U.round2(t.planned-t.saved)),tot=t.out+held+toCome;
    var parts=[['Paid out',t.out,'d-out'],['Held for collectors',held,'d-held'],['Still to come',toCome,'d-come']],acc=0,segs='';
    if(tot>0)parts.forEach(function(p){
      var v=p[1]/tot*100;if(v<=0)return;
      segs+='<circle class="'+p[2]+'" cx="60" cy="60" r="46" pathLength="100" stroke-dasharray="'+v.toFixed(2)+' '+(100-v).toFixed(2)+'" stroke-dashoffset="'+(-acc).toFixed(2)+'"/>';
      acc+=v;
    });
    return '<div class="donut"><div class="donut-fig"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="d-base" cx="60" cy="60" r="46"/>'+segs+'</svg><div class="donut-mid"><b class="num">'+esc(fmt(t.planned))+'</b><span>planned in total</span></div></div>'+
      '<ul class="legend">'+parts.map(function(p){return '<li><i class="'+p[2]+'"></i><span>'+p[0]+'</span><b class="num">'+esc(fmt(p[1]))+'</b></li>';}).join('')+'</ul></div>';
  }
  function txRows(){
    var ev=U.activity(false);
    if(!ev.length)return '<p class="hint" style="padding:14px 4px">Nothing yet. Payments appear here as you mark them.</p>';
    return ev.map(function(x){
      var dep=x.type==='dep';
      return '<div class="lrow tx"><span class="c-date">'+ic('cal')+esc(U.fmtWhen(x.t))+'</span>'+
        '<span class="c-st"><span class="pill '+(dep?'ok':'accent')+'">'+(dep?'Cash in':'Cash out')+'</span></span>'+
        '<span class="c-who">'+av(x.m.avatar,'s')+'<span><b>'+esc(x.m.fullName)+'</b><small>Round '+(x.rd.r+1)+(U.byName(x.by)?' \u00b7 recorded by '+esc(U.byName(x.by)):'')+'</small></span></span>'+
        '<span class="c-amt num">'+(dep?'+ ':'&minus; ')+esc(fmt(x.amt))+'</span></div>';
    }).join('');
  }
  function memberTotals(){
    var st=S.settings;
    var rows=V.slots.map(function(m,i){
      if(!m)return '<div class="lrow tt"><span class="c-who">'+ghost('s')+'<span><b class="c-dim">Open place '+(i+1)+'</b></span></span><span class="c-amt c-dim">&ndash;</span><span class="c-amt c-dim">&ndash;</span></div>';
      var paid=0,rec=0;
      V.sched.forEach(function(rd){
        if(rd.contributors.indexOf(i)>=0&&U.isPaid(rd.r,m))paid+=st.base;
        if(rd.member===i&&S.outMap[rd.r])rec+=rd.net;
      });
      return '<div class="lrow tt"><span class="c-who">'+av(m.avatar,'s')+'<span><b>'+esc(m.fullName)+'</b></span></span><span class="c-amt num">'+esc(fmt(U.round2(paid)))+'</span><span class="c-amt num">'+esc(fmt(U.round2(rec)))+'</span></div>';
    }).join('');
    return '<div class="lhead tt"><span>Person</span><span>Paid in</span><span>Received</span></div>'+rows;
  }
  function renderPay(){
    var root=$('ad-pay-root'),st=S.settings;
    if(!st){root.innerHTML=needGroup();return;}
    if(viewRound>=V.sched.length)viewRound=V.focusIdx;
    var rd=V.sched[viewRound],s=U.roundStats(rd),pct=U.pctOf(rd,s),col=V.slots[rd.member],t=U.groupTotals(),ot=U.onTimeRate();
    var tpct=t.planned>0?Math.round(t.saved/t.planned*100):0;
    var opts=V.sched.map(function(r){return '<option value="'+r.r+'"'+(r.r===viewRound?' selected':'')+'>Round '+(r.r+1)+' \u00b7 '+esc(U.fmtShort(r.date))+' \u00b7 '+esc(U.slotName(r.member))+'</option>';}).join('');
    var pending=rd.contributors.map(function(i){return V.slots[i];}).filter(function(m){return m&&!U.isPaid(rd.r,m);});
    root.innerHTML=
      '<div class="stack c5">'+
        '<div class="tiles2">'+
          statTile('Saved so far','<b>'+esc(fmt(t.saved))+'</b>',tpct+'% of '+esc(fmt(t.planned)))+
          statTile('Paid out','<b>'+esc(fmt(t.out))+'</b>','to collectors so far')+
          statTile('This round','<b>'+esc(fmt(s.got))+'</b>','of '+esc(fmt(rd.pot))+' in')+
          statTile('Still to pay','<b>'+pending.length+'</b> '+(pending.length===1?'person':'people'),esc(fmt(U.round2(rd.pot-s.got)))+' to come in')+
        '</div>'+
        '<div class="card"><div class="card-head"><h3>Round by round</h3><span class="hint">% paid in</span></div>'+barsChart()+'</div>'+
      '</div>'+
      '<div class="card c7">'+
        '<div class="rnav"><button type="button" class="round-btn" data-act="prev" aria-label="Earlier round"'+(viewRound===0?' disabled':'')+'>'+ic('left')+'</button><select id="rsel" aria-label="Choose a round">'+opts+'</select><button type="button" class="round-btn" data-act="nextr" aria-label="Later round"'+(viewRound===V.sched.length-1?' disabled':'')+'>'+ic('right')+'</button></div>'+
        '<div class="who-big">'+(col?av(col.avatar,'l'):ghost('l'))+'<div style="min-width:0"><p class="eyebrow">Round '+(rd.r+1)+' of '+V.sched.length+' \u00b7 '+esc(U.fmtDate(rd.date))+'</p><p class="hero-h" style="margin-top:4px"><b>'+esc(U.slotName(rd.member))+'</b> collects '+esc(fmt(rd.net))+'</p></div>'+
          '<span class="pill '+(S.outMap[rd.r]?'ok':'')+'" style="margin-left:auto">'+(S.outMap[rd.r]?'Money received':'Not collected yet')+'</span></div>'+
        '<div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+pct+'" aria-label="Paid in this round" style="margin-top:18px"><span style="width:'+pct+'%"></span></div>'+
        '<p class="prog"><span>'+s.pc+' of '+s.need+' paid</span><span>'+esc(fmt(s.got))+' of '+esc(fmt(rd.pot))+'</span></p>'+
        '<h3 style="margin:20px 0 10px">Who has paid</h3>'+U.tilesHTML(rd,'admin')+U.actionsHTML(rd,'admin')+
      '</div>'+
      '<div class="card c8"><div class="card-head"><h3>Recent transactions</h3></div><div class="lhead tx"><span>Date</span><span>Type</span><span>Member</span><span>Amount</span></div>'+txRows()+'</div>'+
      '<div class="card c4"><div class="card-head"><h3>Paid on time</h3></div>'+gauge(ot)+'<p class="hint" style="text-align:center">'+(ot?ot.paid+' of '+ot.due+' payments due so far':'No payments are due yet')+'</p></div>'+
      '<div class="card c7"><div class="card-head"><h3>Everyone\u2019s totals</h3></div>'+memberTotals()+'</div>'+
      '<div class="card c5"><div class="card-head"><h3>Where the money is</h3></div>'+donut(t)+'</div>'+
      '<div class="c4">'+lateCard()+'</div><div class="c4">'+topSaversCard()+'</div><div class="c4">'+cycleCard()+'</div>';
  }
  on($('ad-pay-root'),'click',function(e){
    if(U.handleTrack(e,'admin'))return;
    var b=e.target.closest('button[data-act]');if(!b)return;
    if(b.dataset.act==='prev'){viewRound=Math.max(0,viewRound-1);render();}
    else if(b.dataset.act==='nextr'){viewRound=Math.min(V.sched.length-1,viewRound+1);render();}
  });
  on($('ad-pay-root'),'change',function(e){if(e.target.id==='rsel'){viewRound=+e.target.value;render();}});

  /* ---------- wiring ---------- */
  on(window,'hashchange',function(){if(U.appFor(location.hash)==='admin'||U.entry==='admin')render();});
  on(root,'click',function(e){if(e.target.closest('[data-act="signout"]'))U.signout();else if(e.target.closest('[data-act="retry"]'))location.reload();});
  offs.push(U.onChange(render));
  U.boot();
  render();

  return function unmount(){
    live=false;
    offs.forEach(function(f){f();});
    Object.keys(timers).forEach(function(k){clearTimeout(timers[k]);});
    document.body.classList.remove('app-admin');
    root.innerHTML='';
  };
}
window.SusuAdmin={mount:mount};
})();
