// ── 헥사 3매치 퍼즐 ──

const COLS_PATTERN = [9, 8, 9, 8, 9, 8, 9, 8, 9];
const HEX_SIZE = 36;
const HEX_W = HEX_SIZE * 2;
const HEX_H = Math.sqrt(3) * HEX_SIZE;
const COL_SPACING = HEX_SIZE * 1.5;
const ROW_SPACING = HEX_H;
const BLOCK_D = 55;
// ── 스테이지 데이터 ──
const STAGES = [
  { stage:1,  target:10000, moves:30, colorTypes:5 },
  { stage:2,  target:15000, moves:28, colorTypes:5 },
  { stage:3,  target:20000, moves:26, colorTypes:6 },
  { stage:4,  target:25000, moves:25, colorTypes:6 },
  { stage:5,  target:30000, moves:24, colorTypes:7 },
  { stage:6,  target:35000, moves:23, colorTypes:7 },
  { stage:7,  target:40000, moves:22, colorTypes:7 },
  { stage:8,  target:45000, moves:21, colorTypes:7 },
  { stage:9,  target:48000, moves:20, colorTypes:7 },
  { stage:10, target:50000, moves:20, colorTypes:7 },
];
let currentStage = parseInt(localStorage.getItem('hexPuzzleStage')) || 1;
let stageTarget = STAGES[0].target;

const ALL_COLORS = [
  { name:'red',bg:'#e74c3c' },{ name:'orange',bg:'#f39c12' },
  { name:'yellow',bg:'#f1c40f' },{ name:'green',bg:'#2ecc71' },
  { name:'blue',bg:'#3498db' },{ name:'indigo',bg:'#5b6abf' },
  { name:'violet',bg:'#9b59b6' },
];

// ── 조절 가능한 설정값 ──
const CFG = {
  gravityTransition: 0.2,   gravityDelay: 240,
  fillTransition: 0.2,      fillDelay: 200,
  diagTransition: 0.15,     diagDelay: 180,
  projectileTransition: 0.45,
  matchedDelay: 200,         mergeDelay: 130,
  explosionLifetime: 400,
  specialActivateDelay: 100, crossEffectDelay: 200,
  score3match: 300, score4match: 500, score5match: 800,
  combo2bonus: 500, combo3bonus: 1000, combo4bonus: 2000,
};
const CFG_DEFAULTS = {...CFG};
const CFG_META = [
  {key:'gravityTransition',label:'gravity transition',desc:'매치 후 블록이 아래로 떨어지는 애니메이션 시간. 낮을수록 빠르게 착지 (권장: 0.1s ~ 0.5s)',unit:'s',step:0.05,group:'speed'},
  {key:'gravityDelay',label:'gravity delay',desc:'낙하 애니메이션 완료 후 다음 단계 진행까지 대기 시간. gravity transition보다 약간 길게 설정 (권장: 100ms ~ 500ms)',unit:'ms',step:10,group:'speed'},
  {key:'fillTransition',label:'fill transition',desc:'빈 칸에 새 블록이 위에서 내려오는 애니메이션 시간. 낮을수록 빠르게 충전 (권장: 0.1s ~ 0.6s)',unit:'s',step:0.05,group:'speed'},
  {key:'fillDelay',label:'fill delay',desc:'새 블록 충전 완료 후 매치 검사까지 대기 시간. fill transition보다 약간 길게 설정 (권장: 150ms ~ 600ms)',unit:'ms',step:10,group:'speed'},
  {key:'diagTransition',label:'diag transition',desc:'대각선 충전 시 블록이 옆으로 이동하는 애니메이션 시간. 낮을수록 빠름 (권장: 0.05s ~ 0.4s)',unit:'s',step:0.05,group:'speed'},
  {key:'diagDelay',label:'diag delay',desc:'대각선 충전 완료 후 다음 단계까지 대기 시간 (권장: 50ms ~ 400ms)',unit:'ms',step:10,group:'speed'},
  {key:'projectileTransition',label:'projectile transition',desc:'타겟볼 발사체가 목표 지점까지 날아가는 시간. 낮으면 빠르게 적중 (권장: 0.1s ~ 0.6s)',unit:'s',step:0.05,group:'speed'},
  {key:'matchedDelay',label:'matched delay',desc:'매치된 블록의 pop 애니메이션 재생 후 DOM에서 제거까지 대기 시간 (권장: 200ms ~ 500ms)',unit:'ms',step:10,group:'timing'},
  {key:'mergeDelay',label:'merge delay',desc:'특수블록 생성 시 주변 블록이 중심으로 빨려드는 머지 애니메이션 시간 (권장: 200ms ~ 500ms)',unit:'ms',step:10,group:'timing'},
  {key:'explosionLifetime',label:'explosion lifetime',desc:'폭탄볼 폭발 이펙트(원형 파동)가 화면에 표시되는 시간 (권장: 300ms ~ 700ms)',unit:'ms',step:10,group:'timing'},
  {key:'specialActivateDelay',label:'special activate delay',desc:'특수블록이 발동한 후 파괴된 블록이 사라지기까지 대기하는 시간. 짧으면 발동 연출이 빠르게 진행돼요 (권장: 50ms ~ 500ms)',unit:'ms',step:10,group:'timing'},
  {key:'crossEffectDelay',label:'cross effect delay',desc:'특수블록 교차 효과 발동 후 파괴된 블록이 사라지기까지 대기하는 시간. 짧으면 교차 연출이 빠르게 진행돼요 (권장: 50ms ~ 500ms)',unit:'ms',step:10,group:'timing'},
  {key:'score3match',label:'3매치 점수',desc:'블록 3개를 한 줄로 매치했을 때 획득하는 기본 점수 (권장: 100 ~ 500)',unit:'',step:50,group:'score'},
  {key:'score4match',label:'4매치 점수',desc:'블록 4개를 한 줄로 매치했을 때 획득하는 점수. 특수블록도 함께 생성됨 (권장: 300 ~ 800)',unit:'',step:50,group:'score'},
  {key:'score5match',label:'5매치 점수',desc:'블록 5개를 한 줄로 매치했을 때 획득하는 점수. 상위 특수블록 생성 (권장: 500 ~ 1500)',unit:'',step:50,group:'score'},
  {key:'combo2bonus',label:'2연쇄 보너스',desc:'연쇄 2회 달성 시 추가 보너스 점수. 연쇄가 시작되는 첫 보상 (권장: 200 ~ 1000)',unit:'',step:100,group:'score'},
  {key:'combo3bonus',label:'3연쇄 보너스',desc:'연쇄 3회 달성 시 추가 보너스 점수 (권장: 500 ~ 2000)',unit:'',step:100,group:'score'},
  {key:'combo4bonus',label:'4연쇄+ 보너스',desc:'연쇄 4회 이상 달성 시 추가 보너스 점수. 최대 보상 단계 (권장: 1000 ~ 5000)',unit:'',step:100,group:'score'},
];

function calcLineScore(len) {
  if(len===3) return CFG.score3match; if(len===4) return CFG.score4match;
  if(len===5) return CFG.score5match; return len*200;
}
function calcComboBonus(combo) {
  if(combo===2) return CFG.combo2bonus; if(combo===3) return CFG.combo3bonus;
  if(combo>=4) return CFG.combo4bonus; return 0;
}

// ── 스킨 시스템 ──
const SPRITE_SHEET='pokemon_sprites_1.png';
const SPRITE_COLS=15, SPRITE_SIZE=215, SHEET_W=3228, SHEET_H=2375;
const DEFAULT_UNLOCKED=[1,4,7,10,15,20,25];
const DEFAULT_SLOTS=[1,4,7,10,15,20,25];

function loadSkinData(){
  let unlocked=JSON.parse(localStorage.getItem('hexPuzzleUnlocked')||'null');
  if(!unlocked){ unlocked=[...DEFAULT_UNLOCKED]; localStorage.setItem('hexPuzzleUnlocked',JSON.stringify(unlocked)); }
  let slots=JSON.parse(localStorage.getItem('hexPuzzleSlots')||'null');
  if(!slots){ slots=[...DEFAULT_SLOTS]; localStorage.setItem('hexPuzzleSlots',JSON.stringify(slots)); }
  return {unlocked,slots};
}
function saveSkinData(unlocked,slots){
  localStorage.setItem('hexPuzzleUnlocked',JSON.stringify(unlocked));
  localStorage.setItem('hexPuzzleSlots',JSON.stringify(slots));
}

let skinData=loadSkinData();

function getPokemonBgStyle(pokeNum,displaySize){
  const col=(pokeNum-1)%SPRITE_COLS;
  const row=Math.floor((pokeNum-1)/SPRITE_COLS);
  // 실제 셀 간격 = 시트 크기 / 셀 수 (정수 나누기 오차 보정)
  const cellW=SHEET_W/SPRITE_COLS, cellH=SHEET_H/11;
  const scale=displaySize/cellW;
  const bgW=SHEET_W*scale, bgH=SHEET_H*scale;
  return {
    backgroundImage:`url(${SPRITE_SHEET})`,
    backgroundPosition:`${-(col*cellW*scale)}px ${-(row*cellH*scale)}px`,
    backgroundSize:`${bgW}px ${bgH}px`,
    backgroundRepeat:'no-repeat',
  };
}

function applyPokemonBg(el,pokeNum,displaySize,transparent){
  const s=getPokemonBgStyle(pokeNum,displaySize);
  el.style.backgroundImage=s.backgroundImage;
  el.style.backgroundPosition=s.backgroundPosition;
  el.style.backgroundSize=s.backgroundSize;
  el.style.backgroundRepeat=s.backgroundRepeat;
  el.style.backgroundColor=transparent?'transparent':'#fff';
}

// ── 스테이지 맵 데이터 ──
let stageMaps=null; // stage_maps.json에서 로드

async function loadStageMaps(){
  try{
    const res=await fetch('stage_maps.json');
    stageMaps=await res.json();
  }catch(e){ console.warn('stage_maps.json 로드 실패:',e); stageMaps={stages:[]}; }
}

function applyStageGimmicks(stageNum){
  if(!stageMaps) return;
  const stageData=stageMaps.stages.find(s=>s.stage===stageNum);
  if(!stageData||!stageData.gimmicks) return;
  for(const g of stageData.gimmicks){
    if(!gimmick[g.col]) gimmick[g.col]=[];
    gimmick[g.col][g.row]={type:g.type,level:g.level};
  }
}

// ── 상태 ──
let numColors=5, maxMoves=30, movesLeft=30, score=0;
let playing=false, busy=false;
let highScore=parseInt(localStorage.getItem('hexPuzzleHighScore'))||0;
let isDarkMode = localStorage.getItem('hexPuzzleDarkMode') !== 'false'; // default true
let hoveredCell = null; // for debug remove
let lastMouseX = 0, lastMouseY = 0;
let debugPlaceType = null; // null | 'stripe' | 'target' | 'bomb' | 'rainbow'
// board[col][row] = { color, type:'normal'|'stripe'|'target'|'bomb'|'rainbow', dir } | null
const board=[], blockEls=[], cellPos=[];
// gimmick[col][row] = { type:'stone', level:1~5 } | null
const gimmick=[], gimmickEls=[];
let totalStones=0; // 남은 돌 총 개수
let initialStones=0; // 시작 시 돌 총 개수 (승리조건 판별용)
let dragState=null;
const DRAG_THRESHOLD=20;
let hintTimer=null, hintedCells=[];
const HINT_DELAY=5000;

// ── 매치 로그 ──
const matchLogs=[];
const MAX_MATCH_LOGS=20;

function formatLogTime(d){
  const mm=String(d.getMonth()+1).padStart(2,'0');
  const dd=String(d.getDate()).padStart(2,'0');
  const hh=String(d.getHours()).padStart(2,'0');
  const mi=String(d.getMinutes()).padStart(2,'0');
  const ss=String(d.getSeconds()).padStart(2,'0');
  return `${mm}.${dd} ${hh}:${mi}:${ss}`;
}

function addMatchLog(combo,type,destroyedCount){
  const time=formatLogTime(new Date());
  matchLogs.unshift({time,combo,type,destroyedCount,skipDelay});
  if(matchLogs.length>MAX_MATCH_LOGS) matchLogs.length=MAX_MATCH_LOGS;
  renderMatchLogs();
}

function renderMatchLogs(){
  const el=document.getElementById('dev-match-log-list');
  if(!el) return;
  el.innerHTML='';
  for(const log of matchLogs){
    const div=document.createElement('div');
    div.className='match-log-line'+(log.skipDelay?' skip-delay':'');
    div.textContent=`[${log.time}] ${log.combo}콤보 | ${log.type} | 제거${log.destroyedCount}개 | skipDelay:${log.skipDelay}`;
    el.appendChild(div);
  }
}

function clearMatchLogs(){
  matchLogs.length=0;
  renderMatchLogs();
}

// ── 실시간 매칭 ──
// isBusyRainbow: true면 조작 불가 (무지개볼 연출 중)
// isBusyNormal: true면 일반 연출 중이지만 조작 가능
let isBusyRainbow=false;
let isBusyNormal=false;

// ── 애니메이션 직렬화 큐 ──
const animQueue=[];  // [{fn, ts}, ...]
let animRunning=false;
let skipDelay=false; // true면 delay()가 즉시 resolve → 연출 빠르게 감기
const SWAP_EXPIRE_MS=1500; // 입력 만료 시간

function enqueueAnim(asyncFn){
  animQueue.push({fn:asyncFn, ts:Date.now()});
  if(animRunning) skipDelay=true;
  if(!animRunning) drainAnimQueue();
}

async function drainAnimQueue(){
  animRunning=true;
  while(animQueue.length>0){
    const item=animQueue.shift();
    if(Date.now()-item.ts>SWAP_EXPIRE_MS){
      console.log('[animQueue] 만료된 입력 버림');
      continue;
    }
    skipDelay=animQueue.length>0;
    try{ await item.fn(); }catch(e){ console.error('[animQueue]',e); }
  }
  skipDelay=false;
  animRunning=false;
}

// ── 헬퍼 ──
function makeCell(color,type,dir){ return {color,type:type||'normal',dir:dir||null}; }
function getColor(c,r){ const cell=board[c]?.[r]; if(!cell||cell.type!=='normal') return null; return cell.color ?? null; }
function getType(c,r){ return board[c]?.[r]?.type ?? null; }
function isSpecial(c,r){ const t=getType(c,r); return t&&t!=='normal'; }
function getMostFrequentColor(){
  const counts=new Map();
  for(let c=0;c<COLS_PATTERN.length;c++)
    for(let r=0;r<COLS_PATTERN[c];r++)
      if(board[c][r]&&board[c][r].type==='normal'){
        const col=board[c][r].color;
        counts.set(col,(counts.get(col)||0)+1);
      }
  if(counts.size===0) return null;
  let best=null,bestCnt=0;
  for(const [color,cnt] of counts) if(cnt>bestCnt){bestCnt=cnt;best=color;}
  return best;
}
function isValid(c,r){ return c>=0 && c<COLS_PATTERN.length && r>=0 && r<COLS_PATTERN[c]; }
function isLongCol(c){ return COLS_PATTERN[c]===9; }
function getCellPos(col,row){
  return { x:col*COL_SPACING, y:row*ROW_SPACING+(isLongCol(col)?0:ROW_SPACING*0.5) };
}
function getBlockPos(col,row){
  const cp=cellPos[col][row];
  return { x:cp.x+(HEX_W-BLOCK_D)/2, y:cp.y+(HEX_H-BLOCK_D)/2 };
}
function getNeighbors(col,row){
  const long=isLongCol(col);
  const off=[[0,-1],[0,1],...(long?[[-1,-1],[-1,0],[1,-1],[1,0]]:[[-1,0],[-1,1],[1,0],[1,1]])];
  return off.map(([dc,dr])=>[col+dc,row+dr]).filter(([c,r])=>isValid(c,r));
}
function isAdjacent(c1,r1,c2,r2){ return getNeighbors(c1,r1).some(([c,r])=>c===c2&&r===r2); }
let gameSpeed=1; // 게임 배속 (0.5~5x)
const SPEED_STEPS=[0.5,1,2,3,4,5];
function delay(ms){ return new Promise(r=>setTimeout(r, Math.round(ms/gameSpeed))); }
function skippableDelay(ms){ return new Promise(r=>setTimeout(r, skipDelay?0:Math.round(ms/gameSpeed))); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

// ── 6방향 이동 ──
function step(col,row,dir){
  const long=isLongCol(col); let dc,dr;
  switch(dir){
    case'up':dc=0;dr=-1;break;case'down':dc=0;dr=1;break;
    case'ne':[dc,dr]=long?[1,-1]:[1,0];break;case'sw':[dc,dr]=long?[-1,0]:[-1,1];break;
    case'nw':[dc,dr]=long?[-1,-1]:[-1,0];break;case'se':[dc,dr]=long?[1,0]:[1,1];break;
  }
  const nc=col+dc,nr=row+dr; return isValid(nc,nr)?[nc,nr]:null;
}
const AXES=[['up','down'],['ne','sw'],['nw','se']];

function getSwapDirection(c1,r1,c2,r2){
  const dc=c2-c1,dr=r2-r1,long=isLongCol(c1);
  if(dc===0&&dr===-1) return 'up'; if(dc===0&&dr===1) return 'down';
  if(long){ if(dc===1&&dr===-1) return 'ne'; if(dc===1&&dr===0) return 'se'; if(dc===-1&&dr===-1) return 'nw'; if(dc===-1&&dr===0) return 'sw'; }
  else { if(dc===1&&dr===0) return 'ne'; if(dc===1&&dr===1) return 'se'; if(dc===-1&&dr===0) return 'nw'; if(dc===-1&&dr===1) return 'sw'; }
  return null;
}
function getStripeAxis(dir){ for(const [a,b] of AXES) if(dir===a||dir===b) return [a,b]; return ['up','down']; }
function getStripeAngle(dir){
  switch(dir){ case'up':case'down':return 90; case'ne':case'sw':return -30; case'nw':case'se':return 30; } return 0;
}
function getStripeImage(dir){
  switch(dir){ case'up':case'down':return 'assets/specialblock/sb_stripe1.png';
    case'se':case'nw':return 'assets/specialblock/sb_stripe2.png';
    case'ne':case'sw':return 'assets/specialblock/sb_stripe3.png'; }
  return 'assets/specialblock/sb_stripe1.png';
}
const SPECIAL_IMAGES={bomb:'assets/specialblock/sb_bombball.png',target:'assets/specialblock/sb_targetball.png',rainbow:'assets/specialblock/sb_rainbow.png'};
const OPPOSITE_DIR={up:'down',down:'up',ne:'sw',sw:'ne',nw:'se',se:'nw'};
function getLineDirFromCells(line){
  const [c0,r0]=line[0],[c1,r1]=line[1];
  if(c1-c0===0) return 'up';
  const p0=getBlockPos(c0,r0),p1=getBlockPos(c1,r1);
  return Math.atan2(p1.y-p0.y,p1.x-p0.x)<0?'ne':'se';
}

// ── 매치 감지 ──
function countLine(col,row,dir,color){
  let n=0,pos=step(col,row,dir);
  while(pos&&getColor(pos[0],pos[1])===color){n++;pos=step(pos[0],pos[1],dir);}
  return n;
}
function hasMatchAt(col,row){
  const color=getColor(col,row); if(color===null) return false;
  for(const [a,b] of AXES) if(1+countLine(col,row,a,color)+countLine(col,row,b,color)>=3) return true;
  return false;
}
function findAllMatches(){
  const lines=[],visited=new Set();
  for(let col=0;col<COLS_PATTERN.length;col++)
    for(let row=0;row<COLS_PATTERN[col];row++){
      const color=getColor(col,row); if(color===null) continue;
      for(const [dirA,dirB] of AXES){
        const line=[[col,row]];
        let pos=step(col,row,dirA);
        while(pos&&getColor(pos[0],pos[1])===color){line.push(pos);pos=step(pos[0],pos[1],dirA);}
        pos=step(col,row,dirB);
        while(pos&&getColor(pos[0],pos[1])===color){line.push(pos);pos=step(pos[0],pos[1],dirB);}
        if(line.length>=3){
          const key=dirA+'-'+line.map(([c,r])=>`${c},${r}`).sort().join('|');
          if(!visited.has(key)){visited.add(key);lines.push(line);}
        }
      }
    }
  const cellSet=new Set();
  for(const l of lines) l.forEach(([c,r])=>cellSet.add(`${c},${r}`));

  // 타겟볼 감지: 3가지 평행사변형 패턴 (4셀) + 확장 (5셀)
  // 평행사변형 = 기준점에서 두 방향(dirA, dirB)으로 각각 1칸 + 대각(dirA+dirB) 1칸
  const clusters=[];
  const foundKeys=new Set(); // 중복 방지
  // 3가지 방향 쌍: (up,ne), (up,nw), (ne,nw)
  const paraDirs=[['up','ne'],['up','nw'],['ne','nw']];
  for(let col=0;col<COLS_PATTERN.length;col++){
    for(let row=0;row<COLS_PATTERN[col];row++){
      const cell=board[col][row];
      if(!cell||cell.type!=='normal') continue;
      const color=cell.color;
      for(const [dA,dB] of paraDirs){
        // 기준점(col,row) → dA → dB → dA+dB (4셀 평행사변형)
        const pA=step(col,row,dA); if(!pA) continue;
        const pB=step(col,row,dB); if(!pB) continue;
        const pAB=step(pA[0],pA[1],dB); if(!pAB) continue;
        // 4셀 모두 같은 색 normal인지 확인
        const check=(c,r)=>{const cc=board[c]?.[r];return cc&&cc.type==='normal'&&cc.color===color;};
        if(!check(pA[0],pA[1])||!check(pB[0],pB[1])||!check(pAB[0],pAB[1])) continue;
        const base=[[col,row],pA,pB,pAB];
        const key=base.map(([c,r])=>`${c},${r}`).sort().join('|');
        if(foundKeys.has(key)) continue;
        foundKeys.add(key);
        // 확장: base 4셀에 인접한 같은 색 블록 1개 추가 (5셀)
        const baseSet=new Set(base.map(([c,r])=>`${c},${r}`));
        let extended=null;
        for(const [bc,br] of base){
          for(const [nc,nr] of getNeighbors(bc,br)){
            const nk=`${nc},${nr}`;
            if(baseSet.has(nk)) continue;
            if(check(nc,nr)){
              const extCells=[...base,[nc,nr]];
              const extKey=extCells.map(([c,r])=>`${c},${r}`).sort().join('|');
              if(!foundKeys.has(extKey)){
                foundKeys.add(extKey);
                extended={color,cells:extCells,size:5};
              }
              break;
            }
          }
          if(extended) break;
        }
        // 확장 5셀 우선, 없으면 기본 4셀
        clusters.push(extended||{color,cells:base,size:base.length});
      }
    }
  }

  return {lines,cells:[...cellSet].map(k=>k.split(',').map(Number)),clusters};
}

// ── 줄볼 유틸 ──
function getStripeLine(col,row,dir){
  const axis=getStripeAxis(dir),result=[];
  for(const d of axis){let pos=step(col,row,d);while(pos){result.push(pos);pos=step(pos[0],pos[1],d);}}
  return result;
}

// ── 교차 효과 헬퍼 ──
// 2칸 범위 내 모든 셀 (폭탄x폭탄용, ~19칸)
function getCellsInRange2(col,row){
  const result=new Set();
  result.add(`${col},${row}`);
  for(const [nc,nr] of getNeighbors(col,row)){
    result.add(`${nc},${nr}`);
    for(const [nc2,nr2] of getNeighbors(nc,nr)) result.add(`${nc2},${nr2}`);
  }
  return [...result].map(k=>k.split(',').map(Number));
}
// 줄볼 방향의 수직 오프셋 방향 2개
function getPerpDirs(dir){
  const axis=getStripeAxis(dir),key=axis.slice().sort().join(',');
  return {'down,up':['ne','nw'],'ne,sw':['nw','se'],'nw,se':['ne','sw']}[key]||['ne','nw'];
}
// 3줄 스트라이프 셀 (줄볼x폭탄볼용)
function get3LineStripeCells(col,row,dir){
  const cells=new Set(),axis=getStripeAxis(dir),perpDirs=getPerpDirs(dir);
  const origins=[[col,row]];
  for(const pd of perpDirs){const s=step(col,row,pd);if(s) origins.push(s);}
  for(const [oc,or_] of origins){
    cells.add(`${oc},${or_}`);
    for(const d of axis){let pos=step(oc,or_,d);while(pos){cells.add(`${pos[0]},${pos[1]}`);pos=step(pos[0],pos[1],d);}}
  }
  return [...cells].map(k=>k.split(',').map(Number));
}

// ── 연결 그룹 탐색 (같은 색 매치셀 인접 연결) ──
function findConnectedGroups(matchedCells){
  const byColor={};
  for(const [c,r] of matchedCells){
    const color=getColor(c,r); if(color===null) continue;
    if(!byColor[color]) byColor[color]=[];
    byColor[color].push([c,r]);
  }
  const results=[];
  for(const [color,cells] of Object.entries(byColor)){
    if(cells.length<4) continue;
    const keySet=new Set(cells.map(([c,r])=>`${c},${r}`));
    const visited=new Set();
    for(const [sc,sr] of cells){
      const sk=`${sc},${sr}`; if(visited.has(sk)) continue;
      const group=[],stk=[[sc,sr]];
      while(stk.length){
        const [c,r]=stk.pop(),k=`${c},${r}`;
        if(visited.has(k)||!keySet.has(k)) continue;
        visited.add(k); group.push([c,r]);
        for(const [nc,nr] of getNeighbors(c,r)) stk.push([nc,nr]);
      }
      if(group.length<4) continue;
      // 그룹 내 최대 직선 길이 계산
      const groupSet=new Set(group.map(([c,r])=>`${c},${r}`));
      let maxLine=0;
      for(const [dirA,dirB] of AXES){
        for(const [gc,gr] of group){
          let len=1;
          let pos=step(gc,gr,dirA);
          while(pos&&groupSet.has(`${pos[0]},${pos[1]}`)){len++;pos=step(pos[0],pos[1],dirA);}
          pos=step(gc,gr,dirB);
          while(pos&&groupSet.has(`${pos[0]},${pos[1]}`)){len++;pos=step(pos[0],pos[1],dirB);}
          if(len>maxLine) maxLine=len;
        }
      }
      const isStraight=maxLine===group.length; // 전체가 1자 직선
      const hasLine=maxLine>=3;                 // 3+ 직선 포함 여부
      results.push({color:parseInt(color),cells:group,isStraight,hasLine,size:group.length});
    }
  }
  return results;
}

// ── 특수블록 생성 판정 (우선순위: 무지개 > 폭탄 > 줄볼 > 타겟볼) ──
function determineSpecial(curLines,curCells,clusters,isFirst,originCol,originRow,destCol,destRow,swapDir){
  // 1) 후보 라인을 찾는다
  let bestLine5=null,bestLine4=null;
  for(const line of curLines){
    if(line.length>=5 && !bestLine5) bestLine5=line;
    if(line.length>=4 && !bestLine4) bestLine4=line;
  }
  // 2) 라인 매치 셀로 연결 그룹 (폭탄볼용: 교차/겹침 라인으로 5+셀 비직선)
  const lineGroups=findConnectedGroups(curCells);
  let bombGroup=null;
  for(const g of lineGroups){
    if(g.size>=5 && !g.isStraight && !bombGroup) bombGroup=g;
  }
  // 3) BFS 클러스터 (타겟볼용: findAllMatches에서 이미 자격 필터링됨)
  let targetGroup=null;
  if(clusters.length>0) targetGroup=clusters[0];

  function getSwapPivot(cells){
    if(!isFirst) return null;
    const swapSet=new Set([`${originCol},${originRow}`, `${destCol},${destRow}`]);
    const inSwap=cells.filter(([c,r])=>swapSet.has(`${c},${r}`));
    if(inSwap.length===1) return {col:inSwap[0][0],row:inSwap[0][1]};
    if(inSwap.length===2){
      let sumx=0,sumy=0;
      cells.forEach(([c,r])=>{const p=getBlockPos(c,r);sumx+=p.x;sumy+=p.y;});
      const center={x:sumx/cells.length,y:sumy/cells.length};
      let best=null,bestD=Infinity;
      for(const [c,r] of inSwap){
        const p=getBlockPos(c,r);
        const d=(p.x-center.x)**2+(p.y-center.y)**2;
        if(d<bestD){bestD=d;best={col:c,row:r};}
      }
      return best;
    }
    return null;
  }

  function choosePivot(cells){
    if(!cells||cells.length===0) return null;
    const swapPivot=getSwapPivot(cells);
    if(swapPivot) return swapPivot;
    if(!isFirst){
      const pick=cells[Math.floor(Math.random()*cells.length)];
      return {col:pick[0],row:pick[1]};
    }
    const mid=cells[Math.floor(cells.length/2)];
    return {col:mid[0],row:mid[1]};
  }

  // 1순위: 무지개볼 (직선5+)
  if(bestLine5){
    const pivot=choosePivot(bestLine5);
    return {type:'rainbow',col:pivot.col,row:pivot.row,color:null,dir:null,mergeCells:bestLine5};
  }

  // 2순위: 폭탄볼 (라인 매치 5+셀, 비직선 — 교차/겹침 라인)
  if(bombGroup){
    const pivot=choosePivot(bombGroup.cells);
    return {type:'bomb',col:pivot.col,row:pivot.row,color:null,dir:null,mergeCells:bombGroup.cells};
  }

  // 3순위: 줄볼 (직선4+)
  if(bestLine4){
    const pivot=choosePivot(bestLine4);
    const dir=isFirst?swapDir:getLineDirFromCells(bestLine4);
    return {type:'stripe',col:pivot.col,row:pivot.row,color:null,dir,mergeCells:bestLine4};
  }

  // 4순위: 타겟볼 (직선 없는 클러스터 4+)
  if(targetGroup){
    const pivot=choosePivot(targetGroup.cells);
    return {type:'target',col:pivot.col,row:pivot.row,color:null,dir:null,mergeCells:targetGroup.cells};
  }

  return null;
}

// ── 랜덤 블록 좌표 ──
function getRandomBlockPos(excludeSet){
  const cands=[];
  for(let c=0;c<COLS_PATTERN.length;c++) for(let r=0;r<COLS_PATTERN[c];r++)
    if(board[c][r]!==null&&(!excludeSet||!excludeSet.has(`${c},${r}`))) cands.push([c,r]);
  return cands.length?cands[Math.floor(Math.random()*cands.length)]:null;
}

// ── 보드 초기화 ──
// 같은 색 인접 블록 클러스터 크기 체크 (초기 배치 검증용)
function hasClusterAt(col,row){
  const color=getColor(col,row);
  if(color===null) return false;
  const visited=new Set();
  const stk=[[col,row]];
  let count=0;
  while(stk.length){
    const [c,r]=stk.pop();
    const k=`${c},${r}`;
    if(visited.has(k)) continue;
    if(getColor(c,r)!==color) continue;
    visited.add(k);
    count++;
    if(count>=4) return true;
    for(const [nc,nr] of getNeighbors(c,r)) stk.push([nc,nr]);
  }
  return false;
}

function initBoard(){
  for(let col=0;col<COLS_PATTERN.length;col++){
    board[col]=[];
    if(!gimmick[col]) gimmick[col]=[];
    if(!gimmickEls[col]) gimmickEls[col]=[];
    for(let row=0;row<COLS_PATTERN[col];row++){
      if(gimmick[col][row]){ board[col][row]=null; continue; }
      const idx=shuffle([...Array(numColors).keys()]);
      for(const c of idx){ board[col][row]=makeCell(c); if(!hasMatchAt(col,row)&&!hasClusterAt(col,row)) break; }
    }
  }
}

// ── boardData: 보드 로직 레이어 ──
// 순수 보드 로직 함수/데이터를 하나의 네임스페이스로 묶음
// 기존 전역 함수는 그대로 유지 (호이스팅), boardData는 참조를 모음
// 2단계부터 이 객체를 통해 로직/애니메이션 분리 진행
const boardData = {
  // ── 데이터 ──
  board,               // board[col][row] = {color, type, dir} | null
  cellPos,             // cellPos[col][row] = {x, y} — 셀 좌표 (createCells에서 채움)
  get numColors(){ return numColors; },
  set numColors(v){ numColors = v; },

  // ── 상수 ──
  COLS_PATTERN,
  AXES,
  HEX_W, HEX_H, HEX_SIZE, COL_SPACING, ROW_SPACING, BLOCK_D,

  // ── 셀/블록 생성 ──
  makeCell,

  // ── 보드 접근자 ──
  getColor, getType, isSpecial, isValid, isLongCol,

  // ── 좌표 계산 ──
  getCellPos, getBlockPos,

  // ── 인접/이동 ──
  getNeighbors, isAdjacent, step,

  // ── 방향/축 유틸 ──
  getSwapDirection, getStripeAxis, getStripeAngle, getLineDirFromCells,

  // ── 매치 감지 ──
  countLine, hasMatchAt, findAllMatches,
  findConnectedGroups, determineSpecial,

  // ── 특수블록 범위 계산 ──
  getStripeLine, getCellsInRange2, getPerpDirs, get3LineStripeCells,
  getRandomBlockPos,

  // ── 보드 조작 ──
  swapBoard, executeSwap, hasClusterAt, initBoard,
  computeGravity, computeFill, computeSpecialEffect,

  // ── 점수 계산 ──
  calcLineScore, calcComboBonus,

  // ── 힌트 (순수 로직) ──
  findBestSwap,
};

// ── 렌더링 ──
function createCells(){
  const container=document.getElementById('grid-container');
  document.documentElement.style.setProperty('--hex-w',`${HEX_W}px`);
  document.documentElement.style.setProperty('--hex-h',`${HEX_H}px`);
  document.documentElement.style.setProperty('--block-d',`${BLOCK_D}px`);
  for(let col=0;col<COLS_PATTERN.length;col++){
    cellPos[col]=[];blockEls[col]=[];
    for(let row=0;row<COLS_PATTERN[col];row++){
      const pos=getCellPos(col,row); cellPos[col][row]=pos;
      const cell=document.createElement('div'); cell.className='hex-cell';
      cell.style.left=`${pos.x}px`;cell.style.top=`${pos.y}px`;
      cell.addEventListener('mouseover', () => { hoveredCell = { col, row }; });
      cell.addEventListener('mouseout', () => { hoveredCell = null; });
      container.appendChild(cell);
    }
  }
  container.addEventListener('mousedown',onDragStart);
  document.addEventListener('mousemove',(e)=>{ lastMouseX=e.clientX; lastMouseY=e.clientY; });
  document.addEventListener('mousemove',onDragMove);
  document.addEventListener('mouseup',onDragEnd);
  container.addEventListener('touchstart',onDragStart,{passive:false});
  document.addEventListener('touchmove',onDragMove,{passive:false});
  document.addEventListener('touchend',onDragEnd);
  const totalW=(COLS_PATTERN.length-1)*COL_SPACING+HEX_W;
  const totalH=9*ROW_SPACING+HEX_H*0.5;
  container.style.width=`${totalW}px`;container.style.height=`${totalH}px`;
}

function createBlockEl(col,row,cell){
  if(!cell) return null;
  const pos=getBlockPos(col,row);
  const el=document.createElement('div');
  el.className='hex-block'; el.dataset.col=col; el.dataset.row=row;
  el.addEventListener('mouseover', () => { hoveredCell = { col, row }; console.log('DEBUG: block mouseover (block)', hoveredCell); });
  el.addEventListener('mouseout', () => { hoveredCell = null; console.log('DEBUG: block mouseout (block)'); });
  // 특수블록: 이미지 아이콘으로 표시 (색상 없음)
  if(cell.type==='stripe'||cell.type==='bomb'||cell.type==='target'||cell.type==='rainbow'){
    const imgSrc=cell.type==='stripe'?getStripeImage(cell.dir):SPECIAL_IMAGES[cell.type];
    const spSz=Math.round(BLOCK_D*1.1);
    el.style.width=`${spSz}px`;el.style.height=`${spSz}px`;
    el.style.margin=`${-(spSz-BLOCK_D)/2}px 0 0 ${-(spSz-BLOCK_D)/2}px`;
    el.classList.add('special-block',cell.type);
    el.style.backgroundImage=`url(${imgSrc})`;
  } else {
    // 일반블록: 포켓몬 스킨 또는 단색
    const pokeNum=skinData.slots[cell.color];
    if(pokeNum){
      const pokeSz=Math.round(BLOCK_D*1.1);
      el.style.width=`${pokeSz}px`;el.style.height=`${pokeSz}px`;
      el.style.margin=`${-(pokeSz-BLOCK_D)/2}px 0 0 ${-(pokeSz-BLOCK_D)/2}px`;
      el.classList.add('pokemon-block');
      applyPokemonBg(el,pokeNum,pokeSz,true);
    } else {
      el.style.background=ALL_COLORS[cell.color].bg;
    }
  }
  el.style.left=`${pos.x}px`;el.style.top=`${pos.y}px`;
  return el;
}

function spawnAllBlocks(){
  const container=document.getElementById('grid-container');
  for(let col=0;col<COLS_PATTERN.length;col++)
    for(let row=0;row<COLS_PATTERN[col];row++){
      const el=createBlockEl(col,row,board[col][row]);
      if(!el) { blockEls[col][row]=null; continue; }
      container.appendChild(el);blockEls[col][row]=el;
    }
}
function clearAllBlocks(){
  const container=document.getElementById('grid-container');
  container.querySelectorAll('.hex-block,.gimmick-el,.score-popup,.stripe-beam,.bomb-explosion,.target-projectile').forEach(e=>e.remove());
  for(let col=0;col<COLS_PATTERN.length;col++){blockEls[col]=[];board[col]=[];gimmick[col]=[];gimmickEls[col]=[];}
  totalStones=0;initialStones=0;
  dragState=null;
}

// ── 기믹 (돌) ──
function createGimmickEl(col,row,g){
  if(!g) return null;
  const pos=getCellPos(col,row);
  const el=document.createElement('div');
  el.className='gimmick-el';
  el.style.left=`${pos.x}px`;el.style.top=`${pos.y}px`;
  el.style.width=`${HEX_W}px`;el.style.height=`${HEX_H}px`;
  el.style.backgroundImage=`url(assets/gimmick/stone_${g.level}.png)`;
  el.style.backgroundSize='contain';
  el.style.backgroundPosition='center';
  el.style.backgroundRepeat='no-repeat';
  return el;
}

function placeStone(col,row,level){
  if(!isValid(col,row)) return;
  // 기존 블록 제거
  if(board[col][row]){
    board[col][row]=null;
    if(blockEls[col][row]){blockEls[col][row].remove();blockEls[col][row]=null;}
  }
  // 기존 기믹 제거
  removeGimmickEl(col,row);
  // 배치
  gimmick[col][row]={type:'stone',level};
  totalStones++;
  const container=document.getElementById('grid-container');
  const el=createGimmickEl(col,row,gimmick[col][row]);
  if(el){container.appendChild(el);gimmickEls[col][row]=el;}
  updateMissionUI();
}

function removeGimmickEl(col,row){
  if(gimmickEls[col]&&gimmickEls[col][row]){
    gimmickEls[col][row].remove();
    gimmickEls[col][row]=null;
  }
  if(gimmick[col]&&gimmick[col][row]){
    gimmick[col][row]=null;
  }
}

function hitStone(col,row){
  const g=gimmick[col]?.[row];
  if(!g||g.type!=='stone') return;
  g.level--;
  if(g.level<=0){
    // 완전 제거 → 충전 가능한 빈 셀로
    removeGimmickEl(col,row);
    totalStones--;
  } else {
    // 이미지 업데이트
    if(gimmickEls[col][row]){
      gimmickEls[col][row].style.backgroundImage=`url(assets/gimmick/stone_${g.level}.png)`;
      gimmickEls[col][row].classList.add('stone-hit');
      setTimeout(()=>gimmickEls[col][row]?.classList.remove('stone-hit'),300);
    }
  }
  updateMissionUI();
}

function spawnGimmicks(){
  const container=document.getElementById('grid-container');
  for(let col=0;col<COLS_PATTERN.length;col++){
    if(!gimmick[col]) gimmick[col]=[];
    if(!gimmickEls[col]) gimmickEls[col]=[];
    for(let row=0;row<COLS_PATTERN[col];row++){
      const g=gimmick[col][row];
      if(!g) continue;
      // 기믹 셀에서는 블록 제거
      board[col][row]=null;
      if(blockEls[col][row]){blockEls[col][row].remove();blockEls[col][row]=null;}
      const el=createGimmickEl(col,row,g);
      if(el){container.appendChild(el);gimmickEls[col][row]=el;}
    }
  }
}

function countStones(){
  let cnt=0;
  for(let col=0;col<COLS_PATTERN.length;col++)
    for(let row=0;row<(gimmick[col]?.length||0);row++)
      if(gimmick[col][row]?.type==='stone') cnt++;
  return cnt;
}

function hasStones(){ return initialStones>0; }

function getRandomStonePos(excludeSet){
  const cands=[];
  for(let c=0;c<COLS_PATTERN.length;c++)
    for(let r=0;r<(gimmick[c]?.length||0);r++)
      if(gimmick[c][r]?.type==='stone'&&(!excludeSet||!excludeSet.has(`${c},${r}`)))
        cands.push([c,r]);
  return cands.length?cands[Math.floor(Math.random()*cands.length)]:null;
}

// 타겟볼 범위 타격 패턴 (4칸)
// swapDir: 스왑 방향 (null이면 클릭 발동 → 기본 패턴)
function getTargetAreaCells(col,row,swapDir){
  let dirs;
  if(!swapDir){
    // 클릭 발동: 자신 + 상/우하/좌하
    dirs=['up','se','sw'];
  } else {
    // 스왑 발동: 스왑 방향 쪽 3칸
    const patterns={
      up:['up','nw','ne'],     // 아래→위 스왑: 상/좌상/우상
      down:['down','sw','se'], // 위→아래 스왑: 하/좌하/우하
      nw:['nw','up','sw'],     // 우하→좌상 스왑: 좌상/상/좌하
      se:['se','ne','down'],   // 좌상→우하 스왑: 우하/우상/하
      ne:['ne','up','se'],     // 좌하→우상 스왑: 우상/상/우하
      sw:['sw','down','nw'],   // 우상→좌하 스왑: 좌하/하/좌상
    };
    dirs=patterns[swapDir]||['up','se','sw'];
  }
  const cells=[[col,row]]; // 자기 자신 포함
  for(const d of dirs){
    const p=step(col,row,d);
    if(p) cells.push(p);
  }
  return cells;
}

// 타겟볼 타격 대상: 돌 기믹 우선, 없으면 랜덤 블록
function getTargetBallTarget(excludeSet){
  const stone=getRandomStonePos(excludeSet);
  if(stone) return {pos:stone,isStone:true};
  const block=getRandomBlockPos(excludeSet);
  if(block) return {pos:block,isStone:false};
  return null;
}

function updateMissionUI(){
  const el=document.getElementById('mission-display');
  if(!el) return;
  if(totalStones>0){
    el.classList.remove('hidden');
    document.getElementById('mission-count').textContent=totalStones;
  } else {
    el.classList.add('hidden');
  }
}

// ── 힌트 ──
function startHintTimer(){
  clearHint(); if(!playing||busy) return;
  hintTimer=setTimeout(()=>{if(!playing||busy) return; const b=findBestSwap(); if(b) showHint(b.c1,b.r1,b.c2,b.r2);},HINT_DELAY);
}
function clearHint(){
  if(hintTimer){clearTimeout(hintTimer);hintTimer=null;}
  for(const {col,row} of hintedCells) if(blockEls[col]?.[row]) blockEls[col][row].classList.remove('hint');
  hintedCells=[];
}
function showHint(c1,r1,c2,r2){
  hintedCells=[{col:c1,row:r1},{col:c2,row:r2}];
  for(const {col,row} of hintedCells) if(blockEls[col]?.[row]) blockEls[col][row].classList.add('hint');
}
function findBestSwap(){
  let bestLen=0,bestSwap=null;const tested=new Set();
  for(let col=0;col<COLS_PATTERN.length;col++)
    for(let row=0;row<COLS_PATTERN[col];row++){
      if(!board[col][row]||board[col][row].type!=='normal') continue;
      for(const [nc,nr] of getNeighbors(col,row)){
        if(!board[nc][nr]||board[nc][nr].type!=='normal') continue;
        const k1=`${col},${row}`,k2=`${nc},${nr}`;
        const key=k1<k2?`${k1}|${k2}`:`${k2}|${k1}`;
        if(tested.has(key)) continue; tested.add(key);
        [board[col][row],board[nc][nr]]=[board[nc][nr],board[col][row]];
        const {lines,clusters}=findAllMatches();
        let mx=0; for(const l of lines) if(l.length>mx) mx=l.length;
        if(clusters.length>0&&mx<4) mx=4;
        [board[col][row],board[nc][nr]]=[board[nc][nr],board[col][row]];
        if(mx>bestLen){bestLen=mx;bestSwap={c1:col,r1:row,c2:nc,r2:nr};}
      }
    }
  return bestSwap;
}

// ── UI ──
function updateHighScoreUI(){document.getElementById('high-score-value').textContent=highScore.toLocaleString();}
function updateScoreUI(){document.getElementById('score-value').textContent=score.toLocaleString();}
function updateMovesUI(){
  const el=document.getElementById('moves-value');
  el.textContent=movesLeft;el.classList.toggle('low',movesLeft<=5);
}
function getComboMessage(combo){
  if(combo===2) return '굿!';
  if(combo===3) return '어-썸!';
  if(combo===4) return '쩌는 콤보!';
  const texts=['오지고 지리고 렛잇고!','연쇄 덕좀 보시네예!','고득점 가즈아!'];
  return texts[Math.floor(Math.random()*texts.length)];
}

function getComboStyle(combo){
  if(combo===2) return { bg:'#3498db', size:'30px' };
  if(combo===3) return { bg:'#9b59b6', size:'36px' };
  if(combo===4) return { bg:'#e67e22', size:'42px' };
  return { bg:'#f1c40f', size:'48px' };
}

function showScorePopup(x,y,pts){
  const container=document.getElementById('grid-container');
  const p=document.createElement('div');p.className='score-popup';
  p.textContent=`+${pts}`;p.style.left=`${x}px`;p.style.top=`${y}px`;
  container.appendChild(p);setTimeout(()=>p.remove(),800);
}

function showCombo(combo,bonus){
  const el=document.getElementById('combo-display');
  const msg=getComboMessage(combo);
  const style=getComboStyle(combo);
  el.innerHTML=`<div class="combo-line combo-count">${combo} COMBO!</div><div class="combo-line combo-msg">${msg}</div>`;
  el.style.fontSize=style.size;
  el.style.color=style.bg;
  el.style.textShadow=`0 0 12px ${style.bg}, 0 0 20px ${style.bg}, 0 0 30px rgba(255,255,255,0.8)`;
  el.style.background='transparent';
  el.style.border='none';
  el.style.padding='0';
  el.classList.remove('hidden','show','hide');
  el.offsetHeight; // reflow
  el.classList.add('show');
  if(el._comboTimer){ clearTimeout(el._comboTimer); }
  el._comboTimer=setTimeout(()=>{
    el.classList.add('hide');
    el._comboTimer=setTimeout(()=>{ el.classList.remove('show','hide'); },500);
  },2000);

  if(bonus>0){
    const container=document.getElementById('grid-container');
    const cx=container.offsetWidth/2-30,cy=container.offsetHeight/2+30;
    const p=document.createElement('div');p.className='score-popup combo-bonus';
    p.textContent=`COMBO +${bonus}`;p.style.left=`${cx}px`;p.style.top=`${cy}px`;
    container.appendChild(p);setTimeout(()=>p.remove(),800);
  }
}

// ── 이펙트 ──
function showStripeBeam(col,row,dir){
  const container=document.getElementById('grid-container');
  const origin=getBlockPos(col,row);
  const cx=origin.x+BLOCK_D/2,cy=origin.y+BLOCK_D/2,angle=getStripeAngle(dir);
  const len=Math.max(container.offsetWidth,container.offsetHeight)*1.5;
  const beam=document.createElement('div');beam.className='stripe-beam';
  beam.style.width=`${len}px`;beam.style.height='6px';
  beam.style.left=`${cx-len/2}px`;beam.style.top=`${cy-3}px`;
  beam.style.transformOrigin='center';beam.style.transform=`rotate(${angle}deg)`;
  container.appendChild(beam);setTimeout(()=>beam.remove(),400);
}
function showBombExplosion(col,row){
  const container=document.getElementById('grid-container');
  const pos=getBlockPos(col,row);
  const exp=document.createElement('div');exp.className='bomb-explosion';
  exp.style.left=`${pos.x+BLOCK_D/2}px`;exp.style.top=`${pos.y+BLOCK_D/2}px`;
  container.appendChild(exp);setTimeout(()=>exp.remove(),CFG.explosionLifetime);
}
async function fireTargetProjectile(fromCol,fromRow,toCol,toRow,color){
  const container=document.getElementById('grid-container');
  const from=getBlockPos(fromCol,fromRow),to=getBlockPos(toCol,toRow);
  const proj=document.createElement('div');proj.className='target-projectile';
  if(color!==null){
    proj.style.background=`radial-gradient(circle,#fff 20%,${ALL_COLORS[color].bg} 60%,transparent)`;
    proj.style.boxShadow=`0 0 10px 3px ${ALL_COLORS[color].bg}`;
  }
  proj.style.left=`${from.x+BLOCK_D/2-6}px`;proj.style.top=`${from.y+BLOCK_D/2-6}px`;
  container.appendChild(proj);proj.offsetHeight;
  const pt=CFG.projectileTransition/gameSpeed;
  proj.style.transition=`left ${pt}s ease-in-out,top ${pt}s cubic-bezier(0.2,-0.6,0.7,1.4)`;
  proj.style.left=`${to.x+BLOCK_D/2-6}px`;proj.style.top=`${to.y+BLOCK_D/2-6}px`;
  await delay(pt*1000+20);proj.remove();
}

// ── 무지개볼 발동 ──
async function activateRainbow(col,row,targetColor){
  const prevRainbow=isBusyRainbow;
  isBusyRainbow=true; // 무지개볼 연출 중 입력 차단
  const targets=[];
  for(let c=0;c<COLS_PATTERN.length;c++)
    for(let r=0;r<COLS_PATTERN[c];r++)
      if(board[c][r]&&board[c][r].color===targetColor&&board[c][r].type==='normal')
        targets.push([c,r]);
  // 순차 마킹
  for(const [c,r] of targets){
    if(blockEls[c][r]) blockEls[c][r].classList.add('rainbow-marked');
    await delay(25);
  }
  await delay(200);
  // 무지개볼 자체 제거
  if(blockEls[col][row]){blockEls[col][row].classList.add('matched');} board[col][row]=null;
  // 타겟 블록 제거
  for(const [c,r] of targets){
    if(blockEls[c][r]){blockEls[c][r].classList.remove('rainbow-marked');blockEls[c][r].classList.add('matched');}
    board[c][r]=null;
  }
  // 제거된 블록에 인접한 기믹 단계 -1
  const hitSet=new Set();
  for(const [c,r] of targets){
    for(const [nc,nr] of getNeighbors(c,r)){
      if(gimmick[nc]?.[nr]?.type==='stone'){
        const sk=`${nc},${nr}`;
        if(!hitSet.has(sk)){ hitSet.add(sk); hitStone(nc,nr); }
      }
    }
  }
  await delay(300);
  if(blockEls[col][row]){blockEls[col][row].remove();blockEls[col][row]=null;}
  for(const [c,r] of targets){
    if(blockEls[c][r]){blockEls[c][r].remove();blockEls[c][r]=null;}
  }
  isBusyRainbow=prevRainbow; // 호출자의 상태 복원
  addMatchLog(0,'무지개볼발동',targets.length+1);
  return targets.length;
}

// ── 드래그 (마우스 + 터치) ──
function getPointer(e){
  if(e.touches&&e.touches.length>0) return {x:e.touches[0].clientX,y:e.touches[0].clientY};
  if(e.changedTouches&&e.changedTouches.length>0) return {x:e.changedTouches[0].clientX,y:e.changedTouches[0].clientY};
  return {x:e.clientX,y:e.clientY};
}
function onDragStart(e){
  if(!playing||isBusyRainbow) return;
  const pt=getPointer(e);
  const block=e.target.closest('.hex-block'); if(!block) return;
  e.preventDefault();clearHint();
  const col=parseInt(block.dataset.col),row=parseInt(block.dataset.row);
  dragState={col,row,startX:pt.x,startY:pt.y,el:block};
  block.classList.add('dragging');
}
function onDragMove(e){if(!dragState) return; e.preventDefault();}
function onDragEnd(e){
  if(!dragState) return;
  const {col,row,startX,startY,el}=dragState;
  el.classList.remove('dragging');dragState=null;
  const pt=getPointer(e);
  const dx=pt.x-startX,dy=pt.y-startY;
  if(Math.sqrt(dx*dx+dy*dy)<DRAG_THRESHOLD){
    if(debugPlaceType&&playing&&!busy){ placeDebugSpecial(col,row); return; }
    // 클릭: 특수블록 → 제자리 발동, 일반블록 → 흔들림
    if(playing&&!busy&&!isBusyRainbow&&board[col]?.[row]){
      if(isSpecial(col,row)){
        tryActivateSpecialClick(col,row);
      } else {
        if(blockEls[col]?.[row]){
          blockEls[col][row].classList.remove('shake');
          void blockEls[col][row].offsetWidth;
          blockEls[col][row].classList.add('shake');
          setTimeout(()=>blockEls[col][row]?.classList.remove('shake'),400);
        }
      }
    }
    return;
  }
  const target=findNeighborByAngle(col,row,dx,dy);
  if(!target) return;
  if(isBusyRainbow) return; // 무지개볼 연출 중 → 무시
  // isBusyNormal이든 idle이든 즉시 실행
  trySwap(col,row,target[0],target[1]);
}
function findNeighborByAngle(col,row,dx,dy){
  const angle=Math.atan2(dy,dx);
  const neighbors=getNeighbors(col,row);
  let best=null,bestDiff=Infinity;
  for(const [nc,nr] of neighbors){
    const np=getBlockPos(nc,nr),op=getBlockPos(col,row);
    const na=Math.atan2(np.y-op.y,np.x-op.x);
    let diff=Math.abs(angle-na);if(diff>Math.PI) diff=2*Math.PI-diff;
    if(diff<bestDiff){bestDiff=diff;best=[nc,nr];}
  }
  return best&&bestDiff<Math.PI/3?best:null;
}

// ── 클릭 발동 (특수블록 제자리 발동) ──
function tryActivateSpecialClick(col,row){
  if(!isSpecial(col,row)) return;
  enqueueAnim(async()=>{
    busy=true;isBusyNormal=true;
    clearHint();
    movesLeft--;updateMovesUI();
    const cell=board[col][row];
    if(cell.type==='rainbow'){
      const tc=getMostFrequentColor();
      if(tc!==null){
        const cnt=await activateRainbow(col,row,tc);
        score+=cnt*100;updateScoreUI();
      } else {
        board[col][row]=null;
        if(blockEls[col][row]){blockEls[col][row].classList.add('matched');}
        await delay(CFG.specialActivateDelay);
        if(blockEls[col][row]){blockEls[col][row].remove();blockEls[col][row]=null;}
      }
    } else {
      await activateSpecialAt(col,row);
    }
    isBusyRainbow=false;isBusyNormal=true;
    await applyGravity();await fillEmpty();
    let {lines:cl,cells:cc,clusters:ccl}=findAllMatches();
    let combo=0;
    while(cc.length>0||ccl.length>0){
      combo++;
      await processMatchStep(cl,cc,ccl,false,col,row,col,row,null,combo);
      await applyGravity();await fillEmpty();
      const chain=findAllMatches();cl=chain.lines;cc=chain.cells;ccl=chain.clusters;
    }
    checkGameEnd();busy=false;isBusyNormal=false;
    startHintTimer();
  });
}

// ── 스왑 ──
function trySwap(c1,r1,c2,r2){
  if(isBusyRainbow) return;

  enqueueAnim(async()=>{
    busy=true;isBusyNormal=true;

    const result=executeSwap(c1,r1,c2,r2);

    if(!result.valid){
      await animateSwap(c1,r1,c2,r2);
      await animateSwap(c1,r1,c2,r2);
      busy=false;isBusyNormal=false;
      return;
    }

    await animateSwap(c1,r1,c2,r2);
    movesLeft--;updateMovesUI();

    if(result.type==='cross'){
      await handleCrossEffect(c1,r1,c2,r2);
      isBusyRainbow=false;isBusyNormal=true;
      await applyGravity();await fillEmpty();
      let {lines:cl,cells:cc,clusters:ccl}=findAllMatches();
      let combo=0;
      while(cc.length>0||ccl.length>0){
        combo++;
        await processMatchStep(cl,cc,ccl,false,c1,r1,c2,r2,null,combo);
        await applyGravity();await fillEmpty();
        const chain=findAllMatches();cl=chain.lines;cc=chain.cells;ccl=chain.clusters;
      }
      checkGameEnd();busy=false;isBusyNormal=false;
      startHintTimer();
      return;
    }

    if(result.type==='rainbow'){
      const cnt=await activateRainbow(result.rainbowPos.col,result.rainbowPos.row,result.targetColor);
      score+=cnt*100;updateScoreUI();
      isBusyRainbow=false;isBusyNormal=true;
      await applyGravity();await fillEmpty();
      let {lines:cl,cells:cc,clusters:ccl}=findAllMatches();
      let combo=1;
      while(cc.length>0||ccl.length>0){
        combo++;
        await processMatchStep(cl,cc,ccl,false,c1,r1,c2,r2,null,combo);
        await applyGravity();await fillEmpty();
        const chain=findAllMatches();cl=chain.lines;cc=chain.cells;ccl=chain.clusters;
      }
      checkGameEnd();busy=false;isBusyNormal=false;
      startHintTimer();
      return;
    }

    if(result.type==='special-activate'){
      const {col,row}=result.specialPos;
      const cell=board[col][row];
      // 타겟볼에 스왑 방향 전달 (범위 타격 패턴용)
      if(cell.type==='target') cell._swapDir=getSwapDirection(c1,r1,c2,r2);
      if(cell.type==='rainbow'){
        const tc=getMostFrequentColor();
        if(tc!==null){ const cnt=await activateRainbow(col,row,tc); score+=cnt*100;updateScoreUI(); }
      } else {
        await activateSpecialAt(col,row);
      }
      isBusyRainbow=false;isBusyNormal=true;
      await applyGravity();await fillEmpty();
      let {lines:cl,cells:cc,clusters:ccl}=findAllMatches();
      let combo=0;
      while(cc.length>0||ccl.length>0){
        combo++;
        await processMatchStep(cl,cc,ccl,false,c1,r1,c2,r2,null,combo);
        await applyGravity();await fillEmpty();
        const chain=findAllMatches();cl=chain.lines;cc=chain.cells;ccl=chain.clusters;
      }
      checkGameEnd();busy=false;isBusyNormal=false;
      startHintTimer();
      return;
    }

    const {lines,cells,clusters,swapDir}=result;
    let combo=0,curLines=lines,curCells=cells,curClusters=clusters,isFirst=true;
    while(curCells.length>0||curClusters.length>0){
      combo++;
      await processMatchStep(curLines,curCells,curClusters,isFirst,c1,r1,c2,r2,swapDir,combo);
      isFirst=false;
      await applyGravity();await fillEmpty();
      const chain=findAllMatches();curLines=chain.lines;curCells=chain.cells;curClusters=chain.clusters;
    }
    checkGameEnd();busy=false;isBusyNormal=false;
    startHintTimer();
  });
}

// ── 특수블록 효과 범위 계산 (순수 로직, DOM 무관) ──
// 특수블록의 효과 범위를 계산하고 board에서 제거, 연쇄 정보 반환
// cell: {type,color,dir} — 이미 제거된 특수블록의 스냅샷
function computeSpecialEffect(col,row,cell){
  const destroyed=[];
  const effects=[]; // 애니메이션 이벤트
  if(cell.type==='stripe'){
    effects.push({type:'stripe',col,row,dir:cell.dir});
    for(const [sc,sr] of getStripeLine(col,row,cell.dir)){
      if(gimmick[sc]?.[sr]?.type==='stone') effects.push({type:'hit-stone',col:sc,row:sr});
      else if(board[sc][sr]!==null) destroyed.push([sc,sr]);
    }
  } else if(cell.type==='bomb'){
    effects.push({type:'bomb',col,row});
    for(const [nc,nr] of getNeighbors(col,row)){
      if(gimmick[nc]?.[nr]?.type==='stone') effects.push({type:'hit-stone',col:nc,row:nr});
      else if(board[nc][nr]!==null) destroyed.push([nc,nr]);
    }
  } else if(cell.type==='target'){
    // 스텝1: 범위 4칸 즉시 제거
    const areaCells=getTargetAreaCells(col,row,cell._swapDir||null);
    const areaEffects=[];
    for(const [ac,ar] of areaCells){
      if(ac===col&&ar===row) continue;
      if(gimmick[ac]?.[ar]?.type==='stone'){
        areaEffects.push({type:'target-area-stone',col:ac,row:ar});
      } else if(board[ac][ar]!==null){
        destroyed.push([ac,ar]);
      }
    }
    effects.push(...areaEffects);
    // 스텝2는 별도 step으로 분리 (아래에서 처리)
    cell._targetAreaCells=areaCells; // 발사체 제외용
    cell._targetStep2=true;
  } else if(cell.type==='rainbow'){
    const tc=getMostFrequentColor();
    if(tc!==null){
      effects.push({type:'rainbow',col,row,targetColor:tc});
      for(let c=0;c<COLS_PATTERN.length;c++)
        for(let r=0;r<COLS_PATTERN[c];r++)
          if(board[c][r]&&board[c][r].color===tc&&board[c][r].type==='normal')
            destroyed.push([c,r]);
    }
  }
  // board에서 제거 + 연쇄 특수블록 수집
  const chainSpecials=[];
  for(const [dc,dr] of destroyed){
    if(!board[dc][dr]) continue;
    if(isSpecial(dc,dr)) chainSpecials.push({col:dc,row:dr,cell:{...board[dc][dr]}});
    board[dc][dr]=null;
  }
  // 재귀적으로 연쇄 처리
  const allSteps=[{col,row,cell,destroyed,effects,chainSpecials}];
  for(const cs of chainSpecials){
    const sub=computeSpecialEffect(cs.col,cs.row,cs.cell);
    allSteps.push(...sub);
  }
  // 타겟볼 스텝2: 범위 타격 후 발사체 1개 (별도 step으로 분리)
  if(cell._targetStep2){
    const excludeSet=new Set((cell._targetAreaCells||[]).map(([c,r])=>`${c},${r}`));
    const hit=getTargetBallTarget(excludeSet);
    if(hit){
      const [tc,tr]=hit.pos;
      const step2effects=[{type:'target',fromCol:col,fromRow:row,toCol:tc,toRow:tr,color:null,isStone:hit.isStone}];
      const step2destroyed=[];
      const step2chain=[];
      if(!hit.isStone&&board[tc]?.[tr]){
        if(isSpecial(tc,tr)) step2chain.push({col:tc,row:tr,cell:{...board[tc][tr]}});
        step2destroyed.push(hit.pos);
        board[tc][tr]=null;
      }
      allSteps.push({col,row,cell,destroyed:step2destroyed,effects:step2effects,chainSpecials:step2chain});
      for(const cs of step2chain){
        const sub=computeSpecialEffect(cs.col,cs.row,cs.cell);
        allSteps.push(...sub);
      }
    }
    delete cell._targetStep2;
    delete cell._targetAreaCells;
  }
  return allSteps;
}

// 특수블록 효과 애니메이션 재생 (DOM만 조작, board 건드리지 않음)
async function animateSpecialSteps(steps){
  for(const step of steps){
    // 이펙트 표시
    for(const fx of step.effects){
      if(fx.type==='stripe') showStripeBeam(fx.col,fx.row,fx.dir);
      if(fx.type==='bomb') showBombExplosion(fx.col,fx.row);
      if(fx.type==='target-area-stone'||fx.type==='hit-stone') hitStone(fx.col,fx.row);
      if(fx.type==='target'){
        await fireTargetProjectile(fx.fromCol,fx.fromRow,fx.toCol,fx.toRow,fx.color);
        if(fx.isStone) hitStone(fx.toCol,fx.toRow);
      }
    }
    // 파괴 블록 DOM 제거
    for(const [dc,dr] of step.destroyed){
      if(blockEls[dc]?.[dr]) blockEls[dc][dr].classList.add('matched');
    }
    await delay(CFG.specialActivateDelay);
    for(const [dc,dr] of step.destroyed){
      if(blockEls[dc]?.[dr]){blockEls[dc][dr].remove();blockEls[dc][dr]=null;}
    }
    score+=step.destroyed.length*100;updateScoreUI();
  }
}

// ── 개별 특수블록 발동 (swap 교차용) — 래퍼 ──
async function activateSpecialAt(col,row){
  const cell=board[col][row]; if(!cell) return;
  const cellSnap={...cell}; // 스냅샷 (board에서 제거 전)
  // board에서 자기 자신 제거
  board[col][row]=null;
  // 자기 자신 DOM 제거 연출
  if(blockEls[col][row]) blockEls[col][row].classList.add('matched');
  await delay(CFG.specialActivateDelay);
  if(blockEls[col][row]){blockEls[col][row].remove();blockEls[col][row]=null;}
  // 효과 계산 (로직) → 애니메이션 재생
  const steps=computeSpecialEffect(col,row,cellSnap);
  await animateSpecialSteps(steps);
}

// 이미 제거된 특수블록의 효과만 발동 — 래퍼
async function activateSpecialEffect(col,row,cell){
  const steps=computeSpecialEffect(col,row,cell);
  await animateSpecialSteps(steps);
}

// ── 교차 효과 처리 (특수블록 2개 swap) ──
async function handleCrossEffect(c1,r1,c2,r2){
  const cell1={...board[c1][r1]},cell2={...board[c2][r2]};
  const t1=cell1.type,t2=cell2.type;
  // 무지개볼 포함 시 입력 차단
  const hasRainbow=t1==='rainbow'||t2==='rainbow';
  if(hasRainbow) isBusyRainbow=true;
  const priority={rainbow:0,bomb:1,stripe:2,target:3};
  let typeA,typeB,cA,rA,cB,rB,cellA,cellB;
  if(priority[t1]<=priority[t2]){
    [typeA,typeB,cA,rA,cB,rB,cellA,cellB]=[t1,t2,c1,r1,c2,r2,cell1,cell2];
  }else{
    [typeA,typeB,cA,rA,cB,rB,cellA,cellB]=[t2,t1,c2,r2,c1,r1,cell2,cell1];
  }
  const combo=`${typeA}+${typeB}`;

  // 두 블록 제거 공통
  async function removeBoth(){
    if(blockEls[c1][r1]) blockEls[c1][r1].classList.add('matched');
    if(blockEls[c2][r2]) blockEls[c2][r2].classList.add('matched');
    board[c1][r1]=null;board[c2][r2]=null;
    await delay(CFG.crossEffectDelay);
    if(blockEls[c1][r1]){blockEls[c1][r1].remove();blockEls[c1][r1]=null;}
    if(blockEls[c2][r2]){blockEls[c2][r2].remove();blockEls[c2][r2]=null;}
  }

  // 셀 파괴 + 점수 + 특수블록 연쇄 + 기믹 타격
  async function destroyCells(cells){
    const chainSpecials=[],destroyed=[];
    for(const [c,r] of cells){
      // 기믹 타격
      if(gimmick[c]?.[r]?.type==='stone'){ hitStone(c,r); continue; }
      if(!board[c][r]) continue;
      if(isSpecial(c,r)) chainSpecials.push([c,r,{...board[c][r]}]);
      destroyed.push([c,r]);
      if(blockEls[c][r]) blockEls[c][r].classList.add('matched');
      board[c][r]=null;
    }
    if(destroyed.length===0) return;
    await delay(CFG.crossEffectDelay);
    for(const [c,r] of destroyed){
      if(blockEls[c][r]){blockEls[c][r].remove();blockEls[c][r]=null;}
    }
    score+=destroyed.length*100;updateScoreUI();
    for(const [sc,sr,scell] of chainSpecials) await activateSpecialEffect(sc,sr,scell);
  }

  // ① 줄볼 x 줄볼: 두 위치에서 동시에 각각 줄볼 효과
  if(combo==='stripe+stripe'){
    await removeBoth();
    showStripeBeam(cA,rA,cellA.dir);showStripeBeam(cB,rB,cellB.dir);
    const cells=new Set();
    for(const [c,r] of getStripeLine(cA,rA,cellA.dir)) cells.add(`${c},${r}`);
    for(const [c,r] of getStripeLine(cB,rB,cellB.dir)) cells.add(`${c},${r}`);
    await destroyCells([...cells].map(k=>k.split(',').map(Number)));
  }
  // ② 줄볼 x 폭탄볼: 1줄→3줄 증폭
  else if(combo==='bomb+stripe'){
    const sDir=cellB.dir;
    await removeBoth();
    const perpDirs=getPerpDirs(sDir);
    showStripeBeam(cB,rB,sDir);
    for(const pd of perpDirs){const s=step(cB,rB,pd);if(s) showStripeBeam(s[0],s[1],sDir);}
    await destroyCells(get3LineStripeCells(cB,rB,sDir));
  }
  // ③ 폭탄볼 x 폭탄볼: 드래그 목적지(c2,r2=cB,rB) 기준 2칸 범위(19칸) 제거
  else if(combo==='bomb+bomb'){
    await removeBoth();
    showBombExplosion(cB,rB);
    await destroyCells(getCellsInRange2(cB,rB));
  }
  // ④ 줄볼 x 타겟볼: 끝점(c2,r2) 기준 범위 4칸 즉시 타격 → 타겟볼 1개 날아가서 줄볼 효과
  else if(combo==='stripe+target'){
    const sCell=typeA==='stripe'?cellA:cellB;
    // 끝점(c2,r2)에서 발동, 방향=c1→c2
    const swapDir=getSwapDirection(c1,r1,c2,r2);
    await removeBoth();
    // 스텝1: 끝점 기준 범위 4칸 즉시 타격
    const areaCells=getTargetAreaCells(c2,r2,swapDir);
    const areaKill=[];
    for(const [c,r] of areaCells){
      if(c===c2&&r===r2) continue;
      if(gimmick[c]?.[r]?.type==='stone'){ hitStone(c,r); }
      else if(board[c]?.[r]){ areaKill.push([c,r]); }
    }
    if(areaKill.length>0){
      for(const [c,r] of areaKill){ if(blockEls[c][r]) blockEls[c][r].classList.add('matched'); board[c][r]=null; }
      await delay(CFG.crossEffectDelay);
      for(const [c,r] of areaKill){ if(blockEls[c]?.[r]){blockEls[c][r].remove();blockEls[c][r]=null;} }
      score+=areaKill.length*100;updateScoreUI();
    }
    // 스텝2: 타겟볼 1개 날아가서 → 도착 지점에서 줄볼 효과 발동
    const excludeSet=new Set([...areaCells.map(([c,r])=>`${c},${r}`),`${c1},${r1}`]);
    const hit=getTargetBallTarget(excludeSet);
    if(hit){
      const [rc,rr]=hit.pos;
      await fireTargetProjectile(c2,r2,rc,rr,null);
      if(hit.isStone) hitStone(rc,rr);
      // 도착 지점에서 줄볼 효과 발동 (기믹/블록 무관)
      showStripeBeam(rc,rr,sCell.dir);
      const lineCells=getStripeLine(rc,rr,sCell.dir);
      if(!hit.isStone) lineCells.push([rc,rr]);
      // 라인 내 기믹 타격
      for(const [lc,lr] of lineCells){
        if(gimmick[lc]?.[lr]?.type==='stone') hitStone(lc,lr);
      }
      await destroyCells(lineCells);
    }
  }
  // ⑤ 타겟볼 x 타겟볼: 마우스 놓은 지점(cB,rB) 주변 7칸 즉시 타격 → 타겟볼 4개 발사
  else if(combo==='target+target'){
    await removeBoth();
    // 스텝1: cB 기준 자신+인접 6칸 = 7칸 즉시 타격
    const areaCells=[[cB,rB],...getNeighbors(cB,rB)];
    const areaKill=[];
    for(const [c,r] of areaCells){
      if(c===c1&&r===r1) continue; if(c===c2&&r===r2) continue;
      if(gimmick[c]?.[r]?.type==='stone'){ hitStone(c,r); }
      else if(board[c]?.[r]){ areaKill.push([c,r]); }
    }
    if(areaKill.length>0){
      for(const [c,r] of areaKill){ if(blockEls[c][r]) blockEls[c][r].classList.add('matched'); board[c][r]=null; }
      await delay(CFG.crossEffectDelay);
      for(const [c,r] of areaKill){ if(blockEls[c]?.[r]){blockEls[c][r].remove();blockEls[c][r]=null;} }
      score+=areaKill.length*100;updateScoreUI();
    }
    // 스텝2: 타겟볼 4개 발사 (기믹 우선)
    const excluded=new Set(areaCells.map(([c,r])=>`${c},${r}`));
    excluded.add(`${c1},${r1}`);excluded.add(`${c2},${r2}`);
    const targets=[],hitInfo=[];
    for(let i=0;i<4;i++){
      const hit=getTargetBallTarget(excluded);
      if(hit){excluded.add(`${hit.pos[0]},${hit.pos[1]}`);targets.push(hit.pos);hitInfo.push(hit);}
    }
    const promises=targets.map((t,i)=>{
      const from=i<2?[cA,rA]:[cB,rB];
      return fireTargetProjectile(from[0],from[1],t[0],t[1],null);
    });
    await Promise.all(promises);
    const blockTargets=[];
    for(let i=0;i<hitInfo.length;i++){
      if(hitInfo[i].isStone) hitStone(targets[i][0],targets[i][1]);
      else blockTargets.push(targets[i]);
    }
    if(blockTargets.length>0) await destroyCells(blockTargets);
  }
  // ⑥ 폭탄볼 x 타겟볼: 끝점(c2,r2) 기준 범위 4칸 즉시 타격 → 타겟볼 1개 날아가서 폭탄 효과
  else if(combo==='bomb+target'){
    // 끝점(c2,r2)에서 발동, 방향=c1→c2
    const swapDir=getSwapDirection(c1,r1,c2,r2);
    await removeBoth();
    // 스텝1: 끝점 기준 범위 4칸 즉시 타격
    const areaCells=getTargetAreaCells(c2,r2,swapDir);
    const areaKill=[];
    for(const [c,r] of areaCells){
      if(c===c2&&r===r2) continue;
      if(gimmick[c]?.[r]?.type==='stone'){ hitStone(c,r); }
      else if(board[c]?.[r]){ areaKill.push([c,r]); }
    }
    if(areaKill.length>0){
      for(const [c,r] of areaKill){ if(blockEls[c][r]) blockEls[c][r].classList.add('matched'); board[c][r]=null; }
      await delay(CFG.crossEffectDelay);
      for(const [c,r] of areaKill){ if(blockEls[c]?.[r]){blockEls[c][r].remove();blockEls[c][r]=null;} }
      score+=areaKill.length*100;updateScoreUI();
    }
    // 스텝2: 타겟볼 1개 날아가서 → 도착 지점에서 폭탄 효과 발동
    const excludeSet=new Set([...areaCells.map(([c,r])=>`${c},${r}`),`${c1},${r1}`]);
    const hit=getTargetBallTarget(excludeSet);
    if(hit){
      const [rc,rr]=hit.pos;
      await fireTargetProjectile(c2,r2,rc,rr,null);
      if(hit.isStone) hitStone(rc,rr);
      // 도착 지점에서 폭탄 효과 발동 (기믹/블록 무관)
      showBombExplosion(rc,rr);
      const nbrs=getNeighbors(rc,rr).map(([c,r])=>[c,r]);
      if(!hit.isStone) nbrs.push([rc,rr]);
      // 폭발 범위 내 기믹 타격
      for(const [nc,nr] of nbrs){
        if(gimmick[nc]?.[nr]?.type==='stone') hitStone(nc,nr);
      }
      await destroyCells(nbrs);
    }
  }
  // ⑦ 무지개볼 x 줄볼: 순차 탐지→변환 후 동시 발동
  else if(combo==='rainbow+stripe'){
    const targetColor=getMostFrequentColor();
    await removeBoth();
    const converts=[],dirs=['up','ne','nw'];
    for(let c=0;c<COLS_PATTERN.length;c++)
      for(let r=0;r<COLS_PATTERN[c];r++)
        if(board[c][r]&&board[c][r].type==='normal'&&board[c][r].color===targetColor)
          converts.push([c,r]);
    const container=document.getElementById('grid-container');
    const convertData=[];
    // 순차 탐지 + 변환 (거미줄 연출)
    for(const [c,r] of converts){
      if(blockEls[c][r]) blockEls[c][r].classList.add('rainbow-marked');
      await delay(25);
      if(blockEls[c][r]) blockEls[c][r].classList.remove('rainbow-marked');
      const dir=dirs[Math.floor(Math.random()*dirs.length)];
      board[c][r]=makeCell(targetColor,'stripe',dir);
      convertData.push({col:c,row:r,dir});
      if(blockEls[c][r]){blockEls[c][r].remove();blockEls[c][r]=null;}
      const el=createBlockEl(c,r,board[c][r]);
      if(el){el.classList.add('stripe-appear');container.appendChild(el);blockEls[c][r]=el;}
    }
    await delay(300);
    // 모든 줄볼 동시 발동
    const allDestroy=new Set();
    for(const cd of convertData){
      showStripeBeam(cd.col,cd.row,cd.dir);
      allDestroy.add(`${cd.col},${cd.row}`);
      for(const [sc,sr] of getStripeLine(cd.col,cd.row,cd.dir)) allDestroy.add(`${sc},${sr}`);
    }
    for(const cd of convertData){
      board[cd.col][cd.row]=null;
      if(blockEls[cd.col][cd.row]) blockEls[cd.col][cd.row].classList.add('matched');
    }
    await delay(CFG.crossEffectDelay);
    for(const cd of convertData){
      if(blockEls[cd.col][cd.row]){blockEls[cd.col][cd.row].remove();blockEls[cd.col][cd.row]=null;}
    }
    score+=convertData.length*100;updateScoreUI();
    await destroyCells([...allDestroy].map(k=>k.split(',').map(Number)));
  }
  // ⑧ 무지개볼 x 폭탄볼: 순차 탐지→변환 후 동시 발동
  else if(combo==='rainbow+bomb'){
    const targetColor=getMostFrequentColor();
    await removeBoth();
    const converts=[];
    for(let c=0;c<COLS_PATTERN.length;c++)
      for(let r=0;r<COLS_PATTERN[c];r++)
        if(board[c][r]&&board[c][r].type==='normal'&&board[c][r].color===targetColor)
          converts.push([c,r]);
    const container=document.getElementById('grid-container');
    // 순차 탐지 + 변환 (거미줄 연출)
    for(const [c,r] of converts){
      if(blockEls[c][r]) blockEls[c][r].classList.add('rainbow-marked');
      await delay(25);
      if(blockEls[c][r]) blockEls[c][r].classList.remove('rainbow-marked');
      board[c][r]=makeCell(targetColor,'bomb',null);
      if(blockEls[c][r]){blockEls[c][r].remove();blockEls[c][r]=null;}
      const el=createBlockEl(c,r,board[c][r]);
      if(el){el.classList.add('stripe-appear');container.appendChild(el);blockEls[c][r]=el;}
    }
    await delay(300);
    // 모든 폭탄볼 동시 발동
    const allDestroy=new Set();
    for(const [c,r] of converts){
      showBombExplosion(c,r);
      allDestroy.add(`${c},${r}`);
      for(const [nc,nr] of getNeighbors(c,r)) allDestroy.add(`${nc},${nr}`);
    }
    for(const [c,r] of converts){
      board[c][r]=null;
      if(blockEls[c][r]) blockEls[c][r].classList.add('matched');
    }
    await delay(CFG.crossEffectDelay);
    for(const [c,r] of converts){
      if(blockEls[c][r]){blockEls[c][r].remove();blockEls[c][r]=null;}
    }
    score+=converts.length*100;updateScoreUI();
    await destroyCells([...allDestroy].map(k=>k.split(',').map(Number)));
  }
  // ⑨ 무지개볼 x 무지개볼: 모든 블록 제거
  else if(combo==='rainbow+rainbow'){
    await removeBoth();
    const allCells=[];
    for(let c=0;c<COLS_PATTERN.length;c++)
      for(let r=0;r<COLS_PATTERN[c];r++)
        if(board[c][r]) allCells.push([c,r]);
    // 전체 마킹 연출
    for(const [c,r] of allCells){
      if(blockEls[c][r]) blockEls[c][r].classList.add('rainbow-marked');
    }
    await delay(300);
    // 모든 기믹도 타격
    for(let c=0;c<COLS_PATTERN.length;c++)
      for(let r=0;r<COLS_PATTERN[c];r++)
        if(gimmick[c]?.[r]?.type==='stone') hitStone(c,r);
    await destroyCells(allCells);
  }
  // ⑩ 무지개볼 x 타겟볼: 순차 탐지→변환 후 동시 발동
  else if(combo==='rainbow+target'){
    const targetColor=getMostFrequentColor();
    await removeBoth();
    const converts=[];
    for(let c=0;c<COLS_PATTERN.length;c++)
      for(let r=0;r<COLS_PATTERN[c];r++)
        if(board[c][r]&&board[c][r].type==='normal'&&board[c][r].color===targetColor)
          converts.push([c,r]);
    const container=document.getElementById('grid-container');
    // 순차 탐지 + 변환 (거미줄 연출)
    for(const [c,r] of converts){
      if(blockEls[c][r]) blockEls[c][r].classList.add('rainbow-marked');
      await delay(25);
      if(blockEls[c][r]) blockEls[c][r].classList.remove('rainbow-marked');
      board[c][r]=makeCell(targetColor,'target',null);
      if(blockEls[c][r]){blockEls[c][r].remove();blockEls[c][r]=null;}
      const el=createBlockEl(c,r,board[c][r]);
      if(el){el.classList.add('stripe-appear');container.appendChild(el);blockEls[c][r]=el;}
    }
    await delay(300);
    // 모든 타겟볼 동시 발동: 기믹 우선 타격
    const allDestroy=new Set();
    const excluded=new Set(converts.map(([c,r])=>`${c},${r}`));
    const stoneHits=[];
    for(const [c,r] of converts){
      allDestroy.add(`${c},${r}`);
      const hit=getTargetBallTarget(excluded);
      if(hit){
        excluded.add(`${hit.pos[0]},${hit.pos[1]}`);
        if(hit.isStone){ stoneHits.push(hit.pos); }
        else { allDestroy.add(`${hit.pos[0]},${hit.pos[1]}`); }
        fireTargetProjectile(c,r,hit.pos[0],hit.pos[1],targetColor);
      }
    }
    await delay(350);
    for(const [sc,sr] of stoneHits) hitStone(sc,sr);
    for(const [c,r] of converts){
      board[c][r]=null;
      if(blockEls[c][r]) blockEls[c][r].classList.add('matched');
    }
    await delay(CFG.crossEffectDelay);
    for(const [c,r] of converts){
      if(blockEls[c][r]){blockEls[c][r].remove();blockEls[c][r]=null;}
    }
    score+=converts.length*100;updateScoreUI();
    await destroyCells([...allDestroy].map(k=>k.split(',').map(Number)));
  }
  // 교차효과 로그
  const crossLabel={
    'stripe+stripe':'줄볼x줄볼','bomb+stripe':'폭탄x줄볼','bomb+bomb':'폭탄x폭탄',
    'stripe+target':'줄볼x타겟','target+target':'타겟x타겟','bomb+target':'폭탄x타겟',
    'rainbow+stripe':'무지개x줄볼','rainbow+bomb':'무지개x폭탄',
    'rainbow+rainbow':'무지개x무지개','rainbow+target':'무지개x타겟',
  };
  addMatchLog(0,crossLabel[combo]||combo,-1);

  if(hasRainbow) isBusyRainbow=false;
}

// ── 매치 1단계 처리 ──
async function processMatchStep(curLines,curCells,clusters,isFirst,originCol,originRow,destCol,destRow,swapDir,combo){
  // 1) 특수볼 생성 판정
  const specialInfo=determineSpecial(curLines,curCells,clusters,isFirst,originCol,originRow,destCol,destRow,swapDir);

  // 2) 특수볼 발동 수집
  const actStripes=[],actTargets=[],actBombs=[],actRainbows=[];
  for(const [c,r] of curCells){
    const cell=board[c][r]; if(!cell) continue;
    if(cell.type==='stripe') actStripes.push({col:c,row:r,dir:cell.dir,color:cell.color});
    if(cell.type==='target') actTargets.push({col:c,row:r,color:cell.color});
    if(cell.type==='bomb') actBombs.push({col:c,row:r,color:cell.color});
    if(cell.type==='rainbow') actRainbows.push({col:c,row:r});
  }

  // 3) 특수볼 발동 → 추가 제거 셀 (연쇄 루프: 효과 범위 내 특수블록도 발동)
  const extraCells=new Set();
  const processedSpecials=new Set(
    [...actStripes,...actBombs,...actTargets,...actRainbows].map(s=>`${s.col},${s.row}`)
  );

  // 돌 기믹 타격 추적
  const hitStones=new Set();

  // 발동 큐
  const stripeQueue=[...actStripes], bombQueue=[...actBombs];

  let changed=true;
  while(changed){
    changed=false;
    // 줄볼 발동
    while(stripeQueue.length){
      const s=stripeQueue.shift();
      showStripeBeam(s.col,s.row,s.dir);
      for(const [sc,sr] of getStripeLine(s.col,s.row,s.dir)){
        // 돌 기믹 직접 타격
        if(gimmick[sc]?.[sr]?.type==='stone'){ const sk=`${sc},${sr}`; if(!hitStones.has(sk)){hitStones.add(sk);hitStone(sc,sr);} continue; }
        if(board[sc][sr]===null) continue;
        const k=`${sc},${sr}`;
        if(!extraCells.has(k)){extraCells.add(k);changed=true;}
        // 연쇄: 범위 내 특수블록 발동
        if(!processedSpecials.has(k)&&isSpecial(sc,sr)){
          processedSpecials.add(k);
          const cc=board[sc][sr];
          if(cc.type==='stripe') stripeQueue.push({col:sc,row:sr,dir:cc.dir,color:cc.color});
          if(cc.type==='bomb') bombQueue.push({col:sc,row:sr,color:cc.color});
          if(cc.type==='target') actTargets.push({col:sc,row:sr,color:cc.color});
          if(cc.type==='rainbow') actRainbows.push({col:sc,row:sr});
        }
      }
    }
    // 폭탄 발동
    while(bombQueue.length){
      const b=bombQueue.shift();
      showBombExplosion(b.col,b.row);
      for(const [nc,nr] of getNeighbors(b.col,b.row)){
        // 돌 기믹 직접 타격
        if(gimmick[nc]?.[nr]?.type==='stone'){ const sk=`${nc},${nr}`; if(!hitStones.has(sk)){hitStones.add(sk);hitStone(nc,nr);} continue; }
        if(board[nc][nr]===null) continue;
        const k=`${nc},${nr}`;
        if(!extraCells.has(k)){extraCells.add(k);changed=true;}
        if(!processedSpecials.has(k)&&isSpecial(nc,nr)){
          processedSpecials.add(k);
          const cc=board[nc][nr];
          if(cc.type==='stripe') stripeQueue.push({col:nc,row:nr,dir:cc.dir,color:cc.color});
          if(cc.type==='bomb') bombQueue.push({col:nc,row:nr,color:cc.color});
          if(cc.type==='target') actTargets.push({col:nc,row:nr,color:cc.color});
          if(cc.type==='rainbow') actRainbows.push({col:nc,row:nr});
        }
      }
    }
  }

  // 합산 셀
  const allCellSet=new Set(curCells.map(([c,r])=>`${c},${r}`));
  for(const k of extraCells) allCellSet.add(k);

  // 4) 무지개볼 피격 체크
  let rainbowHitCount=0;
  const processedRainbows=new Set();
  for(const rb of actRainbows) processedRainbows.add(`${rb.col},${rb.row}`);
  for(const k of allCellSet){
    const [c,r]=k.split(',').map(Number);
    if(board[c][r]?.type==='rainbow'&&!processedRainbows.has(k)){
      processedRainbows.add(k);
      const rndBlock=getRandomBlockPos(allCellSet);
      if(rndBlock){
        const targetColor=board[rndBlock[0]][rndBlock[1]].color;
        for(let cc=0;cc<COLS_PATTERN.length;cc++)
          for(let rr=0;rr<COLS_PATTERN[cc];rr++)
            if(board[cc][rr]&&board[cc][rr].color===targetColor&&board[cc][rr].type==='normal')
              allCellSet.add(`${cc},${rr}`);
        rainbowHitCount++;
      }
    }
  }

  const allCells=[...allCellSet].map(k=>k.split(',').map(Number));

  // 4b) 돌 기믹 타격 — 매치 셀에 인접한 돌만 타격 (특수효과 범위 제외)
  for(const [c,r] of curCells){
    for(const [nc,nr] of getNeighbors(c,r)){
      if(gimmick[nc]?.[nr]?.type==='stone'){
        const sk=`${nc},${nr}`;
        if(!hitStones.has(sk)){ hitStones.add(sk); hitStone(nc,nr); }
      }
    }
  }

  // 5) 점수
  let turnScore=0;
  for(const line of curLines) turnScore+=calcLineScore(line.length);
  turnScore+=(extraCells.size+rainbowHitCount*10)*100;
  const comboBonus=calcComboBonus(combo);
  turnScore+=comboBonus;
  score+=turnScore;updateScoreUI();

  // 매치 로그
  const logTypes=[];
  if(actStripes.length) logTypes.push('줄볼발동');
  if(actTargets.length) logTypes.push('타겟볼발동');
  if(actBombs.length) logTypes.push('폭탄볼발동');
  if(actRainbows.length) logTypes.push('무지개볼발동');
  addMatchLog(combo,logTypes.length?logTypes.join('+'):'일반매치',allCells.length);

  const avgX=allCells.reduce((s,[c,r])=>s+cellPos[c][r].x,0)/allCells.length;
  const avgY=allCells.reduce((s,[c,r])=>s+cellPos[c][r].y,0)/allCells.length;
  showScorePopup(avgX,avgY,turnScore);
  if(combo>=2) showCombo(combo,comboBonus);

  // merge 셀
  const mergeSet=specialInfo?new Set(specialInfo.mergeCells.map(([c,r])=>`${c},${r}`)):new Set();

  // 6a) 특수볼 생성 연출
  if(specialInfo){
    const tPos=getBlockPos(specialInfo.col,specialInfo.row);
    for(const [c,r] of specialInfo.mergeCells){
      if(c===specialInfo.col&&r===specialInfo.row) continue;
      const el=blockEls[c][r]; if(!el) continue;
      el.classList.add('merging');
      const mt=0.3/gameSpeed;
      el.style.transition=`left ${mt}s ease-in,top ${mt}s ease-in,transform ${mt}s ease-in,opacity ${mt}s ease-in`;
      el.style.left=`${tPos.x}px`;el.style.top=`${tPos.y}px`;
      el.style.transform='scale(0.2)';el.style.opacity='0';
    }
    const pivotEl=blockEls[specialInfo.col][specialInfo.row];
    if(pivotEl){
      const mt2=0.3/gameSpeed,mt3=0.15/gameSpeed;
      pivotEl.style.transition=`transform ${mt2}s ease-in,opacity ${mt3}s ease-in ${mt3}s`;
      pivotEl.style.transform='scale(0.3)';pivotEl.style.opacity='0';
    }
    await delay(CFG.mergeDelay);
    for(const [c,r] of specialInfo.mergeCells){
      board[c][r]=null;if(blockEls[c][r]){blockEls[c][r].remove();blockEls[c][r]=null;}
    }
    const {col:sc,row:sr,color:scolor,dir:sdir,type:stype}=specialInfo;
    board[sc][sr]=makeCell(scolor,stype,sdir);
    const container=document.getElementById('grid-container');
    const newEl=createBlockEl(sc,sr,board[sc][sr]);
    newEl.classList.add('stripe-appear');
    container.appendChild(newEl);blockEls[sc][sr]=newEl;
    // 특수블록 생성 시 인접 기믹 타격
    for(const [nc,nr] of getNeighbors(sc,sr)){
      if(gimmick[nc]?.[nr]?.type==='stone'){
        const sk=`${nc},${nr}`;
        if(!hitStones.has(sk)){ hitStones.add(sk); hitStone(nc,nr); }
      }
    }
    await delay(CFG.mergeDelay);
  }

  // 6b) 나머지 매치 블록 제거
  for(const [c,r] of allCells){
    if(mergeSet.has(`${c},${r}`)) continue;
    if(blockEls[c][r]) blockEls[c][r].classList.add('matched');
    board[c][r]=null;
  }
  await delay(CFG.matchedDelay);
  for(const [c,r] of allCells){
    if(mergeSet.has(`${c},${r}`)) continue;
    if(blockEls[c][r]){blockEls[c][r].remove();blockEls[c][r]=null;}
  }

  // 6c) 타겟볼 발동 (2스텝: 범위 즉시 제거 → 타겟볼 1개 발사)
  if(actTargets.length>0){
    const targetExclude=new Set(allCellSet);
    for(const t of actTargets){
      // 스텝1: 범위 4칸 즉시 제거
      const areaCells=getTargetAreaCells(t.col,t.row,null);
      for(const [ac,ar] of areaCells){
        if(ac===t.col&&ar===t.row) continue;
        targetExclude.add(`${ac},${ar}`);
        if(gimmick[ac]?.[ar]?.type==='stone'){
          const sk=`${ac},${ar}`;
          if(!hitStones.has(sk)){ hitStones.add(sk); hitStone(ac,ar); }
        } else if(board[ac]?.[ar]!==null){
          if(blockEls[ac][ar]) blockEls[ac][ar].classList.add('matched');
          board[ac][ar]=null;
          score+=100;updateScoreUI();
        }
      }
      await delay(CFG.specialActivateDelay);
      for(const [ac,ar] of areaCells){
        if(ac===t.col&&ar===t.row) continue;
        if(blockEls[ac]?.[ar]){blockEls[ac][ar].remove();blockEls[ac][ar]=null;}
      }
      // 스텝2: 타겟볼 1개 발사 (기믹 우선 → 랜덤)
      const hit=getTargetBallTarget(targetExclude);
      if(hit){
        const [rc,rr]=hit.pos;
        targetExclude.add(`${rc},${rr}`);
        await fireTargetProjectile(t.col,t.row,rc,rr,null);
        if(hit.isStone){
          hitStone(rc,rr);
        } else {
          if(blockEls[rc][rr]) blockEls[rc][rr].classList.add('matched');
          board[rc][rr]=null;
          score+=100;updateScoreUI();
          await delay(CFG.specialActivateDelay);
          if(blockEls[rc][rr]){blockEls[rc][rr].remove();blockEls[rc][rr]=null;}
        }
      }
    }
  }
}

function swapBoard(c1,r1,c2,r2){[board[c1][r1],board[c2][r2]]=[board[c2][r2],board[c1][r1]];}

// ── 순수 swap 로직 (동기, DOM 무관) ──
// board 교환 → 매치/특수 판정 → 실패 시 board 원복
// 반환: {valid, type, ...추가 데이터}
function executeSwap(c1,r1,c2,r2){
  swapBoard(c1,r1,c2,r2);

  // 특수블록 교차 (두 특수블록 swap)
  if(isSpecial(c1,r1)&&isSpecial(c2,r2)){
    return {valid:true,type:'cross'};
  }

  // 특수블록 + 일반블록 → 특수블록이 이동한 위치에서 즉시 발동
  const sp1=isSpecial(c1,r1),sp2=isSpecial(c2,r2);
  if(sp1||sp2){
    // 무지개볼 + 일반블록: 스왑한 블록 색상 전체 제거
    const rb1=getType(c1,r1)==='rainbow',rb2=getType(c2,r2)==='rainbow';
    if(rb1||rb2){
      const rainbowPos=rb2?{col:c2,row:r2}:{col:c1,row:r1};
      const otherPos=rb2?{col:c1,row:r1}:{col:c2,row:r2};
      const targetColor=board[otherPos.col][otherPos.row]?.color;
      if(targetColor!==null&&targetColor!==undefined){
        return {valid:true,type:'rainbow',rainbowPos,otherPos,targetColor};
      }
      // 일반블록이 아닌 경우 (특수블록+무지개볼은 이미 cross로 처리됨)
      swapBoard(c1,r1,c2,r2);
      return {valid:false};
    }
    // 일반 특수블록(줄볼/폭탄/타겟) + 일반블록 → 즉시 발동
    const specialPos=sp1?{col:c1,row:r1}:{col:c2,row:r2};
    return {valid:true,type:'special-activate',specialPos};
  }

  // 일반블록 + 일반블록 → 매칭 검사
  const {lines,cells,clusters}=findAllMatches();
  if(cells.length===0&&clusters.length===0){
    swapBoard(c1,r1,c2,r2); // 원복
    return {valid:false};
  }
  const swapDir=getSwapDirection(c1,r1,c2,r2);
  return {valid:true,type:'normal',lines,cells,clusters,swapDir};
}

async function animateSwap(c1,r1,c2,r2){
  const el1=blockEls[c1]?.[r1],el2=blockEls[c2]?.[r2];
  if(!el1||!el2) return;
  const p1=getBlockPos(c1,r1),p2=getBlockPos(c2,r2);
  const swapT=0.2/gameSpeed;
  el1.style.transition=`left ${swapT}s ease,top ${swapT}s ease`;
  el2.style.transition=`left ${swapT}s ease,top ${swapT}s ease`;
  el1.style.zIndex='3';el2.style.zIndex='3';
  el1.style.left=`${p2.x}px`;el1.style.top=`${p2.y}px`;
  el2.style.left=`${p1.x}px`;el2.style.top=`${p1.y}px`;
  await skippableDelay(220);
  el1.style.zIndex='';el2.style.zIndex='';
  el1.style.transition='';el2.style.transition='';
  el1.dataset.col=c2;el1.dataset.row=r2;
  el2.dataset.col=c1;el2.dataset.row=r1;
  blockEls[c1][r1]=el2;blockEls[c2][r2]=el1;
}

// ── 낙하 로직 (순수, DOM 무관) ──
// board 배열만 업데이트, 이동 정보 반환
function computeGravity(){
  const moves=[];
  for(let col=0;col<COLS_PATTERN.length;col++){
    let wr=COLS_PATTERN[col]-1;
    for(let row=COLS_PATTERN[col]-1;row>=0;row--){
      // 기믹 셀은 건너뜀 (블록이 통과 불가)
      if(gimmick[col]?.[row]) { wr=row-1; continue; }
      if(board[col][row]!==null){
        if(row!==wr){
          board[col][wr]=board[col][row];board[col][row]=null;
          moves.push({col,fromRow:row,toRow:wr});
        }
        wr--;
      }
    }
  }
  return moves;
}

// 낙하 애니메이션 (DOM만 조작, board 건드리지 않음)
async function animateGravity(moves){
  for(const {col,fromRow,toRow} of moves){
    blockEls[col][toRow]=blockEls[col][fromRow];blockEls[col][fromRow]=null;
    const el=blockEls[col][toRow];
    if(el){
      el.dataset.row=toRow;
      const pos=getBlockPos(col,toRow);
      el.style.transition=`top ${CFG.gravityTransition/gameSpeed}s ease-in`;el.style.top=`${pos.y}px`;
    }
  }
  if(moves.length>0) await skippableDelay(CFG.gravityDelay);
  refreshBlockElsCoordinates();
}

// 대각선 충전 — 기믹 아래 빈 셀을 대각선 위 블록으로 채움
function computeDiagonalFill(){
  const moves=[];
  let changed=true;
  while(changed){
    changed=false;
    for(let col=0;col<COLS_PATTERN.length;col++){
      for(let row=0;row<COLS_PATTERN[col];row++){
        if(board[col][row]!==null||gimmick[col]?.[row]) continue;
        // 이 셀 위에 기믹이 있어서 수직 낙하가 차단되는지 체크
        let blockedAbove=false;
        for(let r=row-1;r>=0;r--){
          if(gimmick[col]?.[r]){blockedAbove=true;break;}
          if(board[col][r]!==null) break; // 위에 블록이 있으면 수직 낙하로 채워질 것
        }
        if(!blockedAbove) continue;
        // 대각선 소스: 좌상단(nw) 우선, 우상단(ne) 차선
        const long=isLongCol(col);
        const diagSources=long
          ?[[col-1,row-1],[col+1,row-1]] // long col: nw, ne
          :[[col-1,row],[col+1,row]];     // short col: nw, ne
        for(const [sc,sr] of diagSources){
          if(!isValid(sc,sr)) continue;
          if(board[sc][sr]===null||gimmick[sc]?.[sr]) continue;
          // 이동
          board[col][row]=board[sc][sr];board[sc][sr]=null;
          moves.push({col:sc,fromRow:sr,toCol:col,toRow:row});
          changed=true;
          break; // 왼쪽 우선
        }
      }
    }
  }
  return moves;
}

async function animateDiagonalFill(moves){
  for(const {col,fromRow,toCol,toRow} of moves){
    blockEls[toCol][toRow]=blockEls[col][fromRow];blockEls[col][fromRow]=null;
    const el=blockEls[toCol][toRow];
    if(el){
      el.dataset.col=toCol;el.dataset.row=toRow;
      const pos=getBlockPos(toCol,toRow);
      el.style.transition=`left ${CFG.diagTransition/gameSpeed}s ease-in,top ${CFG.diagTransition/gameSpeed}s ease-in`;
      el.style.left=`${pos.x}px`;el.style.top=`${pos.y}px`;
    }
  }
  if(moves.length>0) await skippableDelay(CFG.diagDelay);
  refreshBlockElsCoordinates();
}

// gravity + diagonal: 애니메이션 없이 반복 계산 → DOM 한 번에 이동
async function applyGravity(){
  let anyMoved=false;
  for(let i=0;i<30;i++){
    const moves=computeGravity();
    const diagMoves=computeDiagonalFill();
    if(moves.length===0&&diagMoves.length===0) break;
    animateGravityDOM(moves);
    animateDiagonalDOM(diagMoves);
    anyMoved=true;
    // delay 없이 바로 다음 반복 (DOM transition은 비동기라 자연스럽게 이동)
  }
  if(anyMoved){
    await skippableDelay(CFG.gravityDelay); // 전체 낙하 완료 후 1회만 대기
    refreshBlockElsCoordinates();
  }
}

// 상단 충전 + 추가 낙하 반복 (빈 셀 없을 때까지)
async function fillEmpty(){
  for(let i=0;i<30;i++){
    const fills=computeFill();
    if(fills.length===0) break;
    animateFillDOM(fills);
    await skippableDelay(CFG.fillDelay);
    refreshBlockElsCoordinates();
    // fill 후 새 블록 낙하가 필요할 수 있음
    let subMoved=false;
    for(let j=0;j<30;j++){
      const moves=computeGravity();
      const diagMoves=computeDiagonalFill();
      if(moves.length===0&&diagMoves.length===0) break;
      animateGravityDOM(moves);
      animateDiagonalDOM(diagMoves);
      subMoved=true;
    }
    if(subMoved){
      await skippableDelay(CFG.gravityDelay);
      refreshBlockElsCoordinates();
    }
  }
}

// 애니메이션 DOM 조작만 (await 없음)
function animateGravityDOM(moves){
  const t=CFG.gravityTransition/gameSpeed;
  for(const {col,fromRow,toRow} of moves){
    blockEls[col][toRow]=blockEls[col][fromRow];blockEls[col][fromRow]=null;
    const el=blockEls[col][toRow];
    if(el){
      el.dataset.row=toRow;
      const pos=getBlockPos(col,toRow);
      el.style.transition=`top ${t}s ease-in`;el.style.top=`${pos.y}px`;
    }
  }
}
function animateDiagonalDOM(moves){
  const t=CFG.diagTransition/gameSpeed;
  for(const {col,fromRow,toCol,toRow} of moves){
    blockEls[toCol][toRow]=blockEls[col][fromRow];blockEls[col][fromRow]=null;
    const el=blockEls[toCol][toRow];
    if(el){
      el.dataset.col=toCol;el.dataset.row=toRow;
      const pos=getBlockPos(toCol,toRow);
      el.style.transition=`left ${t}s ease-in,top ${t}s ease-in`;
      el.style.left=`${pos.x}px`;el.style.top=`${pos.y}px`;
    }
  }
}
function animateFillDOM(fills){
  const container=document.getElementById('grid-container');
  for(const {col,row,emptyCount} of fills){
    const pos=getBlockPos(col,row);
    const el=createBlockEl(col,row,board[col][row]);
    if(el){
      el.style.top=`${pos.y-emptyCount*ROW_SPACING}px`;el.style.transition='none';
      container.appendChild(el);blockEls[col][row]=el;
      el.offsetHeight;
      el.style.transition=`top ${CFG.fillTransition/gameSpeed}s ease-in`;el.style.top=`${pos.y}px`;
    }else{
      blockEls[col][row]=null;
    }
  }
}

// ── 충전 로직 (순수, DOM 무관) ──
// 위쪽에 기믹이 있으면 수직 충전 불가 (대각선 충전으로만 채움)
function canFillFromTop(col,row){
  for(let r=row-1;r>=0;r--){
    if(gimmick[col]?.[r]) return false;
  }
  return true;
}

function computeFill(){
  const fills=[];
  for(let col=0;col<COLS_PATTERN.length;col++){
    // gravity 완료 후 최상단부터 연속된 빈 셀 수 카운트
    let emptyCount=0;
    for(let row=0;row<COLS_PATTERN[col];row++){
      if(gimmick[col]?.[row]) break;
      if(board[col][row]!==null) break;
      emptyCount++;
    }
    // 최상단부터 한 번에 채움 (emptyCount로 낙하 높이 결정)
    for(let row=0;row<emptyCount;row++){
      const ci=Math.floor(Math.random()*numColors);
      board[col][row]=makeCell(ci);
      fills.push({col,row,emptyCount});
    }
  }
  return fills;
}

// 충전 애니메이션 (DOM만 조작, board 건드리지 않음)
async function animateFill(fills){
  const container=document.getElementById('grid-container');
  for(const {col,row,emptyCount} of fills){
    const pos=getBlockPos(col,row);
    const el=createBlockEl(col,row,board[col][row]);
    if(el){
      el.style.top=`${pos.y-emptyCount*ROW_SPACING}px`;el.style.transition='none';
      container.appendChild(el);blockEls[col][row]=el;
      el.offsetHeight;
      el.style.transition=`top ${CFG.fillTransition/gameSpeed}s ease-in`;el.style.top=`${pos.y}px`;
    }else{
      blockEls[col][row]=null;
    }
  }
  if(fills.length>0){
    await skippableDelay(CFG.fillDelay);
    refreshBlockElsCoordinates();
  }
}


function refreshBlockElsCoordinates(){
  for(let col=0;col<COLS_PATTERN.length;col++){
    for(let row=0;row<COLS_PATTERN[col];row++){
      const el = blockEls[col][row];
      if(!el) continue;
      el.dataset.col = col;
      el.dataset.row = row;
      const pos=getBlockPos(col,row);
      el.style.left=`${pos.x}px`;
      el.style.top=`${pos.y}px`;
    }
  }
}

function getCellFromMouse(){
  const container=document.getElementById('grid-container');
  const rect=container.getBoundingClientRect();
  const localX=lastMouseX-rect.left;
  const localY=lastMouseY-rect.top;
  let best=null; let bestDist=Infinity;
  for(let col=0;col<COLS_PATTERN.length;col++){
    for(let row=0;row<COLS_PATTERN[col];row++){
      const cp=cellPos[col][row];
      const centerX=cp.x+HEX_W/2;
      const centerY=cp.y+HEX_H/2;
      const dx=centerX-localX; const dy=centerY-localY;
      const d=dx*dx+dy*dy;
      if(d<bestDist){ bestDist=d; best={col,row}; }
    }
  }
  if(best&&bestDist<=(HEX_W*0.9)*(HEX_W*0.9)) return best;
  return null;
}

function updateHoveredCellFromMouse(){
  hoveredCell=getCellFromMouse();
  console.log('DEBUG: updateHoveredCellFromMouse', hoveredCell);
}

async function processPendingMatches(){
  if(!playing) return;
  let {lines,cells,clusters} = findAllMatches();
  if(cells.length===0&&clusters.length===0) return;
  let combo=0;
  while(cells.length>0||clusters.length>0){
    combo++;
    await processMatchStep(lines,cells,clusters,false,-1,-1,-1,-1,null,combo);
    await applyGravity();await fillEmpty();
    const next = findAllMatches();
    lines=next.lines; cells=next.cells; clusters=next.clusters;
  }
  checkGameEnd();
}

// ── 게임 종료 ──
function checkGameEnd(){
  if(!playing) return;
  // 돌 기믹이 있으면 돌 전부 제거가 클리어 조건
  if(hasStones()){
    if(totalStones<=0){playing=false;setTimeout(()=>showEndScreen(true),400);}
    else if(movesLeft<=0){playing=false;setTimeout(()=>showEndScreen(false),400);}
  } else {
    if(score>=stageTarget){playing=false;setTimeout(()=>showEndScreen(true),400);}
    else if(movesLeft<=0){playing=false;setTimeout(()=>showEndScreen(false),400);}
  }
}
let lastCleared=false;
function showEndScreen(cleared){
  lastCleared=cleared;
  const o=document.getElementById('end-overlay');
  const icon=document.getElementById('end-icon');
  const title=document.getElementById('end-title');
  const sc=document.getElementById('end-score');
  const det=document.getElementById('end-detail');
  if(cleared){
    icon.textContent='\uD83C\uDF89';title.textContent='\uD074\uB9AC\uC5B4!';title.className='clear';
    det.textContent=initialStones>0
      ?`Stage ${currentStage} \uD074\uB9AC\uC5B4! \uB3CC \uC804\uBD80 \uC81C\uAC70!`
      :`Stage ${currentStage} \uD074\uB9AC\uC5B4! \uBAA9\uD45C ${stageTarget.toLocaleString()}\uC810 \uB2EC\uC131!`;
    // 다음 스테이지 해금
    if(currentStage<STAGES.length){
      currentStage++;
      localStorage.setItem('hexPuzzleStage',currentStage);
    }
  }else{
    icon.textContent='\uD83D\uDE22';title.textContent='\uC2E4\uD328...';title.className='fail';
    det.textContent=initialStones>0
      ?`\uB0A8\uC740 \uB3CC ${totalStones}\uAC1C / Move \uC18C\uC9C4`
      :`\uBAA9\uD45C ${stageTarget.toLocaleString()}\uC810 / \uB0B4 \uC810\uC218 ${score.toLocaleString()}\uC810`;
  }
  sc.textContent=`${score.toLocaleString()}\uC810`;

  // 최고 점수 갱신 체크
  const newRec=document.getElementById('new-record');
  if(score>highScore){
    highScore=score;
    localStorage.setItem('hexPuzzleHighScore',highScore);
    newRec.textContent='\uD83C\uDF89 \uC2E0\uAE30\uB85D!';
    newRec.classList.remove('hidden');
    updateHighScoreUI();
  } else {
    newRec.classList.add('hidden');
  }

  // 버튼 텍스트 변경
  document.getElementById('restart-btn').textContent='\uB85C\uBE44\uB85C \uB3CC\uC544\uAC00\uAE30';
  o.classList.remove('hidden');
}
function hideEndScreen(){document.getElementById('end-overlay').classList.add('hidden');}
function showConfirm(){document.getElementById('confirm-overlay').classList.remove('hidden');}
function hideConfirm(){document.getElementById('confirm-overlay').classList.add('hidden');}

function resetToStart(){
  hideEndScreen();hideConfirm();clearHint();
  playing=false;busy=false;isBusyRainbow=false;isBusyNormal=false;dragState=null;
  animQueue.length=0;animRunning=false;skipDelay=false;
  debugPlaceType=null;
  document.querySelectorAll('.debug-btn').forEach(b=>{b.classList.remove('active');b.textContent=b.textContent.replace(' \u2705','');});
  clearAllBlocks();
  document.getElementById('info-bar').classList.add('hidden');
  document.getElementById('settings-bar').classList.remove('hidden');
  showScreen('lobby-screen');
  updateLobbyStage();
}

// ── UI 셋업 ──
function setupUI(){
  document.querySelectorAll('.color-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(playing) return;
      document.querySelectorAll('.color-btn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');numColors=parseInt(btn.dataset.count);
    });
  });
  document.querySelectorAll('.move-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      if(playing) return;
      document.querySelectorAll('.move-btn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');maxMoves=parseInt(btn.dataset.moves);
    });
  });
  document.getElementById('play-btn').addEventListener('click',()=>{if(!playing) startGame();});
  document.getElementById('restart-btn').addEventListener('click',()=>resetToStart());
  document.getElementById('stop-btn').addEventListener('click',()=>{if(playing) showConfirm();});
  document.getElementById('confirm-yes').addEventListener('click',()=>resetToStart());
  document.getElementById('confirm-no').addEventListener('click',()=>hideConfirm());
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.addEventListener('keydown', (e) => {
    const mouseCell = getCellFromMouse();
    console.log('DEBUG: keydown', e.code, 'mouseCell=', mouseCell, 'hoveredCell=', hoveredCell, 'playing=', playing, 'busy=', busy);
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (!mouseCell) { console.log('DEBUG: Space ignored (no cell under mouse)'); return; }
    if (!playing) { console.log('DEBUG: Space ignored (not playing)'); return; }
    if (busy) { console.log('DEBUG: Space ignored (busy)'); return; }
    hoveredCell = mouseCell;
    removeBlockAt(mouseCell.col, mouseCell.row).catch(err => console.error('removeBlockAt error', err));
  });
}

function toggleTheme() {
  isDarkMode = !isDarkMode;
  localStorage.setItem('hexPuzzleDarkMode', isDarkMode);
  updateTheme();
}

function updateTheme() {
  const body = document.body;
  const toggleBtn = document.getElementById('theme-toggle');
  if (isDarkMode) {
    body.classList.remove('light-mode');
    body.classList.add('dark-mode');
    toggleBtn.textContent = '🌙';
  } else {
    body.classList.remove('dark-mode');
    body.classList.add('light-mode');
    toggleBtn.textContent = '☀️';
  }
}

async function removeBlockAt(col, row) {
  console.log('DEBUG: removeBlockAt', {col,row,boardValue: board[col]?.[row], playing, busy});
  if (!board[col] || !board[col][row]) return;
  board[col][row] = null;
  if (blockEls[col][row]) {
    blockEls[col][row].remove();
    blockEls[col][row] = null;
  }
  // 충전: 빈 칸 채우기 + 매치 처리
  busy = true; isBusyNormal=true;
  clearHint();
  await applyGravity();await fillEmpty();
  await processPendingMatches();
  updateHoveredCellFromMouse();
  busy = false; isBusyNormal=false;
  startHintTimer();
}

// ── 디버그: 특수블록 강제 배치 ──
function placeDebugSpecial(col,row){
  if(!board[col]||!board[col][row]) return;
  const oldCell=board[col][row];
  const color=debugPlaceType==='rainbow'?null:oldCell.color;
  const dir=debugPlaceType==='stripe'?['up','ne','nw'][Math.floor(Math.random()*3)]:null;
  board[col][row]=makeCell(color,debugPlaceType,dir);
  // DOM 교체
  const container=document.getElementById('grid-container');
  if(blockEls[col][row]){blockEls[col][row].remove();blockEls[col][row]=null;}
  const el=createBlockEl(col,row,board[col][row]);
  if(el){
    el.classList.add('stripe-appear');
    container.appendChild(el);blockEls[col][row]=el;
  }
}

// ── 개발자 모드 ──
let devUnlocked=false, devPanelOpen=false;
const DEV_PASSWORD='1013love';

function setupDevMode(){
  // 비밀번호 팝업
  const pwOverlay=document.getElementById('dev-pw-overlay');
  const pwInput=document.getElementById('dev-pw-input');
  const pwError=document.getElementById('dev-pw-error');
  const devBtn=document.getElementById('dev-mode-btn');

  devBtn.addEventListener('click',()=>{
    if(devUnlocked){
      devPanelOpen=!devPanelOpen;
      document.getElementById('dev-panel').classList.toggle('hidden',!devPanelOpen);
      devBtn.classList.toggle('active',devPanelOpen);
    }else{
      pwOverlay.classList.remove('hidden');
      pwInput.value='';pwError.classList.add('hidden');
      pwInput.focus();
    }
  });

  function tryPassword(){
    if(pwInput.value.toLowerCase()===DEV_PASSWORD){
      devUnlocked=true;devPanelOpen=true;
      pwOverlay.classList.add('hidden');
      document.getElementById('dev-panel').classList.remove('hidden');
      devBtn.classList.add('active');
    }else{
      pwError.classList.remove('hidden');
      pwInput.value='';pwInput.focus();
    }
  }

  document.getElementById('dev-pw-ok').addEventListener('click',tryPassword);
  document.getElementById('dev-pw-cancel').addEventListener('click',()=>pwOverlay.classList.add('hidden'));
  pwInput.addEventListener('keydown',e=>{if(e.key==='Enter') tryPassword();});

  // 게임 배속 슬라이더
  const speedSlider=document.getElementById('speed-slider');
  const speedLabel=document.getElementById('speed-label');
  speedSlider.addEventListener('input',()=>{
    const idx=parseInt(speedSlider.value);
    gameSpeed=SPEED_STEPS[idx];
    speedLabel.textContent=gameSpeed+'x';
  });

  // 배치 모드 전체 해제
  let debugGimmickType=null; // null | {type:'stone',level:N} | {type:'clear'}
  function clearAllDebugModes(){
    debugPlaceType=null;
    debugGimmickType=null;
    document.querySelectorAll('.debug-btn[data-type],.gimmick-btn,#gimmick-clear-btn').forEach(b=>b.classList.remove('active'));
  }

  // 특수블록 배치 버튼
  document.querySelectorAll('.debug-btn[data-type]').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const type=btn.dataset.type;
      if(debugPlaceType===type){
        clearAllDebugModes();
      } else {
        clearAllDebugModes();
        debugPlaceType=type;
        btn.classList.add('active');
      }
    });
  });

  // 기믹 배치 버튼
  document.querySelectorAll('.gimmick-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const type=btn.dataset.gimmick;
      const level=parseInt(btn.dataset.level);
      const key=`${type}_${level}`;
      if(debugGimmickType&&`${debugGimmickType.type}_${debugGimmickType.level}`===key){
        clearAllDebugModes();
      } else {
        clearAllDebugModes();
        debugGimmickType={type,level};
        btn.classList.add('active');
      }
    });
  });
  document.getElementById('gimmick-clear-btn').addEventListener('click',()=>{
    if(debugGimmickType?.type==='clear'){
      clearAllDebugModes();
    } else {
      clearAllDebugModes();
      debugGimmickType={type:'clear'};
      document.getElementById('gimmick-clear-btn').classList.add('active');
    }
  });

  // 셀 클릭 시 기믹 배치 처리
  document.getElementById('grid-container').addEventListener('click',(e)=>{
    if(!debugGimmickType||!devUnlocked) return;
    const rect=document.getElementById('grid-container').getBoundingClientRect();
    const scale=rect.width/((COLS_PATTERN.length-1)*COL_SPACING+HEX_W);
    const mx=(e.clientX-rect.left)/scale, my=(e.clientY-rect.top)/scale;
    let bestCol=-1,bestRow=-1,bestDist=Infinity;
    for(let c=0;c<COLS_PATTERN.length;c++){
      for(let r=0;r<COLS_PATTERN[c];r++){
        const p=cellPos[c][r];
        const cx=p.x+HEX_W/2, cy=p.y+HEX_H/2;
        const d=(mx-cx)**2+(my-cy)**2;
        if(d<bestDist){bestDist=d;bestCol=c;bestRow=r;}
      }
    }
    if(bestCol<0) return;
    if(debugGimmickType.type==='clear'){
      removeGimmickEl(bestCol,bestRow);
      totalStones=countStones();initialStones=totalStones;
      updateMissionUI();
    } else {
      placeStone(bestCol,bestRow,debugGimmickType.level);
      initialStones=countStones();
    }
  });

  // 좌표 보기 토글
  let coordVisible=false;
  const coordBtn=document.getElementById('coord-toggle-btn');
  coordBtn.addEventListener('click',()=>{
    coordVisible=!coordVisible;
    coordBtn.classList.toggle('active',coordVisible);
    document.querySelectorAll('.coord-label').forEach(el=>el.remove());
    if(coordVisible){
      const container=document.getElementById('grid-container');
      for(let col=0;col<COLS_PATTERN.length;col++){
        for(let row=0;row<COLS_PATTERN[col];row++){
          const pos=cellPos[col][row];
          const lbl=document.createElement('div');
          lbl.className='coord-label';
          lbl.textContent=`${col},${row}`;
          lbl.style.left=`${pos.x}px`;
          lbl.style.top=`${pos.y}px`;
          lbl.style.width=`${HEX_W}px`;
          lbl.style.height=`${HEX_H}px`;
          lbl.style.lineHeight=`${HEX_H}px`;
          lbl.style.transform='none';
          container.appendChild(lbl);
        }
      }
    }
  });

  // 스테이지 이동 치트
  const stageInput=document.getElementById('dev-stage-input');
  const stageMsg=document.getElementById('dev-stage-msg');
  document.getElementById('dev-stage-go').addEventListener('click',()=>{
    const num=parseInt(stageInput.value);
    if(isNaN(num)||num<1||num>STAGES.length){
      stageMsg.textContent=`1~${STAGES.length} 사이 숫자를 입력하세요`;
      stageMsg.classList.remove('hidden');
      return;
    }
    stageMsg.classList.add('hidden');
    currentStage=num;
    localStorage.setItem('hexPuzzleStage',currentStage);
    resetToStart();
  });

  // 매치 로그 지우기
  document.getElementById('dev-log-clear').addEventListener('click',clearMatchLogs);

  // 인스펙터 생성
  buildInspector();
}

function showInspConfirm(onConfirm){
  const overlay=document.getElementById('insp-confirm-overlay');
  overlay.classList.remove('hidden');
  const yesBtn=document.getElementById('insp-confirm-yes');
  const noBtn=document.getElementById('insp-confirm-no');
  function cleanup(){overlay.classList.add('hidden');yesBtn.replaceWith(yesBtn.cloneNode(true));noBtn.replaceWith(noBtn.cloneNode(true));}
  document.getElementById('insp-confirm-yes').addEventListener('click',()=>{cleanup();onConfirm();});
  document.getElementById('insp-confirm-no').addEventListener('click',cleanup);
}

function buildInspector(){
  const container=document.getElementById('dev-inspector');
  const groups={speed:'⚡ 속도',timing:'✨ 연출 타이밍',score:'🎯 점수'};
  const byGroup={};
  for(const m of CFG_META){
    if(!byGroup[m.group]) byGroup[m.group]=[];
    byGroup[m.group].push(m);
  }
  for(const [gKey,gLabel] of Object.entries(groups)){
    if(!byGroup[gKey]) continue;
    const header=document.createElement('div');header.className='insp-group-header';
    header.innerHTML=`<span class="insp-group-title">${gLabel}</span><button class="insp-reset-btn" data-group="${gKey}">초기화</button>`;
    container.appendChild(header);
    for(const m of byGroup[gKey]){
      const row=document.createElement('div');row.className='insp-item';
      row.innerHTML=
        `<span class="insp-label">${m.label}</span>`+
        `<span class="insp-help">?<span class="insp-tooltip">${m.desc}</span></span>`+
        `<input class="insp-input" type="number" step="${m.step}" value="${CFG[m.key]}" data-key="${m.key}">`+
        `<span class="insp-unit">${m.unit}</span>`;
      container.appendChild(row);
    }
  }
  // 카테고리 초기화 버튼
  container.querySelectorAll('.insp-reset-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      showInspConfirm(()=>{
        const grp=btn.dataset.group;
        for(const m of CFG_META){
          if(m.group!==grp) continue;
          CFG[m.key]=CFG_DEFAULTS[m.key];
          const inp=container.querySelector(`.insp-input[data-key="${m.key}"]`);
          if(inp) inp.value=CFG_DEFAULTS[m.key];
        }
      });
    });
  });
  // 값 변경 이벤트
  container.addEventListener('input',e=>{
    if(!e.target.classList.contains('insp-input')) return;
    const key=e.target.dataset.key;
    const val=parseFloat(e.target.value);
    if(!isNaN(val)&&key in CFG) CFG[key]=val;
  });
  // 툴팁 위치 (fixed 기반)
  container.querySelectorAll('.insp-help').forEach(btn=>{
    const tip=btn.querySelector('.insp-tooltip');
    btn.addEventListener('mouseenter',()=>{
      const r=btn.getBoundingClientRect();
      tip.style.display='block';
      tip.style.left=Math.max(0,r.right-240)+'px';
      tip.style.top=Math.max(0,r.top-tip.offsetHeight-6)+'px';
    });
    btn.addEventListener('mouseleave',()=>{tip.style.display='none';});
  });
}

function startGame(){
  // 상태 완전 초기화 (스테이지 건너뛰기 방지)
  playing=false;busy=false;isBusyRainbow=false;isBusyNormal=false;
  dragState=null;animQueue.length=0;animRunning=false;skipDelay=false;
  score=0;
  clearHint();clearAllBlocks();

  // 스테이지 데이터 적용
  const sd=STAGES[currentStage-1]||STAGES[STAGES.length-1];
  stageTarget=sd.target;
  maxMoves=sd.moves;
  movesLeft=maxMoves;
  numColors=sd.colorTypes;

  // 스테이지 맵 기믹 적용
  applyStageGimmicks(currentStage);

  // UI 갱신 후 게임 시작
  document.getElementById('settings-bar').classList.add('hidden');
  document.getElementById('info-bar').classList.remove('hidden');
  updateScoreUI();updateMovesUI();
  document.getElementById('target-value').textContent=stageTarget.toLocaleString();
  initBoard();spawnAllBlocks();spawnGimmicks();
  totalStones=countStones();
  initialStones=totalStones;
  refreshBlockElsCoordinates();
  updateMissionUI();

  // 매치 로그 초기화
  clearMatchLogs();

  // 모든 초기화 완료 후 playing 활성화
  playing=true;
  startHintTimer();
}

// ── 반응형 스케일 ──
function resizeGrid(){
  const container=document.getElementById('grid-container');
  const wrapper=document.getElementById('grid-wrapper');
  const totalW=(COLS_PATTERN.length-1)*COL_SPACING+HEX_W;
  const totalH=9*ROW_SPACING+HEX_H*0.5;
  // 패널 열림 시 패널 너비(~230px+gap) 고려
  const devPanel=document.getElementById('dev-panel');
  const panelW=devPanel&&!devPanel.classList.contains('hidden')?devPanel.offsetWidth+16:0;
  const availW=window.innerWidth-32-panelW; // 좌우 16px 여백
  const availH=window.innerHeight-200; // 상단 UI + 여유
  const scaleW=availW/totalW;
  const scaleH=availH/totalH;
  const scale=Math.min(scaleW,scaleH,1); // 1 초과 안 함
  container.style.transform=`scale(${scale})`;
  container.style.transformOrigin='top center';
  // wrapper에 실제 크기 반영 (레이아웃 흐름 유지)
  container.style.width=`${totalW}px`;
  container.style.height=`${totalH}px`;
  wrapper.style.minHeight=`${totalH*scale}px`;
}

// ── 화면 전환 ──
function showScreen(id){
  ['main-screen','lobby-screen','skin-screen','game-container'].forEach(s=>{
    document.getElementById(s).classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
  if(id==='game-container') resizeGrid();
}

function updateLobbyStage(){
  const stageBtn=document.getElementById('lobby-stage-btn');
  const numEl=document.getElementById('lobby-stage-num');
  const infoEl=document.getElementById('lobby-stage-info');
  if(currentStage>STAGES.length){
    // 올클리어
    stageBtn.style.display='none';
    infoEl.style.display='none';
    let allClear=document.querySelector('.lobby-all-clear');
    if(!allClear){
      allClear=document.createElement('div');
      allClear.className='lobby-all-clear';
      allClear.textContent='ALL STAGE CLEAR!';
      stageBtn.parentNode.insertBefore(allClear,stageBtn);
    }
  } else {
    stageBtn.style.display='';
    infoEl.style.display='';
    const sd=STAGES[currentStage-1];
    numEl.textContent=currentStage;
    document.getElementById('lobby-stage-target').textContent=`목표 ${sd.target.toLocaleString()}점`;
    document.getElementById('lobby-stage-moves').textContent=`Move ${sd.moves}`;
  }
}

function setupScreenNav(){
  // 메인 → 로비
  document.getElementById('main-start-btn').addEventListener('click',()=>{
    showScreen('lobby-screen');
    updateLobbyStage();
  });
  // 로비 하단 버튼
  document.querySelectorAll('.lobby-menu-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const target=btn.dataset.target;
      if(target==='skin'){
        showScreen('skin-screen');
        renderSkinScreen();
      } else {
        document.getElementById('coming-soon-overlay').classList.remove('hidden');
      }
    });
  });
  // "준비 중" 팝업 닫기
  document.getElementById('coming-soon-ok').addEventListener('click',()=>{
    document.getElementById('coming-soon-overlay').classList.add('hidden');
  });
  // 스테이지 버튼 → 게임 시작
  document.getElementById('lobby-stage-btn').addEventListener('click',()=>{
    if(currentStage>STAGES.length) return;
    showScreen('game-container');
    if(!playing) startGame();
  });
}

// ── 스킨 화면 ──
let skinEditingSlot=-1; // -1: 슬롯 미선택

function renderSkinScreen(){
  skinData=loadSkinData();
  renderSkinSlots();
  skinEditingSlot=-1;
  document.getElementById('skin-collection-area').classList.add('hidden');
}

function renderSkinSlots(){
  const container=document.getElementById('skin-slots');
  container.innerHTML='';
  skinData.slots.forEach((pokeNum,i)=>{
    const slot=document.createElement('div');
    slot.className='skin-slot'+(skinEditingSlot===i?' selected':'');
    applyPokemonBg(slot,pokeNum,56);
    const num=document.createElement('div');
    num.className='skin-slot-num';
    num.textContent=i+1;
    slot.appendChild(num);
    slot.addEventListener('click',()=>{
      skinEditingSlot=i;
      renderSkinSlots();
      renderSkinCollection();
      document.getElementById('skin-collection-area').classList.remove('hidden');
      document.getElementById('skin-editing-slot').textContent=i+1;
    });
    container.appendChild(slot);
  });
}

function renderSkinCollection(){
  const container=document.getElementById('skin-collection');
  container.innerHTML='';
  const equippedSet=new Set(skinData.slots);
  for(let n=1;n<=151;n++){
    const item=document.createElement('div');
    const unlocked=skinData.unlocked.includes(n);
    const equipped=equippedSet.has(n);
    item.className='skin-item'+(unlocked?'':' locked')+(equipped?' equipped':'');
    if(unlocked){
      applyPokemonBg(item,n,48);
    } else {
      applyPokemonBg(item,n,48);
      const lock=document.createElement('div');
      lock.className='skin-item-lock';
      lock.textContent='\uD83D\uDD12';
      item.appendChild(lock);
    }
    const numLabel=document.createElement('div');
    numLabel.className='skin-item-num';
    numLabel.textContent=`#${n}`;
    item.appendChild(numLabel);
    if(unlocked){
      item.addEventListener('click',()=>{
        // 이미 다른 슬롯에 장착된 경우 스왑
        const otherSlot=skinData.slots.indexOf(n);
        if(otherSlot!==-1&&otherSlot!==skinEditingSlot){
          skinData.slots[otherSlot]=skinData.slots[skinEditingSlot];
        }
        skinData.slots[skinEditingSlot]=n;
        saveSkinData(skinData.unlocked,skinData.slots);
        renderSkinSlots();
        renderSkinCollection();
      });
    }
    container.appendChild(item);
  }
}

function setupSkinScreen(){
  document.getElementById('skin-back-btn').addEventListener('click',()=>{
    showScreen('lobby-screen');
  });
}

// ── 시작 ──
(async()=>{
  await loadStageMaps();
  createCells();
  setupUI();
  setupDevMode();
  setupScreenNav();
  setupSkinScreen();
  updateTheme();
  updateHighScoreUI();
  resizeGrid();
  window.addEventListener('resize',resizeGrid);
})();
