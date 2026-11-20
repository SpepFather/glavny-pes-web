
/* ==== МУЛЬТИПЛЕЕР (клиент) ==== */
/* ================================================================
   МУЛЬТИПЛЕЕР «ГЛАВНЫЙ ПЁС» — клиент (3 пса, WSS-комнаты)
   Сервер — авторитет (тик 20 Гц). Свой пёс — локальное
   предсказание, чужие — сглаживание снапшотов.
================================================================ */
const MP={
  BASE:IS_DISCORD?('wss://'+location.host):'wss://glavny-pes.glavny-pes.workers.dev',
  active:false,inGame:false,ws:null,seat:-1,code:'',isHost:false,
  map:'yards',diff:'normal',players:[],
  grid:null,counts:null,freeCells:1,myPct:0,
  remotes:[],snapS:null,
  myInp:{ax:0,ay:0,p:0,b:0},inTimer:null,
  npcT:{r:null,b:null,c:null},
  boardT:0,stunT:0,brawlFx:null,
  COL:{1:'#EFC94C',2:'#7EC4E8',3:'#E88A6A',4:'#93A5BD',5:'#B08A5A'},
  SEATPAL:[null,'#EFC94C','#7EC4E8','#E88A6A'],
  L:{
    ru:{t1:'ГЛАВНЫЙ ПЁС ДВОРА!',t2:'победа!',place:m=>m===1?'1-Е МЕСТО':m===2?'2-Е МЕСТО':'3-Е МЕСТО',
      wait:'ждём вожака…',start:'вожак начал игру',inv:(c,l)=>'МЕТЬ СО МНОЙ! 🐶 Код: '+c+'\n→ @glavny_pes_bot → кнопка МЕНЮ → С ДРУЗЬЯМИ → ВВОД КОДА'+(l?'\n'+l:''),
      join:s=>s+' вступил в драку!',left:s=>s+' убежал по делам',copied:'Скопировано в буфер!',
      full:'КОМНАТА ПОЛНА (макс 3 пса)',bad:'нет такой комнаты',down:'сервер недоступен — проверь сеть',
      disc:'связь оборвалась',you:'Ты',mpT:'МУЛЬТИПЛЕЕР',st1:'место',st2:'территория',st3:'очки',
      syncErr:'сбой кадра синхронизации'},
    en:{t1:'TOP DOG OF THE BLOCK!',t2:'victory!',place:m=>m===1?'1ST PLACE':m===2?'2ND PLACE':'3RD PLACE',
      wait:'waiting for the host…',start:'host started the game',inv:(c,l)=>'MARK WITH ME! 🐶 Code: '+c+'\n→ @glavny_pes_bot → MENU button → WITH FRIENDS → enter code'+(l?'\n'+l:''),
      join:s=>s+' joined the fight!',left:s=>s+' ran off on errands',copied:'Copied!',
      full:'ROOM IS FULL (3 dogs max)',bad:'no such room',down:'server unreachable — check network',
      disc:'connection lost',you:'You',mpT:'MULTIPLAYER',st1:'place',st2:'territory',st3:'points',
      syncErr:'sync frame hiccup'},
    zh:{t1:'街区狗王！',t2:'胜利！',place:m=>m===1?'第 1 名':m===2?'第 2 名':'第 3 名',
      wait:'等待房主…',start:'房主已开始游戏',inv:(c,l)=>'一起来占地盘！🐶 房间码: '+c+'\n→ @glavny_pes_bot → 菜单按钮 → 好友对战 → 输入房间码'+(l?'\n'+l:''),
      join:s=>s+' 参战了！',left:s=>s+' 先走一步',copied:'已复制！',
      full:'房间已满（最多 3 条狗）',bad:'没有这个房间',down:'服务器不可达 — 检查网络',
      disc:'连接中断',you:'你',mpT:'多人对战',st1:'名次',st2:'领地',st3:'分数',
      syncErr:'同步帧小故障'},
    es:{t1:'¡PERRO JEFE DEL BARRIO!',t2:'¡victoria!',place:m=>m===1?'1.er PUESTO':m===2?'2.º PUESTO':'3.er PUESTO',
      wait:'esperando al anfitrión…',start:'el anfitrión empezó',inv:(c,l)=>'¡MARCA CONMIGO! 🐶 Código: '+c+'\n→ @glavny_pes_bot → botón MENÚ → CON AMIGOS → introduce el código'+(l?'\n'+l:''),
      join:s=>s+' se unió a la pelea!',left:s=>s+' se fue de recado',copied:'¡Copiado!',
      full:'SALA LLENA (máx. 3 perros)',bad:'sala inexistente',down:'servidor inaccesible — revisa la red',
      disc:'conexión perdida',you:'Tú',mpT:'MULTIJUGADOR',st1:'puesto',st2:'territorio',st3:'puntos',
      syncErr:'fallo puntual de sincronización'},
  },
  TT(){return this.L[lang]||this.L.ru;},

  mapOwner(o){return o>=4?(o===4?REX:BARB):o+4;},

  // ---------- сетка (локальное зеркало) ----------
  resetGrid(){
    this.grid=new Uint8Array(GW*GH);this.grid.set(blockedGrid);
    this.counts=new Array(8).fill(0);this.freeCells=0;
    for(let i=0;i<this.grid.length;i++){const v=this.grid[i];
      if(v===BLOCKED)this.counts[BLOCKED]++;else{this.counts[0]++;this.freeCells++;}}
  },
  claim(x,y,r,sv){
    const lo=this.mapOwner(sv);
    const x0=Math.max(0,(x-r)/CELL|0),x1=Math.min(GW-1,(x+r)/CELL|0);
    const y0=Math.max(0,(y-r)/CELL|0),y1=Math.min(GH-1,(y+r)/CELL|0);
    for(let gy=y0;gy<=y1;gy++)for(let gx=x0;gx<=x1;gx++){
      const cx=gx*CELL+7,cy=gy*CELL+7;
      if((cx-x)**2+(cy-y)**2>r*r)continue;
      const i=gy*GW+gx,cur=this.grid[i];
      if(cur===BLOCKED||cur===lo)continue;
      this.counts[cur]--;this.counts[lo]++;this.grid[i]=lo;
    }
    paintStamp(x,y,r,0,this.COL[sv]||'#B08A5A');
  },
  erase(x,y,r){
    const x0=Math.max(0,(x-r)/CELL|0),x1=Math.min(GW-1,(x+r)/CELL|0);
    const y0=Math.max(0,(y-r)/CELL|0),y1=Math.min(GH-1,(y+r)/CELL|0);
    for(let gy=y0;gy<=y1;gy++)for(let gx=x0;gx<=x1;gx++){
      const cx=gx*CELL+7,cy=gy*CELL+7;
      if((cx-x)**2+(cy-y)**2>r*r)continue;
      const i=gy*GW+gx,cur=this.grid[i];
      if(cur>=5&&cur<=7){this.counts[cur]--;this.counts[0]++;this.grid[i]=0;}
    }
    eraseStamp(x,y,r);
  },

  // ---------- лобби ----------
  openLobby(){
    initAudio();
    screenTitleEl.classList.add('hidden');
    $('screenAch')&&$('screenAch').classList.add('hidden');
    $('screenSet').classList.add('hidden');
    $('screenLobby').classList.remove('hidden');
    $('lobbyHome').classList.remove('hidden');
    $('lobbyRoom').classList.add('hidden');
    $('lobbyStatus').textContent='';
  },
  closeLobby(toTitle){
    $('screenLobby').classList.add('hidden');
    if(toTitle)screenTitleEl.classList.remove('hidden');
  },
  status(t){$('lobbyStatus').textContent=t||'';},
  async create(){
    this.status('…');
    try{
      const r=await fetch(this.BASE.replace('wss','https')+'/api/room',{method:'POST'});
      const d=await r.json();
      if(!d.ok){this.status(this.TT().down);return}
      this.join(d.code);
    }catch(e){this.status(this.TT().down)}
  },
  join(code){
    code=(''+code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
    if(code.length!==4){this.status(this.TT().bad);return}
    if(this.ws){try{this.ws.close()}catch(e){}}
    this.code=code;this.status('…');
    let opened=false;
    try{this.ws=new WebSocket(this.BASE+'/api/room/'+code+'/ws');}catch(e){this.status(this.TT().down);return}
    this.ws.onopen=()=>{opened=true;
      this.ws.send(JSON.stringify({t:'hi',name:playerNameStr,skin:skinIdx}));};
    this.ws.onmessage=e=>this.onMsg(JSON.parse(e.data));
    this.ws.onclose=()=>{
      if(this.inGame){this.toastDisc();return}
      this.status(opened?this.TT().bad:this.TT().down);
    };
    this.ws.onerror=()=>{if(!opened)this.status(this.TT().down)};
  },
  onMsg(m){
    if(m.t==='hello'){this.seat=m.seat;this.isHost=false;this.phase=m.phase;this.map=m.map;this.diff=m.diff;
      this.showRoom();}
    else if(m.t==='lobby'){this.players=m.players;this.phase=m.phase;this.map=m.map;this.diff=m.diff;
      const me=this.players.find(p=>p&&p.seat===this.seat);
      this.isHost=!!(me&&me.host);
      if($('screenLobby').classList.contains('hidden')===false)this.renderLobby();}
    else if(m.t==='start')this.onStart(m);
    else if(m.t==='snap')this.onSnap(m);
    else if(m.t==='end')this.onEnd(m);
    else if(m.t==='err'){console.error('MP server:',m.msg);toastOnce('mperr',8,this.TT().syncErr,'slate');} // v1.5.1: ошибки сервера видны, но не спамят
    else if(m.t==='busy'){this.status(this.TT().full);try{this.ws.close()}catch(e){}}
  },
  showRoom(){
    $('lobbyHome').classList.add('hidden');
    $('lobbyRoom').classList.remove('hidden');
    $('codeBig').textContent=this.code;
    this.renderLobby();
  },
  renderLobby(){
    const M=this.players.filter(Boolean);
    const LNn=LN();
    const box=$('lobbyPlayers');
    box.innerHTML=M.map(p=>{
      const nm=p.seat===this.seat?p.name+' ('+this.TT().you+')':p.name;
      const skn=(SKINS[p.skin]&&LNn.skins[SKINS[p.skin].key]||{}).n||''; // v1.5.2: у SKINS нет .name — было «undefined»
      return '<div class="lobbyRow"><span class="who"><span class="dot" style="background:'+
        this.SEATPAL[p.seat+1]+'"></span>'+esc(nm)+(p.host?' 🏁':'')+'</span><b>'+esc(skn)+'</b></div>';
    }).join('');
    $('lobbyMapName').textContent=(LNn.maps&&LNn.maps[this.map])||this.map;
    $('lobbyDiffName').textContent=(LNn.diffs&&LNn.diffs[this.diff])||this.diff;
    $('hostCtls').classList.toggle('hidden',!this.isHost);
    $('btnLobbyStart').style.display=this.isHost?'':'none';
    $('codeHint').textContent=this.isHost?mpT('hostCode'):mpT('code'); // v1.5.2: mpT() выбирает строку по языку — было «[object Object]»
    document.querySelectorAll('.lobMapBtn').forEach(b=>b.classList.toggle('on',b.dataset.m===this.map));
    document.querySelectorAll('.lobDiffBtn').forEach(b=>b.classList.toggle('on',b.dataset.d===this.diff));
    this.status(M.length<2?this.TT().wait:'');
  },
  sendLobbySet(){
    if(!this.isHost)return;
    this.wsSend({t:'set',map:this.map,diff:this.diff});
  },
  startMatch(){
    if(!this.isHost)return;
    this.wsSend({t:'start',map:this.map,diff:this.diff});
  },
  restart(){
    if(this.isHost)this.wsSend({t:'r'});
    else toast(this.TT().wait,'slate');
  },
  wsSend(o){if(this.ws&&this.ws.readyState===1)try{this.ws.send(JSON.stringify(o))}catch(e){}},

  // ---------- старт матча ----------
  onStart(m){
    mapKey=m.map;diffKey=m.diff;persist();
    this.mpEnd=false;
    buildMap();computeBlocked();bakeMap();bakeTop();
    this.resetGrid();
    this.active=true;this.inGame=true;this.stunT=0;this.brawlFx=null;
    resetWorld();
    bones=m.bn.map(([x,y])=>({x,y,on:true,rt:0}));
    // мой пёс
    const SP=[[150,562],[1520,940],[1520,180]][this.seat]||[150,562];
    Object.assign(player,{x:SP[0],y:SP[1],vx:0,vy:0,a:0,sc:SK().base.sc,bladder:70,stationary:0,
      peeing:false,stampT:0,peeTick:0,dustT:0,moving:false,inBrawl:false,barkCd:0});
    // чужие
    this.remotes=this.players.filter(Boolean).filter(p=>p.seat!==this.seat).map(p=>({
      seat:p.seat,name:p.name,skin:p.skin,
      dog:{x:W/2,y:H/2,tx:W/2,ty:H/2,a:0,ta:0,phase:0,tph:0,sc:SKBASEC[p.skin].sc,peeing:false,
        moving:true,excited:false,id:p.seat+1,mv:false}}));
    this.npcT={r:null,b:null,c:null};
    rival.x=900;rival.y=300;rival.a=Math.PI;barb.active=false;barb.state='gone';barb.x=-100;barb.y=-100;
    cat.active=DIFFS[this.diff].cat;
    state='play';
    screenTitleEl.classList.add('hidden');
    screenEndEl.classList.add('hidden');
    $('screenLobby').classList.add('hidden');
    $('screenPause').classList.add('hidden');
    hud.classList.remove('hidden');
    $('mpBoard').classList.remove('hidden');
    this.myInp={ax:0,ay:0,p:0,b:0};
    if(this.inTimer)clearInterval(this.inTimer);
    this.inTimer=setInterval(()=>this.sendInput(),66);
    sndBark();
    toast(this.TT().start,'gold');
    cam.x=player.x;cam.y=player.y;
    time=0;
  },
  sendInput(){
    if(!this.inGame)return;
    this.wsSend({t:'i',ax:this.myInp.ax,ay:this.myInp.ay,p:this.myInp.p,b:this.myInp.b});
    this.myInp.b=0;
  },

  // ---------- снапшот ----------
  onSnap(m){
    if(!this.inGame)return;
    // v1.5.1: события снапшота применяем РОВНО ОДИН РАЗ — здесь, при приходе.
    // Раньше они обрабатывались в update() на каждом кадре рендера (60 fps
    // против 20 Гц снапшотов) — каждое уведомление показывалось 2-3 раза.
    if(m.ev){
      for(const e of m.ev){
        if(e.st)this.claim(e.st[0],e.st[1],e.st[2],e.st[3]);
        else if(e.er)this.erase(e.er[0],e.er[1],e.er[2]);
        else if(e.fx)this.onFx(e.fx);
      }
      m.ev=null;
    }
    this.snapS=m;
    timeLeft=m.tm;
    if(m.pts)pts=m.pts[this.seat]||0;
    this.myPct=m.pct[this.seat]||0;
    if(m.sp&&m.sp.length===spots.length){
      for(let i=0;i<spots.length;i++){
        const sp=m.sp[i];spots[i].owner=sp[0];
        spots[i].p1=sp[1][this.seat]||0;
        let mx=0;for(let j=0;j<3;j++)if(j!==this.seat)mx=Math.max(mx,sp[1][j]||0);
        spots[i].p2=mx;
      }
    }
    for(let i=0;i<bones.length;i++)bones[i].on=!!(m.bo&&m.bo.includes(i));
  },

  // ---------- события ----------
  onFx(f){
    const[k]=f;
    if(k==='st'){this.claim(f[1],f[2],f[3],f[4]);}
    else if(k==='er'){this.erase(f[1],f[2],f[3]);}
    else if(k==='bark'){
      rings.push({x:f[1],y:f[2],r:16,life:.6});rings.push({x:f[1],y:f[2],r:2,life:.7});
      sndBark();if(f[4]===this.seat)vib(15,'light');
    }
    else if(k==='bone'){sndCoin();floater(f[1],f[2]-18,'+25','#8A5E0E');
      if(f[3]===this.seat){vib(20,'light');dust(f[1],f[2],3,30);}}
    else if(k==='water'){sndDrink();if(f[3]===this.seat)toastOnce('water',4,mpT('water'),'gold');}
    else if(k==='spot'){sndJingle();toast(MP_T.spot(f[3]===this.seat?this.TT().you:(this.players.find(p=>p&&p.seat===f[3])||{name:''}).name),'gold');
      if(f[3]===this.seat)vib([30,60,30],'rigid');}
    else if(k==='yelp'){sndYelp();}
    else if(k==='meow'){sndMeow();}
    else if(k==='pts'){floater(f[2],f[3],f[4],'#B37A16');}
    else if(k==='chase'){toastOnce('mpchase',3,mpT('chase'),'gold');}
    else if(k==='barbin'){sndRoar();shake=Math.max(shake,8);toast(mpT('barbIn'),'red');}
    else if(k==='scat'){ // v1.5.1: формат [тип, место, x, y] — раньше место читали из f[3] (это координата!)
      // поэтому стан не вешался, имя было пустое, драки не было видно
      const seat=f[1],bx=f[2],by=f[3];
      sndFight();shake=Math.max(shake,10);
      const nm=seat===this.seat?this.TT().you:((this.players.find(p=>p&&p.seat===seat)||{}).name||'?');
      toast(MP_T.scat(nm),'red');
      // анимация драки: облачко пыли над обоими, как в одиночке
      const vic=seat===this.seat?player:((this.remotes.find(r=>r.seat===seat)||{}).dog);
      if(vic){
        const mx2=(vic.x+bx)/2,my2=(vic.y+by)/2;
        this.brawlFx={x:mx2,y:my2,t:.8,fxT:0};
        for(let i=0;i<10;i++)parts.push({x:mx2+rnd(-14,14),y:my2+rnd(-14,14),vx:rnd(-90,90),vy:rnd(-90,90),
          life:.5,ml:.5,r:rnd(2,4),col:'#F2C94C',type:'star'});
        dust(mx2,my2,8,70);
        if(seat===this.seat){player.inBrawl=true;barb.inBrawl=true;}
      }
      if(seat===this.seat){this.stunT=.8;vib([60,40,60],'rigid');}
    }
    else if(k==='barkbig'){toast(mpT('barkBig'),'gold');sndYelp();}
    else if(k==='barksmall'){toast(mpT('barkSmall'),'red');sndRoar();}
    else if(k==='left'){const s=(this.players.find(p=>p&&p.seat===f[1])||{name:'?'}).name;
      this.remotes=this.remotes.filter(r=>r.seat!==f[1]);
      toast(this.TT().left(s),'slate');}
  },

  // ---------- кадр ----------
  update(dt){
    time+=dt;
    if(shake>0)shake=Math.max(0,shake-26*dt);
    const m=this.snapS;
    // мой ввод
    let ax=((key.ArrowRight||key.KeyD)?1:0)-((key.ArrowLeft||key.KeyA)?1:0);
    let ay=((key.ArrowDown||key.KeyS)?1:0)-((key.ArrowUp||key.KeyW)?1:0);
    if(joy.on){ax=joy.vx;ay=joy.vy;}
    const l=Math.hypot(ax,ay);if(l>1){ax/=l;ay/=l;}
    this.myInp.ax=ax;this.myInp.ay=ay;
    this.myInp.p=(input.space||input.btn)?1:0;
    // v1.5.1: индикатор лая — оптимистично ставим откат локально
    // (сервер авторитетен: значение сверяется со снапшотом ниже)
    if(input.bark){input.bark=false;this.myInp.b=1;
      if(player.barkCd<=0&&this.stunT<=0)player.barkCd=BARK_CD;}
    if(input.padBark){input.padBark=false;this.myInp.b=1;
      if(player.barkCd<=0&&this.stunT<=0)player.barkCd=BARK_CD;}
    if(this.stunT>0)this.stunT-=dt;
    // v1.5.1: облачко драки с Барбосом — пыхтим пылью, как updateBrawl в одиночке
    if(this.brawlFx){
      const bf=this.brawlFx;
      bf.t-=dt;bf.fxT-=dt;
      if(bf.fxT<=0){bf.fxT=.12;dust(bf.x,bf.y,2,60);}
      if(bf.t<=0){
        dust(bf.x,bf.y,8,70);
        this.brawlFx=null;player.inBrawl=false;barb.inBrawl=false;
      }
    }
    if(!this.inGame){ // после финала — только частицы
      updateParts(dt);
      for(let i=floaters.length-1;i>=0;i--){floaters[i].life-=dt*.9;if(floaters[i].life<=0)floaters.splice(i,1);}
      return;
    }
    // мой пёс: локальное предсказание
    const B=SK().base;
    player.barkCd=Math.max(0,player.barkCd-dt);
    let pax=ax,pay=ay;
    if(this.stunT>0){pax=0;pay=0;}
    const cap=(player.peeing?78:205)*B.spd,k=1-Math.exp(-9*dt);
    player.vx+=(pax*cap-player.vx)*k;player.vy+=(pay*cap-player.vy)*k;
    player.x+=player.vx*dt;player.y+=player.vy*dt;collide(player,13*player.sc);
    const sp=Math.hypot(player.vx,player.vy);
    player.moving=sp>20;
    if(sp>25)player.a=lerpAng(player.a,Math.atan2(player.vy,player.vx),Math.min(1,11*dt));
    player.phase+=sp*dt*.075;
    player.stationary=sp<22?player.stationary+dt:0;
    if(sp>150){player.dustT-=dt;if(player.dustT<=0){player.dustT=.09;
      dust(player.x-Math.cos(player.a)*12,player.y-Math.sin(player.a)*12,1,20);}}
    // сверка с сервером
    if(m&&m.s&&m.s[this.seat]){
      const s0=m.s[this.seat];
      const dx=s0[0]-player.x,dy=s0[1]-player.y,dd=Math.hypot(dx,dy);
      if(dd>(this.stunT>0?24:70)){player.x=s0[0];player.y=s0[1];} // v1.5.1: после схватки резче (отбрасывание)
      else{player.x+=dx*Math.min(1,dt*4);player.y+=dy*Math.min(1,dt*4);}
      player.peeing=!!s0[4];player.bladder=s0[5];
      if(s0[6]>player.barkCd)player.barkCd=s0[6]; // v1.5.1: откат лая из авторитетного снапшота
    }
    // чужие псы
    // v1.5.1: если пса нет в снапшотах — 2 с и убираем (выход из матча;
    // раньше он замерал на месте и рисовался до конца матча)
    if(m&&m.s){
      this.remotes=this.remotes.filter(r=>{
        const s=m.s[r.seat];
        if(!s){r.missT=(r.missT||0)+1;return r.missT<=40;}
        r.missT=0;return true;
      });
      for(const r of this.remotes){
      const s=m.s[r.seat];if(!s)continue;
      const d=r.dog;
      d.x+=(s[0]-d.x)*Math.min(1,dt*14);d.y+=(s[1]-d.y)*Math.min(1,dt*14);
      d.a=lerpAng(d.a,s[2],Math.min(1,dt*12));
      d.moving=!!s[3];d.peeing=!!s[4];d.phase=s[8]||0;
      }
    }
    // NPC
    if(m){
      if(m.r){const t=this.npcT.r||(this.npcT.r={});t.x=m.r[0];t.y=m.r[1];t.a=m.r[2];t.st=m.r[3];t.mv=m.r[4];t.ph=m.r[5];}
      if(m.b){const t=this.npcT.b||(this.npcT.b={});t.x=m.b[0];t.y=m.b[1];t.a=m.b[2];t.st=m.b[3];t.mv=m.b[4];t.ph=m.b[5];}
      else{barb.active=false;barb.state='gone';}
      if(m.c){const t=this.npcT.c||(this.npcT.c={});t.x=m.c[0];t.y=m.c[1];t.a=m.c[2];t.st=m.c[3];t.mv=m.c[4];t.ph=m.c[5];}
    }
    const sm=(o,t)=>{if(!t)return;const f=Math.min(1,dt*12);
      o.x+=(t.x-o.x)*f;o.y+=(t.y-o.y)*f;o.a=lerpAng(o.a,t.a,f);o.phase=t.ph;};
    sm(rival,this.npcT.r);rival.moving=this.npcT.r?this.npcT.r.mv:rival.moving;
    if(this.npcT.b){barb.active=true;barb.state=this.npcT.b.st==='gone'?'gone':(this.npcT.b.st||'patrol');
      if(barb.state!=='gone'){sm(barb,this.npcT.b);barb.moving=this.npcT.b.mv;}}
    if(this.npcT.c){cat.active=true;cat.state=this.npcT.c.st;sm(cat,this.npcT.c);cat.moving=this.npcT.c.mv;}
    // камера
    const tx=clamp(player.x+Math.cos(player.a)*36,vw/2,W-vw/2);
    const ty=clamp(player.y+Math.sin(player.a)*36,vh/2,H-vh/2);
    cam.x+=(tx-cam.x)*Math.min(1,dt*4.5);
    cam.y+=(ty-cam.y)*Math.min(1,dt*4.5);
    if(vw>=W)cam.x=W/2;if(vh>=H)cam.y=H/2;
    // частицы/поплавки
    updateParts(dt);
    for(let i=floaters.length-1;i>=0;i--){floaters[i].life-=dt*.9;if(floaters[i].life<=0)floaters.splice(i,1);}
    for(const s of spots)s.pulse=Math.max(0,s.pulse-dt*1.5);
    // табло
    this.boardT+=dt;
    if(this.boardT>.5){this.boardT=0;this.renderBoard(m);}
  },
  renderBoard(m){
    if(!m)return;
    const el=$('mpBoard');
    const rows=[0,1,2].map(i=>{
      const p=this.players.find(x=>x&&x.seat===i);if(!p)return null;
      return {seat:i,name:p.name,pct:m.pct[i]||0,pts:(m.pts&&m.pts[i])||0};
    }).filter(Boolean).sort((a,b)=>b.pct-a.pct);
    el.innerHTML=rows.map((r,i)=>
      '<div class="mpSeat'+(r.seat===this.seat?' me':'')+(i===0?' lead':'')+'">'+
      '<span class="dot" style="background:'+this.SEATPAL[r.seat+1]+'"></span>'+
      esc(r.name)+'<b>'+r.pct.toFixed(1)+'%</b></div>').join('');
  },
  minimap(mm){
    for(const r of this.remotes){
      mm.fillStyle=this.SEATPAL[r.seat+1];
      mm.strokeStyle='#2E2A26';mm.lineWidth=1.2;
      mm.beginPath();mm.arc(r.dog.x/W*156,r.dog.y/H*104,3,0,TAU);mm.fill();mm.stroke();
    }
  },
  renderDogs(ctx){
    for(const r of this.remotes){
      drawDog(ctx,r.dog,SKINS[r.skin]);
      drawLabel(ctx,r.dog,r.name,this.SEATPAL[r.seat+1]);
    }
  },

  // ---------- финал ----------
  onEnd(m){
    if(!this.inGame)return;
    this.inGame=false;this.mpEnd=true;this.active=true;
    this.brawlFx=null;player.inBrawl=false;barb.inBrawl=false; // v1.5.1: не оставляем пса в облачке драки
    if(this.inTimer){clearInterval(this.inTimer);this.inTimer=null;}
    state='end';stopPeeSnd();sndEnd();
    vib([40,60,40,60,150],'rigid');
    const T=this.TT();
    const my=m.standings.findIndex(s=>s.seat===this.seat);
    const place=my+1;
    $('rankTitle').textContent=place===1?T.t1:T.place(place);
    $('rankSub').textContent=place===1?T.t2:'';
    $('endTag').textContent=T.mpT+' · '+(LN().maps&&LN().maps[this.map]||this.map)+' · '+this.code;
    $('recLine').classList.toggle('on',place===1);
    if(place===1)$('recLine').textContent='★ '+T.t1;
    const rows=m.standings.map((s,i)=>[
      (i+1)+'. '+esc(s.name)+(s.seat===this.seat?' ('+T.you+')':''),
      s.pct.toFixed(1)+'% · '+Math.round(s.pts)]);
    $('statsBox').innerHTML=rows.map(([k,v],i)=>
      '<div class="row'+(i===0?' total':'')+'"><span style="color:'+this.SEATPAL[m.standings[i].seat+1]+'">'+k+'</span><b>'+v+'</b></div>').join('');
    MP.lastStandings=m.standings;
    screenEndEl.classList.remove('hidden');
    hud.classList.add('hidden');
    $('mpBoard').classList.add('hidden');
  },
  toastDisc(){
    this.inGame=false;this.active=false;
    if(this.inTimer){clearInterval(this.inTimer);this.inTimer=null;}
    stopPeeSnd();
    toast(this.TT().disc,'red');
    this.leave(true);
  },
  share(){
    const T=this.TT();
    const link='https://t.me/glavny_pes_bot/app?startapp='+this.code;
    const txt=T.inv(this.code,link);
    if(navigator.share){navigator.share({text:txt}).catch(()=>{});return;}
    try{navigator.clipboard.writeText(txt).then(()=>toast(T.copied,'gold'),()=>this.fallbackCopy(txt));}
    catch(e){this.fallbackCopy(txt);}
  },
  fallbackCopy(txt){
    const ta=document.createElement('textarea');ta.value=txt;
    document.body.appendChild(ta);ta.select();
    try{document.execCommand('copy');toast(this.TT().copied,'gold');}catch(e){}
    ta.remove();
  },
  leave(toTitle){
    this.inGame=false;this.active=false;this.mpEnd=false;
    this.brawlFx=null;player.inBrawl=false; // v1.5.1
    if(this.inTimer){clearInterval(this.inTimer);this.inTimer=null;}
    if(this.ws){try{this.ws.close()}catch(e){}this.ws=null;}
    $('mpBoard').classList.add('hidden');
    hud.classList.add('hidden');
    screenEndEl.classList.add('hidden');
    $('screenLobby').classList.add('hidden');
    this.closeLobby(true);
    state='attract';
    resetWorld();bakeMap();bakeTop();
    this.ws=null;this.seat=-1;
  },

  // ---------- init ----------
  init(){
    $('btnFriends').addEventListener('click',()=>this.openLobby());
    $('btnRoomCreate').addEventListener('click',()=>{initAudio();this.create();});
    $('btnRoomJoin').addEventListener('click',()=>{initAudio();this.join($('codeInput').value);});
    $('codeInput').addEventListener('keydown',e=>{
      if(e.key==='Enter'){this.join($('codeInput').value);e.preventDefault();e.stopPropagation();}
    });
    $('btnLobbyStart').addEventListener('click',()=>this.startMatch());
    $('btnLobbyShare').addEventListener('click',()=>this.share());
    $('btnLobbyLeave').addEventListener('click',()=>{if(this.ws){try{this.ws.close()}catch(e){}}this.leave(true);});
    $('btnLobbyStart').style.display='none';
    document.querySelectorAll('.lobMapBtn').forEach(b=>b.addEventListener('click',()=>{
      this.map=b.dataset.m;this.sendLobbySet();this.renderLobby();}));
    document.querySelectorAll('.lobDiffBtn').forEach(b=>b.addEventListener('click',()=>{
      this.diff=b.dataset.d;this.sendLobbySet();this.renderLobby();}));
    $('btnAgain').addEventListener('click',()=>{if(MP.mpEnd){MP.restart();}});
    $('btnMenuEnd').addEventListener('click',()=>{if(MP.active)MP.leave(true);});
    $('btnMenuPause').addEventListener('click',()=>{if(MP.active)MP.leave(true);});
    // автоподключение по ссылке-приглашению
    let code=null;
    try{if(TMA&&TMA.initDataUnsafe&&TMA.initDataUnsafe.start_param)code=TMA.initDataUnsafe.start_param;}catch(e){}
    if(!code){const q=new URLSearchParams(location.search).get('room');if(q)code=q;}
    if(code&&/^[A-Z0-9]{4}$/i.test(code)){
      this.openLobby();
      setTimeout(()=>this.join(code),400);
    }
  },
};

// надписи-одиночки (форматные — не таскаем в словари игры)
const MP_T={
  hostCode:{ru:'код комнаты — отправь его друзьям',en:'room code — send it to friends',
    zh:'房间码 — 发给朋友',es:'código de sala — envíalo a tus amigos'},
  code:{ru:'код комнаты',en:'room code',zh:'房间码',es:'código de sala'},
  water:{ru:'ВОДА! ПУЗЫРЬ ПОЛОН',en:'WATER! BLADDER FULL',zh:'喝水！膀胱满了',es:'¡AGUA! VEJIGA LLENA'},
  spot:n=>({ru:n+' ЗАХВАТИЛ КРУТОЕ МЕСТО!',en:n+' CAPTURED A COOL SPOT!',zh:n+' 占领了一个酷点！',es:'¡'+n+' CAPTURÓ UN SITIO GENIAL!'})[lang]||n+' SPOT!',
  chase:{ru:'РЕКС ПРОГНАН!',en:'REX CHASED OFF!',zh:'赶走了雷克斯！',es:'¡REX AHUYENTADO!'},
  barbIn:{ru:'БАРБОС ВЫШЕЛ НА ОХОТУ!',en:'BARBOS IS ON THE HUNT!',zh:'巴博斯出来打猎了！',es:'¡BARBOS SALIÓ DE CAZA!'},
  scat:n=>({ru:'БАРБОС ПОТРЕПАЛ: '+n+'!',en:'BARBOS MAULED: '+n+'!',zh:'巴博斯撕咬了：'+n+'！',es:'¡BARBOS ZARANDEÓ A '+n+'!'})[lang]||('BARBOS: '+n+'!'),
  barkBig:{ru:'БАРБОС ОШЕЛОМЛЁН ДЕРЗОСТЬЮ!',en:'BARBOS IS STUNNED BY THE NERVE!',zh:'巴博斯被吓住了！',es:'¡BARBOS ATÓNITO ANTE TANTA CARA DURA!'},
  barkSmall:{ru:'БАРБОСА НЕ ИСПУГАТЬ! БЕГИ!',en:'CANNOT SCARE BARBOS! RUN!',zh:'吓不跑巴博斯！快跑！',es:'¡A BARBOS NO SE ASUSTA! ¡CORRE!'},
};
// v1.5.1: выбор строки по языку — раньше объект уезжал в toast() целиком и рисовал «[object Object]»
function mpT(k){const v=MP_T[k];return typeof v==='function'?v:(v[lang]||v.ru);}
function esc(s){return (''+s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
// скин-базы для чужих псов (масштаб)
const SKBASEC=[{sc:.84},{sc:.84},{sc:.84},{sc:1},{sc:1},{sc:1},{sc:1.22},{sc:1.22},{sc:1.22}];

MP.init();
window.__mpReady=true;
window.__MP=MP; // отладочный доступ (автотесты и поддержка)

