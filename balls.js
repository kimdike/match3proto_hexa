// ── 몬스터볼 인벤토리 + 포획 확률 (v0.5 Stage C) ──
// 4종 볼: 기본 / 슈퍼 / 하이퍼 / 마스터
// 자연충전 + 무료 휘발 볼은 C-3에서 추가 (현재는 단순 고정 인벤토리)
//
// 의존성: dex.js (getDexEntry → failStack)

// localStorage 키 — 4종을 단일 객체로 저장
const BALLS_KEY = 'hexPuzzleBalls';

// 첫 사용자 시작 인벤토리 (5/3/2/1)
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
function getBalls(type){
  const b = loadBalls();
  return b[type] | 0;
}
function getAllBalls(){
  return loadBalls();
}
function consumeBall(type){
  const b = loadBalls();
  if(!b[type] || b[type] <= 0) return false;
  b[type] -= 1;
  saveBalls(b);
  return true;
}
function addBall(type, n){
  n = (n == null) ? 1 : (n | 0);
  const b = loadBalls();
  // 음수 차감 시 0 미만으로 안 떨어지게 클램프
  b[type] = Math.max(0, (b[type] | 0) + n);
  saveBalls(b);
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
    BALL_NAMES, BALL_ORDER, BALL_RATE, RARITY_DIFFICULTY,
  };
}
