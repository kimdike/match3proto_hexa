// ── 헥사 3매치 퍼즐: 그리드/좌표 유틸 ──
// config.js 이후, game.js 이전에 로드
// 상태(cellType, cellPos)는 game.js 전역을 참조한다

// ── 셀 타입 헬퍼 ──
function isDead(c,r){ return cellType[c]?.[r]==='dead'; }
function isEntrance(c,r){ return cellType[c]?.[r]==='entrance'; }
function isPass(c,r){ return cellType[c]?.[r]==='pass'; }
function isNonPlayable(c,r){ const t=cellType[c]?.[r]; return !!t&&t!=='normal'; }

// ── 그리드 유효성/열 종류 ──
function isValid(c,r){ return c>=0 && c<COLS_PATTERN.length && r>=0 && r<COLS_PATTERN[c]; }
function isLongCol(c){ return COLS_PATTERN[c]===9; }

// ── 좌표 변환 ──
function getCellPos(col,row){
  return { x:col*COL_SPACING, y:row*ROW_SPACING+(isLongCol(col)?0:ROW_SPACING*0.5) };
}
function getBlockPos(col,row){
  const cp=cellPos[col][row];
  return { x:cp.x+(HEX_W-BLOCK_D)/2, y:cp.y+(HEX_H-BLOCK_D)/2 };
}

// ── 인접/이동 ──
function getNeighbors(col,row){
  const long=isLongCol(col);
  const off=[[0,-1],[0,1],...(long?[[-1,-1],[-1,0],[1,-1],[1,0]]:[[-1,0],[-1,1],[1,0],[1,1]])];
  return off.map(([dc,dr])=>[col+dc,row+dr]).filter(([c,r])=>isValid(c,r)&&!isNonPlayable(c,r));
}
function isAdjacent(c1,r1,c2,r2){ return getNeighbors(c1,r1).some(([c,r])=>c===c2&&r===r2); }

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

function getSwapDirection(c1,r1,c2,r2){
  const dc=c2-c1,dr=r2-r1,long=isLongCol(c1);
  if(dc===0&&dr===-1) return 'up'; if(dc===0&&dr===1) return 'down';
  if(long){ if(dc===1&&dr===-1) return 'ne'; if(dc===1&&dr===0) return 'se'; if(dc===-1&&dr===-1) return 'nw'; if(dc===-1&&dr===0) return 'sw'; }
  else { if(dc===1&&dr===0) return 'ne'; if(dc===1&&dr===1) return 'se'; if(dc===-1&&dr===0) return 'nw'; if(dc===-1&&dr===1) return 'sw'; }
  return null;
}

// ── 방향 축/수직 ──
function getStripeAxis(dir){ for(const [a,b] of AXES) if(dir===a||dir===b) return [a,b]; return ['up','down']; }
function getPerpDirs(dir){
  const axis=getStripeAxis(dir),key=axis.slice().sort().join(',');
  return {'down,up':['ne','nw'],'ne,sw':['nw','se'],'nw,se':['ne','sw']}[key]||['ne','nw'];
}

// ── 라인 방향 판별 ──
function getLineDirFromCells(line){
  const [c0,r0]=line[0],[c1,r1]=line[1];
  if(c1-c0===0) return 'up';
  const p0=getBlockPos(c0,r0),p1=getBlockPos(c1,r1);
  return Math.atan2(p1.y-p0.y,p1.x-p0.x)<0?'ne':'se';
}

// ── 셀 범위 쿼리 ──
// 반경 2 헥사 디스크(19셀). step 기반이라 entrance/dead/pass 셀을 "경유"해도 끊기지 않음.
// getNeighbors는 non-playable을 필터링하므로 BFS에 쓰면 경유 셀이 막혀 꼭짓점 셀을 놓친다.
const RANGE_DIRS=['up','down','ne','nw','se','sw'];
function getCellsInRange2(col,row){
  const result=new Set();
  result.add(`${col},${row}`);
  const ring1=[];
  for(const d of RANGE_DIRS){
    const p=step(col,row,d);
    if(p){ result.add(`${p[0]},${p[1]}`); ring1.push(p); }
  }
  for(const [rc,rr] of ring1){
    for(const d of RANGE_DIRS){
      const p=step(rc,rr,d);
      if(p) result.add(`${p[0]},${p[1]}`);
    }
  }
  return [...result].map(k=>k.split(',').map(Number));
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
