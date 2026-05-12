// ── 헥사 3매치 퍼즐: DOM 애니메이션 ──
// config/grid/board/match/special/gravity 다음, game.js 이전 로드
// 특수블록 연출(beam/explosion/projectile), 낙하/충전 애니메이션은 이미 special.js/gravity.js에 있음
// 여기서는 블록 swap, 점수/콤보 팝업, 힌트 표시 같은 일반 DOM 트랜지션만 담당

// ── 블록 swap 애니메이션 (Phase 2 atomic) ──
// 시작 시점에 blockEls + dataset 즉시 swap (sync) → 220ms 사이 다른 흐름 race 차단.
// CSS transition은 시각 효과만 진행. 220ms 후 cleanup만.
async function animateSwap(c1,r1,c2,r2){
  const el1=blockEls[c1]?.[r1],el2=blockEls[c2]?.[r2];
  if(!el1||!el2) return;
  const pre1=el1.style.transition, pre2=el2.style.transition;
  const p1=getBlockPos(c1,r1),p2=getBlockPos(c2,r2);
  const adj=BLOCK_D*((CFG.blockScale||1.0)-1)/2;
  // PRE-TRANS 강제 안착 — fill/gravity 중간 위치에서 셀 위치로 점프 → swap이 깔끔한 시작
  if(pre1 || pre2){
    el1.style.transition='none';
    el1.style.left=`${p1.x-adj}px`;
    el1.style.top=`${p1.y-adj}px`;
    el2.style.transition='none';
    el2.style.left=`${p2.x-adj}px`;
    el2.style.top=`${p2.y-adj}px`;
    el1.offsetHeight; el2.offsetHeight; // reflow
  }
  // ★ ATOMIC SWAP — blockEls + dataset 즉시 sync swap.
  // 다른 흐름이 보는 blockEls는 즉시 swap 상태. 220ms race 시점 0.
  blockEls[c1][r1]=el2;
  blockEls[c2][r2]=el1;
  el1.dataset.col=c2; el1.dataset.row=r2;
  el2.dataset.col=c1; el2.dataset.row=r1;
  // CSS transition은 시각 효과만 — element 위치 이동
  const swapT=0.2/gameSpeed;
  el1.style.transition=`left ${swapT}s ease,top ${swapT}s ease`;
  el2.style.transition=`left ${swapT}s ease,top ${swapT}s ease`;
  el1.style.zIndex='3'; el2.style.zIndex='3';
  el1.style.left=`${p2.x-adj}px`; el1.style.top=`${p2.y-adj}px`;
  el2.style.left=`${p1.x-adj}px`; el2.style.top=`${p1.y-adj}px`;
  await skippableDelay(220);
  // 220ms 후: transition / zIndex cleanup만. blockEls는 이미 swap됨.
  el1.style.zIndex=''; el2.style.zIndex='';
  el1.style.transition=''; el2.style.transition='';
}

// ── 점수 팝업 ──
function showScorePopup(x,y,pts){
  const container=document.getElementById('grid-container');
  const p=document.createElement('div');p.className='score-popup';
  p.textContent=`+${pts}`;p.style.left=`${x}px`;p.style.top=`${y}px`;
  container.appendChild(p);setTimeout(()=>p.remove(),800);
}

// ── 콤보 메시지/스타일 (텍스트/색상 선택) ──
function getComboMessage(combo){
  if(combo===2) return '시작이 좋은데!';
  if(combo===3) return '감이 왔어!';
  if(combo===4) return '진화할 흐름!';
  return '전설급 콤보다!';
}

function getComboStyle(combo){
  if(combo===2) return { bg:'#3498db', size:'36px' };
  if(combo===3) return { bg:'#9b59b6', size:'40px' };
  if(combo===4) return { bg:'#e67e22', size:'44px' };
  // 5콤보 이상: 핑크 / 민트 / 시안 중 랜덤
  const colors=['#FF6B9D','#00D4AA','#00CFFF'];
  return { bg:colors[Math.floor(Math.random()*colors.length)], size:'48px' };
}

// ── 콤보 표시 (화면 중앙 텍스트 + 보너스 점수 팝업) ──
function showCombo(combo,bonus){
  const el=document.getElementById('combo-display');
  const msg=getComboMessage(combo);
  const style=getComboStyle(combo);
  el.innerHTML=`<div class="combo-line combo-count">${combo}&nbsp;COMBO!</div><div class="combo-line combo-msg">${msg}</div>`;
  el.style.fontSize=style.size;
  el.style.color=style.bg;
  el.style.textShadow=`0 4px 0 rgba(0,0,0,0.5)`;
  el.style.background='transparent';
  el.style.border='none';
  el.style.padding='0';
  // 콤보별 기울기 강조 (높을수록 강하게 — 2→-6deg, 3→-8deg, 4→-10deg, 5+→-12deg)
  const rotateDeg = combo<=2 ? -6 : combo<=3 ? -8 : combo<=4 ? -10 : -12;
  el.style.setProperty('--combo-rotate', `${rotateDeg}deg`);
  el.classList.remove('hidden','show','hide');
  el.offsetHeight; // reflow
  el.classList.add('show');
  if(el._comboTimer){ clearTimeout(el._comboTimer); }
  el._comboTimer=setTimeout(()=>{
    el.classList.add('hide');
    el._comboTimer=setTimeout(()=>{ el.classList.remove('show','hide'); },500);
  },2000);

  if(bonus>0){
    const container=document.getElementById('grid-container');
    const cx=container.offsetWidth/2-30,cy=container.offsetHeight/2+30;
    const p=document.createElement('div');p.className='score-popup combo-bonus';
    p.textContent=`COMBO +${bonus}`;p.style.left=`${cx}px`;p.style.top=`${cy}px`;
    container.appendChild(p);setTimeout(()=>p.remove(),800);
  }
}

// ── 힌트 표시 (CSS class 토글) ──
// hintTimer, hintedCells는 game.js 전역 상태 참조
function clearHint(){
  if(hintTimer){clearTimeout(hintTimer);hintTimer=null;}
  for(const {col,row} of hintedCells) if(blockEls[col]?.[row]) blockEls[col][row].classList.remove('hint');
  hintedCells=[];
}
function showHint(c1,r1,c2,r2){
  hintedCells=[{col:c1,row:r1},{col:c2,row:r2}];
  for(const {col,row} of hintedCells) if(blockEls[col]?.[row]) blockEls[col][row].classList.add('hint');
}
