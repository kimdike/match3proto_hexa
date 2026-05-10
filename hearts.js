// ── 하트 시스템 (v0.6 신규) ──
// 메인 스테이지 입장 시 하트 1 소비. 10분당 +1 자연충전 (Max 5).
// 5 이상 보유 시 충전 정지 (보상으로 5 초과 가능).
// 다이아 1 → 하트 풀 충전 (5/5). balls.js 자연충전 패턴 동일.
//
// localStorage 키:
//   hexPuzzleHeart        — count (number, 보유 하트)
//   hexPuzzleHeartChargeAt — chargeAt (timestamp ms)

const HEART_KEY = 'hexPuzzleHeart';
const HEART_CHARGE_AT_KEY = 'hexPuzzleHeartChargeAt';
const HEART_INTERVAL_MS = 60 * 1000; // 프로토용 1분 (출시 시 10*60*1000으로 변경)
const HEART_MAX = 5;
const HEART_DEFAULT_COUNT = 5;
// 다이아 → 하트 충전 비용 (디자인 결정 v0.6: 다이아 1로 풀 충전)
const HEART_REFILL_DIAMOND_COST = 1;

function loadHeartCount(){
  const raw = localStorage.getItem(HEART_KEY);
  if(raw === null){
    saveHeartCount(HEART_DEFAULT_COUNT);
    return HEART_DEFAULT_COUNT;
  }
  const n = parseInt(raw, 10);
  return isNaN(n) ? 0 : Math.max(0, n);
}
function saveHeartCount(n){
  localStorage.setItem(HEART_KEY, String(Math.max(0, n|0)));
}

function loadHeartChargeAt(){
  const v = parseInt(localStorage.getItem(HEART_CHARGE_AT_KEY) || '0', 10);
  return isNaN(v) ? 0 : v;
}
function saveHeartChargeAt(t){
  localStorage.setItem(HEART_CHARGE_AT_KEY, String(Math.floor(t)));
}

// 자연충전 tick — basic 풀 동일 패턴 (Date.now() | 0 비트 버그 회피, Math.floor 사용)
function tickHearts(){
  let count = loadHeartCount();
  if(count >= HEART_MAX){
    saveHeartChargeAt(Date.now());
    return count;
  }
  let chargeAt = loadHeartChargeAt();
  if(!chargeAt){
    chargeAt = Date.now();
    saveHeartChargeAt(chargeAt);
    return count;
  }
  const elapsed = Date.now() - chargeAt;
  if(elapsed < HEART_INTERVAL_MS) return count;
  const add = Math.floor(elapsed / HEART_INTERVAL_MS);
  const newCount = Math.min(HEART_MAX, count + add);
  if(newCount > count){
    count = newCount;
    saveHeartCount(count);
  }
  if(count >= HEART_MAX){
    saveHeartChargeAt(Date.now());
  } else {
    saveHeartChargeAt(chargeAt + add * HEART_INTERVAL_MS);
  }
  return count;
}

function getHeartCount(){
  tickHearts();
  return loadHeartCount();
}

function getHeartNextChargeMs(){
  tickHearts();
  const count = loadHeartCount();
  if(count >= HEART_MAX) return 0;
  const chargeAt = loadHeartChargeAt();
  if(!chargeAt) return HEART_INTERVAL_MS;
  const elapsed = Date.now() - chargeAt;
  return Math.max(0, HEART_INTERVAL_MS - elapsed);
}

// 메인 입장 시 호출 — 하트 1 소비. 부족 시 false.
function consumeHeart(){
  tickHearts();
  let count = loadHeartCount();
  if(count <= 0) return false;
  count -= 1;
  saveHeartCount(count);
  // 5에서 4로 떨어지는 순간 chargeAt = now (타이머 시작)
  if(count === HEART_MAX - 1){
    saveHeartChargeAt(Date.now());
  }
  return true;
}

// 보상으로 하트 추가 (이벤트/업적 등) — 5 초과 가능
function addHearts(n){
  n = (n == null) ? 1 : (n | 0);
  let count = loadHeartCount() + n;
  count = Math.max(0, count);
  saveHeartCount(count);
  if(count >= HEART_MAX) saveHeartChargeAt(Date.now());
  return count;
}

// 다이아 → 하트 풀 충전 (Max 5로 set). 비용: 다이아 1.
// 반환: { ok:bool, reason: 'no-diamond'|'already-full'|null }
function refillHeartsByDiamond(){
  if(typeof loadDiamond !== 'function' || typeof saveDiamond !== 'function'){
    return { ok:false, reason:'no-diamond-api' };
  }
  const cur = loadHeartCount();
  if(cur >= HEART_MAX) return { ok:false, reason:'already-full' };
  const diamond = loadDiamond();
  if(diamond < HEART_REFILL_DIAMOND_COST) return { ok:false, reason:'no-diamond' };
  saveDiamond(diamond - HEART_REFILL_DIAMOND_COST);
  saveHeartCount(HEART_MAX);
  saveHeartChargeAt(Date.now());
  return { ok:true, reason:null };
}

if(typeof window !== 'undefined'){
  window.hearts = {
    get: getHeartCount, consume: consumeHeart, add: addHearts,
    nextMs: getHeartNextChargeMs, tick: tickHearts,
    refill: refillHeartsByDiamond,
    HEART_MAX, HEART_INTERVAL_MS, HEART_REFILL_DIAMOND_COST,
  };
}
