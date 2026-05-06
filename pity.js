// ── 조우 천장 게이지 (v0.5) ──
// 메인/반복 독립 카운터. 5번 연속 무조우 클리어 후 다음 클리어 100% 조우 보장.
// 조우 분기 자체는 stub (실제 조우 화면/포획 UI는 후속 세션에서 구현).
//
// 흐름:
//   클리어 → rollEncounter(mode) →
//     이전이 5/5(천장 도달)였으면 → 강제 조우 발동 + 카운터 0 리셋
//     아니면 → 카운터 +1 (5에 도달했으면 'justFilled' true → full 이펙트 표시)

// config.js의 상수 사용: PITY_THRESHOLD, PITY_KEY_MAIN, PITY_KEY_REPEAT
function _pityKey(mode){
  return mode==='repeat'?PITY_KEY_REPEAT:PITY_KEY_MAIN;
}

function getPity(mode){
  const v=Number(localStorage.getItem(_pityKey(mode))||0);
  return Number.isFinite(v)?Math.max(0,Math.min(PITY_THRESHOLD,v|0)):0;
}

function setPity(mode,n){
  const v=Math.max(0,Math.min(PITY_THRESHOLD,n|0));
  localStorage.setItem(_pityKey(mode),String(v));
}

function incPity(mode){
  setPity(mode,getPity(mode)+1);
  return getPity(mode);
}

function resetPity(mode){
  setPity(mode,0);
}

function isPityFull(mode){
  return getPity(mode)>=PITY_THRESHOLD;
}

// 클리어 시 호출. 조우 여부 + UI 신호 반환.
//   { encountered: bool, justFilled: bool, before: number, after: number }
//   - encountered: 이번 클리어가 강제 조우인가 (이전 카운터가 이미 5/5였음)
//   - justFilled:  이번 클리어로 카운터가 정확히 5에 도달했는가 (full 이펙트 표시)
//   - before/after: 갱신 전후 카운터값 (UI 애니메이션용)
function rollEncounter(mode){
  const before=getPity(mode);
  if(before>=PITY_THRESHOLD){
    // 이전이 이미 5/5 → 이번 클리어 강제 조우 → 0 리셋
    resetPity(mode);
    console.log(`[pity] ${mode} 천장 트리거 — 조우 강제 발동! 게이지 ${before}/${PITY_THRESHOLD} → 0/${PITY_THRESHOLD}`);
    return { encountered:true, justFilled:false, before, after:0 };
  }
  // 천장 미도달 → +1
  incPity(mode);
  const after=getPity(mode);
  const justFilled=(after>=PITY_THRESHOLD);
  if(justFilled) console.log(`[pity] ${mode} 천장 도달 (${after}/${PITY_THRESHOLD}) — 다음 클리어 시 강제 조우`);
  return { encountered:false, justFilled, before, after };
}

// ── 마이그레이션 (1회) ──
// v0.5 이전: 'hexPuzzleEncounterStreak' 단일 키 → 메인 카운터로 이전
function migrateLegacyPity(){
  const newRaw=localStorage.getItem(PITY_KEY_MAIN);
  if(newRaw!=null) return; // 이미 신키 존재
  const legacy=Number(localStorage.getItem('hexPuzzleEncounterStreak')||0);
  if(Number.isFinite(legacy)&&legacy>0) setPity('main',legacy);
  else                                  setPity('main',0);
  setPity('repeat',0);
}

// 콘솔 디버그 + 마이그레이션 즉시 실행 (config.js가 먼저 로드되므로 상수 사용 가능)
if(typeof window!=='undefined'){
  migrateLegacyPity();
  window.pity={
    get:getPity, set:setPity, inc:incPity, reset:resetPity,
    isFull:isPityFull, roll:rollEncounter,
  };
}
