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

// ── 스테이지 데이터 ──
const STAGES = [
  { stage:1,  target:10000, moves:30, colorTypes:5 },
  { stage:2,  target:15000, moves:28, colorTypes:5 },
  { stage:3,  target:20000, moves:26, colorTypes:6 },
  { stage:4,  target:25000, moves:25, colorTypes:6 },
  { stage:5,  target:30000, moves:24, colorTypes:6 },
  { stage:6,  target:35000, moves:23, colorTypes:6 },
  { stage:7,  target:40000, moves:22, colorTypes:6 },
  { stage:8,  target:45000, moves:21, colorTypes:6 },
  { stage:9,  target:48000, moves:20, colorTypes:6 },
  { stage:10, target:50000, moves:20, colorTypes:6 },
];

// ── 색상 팔레트 ──
const ALL_COLORS = [
  { name:'red',bg:'#e74c3c' },{ name:'orange',bg:'#f39c12' },
  { name:'yellow',bg:'#f1c40f' },{ name:'green',bg:'#2ecc71' },
  { name:'blue',bg:'#3498db' },{ name:'indigo',bg:'#5b6abf' },
  { name:'violet',bg:'#9b59b6' },
];

// ── 조절 가능한 설정값 (인스펙터에서 수정) ──
const CFG = {
  gravityTransition: 0.1,   gravityDelay: 240,
  fillTransition: 0.2,      fillDelay: 200,
  diagTransition: 0.075,    diagDelay: 180,
  projectileTransition: 0.45,
  matchedDelay: 200,         mergeDelay: 130,
  explosionLifetime: 400,
  specialActivateDelay: 100, crossEffectDelay: 200,
  score3match: 300, score4match: 500, score5match: 800,
  combo2bonus: 500, combo3bonus: 1000, combo4bonus: 2000,
  blockScale: 1.1,
};
const CFG_DEFAULTS = {...CFG};
const CFG_META = [
  {key:'gravityTransition',label:'gravity transition',desc:'매치 후 블록이 아래로 떨어지는 애니메이션 시간. 낮을수록 빠르게 착지 (권장: 0.1s ~ 0.5s)',unit:'s',step:0.05,group:'speed'},
  {key:'gravityDelay',label:'gravity delay',desc:'낙하 애니메이션 완료 후 다음 단계 진행까지 대기 시간. gravity transition보다 약간 길게 설정 (권장: 100ms ~ 500ms)',unit:'ms',step:10,group:'speed'},
  {key:'fillTransition',label:'fill transition',desc:'빈 칸에 새 블록이 위에서 내려오는 애니메이션 시간. 낮을수록 빠르게 충전 (권장: 0.1s ~ 0.6s)',unit:'s',step:0.05,group:'speed'},
  {key:'fillDelay',label:'fill delay',desc:'새 블록 충전 완료 후 매치 검사까지 대기 시간. fill transition보다 약간 길게 설정 (권장: 150ms ~ 600ms)',unit:'ms',step:10,group:'speed'},
  {key:'diagTransition',label:'diag transition',desc:'대각선 충전 시 블록이 옆으로 이동하는 애니메이션 시간. 낮을수록 빠름 (권장: 0.05s ~ 0.4s)',unit:'s',step:0.05,group:'speed'},
  {key:'diagDelay',label:'diag delay',desc:'대각선 충전 완료 후 다음 단계까지 대기 시간 (권장: 50ms ~ 400ms)',unit:'ms',step:10,group:'speed'},
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
const DEFAULT_UNLOCKED=[1,4,7,10,15,25];
const DEFAULT_SLOTS=[1,4,7,10,15,25];

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
