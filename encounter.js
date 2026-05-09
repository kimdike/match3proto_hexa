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
  const screen = document.getElementById('encounter-screen');
  if(!screen) return;

  // 컨텐츠 채우기
  const m = _pending.monster;
  const msgEl = document.getElementById('enc-msg');
  if(msgEl) msgEl.textContent = `야생 ${m.name_ko}이(가) 나타났다!`;

  const spriteEl = document.getElementById('enc-sprite');
  if(spriteEl){
    spriteEl.style.backgroundImage = `url("assets/dot/pokemon/${m.id}.gif")`;
    spriteEl.style.backgroundSize = 'contain';
    spriteEl.style.backgroundPosition = 'center';
    spriteEl.style.backgroundRepeat = 'no-repeat';
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

  // 화면 전환 (클리어 화면 닫고 조우 화면 띄움)
  if(typeof hideEndScreen==='function') hideEndScreen();
  if(typeof showScreen==='function') showScreen('encounter-screen');

  // 임시 띠로리 (Stage A+B는 sfx_select 재사용, 후속에서 sfx_wild_encounter로 교체)
  if(typeof playSfx==='function') playSfx('select');
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

// 포획 (Stage C에서 구현 — 현재 stub)
function tryCatchEncounter(){
  console.log('[encounter] 포획은 다음 세션 (Stage C)에서 구현');
  if(typeof playSfx==='function') playSfx('btn_click');
  alert('포획 시스템은 다음 세션에서 구현됩니다.\n일단 도망가기로 도감에 발견 등록만 됩니다.');
}

// 화면 이벤트 바인딩 (한 번만)
function setupEncounterScreen(){
  const flee = document.getElementById('enc-flee-btn');
  if(flee) flee.addEventListener('click', fleeEncounter);
  const cat = document.getElementById('enc-catch-btn');
  if(cat) cat.addEventListener('click', tryCatchEncounter);
}

// 콘솔 디버그
if(typeof window!=='undefined'){
  window.encounter = {
    decide: decideEncounter,
    pending: getPendingEncounter,
    clear: clearPendingEncounter,
    show: showEncounterScreen,
    flee: fleeEncounter,
  };
}
