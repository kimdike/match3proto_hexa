// ── 포켓몬 조우 시스템 (v0.5 Stage A+B) ──
// 클리어 후 확률 판정 → 풀에서 1마리 뽑기 → 조우 화면 띄움.
// Stage A: 판정 로직 / Stage B: 화면 UI (도망까지)
// Stage C(포획), D(튜토리얼 강제) 후속 세션에서 구현.
//
// 의존성:
//   - config.js : getRegionByStage / getMonstersByRegion / TYPE_COLORS
//   - pity.js   : rollEncounter / resetPity
//   - dex.js    : markDiscovered / getMonsterMeta(via monster_table)
//   - ui.js     : showScreen / playSfx
//
// 흐름: showEndScreen(true) → decideEncounter() → _pending 저장
//       → "로비로" 클릭 → showEncounterScreen() → 도망 → markDiscovered → 로비

// ── 조우 확률 (메인 25% / 반복 35%) ──
const ENCOUNTER_RATE_MAIN   = 0.25;
const ENCOUNTER_RATE_REPEAT = 0.35;

// 콤보 보너스 (섹션 5-5)
function _comboBonus(combo){
  if(combo>=15) return 0.015;
  if(combo>=10) return 0.010;
  if(combo>=5)  return 0.005;
  return 0;
}

// 희귀도 가중치 (섹션 5-6)
const RARITY_WEIGHT = { normal:80, rare:18, epic:1, legendary:1 };

// 풀에서 rarity 가중치로 1마리 추첨
function _weightedPick(pool){
  if(!pool || pool.length===0) return null;
  let total=0;
  for(const m of pool) total += (RARITY_WEIGHT[m.rarity]||1);
  let r = Math.random()*total;
  for(const m of pool){
    r -= (RARITY_WEIGHT[m.rarity]||1);
    if(r<=0) return m;
  }
  return pool[pool.length-1]; // 부동소수 안전장치
}

// 튜토리얼 강제 조우 — monster_table.json의 tutorial_stage 필드 기반
// 1번=이상해씨, 5번=뚜벅쵸, 10번=모다피, 15번=아라리 (Stage D)
function _findTutorialMonster(stage){
  if(typeof MONSTER_TABLE_DATA==='undefined' || !MONSTER_TABLE_DATA.monsters) return null;
  return MONSTER_TABLE_DATA.monsters.find(m=>m.tutorial_stage===stage) || null;
}

// pendingEncounter 전역 (모듈 내부)
let _pending = null;
// 던지기 연출 중 플래그 (중복 클릭 방지)
let _throwing = false;

// 볼 셀렉터 — 좌우 스와이프로 4종 순환
const BALL_CYCLE = ['basic','super','hyper','master'];
let _selectedBallIdx = 0;
function getSelectedBall(){ return BALL_CYCLE[_selectedBallIdx]; }

// 포획 확률 → 감성 표현 (난이도 dots + 라벨)
//   tier: low / mid / high / guaranteed (CSS data-tier 매핑)
//   failStack 누적될수록 dots/tier 자연스럽게 상승 (실패가 의미 있도록)
function getCatchDifficulty(ballType, monster, failStack){
  if(ballType==='master') return { dots:'★★★', label:'확정 포획', tier:'guaranteed' };
  if(typeof computeCatchRate!=='function') return { dots:'●○○', label:'어려움', tier:'low' };
  const rate = computeCatchRate(ballType, monster, (failStack|0), 0);
  if(rate >= 1.0) return { dots:'★★★', label:'확정 포획', tier:'guaranteed' };
  if(rate >= 0.7) return { dots:'●●●', label:'높음',     tier:'high' };
  if(rate >= 0.4) return { dots:'●●○', label:'보통',     tier:'mid' };
  return                  { dots:'●○○', label:'어려움', tier:'low' };
}

// ── 자동 도망 영구 토글 ──
const AUTO_FLEE_KEY      = 'hexPuzzleAutoFlee';
const AUTO_FLEE_SEEN_KEY = 'hexPuzzleAutoFleeSeen'; // 첫 ON 이후 로비 토글 노출 트리거
function getAutoFlee(){
  return localStorage.getItem(AUTO_FLEE_KEY) === '1';
}
function hasSeenAutoFlee(){
  return localStorage.getItem(AUTO_FLEE_SEEN_KEY) === '1';
}
function setAutoFlee(on){
  if(on){
    localStorage.setItem(AUTO_FLEE_KEY, '1');
    // 첫 ON 시점 — 로비 토글 노출 시작
    if(!hasSeenAutoFlee()) localStorage.setItem(AUTO_FLEE_SEEN_KEY, '1');
  } else {
    localStorage.removeItem(AUTO_FLEE_KEY);
  }
  // 조우 화면 체크박스 동기화
  const chk = document.getElementById('enc-auto-flee-check');
  if(chk) chk.checked = on;
  // 로비 토글 동기화
  if(typeof updateLobbyAutoFleeUI==='function') updateLobbyAutoFleeUI();
}

// 클리어 후 호출. 조우 발생 여부 결정 + 풀에서 1마리 뽑아 _pending에 저장.
//   stage:     현재 클리어한 스테이지 번호
//   pityResult: pity.js rollEncounter 결과 { encountered, justFilled, ... }
//   combo:     이번 게임 최대 콤보 (없으면 0)
//   mode:      'main' | 'repeat' (현재 메인만)
// 반환: _pending 객체 (없으면 null)
function decideEncounter(stage, pityResult, combo, mode){
  mode = mode || 'main';
  combo = combo|0;

  // 1) 튜토리얼 강제 조우 (Stage D) — monster_table의 tutorial_stage 매칭 시 100% 발동
  //    1=이상해씨 / 5=뚜벅쵸 / 10=모다피 / 15=아라리
  //    천장보다 우선. 천장 카운터는 0으로 리셋(조우니까).
  const tutorialMon = _findTutorialMonster(stage);
  if(tutorialMon){
    const region = (typeof getRegionByStage==='function') ? getRegionByStage(stage) : null;
    if(region){
      if(typeof resetPity==='function') resetPity(mode);
      _pending = {
        monster:  tutorialMon,
        region,
        forced:   false,
        rolled:   false,
        tutorial: true,
        stage,
      };
      console.log(`[encounter] 튜토리얼 강제 조우 — ${tutorialMon.name_ko} (#${tutorialMon.id}) at stage ${stage}`);
      return _pending;
    }
  }

  // 2) 천장 강제 조우 — pity.js가 이미 카운터 0 리셋했음
  let forced = !!(pityResult && pityResult.encountered);

  // 3) 자체 확률 판정 (천장 미발동 시)
  let rolled = false;
  if(!forced){
    const baseRate = (mode==='repeat')?ENCOUNTER_RATE_REPEAT:ENCOUNTER_RATE_MAIN;
    const rate = baseRate + _comboBonus(combo);
    if(Math.random() < rate){
      rolled = true;
      // 우리 자체 조우 결정 → pity 카운터 0 리셋 (rollEncounter는 이미 +1 했으므로)
      if(typeof resetPity==='function') resetPity(mode);
    }
  }

  if(!forced && !rolled){
    _pending = null;
    return null;
  }

  // 4) 풀 산출
  const region = (typeof getRegionByStage==='function') ? getRegionByStage(stage) : null;
  if(!region){
    _pending = null;
    return null;
  }
  const pool = (typeof getMonstersByRegion==='function') ? getMonstersByRegion(region.type) : [];
  if(!pool || pool.length===0){
    // 풀 부족 지역 (악의 지역 등) → 조우 무발생
    console.log(`[encounter] ${region.name_ko}는 1세대 풀이 비어 조우 무발생`);
    _pending = null;
    return null;
  }

  // 5) 1마리 추첨
  const monster = _weightedPick(pool);
  if(!monster){
    _pending = null;
    return null;
  }

  _pending = {
    monster,           // monster_table.json entry (id, name_ko, types, rarity, height_m, weight_kg, ...)
    region,            // { type, name_ko, stageStart, stageEnd, stageInRegion, ... }
    forced,            // 천장 강제 조우 여부
    rolled,            // 자체 확률 통과 여부 (forced와 배타적)
    tutorial: false,
    stage,
  };
  console.log(`[encounter] 조우 결정 — ${monster.name_ko} (#${monster.id}) / ${region.name_ko} / ${forced?'천장':'확률'}`);
  return _pending;
}

function getPendingEncounter(){ return _pending; }
function clearPendingEncounter(){ _pending = null; }

// ── 조우 화면 표시 ──
function showEncounterScreen(){
  if(!_pending){
    console.warn('[encounter] showEncounterScreen 호출됐지만 _pending 없음');
    return;
  }

  // 자동도망 ON이면 즉시 도망 (조우 화면 안 띄움)
  if(getAutoFlee()){
    console.log('[encounter] 자동도망 ON — 화면 띄우지 않고 즉시 도망');
    fleeEncounter();
    return;
  }

  const screen = document.getElementById('encounter-screen');
  if(!screen) return;

  // 결과 패널 숨기고 메인 패널 표시 (재시도/재진입 시 초기화)
  const resultPanel = document.getElementById('enc-result');
  const mainPanel   = document.getElementById('enc-content-main');
  if(resultPanel) resultPanel.classList.add('hidden');
  if(mainPanel)   mainPanel.classList.remove('hidden');

  // 자동도망 v체크 — 영구 저장값 반영 (이 시점엔 OFF여서 화면 띄워졌다는 의미)
  const autoChk = document.getElementById('enc-auto-flee-check');
  if(autoChk) autoChk.checked = getAutoFlee();

  const m = _pending.monster;

  // 타입별 배경 분위기 (첫 번째 타입 기준)
  const primaryType = (Array.isArray(m.types) && m.types[0]) ? m.types[0] : 'normal';
  screen.dataset.regionType = primaryType;

  // 큰 이름 — "야생 OO!"
  const nameEl = document.getElementById('enc-name');
  if(nameEl) nameEl.textContent = `야생 ${m.name_ko}!`;

  const spriteEl = document.getElementById('enc-sprite');
  if(spriteEl){
    // 이전 조우의 sucking/escaping 잔재 청소 (성공 후 재진입 시 sprite가 안 보이는 문제 방지)
    spriteEl.classList.remove('sucking', 'escaping');
    spriteEl.style.backgroundImage = `url("assets/dot/pokemon/${m.id}.gif")`;
    spriteEl.style.backgroundSize = 'contain';
    spriteEl.style.backgroundPosition = 'center';
    spriteEl.style.backgroundRepeat = 'no-repeat';
    void spriteEl.offsetWidth; // reflow로 base bob 재시작
  }

  const typesEl = document.getElementById('enc-types');
  if(typesEl){
    typesEl.innerHTML = '';
    if(Array.isArray(m.types)){
      for(const t of m.types){
        const tag = document.createElement('span');
        tag.className = 'enc-type-tag';
        tag.textContent = t;
        if(typeof TYPE_COLORS!=='undefined' && TYPE_COLORS[t]) tag.style.background = TYPE_COLORS[t];
        typesEl.appendChild(tag);
      }
    }
  }

  const numEl = document.getElementById('enc-num');
  if(numEl) numEl.textContent = '#' + String(m.id).padStart(3,'0');

  const regionEl = document.getElementById('enc-region');
  if(regionEl){
    let suffix = '';
    if(_pending.tutorial)    suffix = ' · 튜토리얼';
    else if(_pending.forced) suffix = ' · 천장 발동';
    regionEl.textContent = _pending.region.name_ko + suffix;
  }

  // 볼 셀렉터 — 첫 번째 볼(기본볼)부터 시작, 카운트 + 난이도 동기화
  _selectedBallIdx = 0;
  refreshSelectedBall();

  // 화면 전환 (클리어 화면 닫고 조우 화면 띄움)
  // showScreen이 SCREEN_BGM 매핑으로 ingame/lobby-bgm → encounter-bgm 교체 처리
  if(typeof hideEndScreen==='function') hideEndScreen();
  if(typeof showScreen==='function') showScreen('encounter-screen');

  // 띠로리 SFX — assets/sfx/sfx_wild_encounter.wav
  // 자산 도착 전까지 sfx_select 폴백으로 청각 신호는 유지
  if(typeof playSfx==='function'){
    if(typeof hasSfx==='function' && hasSfx('wild_encounter')){
      playSfx('wild_encounter');
    } else {
      playSfx('select'); // 폴백 — 자산 도착 후 자동으로 wild_encounter 분기 사용
    }
  }
}

// 볼 잔여 카운트 갱신 (개발자 패널 + 조우 화면 셀렉터 양쪽 동기화)
// basic은 3-rail 합산 (natural + free + 일반 basic) — getBalls('basic') 사용
function refreshBallButtons(){
  if(typeof getBalls!=='function') return;
  const order = (typeof BALL_ORDER!=='undefined') ? BALL_ORDER : ['basic','super','hyper','master'];
  for(const t of order){
    const cnt = getBalls(t)|0;
    document.querySelectorAll(`[data-ball-count="${t}"]`).forEach(el=>{
      el.textContent = cnt;
    });
  }
  refreshSelectedBall();
}

// 볼 셀렉터 좌우 순환
function cycleBall(dir){
  _selectedBallIdx = (_selectedBallIdx + dir + BALL_CYCLE.length) % BALL_CYCLE.length;
  refreshSelectedBall();
  if(typeof playSfx==='function') playSfx('btn_click');
}

// 볼 부족 안내 모달 — "상점으로 이동" / "취소"
function showLowBallsModal(ballType){
  const overlay = document.getElementById('enc-low-balls-overlay');
  const nameEl = document.getElementById('enc-low-balls-name');
  if(!overlay) return;
  const names = (typeof BALL_NAMES!=='undefined') ? BALL_NAMES : {basic:'기본볼',super:'슈퍼볼',hyper:'하이퍼볼',master:'마스터볼'};
  if(nameEl) nameEl.textContent = names[ballType] || '몬스터볼';
  overlay.classList.remove('hidden');
  if(typeof playSfx==='function') playSfx('btn_click');
}
function hideLowBallsModal(){
  const overlay = document.getElementById('enc-low-balls-overlay');
  if(overlay) overlay.classList.add('hidden');
}

// 셀렉터 큰 볼 + 이름 + 수량 + 난이도 + 던지기 버튼 활성/비활성 갱신
// basic은 3-rail 합산 (natural + free + 일반 basic) — getBalls() 사용
function refreshSelectedBall(){
  const t = getSelectedBall();
  const getCnt = (typeof getBalls==='function')
    ? (k)=>getBalls(k)|0
    : (k)=>0;
  const balls = { basic:getCnt('basic'), super:getCnt('super'), hyper:getCnt('hyper'), master:getCnt('master') };

  // 큰 볼 비주얼 (클래스 교체)
  const big = document.getElementById('enc-ball-big');
  if(big){
    big.className = 'enc-ball-big enc-ball-icon enc-ball-' + t;
  }
  // 이름
  const nameEl = document.getElementById('enc-ball-name-line');
  if(nameEl){
    const names = (typeof BALL_NAMES!=='undefined') ? BALL_NAMES : {basic:'기본볼',super:'슈퍼볼',hyper:'하이퍼볼',master:'마스터볼'};
    nameEl.textContent = names[t] || t;
  }
  // 수량
  const cntNum = document.querySelector('.enc-ball-count-num[data-ball-count]');
  if(cntNum){
    cntNum.dataset.ballCount = t;          // 셀렉터 카운트도 현재 볼로 동기화
    cntNum.textContent = balls[t]|0;
  }

  // 난이도 (감성 표현 — 현재 도감 entry의 failStack 반영해서 누적 보정 시각화)
  if(_pending){
    let fs = 0;
    if(typeof getDexEntry==='function'){
      fs = getDexEntry(_pending.monster.id)?.failStack | 0;
    }
    const diff = getCatchDifficulty(t, _pending.monster, fs);
    const wrap   = document.getElementById('enc-ball-difficulty');
    const dotsEl = document.getElementById('enc-diff-dots');
    const lblEl  = document.getElementById('enc-diff-label');
    if(wrap)   wrap.dataset.tier = diff.tier;
    if(dotsEl) dotsEl.textContent = diff.dots;
    if(lblEl)  lblEl.textContent  = diff.label;
  }

  // 던지기 버튼 — v0.6: 볼 부족(empty)이어도 활성화 유지. 클릭 시 상점 안내 모달이 처리.
  const throwBtn = document.getElementById('enc-throw-btn');
  if(throwBtn){
    const empty = (balls[t]|0) <= 0;
    throwBtn.disabled = _throwing;
    throwBtn.classList.toggle('disabled', empty); // 시각만 회색 (클릭은 받음 → 모달)
    throwBtn.dataset.ball = t;
  }
}

// 도망가기 — 도감에 "발견" 등록 후 로비로
function fleeEncounter(){
  if(!_pending){
    if(typeof resetToStart==='function') resetToStart();
    return;
  }
  const id = _pending.monster.id;
  if(typeof markDiscovered==='function') markDiscovered(id);
  if(typeof playSfx==='function') playSfx('btn_click');
  console.log(`[encounter] 도망 — #${id} 도감에 '발견' 등록`);
  clearPendingEncounter();
  if(typeof resetToStart==='function') resetToStart();
}

// 작은 헬퍼: ms 대기
const _delay = ms => new Promise(r => setTimeout(r, ms));

// 메인 패널 입력 잠금/해제 (던지는 중 중복 클릭 방지)
function setEncActionsDisabled(disabled){
  // 던지기 버튼
  const throwBtn = document.getElementById('enc-throw-btn');
  if(throwBtn){
    if(disabled) throwBtn.disabled = true;
    else {
      const t = getSelectedBall();
      const remain = (typeof getBalls==='function') ? getBalls(t) : 0;
      throwBtn.disabled = remain <= 0;
      throwBtn.classList.toggle('disabled', remain <= 0);
    }
  }
  // 좌우 화살표
  document.getElementById('enc-ball-prev')?.toggleAttribute?.('disabled', !!disabled);
  document.getElementById('enc-ball-next')?.toggleAttribute?.('disabled', !!disabled);
  // 도망 X
  const fleeX = document.getElementById('enc-flee-x');
  if(fleeX) fleeX.disabled = !!disabled;
  // 자동 도망 v체크
  const chk = document.getElementById('enc-auto-flee-check');
  if(chk) chk.disabled = !!disabled;
}

// 던지기 애니메이션 파이프라인
//   1) 볼 객체 생성 → 던지기 비행 (포물선 + 회전 720)
//   2) 몬스터 흡수 (빨간 flash → scale 0)
//   3) 흔들림 3회 (점점 약해짐)
//   4) 결과: 잡힘(별빛) / 실패(볼 깨짐 + 몬스터 재등장)
async function playThrowAnimation(ballType, success){
  const screen = document.getElementById('encounter-screen');
  const sprite = document.getElementById('enc-sprite');
  if(!screen) return;

  // 던지는 볼 객체 (메인 패널과 같은 enc-content-main 안에 추가 — 화면 좌표계 공유)
  const main = document.getElementById('enc-content-main') || screen;
  const ball = document.createElement('div');
  ball.className = `enc-thrown-ball enc-ball-icon enc-ball-${ballType}`;
  main.appendChild(ball);

  // 1) 던지기 비행
  await _delay(30); // DOM 안정화 (animation 트리거 보장)
  ball.classList.add('throwing');
  await _delay(600);

  // 2) 몬스터 흡수 (빨간 flash + scale 0)
  if(sprite) sprite.classList.add('sucking');
  await _delay(500);

  // 3) 흔들림 3회 (점점 약해짐: 12 → 8 → 4)
  ball.classList.remove('throwing');
  ball.classList.add('wobbling');
  await _delay(1200);

  // 4) 결과 연출
  ball.classList.remove('wobbling');
  if(success){
    ball.classList.add('caught');
    await _delay(500);
  } else {
    ball.classList.add('broken');
    if(sprite){
      sprite.classList.remove('sucking');
      sprite.classList.add('escaping');
    }
    await _delay(500);
  }

  // 정리: 볼 제거 + 스프라이트 상태 처리
  ball.remove();
  if(sprite){
    if(success){
      // 성공 — 스프라이트는 볼 안에 들어간 상태(scale 0) 유지. popup이 결과 표시.
      // 다음 조우 진입 시 showEncounterScreen에서 reset됨.
    } else {
      // 실패 — 몬스터가 다시 등장한 상태로 복귀, bob 애니 재개
      sprite.classList.remove('sucking', 'escaping');
      void sprite.offsetWidth;
    }
  }
}

// 포획 시도 — 볼 1개 소비 → 던지기 연출 → 결과 패널
// 볼 부족 시: 상점 이동 안내 모달 (v0.6)
async function tryCatchEncounter(ballType){
  if(!_pending) return;
  if(_throwing) return;
  if(typeof getBalls!=='function' || typeof consumeBall!=='function' || typeof tryCatch!=='function'){
    console.warn('[encounter] balls.js 미로드');
    return;
  }
  if(getBalls(ballType) <= 0){
    showLowBallsModal(ballType);
    return;
  }

  _throwing = true;

  const m = _pending.monster;
  let failStack = 0;
  if(typeof getDexEntry==='function'){
    const e = getDexEntry(m.id);
    failStack = e?.failStack | 0;
  }
  const combo = 0; // TODO: 실제 게임 콤보 추적값 전달

  consumeBall(ballType);
  refreshBallButtons();
  setEncActionsDisabled(true);
  if(typeof playSfx==='function') playSfx('swap');

  const success = tryCatch(ballType, m, failStack, combo);

  // 던지기 → 흡수 → 흔들림 → 결과 (애니메이션 약 2.8s)
  await playThrowAnimation(ballType, success);

  if(success){
    // 크기/무게 (v0.6) — 포획 시 랜덤 factor 0.7~1.3
    // XXS: factor < 0.78 (하위 약 5%) / XXL: factor > 1.22 (상위 약 5%)
    const factor = 0.7 + Math.random() * 0.6;
    const baseH = m.height_m || 0;
    const baseW = m.weight_kg || 0;
    const height = Math.round(baseH * factor * 100) / 100;
    const weight = Math.round(baseW * factor * 100) / 100;
    let sizeTag = null;
    if(factor < 0.78) sizeTag = 'XXS';
    else if(factor > 1.22) sizeTag = 'XXL';
    if(typeof captureNow==='function') captureNow(m.id, { height, weight });
    console.log(`[encounter] 포획 성공 — #${m.id} ${m.name_ko} (${ballType}, ${height}m/${weight}kg${sizeTag?' '+sizeTag:''})`);
    showEncounterResult({ success: true, monster: m, ballType, height, weight, sizeTag });
  } else {
    if(typeof incFailStack==='function') incFailStack(m.id);
    console.log(`[encounter] 포획 실패 — #${m.id} ${m.name_ko} (${ballType}, failStack→${failStack+1})`);
    showEncounterResult({ success: false, monster: m, ballType });
  }

  setEncActionsDisabled(false);
  _throwing = false;
}

// 결과 오버레이 팝업 표시 (메인 패널 그대로 두고 모달로 띄움)
function showEncounterResult(result){
  const overlay  = document.getElementById('enc-result');
  const iconEl   = document.getElementById('enc-result-icon');
  const titleEl  = document.getElementById('enc-result-title');
  const detailEl = document.getElementById('enc-result-detail');
  if(!overlay) return;

  overlay.classList.remove('success','failure');
  overlay.classList.add(result.success ? 'success' : 'failure');

  if(iconEl)  iconEl.textContent  = result.success ? '✨' : '💨';
  if(titleEl) titleEl.textContent = result.success ? '잡았다!' : '앗! 도망쳤다!';
  if(detailEl){
    if(result.success){
      // XXS/XXL 라벨 + 크기 정보 (v0.6)
      let sizeBadge = '';
      if(result.sizeTag === 'XXS'){
        sizeBadge = `<br><span class="enc-size-tag enc-size-xxs">⭐ XXS · 정말 작아!</span>`;
      } else if(result.sizeTag === 'XXL'){
        sizeBadge = `<br><span class="enc-size-tag enc-size-xxl">⭐ XXL · 정말 커!</span>`;
      }
      const sizeInfo = (result.height != null && result.weight != null)
        ? `<br><span class="enc-size-info">${result.height}m · ${result.weight}kg</span>`
        : '';
      detailEl.innerHTML = `#${String(result.monster.id).padStart(3,'0')} ${result.monster.name_ko}<br>도감 등록 + 사탕 +2${sizeBadge}${sizeInfo}`;
    } else {
      detailEl.innerHTML = `다음 시도 +5% 보정<br>실패 스택이 누적됐어`;
    }
  }

  // 메인 패널은 그대로 두고 오버레이만 띄움 (같은 공간 안에서 결과 발생)
  overlay.classList.remove('hidden');
}

// 자동도망 체크 — 영구 저장 + 켜진 시점이면 즉시 도망
function onAutoFleeCheck(e){
  const on = !!e.target.checked;
  setAutoFlee(on);
  // 체크된 순간 진행 중인 조우는 즉시 도망 (다음 조우부터 자동도망 + 이번도)
  if(on) fleeEncounter();
}

// 로비 자동도망 토글 버튼 UI 갱신 (현재 localStorage 상태 반영)
// 노출 조건: 한 번이라도 ON으로 켠 적이 있거나(seen) 현재 ON 상태일 때만 — 신규 유저에겐 숨김
function updateLobbyAutoFleeUI(){
  const btn = document.getElementById('lobby-auto-flee-btn');
  if(!btn) return;
  const on = getAutoFlee();
  const seen = hasSeenAutoFlee();
  // 신규 유저(아직 한 번도 ON 안 켰음 + 현재도 OFF) → 숨김
  if(!seen && !on){
    btn.style.display = 'none';
    return;
  }
  btn.style.display = '';
  btn.textContent = `🎯 자동도망 ${on ? 'ON' : 'OFF'}`;
  btn.classList.toggle('on', on);
}

// 로비 토글 버튼 클릭 핸들러
function onLobbyAutoFleeClick(){
  const next = !getAutoFlee();
  setAutoFlee(next);
  if(typeof playSfx==='function') playSfx('btn_click');
}

// 화면 이벤트 바인딩 (한 번만)
function setupEncounterScreen(){
  // 좌상단 X — 도망
  const fleeX = document.getElementById('enc-flee-x');
  if(fleeX) fleeX.addEventListener('click', fleeEncounter);

  // 볼 셀렉터 좌우 화살표
  const prev = document.getElementById('enc-ball-prev');
  const next = document.getElementById('enc-ball-next');
  if(prev) prev.addEventListener('click', ()=>cycleBall(-1));
  if(next) next.addEventListener('click', ()=>cycleBall(+1));

  // 메인 CTA — 볼 던지기 (현재 선택된 볼 사용)
  const throwBtn = document.getElementById('enc-throw-btn');
  if(throwBtn) throwBtn.addEventListener('click', ()=>{
    if(throwBtn.disabled) return;
    tryCatchEncounter(getSelectedBall());
  });

  // 볼 부족 모달 — 취소 / 상점 이동
  const lowCancel = document.getElementById('enc-low-balls-cancel');
  const lowGo = document.getElementById('enc-low-balls-go');
  if(lowCancel) lowCancel.addEventListener('click', ()=>{
    if(typeof playSfx==='function') playSfx('btn_click');
    hideLowBallsModal();
  });
  if(lowGo) lowGo.addEventListener('click', ()=>{
    if(typeof playSfx==='function') playSfx('btn_click');
    hideLowBallsModal();
    // 조우 상태 정리: 자동 도망 처리 (도감엔 발견만 등록)
    if(typeof fleeEncounter==='function'){
      fleeEncounter();
    } else if(typeof showScreen==='function'){
      showScreen('lobby-screen');
    }
    // 상점 진입
    if(typeof openShopScreen==='function'){
      setTimeout(()=>openShopScreen(), 100);
    }
  });
  // 바깥 영역 탭 → 닫기
  const lowOverlay = document.getElementById('enc-low-balls-overlay');
  if(lowOverlay) lowOverlay.addEventListener('click', (e)=>{
    if(e.target === lowOverlay) hideLowBallsModal();
  });

  // 자동도망 v체크 — 변경 즉시 도망 + 영구 저장
  const autoChk = document.getElementById('enc-auto-flee-check');
  if(autoChk) autoChk.addEventListener('change', onAutoFleeCheck);

  // 결과 오버레이 버튼들 (메인 패널은 항상 살아있음)
  const retry = document.getElementById('enc-result-retry');
  if(retry) retry.addEventListener('click', ()=>{
    // 오버레이만 닫고 메인 패널로 돌아감 — 실패 스택 누적된 상태로 재시도
    const overlay = document.getElementById('enc-result');
    if(overlay) overlay.classList.add('hidden');
    refreshBallButtons(); // 선택된 볼 잔여 + 난이도 dots 갱신 (failStack 반영)
    if(typeof playSfx==='function') playSfx('btn_click');
  });
  const resultFlee = document.getElementById('enc-result-flee');
  if(resultFlee) resultFlee.addEventListener('click', fleeEncounter);
  const resultOk = document.getElementById('enc-result-ok');
  if(resultOk) resultOk.addEventListener('click', ()=>{
    // 계속하기 — 로비로 복귀
    if(typeof playSfx==='function') playSfx('btn_click');
    const overlay = document.getElementById('enc-result');
    if(overlay) overlay.classList.add('hidden');
    clearPendingEncounter();
    if(typeof resetToStart==='function') resetToStart();
  });
  const resultDex = document.getElementById('enc-result-dex');
  if(resultDex) resultDex.addEventListener('click', ()=>{
    // 도감 보기 — 도감 화면으로 이동
    if(typeof playSfx==='function') playSfx('btn_click');
    const overlay = document.getElementById('enc-result');
    if(overlay) overlay.classList.add('hidden');
    clearPendingEncounter();
    // 게임 상태 정리 (resetToStart 흐름과 유사하지만 화면만 도감으로)
    if(typeof clearAllBlocks==='function') clearAllBlocks();
    if(typeof showDexScreen==='function') showDexScreen();
    else if(typeof showScreen==='function') showScreen('dex-screen');
  });

  // 로비 자동도망 토글 버튼
  const lobbyAutoFlee = document.getElementById('lobby-auto-flee-btn');
  if(lobbyAutoFlee) lobbyAutoFlee.addEventListener('click', onLobbyAutoFleeClick);
  // 초기 UI 동기화
  updateLobbyAutoFleeUI();
}

// 콘솔 디버그
if(typeof window!=='undefined'){
  window.encounter = {
    decide:      decideEncounter,
    pending:     getPendingEncounter,
    clear:       clearPendingEncounter,
    show:        showEncounterScreen,
    flee:        fleeEncounter,
    tryCatch:    tryCatchEncounter,
    showResult:  showEncounterResult,
    refreshUI:   refreshBallButtons,
    getAutoFlee, setAutoFlee,
    cycleBall, getSelectedBall, getCatchDifficulty,
  };
}
