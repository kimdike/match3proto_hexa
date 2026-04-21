// ── 헥사 3매치 퍼즐: DOM 애니메이션 ──
// config/grid/board/match/special/gravity 다음, game.js 이전 로드
// 특수블록 연출(beam/explosion/projectile), 낙하/충전 애니메이션은 이미 special.js/gravity.js에 있음
// 여기서는 블록 swap, 점수/콤보 팝업, 힌트 표시 같은 일반 DOM 트랜지션만 담당

// ── 블록 swap 애니메이션 ──
async function animateSwap(c1,r1,c2,r2){
  const el1=blockEls[c1]?.[r1],el2=blockEls[c2]?.[r2];
  if(!el1||!el2) return;
  const p1=getBlockPos(c1,r1),p2=getBlockPos(c2,r2);
  const adj=BLOCK_D*((CFG.blockScale||1.0)-1)/2;
  const swapT=0.2/gameSpeed;
  el1.style.transition=`left ${swapT}s ease,top ${swapT}s ease`;
  el2.style.transition=`left ${swapT}s ease,top ${swapT}s ease`;
  el1.style.zIndex='3';el2.style.zIndex='3';
  el1.style.left=`${p2.x-adj}px`;el1.style.top=`${p2.y-adj}px`;
  el2.style.left=`${p1.x-adj}px`;el2.style.top=`${p1.y-adj}px`;
  await skippableDelay(220);
  el1.style.zIndex='';el2.style.zIndex='';
  el1.style.transition='';el2.style.transition='';
  el1.dataset.col=c2;el1.dataset.row=r2;
  el2.dataset.col=c1;el2.dataset.row=r1;
  blockEls[c1][r1]=el2;blockEls[c2][r2]=el1;
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
  if(combo===2) return '굿!';
  if(combo===3) return '어-썸!';
  if(combo===4) return '쩌는 콤보!';
  const texts=['오지고 지리고 렛잇고!','연쇄 덕좀 보시네예!','고득점 가즈아!'];
  return texts[Math.floor(Math.random()*texts.length)];
}

function getComboStyle(combo){
  if(combo===2) return { bg:'#3498db', size:'30px' };
  if(combo===3) return { bg:'#9b59b6', size:'36px' };
  if(combo===4) return { bg:'#e67e22', size:'42px' };
  return { bg:'#f1c40f', size:'48px' };
}

// ── 콤보 표시 (화면 중앙 텍스트 + 보너스 점수 팝업) ──
function showCombo(combo,bonus){
  const el=document.getElementById('combo-display');
  const msg=getComboMessage(combo);
  const style=getComboStyle(combo);
  el.innerHTML=`<div class="combo-line combo-count">${combo} COMBO!</div><div class="combo-line combo-msg">${msg}</div>`;
  el.style.fontSize=style.size;
  el.style.color=style.bg;
  el.style.textShadow=`0 0 12px ${style.bg}, 0 0 20px ${style.bg}, 0 0 30px rgba(255,255,255,0.8)`;
  el.style.background='transparent';
  el.style.border='none';
  el.style.padding='0';
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
