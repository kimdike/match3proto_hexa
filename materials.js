// ── 재료 시스템 (v0.6 신규) ──
// 3종 재료: 기본볼 재료 / 슈퍼볼 재료 / 하이퍼볼 재료
// 클리어 시 60/30/10% 확률로 1개 무조건 드롭
// 5개 모아 합성 → 해당 볼 1개 완성 (마스터볼 재료 X — 마스터볼은 이벤트 한정)
//
// 의존성: balls.js (addBall)

const MATERIALS_KEY = 'hexPuzzleMaterials';
const MATERIAL_DEFAULT = { basic: 0, super: 0, hyper: 0 };

// 클리어 드롭 확률 (확정 디자인 v0.6: 60/30/10%, 합 100%)
const MATERIAL_DROP_RATE = { basic: 0.60, super: 0.30, hyper: 0.10 };

// 합성 룰: 재료 5개 → 볼 1개
const CRAFT_COST = 5;

const MATERIAL_NAMES = {
  basic: '기본볼 재료',
  super: '슈퍼볼 재료',
  hyper: '하이퍼볼 재료',
};
const MATERIAL_DESC = {
  basic: '5개 모아 기본볼로 합성',
  super: '5개 모아 슈퍼볼로 합성',
  hyper: '5개 모아 하이퍼볼로 합성',
};
const MATERIAL_ORDER = ['basic', 'super', 'hyper'];

// ── 인벤토리 로드/저장 ──
function loadMaterials(){
  try{
    const raw = JSON.parse(localStorage.getItem(MATERIALS_KEY) || 'null');
    if(raw && typeof raw === 'object'){
      return {
        basic: raw.basic | 0,
        super: raw.super | 0,
        hyper: raw.hyper | 0,
      };
    }
  }catch(e){}
  const init = { ...MATERIAL_DEFAULT };
  saveMaterials(init);
  return init;
}
function saveMaterials(m){
  localStorage.setItem(MATERIALS_KEY, JSON.stringify(m));
}
function getMaterial(type){
  const m = loadMaterials();
  return m[type] | 0;
}
function getAllMaterials(){
  return loadMaterials();
}
function addMaterial(type, n){
  n = (n == null) ? 1 : (n | 0);
  const m = loadMaterials();
  if(!(type in m)) return 0;
  m[type] = Math.max(0, (m[type] | 0) + n);
  saveMaterials(m);
  return m[type];
}
function consumeMaterial(type, n){
  n = n|0;
  const m = loadMaterials();
  if(!(type in m)) return false;
  if((m[type]|0) < n) return false;
  m[type] -= n;
  saveMaterials(m);
  return true;
}

// ── 클리어 드롭 ──
// 메인/반복 스테이지 클리어 시 호출. 60/30/10% 확률로 1개 드롭.
// 반환: { type, name } — 클리어 화면 표시용
function dropRandomMaterial(){
  const r = Math.random();
  let type;
  if(r < MATERIAL_DROP_RATE.basic) type = 'basic';
  else if(r < MATERIAL_DROP_RATE.basic + MATERIAL_DROP_RATE.super) type = 'super';
  else type = 'hyper';
  addMaterial(type, 1);
  return { type, name: MATERIAL_NAMES[type] };
}

// ── 합성 ──
// 재료 5 → 볼 1. 성공 시 true, 재료 부족 시 false.
function craftBall(type){
  if(!(type in MATERIAL_DEFAULT)) return false;
  if(getMaterial(type) < CRAFT_COST) return false;
  if(typeof addBall !== 'function') return false;
  consumeMaterial(type, CRAFT_COST);
  addBall(type, 1);
  return true;
}

// 콘솔 디버그
if(typeof window !== 'undefined'){
  window.materials = {
    load: loadMaterials, save: saveMaterials, all: getAllMaterials,
    get: getMaterial, add: addMaterial, consume: consumeMaterial,
    drop: dropRandomMaterial, craft: craftBall,
    MATERIAL_NAMES, MATERIAL_DESC, MATERIAL_ORDER,
    MATERIAL_DROP_RATE, CRAFT_COST,
  };
}
