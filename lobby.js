// ── 로비 풀밭 모듈 ──
// 자유 워크 엔진(트레이너+포켓몬), 풀밭 단계 자동 교체, 발밑 오라, 인트로 시퀀스.
// ui.js의 showScreen에서 startLobbyMeadow / stopLobbyMeadow 호출.

// 덱 슬롯(6마리) 기반 동시 워크. 경계 부근에서 점진 회귀(스티어링)로 자연스러운 반전.
let lobbyMeadowState=null;

const MEADOW_BOUNDS={
  topRatio:0.30,    // 상단 30%는 산/하늘 — 진입 금지(소프트)
  bottomPad:18,     // 하단 여백
  sidePad:24,       // 좌우 여백
  edgeBand:48,      // 경계 회귀 반응 시작 거리
  edgePull:140,     // 경계 회귀 가속도(px/s²)
};

// 트레이너 5세대 BW overworld 시트 메타
// 한 프레임 32×32, 3프레임×4방향, base는 캐릭터별 시트 좌상단 좌표
// 행 순서: 0=down / 1=left / 2=right / 3=up (검증 후 필요 시 조정)
const TRAINER_SHEET={
  url:'assets/dot/trainer/character_sprite_01.png',
  frame:32,
  stillCol:1, // 가운데 프레임 = 정지 포즈
  base:{
    man:{x:0,y:0},
    woman:{x:0,y:228},
  },
};

// 시트 행 순서: 0=up, 1=down, 2=left, 3=right
function getTrainerRow(p){
  const ax=Math.abs(p.vx), ay=Math.abs(p.vy);
  if(ax<0.3&&ay<0.3) return (typeof p._lastRow==='number')?p._lastRow:1;
  if(ay>ax) p._lastRow=p.vy>0?1:0;     // 아래로 → row 1, 위로 → row 0
  else      p._lastRow=p.vx<0?2:3;     // 왼쪽 → row 2, 오른쪽 → row 3
  return p._lastRow;
}

// 워크 사이클 (BW 표준): 정지 → 왼발 → 정지 → 오른발 무한 반복
const TRAINER_WALK_CYCLE=[1,0,1,2];
const TRAINER_WALK_FRAME_S=0.18; // 한 프레임 시간(초)
function getTrainerCol(p,dt){
  const moving=(p.vx*p.vx+p.vy*p.vy)>1;
  if(moving){
    p._walkTime=(p._walkTime||0)+dt;
    return TRAINER_WALK_CYCLE[Math.floor(p._walkTime/TRAINER_WALK_FRAME_S)%TRAINER_WALK_CYCLE.length];
  } else {
    p._walkTime=0;
    return TRAINER_SHEET.stillCol;
  }
}

// 트레이너 시트는 풀 녹색 배경에 그려진 RIP 자산 → 런타임 캔버스 매팅으로 알파 처리
let _trainerSheetUrl=null;
let _trainerSheetLoading=null;
function ensureTrainerSheet(){
  if(_trainerSheetUrl) return Promise.resolve(_trainerSheetUrl);
  if(_trainerSheetLoading) return _trainerSheetLoading;
  _trainerSheetLoading=new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      try{
        const canvas=document.createElement('canvas');
        canvas.width=img.width;
        canvas.height=img.height;
        const ctx=canvas.getContext('2d');
        ctx.drawImage(img,0,0);
        const data=ctx.getImageData(0,0,canvas.width,canvas.height);
        const d=data.data;
        // 풀 녹색 매팅: g가 r/b보다 확연 강하고 일정 강도 범위
        for(let i=0;i<d.length;i+=4){
          const r=d[i], g=d[i+1], b=d[i+2];
          if(g>r+15 && g>b+15 && g>=100 && g<=210) d[i+3]=0;
        }
        ctx.putImageData(data,0,0);
        _trainerSheetUrl=canvas.toDataURL();
      }catch(e){
        // CORS taint 등 → 원본 URL fallback
        _trainerSheetUrl=img.src;
      }
      resolve(_trainerSheetUrl);
    };
    img.onerror=()=>{ _trainerSheetUrl=img.src; resolve(_trainerSheetUrl); };
    img.src=TRAINER_SHEET.url;
  });
  return _trainerSheetLoading;
}
// 모듈 로드 시 미리 매팅 시작 (첫 로비 진입 전 캐시 준비)
if(typeof window!=='undefined') ensureTrainerSheet();

// ── 디버그용 치트 함수 (콘솔에서 호출) ──
// devAddCaught(20)         → 도감에 20마리 추가
// devSetSlots([1,2,3,43,69,102]) → 덱 슬롯 강제 변경
// devClearCaught()         → 도감 초기화
function devAddCaught(n){
  n=n|0; if(n<=0) n=10;
  const cur=JSON.parse(localStorage.getItem('hexPuzzleDexCaught')||'[]');
  const set=new Set(cur);
  let added=0;
  for(let id=1;id<=151&&added<n;id++){
    if(!set.has(id)){ set.add(id); added++; }
  }
  const arr=Array.from(set).sort((a,b)=>a-b);
  localStorage.setItem('hexPuzzleDexCaught',JSON.stringify(arr));
  console.log('[dev] 도감:',arr.length,'마리 (+'+added+')');
  if(typeof startLobbyMeadow==='function') startLobbyMeadow();
}
function devSetSlots(arr){
  if(!Array.isArray(arr)||arr.length<1||arr.length>6){
    console.warn('[dev] 1~6 마리 dexId 배열 필요'); return;
  }
  while(arr.length<6) arr.push(arr[0]);
  localStorage.setItem('hexPuzzleSlots',JSON.stringify(arr));
  console.log('[dev] 슬롯:',arr);
  if(typeof startLobbyMeadow==='function') startLobbyMeadow();
}
function devClearCaught(){
  localStorage.removeItem('hexPuzzleDexCaught');
  console.log('[dev] 도감 초기화');
  if(typeof startLobbyMeadow==='function') startLobbyMeadow();
}
if(typeof window!=='undefined'){
  window.devAddCaught=devAddCaught;
  window.devSetSlots=devSetSlots;
  window.devClearCaught=devClearCaught;
}

function readDeckSlots(){
  try{
    const raw=JSON.parse(localStorage.getItem('hexPuzzleSlots')||'null');
    if(Array.isArray(raw)&&raw.length) return raw.slice(0,6);
  }catch(e){}
  return (typeof DEFAULT_SLOTS!=='undefined')?[...DEFAULT_SLOTS]:[1,4,7,10,15,25];
}

// ── 도감 / 풀밭 단계 ──
// dex.js 신스펙 우선, 미로드 환경에서 legacy 배열 폴백
function readCaughtList(){
  if(typeof getCapturedIds==='function') return getCapturedIds();
  try{
    const raw=JSON.parse(localStorage.getItem('hexPuzzleDexCaught')||'null');
    if(Array.isArray(raw)) return raw;
  }catch(e){}
  return [];
}

function getMeadowStage(caughtCount){
  if(caughtCount>=30) return 3;
  if(caughtCount>=20) return 2;
  if(caughtCount>=10) return 1;
  return 0;
}

function applyMeadowStageBackground(){
  const area=document.querySelector('.lobby-character-area');
  if(!area) return;
  const stage=getMeadowStage(readCaughtList().length);
  area.style.backgroundImage=`url("assets/lobby_bg/stage_${stage}.png")`;
}

// dexId → monster_table.json 메타 lookup (id로 인덱싱 캐시)
let _monsterMetaById=null;
function getMonsterMeta(dexId){
  if(!_monsterMetaById){
    _monsterMetaById={};
    if(typeof MONSTER_TABLE_DATA!=='undefined'&&MONSTER_TABLE_DATA.monsters){
      for(const m of MONSTER_TABLE_DATA.monsters) _monsterMetaById[m.id]=m;
    }
  }
  return _monsterMetaById[dexId]||null;
}

// 시각 표시 키: visual_h 우선, 없으면 height_m fallback
// (visual_h = 도트가 키보다 크게/작게 그려진 종 보정용. monster_table.json 옵셔널 필드)
function getMonsterVisualHeight(meta){
  if(!meta) return 0.7;
  if(typeof meta.visual_h==='number') return meta.visual_h;
  if(typeof meta.height_m==='number') return meta.height_m;
  return 0.7;
}

// 시각 키 → 카테고리 픽셀 높이
function getPokemonPixelHeight(dexId){
  const h=getMonsterVisualHeight(getMonsterMeta(dexId));
  if(h<=0.3) return 38;   // XS — 캐터피/구구/디그다
  if(h<=0.7) return 48;   // S  — 피카츄/꼬부기/파이리/이상해씨
  if(h<=1.0) return 56;   // M  — 라이츄(0.8)
  if(h<=1.7) return 76;   // L  — 독침붕(visual 1.6)/피죤투(1.5)
  if(h<=3.5) return 96;   // XL — 잠만보(2.1)/아보크(3.5)
  return 116;             // XXL — 갸라도스(6.5)
}

function startLobbyMeadow(){
  stopLobbyMeadow();
  const meadow=document.getElementById('lobby-meadow');
  if(!meadow) return;
  // 풀밭 단계 자동 교체 (보유 0/10/20/30+ → stage_0~3)
  applyMeadowStageBackground();
  const w=meadow.clientWidth||350;
  const h=meadow.clientHeight||400;
  if(w<10||h<10){
    // 레이아웃 아직 안정화 안 됐으면 한 프레임 대기
    requestAnimationFrame(()=>startLobbyMeadow());
    return;
  }

  const slots=readDeckSlots();

  // 타입 카운트 → 카운트 ≥3 타입 식별 (발밑 오라 대상)
  const typeCounts={};
  for(const dexId of slots){
    const meta=getMonsterMeta(dexId);
    if(!meta) continue;
    for(const t of (meta.types||[])) typeCounts[t]=(typeCounts[t]||0)+1;
  }
  const dominantTypes=Object.keys(typeCounts).filter(t=>typeCounts[t]>=3);

  // 트레이너 도트 — 다음 패스로 보류 (BW RIP 시트 슬라이싱이 영역마다 layout이 달라
  // 정확한 좌표 추출이 어려움. 매팅된 깔끔한 자산 확보 후 재활성화 예정).
  // CSS / TRAINER_SHEET / getTrainerRow / getTrainerCol / ensureTrainerSheet 코드는 보존.
  const trainer=null;

  const mons=slots.map((dexId,i)=>{
    const el=document.createElement('img');
    el.className='lobby-pokemon';
    el.src=`assets/dot/pokemon/${dexId}.gif`;
    el.draggable=false;
    el.alt='';
    // 종별 height_m → 카테고리 픽셀 높이 (가로는 비율 자동)
    el.style.height=getPokemonPixelHeight(dexId)+'px';
    meadow.appendChild(el);

    // 발밑 오라: 보유 타입 중 dominant 첫 매칭
    let auraEl=null;
    const meta=getMonsterMeta(dexId);
    const matched=meta&&(meta.types||[]).find(t=>dominantTypes.includes(t));
    if(matched){
      const color=(typeof TYPE_COLORS!=='undefined'&&TYPE_COLORS[matched])||'#ffffff';
      auraEl=document.createElement('div');
      auraEl.className='lobby-aura';
      auraEl.style.background=color;
      meadow.appendChild(auraEl);
    }

    // 초기 위치: 풀밭 영역에 분산
    const angle=(i/slots.length)*Math.PI*2;
    const cx=w*0.5, cy=h*0.7;
    const r=Math.min(w,h)*0.22;
    // 콜라이더 반경: 픽셀 높이의 35% (시각 절반보다 살짝 작게 — 너무 빡빡하면 분산이 어색)
    const collideR=getPokemonPixelHeight(dexId)*0.35;
    return {
      el,
      auraEl,
      dexId,
      collideR,
      x:cx+Math.cos(angle)*r,
      y:cy+Math.sin(angle)*r*0.6,
      vx:0, vy:0,
      speed:22+Math.random()*14, // 마리마다 살짝 다른 속도
      nextTurnAt:0,
      facing:Math.random()<0.5?1:-1,
      restUntil:0,
    };
  });

  // 트레이너 활성 시에만 워크 대상에 추가 (현재 보류 — trainer=null)
  if(trainer) mons.unshift(trainer);

  const state={
    raf:0,
    running:true,
    mons,
    bounds:{w,h},
    last:performance.now(),
  };

  function pickNewDir(p,now){
    // 휴식 확률
    if(Math.random()<0.22){
      p.vx=0; p.vy=0;
      p.restUntil=now+700+Math.random()*1500;
      p.nextTurnAt=p.restUntil;
      return;
    }
    const angle=Math.random()*Math.PI*2;
    p.vx=Math.cos(angle)*p.speed;
    p.vy=Math.sin(angle)*p.speed*0.55; // 가로 위주
    // .gif 도트가 본디 왼쪽 향함 → 오른쪽 이동 시 scaleX(-1)로 뒤집기
    if(Math.abs(p.vx)>0.5) p.facing=p.vx>0?-1:1;
    p.nextTurnAt=now+1100+Math.random()*1800;
  }

  // 자동 워크는 포켓몬만 (트레이너는 길찾기 모드)
  mons.forEach(p=>{ if(!p.isTrainer) pickNewDir(p,state.last); });

  // 풀밭 클릭/터치 → 트레이너 목적지 설정
  state.abortCtrl=(typeof AbortController!=='undefined')?new AbortController():null;
  const meadowClickHandler=(e)=>{
    if(!lobbyMeadowState||!trainer) return; // trainer 비활성 시 무시
    const rect=meadow.getBoundingClientRect();
    if(rect.width<=0||rect.height<=0) return;
    const lx=(e.clientX-rect.left)*(meadow.clientWidth/rect.width);
    const ly=(e.clientY-rect.top)*(meadow.clientHeight/rect.height);
    const topY=meadow.clientHeight*MEADOW_BOUNDS.topRatio;
    const botY=meadow.clientHeight-MEADOW_BOUNDS.bottomPad;
    const leftX=MEADOW_BOUNDS.sidePad;
    const rightX=meadow.clientWidth-MEADOW_BOUNDS.sidePad;
    trainer.target={
      x:Math.max(leftX,Math.min(rightX,lx)),
      y:Math.max(topY,Math.min(botY,ly)),
    };
  };
  const opts=state.abortCtrl?{signal:state.abortCtrl.signal}:false;
  meadow.addEventListener('pointerdown',meadowClickHandler,opts);
  // 클릭 영역 활성화: pointer-events 기본은 lobby-aura/포켓몬은 none이라 meadow에서 받음
  meadow.style.pointerEvents='auto';

  function tick(now){
    if(!lobbyMeadowState||!lobbyMeadowState.running) return;
    const dt=Math.min((now-state.last)/1000,0.05);
    state.last=now;
    const b=state.bounds;
    const topY=b.h*MEADOW_BOUNDS.topRatio;
    const botY=b.h-MEADOW_BOUNDS.bottomPad;
    const leftX=MEADOW_BOUNDS.sidePad;
    const rightX=b.w-MEADOW_BOUNDS.sidePad;
    const band=MEADOW_BOUNDS.edgeBand;
    const pull=MEADOW_BOUNDS.edgePull;

    for(const p of mons){
      // 트레이너는 길찾기 모드: 자동 워크/경계 회귀 모두 우회
      if(p.isTrainer){
        if(p.target){
          const dx=p.target.x-p.x, dy=p.target.y-p.y;
          const dist=Math.hypot(dx,dy);
          if(dist<3){
            p.vx=0; p.vy=0; p.target=null;
          } else {
            p.vx=dx/dist*p.speed;
            p.vy=dy/dist*p.speed;
          }
        } else {
          p.vx=0; p.vy=0;
        }
        p.x+=p.vx*dt;
        p.y+=p.vy*dt;
        if(p.x<leftX) p.x=leftX;
        if(p.x>rightX) p.x=rightX;
        if(p.y<topY) p.y=topY;
        if(p.y>botY) p.y=botY;
        p.el.style.left=p.x+'px';
        p.el.style.top=p.y+'px';
        const row=getTrainerRow(p);
        const col=getTrainerCol(p,dt);
        p.el.style.backgroundPosition=`-${p.base.x+col*TRAINER_SHEET.frame}px -${p.base.y+row*TRAINER_SHEET.frame}px`;
        continue;
      }

      if(now>=p.nextTurnAt) pickNewDir(p,now);

      // 경계 부근 점진 회귀(soft steering) — 직각 반사 대신
      if(p.x<leftX+band) p.vx += pull*dt*((leftX+band-p.x)/band);
      if(p.x>rightX-band) p.vx -= pull*dt*((p.x-(rightX-band))/band);
      if(p.y<topY+band) p.vy += pull*dt*((topY+band-p.y)/band);
      if(p.y>botY-band) p.vy -= pull*dt*((p.y-(botY-band))/band);

      // 속도 상한
      const sp=Math.hypot(p.vx,p.vy);
      const maxSp=p.speed;
      if(sp>maxSp){
        p.vx=p.vx/sp*maxSp;
        p.vy=p.vy/sp*maxSp;
      }

      p.x+=p.vx*dt;
      p.y+=p.vy*dt;

      // 안전망 클램프 (속도는 유지)
      if(p.x<leftX) p.x=leftX;
      if(p.x>rightX) p.x=rightX;
      if(p.y<topY) p.y=topY;
      if(p.y>botY) p.y=botY;

      if(Math.abs(p.vx)>0.5) p.facing=p.vx>0?-1:1;

      p.el.style.left=p.x+'px';
      p.el.style.top=p.y+'px';

      // (트레이너는 위에서 continue로 처리됨 — 여기는 포켓몬 전용)
      p.el.style.transform=`translate(-50%, -100%) scaleX(${p.facing})`;
      if(p.auraEl){
        p.auraEl.style.left=p.x+'px';
        p.auraEl.style.top=(p.y-2)+'px';
      }
    }

    // 콜라이더: 마리끼리 겹치면 서로 밀어내기 (pairwise separation)
    // 각자 collideR 반경 기준, 거리가 r1+r2보다 가까우면 절반씩 정반대로 push.
    // 한 프레임당 1패스로 충분 (다음 프레임에서 잔여 겹침 추가 분리).
    for(let i=0;i<mons.length;i++){
      const a=mons[i];
      if(a.isTrainer) continue;
      for(let j=i+1;j<mons.length;j++){
        const c=mons[j];
        if(c.isTrainer) continue;
        const minD=(a.collideR||24)+(c.collideR||24);
        const dx=c.x-a.x, dy=c.y-a.y;
        const d=Math.hypot(dx,dy);
        if(d>0.001&&d<minD){
          const overlap=(minD-d)*0.5;
          const ux=dx/d, uy=dy/d;
          a.x-=ux*overlap; a.y-=uy*overlap;
          c.x+=ux*overlap; c.y+=uy*overlap;
          // 클램프 재적용 (push로 경계 밖으로 밀려날 수 있음)
          if(a.x<leftX) a.x=leftX; if(a.x>rightX) a.x=rightX;
          if(a.y<topY)  a.y=topY;  if(a.y>botY)  a.y=botY;
          if(c.x<leftX) c.x=leftX; if(c.x>rightX) c.x=rightX;
          if(c.y<topY)  c.y=topY;  if(c.y>botY)  c.y=botY;
          a.el.style.left=a.x+'px'; a.el.style.top=a.y+'px';
          c.el.style.left=c.x+'px'; c.el.style.top=c.y+'px';
          if(a.auraEl){ a.auraEl.style.left=a.x+'px'; a.auraEl.style.top=(a.y-2)+'px'; }
          if(c.auraEl){ c.auraEl.style.left=c.x+'px'; c.auraEl.style.top=(c.y-2)+'px'; }
        }
      }
    }

    // z-order: 아래쪽(=y큰) 친구가 앞에 보이도록.
    // 각 마리에 (i*2+1) 부여하고, aura는 (i*2)로 항상 자기 도트 바로 뒤에 배치.
    mons.slice().sort((a,b)=>a.y-b.y).forEach((p,i)=>{
      p.el.style.zIndex=String(i*2+1);
      if(p.auraEl) p.auraEl.style.zIndex=String(i*2);
    });

    state.raf=requestAnimationFrame(tick);
  }

  lobbyMeadowState=state;
  state.raf=requestAnimationFrame(tick);
}

function stopLobbyMeadow(){
  if(!lobbyMeadowState) return;
  lobbyMeadowState.running=false;
  cancelAnimationFrame(lobbyMeadowState.raf);
  if(lobbyMeadowState.abortCtrl) lobbyMeadowState.abortCtrl.abort();
  lobbyMeadowState=null;
  const meadow=document.getElementById('lobby-meadow');
  if(meadow) meadow.innerHTML='';
}

// ── 오박사 인트로 시퀀스 ──
// 캐릭터 생성 + 닉네임 직후 1회 진행. 6종 자동 등장 → 도감 등록 + 덱 자동 장착.
function getStarterIds(){
  // DEFAULT_SLOTS가 슬롯 순서의 진실의 원천 — monster_table은 검증용으로만 사용
  if(typeof DEFAULT_SLOTS!=='undefined' && DEFAULT_SLOTS.length>=6) return [...DEFAULT_SLOTS];
  if(typeof MONSTER_TABLE_DATA!=='undefined'&&MONSTER_TABLE_DATA.monsters){
    const filtered=MONSTER_TABLE_DATA.monsters.filter(m=>m.is_starter).map(m=>m.id);
    if(filtered.length>=6) return filtered.slice(0,6);
  }
  return [1,4,7,10,25,16]; // 디자인 사양 fallback (이상해씨/파이리/꼬부기/캐터피/피카츄/구구)
}

function runIntroSequence(){
  const listEl=document.getElementById('intro-pokemons');
  const nextBtn=document.getElementById('intro-next-btn');
  if(!listEl||!nextBtn) return;

  const starters=getStarterIds();
  listEl.innerHTML='';
  nextBtn.disabled=true;

  starters.forEach((dexId,i)=>{
    const img=document.createElement('img');
    img.className='intro-pokemon';
    img.src=`assets/dot/pokemon/${dexId}.gif`;
    img.alt='';
    img.draggable=false;
    img.style.animationDelay=(0.6+i*0.35)+'s';
    listEl.appendChild(img);
  });

  // 마지막 등장 후 버튼 활성화
  const totalMs=600+starters.length*350+300;
  setTimeout(()=>{ nextBtn.disabled=false; }, totalMs);

  nextBtn.onclick=()=>{
    // 도감 풀스펙으로 6종 포획 등록 (state=captured + biggest/smallest 기준치 시드)
    if(typeof captureNow==='function'){
      for(const id of starters) captureNow(id);
    } else {
      // 폴백: dex.js 미로드 환경
      localStorage.setItem('hexPuzzleDexCaught',JSON.stringify(starters));
    }
    localStorage.setItem('hexPuzzleSlots',JSON.stringify(starters));
    localStorage.setItem('hexPuzzleIntroDone','1');
    // skinData 메모리 캐시 갱신 — startGame이 옛 슬롯 쓰는 버그 방지
    if(typeof loadSkinData==='function') skinData=loadSkinData();
    if(typeof showScreen==='function') showScreen('lobby-screen');
    if(typeof updateLobbyProfile==='function') updateLobbyProfile();
    if(typeof updateLobbyStage==='function') updateLobbyStage();
  };
}
