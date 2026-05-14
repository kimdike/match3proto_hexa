// ── 헥사 3매치 퍼즐: 진입점 / 게임 흐름 제어 / 이벤트 핸들러 ──
// 모든 모듈 로드 후 마지막에 실행
// config/grid/board/match/special/gravity/animation/ui 다음, stage_maps.js 다음, game.js 다음 로드

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
    if(debugPlaceType&&playing){ placeDebugSpecial(col,row); return; }
    // 클릭: 특수블록 → 제자리 발동, 일반블록 → 흔들림
    // 실시간 매칭: busy(일반 매치/특수 진행 중) 차단 X. 무지개 잠금만 유지.
    // 큐(enqueueAnim)에 들어가서 skipDelay로 압축됨.
    if(playing&&!isBusyRainbow&&board[col]?.[row]){
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
  // v2 lock 체크 — 이 셀 또는 인접이 다른 흐름 처리 중이면 차단
  const lockCells = _getClickLockCells(col,row);
  if(_isAreaBlocked(lockCells)) return;
  playSfx('swap');
  // 무지개 클릭 발동도 즉시 차단 (enqueueAnim 큐 buffer 사이 다른 swap 차단)
  if(getType(col,row)==='rainbow') isBusyRainbow=true;
  _lockArea(lockCells);
  enqueueAnim(async()=>{
    _flowStart();
    try {
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
      isBusyRainbow=false;
      await drainCrateExplosions();await applyGravity();await fillEmpty();
      let {lines:cl,cells:cc,clusters:ccl}=findAllMatches();
      let combo=0;
      while(cc.length>0||ccl.length>0){
        combo++;
        await processMatchStep(cl,cc,ccl,false,col,row,col,row,null,combo);
        await drainCrateExplosions();await applyGravity();await fillEmpty();
        const chain=findAllMatches();cl=chain.lines;cc=chain.cells;ccl=chain.clusters;
      }
      checkGameEnd();
      startHintTimer();
    } finally {
      _unlockArea(lockCells);
      _flowEnd();
    }
  });
}

// ── 스왑 ──
function trySwap(c1,r1,c2,r2){
  if(isBusyRainbow) return;
  // v2 lock 체크 — swap 두 셀 또는 인접이 다른 흐름 처리 중이면 차단
  const lockCells = _getSwapLockCells(c1,r1,c2,r2);
  if(_isAreaBlocked(lockCells)) return;
  playSfx('swap');
  // 무지개 관여 swap은 enqueueAnim 큐 처리 전 즉시 입력 차단.
  // (enqueueAnim 콜백이 실행될 때까지 isBusyRainbow=false 면 그 사이 다른 swap이 큐에 buffer됨)
  // executeSwap에서 rainbow가 invalid한 케이스(rainbow+empty 등)는 finally의 안전망에서 복귀.
  const willRainbow = getType(c1,r1)==='rainbow' || getType(c2,r2)==='rainbow';
  if(willRainbow) isBusyRainbow=true;
  _lockArea(lockCells);
  enqueueAnim(async()=>{
    _flowStart();
    try {
      const result=executeSwap(c1,r1,c2,r2);

      if(!result.valid){
        await animateSwap(c1,r1,c2,r2);
        await animateSwap(c1,r1,c2,r2);
        return;
      }

      await animateSwap(c1,r1,c2,r2);
      movesLeft--;updateMovesUI();

      if(result.type==='cross'){
        await handleCrossEffect(c1,r1,c2,r2);
        isBusyRainbow=false;
        await drainCrateExplosions();await applyGravity();await fillEmpty();
        let {lines:cl,cells:cc,clusters:ccl}=findAllMatches();
        let combo=0;
        while(cc.length>0||ccl.length>0){
          combo++;
          await processMatchStep(cl,cc,ccl,false,c1,r1,c2,r2,null,combo);
          await drainCrateExplosions();await applyGravity();await fillEmpty();
          const chain=findAllMatches();cl=chain.lines;cc=chain.cells;ccl=chain.clusters;
        }
        checkGameEnd();
        startHintTimer();
        return;
      }

      if(result.type==='rainbow'){
        const cnt=await activateRainbow(result.rainbowPos.col,result.rainbowPos.row,result.targetColor);
        score+=cnt*100;updateScoreUI();
        isBusyRainbow=false;
        await drainCrateExplosions();await applyGravity();await fillEmpty();
        let {lines:cl,cells:cc,clusters:ccl}=findAllMatches();
        let combo=1;
        while(cc.length>0||ccl.length>0){
          combo++;
          await processMatchStep(cl,cc,ccl,false,c1,r1,c2,r2,null,combo);
          await drainCrateExplosions();await applyGravity();await fillEmpty();
          const chain=findAllMatches();cl=chain.lines;cc=chain.cells;ccl=chain.clusters;
        }
        checkGameEnd();
        startHintTimer();
        return;
      }

      if(result.type==='special-activate'){
        const {col,row}=result.specialPos;
        const cell=board[col][row];
        // 타겟볼에 스왑 방향 전달 (범위 타격 패턴용)
        if(cell.type==='target'){
          cell._swapDir=(col===c1&&row===r1)
            ? getSwapDirection(c2,r2,c1,r1)
            : getSwapDirection(c1,r1,c2,r2);
        }
        if(cell.type==='rainbow'){
          const tc=getMostFrequentColor();
          if(tc!==null){ const cnt=await activateRainbow(col,row,tc); score+=cnt*100;updateScoreUI(); }
        } else {
          await activateSpecialAt(col,row);
        }
        isBusyRainbow=false;
        await drainCrateExplosions();await applyGravity();await fillEmpty();
        let {lines:cl,cells:cc,clusters:ccl}=findAllMatches();
        let combo=0;
        while(cc.length>0||ccl.length>0){
          combo++;
          await processMatchStep(cl,cc,ccl,false,c1,r1,c2,r2,null,combo);
          await drainCrateExplosions();await applyGravity();await fillEmpty();
          const chain=findAllMatches();cl=chain.lines;cc=chain.cells;ccl=chain.clusters;
        }
        checkGameEnd();
        startHintTimer();
        return;
      }

      const {lines,cells,clusters,swapDir}=result;
      let combo=0,curLines=lines,curCells=cells,curClusters=clusters,isFirst=true;
      while(curCells.length>0||curClusters.length>0){
        combo++;
        await processMatchStep(curLines,curCells,curClusters,isFirst,c1,r1,c2,r2,swapDir,combo);
        isFirst=false;
        await drainCrateExplosions();await applyGravity();await fillEmpty();
        const chain=findAllMatches();curLines=chain.lines;curCells=chain.cells;curClusters=chain.clusters;
      }
      checkGameEnd();
      startHintTimer();
    } finally {
      // 안전망 — invalid/throw 시에도 lock + isBusyRainbow 복귀 보장
      if(willRainbow) isBusyRainbow=false;
      _unlockArea(lockCells);
      _flowEnd();
    }
  });
}

function getCellFromMouse(){
  const container=document.getElementById('grid-container');
  const rect=container.getBoundingClientRect();
  // 그리드는 CSS transform scale이 적용돼 있으므로 마우스 좌표를 원본 좌표계로 환산
  const totalW=(COLS_PATTERN.length-1)*COL_SPACING+HEX_W;
  const scale=rect.width/totalW || 1;
  const localX=(lastMouseX-rect.left)/scale;
  const localY=(lastMouseY-rect.top)/scale;
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
}

async function processPendingMatches(){
  if(!playing) return;
  let {lines,cells,clusters} = findAllMatches();
  if(cells.length===0&&clusters.length===0) return;
  let combo=0;
  while(cells.length>0||clusters.length>0){
    combo++;
    await processMatchStep(lines,cells,clusters,false,-1,-1,-1,-1,null,combo);
    await drainCrateExplosions();await applyGravity();await fillEmpty();
    const next = findAllMatches();
    lines=next.lines; cells=next.cells; clusters=next.clusters;
  }
  checkGameEnd();
}

// ── 게임 종료 ──
function checkGameEnd(){
  if(!playing) return;
  // 미션이 정의되어 있으면 모든 미션 클리어가 승리 조건
  if(hasMissionDefined()){
    if(isMissionCleared()){onStageCleared();playing=false;setTimeout(()=>showEndScreen(true),400);}
    else if(movesLeft<=0){playing=false;setTimeout(()=>showEndScreen(false),400);}
  } else {
    if(score>=stageTarget){onStageCleared();playing=false;setTimeout(()=>showEndScreen(true),400);}
    else if(movesLeft<=0){playing=false;setTimeout(()=>showEndScreen(false),400);}
  }
}

// 클리어 시 보상 — 재료 1개 무조건 드롭 (60/30/10%) + 다이아 5% 확률 1개
// 골드는 ui.js showEndScreen에서 덱 보너스 적용 후 계산.
// 클리어 화면 표시용 글로벌: _lastClearReward (재료) / _lastClearDiamond (boolean)
let _lastClearReward = null;
let _lastClearDiamond = false;
const DIAMOND_DROP_RATE = 0.05; // 메인 클리어 5% 확률 1개

function onStageCleared(){
  _lastClearReward = null;
  _lastClearDiamond = false;
  if(typeof dropRandomMaterial === 'function'){
    _lastClearReward = dropRandomMaterial();
  }
  // 다이아 5% 확률 +1
  if(Math.random() < DIAMOND_DROP_RATE){
    if(typeof loadDiamond === 'function' && typeof saveDiamond === 'function'){
      const cur = loadDiamond();
      saveDiamond(cur + 1);
      _lastClearDiamond = true;
    }
  }
}

// 덱 타입 보너스 — 지역 타입과 같은 타입 마리수에 따라 골드 배율
// 3 → 1.3 / 4 → 1.5 / 5 → 1.7 / 6 → 2.0
function getDeckTypeBonus(regionType){
  if(!regionType) return { multiplier: 1.0, count: 0 };
  if(typeof skinData === 'undefined' || !skinData?.slots) return { multiplier: 1.0, count: 0 };
  if(typeof MONSTER_TABLE_DATA === 'undefined' || !MONSTER_TABLE_DATA?.monsters) return { multiplier: 1.0, count: 0 };
  const monsters = MONSTER_TABLE_DATA.monsters;
  let count = 0;
  for(const id of skinData.slots){
    const m = monsters.find(x => x.id === id);
    if(m && Array.isArray(m.types) && m.types.includes(regionType)) count++;
  }
  let mult = 1.0;
  if(count >= 6) mult = 2.0;
  else if(count >= 5) mult = 1.7;
  else if(count >= 4) mult = 1.5;
  else if(count >= 3) mult = 1.3;
  return { multiplier: mult, count };
}


function resetToStart(){
  hideEndScreen();hideConfirm();clearHint();
  playing=false;_flowResetAll();isBusyRainbow=false;dragState=null;
  animQueue.length=0;animRunning=false;skipDelay=false;_activeFlows.clear();
  // 실시간 충전 ticker 정지 (게임 종료)
  if(typeof stopGravityTicker==='function') stopGravityTicker();
  // 배치 도구 상태 초기화 (특수블록/기믹 선택 해제)
  if(typeof clearPlacementSelection==='function') clearPlacementSelection();
  document.querySelectorAll('.debug-btn').forEach(b=>{b.classList.remove('active');b.textContent=b.textContent.replace(' \u2705','');});
  clearAllBlocks();
  document.getElementById('info-bar').classList.add('hidden');
  document.getElementById('settings-bar').classList.remove('hidden');
  // showScreen('lobby-screen')이 SCREEN_BGM 매핑으로 ingame-bgm → lobby-bgm 교체 처리
  showScreen('lobby-screen');
  updateLobbyStage();
}

async function removeBlockAt(col, row) {
  if (!board[col] || !board[col][row]) return;
  board[col][row] = null;
  if (blockEls[col][row]) {
    blockEls[col][row].remove();
    blockEls[col][row] = null;
  }
  // 충전: 빈 칸 채우기 + 매치 처리
  _flowStart();
  clearHint();
  await applyGravity();await fillEmpty();
  await processPendingMatches();
  updateHoveredCellFromMouse();
  _flowEnd();
  startHintTimer();
}

function startGame(){
  // 상태 완전 초기화 (스테이지 건너뛰기 방지)
  playing=false;_flowResetAll();isBusyRainbow=false;
  dragState=null;animQueue.length=0;animRunning=false;skipDelay=false;_activeFlows.clear();
  score=0;
  // 스킨 데이터 재로드 — 인트로 후 슬롯 변경 / "처음으로" 후 옛 캐시 방지
  if(typeof loadSkinData==='function') skinData=loadSkinData();
  clearHint();clearAllBlocks();

  // 스테이지 데이터 적용 (stage_maps.js 우선, 없으면 DEFAULT_STAGE_CONFIG 폴백)
  const sc=getStageConfig(currentStage);
  stageTarget=sc.target;
  maxMoves=sc.moves;
  movesLeft=maxMoves;
  numColors=sc.colorTypes;

  // 스테이지 맵 셀 타입 + 기믹 적용
  applyStageCells(currentStage);
  applyStageGimmicks(currentStage);

  // UI 갱신 후 게임 시작
  // (인게임 BGM은 로비에서 lobby-stage-btn 클릭 시 showScreen('game-container')이 처리)
  document.getElementById('settings-bar').classList.add('hidden');
  document.getElementById('info-bar').classList.remove('hidden');
  updateScoreUI();updateMovesUI();
  // target-value 요소는 HUD에서 제거됨 — 존재할 때만 갱신
  const _tgtEl=document.getElementById('target-value');
  if(_tgtEl) _tgtEl.textContent=stageTarget.toLocaleString();
  initBoard();spawnAllBlocks();spawnGimmicks();spawnTiles();
  totalStones=countStones();
  initialStones=totalStones;
  totalGrass=countGrass();
  initialGrass=totalGrass;
  totalCrates=countCrates();
  initialCrates=totalCrates;
  // 미션 모델 D: stage_maps.missions 명시 우선, 없으면 보드 자동 카운트
  loadStageMissions(currentStage);
  refreshBlockElsCoordinates();
  updateMissionUI();

  // 매치 로그 초기화
  clearMatchLogs();

  // 실시간 충전 ticker 시작 (보드 초기화 완료 후)
  // ticker는 매 frame 빈 셀 검사 → 발견 시 자동 충전.
  // 효과 코드는 board null만 설정하면 ticker가 알아서 충전 시작.
  if(typeof startGravityTicker==='function') startGravityTicker();

  // 모든 초기화 완료 후 playing 활성화
  playing=true;
  startHintTimer();
}

// ── 시작 ──
(async()=>{
  await loadStageMaps();
  createCells();
  setupUI();
  setupDevMode();
  setupPlacementPanel();
  setupCharacterSelect();
  setupNicknameScreen();
  setupScreenNav();
  setupSkinScreen();
  setupDexScreen();
  updateTheme();
  updateHighScoreUI();
  // 기존 저장된 프로필이 있으면 로비 프로필/스테이지 초기 상태만 채움 (화면 전환은 PRESS TO START에서 분기)
  if(hasPlayerProfile()) updateLobbyProfile();
  resizeGrid();
  window.addEventListener('resize',resizeGrid);
})();

