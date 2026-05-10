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

// tile[col][row] = { type:'grass', level:1|2 } | null  (타일형 — 셀 바닥, 위에 블록 공존)
// gimmick과 별개 레이어. 중력 영향 X, 매칭 X. 그 셀에서 블록이 매칭으로 제거될 때 단계 -1.
const tile=[], tileEls=[];
let totalGrass=0;
let initialGrass=0;

// 현재 스테이지의 미션 정의 (모델 D)
// [{ type:'stones'|'grass'|'ice'|'crates'|'keys', count:N, initial:N }]
// stage_maps.missions 배열 우선, 없으면 보드 배치로 자동 산출.
// 타겟볼 우선순위 = missions 배열 순서 (앞이 1순위), 같은 type 안에선 단계 높은 거 우선.
let currentMissions = [];

// ── 스테이지 셀/기믹 적용 ──
// stageMaps는 game.js에서 관리 (fetch/script 양쪽 로드 대응)
function applyStageGimmicks(stageNum){
  if(!stageMaps){ console.warn('[gimmicks] stageMaps is null'); return; }
  const stageData=stageMaps.stages.find(s=>s.stage===stageNum);
  if(!stageData){ console.warn('[gimmicks] stage',stageNum,'not found'); return; }
  if(!stageData.gimmicks){ console.warn('[gimmicks] no gimmicks array for stage',stageNum); return; }
  console.log('[gimmicks] loading',stageData.gimmicks.length,'gimmicks for stage',stageNum);
  for(const g of stageData.gimmicks){
    if(g.type==='grass'){
      if(!tile[g.col]) tile[g.col]=[];
      tile[g.col][g.row]={type:'grass',level:g.level};
    } else {
      if(!gimmick[g.col]) gimmick[g.col]=[];
      gimmick[g.col][g.row]={type:g.type,level:g.level};
    }
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
  container.querySelectorAll('.hex-block,.gimmick-el,.gimmick-tile,.score-popup,.stripe-beam,.bomb-explosion,.target-projectile').forEach(e=>e.remove());
  for(let col=0;col<COLS_PATTERN.length;col++){blockEls[col]=[];board[col]=[];gimmick[col]=[];gimmickEls[col]=[];tile[col]=[];tileEls[col]=[];}
  totalStones=0;initialStones=0;
  totalGrass=0;initialGrass=0;
  currentMissions=[];
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
    if(typeof playSfx==='function') playSfx('stone_break');
    removeGimmickEl(col,row);
    totalStones--;
    decrementMission('stones');
  } else {
    if(typeof playSfx==='function') playSfx('stone_hit');
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

// ── 일반화 dispatcher (Phase 1: 외부 호출은 hitStone/placeStone 그대로 유지) ──
// 향후 crate/ice 추가 시 hitGimmick 분기에 case 추가하고 호출처를 점진 이행.
function hitGimmick(col,row){
  const g=gimmick[col]?.[row];
  if(!g) return;
  switch(g.type){
    case 'stone': hitStone(col,row); break;
    // 향후: case 'crate': hitCrate(col,row); break;
    //       case 'ice':   hitIce(col,row);   break;
  }
}
function destroyGimmick(col,row){ removeGimmickEl(col,row); }
function placeGimmick(col,row,type,level){
  if(type==='grass') return placeGrass(col,row,level);
  if(type==='stone') return placeStone(col,row,level);
  // 향후: crate/ice/key
}

// ── 잔디 (타일형) ──
// 셀 바닥 텍스처. 그 위에 블록 정상 충전. 그 셀의 블록이 매칭/효과로 제거되는 순간 단계 -1.
function createTileEl(col,row,t){
  if(!t) return null;
  const pos=getCellPos(col,row);
  const el=document.createElement('div');
  el.className='gimmick-tile';
  el.classList.add(`grass-${t.level}`);
  el.style.left=`${pos.x}px`;el.style.top=`${pos.y}px`;
  el.style.width=`${HEX_W}px`;el.style.height=`${HEX_H}px`;
  return el;
}
function placeGrass(col,row,level){
  if(!isValid(col,row)||isNonPlayable(col,row)) return;
  removeTile(col,row);
  if(!tile[col]) tile[col]=[];
  if(!tileEls[col]) tileEls[col]=[];
  tile[col][row]={type:'grass',level};
  totalGrass++;
  const container=document.getElementById('grid-container');
  const el=createTileEl(col,row,tile[col][row]);
  if(el){ container.appendChild(el); tileEls[col][row]=el; }
  updateMissionUI();
}
function removeTile(col,row){
  if(tileEls[col]?.[row]){
    tileEls[col][row].remove();
    tileEls[col][row]=null;
  }
  if(tile[col]?.[row]) tile[col][row]=null;
}
function updateTileVisual(col,row){
  const t=tile[col]?.[row];
  const el=tileEls[col]?.[row];
  if(!t||!el) return;
  el.classList.remove('grass-1','grass-2');
  el.classList.add(`grass-${t.level}`);
}
function spawnTiles(){
  const container=document.getElementById('grid-container');
  for(let col=0;col<COLS_PATTERN.length;col++){
    if(!tile[col]) tile[col]=[];
    if(!tileEls[col]) tileEls[col]=[];
    for(let row=0;row<COLS_PATTERN[col];row++){
      const t=tile[col][row];
      if(!t) continue;
      const el=createTileEl(col,row,t);
      if(el){ container.appendChild(el); tileEls[col][row]=el; }
    }
  }
}
function countGrass(){
  let cnt=0;
  for(let col=0;col<COLS_PATTERN.length;col++)
    for(let row=0;row<(tile[col]?.length||0);row++)
      if(tile[col][row]?.type==='grass') cnt++;
  return cnt;
}
function hasGrass(){ return initialGrass>0; }

// ── 잔디 깎임 트리거 ──
// game.js 매치 제거 루프 / 타겟볼 area / 발사 등에서 board[c][r]=null 직전에 호출.
// 그 셀에 잔디가 있으면 단계 -1 (level 0이면 타일 제거 + 미션 카운트 -1).
function onBlockDestroyedAt(col,row){
  const t=tile[col]?.[row];
  if(!t||t.type!=='grass') return;
  t.level--;
  if(t.level<=0){
    removeTile(col,row);
    totalGrass--;
    decrementMission('grass');
    updateMissionUI();
  } else {
    updateTileVisual(col,row);
  }
}

// ── 미션 모델 D 헬퍼 ──
// loadStageMissions: 명시 missions 우선, 없으면 보드 배치로 자동 산출
// decrementMission: 카운트 -1 (0 이하로 안 내려감)
// isMissionCleared: 모든 미션 0
// hasMissionDefined: 미션이 1개 이상 정의됨

function loadStageMissions(stageNum){
  currentMissions=[];
  let sd=null;
  if(typeof stageMaps!=='undefined'&&stageMaps) sd=stageMaps.stages.find(s=>s.stage===stageNum);
  if(sd&&Array.isArray(sd.missions)&&sd.missions.length>0){
    // 명시 missions: type 순서 = 우선순위. count는 보드 배치로 자동 sync (어긋남 방지).
    for(const m of sd.missions){
      const autoCnt=countMissionType(m.type);
      currentMissions.push({type:m.type, count:autoCnt, initial:autoCnt});
    }
    return;
  }
  // fallback: 보드 배치 자동 카운트
  if(totalStones>0) currentMissions.push({type:'stones', count:totalStones, initial:totalStones});
  if(totalGrass>0)  currentMissions.push({type:'grass',  count:totalGrass,  initial:totalGrass});
}

// 미션 type별 보드 배치 갯수 (자동 sync용)
function countMissionType(type){
  if(type==='stones') return countStones();
  if(type==='grass')  return countGrass();
  // 향후: ice / crates / keys
  return 0;
}

function decrementMission(type){
  const m=currentMissions.find(x=>x.type===type);
  if(m && m.count>0) m.count--;
}

function isMissionCleared(){
  if(currentMissions.length===0) return false;
  return currentMissions.every(m=>m.count<=0);
}

function hasMissionDefined(){ return currentMissions.length>0; }

// 타겟볼 우선순위용: 미션 type별 후보 셀 추출
// 반환: [{ pos:[c,r], isStone, isGrass, level, missionType }]
function collectMissionCells(type, excludeSet){
  const result=[];
  const blocked = (c,r) => excludeSet?.has(`${c},${r}`);
  if(type==='stones'){
    for(let c=0;c<COLS_PATTERN.length;c++)
      for(let r=0;r<(gimmick[c]?.length||0);r++){
        const g=gimmick[c][r];
        if(g?.type==='stone' && !blocked(c,r))
          result.push({pos:[c,r], isStone:true, level:g.level||0, missionType:'stones'});
      }
  } else if(type==='grass'){
    // 잔디 셀은 블록 유무와 무관하게 우선 타격 후보 (사용자 결정: 빈 셀이어도 타겟볼 강제 도착)
    for(let c=0;c<COLS_PATTERN.length;c++)
      for(let r=0;r<(tile[c]?.length||0);r++){
        const t=tile[c][r];
        if(t?.type==='grass' && !blocked(c,r))
          result.push({pos:[c,r], isStone:false, isGrass:true, level:t.level||0, missionType:'grass'});
      }
  }
  // 향후: case 'crates': case 'ice': case 'keys'
  return result;
}
