// ── 헥사 3매치 퍼즐: UI (HUD/화면전환/개발자모드/스킨/테마) ──
// config/grid/board/match/special/gravity/animation 다음, game.js 이전 로드

// ── UI 상태 ──
const matchLogs=[]; // 개발자 패널 매치 로그 버퍼
let devUnlocked=false, devPanelOpen=false;
let skinEditingSlot=-1; // -1: 슬롯 미선택
let lastCleared=false;   // showEndScreen에서 설정됨 (현재 read 사용처 없음)

// ── 포켓몬 스프라이트 배경 ──
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

// ── 매치 로그 (개발자 패널) ──
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

// ── HUD ──
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

function updateHighScoreUI(){document.getElementById('high-score-value').textContent=highScore.toLocaleString();}
function updateScoreUI(){document.getElementById('score-value').textContent=score.toLocaleString();}
function updateMovesUI(){
  const el=document.getElementById('moves-value');
  el.textContent=movesLeft;el.classList.toggle('low',movesLeft<=5);
}

// ── 게임 종료/확인 오버레이 ──
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

// ── 테마 토글 ──
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

// ── 메인 UI 이벤트 연결 ──
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

// ── 개발자 모드: 특수블록 배치 ──
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

// ── 개발자 모드 패널 셋업 ──
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

// ── 인스펙터 초기화 확인 팝업 ──
function showInspConfirm(onConfirm){
  const overlay=document.getElementById('insp-confirm-overlay');
  overlay.classList.remove('hidden');
  const yesBtn=document.getElementById('insp-confirm-yes');
  const noBtn=document.getElementById('insp-confirm-no');
  function cleanup(){overlay.classList.add('hidden');yesBtn.replaceWith(yesBtn.cloneNode(true));noBtn.replaceWith(noBtn.cloneNode(true));}
  document.getElementById('insp-confirm-yes').addEventListener('click',()=>{cleanup();onConfirm();});
  document.getElementById('insp-confirm-no').addEventListener('click',cleanup);
}

// ── 인스펙터 UI 빌드 ──
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
