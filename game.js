// ── 헥사 3매치 퍼즐 ──

const COLS_PATTERN = [9, 8, 9, 8, 9, 8, 9, 8, 9];
const HEX_SIZE = 36;
const HEX_W = HEX_SIZE * 2;
const HEX_H = Math.sqrt(3) * HEX_SIZE;
const COL_SPACING = HEX_SIZE * 1.5;
const ROW_SPACING = HEX_H;
const BLOCK_D = 50;
const TARGET_SCORE = 50000;

const ALL_COLORS = [
  { name:'red',bg:'#e74c3c' },{ name:'orange',bg:'#f39c12' },
  { name:'yellow',bg:'#f1c40f' },{ name:'green',bg:'#2ecc71' },
  { name:'blue',bg:'#3498db' },{ name:'indigo',bg:'#5b6abf' },
  { name:'violet',bg:'#9b59b6' },
];

// ── 조절 가능한 설정값 ──
const CFG = {
  gravityTransition: 0.2,   gravityDelay: 240,
  fillTransition: 0.2,      fillDelay: 150,
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
let dragState=null;
const DRAG_THRESHOLD=20;
let hintTimer=null, hintedCells=[];
const HINT_DELAY=5000;

// ── 실시간 매칭 ──
// isBusyRainbow: true면 조작 불가 (무지개볼 연출 중)
// isBusyNormal: true면 일반 연출 중이지만 조작 가능
let isBusyRainbow=false;
let isBusyNormal=false;
let swapLock=false;       // trySwap 동시 실행 방지 락
let pendingSwap=null;     // 락 중 들어온 swap 요청 {c1,r1,c2,r2}

// ── 헬퍼 ──
function makeCell(color,type,dir){ return {color,type:type||'normal',dir:dir||null}; }
function getColor(c,r){ return board[c]?.[r]?.color ?? null; }
function getType(c,r){ return board[c]?.[r]?.type ?? null; }
function isSpecial(c,r){ const t=getType(c,r); return t&&t!=='normal'; }
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
function delay(ms){ return new Promise(r=>setTimeout(r,ms)); }
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

  // 4+ 동색 인접 클러스터 감지 (BFS) — 타겟볼/폭탄볼 감지용
  // 클러스터 셀은 cellSet에 추가하지 않음 (제거 범위는 특수블록 종류에 따라 결정)
  const clusters=[];
  const clVisited=new Set();
  for(let col=0;col<COLS_PATTERN.length;col++){
    for(let row=0;row<COLS_PATTERN[col];row++){
      const k=`${col},${row}`;
      if(clVisited.has(k)) continue;
      const cell=board[col][row];
      if(!cell||cell.type!=='normal'){clVisited.add(k);continue;}
      const color=cell.color;
      const group=[];
      const stk=[[col,row]];
      while(stk.length){
        const [c,r]=stk.pop();
        const ck=`${c},${r}`;
        if(clVisited.has(ck)) continue;
        const cc=board[c]?.[r];
        if(!cc||cc.type!=='normal'||cc.color!==color) continue;
        clVisited.add(ck);
        group.push([c,r]);
        for(const [nc,nr] of getNeighbors(c,r)) stk.push([nc,nr]);
      }
      if(group.length>=4){
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
        clusters.push({color,cells:group,isStraight:maxLine===group.length,hasLine:maxLine>=3,size:group.length});
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
  // 3) BFS 클러스터 (타겟볼용: 직선 없는 뭉친 블록 4~5개)
  let targetGroup=null;
  for(const g of clusters){
    if(g.size>=4 && !g.hasLine && !targetGroup) targetGroup=g;
  }

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
    const color=getColor(bestLine5[0][0],bestLine5[0][1]);
    return {type:'rainbow',col:pivot.col,row:pivot.row,color:null,dir:null,mergeCells:bestLine5};
  }

  // 2순위: 폭탄볼 (라인 매치 5+셀, 비직선 — 교차/겹침 라인)
  if(bombGroup){
    const pivot=choosePivot(bombGroup.cells);
    return {type:'bomb',col:pivot.col,row:pivot.row,color:bombGroup.color,dir:null,mergeCells:bombGroup.cells};
  }

  // 3순위: 줄볼 (직선4+)
  if(bestLine4){
    const lc=getColor(bestLine4[0][0],bestLine4[0][1]);
    const pivot=choosePivot(bestLine4);
    const dir=isFirst?swapDir:getLineDirFromCells(bestLine4);
    return {type:'stripe',col:pivot.col,row:pivot.row,color:lc,dir,mergeCells:bestLine4};
  }

  // 4순위: 타겟볼 (직선 없는 클러스터 4+)
  if(targetGroup){
    const pivot=choosePivot(targetGroup.cells);
    return {type:'target',col:pivot.col,row:pivot.row,color:targetGroup.color,dir:null,mergeCells:targetGroup.cells};
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
    for(let row=0;row<COLS_PATTERN[col];row++){
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
  if(cell.type==='rainbow'){
    el.classList.add('rainbow');
    const ind=document.createElement('div'); ind.className='rainbow-indicator'; el.appendChild(ind);
  } else {
    el.style.background=ALL_COLORS[cell.color].bg;
  }
  el.style.left=`${pos.x}px`;el.style.top=`${pos.y}px`;
  if(cell.type==='stripe'){
    el.classList.add('stripe');
    const ind=document.createElement('div'); ind.className='stripe-indicator';
    ind.style.transform=`rotate(${getStripeAngle(cell.dir)}deg)`; el.appendChild(ind);
  } else if(cell.type==='target'){
    el.classList.add('target');
    el.appendChild(Object.assign(document.createElement('div'),{className:'target-indicator'}));
  } else if(cell.type==='bomb'){
    el.classList.add('bomb');
    el.appendChild(Object.assign(document.createElement('div'),{className:'bomb-indicator'}));
  }
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
  container.querySelectorAll('.hex-block,.score-popup,.stripe-beam,.bomb-explosion,.target-projectile').forEach(e=>e.remove());
  for(let col=0;col<COLS_PATTERN.length;col++){blockEls[col]=[];board[col]=[];}
  dragState=null;
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
      if(!board[col][row]) continue;
      for(const [nc,nr] of getNeighbors(col,row)){
        if(!board[nc][nr]) continue;
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
  const pt=CFG.projectileTransition;
  proj.style.transition=`left ${pt}s ease-in-out,top ${pt}s cubic-bezier(0.2,-0.6,0.7,1.4)`;
  proj.style.left=`${to.x+BLOCK_D/2-6}px`;proj.style.top=`${to.y+BLOCK_D/2-6}px`;
  await delay(pt*1000+20);proj.remove();
}

// ── 무지개볼 발동 ──
async function activateRainbow(col,row,targetColor){
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
  await delay(300);
  if(blockEls[col][row]){blockEls[col][row].remove();blockEls[col][row]=null;}
  for(const [c,r] of targets){
    if(blockEls[c][r]){blockEls[c][r].remove();blockEls[c][r]=null;}
  }
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
    if(debugPlaceType&&playing&&!busy) placeDebugSpecial(col,row);
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

// ── 스왑 ──
async function trySwap(c1,r1,c2,r2){
  // 동시 실행 방지: 이미 swap 처리 중이면 대기열에 저장
  if(swapLock){
    pendingSwap={c1,r1,c2,r2};
    return;
  }
  swapLock=true;

  try{
  busy=true;isBusyNormal=true;

  // ① 로직 즉시 실행 (동기 — board 교환 + 매치 판정 + 실패 시 원복)
  const result=executeSwap(c1,r1,c2,r2);

  // ② swap 애니메이션 (board는 이미 확정된 상태)
  await animateSwap(c1,r1,c2,r2);

  // ③ 매치 실패 → 되돌리기 애니메이션 (board는 executeSwap에서 이미 원복됨)
  if(!result.valid){
    await animateSwap(c1,r1,c2,r2); // blockEls 원복 (2회 호출로 원위치)
    busy=false;isBusyNormal=false;isBusyRainbow=false;
    return;
  }

  movesLeft--;updateMovesUI();

  // ④ 특수블록 교차 효과
  if(result.type==='cross'){
    if(getType(c1,r1)==='rainbow'||getType(c2,r2)==='rainbow'){isBusyNormal=false;isBusyRainbow=true;}
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
    return;
  }

  // ⑤ 무지개볼
  if(result.type==='rainbow'){
    isBusyNormal=false;isBusyRainbow=true;
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
    return;
  }

  // ⑥ 일반 매치
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

  }finally{
    // 락 해제 후 대기 중인 swap 처리
    swapLock=false;
    if(pendingSwap){
      const ps=pendingSwap; pendingSwap=null;
      if(playing&&board[ps.c1]?.[ps.r1]&&board[ps.c2]?.[ps.r2]&&isAdjacent(ps.c1,ps.r1,ps.c2,ps.r2)){
        trySwap(ps.c1,ps.r1,ps.c2,ps.r2);
      }else{
        startHintTimer();
      }
    }else{
      startHintTimer();
    }
  }
}

// ── 개별 특수블록 발동 (swap 교차용) ──
async function activateSpecialAt(col,row){
  const cell=board[col][row]; if(!cell) return;
  const t=cell.type;
  // 제거
  if(blockEls[col][row]) blockEls[col][row].classList.add('matched');
  board[col][row]=null;
  await delay(CFG.specialActivateDelay);
  if(blockEls[col][row]){blockEls[col][row].remove();blockEls[col][row]=null;}

  const destroyed=[];
  if(t==='stripe'){
    showStripeBeam(col,row,cell.dir);
    for(const [sc,sr] of getStripeLine(col,row,cell.dir)){
      if(board[sc][sr]!==null) destroyed.push([sc,sr]);
    }
  } else if(t==='bomb'){
    showBombExplosion(col,row);
    for(const [nc,nr] of getNeighbors(col,row)){
      if(board[nc][nr]!==null) destroyed.push([nc,nr]);
    }
  } else if(t==='target'){
    const rnd=getRandomBlockPos(null);
    if(rnd){
      await fireTargetProjectile(col,row,rnd[0],rnd[1],cell.color);
      destroyed.push(rnd);
    }
  } else if(t==='rainbow'){
    const rnd=getRandomBlockPos(null);
    if(rnd){
      const tc=board[rnd[0]][rnd[1]].color;
      for(let c=0;c<COLS_PATTERN.length;c++)
        for(let r=0;r<COLS_PATTERN[c];r++)
          if(board[c][r]&&board[c][r].color===tc&&board[c][r].type==='normal')
            destroyed.push([c,r]);
    }
  }

  // 파괴 + 연쇄 (파괴 대상 중 특수블록이 있으면 재귀)
  const chainSpecials=[];
  for(const [dc,dr] of destroyed){
    if(!board[dc][dr]) continue;
    if(isSpecial(dc,dr)) chainSpecials.push([dc,dr,board[dc][dr]]);
    if(blockEls[dc][dr]) blockEls[dc][dr].classList.add('matched');
    board[dc][dr]=null;
  }
  await delay(CFG.specialActivateDelay);
  for(const [dc,dr] of destroyed){
    if(blockEls[dc][dr]){blockEls[dc][dr].remove();blockEls[dc][dr]=null;}
  }
  score+=destroyed.length*100;updateScoreUI();

  // 예외1: 연쇄 발동
  for(const [sc,sr,scell] of chainSpecials){
    // 임시 복원 후 발동 (이미 제거됨이므로 직접 효과만)
    await activateSpecialEffect(sc,sr,scell);
  }
}

// 이미 제거된 특수블록의 효과만 발동
async function activateSpecialEffect(col,row,cell){
  const destroyed=[];
  if(cell.type==='stripe'){
    showStripeBeam(col,row,cell.dir);
    for(const [sc,sr] of getStripeLine(col,row,cell.dir))
      if(board[sc][sr]!==null) destroyed.push([sc,sr]);
  } else if(cell.type==='bomb'){
    showBombExplosion(col,row);
    for(const [nc,nr] of getNeighbors(col,row))
      if(board[nc][nr]!==null) destroyed.push([nc,nr]);
  } else if(cell.type==='target'){
    const rnd=getRandomBlockPos(null);
    if(rnd){
      await fireTargetProjectile(col,row,rnd[0],rnd[1],cell.color);
      destroyed.push(rnd);
    }
  } else if(cell.type==='rainbow'){
    const rnd=getRandomBlockPos(null);
    if(rnd){
      const tc=board[rnd[0]][rnd[1]].color;
      for(let c=0;c<COLS_PATTERN.length;c++)
        for(let r=0;r<COLS_PATTERN[c];r++)
          if(board[c][r]&&board[c][r].color===tc&&board[c][r].type==='normal')
            destroyed.push([c,r]);
    }
  }
  const chainSpecials=[];
  for(const [dc,dr] of destroyed){
    if(!board[dc][dr]) continue;
    if(isSpecial(dc,dr)) chainSpecials.push([dc,dr,board[dc][dr]]);
    if(blockEls[dc][dr]) blockEls[dc][dr].classList.add('matched');
    board[dc][dr]=null;
  }
  await delay(CFG.specialActivateDelay);
  for(const [dc,dr] of destroyed){
    if(blockEls[dc][dr]){blockEls[dc][dr].remove();blockEls[dc][dr]=null;}
  }
  score+=destroyed.length*100;updateScoreUI();
  // 재귀 연쇄
  for(const [sc,sr,scell] of chainSpecials){
    await activateSpecialEffect(sc,sr,scell);
  }
}

// ── 교차 효과 처리 (특수블록 2개 swap) ──
async function handleCrossEffect(c1,r1,c2,r2){
  const cell1={...board[c1][r1]},cell2={...board[c2][r2]};
  const t1=cell1.type,t2=cell2.type;
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

  // 셀 파괴 + 점수 + 특수블록 연쇄
  async function destroyCells(cells){
    const chainSpecials=[],destroyed=[];
    for(const [c,r] of cells){
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
  // ④ 줄볼 x 타겟볼: 랜덤 위치로 날아간 후 줄볼 효과
  else if(combo==='stripe+target'){
    const sCell=typeA==='stripe'?cellA:cellB;
    const tC=typeA==='target'?cA:cB, tR=typeA==='target'?rA:rB;
    await removeBoth();
    const rnd=getRandomBlockPos(null);
    if(rnd){
      await fireTargetProjectile(tC,tR,rnd[0],rnd[1],sCell.color);
      showStripeBeam(rnd[0],rnd[1],sCell.dir);
      const lineCells=getStripeLine(rnd[0],rnd[1],sCell.dir);
      lineCells.push(rnd);
      await destroyCells(lineCells);
    }
  }
  // ⑤ 타겟볼 x 타겟볼: 발사체 4개 동시 발사
  else if(combo==='target+target'){
    await removeBoth();
    const excluded=new Set(),targets=[];
    for(let i=0;i<4;i++){const rnd=getRandomBlockPos(excluded);if(rnd){excluded.add(`${rnd[0]},${rnd[1]}`);targets.push(rnd);}}
    const promises=targets.map((t,i)=>{
      const from=i<2?[cA,rA]:[cB,rB];
      return fireTargetProjectile(from[0],from[1],t[0],t[1],cellA.color);
    });
    await Promise.all(promises);
    await destroyCells(targets);
  }
  // ⑥ 폭탄볼 x 타겟볼: 랜덤 위치로 날아간 후 폭탄 효과
  else if(combo==='bomb+target'){
    const tC=typeB==='target'?cB:cA, tR=typeB==='target'?rB:rA;
    await removeBoth();
    const rnd=getRandomBlockPos(null);
    if(rnd){
      await fireTargetProjectile(tC,tR,rnd[0],rnd[1],cellA.color);
      showBombExplosion(rnd[0],rnd[1]);
      const nbrs=getNeighbors(rnd[0],rnd[1]).map(([c,r])=>[c,r]);
      nbrs.push(rnd);
      await destroyCells(nbrs);
    }
  }
  // ⑦ 무지개볼 x 줄볼: 순차 탐지→변환 후 동시 발동
  else if(combo==='rainbow+stripe'){
    const targetColor=cellB.color;
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
    const targetColor=cellB.color;
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
    await destroyCells(allCells);
  }
  // ⑩ 무지개볼 x 타겟볼: 순차 탐지→변환 후 동시 발동
  else if(combo==='rainbow+target'){
    const targetColor=cellB.color;
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
    // 모든 타겟볼 동시 발동: 각각 랜덤 위치로 발사
    const allDestroy=new Set();
    const excluded=new Set(converts.map(([c,r])=>`${c},${r}`));
    for(const [c,r] of converts){
      allDestroy.add(`${c},${r}`);
      const rnd=getRandomBlockPos(excluded);
      if(rnd){
        excluded.add(`${rnd[0]},${rnd[1]}`);
        allDestroy.add(`${rnd[0]},${rnd[1]}`);
        fireTargetProjectile(c,r,rnd[0],rnd[1],targetColor);
      }
    }
    await delay(350);
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

  // 5) 점수
  let turnScore=0;
  for(const line of curLines) turnScore+=calcLineScore(line.length);
  turnScore+=(extraCells.size+rainbowHitCount*10)*100;
  const comboBonus=calcComboBonus(combo);
  turnScore+=comboBonus;
  score+=turnScore;updateScoreUI();

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
      el.style.transition='left 0.3s ease-in,top 0.3s ease-in,transform 0.3s ease-in,opacity 0.3s ease-in';
      el.style.left=`${tPos.x}px`;el.style.top=`${tPos.y}px`;
      el.style.transform='scale(0.2)';el.style.opacity='0';
    }
    const pivotEl=blockEls[specialInfo.col][specialInfo.row];
    if(pivotEl){
      pivotEl.style.transition='transform 0.3s ease-in,opacity 0.15s ease-in 0.15s';
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

  // 6c) 타겟볼 발동
  if(actTargets.length>0){
    for(const t of actTargets){
      const rnd=getRandomBlockPos(allCellSet);if(!rnd) continue;
      const [rc,rr]=rnd;
      await fireTargetProjectile(t.col,t.row,rc,rr,t.color);
      if(blockEls[rc][rr]) blockEls[rc][rr].classList.add('matched');
      board[rc][rr]=null;
      score+=100;updateScoreUI();
      await delay(CFG.specialActivateDelay);
      if(blockEls[rc][rr]){blockEls[rc][rr].remove();blockEls[rc][rr]=null;}
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

  // 무지개볼 + 일반블록
  const rb1=getType(c1,r1)==='rainbow',rb2=getType(c2,r2)==='rainbow';
  if(rb1||rb2){
    const rainbowPos=rb2?{col:c2,row:r2}:{col:c1,row:r1};
    const otherPos=rb2?{col:c1,row:r1}:{col:c2,row:r2};
    const targetColor=board[otherPos.col][otherPos.row]?.color;
    if(targetColor!==null&&targetColor!==undefined){
      return {valid:true,type:'rainbow',rainbowPos,otherPos,targetColor};
    }
    swapBoard(c1,r1,c2,r2); // 원복
    return {valid:false};
  }

  // 일반 매치
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
  el1.style.transition='left 0.2s ease,top 0.2s ease';
  el2.style.transition='left 0.2s ease,top 0.2s ease';
  el1.style.zIndex='3';el2.style.zIndex='3';
  el1.style.left=`${p2.x}px`;el1.style.top=`${p2.y}px`;
  el2.style.left=`${p1.x}px`;el2.style.top=`${p1.y}px`;
  await delay(220);
  el1.style.zIndex='';el2.style.zIndex='';
  el1.style.transition='';el2.style.transition='';
  el1.dataset.col=c2;el1.dataset.row=r2;
  el2.dataset.col=c1;el2.dataset.row=r1;
  blockEls[c1][r1]=el2;blockEls[c2][r2]=el1;
}

// ── 낙하 ──
async function applyGravity(){
  let moved=false;
  for(let col=0;col<COLS_PATTERN.length;col++){
    let wr=COLS_PATTERN[col]-1;
    for(let row=COLS_PATTERN[col]-1;row>=0;row--){
      if(board[col][row]!==null){
        if(row!==wr){
          board[col][wr]=board[col][row];board[col][row]=null;
          blockEls[col][wr]=blockEls[col][row];blockEls[col][row]=null;
          const el=blockEls[col][wr];
          if(el){
            el.dataset.row=wr;
            const pos=getBlockPos(col,wr);
            el.style.transition=`top ${CFG.gravityTransition}s ease-in`;el.style.top=`${pos.y}px`;
          }
          moved=true;
        }
        wr--;
      }
    }
  }
  if(moved) await delay(CFG.gravityDelay);
  refreshBlockElsCoordinates();
}

// ── 보충 ──
async function fillEmpty(){
  const container=document.getElementById('grid-container');
  let filled=false;
  for(let col=0;col<COLS_PATTERN.length;col++){
    let empty=0;
    for(let r=0;r<COLS_PATTERN[col];r++) if(board[col][r]===null) empty++;
    for(let row=0;row<COLS_PATTERN[col];row++){
      if(board[col][row]===null){
        const ci=Math.floor(Math.random()*numColors);
        board[col][row]=makeCell(ci);
        const pos=getBlockPos(col,row);
        const el=createBlockEl(col,row,board[col][row]);
        if(el){
          el.style.top=`${pos.y-empty*ROW_SPACING}px`;el.style.transition='none';
          container.appendChild(el);blockEls[col][row]=el;
          el.offsetHeight;
          el.style.transition=`top ${CFG.fillTransition}s ease-in`;el.style.top=`${pos.y}px`;
        } else {
          blockEls[col][row] = null;
        }
        filled=true;
      }
    }
  }
  if(filled){
    await delay(CFG.fillDelay);
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
    await applyGravity();
    await fillEmpty();
    const next = findAllMatches();
    lines=next.lines; cells=next.cells; clusters=next.clusters;
  }
  checkGameEnd();
}

// ── 게임 종료 ──
function checkGameEnd(){
  if(score>=TARGET_SCORE){playing=false;setTimeout(()=>showEndScreen(true),400);}
  else if(movesLeft<=0){playing=false;setTimeout(()=>showEndScreen(false),400);}
}
function showEndScreen(cleared){
  const o=document.getElementById('end-overlay');
  const icon=document.getElementById('end-icon');
  const title=document.getElementById('end-title');
  const sc=document.getElementById('end-score');
  const det=document.getElementById('end-detail');
  if(cleared){
    icon.textContent='\uD83C\uDF89';title.textContent='\uD074\uB9AC\uC5B4!';title.className='clear';
    det.textContent=`\uBAA9\uD45C ${TARGET_SCORE.toLocaleString()}\uC810 \uB2EC\uC131!`;
  }else{
    icon.textContent='\uD83D\uDE22';title.textContent='\uC2E4\uD328...';title.className='fail';
    det.textContent=`\uBAA9\uD45C ${TARGET_SCORE.toLocaleString()}\uC810 / \uB0A8\uC740 Move 0`;
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

  o.classList.remove('hidden');
}
function hideEndScreen(){document.getElementById('end-overlay').classList.add('hidden');}
function showConfirm(){document.getElementById('confirm-overlay').classList.remove('hidden');}
function hideConfirm(){document.getElementById('confirm-overlay').classList.add('hidden');}

function resetToStart(){
  hideEndScreen();hideConfirm();clearHint();
  playing=false;busy=false;isBusyRainbow=false;isBusyNormal=false;swapLock=false;pendingSwap=null;dragState=null;
  debugPlaceType=null;
  document.querySelectorAll('.debug-btn').forEach(b=>{b.classList.remove('active');b.textContent=b.textContent.replace(' \u2705','');});
  clearAllBlocks();
  document.getElementById('info-bar').classList.add('hidden');
  document.getElementById('settings-bar').classList.remove('hidden');
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
  await applyGravity();
  await fillEmpty();
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

  // 특수블록 배치 버튼
  document.querySelectorAll('.debug-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const type=btn.dataset.type;
      if(debugPlaceType===type){
        debugPlaceType=null;
        btn.classList.remove('active');
        btn.textContent=btn.textContent.replace(' \u2705','');
      }else{
        debugPlaceType=type;
        document.querySelectorAll('.debug-btn').forEach(b=>{
          b.classList.remove('active');
          b.textContent=b.textContent.replace(' \u2705','');
        });
        btn.classList.add('active');
        btn.textContent=btn.textContent.replace(' \u2705','')+' \u2705';
      }
    });
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
  playing=true;score=0;movesLeft=maxMoves;
  document.getElementById('settings-bar').classList.add('hidden');
  document.getElementById('info-bar').classList.remove('hidden');
  updateScoreUI();updateMovesUI();
  document.getElementById('target-value').textContent=TARGET_SCORE.toLocaleString();
  clearAllBlocks();initBoard();spawnAllBlocks();
  refreshBlockElsCoordinates();
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

// ── 시작 ──
createCells();
setupUI();
setupDevMode();
updateTheme();
updateHighScoreUI();
resizeGrid();
window.addEventListener('resize',resizeGrid);
