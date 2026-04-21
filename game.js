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

// getPokemonBgStyle / applyPokemonBg는 ui.js로 이동

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

// matchLogs 배열 및 formatLogTime / addMatchLog / renderMatchLogs / clearMatchLogs는 ui.js로 이동

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

// 렌더링/블록 DOM/기믹 관리(createCells, createBlockEl, spawnAllBlocks, clearAllBlocks,
// createGimmickEl, placeStone, removeGimmickEl, hitStone, spawnGimmicks,
// countStones, hasStones, getRandomStonePos)는 board.js로 이동

// 타겟볼 범위 타격 패턴 (4칸)
// swapDir: 스왑 방향 (null이면 클릭 발동 → 기본 패턴)
// getTargetAreaCells / getTargetBallTarget은 special.js로 이동

// updateMissionUI는 ui.js로 이동

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
// updateHighScoreUI / updateScoreUI / updateMovesUI는 ui.js로 이동
// getComboMessage / getComboStyle / showScorePopup / showCombo는 animation.js로 이동

// ── 이펙트 ──
// showStripeBeam / showBombExplosion / fireTargetProjectile / activateRainbow는 special.js로 이동

// 드래그 입력 핸들러(getPointer, onDragStart, onDragMove, onDragEnd, findNeighborByAngle)는 main.js로 이동

// tryActivateSpecialClick은 main.js로 이동

// trySwap은 main.js로 이동

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
  //     curCells(라인 매치) + clusters(타겟볼 평행사변형) 모두 순회
  //     타겟볼이 순수 클러스터로 생성될 때 클러스터 인접 돌 미타격 버그 수정
  const matchCellsForStoneHit=[...curCells];
  for(const cluster of clusters){
    for(const cell of cluster.cells) matchCellsForStoneHit.push(cell);
  }
  for(const [c,r] of matchCellsForStoneHit){
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
    const adj=BLOCK_D*((CFG.blockScale||1.0)-1)/2;
    for(const [c,r] of specialInfo.mergeCells){
      if(c===specialInfo.col&&r===specialInfo.row) continue;
      const el=blockEls[c][r]; if(!el) continue;
      el.classList.add('merging');
      const mt=0.3/gameSpeed;
      el.style.transition=`left ${mt}s ease-in,top ${mt}s ease-in,transform ${mt}s ease-in,opacity ${mt}s ease-in`;
      el.style.left=`${tPos.x-adj}px`;el.style.top=`${tPos.y-adj}px`;
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
//  computeFill / refreshBlockElsCoordinates /
//  animateGravity / animateDiagonalFill / animateFill)


// getCellFromMouse, updateHoveredCellFromMouse, processPendingMatches, checkGameEnd은 main.js로 이동
// showEndScreen / hideEndScreen / showConfirm / hideConfirm는 ui.js로 이동
// resetToStart는 main.js로 이동

// setupUI / toggleTheme / updateTheme는 ui.js로 이동

// removeBlockAt은 main.js로 이동

// 개발자 모드 관련(placeDebugSpecial, setupDevMode, showInspConfirm, buildInspector, devUnlocked/devPanelOpen)는 ui.js로 이동

// startGame은 main.js로 이동

// resizeGrid / showScreen / updateLobbyStage / setupScreenNav / renderSkinScreen / renderSkinSlots / renderSkinCollection / setupSkinScreen는 ui.js로 이동

// 진입점 IIFE는 main.js로 이동
