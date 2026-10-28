/* Susu login: one door for everyone. Sign in as a member or as the admin;
   the role you sign in with decides which app opens. New members join from here. */
(function(){
'use strict';
var U=window.Susu,S=U.state,V=U.v,$=U.$,esc=U.esc,ic=U.ic,av=U.av;

var JAR='<svg class="jar" viewBox="0 0 220 170" aria-hidden="true">'+
  '<path class="ln" d="M70 52h80M76 52c-14 12-22 30-22 52 0 30 18 48 56 48s56-18 56-48c0-22-8-40-22-52"/>'+
  '<path class="ln" d="M66 40h88v12H66z"/>'+
  '<ellipse class="cn" cx="96" cy="118" rx="15" ry="10" transform="rotate(-18 96 118)"/><ellipse class="cn" cx="126" cy="126" rx="15" ry="10" transform="rotate(14 126 126)"/><ellipse class="cn" cx="112" cy="100" rx="15" ry="10" transform="rotate(-6 112 100)"/>'+
  '<ellipse class="cn" cx="110" cy="18" rx="12" ry="8" transform="rotate(-24 110 18)"/><ellipse class="cn" cx="150" cy="26" rx="9" ry="6" transform="rotate(30 150 26)"/><ellipse class="cn" cx="74" cy="24" rx="9" ry="6" transform="rotate(-36 74 24)"/>'+
  '<path class="ln thin" d="M98 118l-4-2M128 126l-4 1M114 100l-4-1M112 18l-4 1"/>'+
  '<path class="ln thin" d="M40 70c-6-6-6-14 0-20M180 70c6-6 6-14 0-20"/>'+
'</svg>';

var SHELL=
'<div class="lg">'+
  '<aside class="lg-side">'+
    '<div class="lg-brand"><span class="lg-logo" aria-hidden="true">'+U.RING+'</span><span>Susu</span></div>'+
    '<div class="lg-art">'+JAR+'</div>'+
    '<div class="lg-copy"><h1 id="lg-group">Save together, collect in turn.</h1><p id="lg-desc">Members sign in to see their turn and payments. The admin signs in to run the group.</p></div>'+
    '<div class="kente" aria-hidden="true"></div>'+
  '</aside>'+
  '<main class="lg-main"><div class="lg-card">'+
    '<div class="role" role="tablist" aria-label="Sign in as">'+
      '<button type="button" role="tab" id="tab-member" data-role="member" aria-selected="true">'+ic('people')+'Member</button>'+
      '<button type="button" role="tab" id="tab-admin" data-role="admin" aria-selected="false">'+ic('group')+'Admin</button>'+
    '</div>'+
    '<div class="lg-wait" id="lg-wait"><h2 tabindex="-1" id="wait-h">Opening your group</h2><p class="sub" id="wait-p">One moment.</p></div>'+

    /* member: sign in */
    '<form id="f-signin" autocomplete="off" novalidate hidden>'+
      '<h2 tabindex="-1" id="si-h">Sign in as a member</h2><p class="sub">Your group\u2019s join code, then the username and password you made when you joined.</p>'+
      '<input id="si-code" class="code-in" type="text" maxlength="8" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="Join code" aria-label="Group join code">'+
      '<input id="si-user" type="text" maxlength="20" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" placeholder="Username" aria-label="Username">'+
      '<div class="pwrow"><input id="si-pw" type="password" autocomplete="current-password" placeholder="Password" aria-label="Password"><button type="button" class="btn small" data-show="si-pw">Show</button></div>'+
      '<p class="err" id="si-err" role="alert"></p>'+
      '<button type="submit" class="btn primary wide big" id="si-btn">Sign in</button>'+
      '<p class="hint center">Forgot your password? Ask the admin to set a new one for you.</p>'+
      '<p class="center" id="si-new"><button type="button" class="linkbtn" data-act="to-signup">New here? Join your group</button></p>'+
    '</form>'+

    /* member: join wizard */
    '<div id="wiz" hidden>'+
      '<div class="note-card" id="auth-note" hidden></div>'+
      '<div id="wiz-body">'+
        '<div class="wz-top"><button type="button" class="back" id="wz-back" aria-label="Back" hidden>'+ic('left')+'</button><div class="wz-prog" id="wz-prog" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div><span class="wz-count" id="wz-count">1/5</span></div>'+
        '<p class="wz-step" id="wz-step">Step 1 of 5</p>'+
        '<form id="f-signup" autocomplete="off" novalidate>'+
          '<div class="wz" data-step="0"><h2 tabindex="-1">What is your group\u2019s join code?</h2><p class="sub">The admin shares a 6-character code with everyone in the group.</p><input id="su-code" class="code-in" type="text" maxlength="8" autocapitalize="characters" autocorrect="off" spellcheck="false" placeholder="For example, K7PM2X" aria-label="Join code"><p class="hint" id="su-code-hint" style="margin-top:8px"></p></div>'+
          '<div class="wz" data-step="1" hidden><h2 tabindex="-1">What is your full name?</h2><p class="sub">This is how the group will see you.</p><input id="su-name" type="text" maxlength="60" autocomplete="name" placeholder="For example, Ama Mensah" aria-label="Your full name"></div>'+
          '<div class="wz" data-step="2" hidden><h2 tabindex="-1">Pick a username</h2><p class="sub">Nobody else in the group can have the same one.</p><input id="su-user" type="text" maxlength="20" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="For example, ama_m" aria-label="Username"><p class="hint" id="su-user-hint" style="margin-top:8px">3 to 20 letters or numbers.</p></div>'+
          '<div class="wz" data-step="3" hidden><h2 tabindex="-1">Create a password</h2><p class="sub">At least 6 characters. Only you know it.</p><div class="pwrow"><input id="su-pw" type="password" autocomplete="new-password" aria-label="Password"><button type="button" class="btn small" data-show="su-pw">Show</button></div></div>'+
          '<div class="wz" data-step="4" hidden><h2 tabindex="-1">Choose your icon</h2><p class="sub">It shows next to your name for the whole group.</p>'+
            '<div class="av-prev" id="av-prev"><span class="ghost xl"></span></div>'+
            '<fieldset><legend class="sr">Profile icon</legend><div class="picker" id="picker" role="radiogroup" aria-label="Profile icon"></div></fieldset></div>'+
          '<p class="hint" id="su-share" style="margin-top:14px" hidden>Your name, username and icon are shared with the admin and the group. Your password stays private.</p>'+
          '<p class="err" id="su-err" role="alert"></p>'+
          '<button type="submit" class="btn primary wide big" id="su-btn">Continue</button>'+
        '</form>'+
      '</div>'+
      '<p class="center"><button type="button" class="linkbtn" data-act="to-signin">I already have an account</button></p>'+
    '</div>'+

    /* admin: sign in */
    '<form id="f-admin" autocomplete="off" novalidate hidden>'+
      '<h2 tabindex="-1" id="ad-h">Sign in as admin</h2><p class="sub">For the person who runs a group.</p>'+
      '<input id="ad-user" type="text" maxlength="20" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" placeholder="Admin username" aria-label="Admin username">'+
      '<div class="pwrow"><input id="ad-pw" type="password" autocomplete="current-password" placeholder="Password" aria-label="Password"><button type="button" class="btn small" data-show="ad-pw">Show</button></div>'+
      '<p class="err" id="ad-err" role="alert"></p>'+
      '<button type="submit" class="btn primary wide big" id="ad-btn">Sign in as admin</button>'+
      '<p class="center"><button type="button" class="linkbtn" data-act="to-create">Starting a new group? Create the admin account</button></p>'+
    '</form>'+

    /* admin: start a new group */
    '<form id="f-create" autocomplete="off" novalidate hidden>'+
      '<h2 tabindex="-1" id="cr-h">Start a new group</h2><p class="sub">You become the admin. You will get a join code to share with members.</p>'+
      '<input id="cr-group" type="text" maxlength="60" placeholder="Group name (optional, you can change it later)" aria-label="Group name">'+
      '<input id="cr-user" type="text" maxlength="20" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username" placeholder="Admin username" aria-label="Admin username">'+
      '<div class="pwrow"><input id="cr-pw" type="password" autocomplete="new-password" placeholder="Password (at least 8 characters)" aria-label="Password"><button type="button" class="btn small" data-show="cr-pw">Show</button></div>'+
      '<div class="pwrow"><input id="cr-pw2" type="password" autocomplete="new-password" placeholder="Type the password again" aria-label="Type the password again"></div>'+
      '<p class="err" id="cr-err" role="alert"></p>'+
      '<button type="submit" class="btn primary wide big" id="cr-btn">Create my group</button>'+
      '<p class="center"><button type="button" class="linkbtn" data-act="to-admin">I already have an admin account</button></p>'+
    '</form>'+
  '</div></main>'+
'</div>';

function mount(root){
  var live=true,offs=[],role='member',mode='signin',suStep=0,avatarSel=-1,shownSig='',found=null,STEPS=5;
  function on(el,ev,fn,opt){el.addEventListener(ev,fn,opt);offs.push(function(){el.removeEventListener(ev,fn,opt);});}
  document.body.classList.add('app-login');
  root.innerHTML=SHELL;
  $('picker').innerHTML=U.pickerHTML();
  try{var saved=sessionStorage.getItem('susu-login-role');if(saved==='admin')role='admin';var sc=sessionStorage.getItem('susu-login-code');if(sc){$('si-code').value=sc;$('su-code').value=sc;}}catch(e){}

  function wait(h,p,a){$('wait-h').textContent=h;$('wait-p').innerHTML=esc(p)+(a||'');}
  function render(){
    if(!live)return;
    $('lg-group').textContent=found&&found.name?found.name:'Save together, collect in turn.';
    $('lg-desc').textContent=found&&found.desc?found.desc:'Members sign in to see their turn and payments. The admin signs in to run the group.';
    document.body.classList.toggle('as-admin',role==='admin');
    $('tab-member').setAttribute('aria-selected',String(role==='member'));
    $('tab-admin').setAttribute('aria-selected',String(role==='admin'));
    var show='';
    if(S.fatal){wait('We could not open Susu',S.fatal,'<p style="margin-top:14px"><button type="button" class="btn" data-act="reload">Try again</button></p>');show='wait';}
    else if(!S.ready){wait('Opening Susu','One moment.');show='wait';}
    else if(role==='member')show=mode==='signup'?'wiz':'signin';
    else show=mode==='create'?'create':'admin';
    $('lg-wait').hidden=show!=='wait';
    $('f-signin').hidden=show!=='signin';
    $('wiz').hidden=show!=='wiz';
    $('f-admin').hidden=show!=='admin';
    $('f-create').hidden=show!=='create';
    var sig=role+'|'+show;
    var entering=sig!==shownSig;shownSig=sig;
    if(show==='wiz'&&entering)showStep();
    if(entering&&show!=='wait'){var h=root.querySelector('#f-'+(show==='wiz'?'signup':show)+' h2:not([hidden])');if(h&&!first)h.focus({preventScroll:true});}
    first=false;
  }
  var first=true;

  /* ---------- role tabs and links ---------- */
  on(root,'click',function(e){
    var t=e.target.closest('[data-role]');
    if(t){role=t.dataset.role;try{sessionStorage.setItem('susu-login-role',role);}catch(x){}render();return;}
    var b=e.target.closest('[data-act]');
    if(b){
      var a=b.dataset.act;
      if(a==='reload')location.reload();
      else if(a==='to-signup'){mode='signup';suStep=0;$('su-code').value=$('si-code').value||$('su-code').value;render();}
      else if(a==='to-signin'){mode='signin';render();}
      else if(a==='to-create'){mode='create';render();}
      else if(a==='to-admin'){mode='signin';render();}
      return;
    }
    var s=e.target.closest('[data-show]');
    if(s){var inp=$(s.dataset.show),sh=inp.type==='password';inp.type=sh?'text':'password';s.textContent=sh?'Hide':'Show';}
  });
  on($('tab-member').parentNode,'keydown',function(e){
    if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
    role=role==='admin'?'member':'admin';render();$('tab-'+role).focus();
  });
  function normCode(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);}
  function remember(code){try{sessionStorage.setItem('susu-login-code',code);}catch(e){}}

  /* ---------- member sign in ---------- */
  on($('f-signin'),'submit',async function(e){
    e.preventDefault();
    var err=$('si-err'),btn=$('si-btn');err.textContent='';
    var code=normCode($('si-code').value),u=U.normUser($('si-user').value),pw=$('si-pw').value;
    if(code.length<6){err.textContent='Type your group\u2019s join code.';$('si-code').focus();return;}
    if(!u||!pw){err.textContent='Type your username and password.';return;}
    btn.disabled=true;btn.textContent='Signing in\u2026';
    var msg=await U.signin(code,u,pw);
    if(!live)return;
    btn.disabled=false;btn.textContent='Sign in';
    if(msg){err.textContent=msg;return;}
    remember(code);$('si-pw').value='';
    location.replace(U.link('user','home'));
  });

  /* ---------- member join wizard ---------- */
  function showStep(){
    var wz=root.querySelectorAll('.wz');
    for(var i=0;i<wz.length;i++)wz[i].hidden=+wz[i].dataset.step!==suStep;
    var segs=$('wz-prog').children;
    for(var j=0;j<segs.length;j++)segs[j].className=j<=suStep?'on':'';
    $('wz-step').textContent='Step '+(suStep+1)+' of '+STEPS;
    $('wz-count').textContent=(suStep+1)+'/'+STEPS;
    $('su-btn').textContent=suStep===STEPS-1?'Join the group':'Continue';
    $('wz-back').hidden=suStep===0;
    $('su-share').hidden=suStep!==STEPS-1;
    $('su-err').textContent='';
  }
  function goStep(n){
    suStep=n;showStep();
    var inp=root.querySelector('.wz:not([hidden]) input[type=text],.wz:not([hidden]) input[type=password]');
    var h=root.querySelector('.wz:not([hidden]) h2');
    (inp||h).focus({preventScroll:true});
  }
  on($('wz-back'),'click',function(){if(suStep>0)goStep(suStep-1);});
  on($('picker'),'change',function(e){avatarSel=+e.target.value;$('av-prev').innerHTML=av(avatarSel,'xl');});
  var codeTimer=null,codeSeq=0;
  on($('su-code'),'input',function(){
    var code=normCode($('su-code').value),hint=$('su-code-hint');
    clearTimeout(codeTimer);hint.className='hint';found=null;render();
    if(code.length<6){hint.textContent='';return;}
    hint.textContent='Looking for your group\u2026';
    var seq=++codeSeq;
    codeTimer=setTimeout(async function(){
      var g=await U.groupLookup(code);
      if(seq!==codeSeq||!live)return;
      if(g.error){hint.className='bad';hint.textContent=g.error;return;}
      found=g;render();
      hint.className='good';hint.textContent='Found '+(g.name||'your group')+(g.ready?' \u00b7 '+g.joined+' of '+g.n+' joined':' (the admin is still setting it up)');
    },400);
  });
  var unameTimer=null,unameSeq=0;
  on($('su-user'),'input',function(){
    var u=U.normUser($('su-user').value),hint=$('su-user-hint');
    clearTimeout(unameTimer);hint.className='hint';
    if(!u){hint.textContent='3 to 20 letters or numbers.';return;}
    if(!U.validUser(u)){hint.className='bad';hint.textContent='Use 3 to 20 letters, numbers, dots, dashes or underscores. Start with a letter or number.';return;}
    hint.textContent='Checking\u2026';
    var seq=++unameSeq;
    unameTimer=setTimeout(async function(){
      var s=await U.usernameState(normCode($('su-code').value),u);
      if(seq!==unameSeq||!live)return;
      if(!s){hint.className='hint';hint.textContent='';return;}
      hint.className=s==='taken'?'bad':'good';
      hint.textContent=s==='taken'?'That username is taken. Try another.':'That username is free.';
    },450);
  });
  offs.push(function(){clearTimeout(unameTimer);clearTimeout(codeTimer);});
  on($('f-signup'),'submit',async function(e){
    e.preventDefault();
    var err=$('su-err'),btn=$('su-btn');err.textContent='';
    var code=normCode($('su-code').value),full=$('su-name').value.trim().replace(/\s+/g,' ');
    var u=U.normUser($('su-user').value),pw=$('su-pw').value;
    if(suStep===0){
      if(code.length<6){err.textContent='Type the 6-character join code.';return;}
      btn.disabled=true;var g=await U.groupLookup(code);btn.disabled=false;if(!live)return;
      if(g.error){err.textContent=g.error;return;}
      if(!g.ready){err.textContent='The admin has not finished setting up this group yet. Try again soon.';return;}
      if(g.full){err.textContent='This group is full. All '+g.n+' places are taken.';return;}
      if(!g.open){err.textContent='Sign-ups for this group are closed. Ask the admin to open them.';return;}
      found=g;remember(code);render();goStep(1);return;
    }
    if(suStep===1){if(full.length<2){err.textContent='Type your full name.';return;}goStep(2);return;}
    if(suStep===2){
      if(!U.validUser(u)){err.textContent='Choose a username with 3 to 20 letters or numbers.';return;}
      btn.disabled=true;var s=await U.usernameState(code,u);btn.disabled=false;
      if(s==='taken'){err.textContent='That username is taken. Try another.';return;}
      goStep(3);return;
    }
    if(suStep===3){if(pw.length<6){err.textContent='Your password needs at least 6 characters.';return;}goStep(4);return;}
    if(avatarSel<0){err.textContent='Pick an icon.';return;}
    btn.disabled=true;btn.textContent='Joining\u2026';
    var msg=await U.signup(code,full,u,pw,avatarSel);
    if(!live)return;
    btn.disabled=false;btn.textContent='Join the group';
    if(msg){err.textContent=msg;return;}
    $('su-pw').value='';
    location.replace(U.link('user','home'));
  });

  /* ---------- admin ---------- */
  on($('f-admin'),'submit',async function(e){
    e.preventDefault();
    var err=$('ad-err'),btn=$('ad-btn');err.textContent='';
    var u=U.normUser($('ad-user').value),pw=$('ad-pw').value;
    if(!u||!pw){err.textContent='Type the admin username and password.';return;}
    btn.disabled=true;btn.textContent='Signing in\u2026';
    var msg=await U.adminSignin(u,pw);
    if(!live)return;
    btn.disabled=false;btn.textContent='Sign in as admin';
    if(msg){err.textContent=msg;return;}
    $('ad-pw').value='';
    location.replace(U.link('admin',''));
  });
  on($('f-create'),'submit',async function(e){
    e.preventDefault();
    var err=$('cr-err'),btn=$('cr-btn');err.textContent='';
    var u=U.normUser($('cr-user').value),pw=$('cr-pw').value,name=$('cr-group').value.trim();
    if(!U.validUser(u)){err.textContent='Use 3 to 20 letters, numbers, dots, dashes or underscores for the username.';return;}
    if(pw.length<8){err.textContent='The admin password needs at least 8 characters.';return;}
    if(pw!==$('cr-pw2').value){err.textContent='The two passwords do not match.';return;}
    btn.disabled=true;btn.textContent='Creating\u2026';
    var msg=await U.adminCreate(u,pw,name);
    if(!live)return;
    btn.disabled=false;btn.textContent='Create my group';
    if(msg){err.textContent=msg;return;}
    $('cr-pw').value='';$('cr-pw2').value='';
    location.replace(U.link('admin','group'));
  });

  offs.push(U.onChange(render));
  U.boot();
  render();
  return function unmount(){
    live=false;
    offs.forEach(function(f){f();});
    document.body.classList.remove('app-login','as-admin');
    root.innerHTML='';
  };
}
window.SusuLogin={mount:mount};
})();
