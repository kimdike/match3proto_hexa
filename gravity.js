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

// gravity + diagonal: 단계 간 짧게 겹쳐 "폭포처럼 흐르는" 연출
// gravity → 짧은 시차 → diagonal 순서로 "직선 낙하 후 꺾여서 흘러들어감" 느낌
async function applyGravity(){
  let anyMoved=false;
  for(let i=0;i<30;i++){
    const moves=computeGravity();
    const diagMoves=computeDiagonalFill();
    if(moves.length===0&&diagMoves.length===0) break;
    animateGravityDOM(moves);
    if(diagMoves.length>0){
      if(moves.length>0) await skippableDelay(CFG.gravityTransition*1000); // 직선 낙하 완전히 착지 후 대각 시작
      animateDiagonalDOM(diagMoves);
    }
    anyMoved=true;
    await skippableDelay(CFG.gravityDelay/3); // 다음 단계 일찍 시작 (연속 흐름)
  }
  if(anyMoved){
    await skippableDelay(CFG.gravityDelay); // 마지막 transition 완료 + 보드 안정화
    refreshBlockElsCoordinates();
  }
}

// 상단 충전 + 낙하 + 대각 충전을 매 iter에 동시 트리거 (폭포 연출)
// 서브루프 제거: 한 반복에서 computeFill/computeGravity/computeDiagonalFill
// 세 계산을 모두 수행하고, 대응 애니메이션을 동시에 시작 → 블록이 끊김 없이 흘러내림
async function fillEmpty(){
  let anyActivity=false;
  let i;
  for(i=0;i<30;i++){
    const fills=computeFill();
    const moves=computeGravity();
    const diagMoves=computeDiagonalFill();
    if(fills.length===0 && moves.length===0 && diagMoves.length===0){
      break;
    }
    // fill + gravity는 동시 (위에서 사출 + 직선 낙하), diagonal은 직선 착지 후 시작 (꺾이는 느낌)
    if(fills.length>0) animateFillDOM(fills);
    if(moves.length>0) animateGravityDOM(moves);
    if(diagMoves.length>0){
      if(moves.length>0) await skippableDelay(CFG.gravityTransition*1000); // 직선 낙하 완전히 착지 후 대각 시작
      animateDiagonalDOM(diagMoves);
    }
    anyActivity=true;
    await skippableDelay(CFG.gravityDelay*0.33); // iter 간 짧게 겹쳐 연속 흐름
  }
  if(anyActivity){
    await skippableDelay(CFG.gravityDelay); // 루프 끝난 후 1회 안정화
    refreshBlockElsCoordinates();
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
  for(const {col,row,dropDist,block} of fills){
    const pos=getBlockPos(col,row);
    // block 스냅샷 사용 (board[col][row]는 같은 iter의 gravity로 이미 이동된 상태일 수 있음)
    const el=createBlockEl(col,row,block);
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
        // block 필드로 셀 스냅샷 저장 → 같은 iter에서 gravity가 이동시켜도 animateFillDOM이 정확히 DOM 생성 가능
        fills.push({col,row,dropDist:row-srcRow,block:board[col][row]});
      }
    }
  }
  return fills;
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
