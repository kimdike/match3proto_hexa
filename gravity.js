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
  for(const {col,row,dropDist} of fills){
    const pos=getBlockPos(col,row);
    const el=createBlockEl(col,row,board[col][row]);
    if(el){
      el.style.top=`${pos.y-dropDist*ROW_SPACING}px`;el.style.transition='none';
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
    if(gimmick[col]?.[r]||isDead(col,r)||isEntrance(col,r)) return false;
    if(isPass(col,r)) continue; // pass는 투명, 통과
  }
  return true;
}

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
        const ci=Math.floor(Math.random()*numColors);
        board[col][row]=makeCell(ci);
        fills.push({col,row,dropDist:row-srcRow});
      }
    }
  }
  return fills;
}

// 충전 애니메이션 (DOM만 조작, board 건드리지 않음)
async function animateFill(fills){
  const container=document.getElementById('grid-container');
  for(const {col,row,dropDist} of fills){
    const pos=getBlockPos(col,row);
    const el=createBlockEl(col,row,board[col][row]);
    if(el){
      el.style.top=`${pos.y-dropDist*ROW_SPACING}px`;el.style.transition='none';
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
