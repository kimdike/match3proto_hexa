// ── 몬스터볼 인벤토리 + 포획 확률 (v0.5 Stage C-3 단순화 모델) ──
// 4종 볼: 기본 / 슈퍼 / 하이퍼 / 마스터
//
// basic은 단일 풀 (자연충전 + 보상 통합):
//   - 보유량 무한 누적 가능 (보상으로 11개 등 5 초과 가능)
//   - 자연충전: basic < 5 일 때만 10분당 +1, 5 이상 도달/유지 시 타이머 정지
//   - 5에서 4로 떨어지는 순간 타이머 시작 (chargeAt = now)
// 표시: "N/5" — N이 5 초과여도 "11/5" 형태 그대로
//
// 의존성: dex.js (getDexEntry → failStack)

// localStorage 키
const BALLS_KEY      = 'hexPuzzleBalls';            // 4종 인벤토리
const CHARGE_AT_KEY  = 'hexPuzzleBasicChargeAt';    // basic 자연충전 마지막 기준 시각

// 자연충전 룰
const NATURAL_INTERVAL_MS = 10 * 60 * 1000; // 10분
const NATURAL_MAX = 5;

// 첫 사용자 시작 인벤토리
const BALLS_DEFAULT = { basic: 5, super: 3, hyper: 2, master: 1 };

// 볼별 기본 포획 확률
const BALL_RATE = { basic: 0.33, super: 0.60, hyper: 0.80, master: 1.00 };

// 한국어 명칭 / 이모지 (UI용)
const BALL_NAMES = {
  basic:  '기본볼',
  super:  '슈퍼볼',
  hyper:  '하이퍼볼',
  master: '마스터볼',
};
const BALL_ORDER = ['basic', 'super', 'hyper', 'master'];

// 몬스터 희귀도 → 난이도 (rarity↑ → 잡기 어려움)
const RARITY_DIFFICULTY = { normal: 1.0, rare: 0.8, epic: 0.6, legendary: 0.4 };

// ── 인벤토리 로드/저장 ──
function loadBalls(){
  try{
    const raw = JSON.parse(localStorage.getItem(BALLS_KEY) || 'null');
    if(raw && typeof raw === 'object'){
      return {
        basic:  raw.basic  | 0,
        super:  raw.super  | 0,
        hyper:  raw.hyper  | 0,
        master: raw.master | 0,
      };
    }
  }catch(e){}
  // 첫 사용자 → 디폴트 지급 + 저장
  const init = { ...BALLS_DEFAULT };
  saveBalls(init);
  return init;
}
function saveBalls(balls){
  localStorage.setItem(BALLS_KEY, JSON.stringify(balls));
}
function getAllBalls(){
  return loadBalls();
}

// ── 자연충전 chargeAt ──
function loadChargeAt(){
  const v = parseInt(localStorage.getItem(CHARGE_AT_KEY) || '0', 10);
  return v || 0;
}
function saveChargeAt(t){
  // ⚠️ Date.now()는 13자리(약 1.7e12)라 `t | 0` 사용 금지 — 32-bit 정수로 잘려 음수 됨.
  // 그러면 다음 loadChargeAt에서 elapsed 거대 → 자연충전 발생 → basic 다시 5로 차오르는 버그.
  localStorage.setItem(CHARGE_AT_KEY, String(Math.floor(t)));
}

// 자연충전 tick — 호출 시마다 elapsed 기반 충전 갱신.
// basic >= 5: 타이머 정지 (chargeAt = now)
// basic < 5 + chargeAt 미설정: chargeAt = now (지금부터 시작)
// basic < 5 + chargeAt 있음: elapsed / interval 만큼 +1, 5 한도까지만.
function tickNatural(){
  const b = loadBalls();
  if(b.basic >= NATURAL_MAX){
    saveChargeAt(Date.now()); // 정지 상태 갱신 (기록만)
    return b.basic;
  }
  let chargeAt = loadChargeAt();
  if(!chargeAt){
    chargeAt = Date.now();
    saveChargeAt(chargeAt);
    return b.basic;
  }
  const elapsed = Date.now() - chargeAt;
  if(elapsed < NATURAL_INTERVAL_MS) return b.basic;
  const add = Math.floor(elapsed / NATURAL_INTERVAL_MS);
  const targetCount = Math.min(NATURAL_MAX, b.basic + add);
  const realAdd = targetCount - b.basic;
  if(realAdd > 0){
    b.basic += realAdd;
    saveBalls(b);
  }
  if(b.basic >= NATURAL_MAX){
    saveChargeAt(Date.now()); // 5 도달 → 타이머 정지
  } else {
    saveChargeAt(chargeAt + add * NATURAL_INTERVAL_MS); // 그리드 유지
  }
  return b.basic;
}

// 다음 충전까지 남은 ms (basic >= 5면 0)
function getNaturalNextChargeMs(){
  tickNatural(); // 충전 갱신 후 측정
  const b = loadBalls();
  if(b.basic >= NATURAL_MAX) return 0;
  const chargeAt = loadChargeAt();
  if(!chargeAt) return NATURAL_INTERVAL_MS;
  const elapsed = Date.now() - chargeAt;
  return Math.max(0, NATURAL_INTERVAL_MS - elapsed);
}

// ── 인벤토리 조회/소비/획득 ──
// basic은 호출 시 자연충전 갱신 (tickNatural)
function getBalls(type){
  if(type === 'basic') tickNatural();
  const b = loadBalls();
  return b[type] | 0;
}

function consumeBall(type){
  const b = loadBalls();
  if(!b[type] || b[type] <= 0) return false;
  b[type] -= 1;
  saveBalls(b);
  // basic이 5에서 4로 떨어지는 순간 — 자연충전 타이머 시작
  if(type === 'basic' && b.basic === NATURAL_MAX - 1){
    saveChargeAt(Date.now());
  }
  return true;
}

function addBall(type, n){
  n = (n == null) ? 1 : (n | 0);
  const b = loadBalls();
  b[type] = Math.max(0, (b[type] | 0) + n);
  saveBalls(b);
  // basic이 5 이상으로 올라갔다면 — 자연충전 타이머 정지
  if(type === 'basic' && b.basic >= NATURAL_MAX){
    saveChargeAt(Date.now());
  }
  return b[type];
}

// ── 포획 확률 계산 ──
// CatchRate = BallRate × MonsterDifficulty × StackBonus × ComboBonus
// 최소 5% / 최대 100% 클램프
function _comboMult(combo){
  combo = combo | 0;
  if(combo >= 15) return 1.10;
  if(combo >= 10) return 1.05;
  if(combo >= 5)  return 1.02;
  return 1.0;
}
function computeCatchRate(ballType, monster, failStack, combo){
  const ballRate   = BALL_RATE[ballType] || 0;
  const difficulty = RARITY_DIFFICULTY[monster?.rarity] || 1.0;
  const stackBonus = 1 + ((failStack | 0) * 0.05);
  const comboBonus = _comboMult(combo);
  let rate = ballRate * difficulty * stackBonus * comboBonus;
  if(rate > 1.0)  rate = 1.0;
  if(rate < 0.05) rate = 0.05;
  return rate;
}

// 실제 던지기 → boolean (성공/실패)
// 호출자가 consumeBall을 따로 호출해야 함 (이 함수는 확률만 굴림)
function tryCatch(ballType, monster, failStack, combo){
  const rate = computeCatchRate(ballType, monster, failStack, combo);
  return Math.random() < rate;
}

// 콘솔 디버그 / 외부 모듈 노출
if(typeof window !== 'undefined'){
  window.balls = {
    load: loadBalls, save: saveBalls, all: getAllBalls,
    get: getBalls, consume: consumeBall, add: addBall,
    rate: computeCatchRate, tryCatch,
    // C-3 자연충전
    tickNatural, nextMs: getNaturalNextChargeMs,
    NATURAL_INTERVAL_MS, NATURAL_MAX,
    BALL_NAMES, BALL_ORDER, BALL_RATE, RARITY_DIFFICULTY,
  };
}
