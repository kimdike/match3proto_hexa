// ── 헥사 3매치 퍼즐: 보드 상태/초기화/DOM ──
// config.js, grid.js 다음, game.js 이전에 로드
// 매칭 로직/특수블록 효과 로직은 game.js에 남아 있음

// ── 보드 상태 배열 ──
// board[col][row] = { color, type:'normal'|'stripe'|'target'|'bomb'|'rainbow', dir } | null
const board=[], blockEls=[], cellPos=[];
// gimmick[col][row] = { type:'stone', level:1~5 } | null
const gimmick=[], gimmickEls=[];
// 셀 타입: cellType[col][row] = 'normal'|'dead'|'entrance'|'pass'
const cellType=[];
const hexCellEls=[]; // hex-cell DOM 참조 (데드셀 가시성 제어용)
let entranceCols=new Set(); // 사출구가 있는 컬럼 (블록 충전 대상)

let totalStones=0;   // 남은 돌 총 개수
let initialStones=0; // 시작 시 돌 총 개수 (승리조건 판별용)

// ── 스테이지 셀/기믹 적용 ──
// stageMaps는 game.js에서 관리 (fetch/script 양쪽 로드 대응)
function applyStageGimmicks(stageNum){
  if(!stageMaps){ console.warn('[gimmicks] stageMaps is null'); return; }
  const stageData=stageMaps.stages.find(s=>s.stage===stageNum);
  if(!stageData){ console.warn('[gimmicks] stage',stageNum,'not found'); return; }
  if(!stageData.gimmicks){ console.warn('[gimmicks] no gimmicks array for stage',stageNum); return; }
  console.log('[gimmicks] loading',stageData.gimmicks.length,'gimmicks for stage',stageNum);
  for(const g of stageData.gimmicks){
    if(!gimmick[g.col]) gimmick[g.col]=[];
    gimmick[g.col][g.row]={type:g.type,level:g.level};
  }
}

function applyStageCells(stageNum){
  // 초기화: 모두 normal, 모든 컬럼 entrance
  for(let col=0;col<COLS_PATTERN.length;col++){
    cellType[col]=[];
    for(let row=0;row<COLS_PATTERN[col];row++) cellType[col][row]='normal';
  }
  entranceCols=new Set();

  if(!stageMaps){
    for(let col=0;col<COLS_PATTERN.length;col++) entranceCols.add(col);
    return;
  }
  const sd=stageMaps.stages.find(s=>s.stage===stageNum);
  if(!sd||!sd.cells){
    for(let col=0;col<COLS_PATTERN.length;col++) entranceCols.add(col);
    return;
  }
  for(const c of sd.cells){
    if(c.type==='entrance'){
      entranceCols.add(c.col);
      if(c.row>=0&&cellType[c.col]) cellType[c.col][c.row]='entrance';
    }
    else if(c.type==='dead'&&cellType[c.col]) cellType[c.col][c.row]='dead';
    else if(c.type==='pass'&&cellType[c.col]&&c.row>=0) cellType[c.col][c.row]='pass';
  }
  // 데드셀/엔트런스 hex-cell 가시성 업데이트
  for(let col=0;col<COLS_PATTERN.length;col++){
    for(let row=0;row<COLS_PATTERN[col];row++){
      if(hexCellEls[col]?.[row]) hexCellEls[col][row].style.visibility=isNonPlayable(col,row)?'hidden':'';
    }
  }
}

// ── 보드 셀 헬퍼 ──
function makeCell(color,type,dir){ return {color,type:type||'normal',dir:dir||null}; }
function getColor(c,r){ const cell=board[c]?.[r]; if(!cell||cell.type!=='normal') return null; return cell.color ?? null; }
function getType(c,r){ return board[c]?.[r]?.type ?? null; }
function isSpecial(c,r){ const t=getType(c,r); return t&&t!=='normal'; }

// ── 보드 초기 충전 ──
// hasMatchAt/hasClusterAt/numColors는 game.js의 전역을 참조
function initBoard(){
  for(let col=0;col<COLS_PATTERN.length;col++){
    board[col]=[];
    if(!gimmick[col]) gimmick[col]=[];
    if(!gimmickEls[col]) gimmickEls[col]=[];
    for(let row=0;row<COLS_PATTERN[col];row++){
      if(gimmick[col][row]||isNonPlayable(col,row)){ board[col][row]=null; continue; }
      const idx=shuffle([...Array(numColors).keys()]);
      for(const c of idx){ board[col][row]=makeCell(c); if(!hasMatchAt(col,row)&&!hasClusterAt(col,row)) break; }
    }
  }
}

// ── 셀 DOM 생성 ──
// onDragStart/onDragMove/onDragEnd, hoveredCell, lastMouseX/Y는 game.js 정의 (드래그 입력)
function createCells(){
  const container=document.getElementById('grid-container');
  document.documentElement.style.setProperty('--hex-w',`${HEX_W}px`);
  document.documentElement.style.setProperty('--hex-h',`${HEX_H}px`);
  document.documentElement.style.setProperty('--block-d',`${BLOCK_D*(CFG.blockScale||1.0)}px`);
  for(let col=0;col<COLS_PATTERN.length;col++){
    cellPos[col]=[];blockEls[col]=[];hexCellEls[col]=[];
    for(let row=0;row<COLS_PATTERN[col];row++){
      const pos=getCellPos(col,row); cellPos[col][row]=pos;
      const cell=document.createElement('div'); cell.className='hex-cell';
      cell.style.left=`${pos.x}px`;cell.style.top=`${pos.y}px`;
      cell.addEventListener('mouseover', () => { hoveredCell = { col, row }; });
      cell.addEventListener('mouseout', () => { hoveredCell = null; });
      container.appendChild(cell);
      hexCellEls[col][row]=cell;
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

// ── 블록 DOM ──
// skinData/applyPokemonBg/getStripeImage는 game.js 정의
function createBlockEl(col,row,cell){
  if(!cell) return null;
  const pos=getBlockPos(col,row);
  const el=document.createElement('div');
  el.className='hex-block'; el.dataset.col=col; el.dataset.row=row;
  el.addEventListener('mouseover', () => { hoveredCell = { col, row }; });
  el.addEventListener('mouseout', () => { hoveredCell = null; });
  // 블록 크기 배율 (개발자 모드 인스펙터 "🎨 비주얼" → blockScale)
  const bs=CFG.blockScale||1.0;
  const baseD=BLOCK_D*bs;
  // 특수블록: 이미지 아이콘
  if(cell.type==='stripe'||cell.type==='bomb'||cell.type==='target'||cell.type==='rainbow'){
    const imgSrc=cell.type==='stripe'?getStripeImage(cell.dir):SPECIAL_IMAGES[cell.type];
    const spSz=Math.round(BLOCK_D*1.1*bs);
    el.style.width=`${spSz}px`;el.style.height=`${spSz}px`;
    el.style.margin=`${-(spSz-baseD)/2}px 0 0 ${-(spSz-baseD)/2}px`;
    el.classList.add('special-block',cell.type);
    el.style.backgroundImage=`url(${imgSrc})`;
  } else {
    // 일반블록: 포켓몬 스킨 또는 단색
    const pokeNum=skinData.slots[cell.color];
    if(pokeNum){
      const pokeSz=Math.round(BLOCK_D*1.1*bs);
      el.style.width=`${pokeSz}px`;el.style.height=`${pokeSz}px`;
      el.style.margin=`${-(pokeSz-baseD)/2}px 0 0 ${-(pokeSz-baseD)/2}px`;
      el.classList.add('pokemon-block');
      applyPokemonBg(el,pokeNum,pokeSz,true);
    } else {
      el.style.background=ALL_COLORS[cell.color].bg;
    }
  }
  // blockScale 적용 시 셀 중앙 정렬 보정 (pos는 BLOCK_D 고정값 기준이라 스케일만큼 우하단으로 밀림)
  const adj=BLOCK_D*(bs-1)/2;
  el.style.left=`${pos.x-adj}px`;el.style.top=`${pos.y-adj}px`;
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

// ── 기믹 (돌) DOM ──
// updateMissionUI는 game.js 정의
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
    removeGimmickEl(col,row);
    totalStones--;
  } else {
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
