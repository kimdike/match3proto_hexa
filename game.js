// ── 헥사 3매치 퍼즐 ──
// 상수/설정값은 config.js로 분리되어 있음 (index.html에서 먼저 로드)

let currentStage = parseInt(localStorage.getItem('hexPuzzleStage')) || 1;
let stageTarget = DEFAULT_STAGE_CONFIG.target; // startGame()에서 스테이지별 값으로 덮어씀

// calcLineScore / calcComboBonus는 match.js로 이동

// ── 스킨 시스템 ──
// unlocked = DEFAULT_UNLOCKED ∪ 도감 captured/evolved ∪ legacy hexPuzzleUnlocked
// (도감에 등록된 포켓몬은 자동으로 스킨 해금)
function loadSkinData(){
  let unlocked=JSON.parse(localStorage.getItem('hexPuzzleUnlocked')||'null');
  if(!unlocked){ unlocked=[...DEFAULT_UNLOCKED]; }
  // 도감 captured/evolved 합집합 (dex.js 사용 가능 시)
  if(typeof getCapturedIds==='function'){
    const set=new Set(unlocked);
    for(const id of getCapturedIds()) set.add(id);
    for(const id of DEFAULT_UNLOCKED) set.add(id); // 인트로 6종 항상 보장
    unlocked=Array.from(set).sort((a,b)=>a-b);
  }
  localStorage.setItem('hexPuzzleUnlocked',JSON.stringify(unlocked));

  let slots=JSON.parse(localStorage.getItem('hexPuzzleSlots')||'null');
  if(!slots){ slots=[...DEFAULT_SLOTS]; localStorage.setItem('hexPuzzleSlots',JSON.stringify(slots)); }
  // 7→6 슬롯 마이그레이션: 기존 7슬롯 데이터는 마지막 1개 제거 (unlocked는 보존)
  if(slots.length>DEFAULT_SLOTS.length){
    slots=slots.slice(0,DEFAULT_SLOTS.length);
    localStorage.setItem('hexPuzzleSlots',JSON.stringify(slots));
  }
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

// v2 Phase 1 — 흐름 카운터. busy/isBusyNormal을 derived state로 관리.
// v1: busy = true 직접 set → 단일 흐름 가정. 두 흐름 동시 진행 시 한쪽 끝나면 busy=false → 다른 쪽 미진행으로 오인됨.
// v2: _activeFlowCount 카운터. 흐름 시작 +1, 끝 -1. 0 도달 시에만 busy=false.
let _activeFlowCount = 0;
function _flowStart(){
  _activeFlowCount++;
  busy = true;
  isBusyNormal = true;
}
function _flowEnd(){
  _activeFlowCount = Math.max(0, _activeFlowCount - 1);
  if(_activeFlowCount === 0){
    busy = false;
    isBusyNormal = false;
  }
}
function _flowResetAll(){
  // resetToStart / startGame에서 호출. 강제 모든 흐름 종료 상태로 초기화.
  _activeFlowCount = 0;
  busy = false;
  isBusyNormal = false;
  _lockedCells.clear();
}

// v2 Phase 2 — 매치된 element를 CSS animation 끝나면 자동 detach.
// setTimeout(matchedDelay) 패턴 폐기 — race 시간 0 (animation 완료까지 element는 그대로 DOM에 있되 blockEls는 즉시 null로 분리됨).
// fallback timeout(500ms) — animation 안 끝나는 케이스(CSS 누락 등) 안전망.
function _autoDetachOnAnimEnd(el){
  if(!el) return;
  el.addEventListener('animationend', () => { if(el.parentNode) el.remove(); }, { once: true });
  setTimeout(() => { if(el.parentNode) el.remove(); }, 500);
}

// v2 Phase 1 — 셀 단위 lock 시스템 (race 차단).
// lock 범위: swap한 두 셀만 (인접 셀은 자유 사용 허용 — 사용자 의도).
// "직전에 스왑한 영역은 다른 흐름이 건드리지 못함".
// 다른 흐름이 같은 swap 셀 진입 시 차단(swap 무시).
// ticker fill도 lock된 셀은 skip → 흐름 처리 중인 셀에 새 element 안 만듦.
// Map<"c,r", count> — 같은 셀이 여러 흐름 lock에 들어갈 수 있어 카운터로 관리.
const _lockedCells = new Map();

function _isLocked(c, r){
  return _lockedCells.has(`${c},${r}`);
}

function _lockArea(cells){
  for(const [c, r] of cells){
    const k = `${c},${r}`;
    _lockedCells.set(k, (_lockedCells.get(k) || 0) + 1);
  }
}

function _unlockArea(cells){
  for(const [c, r] of cells){
    const k = `${c},${r}`;
    const cur = _lockedCells.get(k) || 0;
    if(cur <= 1) _lockedCells.delete(k);
    else _lockedCells.set(k, cur - 1);
  }
}

// swap한 두 셀만 lock (인접 셀은 다른 흐름의 swap에서 자유롭게 사용 가능).
// "직전에 스왑한 영역(=두 셀)은 다른 흐름이 건드리지 못함" — 사용자 의도.
function _getSwapLockCells(c1, r1, c2, r2){
  return [[c1, r1], [c2, r2]];
}

// 클릭 발동 (특수블록 제자리) — 1 셀만 lock (인접 제외)
function _getClickLockCells(col, row){
  return [[col, row]];
}

// 영역에 lock된 셀이 하나라도 있는지 확인 — swap 차단 판정용
function _isAreaBlocked(cells){
  for(const [c, r] of cells){
    if(_isLocked(c, r)) return true;
  }
  return false;
}

// 매치 라인 셀만 lock (인접 제외). processMatchStep 시작 시 호출 → finally에서 해제.
// 사용자 의도: "직전 스왑한 영역 + 그 매치 라인" 보호. 인접은 자유.
function _computeMatchLockCells(matchCells, clusters){
  const set = new Set();
  for(const [c, r] of matchCells) set.add(`${c},${r}`);
  if(clusters && clusters.length > 0){
    for(const cl of clusters){
      for(const [c, r] of cl.cells) set.add(`${c},${r}`);
    }
  }
  return [...set].map(k => k.split(',').map(Number));
}

// ── 애니메이션 큐 (v2 Phase 1 — 다중 흐름 병렬 실행) ──
// v1: animQueue + drainAnimQueue가 await로 직렬 처리 → 한 번에 하나 흐름만 진행
// v2: enqueueAnim이 즉시 fire-and-track → _activeFlows에 등록. 여러 흐름 동시 진행.
//     큐(animQueue)는 사실상 불필요 — _activeFlows.size로 활성 흐름 수 추적.
//     animQueue 변수는 main.js 리셋 호환(animQueue.length=0)을 위해 유지.
const animQueue=[];  // (deprecated, 호환용) v2에선 거의 사용 안 함
let animRunning=false; // (deprecated, 호환용) ui matchLog 등 잔존 참조용
const _activeFlows = new Set(); // 동시 진행 중인 흐름 Promise들
let skipDelay=false; // v2에서 더 이상 토글하지 않음. ui.js matchLog 호환을 위해 변수만 유지 (항상 false).

// 매크로 방지 — 너무 빠른 입력 차단 (인간 손가락 클릭/스왑 평균 간격 약 150~300ms)
// v2 — 100ms → 30ms 단축. 매크로는 ANIM_QUEUE_MAX=4로 자연 제한. 사람 손가락 30ms 이내 swap 거의 불가.
const ANIM_THROTTLE_MS = 30;
const ANIM_QUEUE_MAX   = 4;    // v2 — 동시 활성 흐름 최대 4개 (v1: 큐 max 2)
let _lastEnqueueTs = 0;

// v2 — 큐 폐기. enqueueAnim 호출 즉시 흐름 시작(_activeFlows에 등록).
// 활성 흐름이 ANIM_QUEUE_MAX 이상이면 새 입력 무시.
// 흐름 종료 시 finally에서 _activeFlows.delete(p) 자동 호출.
function enqueueAnim(asyncFn){
  const now = Date.now();
  // Throttle — 매크로 방지
  if(now - _lastEnqueueTs < ANIM_THROTTLE_MS) return;
  // 활성 흐름 가득 시 무시 (오버플로우 방지)
  if(_activeFlows.size >= ANIM_QUEUE_MAX) return;
  _lastEnqueueTs = now;
  // 즉시 fire-and-track — drainAnimQueue 거치지 않고 바로 흐름 시작
  animRunning = true;
  const p = (async () => {
    try { await asyncFn(); }
    catch(e) { console.error('[flow]', e); }
  })();
  p.finally(() => {
    _activeFlows.delete(p);
    if(_activeFlows.size === 0) animRunning = false;
  });
  _activeFlows.add(p);
}

// 호환용 — 외부에서 호출하는 곳 없음 (v1 유산). 호출되면 즉시 resolve.
async function drainAnimQueue(){ /* v2에서 의미 없음 */ }

// ── 헬퍼 ──
// makeCell/getColor/getType/isSpecial은 board.js로 이동
// getMostFrequentColor는 special.js로 이동
// 그리드/인접 함수(isValid/isLongCol/getCellPos/getBlockPos/getNeighbors/isAdjacent)는 grid.js로 이동
let gameSpeed=1; // 게임 배속 (0.5~5x)
// delay() — ticker race fix용. await delay 동안 gravity ticker 일시 정지.
// matched / specialActivate / crossEffect delay에서 board=null → await → remove 패턴을 안전하게 만듦.
// (ticker가 빈 셀에 새 element를 만들어 .remove() 호출이 새 element 죽이는 race 방지)
// 시간 압축 X — 매치 효과는 항상 평소 속도. 실시간 매칭은 입력 큐(animQueue)로만 제공.
function delay(ms){
  if(typeof pauseTicker==='function') pauseTicker();
  return new Promise(r=>{
    setTimeout(()=>{
      if(typeof resumeTicker==='function') resumeTicker();
      r();
    }, Math.round(ms/gameSpeed));
  });
}
// bgDelay() — 비-블로킹 대기. ticker는 계속 동작 (백그라운드 충전 진행).
// 사용처: drainCrateExplosions 폭발 사이 stagger — 폭발 도중 ticker가 충전하길 원함.
function bgDelay(ms){ return new Promise(r=>setTimeout(r, Math.round(ms/gameSpeed))); }
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
  // v2 매치 라인 셀 lock (인접 X) — 처리 중 ticker fill / 다른 흐름 swap 차단
  const matchLockCells = _computeMatchLockCells(curCells, clusters);
  _lockArea(matchLockCells);
  try {
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
        if(gimmick[sc]?.[sr]){ const sk=`${sc},${sr}`; if(!hitStones.has(sk)){hitStones.add(sk);hitGimmick(sc,sr);} continue; }
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
        if(gimmick[nc]?.[nr]){ const sk=`${nc},${nr}`; if(!hitStones.has(sk)){hitStones.add(sk);hitGimmick(nc,nr);} continue; }
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
      if(gimmick[nc]?.[nr]){
        const sk=`${nc},${nr}`;
        if(!hitStones.has(sk)){ hitStones.add(sk); hitGimmick(nc,nr); }
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
    // delay (ticker pause) — merge 연출이 끝나고 충전 시작 (동시 충전 X, 사용자 의도)
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
      if(gimmick[nc]?.[nr]){
        const sk=`${nc},${nr}`;
        if(!hitStones.has(sk)){ hitStones.add(sk); hitGimmick(nc,nr); }
      }
    }
    await delay(CFG.mergeDelay);
  }

  // 6b) 나머지 매치 블록 제거
  // 매치 팝 효과음: 이 스텝에서 실제로 pop 애니메이션이 걸리는 블록이 1개라도 있을 때 1회만 재생
  if(typeof playSfx==='function'&&allCells.some(([c,r])=>!mergeSet.has(`${c},${r}`))){
    playSfx('match_pop');
  }
  // ⚡ Ticker 모델 호환 패턴 — element reference snapshot으로 race 방지
  // 이전: board=null → await delay → blockEls.remove() — 그 사이 ticker가 만든 새 element를 죽임
  // 이후: el 참조 캡쳐 → 즉시 blockEls=null → setTimeout으로 detached el만 remove
  //       (ticker가 새 element를 blockEls에 할당해도 보호됨)
  // v2 Phase 1 — null-skip 가드: 다른 흐름이 이미 board=null 처리한 셀이면 자연 skip.
  //   잔디 빈 셀 트리거(onBlockDestroyedAt)도 해당 흐름의 매치 영역에 한정해서 중복 호출 차단.
  //   흐름 1개 시 동작 변화 없음 (board=null인 셀은 애초에 매치 영역에 없음).
  for(const [c,r] of allCells){
    if(mergeSet.has(`${c},${r}`)) continue;
    if(board[c]?.[r] == null) continue; // 다른 흐름이 선처리한 셀
    const matchedEl = blockEls[c]?.[r];
    if(matchedEl){
      matchedEl.classList.add('matched');
      _autoDetachOnAnimEnd(matchedEl);
      blockEls[c][r]=null; // 즉시 분리 — ticker가 새 element 할당해도 영향 X
    }
    onBlockDestroyedAt(c,r);
    board[c][r]=null;
  }
  await delay(CFG.matchedDelay); // 호흡 유지 (다음 단계 전 안정화)

  // 6c) 타겟볼 발동 (2스텝: 범위 즉시 제거 → 타겟볼 1개 발사)
  if(actTargets.length>0){
    const targetExclude=new Set(allCellSet);
    for(const t of actTargets){
      // 스텝1: 범위 4칸 즉시 제거
      const areaCells=getTargetAreaCells(t.col,t.row,null);
      // ⚡ Ticker race fix — element snapshot + 즉시 분리
      for(const [ac,ar] of areaCells){
        if(ac===t.col&&ar===t.row) continue;
        targetExclude.add(`${ac},${ar}`);
        if(gimmick[ac]?.[ar]){
          const sk=`${ac},${ar}`;
          if(!hitStones.has(sk)){ hitStones.add(sk); hitGimmick(ac,ar); }
        } else if(board[ac]?.[ar]!==null){
          const matchedEl = blockEls[ac]?.[ar];
          if(matchedEl){
            matchedEl.classList.add('matched');
            _autoDetachOnAnimEnd(matchedEl);
            blockEls[ac][ar]=null; // 즉시 분리
          }
          onBlockDestroyedAt(ac,ar);
          board[ac][ar]=null;
          score+=100;updateScoreUI();
        }
      }
      // bgDelay — 영역 타격 후 발사 대기 동안 ticker가 빈 셀 백그라운드 충전 진행
      await bgDelay(CFG.specialActivateDelay);
      // 스텝2: 타겟볼 1개 발사 (기믹 우선 → 랜덤)
      const hit=getTargetBallTarget(targetExclude);
      if(hit){
        const [rc,rr]=hit.pos;
        targetExclude.add(`${rc},${rr}`);
        await fireTargetProjectile(t.col,t.row,rc,rr,null);
        if(hit.isStone){
          hitGimmick(rc,rr);
        } else {
          // 잔디 트리거 (빈 셀이어도 — 잔디 빈 셀 예외)
          onBlockDestroyedAt(rc,rr);
          if(board[rc]?.[rr]){
            // ⚡ Ticker race fix — element snapshot
            const arrivedEl = blockEls[rc]?.[rr];
            if(arrivedEl){
              arrivedEl.classList.add('matched');
              _autoDetachOnAnimEnd(arrivedEl);
              blockEls[rc][rr]=null;
            }
            board[rc][rr]=null;
            score+=100;updateScoreUI();
            // bgDelay — 도착 처리 후 ticker 백그라운드 충전 동시 진행
            await bgDelay(CFG.specialActivateDelay);
          }
        }
      }
    }
  }

  // 상자 폭발 순차 드레인 — 큐에 쌓인 폭발을 1개씩 처리 (충전 사이 끼움)
  if(typeof drainCrateExplosions==='function') await drainCrateExplosions();
  } finally {
    _unlockArea(matchLockCells);
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
