// ── 헥사 3매치 퍼즐: 상수/설정값 ──
// game.js보다 먼저 로드되어야 함 (index.html)

// ── 보드 기하 ──
const COLS_PATTERN = [9, 8, 9, 8, 9, 8, 9, 8, 9];
const HEX_SIZE = 36;
const HEX_W = HEX_SIZE * 2;
const HEX_H = Math.sqrt(3) * HEX_SIZE;
const COL_SPACING = HEX_SIZE * 1.5;
const ROW_SPACING = HEX_H;
const BLOCK_D = 55;

// ── 18타입 = 18지역 매핑 ──
// 순서: 풀→불꽃→물→전기→노말→비행→독→벌레→격투→땅→바위→에스퍼→얼음→고스트→강철→드래곤→페어리→악
// ⚠️ 출시 시 STAGES_PER_REGION을 100으로 변경 (현재 프로토용 10)
const STAGES_PER_REGION = 10;
const REGION_TYPES = [
  { type:'grass',    name_ko:'풀의 지역'     },
  { type:'fire',     name_ko:'불꽃의 지역'   },
  { type:'water',    name_ko:'물의 지역'     },
  { type:'electric', name_ko:'전기의 지역'   },
  { type:'normal',   name_ko:'노말의 지역'   },
  { type:'flying',   name_ko:'비행의 지역'   },
  { type:'poison',   name_ko:'독의 지역'     },
  { type:'bug',      name_ko:'벌레의 지역'   },
  { type:'fighting', name_ko:'격투의 지역'   },
  { type:'ground',   name_ko:'땅의 지역'     },
  { type:'rock',     name_ko:'바위의 지역'   },
  { type:'psychic',  name_ko:'에스퍼의 지역' },
  { type:'ice',      name_ko:'얼음의 지역'   },
  { type:'ghost',    name_ko:'고스트의 지역' },
  { type:'steel',    name_ko:'강철의 지역'   },
  { type:'dragon',   name_ko:'드래곤의 지역' },
  { type:'fairy',    name_ko:'페어리의 지역' },
  { type:'dark',     name_ko:'악의 지역'     },
];
const REGIONS = REGION_TYPES.map((r,i)=>({
  ...r,
  stageStart: i*STAGES_PER_REGION + 1,
  stageEnd:  (i+1)*STAGES_PER_REGION,
}));
const TOTAL_STAGES = REGIONS.length * STAGES_PER_REGION;
// stage_maps.js에 정의되지 않은 스테이지의 기본 설정 (target은 사실상 dead — 돌 미션이 클리어 조건)
const DEFAULT_STAGE_CONFIG = { target:50000, moves:20, colorTypes:6 };

function getRegionByStage(stage){
  if(typeof stage!=='number'||stage<1||stage>TOTAL_STAGES) return null;
  const idx=Math.floor((stage-1)/STAGES_PER_REGION);
  const r=REGIONS[idx];
  return { index:idx, type:r.type, name_ko:r.name_ko, stageStart:r.stageStart, stageEnd:r.stageEnd, stageInRegion: stage - r.stageStart + 1 };
}
function getStageInRegion(stage){
  const r=getRegionByStage(stage);
  return r?r.stageInRegion:null;
}
function isRegionLastStage(stage){
  if(typeof stage!=='number'||stage<1||stage>TOTAL_STAGES) return false;
  return stage%STAGES_PER_REGION===0;
}
function getStageConfig(stage){
  // stage_maps 데이터 우선, 없으면 DEFAULT_STAGE_CONFIG 폴백
  let sm=(typeof STAGE_MAPS_DATA!=='undefined')?STAGE_MAPS_DATA:null;
  if(!sm&&typeof stageMaps!=='undefined'&&stageMaps) sm=stageMaps;
  const entry=sm?.stages?.find(s=>s.stage===stage);
  return {
    target:     DEFAULT_STAGE_CONFIG.target,
    moves:      entry?.moves      ?? DEFAULT_STAGE_CONFIG.moves,
    colorTypes: entry?.colorTypes ?? DEFAULT_STAGE_CONFIG.colorTypes,
  };
}
function getMonstersByRegion(regionType){
  if(typeof MONSTER_TABLE_DATA==='undefined'||!MONSTER_TABLE_DATA?.monsters) return [];
  return MONSTER_TABLE_DATA.monsters.filter(m=>Array.isArray(m.regions)&&m.regions.includes(regionType));
}

// ── 색상 팔레트 ──
const ALL_COLORS = [
  { name:'red',bg:'#e74c3c' },{ name:'orange',bg:'#f39c12' },
  { name:'yellow',bg:'#f1c40f' },{ name:'green',bg:'#2ecc71' },
  { name:'blue',bg:'#3498db' },{ name:'indigo',bg:'#5b6abf' },
  { name:'violet',bg:'#9b59b6' },
];

// ── 조절 가능한 설정값 (인스펙터에서 수정) ──
const CFG = {
  gravityTransition: 0.2,
  gravityIterDelay: 70,     gravitySettleDelay: 120,
  fillTransition: 0.18,
  diagTransition: 0.1,
  projectileTransition: 0.45,
  matchedDelay: 200,         mergeDelay: 130,
  explosionLifetime: 400,
  specialActivateDelay: 100, crossEffectDelay: 200,
  score3match: 300, score4match: 500, score5match: 800,
  combo2bonus: 500, combo3bonus: 1000, combo4bonus: 2000,
  blockScale: 1.1,
  // 타겟볼 미션 가중치 (1~100). 신규 기믹은 TARGET_WEIGHT_DEFAULT(50) 자동 사용.
  // type 단위 가중치 — 후보가 있는 type 중 weight 비례 random 선택 (후보 수 무관).
  targetWeights: { stones: 50, grass: 30, crates: 50 },
};
const CFG_DEFAULTS = {...CFG, targetWeights:{...CFG.targetWeights}};
const TARGET_WEIGHT_DEFAULT = 50;
function getTargetWeight(type){
  if(CFG.targetWeights && Object.prototype.hasOwnProperty.call(CFG.targetWeights, type)){
    const v = CFG.targetWeights[type] | 0;
    return Math.max(1, Math.min(100, v));
  }
  return TARGET_WEIGHT_DEFAULT;
}
const CFG_META = [
  {key:'gravityTransition',label:'gravity transition',desc:'매치 후 블록이 아래로 떨어지는 애니메이션 시간. 낮을수록 빠르게 착지 (권장: 0.1s ~ 0.5s)',unit:'s',step:0.05,group:'speed'},
  {key:'gravityIterDelay',label:'gravity iter delay',desc:'블록이 여러 칸 떨어질 때 단계 사이 페이싱(iter 사이 대기). transition보다 작으면 블록이 점프하듯 빠르게 보임 (권장: 80ms ~ 150ms)',unit:'ms',step:10,group:'speed'},
  {key:'gravitySettleDelay',label:'gravity settle delay',desc:'중력/충전 루프 종료 후 다음 매치 검사까지 안정화 대기. 연쇄 사이 호흡 — 늘리면 연쇄가 차분해짐 (권장: 150ms ~ 350ms)',unit:'ms',step:10,group:'speed'},
  {key:'fillTransition',label:'fill transition',desc:'빈 칸에 새 블록이 위에서 내려오는 애니메이션 시간. 낮을수록 빠르게 충전 (권장: 0.1s ~ 0.6s)',unit:'s',step:0.05,group:'speed'},
  {key:'diagTransition',label:'diag transition',desc:'대각선 충전 시 블록이 옆으로 이동하는 애니메이션 시간. 낮을수록 빠름 (권장: 0.05s ~ 0.4s)',unit:'s',step:0.05,group:'speed'},
  {key:'projectileTransition',label:'projectile transition',desc:'타겟볼 발사체가 목표 지점까지 날아가는 시간. 낮으면 빠르게 적중 (권장: 0.1s ~ 0.6s)',unit:'s',step:0.05,group:'speed'},
  {key:'matchedDelay',label:'matched delay',desc:'매치된 블록의 pop 애니메이션 재생 후 DOM에서 제거까지 대기 시간 (권장: 200ms ~ 500ms)',unit:'ms',step:10,group:'timing'},
  {key:'mergeDelay',label:'merge delay',desc:'특수블록 생성 시 주변 블록이 중심으로 빨려드는 머지 애니메이션 시간 (권장: 200ms ~ 500ms)',unit:'ms',step:10,group:'timing'},
  {key:'explosionLifetime',label:'explosion lifetime',desc:'폭탄볼 폭발 이펙트(원형 파동)가 화면에 표시되는 시간 (권장: 300ms ~ 700ms)',unit:'ms',step:10,group:'timing'},
  {key:'specialActivateDelay',label:'special activate delay',desc:'특수블록이 발동한 후 파괴된 블록이 사라지기까지 대기하는 시간. 짧으면 발동 연출이 빠르게 진행돼요 (권장: 50ms ~ 500ms)',unit:'ms',step:10,group:'timing'},
  {key:'crossEffectDelay',label:'cross effect delay',desc:'특수블록 교차 효과 발동 후 파괴된 블록이 사라지기까지 대기하는 시간. 짧으면 교차 연출이 빠르게 진행돼요 (권장: 50ms ~ 500ms)',unit:'ms',step:10,group:'timing'},
  {key:'score3match',label:'3매치 점수',desc:'블록 3개를 한 줄로 매치했을 때 획득하는 기본 점수 (권장: 100 ~ 500)',unit:'',step:50,group:'score'},
  {key:'score4match',label:'4매치 점수',desc:'블록 4개를 한 줄로 매치했을 때 획득하는 점수. 특수블록도 함께 생성됨 (권장: 300 ~ 800)',unit:'',step:50,group:'score'},
  {key:'score5match',label:'5매치 점수',desc:'블록 5개를 한 줄로 매치했을 때 획득하는 점수. 상위 특수블록 생성 (권장: 500 ~ 1500)',unit:'',step:50,group:'score'},
  {key:'combo2bonus',label:'2연쇄 보너스',desc:'연쇄 2회 달성 시 추가 보너스 점수. 연쇄가 시작되는 첫 보상 (권장: 200 ~ 1000)',unit:'',step:100,group:'score'},
  {key:'combo3bonus',label:'3연쇄 보너스',desc:'연쇄 3회 달성 시 추가 보너스 점수 (권장: 500 ~ 2000)',unit:'',step:100,group:'score'},
  {key:'combo4bonus',label:'4연쇄+ 보너스',desc:'연쇄 4회 이상 달성 시 추가 보너스 점수. 최대 보상 단계 (권장: 1000 ~ 5000)',unit:'',step:100,group:'score'},
  {key:'blockScale',label:'block scale',desc:'블록 이미지 크기 배율이에요. 1.0이 기본 크기예요 (권장: 0.5 ~ 2.0)',unit:'x',step:0.05,group:'visual'},
];

// ── 스킨/스프라이트 시트 ──
const SPRITE_SHEET='pokemon_sprites_1.png';
const SPRITE_COLS=15, SPRITE_SIZE=215, SHEET_W=3228, SHEET_H=2375;
// v0.5 인트로 6종: 이상해씨 / 파이리 / 꼬부기 / 캐터피 / 피카츄 / 구구
const DEFAULT_UNLOCKED=[1,4,7,10,25,16];
const DEFAULT_SLOTS=[1,4,7,10,25,16];
const DEX_TOTAL=151;

// ── 입력/힌트/로그 ──
const DRAG_THRESHOLD=20;
const HINT_DELAY=5000;
const MAX_MATCH_LOGS=20;
const SWAP_EXPIRE_MS=1500; // 입력 만료 시간

// ── 배속 ──
const SPEED_STEPS=[0.5,1,2,3,4,5];

// ── 6방향 축/이미지 ──
const AXES=[['up','down'],['ne','sw'],['nw','se']];
const SPECIAL_IMAGES={bomb:'assets/specialblock/sb_bombball.png',target:'assets/specialblock/sb_targetball.png',rainbow:'assets/specialblock/sb_rainbow.png'};
const OPPOSITE_DIR={up:'down',down:'up',ne:'sw',sw:'ne',nw:'se',se:'nw'};

// ── 개발자 모드 ──
const DEV_PASSWORD='1013love';

// ── 천장 시스템 (v0.5) ──
// 5번 연속 무조우 시 다음 클리어 100% 조우 보장. 메인/반복 독립 카운터.
const PITY_THRESHOLD=5;
const PITY_KEY_MAIN='hexPuzzlePityMain';
const PITY_KEY_REPEAT='hexPuzzlePityRepeat';

// ── 타입 색상 (18타입 — 로비 발밑 오라/도감 등 시각 표시 공통) ──
const TYPE_COLORS={
  grass:    '#79c95c',
  fire:     '#ff7a3a',
  water:    '#4aa3ff',
  electric: '#ffd34d',
  normal:   '#cdc8b0',
  flying:   '#a3c8ff',
  poison:   '#a960c2',
  bug:      '#9bc34a',
  fighting: '#c84a3a',
  ground:   '#d4a64a',
  rock:     '#a89055',
  psychic:  '#ff5fa0',
  ice:      '#7ce0e0',
  ghost:    '#7363c2',
  steel:    '#a0a8b3',
  dragon:   '#5060c2',
  fairy:    '#ffadd5',
  dark:     '#5a4a3c',
};
