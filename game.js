// ── 헥사 3매치 퍼즐 ──
// 상수/설정값은 config.js로 분리되어 있음 (index.html에서 먼저 로드)

let currentStage = parseInt(localStorage.getItem('hexPuzzleStage')) || 1;
let stageTarget = STAGES[0].target;

// calcLineScore / calcComboBonus는 match.js로 이동

// ── 스킨 시스템 ──
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
  // 1) script 태그로 로드된 전역변수 우선 (file:// 프로토콜 대응)
  if(typeof STAGE_MAPS_DATA!=='undefined'){
    stageMaps=STAGE_MAPS_DATA;
    console.log('[stageMaps] script 로드 완료:',stageMaps.stages.length,'스테이지');
    return;
  }
  // 2) HTTP 서버 환경이면 fetch 시도
  try{
    const res=await fetch('stage_maps.json?t='+Date.now());
    if(!res.ok) throw new Error('HTTP '+res.status);
    stageMaps=await res.json();
    console.log('[stageMaps] fetch 로드 완료:',stageMaps.stages.length,'스테이지');
  }catch(e){ console.warn('[stageMaps] 로드 실패:',e); stageMaps={stages:[]}; }
}

// applyStageGimmicks / applyStageCells는 board.js로 이동

// ── 상태 ──
let numColors=5, maxMoves=30, movesLeft=30, score=0;
let playing=false, busy=false;
let highScore=parseInt(localStorage.getItem('hexPuzzleHighScore'))||0;
let isDarkMode = localStorage.getItem('hexPuzzleDarkMode') !== 'false'; // default true
let hoveredCell = null; // for debug remove
let lastMouseX = 0, lastMouseY = 0;
let debugPlaceType = null; // null | 'stripe' | 'target' | 'bomb' | 'rainbow'
// board/blockEls/cellPos/gimmick/gimmickEls/cellType/hexCellEls/entranceCols, totalStones/initialStones는 board.js로 이동
// 셀 타입 헬퍼(isDead/isEntrance/isPass/isNonPlayable)는 grid.js로 이동
let dragState=null;
let hintTimer=null, hintedCells=[];

// ── 매치 로그 ──
const matchLogs=[];

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
// makeCell/getColor/getType/isSpecial은 board.js로 이동
// getMostFrequentColor는 special.js로 이동
// 그리드/인접 함수(isValid/isLongCol/getCellPos/getBlockPos/getNeighbors/isAdjacent)는 grid.js로 이동
let gameSpeed=1; // 게임 배속 (0.5~5x)
function delay(ms){ return new Promise(r=>setTimeout(r, Math.round(ms/gameSpeed))); }
function skippableDelay(ms){ return new Promise(r=>setTimeout(r, skipDelay?0:Math.round(ms/gameSpeed))); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }

// 6방향 이동/스왑 방향/축 판별(step/getSwapDirection/getStripeAxis)은 grid.js로 이동
// getStripeAngle / getStripeImage는 special.js로 이동
// getLineDirFromCells는 grid.js로 이동

// ── 매치 감지 ──
// countLine / hasMatchAt / findAllMatches는 match.js로 이동

// getStripeLine은 special.js로 이동
// getCellsInRange2/getPerpDirs/get3LineStripeCells는 grid.js로 이동
// findConnectedGroups / determineSpecial은 match.js로 이동
// getRandomBlockPos는 special.js로 이동

// hasClusterAt은 match.js로 이동
// initBoard는 board.js로 이동

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

// 렌더링/블록 DOM/기믹 관리(createCells, createBlockEl, spawnAllBlocks, clearAllBlocks,
// createGimmickEl, placeStone, removeGimmickEl, hitStone, spawnGimmicks,
// countStones, hasStones, getRandomStonePos)는 board.js로 이동

// 타겟볼 범위 타격 패턴 (4칸)
// swapDir: 스왑 방향 (null이면 클릭 발동 → 기본 패턴)
// getTargetAreaCells / getTargetBallTarget은 special.js로 이동

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
// clearHint / showHint는 animation.js로 이동
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
// getComboMessage / getComboStyle / showScorePopup / showCombo는 animation.js로 이동

// ── 이펙트 ──
// showStripeBeam / showBombExplosion / fireTargetProjectile / activateRainbow는 special.js로 이동

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

// ── 특수블록 효과/발동/교차 처리는 special.js로 이동 ──
// (computeSpecialEffect / animateSpecialSteps / activateSpecialAt /
//  activateSpecialEffect / handleCrossEffect)


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

// animateSwap은 animation.js로 이동

// ── 중력/충전/대각선 충전은 gravity.js로 이동 ──
// (computeGravity / computeDiagonalFill / applyGravity / fillEmpty /
//  animateGravityDOM / animateDiagonalDOM / animateFillDOM /
//  computeFill / canFillFromTop / refreshBlockElsCoordinates /
//  animateGravity / animateDiagonalFill / animateFill)


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

  // 스테이지 데이터 적용 (stage_maps.json 우선, 없으면 STAGES 폴백)
  const sd=STAGES[currentStage-1]||STAGES[STAGES.length-1];
  const mapData=stageMaps?.stages?.find(s=>s.stage===currentStage);
  stageTarget=sd.target;
  maxMoves=mapData?.moves??sd.moves;
  movesLeft=maxMoves;
  numColors=mapData?.colorTypes??sd.colorTypes;

  // 스테이지 맵 셀 타입 + 기믹 적용
  applyStageCells(currentStage);
  applyStageGimmicks(currentStage);
  console.log('[startGame] stage',currentStage,'mapData:',!!mapData,'entrance:',entranceCols.size,'gimmicks:',gimmick.reduce((n,c)=>n+(c?c.filter(Boolean).length:0),0));

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
    const mapData=stageMaps?.stages?.find(s=>s.stage===currentStage);
    numEl.textContent=currentStage;
    document.getElementById('lobby-stage-target').textContent=`목표 ${sd.target.toLocaleString()}점`;
    document.getElementById('lobby-stage-moves').textContent=`Move ${mapData?.moves??sd.moves}`;
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
