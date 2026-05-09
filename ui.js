// ── 헥사 3매치 퍼즐: UI (HUD/화면전환/개발자모드/스킨/테마) ──
// config/grid/board/match/special/gravity/animation 다음, game.js 이전 로드

// ── UI 상태 ──
const matchLogs=[]; // 개발자 패널 매치 로그 버퍼
let devUnlocked=false, devPanelOpen=false;
let skinEditingSlot=-1; // -1: 슬롯 미선택

// ── 배치 도구 상태 (슬라이드 패널) ──
let debugPlaceDir=null;                 // 줄볼 방향: 'up'|'se'|'ne'
let placementGimmickType=null;          // null | {type:'stone',level:N} | {type:'clear'}
let placementCoordVisible=false;

// ── 골드 시스템 ──
let currentGold=parseInt(localStorage.getItem('hexPuzzleGold'))||0;
function loadGold(){
  currentGold=parseInt(localStorage.getItem('hexPuzzleGold'))||0;
  return currentGold;
}
function saveGold(){
  localStorage.setItem('hexPuzzleGold',currentGold);
}
function addGold(amount){
  currentGold+=amount;
  saveGold();
  updateLobbyGoldUI();
  updateDevGoldUI();
}
function updateLobbyGoldUI(){
  const el=document.getElementById('lobby-gold-num');
  if(el) el.textContent=currentGold.toLocaleString();
}
function updateDevGoldUI(){
  const el=document.getElementById('dev-gold-num');
  if(el) el.textContent=currentGold.toLocaleString();
}

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
  // 처음부터 미션 자체가 없는 스테이지(점수 모드 등)는 카드 숨김
  if(initialStones<=0){
    el.classList.add('hidden');
    return;
  }
  // 미션 있는 스테이지: 카드 항상 표시 (남은 개수 또는 클리어 ✅)
  el.classList.remove('hidden');
  const countEl=document.getElementById('mission-count');
  if(totalStones>0){
    countEl.textContent=totalStones;
    countEl.classList.remove('mission-cleared');
  } else {
    countEl.textContent='✅';
    countEl.classList.add('mission-cleared');
  }
}

// high-score / score 표시 제거됨 — DOM 엘리먼트 없을 수 있으므로 null 가드
function updateHighScoreUI(){const el=document.getElementById('high-score-value');if(el) el.textContent=highScore.toLocaleString();}
function updateScoreUI(){const el=document.getElementById('score-value');if(el) el.textContent=score.toLocaleString();}
function updateMovesUI(){
  const el=document.getElementById('moves-value');
  el.textContent=movesLeft;el.classList.toggle('low',movesLeft<=5);
}

// ── 게임 종료/확인 오버레이 ──
function showEndScreen(cleared){
  const o=document.getElementById('end-overlay');
  const icon=document.getElementById('end-icon');
  const title=document.getElementById('end-title');
  const sc=document.getElementById('end-score');
  const det=document.getElementById('end-detail');
  // 천장 게이지 위젯 — 기본 숨김 (클리어 분기에서 노출)
  const pityWidget=document.getElementById('end-pity-gauge');
  if(pityWidget) pityWidget.classList.add('hidden');
  if(cleared){
    icon.textContent='\uD83C\uDF89';title.textContent='\uD074\uB9AC\uC5B4!';title.className='clear';
    det.textContent=`Stage ${currentStage} \uD074\uB9AC\uC5B4! \uB3CC \uC804\uBD80 \uC81C\uAC70!`;
    // \uACE8\uB4DC \uBCF4\uC0C1 = \uAE30\uBCF8 300 + \uB0A8\uC740 \uD134 \u00D7 5
    const goldReward=300+Math.max(0,movesLeft)*5;
    addGold(goldReward);
    sc.textContent=`\uD83E\uDE99 +${goldReward.toLocaleString()} \uACE8\uB4DC \uD68D\uB4DD!`;
    sc.classList.remove('hidden');
    // 다음 스테이지 해금
    if(currentStage<TOTAL_STAGES){
      currentStage++;
      localStorage.setItem('hexPuzzleStage',currentStage);
    }
    // 천장 게이지 판정 + 위젯 갱신 (조우 분기는 stub)
    if(typeof rollEncounter==='function'){
      const result=rollEncounter('main');
      renderEndPityGauge(result);
    }
  }else{
    icon.textContent='\uD83D\uDE22';title.textContent='\uC2E4\uD328...';title.className='fail';
    det.textContent=`\uB0A8\uC740 \uB3CC ${totalStones}\uAC1C / Move \uC18C\uC9C4`;
    sc.textContent=''; // \uC2E4\uD328 \uC2DC \uACE8\uB4DC \uC9C0\uAE09 \uC5C6\uC74C
  }

  // 최고 점수 갱신 체크
  const newRec=document.getElementById('new-record');
  newRec.classList.add('hidden'); // \uC810\uC218 \uC2DC\uC2A4\uD15C \uC81C\uAC70 \u2014 \uC2E0\uAE30\uB85D \uC0AC\uC6A9 \uC548 \uD568

  // 버튼 텍스트 변경
  document.getElementById('restart-btn').textContent='\uB85C\uBE44\uB85C \uB3CC\uC544\uAC00\uAE30';
  o.classList.remove('hidden');
}
function hideEndScreen(){document.getElementById('end-overlay').classList.add('hidden');}

// 클리어 화면 천장 게이지 위젯 갱신
//   result = { encountered, justFilled, before, after }
//   - 전 단계 게이지(before)부터 시작 → after로 한 칸 채우는 애니메이션
//   - encountered: 5/5 → 0 리셋, "조우 발동!" 힌트
//   - justFilled:  N/5 → 5/5 도달, "다음 클리어 = 무조건 조우!" 힌트
function renderEndPityGauge(result){
  const widget=document.getElementById('end-pity-gauge');
  const numEl=document.getElementById('end-pity-num');
  const hintEl=document.getElementById('end-pity-hint');
  if(!widget||!numEl) return;
  widget.classList.remove('hidden','full','encountered');
  applyPityTicks(result.before);
  numEl.textContent=result.before;
  if(hintEl) hintEl.textContent='';
  // 0.6s 후 갱신 — 클리어 메시지가 먼저 보이고 게이지가 차오르는 텀
  setTimeout(()=>{
    if(result.encountered){
      widget.classList.add('encountered');
      if(hintEl) hintEl.textContent='🎯 조우 발동! (다음 세션에서 구현)';
      applyPityTicks(result.after);
      numEl.textContent=result.after;
    } else {
      applyPityTicks(result.after);
      numEl.textContent=result.after;
      if(result.justFilled){
        widget.classList.add('full');
        if(hintEl) hintEl.textContent='✨ 천장 도달! 다음 클리어 = 무조건 조우';
      }
    }
    // 로비 배지도 동기화 (다음 로비 진입 시 반영용)
    if(typeof updateLobbyStreakUI==='function') updateLobbyStreakUI();
  },600);
}
function applyPityTicks(value){
  document.querySelectorAll('#end-pity-gauge .end-pity-tick').forEach(el=>{
    const t=parseInt(el.dataset.tick,10);
    el.classList.toggle('on',t<=value);
  });
}
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
  loadSfx(); // 효과음 프리로드
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
  // 재도전 버튼: 같은 스테이지 다시 시작 (실패 시에만 노출됨)
  const _retryBtn=document.getElementById('retry-btn');
  if(_retryBtn) _retryBtn.addEventListener('click',()=>{
    playSfx('btn_click');
    hideEndScreen();
    startGame();
  });
  document.getElementById('stop-btn').addEventListener('click',()=>{if(playing){playSfx('btn_click');showConfirm();}});
  document.getElementById('confirm-yes').addEventListener('click',()=>resetToStart());
  document.getElementById('confirm-no').addEventListener('click',()=>hideConfirm());
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.addEventListener('keydown', (e) => {
    const mouseCell = getCellFromMouse();
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (!mouseCell) return;
    if (!playing) return;
    if (busy) return;
    hoveredCell = mouseCell;
    removeBlockAt(mouseCell.col, mouseCell.row).catch(err => console.error('removeBlockAt error', err));
  });
}

// ── 개발자 모드: 특수블록 배치 ──
function placeDebugSpecial(col,row){
  if(!board[col]||!board[col][row]) return;
  const oldCell=board[col][row];
  const color=debugPlaceType==='rainbow'?null:oldCell.color;
  const dir=debugPlaceType==='stripe'?(debugPlaceDir||'up'):null;
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

  const devPanel=document.getElementById('dev-panel');
  function openDevPanel(){
    devPanelOpen=true;
    devPanel.classList.remove('hidden');
    devBtn.classList.add('active');
    updateDevGoldUI(); // 패널 열 때 최신 골드 반영
  }
  function closeDevPanel(){
    devPanelOpen=false;
    devPanel.classList.add('hidden');
    devBtn.classList.remove('active');
  }

  devBtn.addEventListener('click',()=>{
    if(devUnlocked){
      devPanelOpen?closeDevPanel():openDevPanel();
    }else{
      pwOverlay.classList.remove('hidden');
      pwInput.value='';pwError.classList.add('hidden');
      pwInput.focus();
    }
  });

  // 로비 dev 버튼 — 인증만 처리 (인게임 dev 패널은 인게임에서만 열림)
  const lobbyDevBtn=document.getElementById('lobby-dev-btn');
  if(lobbyDevBtn) lobbyDevBtn.addEventListener('click',()=>{
    if(devUnlocked){
      // 이미 인증된 상태 — 토글: 비활성화 (도감 즉시잡기 등 dev 기능 끄기)
      devUnlocked=false;
      const placeTab=document.getElementById('placement-tab');
      if(placeTab) placeTab.classList.add('hidden');
      lobbyDevBtn.classList.remove('active');
    } else {
      pwOverlay.classList.remove('hidden');
      pwInput.value='';pwError.classList.add('hidden');
      pwInput.focus();
    }
  });

  // 백드롭(카드 바깥) 클릭으로 닫기
  devPanel.addEventListener('click',e=>{
    if(e.target===devPanel) closeDevPanel();
  });
  document.getElementById('dev-panel-close').addEventListener('click',closeDevPanel);

  function tryPassword(){
    if(pwInput.value.toLowerCase()===DEV_PASSWORD){
      devUnlocked=true;
      pwOverlay.classList.add('hidden');
      // 배치 도구 탭 노출
      const placeTab=document.getElementById('placement-tab');
      if(placeTab) placeTab.classList.remove('hidden');
      // 로비 dev 버튼 활성 표시
      const lobbyBtn=document.getElementById('lobby-dev-btn');
      if(lobbyBtn) lobbyBtn.classList.add('active');
      // 인게임 화면일 때만 패널 자동 오픈 (로비/도감에선 인증만)
      const gc=document.getElementById('game-container');
      const inGame=gc&&!gc.classList.contains('hidden');
      if(inGame) openDevPanel();
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

  // 스테이지 이동 치트
  const stageInput=document.getElementById('dev-stage-input');
  const stageMsg=document.getElementById('dev-stage-msg');
  document.getElementById('dev-stage-go').addEventListener('click',()=>{
    const num=parseInt(stageInput.value);
    if(isNaN(num)||num<1||num>TOTAL_STAGES){
      stageMsg.textContent=`1~${TOTAL_STAGES} 사이 숫자를 입력하세요`;
      stageMsg.classList.remove('hidden');
      return;
    }
    stageMsg.classList.add('hidden');
    currentStage=num;
    localStorage.setItem('hexPuzzleStage',currentStage);
    resetToStart();
  });

  // 골드 +1000 (테스트용)
  const goldAddBtn=document.getElementById('dev-gold-add');
  if(goldAddBtn) goldAddBtn.addEventListener('click',()=>addGold(1000));

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
  const groups={speed:'⚡ 속도',timing:'✨ 연출 타이밍',score:'🎯 점수',visual:'🎨 비주얼'};
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
        if(grp==='visual') applyBlockScale();
      });
    });
  });
  // 값 변경 이벤트
  container.addEventListener('input',e=>{
    if(!e.target.classList.contains('insp-input')) return;
    const key=e.target.dataset.key;
    const val=parseFloat(e.target.value);
    if(!isNaN(val)&&key in CFG){
      CFG[key]=val;
      if(key==='blockScale') applyBlockScale();
    }
  });
  // 툴팁 위치 (fixed 기반)
  // ⚠️ #game-container에 transform: scale()이 걸려 있어 그 안의 fixed는 뷰포트 기준이 아닌
  //   컨테이너 기준이 됨. 툴팁을 body 직속으로 빼서 transform 영향 회피.
  container.querySelectorAll('.insp-help').forEach(btn=>{
    const tip=btn.querySelector('.insp-tooltip');
    if(!tip) return;
    if(tip.parentNode!==document.body) document.body.appendChild(tip);
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
// 390×844 모바일 프레임 + 내부 그리드 각각 scale 계산
const FRAME_W=390, FRAME_H=844;
const FRAME_SCREEN_IDS=['main-screen','character-select-screen','nickname-screen','intro-screen','lobby-screen','game-container'];

function resizeGrid(){
  const gameContainer=document.getElementById('game-container');
  const container=document.getElementById('grid-container');
  const wrapper=document.getElementById('grid-wrapper');

  // 1) 그리드 scale: 9열 전체가 잘림 없이 390 프레임 너비에 꽉 차도록
  //    상단 HUD(120px + 캐릭터 돌출 10px) + 하단 STOP 영역(~130px) 제외한 공간 활용
  const totalW=(COLS_PATTERN.length-1)*COL_SPACING+HEX_W;
  const totalH=9*ROW_SPACING+HEX_H*0.5;
  const gridAvailW=FRAME_W;        // 전체 폭 활용
  const gridAvailH=FRAME_H-260;    // 상단 확장 HUD + 하단 STOP/버튼 영역
  const gridScale=Math.min(gridAvailW/totalW, gridAvailH/totalH, 1);
  container.style.transform=`scale(${gridScale})`;
  container.style.transformOrigin='top center';
  container.style.width=`${totalW}px`;
  container.style.height=`${totalH}px`;
  wrapper.style.minHeight=`${totalH*gridScale}px`;

  // 2) 프레임 scale: 390×844 박스를 뷰포트에 맞춤 (작을 때만 축소, 큰 화면에서는 1배 유지)
  const frameScale=Math.min(window.innerWidth/FRAME_W, window.innerHeight/FRAME_H, 1);
  gameContainer.style.transform=`scale(${frameScale})`;
  gameContainer.style.transformOrigin='center center';

  // 그 외 프레임 기반 화면들(메인/캐릭터 선택/닉네임/로비)도 동일 스케일
  FRAME_SCREEN_IDS.forEach(id=>{
    if(id==='game-container') return;
    const el=document.getElementById(id);
    if(el){
      el.style.transform=`scale(${frameScale})`;
      el.style.transformOrigin='center center';
    }
  });
}

// ── 화면 전환 ──
function showScreen(id){
  ['main-screen','character-select-screen','nickname-screen','intro-screen','lobby-screen','skin-screen','dex-screen','game-container'].forEach(s=>{
    const el=document.getElementById(s);
    if(el) el.classList.add('hidden');
  });
  document.getElementById(id).classList.remove('hidden');
  if(id==='game-container'){
    resizeGrid();
    updateHudCharacter();
  }
  // 로비 풀밭 워크 진입/이탈
  if(id==='lobby-screen'){
    // DOM 레이아웃 안정화 후 시작 (clientWidth/Height 0 회피)
    requestAnimationFrame(()=>startLobbyMeadow());
  } else {
    stopLobbyMeadow();
  }
  // 화면별 BGM 자동 교체 (SCREEN_BGM 매핑 기반)
  switchBgmForScreen(id);
}

// ── 인게임 HUD 중앙 캐릭터 (로비/닉네임과 동일 이미지) ──
function updateHudCharacter(){
  const img=document.getElementById('hud-character-img');
  if(!img) return;
  const p=loadPlayerProfile();
  if(p.character){
    img.src=getCharacterImgPath(p.character);
  }
}

// ── 플레이어 프로필 (localStorage) ──
function loadPlayerProfile(){
  return {
    name: localStorage.getItem('hexPuzzlePlayerName')||'',
    character: localStorage.getItem('hexPuzzlePlayerCharacter')||'',
  };
}
function savePlayerProfile(name,character){
  localStorage.setItem('hexPuzzlePlayerName',name);
  localStorage.setItem('hexPuzzlePlayerCharacter',character);
}
function hasPlayerProfile(){
  const p=loadPlayerProfile();
  return !!(p.name&&(p.character==='man'||p.character==='woman'));
}
function getCharacterImgPath(character){
  return character==='woman'?'assets/character_woman.png':'assets/character_man.png';
}

function updateLobbyStage(){
  const stageBtn=document.getElementById('lobby-stage-btn');
  const numEl=document.getElementById('lobby-stage-num');
  const regionLabel=document.getElementById('lobby-region-label');
  if(currentStage>TOTAL_STAGES){
    // 모든 지역 정복
    if(stageBtn) stageBtn.style.display='none';
    let allClear=document.querySelector('.lobby-all-clear');
    if(!allClear&&stageBtn){
      allClear=document.createElement('div');
      allClear.className='lobby-all-clear';
      allClear.textContent='모든 지역 정복!';
      stageBtn.parentNode.insertBefore(allClear,stageBtn);
    }
    if(regionLabel) regionLabel.textContent='KANTO LEAGUE';
  } else {
    if(stageBtn) stageBtn.style.display='';
    const allClear=document.querySelector('.lobby-all-clear');
    if(allClear) allClear.remove();
    if(numEl) numEl.textContent=currentStage;
    if(regionLabel){
      const r=getRegionByStage(currentStage);
      regionLabel.textContent=r?`${r.name_ko} ${r.stageInRegion}/${STAGES_PER_REGION}`:'KANTO LEAGUE';
    }
  }
}

// ── 로비 프로필 적용 (상단 뱃지) ──
function updateLobbyProfile(){
  const p=loadPlayerProfile();
  const nameEl=document.getElementById('lobby-player-name');
  const profileImg=document.getElementById('lobby-profile-img');
  if(nameEl) nameEl.textContent=p.name||'Player';
  if(p.character){
    const path=getCharacterImgPath(p.character);
    if(profileImg) profileImg.src=path;
  }
  // 메타 배지(골드/다이아/천장) 갱신
  loadGold();
  updateLobbyGoldUI();
  updateLobbyDiamondUI();
  updateLobbyStreakUI();
  updateLobbySkinBadge();
}

// ── 다이아 (UI 노출만, 실제 동작은 다음 세션) ──
function loadDiamond(){
  const v=Number(localStorage.getItem('hexPuzzleDiamond')||0);
  return Number.isFinite(v)?v:0;
}
function saveDiamond(n){ localStorage.setItem('hexPuzzleDiamond',String(n|0)); }
function updateLobbyDiamondUI(){
  const el=document.getElementById('lobby-diamond-num');
  if(el) el.textContent=loadDiamond();
}

// ── 로비 🎨 스킨 버튼 레드닷 (신규 해금 미확인 알림) ──
function updateLobbySkinBadge(){
  const btn=document.querySelector('.lobby-menu-btn[data-target="skin"]');
  if(!btn) return;
  const has=(typeof getSkinNewCount==='function')&&getSkinNewCount()>0;
  btn.classList.toggle('has-new',has);
}

// ── 조우 천장 게이지 (pity.js 연동) ──
function updateLobbyStreakUI(){
  const el=document.getElementById('lobby-streak-num');
  const card=document.querySelector('.lobby-meta-streak');
  if(typeof getPity!=='function') return;
  const v=getPity('main');
  if(el) el.textContent=v;
  // 5/5 도달 시 카드에 full 클래스 → 펄스 이펙트로 "다음 클리어 = 무조건 조우" 시각 신호
  if(card) card.classList.toggle('is-full',v>=PITY_THRESHOLD);
}

// 로비 풀밭/트레이너/오라/인트로 모듈은 lobby.js로 분리됨.
// 진입/이탈 훅은 showScreen에서 startLobbyMeadow/stopLobbyMeadow를 호출.

// ── 캐릭터 선택 화면 ──
let selectedCharacter=null;
function setupCharacterSelect(){
  const cards=document.querySelectorAll('.cs-card');
  const confirmBtn=document.getElementById('cs-confirm-btn');
  if(!confirmBtn) return;
  cards.forEach(card=>{
    card.addEventListener('click',()=>{
      cards.forEach(c=>c.classList.remove('selected'));
      card.classList.add('selected');
      selectedCharacter=card.dataset.character;
      confirmBtn.disabled=false;
    });
  });
  confirmBtn.addEventListener('click',()=>{
    if(!selectedCharacter) return;
    playSfx('btn_click');
    const nnImg=document.getElementById('nn-character-img');
    if(nnImg) nnImg.src=getCharacterImgPath(selectedCharacter);
    showScreen('nickname-screen');
    const input=document.getElementById('nn-input');
    setTimeout(()=>input?.focus(),50); // 화면 전환 후 포커스
  });
}
function resetCharacterSelectUI(){
  selectedCharacter=null;
  document.querySelectorAll('.cs-card').forEach(c=>c.classList.remove('selected'));
  const confirmBtn=document.getElementById('cs-confirm-btn');
  if(confirmBtn) confirmBtn.disabled=true;
}

// ── 닉네임 입력 화면 ──
function setupNicknameScreen(){
  const input=document.getElementById('nn-input');
  const counter=document.getElementById('nn-counter-num');
  const confirmBtn=document.getElementById('nn-confirm-btn');
  const backBtn=document.getElementById('nn-back-btn');
  if(!input||!confirmBtn) return;

  function updateCounter(){
    const len=input.value.length;
    if(counter) counter.textContent=len;
    confirmBtn.disabled=input.value.trim().length===0;
  }
  function confirmNickname(){
    const name=input.value.trim();
    if(!name||!selectedCharacter) return;
    playSfx('btn_click');
    savePlayerProfile(name,selectedCharacter);
    updateLobbyProfile();
    // 인트로 미완료면 오박사 인트로, 완료면 바로 로비
    if(localStorage.getItem('hexPuzzleIntroDone')!=='1'&&typeof runIntroSequence==='function'){
      showScreen('intro-screen');
      runIntroSequence();
    } else {
      showScreen('lobby-screen');
      updateLobbyStage();
    }
  }

  input.addEventListener('input',updateCounter);
  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!confirmBtn.disabled) confirmNickname();
  });
  confirmBtn.addEventListener('click',confirmNickname);
  if(backBtn){
    backBtn.addEventListener('click',()=>{
      showScreen('character-select-screen');
    });
  }
}
function resetNicknameUI(){
  const input=document.getElementById('nn-input');
  const counter=document.getElementById('nn-counter-num');
  const confirmBtn=document.getElementById('nn-confirm-btn');
  if(input) input.value='';
  if(counter) counter.textContent='0';
  if(confirmBtn) confirmBtn.disabled=true;
}

// ── 효과음 시스템 (Web Audio API, BGM과 독립) ──
// fetch → decodeAudioData로 AudioBuffer를 메모리에 올려두고,
// 재생 시 createBufferSource로 즉시 트리거 (첫 재생 딜레이 최소화 + 중첩 재생 자연 지원).
const SFX_VOLUME=0.5;
const SFX_FILES={
  match_pop:   'assets/sfx/sfx_match_pop.wav',
  stone_hit:   'assets/sfx/sfx_stone_hit.wav',
  stone_break: 'assets/sfx/sfx_stone_break.wav',
  btn_click:   'assets/sfx/sfx_btn_click.wav',
  select:      'assets/sfx/sfx_select.wav',
  swap:        'assets/sfx/sfx_swap.wav',
};
const sfxBuffers={}; // name → AudioBuffer
let sfxCtx=null;

function getSfxCtx(){
  if(!sfxCtx){
    const Ctx=window.AudioContext||window.webkitAudioContext;
    if(Ctx) sfxCtx=new Ctx();
  }
  return sfxCtx;
}

async function loadSfx(){
  const ctx=getSfxCtx();
  if(!ctx) return;
  await Promise.all(Object.entries(SFX_FILES).map(async([name,src])=>{
    try{
      const res=await fetch(src);
      if(!res.ok) return;                // 404 등 → 해당 SFX만 무음 처리
      const arrBuf=await res.arrayBuffer();
      const audioBuf=await ctx.decodeAudioData(arrBuf);
      sfxBuffers[name]=audioBuf;
    }catch(e){ /* 디코딩 실패 포함 무음 스킵 */ }
  }));
}

function playSfx(name){
  const buf=sfxBuffers[name];
  const ctx=sfxCtx;
  if(!buf||!ctx) return; // 로드 실패/아직 로드 중이면 무음 스킵
  // autoplay 정책: 첫 사용자 인터랙션 전까지 context가 suspended일 수 있음
  if(ctx.state==='suspended') ctx.resume().catch(()=>{});
  const src=ctx.createBufferSource();
  src.buffer=buf;
  const gain=ctx.createGain();
  gain.gain.value=SFX_VOLUME;
  src.connect(gain).connect(ctx.destination);
  src.start(0);
}

// ── BGM 시스템 (화면별 자동 교체) ──
// 화면 ID → { 오디오 엘리먼트 ID, 볼륨 }
// 캐릭터 선택/닉네임은 온보딩 연속감을 위해 main BGM 유지
const SCREEN_BGM={
  'main-screen':             { id:'main-bgm',   volume:0.8  },
  'character-select-screen': { id:'main-bgm',   volume:0.8  },
  'nickname-screen':         { id:'main-bgm',   volume:0.8  },
  'lobby-screen':            { id:'lobby-bgm',  volume:0.06 },
  'skin-screen':             { id:'lobby-bgm',  volume:0.06 },
  'game-container':          { id:'ingame-bgm', volume:0.12 },
};

let currentBgmId=null;
let bgmResumeHandler=null;

function removeBgmResumeListeners(){
  if(!bgmResumeHandler) return;
  document.removeEventListener('pointerdown',bgmResumeHandler);
  document.removeEventListener('keydown',bgmResumeHandler);
  document.removeEventListener('touchstart',bgmResumeHandler);
  bgmResumeHandler=null;
}

function stopBgmEl(id){
  if(!id) return;
  const a=document.getElementById(id);
  if(!a) return;
  a.pause();
  a.currentTime=0;
}

function playBgmEl(id,volume){
  const a=document.getElementById(id);
  if(!a) return;
  a.volume=(volume!=null?volume:0.4);
  a.currentTime=0;
  const p=a.play();
  if(p&&typeof p.catch==='function'){
    p.catch(()=>{
      // 자동재생 차단 → 첫 인터랙션 시 재생, 재생 시작 후 리스너 전체 해제
      bgmResumeHandler=()=>{
        a.play().catch(()=>{});
        removeBgmResumeListeners();
      };
      document.addEventListener('pointerdown',bgmResumeHandler);
      document.addEventListener('keydown',bgmResumeHandler);
      document.addEventListener('touchstart',bgmResumeHandler,{passive:true});
    });
  }
}

// 화면 ID에 해당하는 BGM으로 교체. 동일 BGM이면 유지.
function switchBgmForScreen(screenId){
  const cfg=SCREEN_BGM[screenId];
  if(!cfg) return;
  if(currentBgmId===cfg.id){
    // 같은 BGM을 쓰는 화면 간 이동 → 재생 유지
    return;
  }
  if(currentBgmId) stopBgmEl(currentBgmId);
  removeBgmResumeListeners();
  currentBgmId=cfg.id;
  playBgmEl(cfg.id,cfg.volume);
}

function setupScreenNav(){
  // 초기 화면(메인)의 BGM 자동재생 시도
  switchBgmForScreen('main-screen');

  // 메인 로고 "띠용" 클릭 효과 (시각 효과만, 네비게이션 없음)
  const logoImg=document.querySelector('.main-logo-img');
  if(logoImg){
    logoImg.addEventListener('click',()=>{
      logoImg.classList.remove('bounced');
      void logoImg.offsetWidth; // reflow로 애니메이션 재시작
      logoImg.classList.add('bounced');
    });
  }

  // 메인 → 로비 or 캐릭터 선택 (프로필 유무에 따라)
  // BGM은 showScreen 내부 switchBgmForScreen에서 자동 처리
  document.getElementById('main-start-btn').addEventListener('click',()=>{
    playSfx('btn_click');
    if(hasPlayerProfile()){
      updateLobbyProfile();
      showScreen('lobby-screen');
      updateLobbyStage();
    } else {
      resetCharacterSelectUI();
      resetNicknameUI();
      showScreen('character-select-screen');
    }
  });
  // 로비 하단 버튼
  document.querySelectorAll('.lobby-menu-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const target=btn.dataset.target;
      playSfx('btn_click');
      if(target==='skin'){
        showScreen('skin-screen');
        renderSkinScreen();
      } else if(target==='collection'){
        showDexScreen();
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
    if(currentStage>TOTAL_STAGES) return;
    playSfx('btn_click');
    showScreen('game-container');
    if(!playing) startGame();
  });

  // 처음으로 → 계정 초기화 (dev용) + 메인 화면 (BGM 재시작)
  const resetBtn=document.getElementById('lobby-reset-btn');
  if(resetBtn){
    resetBtn.addEventListener('click',()=>{
      // 계정 초기화 — 게임이 사용하는 모든 사용자 데이터 키 청소
      // (보존: hexPuzzleHighScore, hexPuzzleDarkMode 등 환경 설정)
      const keysToWipe=[
        // 프로필/진행도
        'hexPuzzlePlayerName',
        'hexPuzzlePlayerCharacter',
        'hexPuzzleStage',
        'hexPuzzleIntroDone',
        // 재화
        'hexPuzzleGold',
        'hexPuzzleDiamond',
        'hexPuzzleCandy',           // v0.5.1 공통 사탕
        // 도감/스킨
        'hexPuzzleDex',             // v0.5 풀스펙 도감
        'hexPuzzleDexCaught',       // 레거시 (마이그레이션 안전망)
        'hexPuzzleUnlocked',        // 스킨 해금 리스트 (도감 따라 자동 재생성)
        'hexPuzzleSlots',
        'hexPuzzleSkinNew',         // 신규 해금 레드닷 큐
        // 천장 게이지
        'hexPuzzlePityMain',        // v0.5
        'hexPuzzlePityRepeat',      // v0.5
        'hexPuzzleEncounterStreak', // 레거시
      ];
      for(const k of keysToWipe) localStorage.removeItem(k);

      // 메모리 캐시 동기화
      currentStage=1;
      currentGold=0;
      devUnlocked=false; // dev 인증도 풀기 (계정 초기화 일관성)

      // UI 상태 갱신
      updateLobbyGoldUI();
      updateLobbyDiamondUI();
      updateLobbyStreakUI();
      updateLobbySkinBadge();
      const lobbyDevBtn=document.getElementById('lobby-dev-btn');
      if(lobbyDevBtn) lobbyDevBtn.classList.remove('active');
      const placeTab=document.getElementById('placement-tab');
      if(placeTab) placeTab.classList.add('hidden');

      // showScreen이 SCREEN_BGM 매핑으로 main-bgm 재시작 처리
      showScreen('main-screen');
    });
  }
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
    applyPokemonBg(slot,pokeNum,50,true);
    const num=document.createElement('div');
    num.className='skin-slot-num';
    num.textContent=i+1;
    slot.appendChild(num);
    slot.addEventListener('click',()=>{
      playSfx('select');
      skinEditingSlot=i;
      renderSkinSlots();
      renderSkinCollection();
      document.getElementById('skin-collection-area').classList.remove('hidden');
      document.getElementById('skin-editing-slot').textContent=i+1;
    });
    container.appendChild(slot);
  });
  // 카운터 갱신 (해금 / 151)
  const counter=document.getElementById('skin-counter');
  if(counter) counter.textContent=`${skinData.unlocked.length} / 151`;
}

function renderSkinCollection(){
  const container=document.getElementById('skin-collection');
  container.innerHTML='';
  const equippedSet=new Set(skinData.slots);
  for(let n=1;n<=151;n++){
    const item=document.createElement('div');
    const unlocked=skinData.unlocked.includes(n);
    const equipped=equippedSet.has(n);
    const isNew=(typeof hasSkinNew==='function')&&hasSkinNew(n);
    item.className='skin-item'+(unlocked?'':' locked')+(equipped?' equipped':'')+(isNew?' is-new':'');

    // sprite \u2014 \uC778\uAC8C\uC784 \uBE14\uB85D\uACFC \uB3D9\uC77C\uD55C \uC2DC\uD2B8 \uC774\uBBF8\uC9C0 (\uC2A4\uD0A8\uCC3D\uC740 \uBE14\uB85D \uC678\uD615 \uBBF8\uB9AC\uBCF4\uAE30)
    const sprite=document.createElement('div');
    sprite.className='skin-item-sprite';
    applyPokemonBg(sprite,n,46,true);
    item.appendChild(sprite);

    if(!unlocked){
      const lock=document.createElement('div');
      lock.className='skin-item-lock';
      lock.textContent='\uD83D\uDD12';
      item.appendChild(lock);
    }
    if(isNew){
      const dot=document.createElement('div');
      dot.className='skin-item-newdot';
      item.appendChild(dot);
    }

    const numLabel=document.createElement('div');
    numLabel.className='skin-item-num';
    numLabel.textContent=`#${n}`;
    item.appendChild(numLabel);
    if(unlocked){
      item.addEventListener('click',()=>{
        playSfx('select');
        // 신규 해금 레드닷 해제 (확인 처리)
        if(typeof clearSkinNew==='function') clearSkinNew(n);
        // 이미 다른 슬롯에 장착된 경우 스왑
        const otherSlot=skinData.slots.indexOf(n);
        if(otherSlot!==-1&&otherSlot!==skinEditingSlot){
          skinData.slots[otherSlot]=skinData.slots[skinEditingSlot];
        }
        skinData.slots[skinEditingSlot]=n;
        saveSkinData(skinData.unlocked,skinData.slots);
        renderSkinSlots();
        renderSkinCollection();
        if(typeof updateLobbySkinBadge==='function') updateLobbySkinBadge();
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

// ── 배치 도구 슬라이드 패널 ──
function setupPlacementPanel(){
  const tab=document.getElementById('placement-tab');
  const panel=document.getElementById('placement-panel');
  if(!tab||!panel) return;

  // 탭 토글
  tab.addEventListener('click',(e)=>{
    e.stopPropagation();
    const open=panel.classList.toggle('open');
    tab.textContent=open?'▶':'◀';
  });

  // 배치 버튼 바인딩
  panel.querySelectorAll('.placement-btn').forEach(btn=>{
    if(btn.id==='placement-coord-toggle') return;
    btn.addEventListener('click',()=>handlePlacementBtn(btn));
  });

  // 팔레트 해제 버튼
  document.getElementById('placement-palette-clear').addEventListener('click',clearPlacementSelection);

  // 좌표 보기 토글
  document.getElementById('placement-coord-toggle').addEventListener('click',togglePlacementCoord);

  // 셀 클릭 시 기믹 배치 (특수블록 배치는 main.js onDragEnd의 placeDebugSpecial이 담당)
  document.getElementById('grid-container').addEventListener('click',(e)=>{
    if(!placementGimmickType||!devUnlocked) return;
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
    if(placementGimmickType.type==='clear'){
      removeGimmickEl(bestCol,bestRow);
      totalStones=countStones();initialStones=totalStones;
      updateMissionUI();
    } else {
      placeStone(bestCol,bestRow,placementGimmickType.level);
      initialStones=countStones();
    }
  });
}

function handlePlacementBtn(btn){
  const type=btn.dataset.placeType;
  const gimmick=btn.dataset.placeGimmick;
  const label=btn.dataset.placeLabel||btn.textContent.trim();

  if(type){
    // 특수블록 선택
    const dir=btn.dataset.placeDir||null;
    const curKey=debugPlaceType?`${debugPlaceType}_${debugPlaceDir||''}`:'';
    const newKey=`${type}_${dir||''}`;
    if(curKey===newKey){
      clearPlacementSelection();
    } else {
      clearPlacementSelection();
      debugPlaceType=type;
      debugPlaceDir=dir;
      btn.classList.add('active');
      updatePlacementPalette({kind:'special',type,dir,label});
    }
  } else if(gimmick){
    // 기믹 선택
    const level=btn.dataset.placeLevel?parseInt(btn.dataset.placeLevel):null;
    const curKey=placementGimmickType
      ?(placementGimmickType.type==='clear'?'clear':`${placementGimmickType.type}_${placementGimmickType.level}`)
      :'';
    const newKey=gimmick==='clear'?'clear':`${gimmick}_${level}`;
    if(curKey===newKey){
      clearPlacementSelection();
    } else {
      clearPlacementSelection();
      placementGimmickType=gimmick==='clear'?{type:'clear'}:{type:gimmick,level};
      btn.classList.add('active');
      updatePlacementPalette({kind:'gimmick',type:gimmick,level,label});
    }
  }
}

function clearPlacementSelection(){
  debugPlaceType=null;
  debugPlaceDir=null;
  placementGimmickType=null;
  document.querySelectorAll('#placement-panel .placement-btn').forEach(b=>{
    if(b.id==='placement-coord-toggle') return;
    b.classList.remove('active');
  });
  updatePlacementPalette(null);
}

function updatePlacementPalette(sel){
  const empty=document.getElementById('placement-palette-empty');
  const selected=document.getElementById('placement-palette-selected');
  if(!empty||!selected) return;
  if(!sel){
    empty.classList.remove('hidden');
    selected.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  selected.classList.remove('hidden');
  const icon=document.getElementById('placement-palette-icon');
  const name=document.getElementById('placement-palette-name');
  name.textContent=sel.label;
  icon.style.backgroundImage='';
  if(sel.kind==='special'){
    const src=sel.type==='stripe'?getStripeImage(sel.dir):SPECIAL_IMAGES[sel.type];
    if(src) icon.style.backgroundImage=`url(${src})`;
  } else if(sel.kind==='gimmick'){
    if(sel.type==='stone'&&sel.level){
      icon.style.backgroundImage=`url(assets/gimmick/stone_${sel.level}.png)`;
    }
  }
}

function togglePlacementCoord(){
  const btn=document.getElementById('placement-coord-toggle');
  placementCoordVisible=!placementCoordVisible;
  btn.classList.toggle('active',placementCoordVisible);
  document.querySelectorAll('.coord-label').forEach(el=>el.remove());
  if(!placementCoordVisible) return;
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

// ── 블록 배율 적용 (인스펙터 실시간 반영) ──
function applyBlockScale(){
  const scale=CFG.blockScale||1.0;
  const baseD=BLOCK_D*scale;
  const adj=BLOCK_D*(scale-1)/2;                  // 셀 중앙 정렬 보정값
  document.documentElement.style.setProperty('--block-d',`${baseD}px`);
  // 포켓몬/특수블록은 inline width/height를 쓰므로 재계산
  const bigSz=Math.round(BLOCK_D*1.1*scale);
  const offset=-(bigSz-baseD)/2;
  for(let col=0;col<COLS_PATTERN.length;col++){
    const arr=blockEls[col]||[];
    for(let row=0;row<arr.length;row++){
      const el=arr[row];
      if(!el) continue;
      if(el.classList.contains('pokemon-block')||el.classList.contains('special-block')){
        el.style.width=`${bigSz}px`;
        el.style.height=`${bigSz}px`;
        el.style.margin=`${offset}px 0 0 ${offset}px`;
      }
      // 위치 재계산: 기본 pos(BLOCK_D 기준) - 보정값 → 셀 중앙 고정
      if(cellPos[col]?.[row]){
        const pos=getBlockPos(col,row);
        el.style.left=`${pos.x-adj}px`;
        el.style.top=`${pos.y-adj}px`;
      }
    }
  }
}
