// ── 헥사 3매치 퍼즐: 특수블록 발동/교차/비주얼 ──
// config/grid/board/match 다음, game.js 이전 로드

// ── 줄볼 시각 유틸 ──
function getStripeAngle(dir){
  switch(dir){ case'up':case'down':return 90; case'ne':case'sw':return -30; case'nw':case'se':return 30; } return 0;
}
function getStripeImage(dir){
  switch(dir){ case'up':case'down':return 'assets/specialblock/sb_stripe1.png';
    case'se':case'nw':return 'assets/specialblock/sb_stripe2.png';
    case'ne':case'sw':return 'assets/specialblock/sb_stripe3.png'; }
  return 'assets/specialblock/sb_stripe1.png';
}

// ── 줄볼 라인 (axis 양방향, 원점 제외) ──
function getStripeLine(col,row,dir){
  const axis=getStripeAxis(dir),result=[];
  for(const d of axis){let pos=step(col,row,d);while(pos){result.push(pos);pos=step(pos[0],pos[1],d);}}
  return result;
}

// ── 무지개볼: 보드 내 최다 색상 ──
function getMostFrequentColor(){
  const counts=new Map();
  for(let c=0;c<COLS_PATTERN.length;c++)
    for(let r=0;r<COLS_PATTERN[c];r++)
      if(board[c][r]&&board[c][r].type==='normal'){
        const col=board[c][r].color;
        counts.set(col,(counts.get(col)||0)+1);
      }
  if(counts.size===0) return null;
  let best=null,bestCnt=0;
  for(const [color,cnt] of counts) if(cnt>bestCnt){bestCnt=cnt;best=color;}
  return best;
}

// ── 랜덤 블록 좌표 (무지개/타겟 대상 선정) ──
function getRandomBlockPos(excludeSet){
  const cands=[];
  for(let c=0;c<COLS_PATTERN.length;c++) for(let r=0;r<COLS_PATTERN[c];r++)
    if(board[c][r]!==null&&(!excludeSet||!excludeSet.has(`${c},${r}`))) cands.push([c,r]);
  return cands.length?cands[Math.floor(Math.random()*cands.length)]:null;
}

// ── 타겟볼 범위 타격 패턴 (4칸) ──
// swapDir: 스왑 방향 (null이면 클릭 발동 → 기본 패턴)
function getTargetAreaCells(col,row,swapDir){
  let dirs;
  if(!swapDir){
    // 클릭 발동: 자신 + 상/우하/좌하
    dirs=['up','se','sw'];
  } else {
    // 스왑 발동: 스왑 방향 쪽 3칸
    const patterns={
      up:['up','nw','ne'],     // 아래→위 스왑: 상/좌상/우상
      down:['down','sw','se'], // 위→아래 스왑: 하/좌하/우하
      nw:['nw','up','sw'],     // 우하→좌상 스왑: 좌상/상/좌하
      se:['se','ne','down'],   // 좌상→우하 스왑: 우하/우상/하
      ne:['ne','up','se'],     // 좌하→우상 스왑: 우상/상/우하
      sw:['sw','down','nw'],   // 우상→좌하 스왑: 좌하/하/좌상
    };
    dirs=patterns[swapDir]||['up','se','sw'];
  }
  const cells=[[col,row]]; // 자기 자신 포함
  for(const d of dirs){
    const p=step(col,row,d);
    if(p) cells.push(p);
  }
  return cells;
}

// 타겟볼 타격 대상 (미션 모델 D)
// 우선순위: currentMissions 배열 순서 → 같은 type 안에선 단계 높은 거 → 일반 블록 fallback
// 같은 단계 안에선 random. 이미 카운트 0 인 미션은 skip.
function getTargetBallTarget(excludeSet){
  if(typeof currentMissions!=='undefined' && currentMissions.length>0){
    for(const m of currentMissions){
      if(m.count<=0) continue; // 이미 클리어된 미션 skip
      const cands=collectMissionCells(m.type, excludeSet);
      if(!cands.length) continue;
      const maxLv=Math.max(...cands.map(c=>c.level||0));
      const top=cands.filter(c=>(c.level||0)===maxLv);
      return top[Math.floor(Math.random()*top.length)];
    }
  } else {
    // 후방 호환: 미션 미정의 시 기존 방식 (돌 우선)
    const stone=getRandomStonePos(excludeSet);
    if(stone) return {pos:stone,isStone:true};
  }
  const block=getRandomBlockPos(excludeSet);
  if(block) return {pos:block,isStone:false};
  return null;
}

// ── 비주얼 이펙트 ──
function showStripeBeam(col,row,dir){
  const container=document.getElementById('grid-container');
  const origin=getBlockPos(col,row);
  const cx=origin.x+BLOCK_D/2,cy=origin.y+BLOCK_D/2,angle=getStripeAngle(dir);
  const len=Math.max(container.offsetWidth,container.offsetHeight)*1.5;
  const beam=document.createElement('div');beam.className='stripe-beam';
  beam.style.width=`${len}px`;beam.style.height='6px';
  beam.style.left=`${cx-len/2}px`;beam.style.top=`${cy-3}px`;
  beam.style.transformOrigin='center';beam.style.transform=`rotate(${angle}deg)`;
  container.appendChild(beam);setTimeout(()=>beam.remove(),400);
}
function showBombExplosion(col,row){
  const container=document.getElementById('grid-container');
  const pos=getBlockPos(col,row);
  const exp=document.createElement('div');exp.className='bomb-explosion';
  exp.style.left=`${pos.x+BLOCK_D/2}px`;exp.style.top=`${pos.y+BLOCK_D/2}px`;
  container.appendChild(exp);setTimeout(()=>exp.remove(),CFG.explosionLifetime);
}
async function fireTargetProjectile(fromCol,fromRow,toCol,toRow,color){
  const container=document.getElementById('grid-container');
  const from=getBlockPos(fromCol,fromRow),to=getBlockPos(toCol,toRow);
  const proj=document.createElement('div');proj.className='target-projectile';
  if(color!==null){
    proj.style.background=`radial-gradient(circle,#fff 20%,${ALL_COLORS[color].bg} 60%,transparent)`;
    proj.style.boxShadow=`0 0 10px 3px ${ALL_COLORS[color].bg}`;
  }
  proj.style.left=`${from.x+BLOCK_D/2-6}px`;proj.style.top=`${from.y+BLOCK_D/2-6}px`;
  container.appendChild(proj);proj.offsetHeight;
  const pt=CFG.projectileTransition/gameSpeed;
  proj.style.transition=`left ${pt}s ease-in-out,top ${pt}s cubic-bezier(0.2,-0.6,0.7,1.4)`;
  proj.style.left=`${to.x+BLOCK_D/2-6}px`;proj.style.top=`${to.y+BLOCK_D/2-6}px`;
  await delay(pt*1000+20);proj.remove();
}

// ── mid-flight redirect 지원 발사체 (rainbow×타겟볼 전용) ──
// 비행 중 타겟이 destroyed되면 50ms 폴링으로 감지 → 새 타겟 탐색 → CSS 자동 보간으로 방향 전환
// 첫 비행: 호(arc) 모양 cubic-bezier 유지 / 재지향 후: ease-in-out (호 모양 깨짐 방지)
// 도착 타이머는 매 redirect마다 리셋. 갈 곳 없으면 현재 비행 그대로 종료
async function fireTargetProjectileWithRedirect(fromCol,fromRow,initialTarget,color,getNextTargetFn,maxRedirects=5){
  const container=document.getElementById('grid-container');
  const proj=document.createElement('div');proj.className='target-projectile';
  if(color!==null){
    proj.style.background=`radial-gradient(circle,#fff 20%,${ALL_COLORS[color].bg} 60%,transparent)`;
    proj.style.boxShadow=`0 0 10px 3px ${ALL_COLORS[color].bg}`;
  }
  const from=getBlockPos(fromCol,fromRow);
  proj.style.left=`${from.x+BLOCK_D/2-6}px`;proj.style.top=`${from.y+BLOCK_D/2-6}px`;
  container.appendChild(proj);proj.offsetHeight;
  const pt=CFG.projectileTransition/gameSpeed;
  let curTarget=initialTarget;
  let redirectCount=0;
  let firstFlight=true;
  function applyMove(target){
    const dest=getBlockPos(target.pos[0],target.pos[1]);
    proj.style.transition=firstFlight
      ?`left ${pt}s ease-in-out,top ${pt}s cubic-bezier(0.2,-0.6,0.7,1.4)`
      :`left ${pt}s ease-in-out,top ${pt}s ease-in-out`;
    proj.style.left=`${dest.x+BLOCK_D/2-6}px`;
    proj.style.top=`${dest.y+BLOCK_D/2-6}px`;
    firstFlight=false;
  }
  function isAlive(t){
    if(!t) return false;
    if(t.isStone) return gimmick[t.pos[0]]?.[t.pos[1]]?.type==='stone';
    return board[t.pos[0]]?.[t.pos[1]]!=null;
  }
  applyMove(curTarget);
  return new Promise((resolve)=>{
    let arrivalTimer=null,pollTimer=null;
    function finish(){
      if(pollTimer) clearInterval(pollTimer);
      if(arrivalTimer) clearTimeout(arrivalTimer);
      proj.remove();
      resolve(curTarget);
    }
    function scheduleArrival(){
      if(arrivalTimer) clearTimeout(arrivalTimer);
      arrivalTimer=setTimeout(finish,pt*1000+20);
    }
    pollTimer=setInterval(()=>{
      if(isAlive(curTarget)) return;
      if(redirectCount>=maxRedirects) return;
      const next=getNextTargetFn();
      if(!next) return; // 갈 곳 없음 → 현재 비행 그대로 종료
      curTarget=next;
      redirectCount++;
      applyMove(curTarget); // CSS 자동 보간으로 즉시 방향 전환
      scheduleArrival();    // 새 비행 시간만큼 도착 타이머 리셋
    },50);
    scheduleArrival();
  });
}

// ── 무지개볼 발동 (클릭/스왑 단독용) ──
async function activateRainbow(col,row,targetColor){
  const prevRainbow=isBusyRainbow;
  isBusyRainbow=true; // 무지개볼 연출 중 입력 차단
  const targets=[];
  for(let c=0;c<COLS_PATTERN.length;c++)
    for(let r=0;r<COLS_PATTERN[c];r++)
      if(board[c][r]&&board[c][r].color===targetColor&&board[c][r].type==='normal')
        targets.push([c,r]);
  // 순차 마킹
  for(const [c,r] of targets){
    if(blockEls[c][r]) blockEls[c][r].classList.add('rainbow-marked');
    await delay(25);
  }
  await delay(200);
  // 무지개볼 자체 제거
  if(blockEls[col][row]){blockEls[col][row].classList.add('matched');} onBlockDestroyedAt(col,row); board[col][row]=null;
  // 타겟 블록 제거
  for(const [c,r] of targets){
    if(blockEls[c][r]){blockEls[c][r].classList.remove('rainbow-marked');blockEls[c][r].classList.add('matched');}
    onBlockDestroyedAt(c,r);
    board[c][r]=null;
  }
  // 제거된 블록에 인접한 기믹 단계 -1
  const hitSet=new Set();
  for(const [c,r] of targets){
    for(const [nc,nr] of getNeighbors(c,r)){
      if(gimmick[nc]?.[nr]?.type==='stone'){
        const sk=`${nc},${nr}`;
        if(!hitSet.has(sk)){ hitSet.add(sk); hitStone(nc,nr); }
      }
    }
  }
  await delay(300);
  if(blockEls[col][row]){blockEls[col][row].remove();blockEls[col][row]=null;}
  for(const [c,r] of targets){
    if(blockEls[c][r]){blockEls[c][r].remove();blockEls[c][r]=null;}
  }
  isBusyRainbow=prevRainbow; // 호출자의 상태 복원
  addMatchLog(0,'무지개볼발동',targets.length+1);
  return targets.length;
}

// ── 특수블록 효과 계산 (순수 로직, 연쇄 포함) ──
function computeSpecialEffect(col,row,cell){
  const destroyed=[];
  const effects=[]; // 애니메이션 이벤트
  if(cell.type==='stripe'){
    effects.push({type:'stripe',col,row,dir:cell.dir});
    for(const [sc,sr] of getStripeLine(col,row,cell.dir)){
      if(gimmick[sc]?.[sr]?.type==='stone') effects.push({type:'hit-stone',col:sc,row:sr});
      else if(board[sc][sr]!==null) destroyed.push([sc,sr]);
    }
  } else if(cell.type==='bomb'){
    effects.push({type:'bomb',col,row});
    for(const [nc,nr] of getNeighbors(col,row)){
      if(gimmick[nc]?.[nr]?.type==='stone') effects.push({type:'hit-stone',col:nc,row:nr});
      else if(board[nc][nr]!==null) destroyed.push([nc,nr]);
    }
  } else if(cell.type==='target'){
    // 스텝1: 범위 4칸 즉시 제거
    const areaCells=getTargetAreaCells(col,row,cell._swapDir||null);
    const areaEffects=[];
    for(const [ac,ar] of areaCells){
      if(ac===col&&ar===row) continue;
      if(gimmick[ac]?.[ar]?.type==='stone'){
        areaEffects.push({type:'target-area-stone',col:ac,row:ar});
      } else if(board[ac][ar]!==null){
        destroyed.push([ac,ar]);
      }
    }
    effects.push(...areaEffects);
    // 스텝2는 별도 step으로 분리 (아래에서 처리)
    cell._targetAreaCells=areaCells; // 발사체 제외용
    cell._targetStep2=true;
  } else if(cell.type==='rainbow'){
    // _forceTargetColor: 배치 동시 발동 시 동일 색 강제 (폭탄x폭탄 교차 등)
    const tc = cell._forceTargetColor!==undefined ? cell._forceTargetColor : getMostFrequentColor();
    if(tc!==null){
      effects.push({type:'rainbow',col,row,targetColor:tc});
      for(let c=0;c<COLS_PATTERN.length;c++)
        for(let r=0;r<COLS_PATTERN[c];r++)
          if(board[c][r]&&board[c][r].color===tc&&board[c][r].type==='normal')
            destroyed.push([c,r]);
    }
  }
  // board에서 제거 + 연쇄 특수블록 수집
  const chainSpecials=[];
  for(const [dc,dr] of destroyed){
    if(!board[dc][dr]) continue;
    if(isSpecial(dc,dr)) chainSpecials.push({col:dc,row:dr,cell:{...board[dc][dr]}});
    onBlockDestroyedAt(dc,dr);
    board[dc][dr]=null;
  }
  // 재귀적으로 연쇄 처리
  const allSteps=[{col,row,cell,destroyed,effects,chainSpecials}];
  for(const cs of chainSpecials){
    const sub=computeSpecialEffect(cs.col,cs.row,cs.cell);
    allSteps.push(...sub);
  }
  // 타겟볼 스텝2: 범위 타격 후 발사체 1개 (별도 step으로 분리)
  if(cell._targetStep2){
    const excludeSet=new Set((cell._targetAreaCells||[]).map(([c,r])=>`${c},${r}`));
    const hit=getTargetBallTarget(excludeSet);
    if(hit){
      const [tc,tr]=hit.pos;
      const step2effects=[{type:'target',fromCol:col,fromRow:row,toCol:tc,toRow:tr,color:null,isStone:hit.isStone}];
      const step2destroyed=[];
      const step2chain=[];
      if(!hit.isStone){
        // 잔디 트리거: 빈 셀이어도 호출 (잔디 빈 셀 예외)
        onBlockDestroyedAt(tc,tr);
        if(board[tc]?.[tr]){
          if(isSpecial(tc,tr)) step2chain.push({col:tc,row:tr,cell:{...board[tc][tr]}});
          step2destroyed.push(hit.pos);
          board[tc][tr]=null;
        }
      }
      allSteps.push({col,row,cell,destroyed:step2destroyed,effects:step2effects,chainSpecials:step2chain});
      for(const cs of step2chain){
        const sub=computeSpecialEffect(cs.col,cs.row,cs.cell);
        allSteps.push(...sub);
      }
    }
    delete cell._targetStep2;
    delete cell._targetAreaCells;
  }
  return allSteps;
}

// ── 특수블록 효과 애니메이션 재생 (DOM만 조작, board 건드리지 않음) ──
async function animateSpecialSteps(steps){
  for(const step of steps){
    // 이펙트 표시
    for(const fx of step.effects){
      if(fx.type==='stripe') showStripeBeam(fx.col,fx.row,fx.dir);
      if(fx.type==='bomb') showBombExplosion(fx.col,fx.row);
      if(fx.type==='target-area-stone'||fx.type==='hit-stone') hitStone(fx.col,fx.row);
      if(fx.type==='target'){
        await fireTargetProjectile(fx.fromCol,fx.fromRow,fx.toCol,fx.toRow,fx.color);
        if(fx.isStone) hitStone(fx.toCol,fx.toRow);
      }
    }
    // 파괴 블록 DOM 제거
    for(const [dc,dr] of step.destroyed){
      if(blockEls[dc]?.[dr]) blockEls[dc][dr].classList.add('matched');
    }
    await delay(CFG.specialActivateDelay);
    for(const [dc,dr] of step.destroyed){
      if(blockEls[dc]?.[dr]){blockEls[dc][dr].remove();blockEls[dc][dr]=null;}
    }
    score+=step.destroyed.length*100;updateScoreUI();
  }
}

// ── 개별 특수블록 발동 (swap 교차용) — 래퍼 ──
async function activateSpecialAt(col,row){
  const cell=board[col][row]; if(!cell) return;
  const cellSnap={...cell}; // 스냅샷 (board에서 제거 전)
  // board에서 자기 자신 제거
  onBlockDestroyedAt(col,row);
  board[col][row]=null;
  // 자기 자신 DOM 제거 연출
  if(blockEls[col][row]) blockEls[col][row].classList.add('matched');
  await delay(CFG.specialActivateDelay);
  if(blockEls[col][row]){blockEls[col][row].remove();blockEls[col][row]=null;}
  // 효과 계산 (로직) → 애니메이션 재생
  const steps=computeSpecialEffect(col,row,cellSnap);
  await animateSpecialSteps(steps);
}

// ── 이미 제거된 특수블록의 효과만 발동 — 래퍼 ──
async function activateSpecialEffect(col,row,cell){
  const steps=computeSpecialEffect(col,row,cell);
  await animateSpecialSteps(steps);
}

// ── 교차 효과 처리 (특수블록 2개 swap) ──
async function handleCrossEffect(c1,r1,c2,r2){
  const cell1={...board[c1][r1]},cell2={...board[c2][r2]};
  const t1=cell1.type,t2=cell2.type;
  // 무지개볼 포함 시 입력 차단
  const hasRainbow=t1==='rainbow'||t2==='rainbow';
  if(hasRainbow) isBusyRainbow=true;
  const priority={rainbow:0,bomb:1,stripe:2,target:3};
  let typeA,typeB,cA,rA,cB,rB,cellA,cellB;
  if(priority[t1]<=priority[t2]){
    [typeA,typeB,cA,rA,cB,rB,cellA,cellB]=[t1,t2,c1,r1,c2,r2,cell1,cell2];
  }else{
    [typeA,typeB,cA,rA,cB,rB,cellA,cellB]=[t2,t1,c2,r2,c1,r1,cell2,cell1];
  }
  const combo=`${typeA}+${typeB}`;

  // 두 블록 제거 공통
  async function removeBoth(){
    if(blockEls[c1][r1]) blockEls[c1][r1].classList.add('matched');
    if(blockEls[c2][r2]) blockEls[c2][r2].classList.add('matched');
    onBlockDestroyedAt(c1,r1);onBlockDestroyedAt(c2,r2);
    board[c1][r1]=null;board[c2][r2]=null;
    await delay(CFG.crossEffectDelay);
    if(blockEls[c1][r1]){blockEls[c1][r1].remove();blockEls[c1][r1]=null;}
    if(blockEls[c2][r2]){blockEls[c2][r2].remove();blockEls[c2][r2]=null;}
  }

  // 셀 파괴 + 점수 + 특수블록 연쇄 + 기믹 타격
  async function destroyCells(cells){
    const chainSpecials=[],destroyed=[];
    for(const [c,r] of cells){
      // 기믹 타격
      if(gimmick[c]?.[r]?.type==='stone'){ hitStone(c,r); continue; }
      if(!board[c][r]) continue;
      if(isSpecial(c,r)) chainSpecials.push([c,r,{...board[c][r]}]);
      destroyed.push([c,r]);
      if(blockEls[c][r]) blockEls[c][r].classList.add('matched');
      onBlockDestroyedAt(c,r);
      board[c][r]=null;
    }
    if(destroyed.length===0) return;
    await delay(CFG.crossEffectDelay);
    for(const [c,r] of destroyed){
      if(blockEls[c][r]){blockEls[c][r].remove();blockEls[c][r]=null;}
    }
    score+=destroyed.length*100;updateScoreUI();
    for(const [sc,sr,scell] of chainSpecials) await activateSpecialEffect(sc,sr,scell);
  }

  // ① 줄볼 x 줄볼: 두 위치에서 동시에 각각 줄볼 효과
  // 같은 방향 시 겹치는 라인의 돌은 중첩 타격
  if(combo==='stripe+stripe'){
    await removeBoth();
    showStripeBeam(cA,rA,cellA.dir);showStripeBeam(cB,rB,cellB.dir);
    const lineA=getStripeLine(cA,rA,cellA.dir);
    const lineB=getStripeLine(cB,rB,cellB.dir);
    // 라인별 stone hit (겹치면 중첩 타격)
    for(const [c,r] of lineA){
      if(gimmick[c]?.[r]?.type==='stone') hitStone(c,r);
    }
    for(const [c,r] of lineB){
      if(gimmick[c]?.[r]?.type==='stone') hitStone(c,r);
    }
    // 일반 블록은 dedupe (stone은 destroyCells가 또 hit하지 않도록 제외)
    const cells=new Set();
    for(const [c,r] of [...lineA,...lineB]){
      if(gimmick[c]?.[r]?.type!=='stone') cells.add(`${c},${r}`);
    }
    await destroyCells([...cells].map(k=>k.split(',').map(Number)));
  }
  // ② 줄볼 x 폭탄볼: 1줄→3줄 증폭. 기준점은 드래그 끝점(c2,r2)로 고정
  else if(combo==='bomb+stripe'){
    const sDir=cellB.dir;
    await removeBoth();
    const perpDirs=getPerpDirs(sDir);
    showStripeBeam(c2,r2,sDir);
    for(const pd of perpDirs){const s=step(c2,r2,pd);if(s) showStripeBeam(s[0],s[1],sDir);}
    await destroyCells(get3LineStripeCells(c2,r2,sDir));
  }
  // ③ 폭탄볼 x 폭탄볼: 드래그 목적지 기준 2칸 범위(19칸) 제거 + 범위 내 특수블록 동시 발동
  else if(combo==='bomb+bomb'){
    await removeBoth();
    showBombExplosion(cB,rB);

    // 1) 19칸 범위 수집: 돌/특수/일반 분류
    const rangeCells=getCellsInRange2(cB,rB);
    const hitStoneKeys=new Set();   // 돌 중복 타격 방지
    const initialDestroy=[];         // 초기 제거 대상 (특수 포함)
    const rangeSpecials=[];          // 범위 내 특수블록 (동시 발동용)
    for(const [c,r] of rangeCells){
      if(gimmick[c]?.[r]?.type==='stone'){
        const k=`${c},${r}`;
        if(!hitStoneKeys.has(k)){ hitStoneKeys.add(k); hitStone(c,r); }
        continue;
      }
      if(!board[c][r]) continue;
      if(isSpecial(c,r)) rangeSpecials.push([c,r,{...board[c][r]}]);
      initialDestroy.push([c,r]);
    }

    // 2) 초기 19칸 블록 제거 (matched 마킹 + board null)
    //    특수의 연쇄 계산이 자신/이웃을 재파괴하지 않도록 먼저 보드에서 비운다
    for(const [c,r] of initialDestroy){
      if(blockEls[c][r]) blockEls[c][r].classList.add('matched');
      onBlockDestroyedAt(c,r);
      board[c][r]=null;
    }

    // 3) 무지개볼 공유 타겟색 사전 캡쳐 (같은 배치의 모든 무지개가 동일 색 사용)
    const hasRainbowInBatch=rangeSpecials.some(([,,scell])=>scell.type==='rainbow');
    const rainbowSharedColor=hasRainbowInBatch?getMostFrequentColor():null;

    // 4) 모든 chain special 효과 계산 (연쇄 포함, 보드는 sync로 변경됨)
    const allSteps=[];
    for(const [sc,sr,scell] of rangeSpecials){
      if(scell.type==='rainbow' && rainbowSharedColor!==null){
        scell._forceTargetColor=rainbowSharedColor;
      }
      const steps=computeSpecialEffect(sc,sr,scell);
      allSteps.push(...steps);
    }

    // 5) 제거 셀 전체 dedupe (초기 19칸 + 연쇄 결과 병합)
    const allDestroyedKeys=new Set(initialDestroy.map(([c,r])=>`${c},${r}`));
    for(const stepData of allSteps){
      for(const [c,r] of stepData.destroyed) allDestroyedKeys.add(`${c},${r}`);
    }

    // 6) 모든 이펙트 동시 재생 (beam/explosion은 동시, projectile은 Promise로 모음)
    const projectilePromises=[];
    for(const stepData of allSteps){
      for(const fx of stepData.effects){
        if(fx.type==='stripe') showStripeBeam(fx.col,fx.row,fx.dir);
        else if(fx.type==='bomb') showBombExplosion(fx.col,fx.row);
        else if(fx.type==='target-area-stone'||fx.type==='hit-stone'){
          const k=`${fx.col},${fx.row}`;
          if(!hitStoneKeys.has(k)){ hitStoneKeys.add(k); hitStone(fx.col,fx.row); }
        }
        else if(fx.type==='target'){
          const p=fireTargetProjectile(fx.fromCol,fx.fromRow,fx.toCol,fx.toRow,fx.color);
          projectilePromises.push(p);
          if(fx.isStone){
            const k=`${fx.toCol},${fx.toRow}`;
            p.then(()=>{
              if(!hitStoneKeys.has(k)){ hitStoneKeys.add(k); hitStone(fx.toCol,fx.toRow); }
            });
          }
        }
      }
    }

    // 7) 모든 파괴셀 matched 마킹 (초기 파괴셀은 이미 마킹됨, 연쇄 추가분만 마킹)
    for(const k of allDestroyedKeys){
      const [c,r]=k.split(',').map(Number);
      if(blockEls[c]?.[r]) blockEls[c][r].classList.add('matched');
    }

    // 8) 발사체 대기 후 DOM 일괄 제거
    if(projectilePromises.length>0) await Promise.all(projectilePromises);
    await delay(CFG.crossEffectDelay);
    for(const k of allDestroyedKeys){
      const [c,r]=k.split(',').map(Number);
      if(blockEls[c]?.[r]){ blockEls[c][r].remove(); blockEls[c][r]=null; }
    }

    score+=allDestroyedKeys.size*100; updateScoreUI();
  }
  // ④ 줄볼 x 타겟볼: 끝점(c2,r2) 기준 범위 4칸 즉시 타격 → 타겟볼 1개 날아가서 줄볼 효과
  else if(combo==='stripe+target'){
    const sCell=typeA==='stripe'?cellA:cellB;
    // 끝점(c2,r2)에서 발동, 방향=c1→c2
    const swapDir=getSwapDirection(c1,r1,c2,r2);
    await removeBoth();
    // 스텝1: 끝점 기준 범위 4칸 즉시 타격
    const areaCells=getTargetAreaCells(c2,r2,swapDir);
    const areaKill=[];
    for(const [c,r] of areaCells){
      if(c===c2&&r===r2) continue;
      if(gimmick[c]?.[r]?.type==='stone'){ hitStone(c,r); }
      else if(board[c]?.[r]){ areaKill.push([c,r]); }
    }
    if(areaKill.length>0){
      for(const [c,r] of areaKill){ if(blockEls[c][r]) blockEls[c][r].classList.add('matched'); onBlockDestroyedAt(c,r); board[c][r]=null; }
      await delay(CFG.crossEffectDelay);
      for(const [c,r] of areaKill){ if(blockEls[c]?.[r]){blockEls[c][r].remove();blockEls[c][r]=null;} }
      score+=areaKill.length*100;updateScoreUI();
    }
    // 스텝2: 타겟볼 1개 날아가서 → 도착 지점에서 줄볼 효과 발동
    const excludeSet=new Set([...areaCells.map(([c,r])=>`${c},${r}`),`${c1},${r1}`]);
    const hit=getTargetBallTarget(excludeSet);
    if(hit){
      const [rc,rr]=hit.pos;
      await fireTargetProjectile(c2,r2,rc,rr,null);
      if(hit.isStone) hitStone(rc,rr);
      else if(!board[rc]?.[rr]) onBlockDestroyedAt(rc,rr); // 잔디 빈 셀 예외
      // 도착 지점에서 줄볼 효과 발동 (기믹/블록 무관)
      showStripeBeam(rc,rr,sCell.dir);
      const lineCells=getStripeLine(rc,rr,sCell.dir);
      if(!hit.isStone) lineCells.push([rc,rr]);
      // 라인 내 기믹 타격
      for(const [lc,lr] of lineCells){
        if(gimmick[lc]?.[lr]?.type==='stone') hitStone(lc,lr);
      }
      await destroyCells(lineCells);
    }
  }
  // ⑤ 타겟볼 x 타겟볼: 마우스 놓은 지점(cB,rB) 주변 7칸 즉시 타격 → 타겟볼 4개 발사
  else if(combo==='target+target'){
    await removeBoth();
    // 스텝1: cB 기준 자신+인접 6칸 = 7칸 즉시 타격
    const areaCells=[[cB,rB],...getNeighbors(cB,rB)];
    const areaKill=[];
    for(const [c,r] of areaCells){
      if(c===c1&&r===r1) continue; if(c===c2&&r===r2) continue;
      if(gimmick[c]?.[r]?.type==='stone'){ hitStone(c,r); }
      else if(board[c]?.[r]){ areaKill.push([c,r]); }
    }
    if(areaKill.length>0){
      for(const [c,r] of areaKill){ if(blockEls[c][r]) blockEls[c][r].classList.add('matched'); onBlockDestroyedAt(c,r); board[c][r]=null; }
      await delay(CFG.crossEffectDelay);
      for(const [c,r] of areaKill){ if(blockEls[c]?.[r]){blockEls[c][r].remove();blockEls[c][r]=null;} }
      score+=areaKill.length*100;updateScoreUI();
    }
    // 스텝2: 타겟볼 4개 발사 (기믹 우선)
    const excluded=new Set(areaCells.map(([c,r])=>`${c},${r}`));
    excluded.add(`${c1},${r1}`);excluded.add(`${c2},${r2}`);
    const targets=[],hitInfo=[];
    for(let i=0;i<4;i++){
      const hit=getTargetBallTarget(excluded);
      if(hit){excluded.add(`${hit.pos[0]},${hit.pos[1]}`);targets.push(hit.pos);hitInfo.push(hit);}
    }
    const promises=targets.map((t,i)=>{
      const from=i<2?[cA,rA]:[cB,rB];
      return fireTargetProjectile(from[0],from[1],t[0],t[1],null);
    });
    await Promise.all(promises);
    const blockTargets=[];
    for(let i=0;i<hitInfo.length;i++){
      if(hitInfo[i].isStone) hitStone(targets[i][0],targets[i][1]);
      else {
        // 잔디 빈 셀 예외: 도착 셀 board null이면 강제 트리거 (블록 있으면 destroyCells가 처리)
        if(!board[targets[i][0]]?.[targets[i][1]]) onBlockDestroyedAt(targets[i][0],targets[i][1]);
        blockTargets.push(targets[i]);
      }
    }
    if(blockTargets.length>0) await destroyCells(blockTargets);
  }
  // ⑥ 폭탄볼 x 타겟볼: 끝점(c2,r2) 기준 범위 4칸 즉시 타격 → 타겟볼 1개 날아가서 폭탄 효과
  else if(combo==='bomb+target'){
    // 끝점(c2,r2)에서 발동, 방향=c1→c2
    const swapDir=getSwapDirection(c1,r1,c2,r2);
    await removeBoth();
    // 스텝1: 끝점 기준 범위 4칸 즉시 타격
    const areaCells=getTargetAreaCells(c2,r2,swapDir);
    const areaKill=[];
    for(const [c,r] of areaCells){
      if(c===c2&&r===r2) continue;
      if(gimmick[c]?.[r]?.type==='stone'){ hitStone(c,r); }
      else if(board[c]?.[r]){ areaKill.push([c,r]); }
    }
    if(areaKill.length>0){
      for(const [c,r] of areaKill){ if(blockEls[c][r]) blockEls[c][r].classList.add('matched'); onBlockDestroyedAt(c,r); board[c][r]=null; }
      await delay(CFG.crossEffectDelay);
      for(const [c,r] of areaKill){ if(blockEls[c]?.[r]){blockEls[c][r].remove();blockEls[c][r]=null;} }
      score+=areaKill.length*100;updateScoreUI();
    }
    // 스텝2: 타겟볼 1개 날아가서 → 도착 지점에서 폭탄 효과 발동
    const excludeSet=new Set([...areaCells.map(([c,r])=>`${c},${r}`),`${c1},${r1}`]);
    const hit=getTargetBallTarget(excludeSet);
    if(hit){
      const [rc,rr]=hit.pos;
      await fireTargetProjectile(c2,r2,rc,rr,null);
      if(hit.isStone) hitStone(rc,rr);
      else if(!board[rc]?.[rr]) onBlockDestroyedAt(rc,rr); // 잔디 빈 셀 예외
      // 도착 지점에서 폭탄 효과 발동 (기믹/블록 무관)
      showBombExplosion(rc,rr);
      const nbrs=getNeighbors(rc,rr).map(([c,r])=>[c,r]);
      if(!hit.isStone) nbrs.push([rc,rr]);
      // 폭발 범위 내 기믹 타격
      for(const [nc,nr] of nbrs){
        if(gimmick[nc]?.[nr]?.type==='stone') hitStone(nc,nr);
      }
      await destroyCells(nbrs);
    }
  }
  // ⑦ 무지개볼 x 줄볼: 순차 탐지→변환 후 동시 발동
  else if(combo==='rainbow+stripe'){
    const targetColor=getMostFrequentColor();
    await removeBoth();
    const converts=[],dirs=['up','ne','nw'];
    for(let c=0;c<COLS_PATTERN.length;c++)
      for(let r=0;r<COLS_PATTERN[c];r++)
        if(board[c][r]&&board[c][r].type==='normal'&&board[c][r].color===targetColor)
          converts.push([c,r]);
    const container=document.getElementById('grid-container');
    const convertData=[];
    // 순차 탐지 + 변환 (거미줄 연출)
    for(const [c,r] of converts){
      if(blockEls[c][r]) blockEls[c][r].classList.add('rainbow-marked');
      await delay(25);
      if(blockEls[c][r]) blockEls[c][r].classList.remove('rainbow-marked');
      const dir=dirs[Math.floor(Math.random()*dirs.length)];
      board[c][r]=makeCell(targetColor,'stripe',dir);
      convertData.push({col:c,row:r,dir});
      if(blockEls[c][r]){blockEls[c][r].remove();blockEls[c][r]=null;}
      const el=createBlockEl(c,r,board[c][r]);
      if(el){el.classList.add('stripe-appear');container.appendChild(el);blockEls[c][r]=el;}
    }
    await delay(250); // 300 → 250 (1.2x 빠르게)
    // 순차 발동: 변환된 순서대로 하나씩 발동, 겹치는 라인 stones 중첩 타격
    // 발동 간격을 1.2배 빠르게 — destroyCells 인라인하여 단축 delay 사용
    const stripeFastDelay=Math.round(CFG.crossEffectDelay/1.2);
    for(const cd of convertData){
      if(!board[cd.col]?.[cd.row]) continue; // chain으로 이미 처리된 경우 skip
      showStripeBeam(cd.col,cd.row,cd.dir);
      const lineCells=getStripeLine(cd.col,cd.row,cd.dir);
      // 라인 stones 중첩 타격 (라인별로 별도 hit)
      for(const [lc,lr] of lineCells){
        if(gimmick[lc]?.[lr]?.type==='stone') hitStone(lc,lr);
      }
      // 줄볼 자체는 직접 제거 (destroyCells에 넣으면 chainSpecials로 재발동되어 빔/stone이 2회 발생)
      if(blockEls[cd.col]?.[cd.row]) blockEls[cd.col][cd.row].classList.add('matched');
      board[cd.col][cd.row]=null;
      // 인라인 destroyCells (1.5x 단축 delay) — stone은 위에서 미리 hit했으니 제외
      const chainSpecials=[],destroyed=[];
      for(const [lc,lr] of lineCells){
        if(gimmick[lc]?.[lr]?.type==='stone') continue;
        if(!board[lc][lr]) continue;
        if(isSpecial(lc,lr)) chainSpecials.push([lc,lr,{...board[lc][lr]}]);
        destroyed.push([lc,lr]);
        if(blockEls[lc][lr]) blockEls[lc][lr].classList.add('matched');
        onBlockDestroyedAt(lc,lr);
        board[lc][lr]=null;
      }
      await delay(stripeFastDelay);
      for(const [lc,lr] of destroyed){
        if(blockEls[lc][lr]){blockEls[lc][lr].remove();blockEls[lc][lr]=null;}
      }
      // 줄볼 DOM 제거 (라인 블록 제거 시점과 동기)
      if(blockEls[cd.col]?.[cd.row]){blockEls[cd.col][cd.row].remove();blockEls[cd.col][cd.row]=null;}
      score+=(destroyed.length+1)*100; updateScoreUI();
      // 연쇄 특수블록 발동
      for(const [sc,sr,scell] of chainSpecials) await activateSpecialEffect(sc,sr,scell);
    }
  }
  // ⑧ 무지개볼 x 폭탄볼: 순차 탐지→변환 후 동시 발동
  else if(combo==='rainbow+bomb'){
    const targetColor=getMostFrequentColor();
    await removeBoth();
    const converts=[];
    for(let c=0;c<COLS_PATTERN.length;c++)
      for(let r=0;r<COLS_PATTERN[c];r++)
        if(board[c][r]&&board[c][r].type==='normal'&&board[c][r].color===targetColor)
          converts.push([c,r]);
    const container=document.getElementById('grid-container');
    // 순차 탐지 + 변환 (거미줄 연출)
    for(const [c,r] of converts){
      if(blockEls[c][r]) blockEls[c][r].classList.add('rainbow-marked');
      await delay(25);
      if(blockEls[c][r]) blockEls[c][r].classList.remove('rainbow-marked');
      board[c][r]=makeCell(targetColor,'bomb',null);
      if(blockEls[c][r]){blockEls[c][r].remove();blockEls[c][r]=null;}
      const el=createBlockEl(c,r,board[c][r]);
      if(el){el.classList.add('stripe-appear');container.appendChild(el);blockEls[c][r]=el;}
    }
    await delay(300);
    // 모든 폭탄볼 동시 발동: 7칸 범위 겹치는 stones 중첩 타격
    const allDestroy=new Set();
    for(const [c,r] of converts){
      showBombExplosion(c,r);
      allDestroy.add(`${c},${r}`);
      // 폭탄별로 stone 별도 hit (겹치면 중첩 타격), 일반 블록은 dedupe
      for(const [nc,nr] of getNeighbors(c,r)){
        if(gimmick[nc]?.[nr]?.type==='stone'){
          hitStone(nc,nr);
        } else {
          allDestroy.add(`${nc},${nr}`);
        }
      }
    }
    for(const [c,r] of converts){
      onBlockDestroyedAt(c,r);
      board[c][r]=null;
      if(blockEls[c][r]) blockEls[c][r].classList.add('matched');
    }
    await delay(CFG.crossEffectDelay);
    for(const [c,r] of converts){
      if(blockEls[c][r]){blockEls[c][r].remove();blockEls[c][r]=null;}
    }
    score+=converts.length*100;updateScoreUI();
    await destroyCells([...allDestroy].map(k=>k.split(',').map(Number)));
  }
  // ⑨ 무지개볼 x 무지개볼: 모든 블록 제거 + 보드 내 특수블록 동시 발동
  else if(combo==='rainbow+rainbow'){
    await removeBoth();

    // 1) 전체 보드 수집: 돌/특수/일반 분류 (돌은 key만 모아둠, 타격은 마킹 후)
    const hitStoneKeys=new Set();
    const initialDestroy=[];
    const rangeSpecials=[];
    for(let c=0;c<COLS_PATTERN.length;c++){
      for(let r=0;r<COLS_PATTERN[c];r++){
        if(gimmick[c]?.[r]?.type==='stone'){
          hitStoneKeys.add(`${c},${r}`);
          continue;
        }
        if(!board[c][r]) continue;
        if(isSpecial(c,r)) rangeSpecials.push([c,r,{...board[c][r]}]);
        initialDestroy.push([c,r]);
      }
    }

    // 2) 전체 마킹 연출 (기존 rainbow-marked 펄스 유지)
    for(const [c,r] of initialDestroy){
      if(blockEls[c][r]) blockEls[c][r].classList.add('rainbow-marked');
    }
    await delay(300);

    // 3) 모든 돌 기믹 타격 (key 기반, dedupe 포함)
    for(const k of hitStoneKeys){
      const [c,r]=k.split(',').map(Number);
      hitStone(c,r);
    }

    // 4) 초기 블록 제거 (board null + matched)
    for(const [c,r] of initialDestroy){
      if(blockEls[c][r]) blockEls[c][r].classList.add('matched');
      onBlockDestroyedAt(c,r);
      board[c][r]=null;
    }

    // 5) 무지개볼 공유 타겟색 사전 캡쳐 (초기 제거 후에는 보드가 비어 있을 가능성 큼 → 대개 null)
    const hasRainbowInBatch=rangeSpecials.some(([,,scell])=>scell.type==='rainbow');
    const rainbowSharedColor=hasRainbowInBatch?getMostFrequentColor():null;

    // 6) 모든 chain special 효과 계산
    const allSteps=[];
    for(const [sc,sr,scell] of rangeSpecials){
      if(scell.type==='rainbow' && rainbowSharedColor!==null){
        scell._forceTargetColor=rainbowSharedColor;
      }
      const steps=computeSpecialEffect(sc,sr,scell);
      allSteps.push(...steps);
    }

    // 7) 제거 셀 전체 dedupe
    const allDestroyedKeys=new Set(initialDestroy.map(([c,r])=>`${c},${r}`));
    for(const stepData of allSteps){
      for(const [c,r] of stepData.destroyed) allDestroyedKeys.add(`${c},${r}`);
    }

    // 8) 모든 이펙트 동시 재생
    const projectilePromises=[];
    for(const stepData of allSteps){
      for(const fx of stepData.effects){
        if(fx.type==='stripe') showStripeBeam(fx.col,fx.row,fx.dir);
        else if(fx.type==='bomb') showBombExplosion(fx.col,fx.row);
        else if(fx.type==='target-area-stone'||fx.type==='hit-stone'){
          const k=`${fx.col},${fx.row}`;
          if(!hitStoneKeys.has(k)){ hitStoneKeys.add(k); hitStone(fx.col,fx.row); }
        }
        else if(fx.type==='target'){
          const p=fireTargetProjectile(fx.fromCol,fx.fromRow,fx.toCol,fx.toRow,fx.color);
          projectilePromises.push(p);
          if(fx.isStone){
            const k=`${fx.toCol},${fx.toRow}`;
            p.then(()=>{
              if(!hitStoneKeys.has(k)){ hitStoneKeys.add(k); hitStone(fx.toCol,fx.toRow); }
            });
          }
        }
      }
    }

    // 9) 모든 파괴셀 matched 마킹
    for(const k of allDestroyedKeys){
      const [c,r]=k.split(',').map(Number);
      if(blockEls[c]?.[r]) blockEls[c][r].classList.add('matched');
    }

    // 10) 발사체 대기 + DOM 일괄 제거
    if(projectilePromises.length>0) await Promise.all(projectilePromises);
    await delay(CFG.crossEffectDelay);
    for(const k of allDestroyedKeys){
      const [c,r]=k.split(',').map(Number);
      if(blockEls[c]?.[r]){ blockEls[c][r].remove(); blockEls[c][r]=null; }
    }

    score+=allDestroyedKeys.size*100; updateScoreUI();
  }
  // ⑩ 무지개볼 x 타겟볼: 순차 탐지→변환 후 동시 발동
  else if(combo==='rainbow+target'){
    const targetColor=getMostFrequentColor();
    await removeBoth();
    const converts=[];
    for(let c=0;c<COLS_PATTERN.length;c++)
      for(let r=0;r<COLS_PATTERN[c];r++)
        if(board[c][r]&&board[c][r].type==='normal'&&board[c][r].color===targetColor)
          converts.push([c,r]);
    const container=document.getElementById('grid-container');
    // 순차 탐지 + 변환 (거미줄 연출)
    for(const [c,r] of converts){
      if(blockEls[c][r]) blockEls[c][r].classList.add('rainbow-marked');
      await delay(25);
      if(blockEls[c][r]) blockEls[c][r].classList.remove('rainbow-marked');
      board[c][r]=makeCell(targetColor,'target',null);
      if(blockEls[c][r]){blockEls[c][r].remove();blockEls[c][r]=null;}
      const el=createBlockEl(c,r,board[c][r]);
      if(el){el.classList.add('stripe-appear');container.appendChild(el);blockEls[c][r]=el;}
    }
    await delay(300);
    // 발사만 겹쳐서 진행 (변환은 위 거미줄 연출에서 순차로 끝남)
    // mid-flight redirect: 비행 중 stone이 destroyed되면 50ms 폴링으로 감지 → 즉시 방향 전환
    //                      stone 없으면 block fallback (getTargetBallTarget이 처리)
    //                      대기 없이 자연스럽게 꺾여서 날아감
    const excluded=new Set(converts.map(([c,r])=>`${c},${r}`));
    const fireTasks=[];
    const fireStagger=150; // 다음 발사까지 간격(ms)
    for(const [c,r] of converts){
      const hit=getTargetBallTarget(excluded);
      // stone은 중복 타격 허용 → excluded에 추가하지 않음 (다음 타겟볼도 같은 stone 선택 가능)
      // block은 excluded에 추가 (이미 빈 셀로 발사하는 것 회피)
      if(hit && !hit.isStone) excluded.add(`${hit.pos[0]},${hit.pos[1]}`);
      // 재지향 시 새 타겟 선택 + excluded 갱신을 묶은 헬퍼
      const getNextTarget=()=>{
        const next=getTargetBallTarget(excluded);
        if(next && !next.isStone) excluded.add(`${next.pos[0]},${next.pos[1]}`);
        return next;
      };
      // 비동기 태스크: mid-flight redirect 발사 + 도착 hit 처리 + 타겟볼 자체 제거
      const task=(async()=>{
        const finalHit=hit ? await fireTargetProjectileWithRedirect(c,r,hit,targetColor,getNextTarget) : null;
        if(finalHit){
          if(finalHit.isStone){
            // 도착 시점 stone 유효성 확인 (마지막 50ms 사이에 죽었을 가능성)
            if(gimmick[finalHit.pos[0]]?.[finalHit.pos[1]]?.type==='stone') hitStone(finalHit.pos[0],finalHit.pos[1]);
          } else {
            // 잔디 트리거 (빈 셀이어도 — 잔디 빈 셀 예외)
            onBlockDestroyedAt(finalHit.pos[0],finalHit.pos[1]);
            if(board[finalHit.pos[0]]?.[finalHit.pos[1]]){
              if(blockEls[finalHit.pos[0]]?.[finalHit.pos[1]]) blockEls[finalHit.pos[0]][finalHit.pos[1]].classList.add('matched');
              board[finalHit.pos[0]][finalHit.pos[1]]=null;
              score+=100; updateScoreUI();
              await delay(CFG.specialActivateDelay);
              if(blockEls[finalHit.pos[0]]?.[finalHit.pos[1]]){blockEls[finalHit.pos[0]][finalHit.pos[1]].remove();blockEls[finalHit.pos[0]][finalHit.pos[1]]=null;}
            }
          }
        }
        // 타겟볼 자체 제거
        if(blockEls[c]?.[r]) blockEls[c][r].classList.add('matched');
        onBlockDestroyedAt(c,r);
        board[c][r]=null;
        score+=100; updateScoreUI();
        await delay(CFG.crossEffectDelay);
        if(blockEls[c]?.[r]){blockEls[c][r].remove();blockEls[c][r]=null;}
      })();
      fireTasks.push(task);
      await delay(fireStagger);
    }
    await Promise.all(fireTasks);
  }
  // 교차효과 로그
  const crossLabel={
    'stripe+stripe':'줄볼x줄볼','bomb+stripe':'폭탄x줄볼','bomb+bomb':'폭탄x폭탄',
    'stripe+target':'줄볼x타겟','target+target':'타겟x타겟','bomb+target':'폭탄x타겟',
    'rainbow+stripe':'무지개x줄볼','rainbow+bomb':'무지개x폭탄',
    'rainbow+rainbow':'무지개x무지개','rainbow+target':'무지개x타겟',
  };
  addMatchLog(0,crossLabel[combo]||combo,-1);

  if(hasRainbow) isBusyRainbow=false;
}
