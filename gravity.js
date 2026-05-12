// ── 헥사 3매치 퍼즐: 중력/충전/대각선 충전 ──
// config/grid/board/match/special 다음, game.js 이전 로드

// ── 낙하 로직 (순수, DOM 무관) ──
// board 배열만 업데이트, 이동 정보 반환
function computeGravity(){
  const moves=[];
  // pass 셀은 블록 착지 불가 → wr 건너뛰기
  function skipPass(col,w){
    while(w>=0&&isPass(col,w)) w--;
    return w;
  }
  for(let col=0;col<COLS_PATTERN.length;col++){
    let wr=skipPass(col,COLS_PATTERN[col]-1);
    for(let row=COLS_PATTERN[col]-1;row>=0;row--){
      // dead/entrance/기믹: 완전 장벽 (블록 통과 불가)
      if(gimmick[col]?.[row]||isDead(col,row)||isEntrance(col,row)){
        wr=skipPass(col,row-1); continue;
      }
      // pass: 투명 통과 (블록 없음, 건너뜀)
      if(isPass(col,row)) continue;
      if(board[col][row]!==null){
        if(row!==wr){
          board[col][wr]=board[col][row];board[col][row]=null;
          moves.push({col,fromRow:row,toRow:wr});
        }
        wr=skipPass(col,wr-1);
      }
    }
  }
  return moves;
}

// 대각선 충전 — 기믹 아래 빈 셀을 대각선 위 블록으로 채움
function computeDiagonalFill(){
  const moves=[];
  let changed=true;
  while(changed){
    changed=false;
    for(let col=0;col<COLS_PATTERN.length;col++){
      for(let row=0;row<COLS_PATTERN[col];row++){
        if(board[col][row]!==null||gimmick[col]?.[row]||isNonPlayable(col,row)) continue;
        // dead/기믹 아래만 대각선 충전 대상
        // entrance 아래 → computeFill이 처리 (대각선 불필요)
        // pass 아래 → 투명 통과이므로 대각선 불필요
        let blockedByDeadOrGimmick=false;
        for(let r=row-1;r>=0;r--){
          if(isEntrance(col,r)) break; // entrance 위 → computeFill 담당
          if(isPass(col,r)) continue;  // pass는 투명, 건너뜀
          if(gimmick[col]?.[r]||isDead(col,r)){blockedByDeadOrGimmick=true;break;}
          if(board[col][r]!==null) break;
        }
        if(!blockedByDeadOrGimmick) continue;
        // 대각선 소스: 좌상단(nw) 우선, 우상단(ne) 차선
        const long=isLongCol(col);
        const diagSources=long
          ?[[col-1,row-1],[col+1,row-1]]
          :[[col-1,row],[col+1,row]];
        for(const [sc,sr] of diagSources){
          if(!isValid(sc,sr)) continue;
          if(board[sc][sr]===null||gimmick[sc]?.[sr]||isNonPlayable(sc,sr)) continue;
          board[col][row]=board[sc][sr];board[sc][sr]=null;
          moves.push({col:sc,fromRow:sr,toCol:col,toRow:row});
          changed=true;
          break;
        }
      }
    }
  }
  return moves;
}

// ── ⚡ 실시간 충전 ticker (코어 개편 — refactor/realtime-fill-ticker) ──
// 이전: 효과 → board null → await applyGravity (30 iter 루프) → await fillEmpty → 매치 검사
//       → "끊김": 폭발/효과 도중에는 충전이 strict await로 블로킹
// 이후: 게임 시작 시 ticker 가동 → 매 50ms 빈 셀 검사 → 있으면 1 step compute+animate
//       → 효과 코드는 board를 변경만 → ticker가 자동으로 다음 frame에 충전 시작
//       → 매치 검사는 await waitForSettle()로 안정화 대기
let _tickerActive=false;
// v2 Phase 1 — 카운터로 변경. 두 흐름이 동시에 pause/resume 호출해도 안전.
// boolean이었을 때: A pause → B pause → A resume(false) → B 아직 await인데 ticker 재가동 → race
// counter: A pause(+1) → B pause(+1)=2 → A resume(-1)=1 → B resume(-1)=0 → 그제서야 재가동
let _tickerPauseCount=0;
let _boardSettled=true;
let _settleWaiters=[];
let _tickerHandle=null;
const _TICK_IDLE_MS=50;   // 빈 셀 없을 때 체크 간격 (대기 모드)

// 효과 처리(매치 제거 / 특수 발동 / 교차 효과)의 await delay 동안 ticker 일시 정지.
// 이 시기에 board=null 되었지만 element는 matched 애니메이션 중. ticker가 끼어들면
// fill로 새 element 생성 → 효과 종료 시 .remove()가 새 element를 죽임 → 빈 셀 발생.
// pause로 그 race 차단.
function pauseTicker(){ _tickerPauseCount++; }
function resumeTicker(){ if(_tickerPauseCount>0) _tickerPauseCount--; }

function startGravityTicker(){
  if(_tickerActive) return;
  _tickerActive=true;
  _tickerPauseCount=0; // 안전망 — 이전 게임의 잔여 pause 카운터 클리어
  _boardSettled=true;
  _settleWaiters=[];
  _gravityTickerLoop();
}

function stopGravityTicker(){
  _tickerActive=false;
  _tickerPauseCount=0; // 안전망 — pause 카운터 클리어 (다음 startGame에서 깨끗하게)
  if(_tickerHandle){ clearTimeout(_tickerHandle); _tickerHandle=null; }
  // pending waiter 모두 resolve해서 hang 방지
  const ws=_settleWaiters.splice(0);
  ws.forEach(r=>r());
}

// 효과 코드가 board를 변경한 직후 명시적으로 호출 가능. waitForSettle도 자동 처리.
function markBoardDirty(){
  _boardSettled=false;
}

// 보드 안정화(빈 셀 0 + 변화 없음)까지 대기. 매치 검사 직전에 호출.
// settled 후 짧은 buffer 대기 — 마지막 transition이 시각적으로 완료될 시간 확보
async function waitForSettle(){
  // 직전에 board가 변경됐을 가능성 → 강제 dirty로 ticker가 다음 tick에 다시 확인하게 함
  _boardSettled=false;
  // ticker가 idle 대기 중(50ms)이면 즉시 깨우기 — 지연 최소화
  if(_tickerActive && _tickerHandle){
    clearTimeout(_tickerHandle);
    _tickerHandle=setTimeout(_gravityTickerLoop, 0);
  }
  await new Promise(resolve=>{
    if(!_tickerActive){
      resolve(); return;
    }
    _settleWaiters.push(resolve);
  });
  // 시각 동기화 buffer — settled 시점에 마지막 transition이 95% 진행됐으므로 잔여분 대기
  // 매치 검사가 시각적으로 모든 블록이 안착한 후에 시작되도록 보장.
  if(_tickerActive){
    const buf=Math.max(20, Math.min(80, (CFG.gravitySettleDelay||60)*0.4));
    await new Promise(r=>setTimeout(r, buf));
  }
}

// v2 Phase 2 — ZOMBIE-RECOVER: board에 cell 있지만 blockEls=null인 셀 → 자동 element 생성.
// gravity/fill로 해결 안 되는 케이스(board != null이라 fill 트리거 X). race로 element가 잘못 사라진 셀 복구.
// lock 셀은 다른 흐름 처리 중이라 skip — lock 풀린 후 다음 tick에서 복구.
function _boardSanityCheck(){
  const container = document.getElementById('grid-container');
  for(let col=0; col<COLS_PATTERN.length; col++){
    for(let row=0; row<COLS_PATTERN[col]; row++){
      if(typeof isNonPlayable==='function' && isNonPlayable(col, row)) continue;
      if(gimmick[col]?.[row]) continue;
      if(board[col]?.[row] == null || blockEls[col]?.[row] != null) continue;
      // lock 셀은 다른 흐름 처리 중 → 복구 skip
      if(typeof _isLocked === 'function' && _isLocked(col, row)) continue;
      // 자동 복구 — board cell로 element 생성
      const cell = board[col][row];
      const newEl = createBlockEl(col, row, cell);
      if(newEl && container){
        container.appendChild(newEl);
        blockEls[col][row] = newEl;
      }
    }
  }
}

// v2 Phase 2 — DOM-DUP 자동 정리: 한 셀에 element 2+ 발견 시 blockEls 안 가리키는 orphan 즉시 제거.
// 단 matched class를 가진 element는 보호 (자체 animation으로 사라질 예정) — 시각 효과 보존.
// lock 셀은 skip (다른 흐름 처리 중).
function _domSanityCheck(){
  if(typeof document==='undefined') return;
  const counts = new Map();
  document.querySelectorAll('.hex-block').forEach(el => {
    const c = el.dataset.col, r = el.dataset.row;
    if(c == null || r == null) return;
    const k = `${c},${r}`;
    if(!counts.has(k)) counts.set(k, []);
    counts.get(k).push(el);
  });
  for(const [k, els] of counts){
    if(els.length > 1){
      const [c, r] = k.split(',').map(Number);
      if(typeof _isLocked === 'function' && _isLocked(c, r)) continue;
      const refEl = blockEls[c]?.[r];
      for(const el of els){
        if(el === refEl) continue; // blockEls 가리키는 element 보호
        if(el.classList.contains('matched') || el.classList.contains('merging')) continue;
        if(el.parentNode) el.remove();
      }
    }
  }
}

function _gravityTickerLoop(){
  if(!_tickerActive){ _tickerHandle=null; return; }
  // 일시 정지 중이면 idle 대기만 (효과 처리 중)
  if(_tickerPauseCount>0){
    _domSanityCheck(); _boardSanityCheck();
    _tickerHandle=setTimeout(_gravityTickerLoop, _TICK_IDLE_MS);
    return;
  }
  _domSanityCheck();
  // 1 step compute (board 직접 수정)
  const moves=computeGravity();
  const diagMoves=computeDiagonalFill();
  const fills=computeFill();
  const changed=(moves.length>0 || diagMoves.length>0 || fills.length>0);

  if(changed){
    _boardSettled=false;
    // 애니메이션 (CSS transition은 비동기로 계속 진행)
    if(moves.length>0) animateGravityDOM(moves);
    if(diagMoves.length>0) animateDiagonalDOM(diagMoves);
    if(fills.length>0) animateFillDOM(fills);
    // 변화 있을 때 — transition 시간 기반 delay (시각 race 방지)
    // 다음 step이 transition 완료 시점에 시작 → 끊김 X, 빈 셀 시각 X
    const transMs = Math.max(
      (CFG.gravityTransition||0.15)*1000,
      (CFG.fillTransition||0.18)*1000,
      (CFG.diagTransition||0.075)*1000
    );
    // 사용자 인스펙터(gravityIterDelay)와 transition 시간 중 큰 값 사용
    const delayMs=Math.max(transMs*0.95, CFG.gravityIterDelay||70);
    _tickerHandle=setTimeout(_gravityTickerLoop, delayMs);
  } else {
    // 변화 없음 → 안정화
    if(!_boardSettled){
      _boardSettled=true;
      refreshBlockElsCoordinates();
      // settle 대기자 모두 resolve
      const ws=_settleWaiters.splice(0);
      ws.forEach(r=>r());
    }
    // 변화 없을 땐 idle 대기 (CPU 절약)
    _tickerHandle=setTimeout(_gravityTickerLoop, _TICK_IDLE_MS);
  }
}

// ── 호환 wrapper (기존 호출처는 변경 없이 동작) ──
// 기존 코드: await applyGravity(); await fillEmpty();
// 새 모델: 둘 다 waitForSettle alias — ticker가 알아서 처리
async function applyGravity(){ return waitForSettle(); }
async function fillEmpty(){ return waitForSettle(); }

// 애니메이션 DOM 조작만 (await 없음)
// 모든 좌표 할당은 blockScale 보정값(adj)만큼 좌상단으로 당겨 셀 중앙 정렬 유지
function animateGravityDOM(moves){
  const t=CFG.gravityTransition/gameSpeed;
  const adj=BLOCK_D*((CFG.blockScale||1.0)-1)/2;
  for(const {col,fromRow,toRow} of moves){
    blockEls[col][toRow]=blockEls[col][fromRow];blockEls[col][fromRow]=null;
    const el=blockEls[col][toRow];
    if(el){
      el.dataset.row=toRow;
      const pos=getBlockPos(col,toRow);
      el.style.transition=`top ${t}s ease-in`;el.style.top=`${pos.y-adj}px`;
    }
  }
}
function animateDiagonalDOM(moves){
  const t=CFG.diagTransition/gameSpeed;
  const adj=BLOCK_D*((CFG.blockScale||1.0)-1)/2;
  for(const {col,fromRow,toCol,toRow} of moves){
    blockEls[toCol][toRow]=blockEls[col][fromRow];blockEls[col][fromRow]=null;
    const el=blockEls[toCol][toRow];
    if(el){
      el.dataset.col=toCol;el.dataset.row=toRow;
      const pos=getBlockPos(toCol,toRow);
      el.style.transition=`left ${t}s ease-in,top ${t}s ease-in`;
      el.style.left=`${pos.x-adj}px`;el.style.top=`${pos.y-adj}px`;
    }
  }
}
function animateFillDOM(fills){
  const container=document.getElementById('grid-container');
  const adj=BLOCK_D*((CFG.blockScale||1.0)-1)/2;
  for(const {col,row,dropDist,block} of fills){
    const pos=getBlockPos(col,row);
    // block 스냅샷 사용 (board[col][row]는 같은 iter의 gravity로 이미 이동된 상태일 수 있음)
    const el=createBlockEl(col,row,block);
    if(el){
      el.style.top=`${pos.y-adj-dropDist*ROW_SPACING}px`;el.style.transition='none';
      container.appendChild(el);blockEls[col][row]=el;
      el.offsetHeight;
      el.style.transition=`top ${CFG.fillTransition/gameSpeed}s ease-in`;el.style.top=`${pos.y-adj}px`;
    }else{
      blockEls[col][row]=null;
    }
  }
}

// ── 충전 로직 (순수, DOM 무관) ──
function computeFill(){
  const fills=[];
  for(let col=0;col<COLS_PATTERN.length;col++){
    // 이 컬럼의 충전 소스: top entrance(row=-1) + 보드 내 entrance 셀
    const sources=[];
    if(entranceCols.has(col)) sources.push(-1);
    for(let row=0;row<COLS_PATTERN[col];row++){
      if(isEntrance(col,row)) sources.push(row);
    }
    // 각 소스에서 아래 방향으로 빈 셀 충전
    // dead/entrance/기믹 = 장벽(중단), pass = 투명(통과)
    for(const srcRow of sources){
      const startRow=srcRow+1;
      if(startRow<0||startRow>=COLS_PATTERN[col]) continue;
      const targets=[];
      for(let row=startRow;row<COLS_PATTERN[col];row++){
        if(gimmick[col]?.[row]||isDead(col,row)||isEntrance(col,row)) break; // 장벽
        if(isPass(col,row)) continue; // pass는 투명, 통과
        if(board[col][row]!==null) break;
        targets.push(row);
      }
      for(const row of targets){
        if(board[col][row]!==null) continue; // 다른 소스가 이미 채운 경우 스킵
        // v2 Phase 1 lock — 흐름이 처리 중인 영역에 ticker가 새 element 생성 차단.
        // 흐름 unlock 후 다음 tick에서 정상 fill.
        if(typeof _isLocked === 'function' && _isLocked(col, row)) continue;
        const ci=Math.floor(Math.random()*numColors);
        board[col][row]=makeCell(ci);
        // block 필드로 셀 스냅샷 저장 → 같은 iter에서 gravity가 이동시켜도 animateFillDOM이 정확히 DOM 생성 가능
        fills.push({col,row,dropDist:row-srcRow,block:board[col][row]});
      }
    }
  }
  return fills;
}

function refreshBlockElsCoordinates(){
  const adj=BLOCK_D*((CFG.blockScale||1.0)-1)/2;
  for(let col=0;col<COLS_PATTERN.length;col++){
    for(let row=0;row<COLS_PATTERN[col];row++){
      const el = blockEls[col][row];
      if(!el) continue;
      el.dataset.col = col;
      el.dataset.row = row;
      const pos=getBlockPos(col,row);
      el.style.left=`${pos.x-adj}px`;
      el.style.top=`${pos.y-adj}px`;
    }
  }
}
