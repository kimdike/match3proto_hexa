# 헥사 3매치 퍼즐 — 기믹 기획서 v0.1

> 본 문서는 기믹 단독 스펙 관리용. design_coregame.md에서 분리.
> 매치/특수블록/충전 룰은 design_coregame.md 11/12/17/18/26/27 섹션과 호환.

---

## 📋 변경 이력

### v0.2 — 2026.05.10
- **미션 모델 D 확정**: stage_maps의 `missions` 배열이 진실의 원천 (HUD + 타겟볼 우선순위 통합)
- **타겟볼 우선순위 일반화**: missions 순서 → 같은 type 안에선 단계 높은 거 → 일반 블록 fallback (부록 H)
- **잔디 빈 셀 예외**: 잔디 셀에 블록이 없어도 타겟볼은 도착 + 단계 -1 (§2-4 보완)
- **트리거 체크리스트** 부록 G 신설
- **special.js 16곳 onBlockDestroyedAt hook 통합**: 줄볼/폭탄/무지개/교차 효과로도 잔디 깎임
- **맵 에디터 미션 설정 UI** 추가: 4종까지, type/count 입력, 우선순위 = 위에서부터

### v0.1 — 2026.05.10
- 기믹 5종 정리 (1.돌 / 2.잔디 / 3.얼음 / 4.상자 / 5.열쇠)
- 돌은 design_coregame.md §26~27에서 이전(원문 호환)
- 잔디/얼음/상자/열쇠는 신규 설계
- design_gimmick.md 신설 (기믹 단독 관리)

---

## 0. 공통 룰

### 0-1. 오브젝트 타입 분류
| 타입 | 정의 | 예시 |
|---|---|---|
| **블록형 (Block)** | 중력 영향 + 매칭 대상 + 빈 셀 충전 | 일반블록, 특수블록, 열쇠 |
| **고정형 (Fixed)** | 중력 무시 + 셀에 고정 + 단계 변화로 제거 | 돌, 상자 |
| **타일형 (Tile)** | 셀 바닥에 깔림 + 그 위에 블록/고정형 공존 | 잔디 |
| **블록 부착형 (Attached)** | 블록 위에 덧씌움 + swap·매칭 방해 | 얼음 |

### 0-2. 단계 감소 트리거 (단계가 있는 기믹 공통)
| 트리거 | 적용 |
|---|---|
| 인접 셀 3+매치 | 단계 -1 |
| 줄볼 라인이 효과 범위에 포함 | 단계 -1 |
| 폭탄볼 폭발 범위 안 | 단계 -1 |
| 타겟볼 타격 범위 안 | 단계 -1 |
| 무지개볼 발동 | 개별 룰 (각 기믹 항목 참조) |
| 특수블록 생성 위치 인접 | 단계 -1 |

### 0-3. 중첩 타격 (교차 효과)
- 줄볼×줄볼(같은방향) / 줄볼×무지개 / 폭탄×무지개 / 타겟볼×무지개 → 중첩 ✅
- 폭탄×폭탄 / 무지개×무지개 → 단일 ❌

### 0-4. 셀 타입과의 관계
| 기믹 | normal | entrance | dead | pass |
|---|---|---|---|---|
| 돌/상자 | ✅ | ❌ | ❌ | ❌ |
| 잔디 | ✅ | ❌ | ❌ | ❌ |
| 얼음 | ✅ (블록 위에 부착) | ❌ | ❌ | ❌ |
| 열쇠 | ✅ (블록형, 어디든 떨어짐) | 출현 가능 | ❌ | 통과 |

---

## 1. 돌 (Stone) — 기존 구현됨

### 1-1. 개요
- 타입: **고정형** (중력 무시, 배치 셀 고정)
- 단계: 5단계 (5단계가 가장 단단함)
- 미션 카운트: ✅ (셀 개수 기준, 단계 무관)

### 1-2. 비주얼
- `assets/gimmick/stone_1.png ~ stone_5.png` (단계별 5장)
- 단계 높을수록 갈라짐 적음

### 1-3. 매칭 상호작용
- 인접 셀에서 3+매치 → 단계 -1
- 단계 0 = 제거 + 미션 카운트 -1
- 매칭 자체에 참여 X (블록 아님)

### 1-4. 특수블록 상호작용
- 줄볼/폭탄/타겟볼/무지개: 효과 범위 내면 단계 -1
- 무지개 단독: 보드 모든 돌 단계 -1 (전체 매칭에 포함되면)

### 1-5. 배치 규칙
- 블록형 위치 차단 (그 셀엔 블록 못 옴)
- 고정형 셀 수직 아래 빈 셀 → 대각선 충전 (왼쪽 우선)
- map_editor.html에서 1~5단계 직접 배치

### 1-6. 중첩 타격
- 동일 돌이 여러 효과 범위에 포함되면 횟수만큼 단계 감소 (§0-3 룰 따름)

---

## 2. 잔디 (Grass) — 신규

블록·고정형 기믹 **아래에 깔리는 타일형 기믹**. 매치-3 표준 (Royal Match의 carpet, Candy Crush의 jelly)을 헥사 그리드에 맞게 재해석.

### 2-1. 개요
- 타입: **타일형** (셀 바닥, 위에 블록/고정형 공존 가능)
- 단계: 2단계 (잔디2 = 깊음 / 잔디1 = 얕음)
- 미션 카운트: ✅
- 매칭/swap: 블록과 무관 (잔디는 셀 바닥 효과)

### 2-2. 비주얼
- 잔디2: **진녹색(#2c5a2c) 헥사 셀 배경 + 격자 무늬 진함**
- 잔디1: **연녹색(#79c95c) 배경 + 격자 무늬 옅음**
- 위에 블록이 있으면 블록은 정상 표시, 셀 바닥만 색이 다름
- 자산 교체 시 `assets/gimmick/grass_1.png`, `grass_2.png` (셀 배경 텍스처)

### 2-3. 매칭 상호작용
- **그 셀에서 블록이 매칭으로 제거되는 순간** 잔디 단계 -1
  - 인접 매칭으로는 X — 그 셀 자체에 매칭 발생해야
  - 위에 고정형(돌/상자)이 있으면 잔디 직접 안 깎임 → 위 기믹 제거 후 충전된 블록이 매칭돼야 비로소 깎임
- 단계 0 = 잔디 사라짐 (셀 normal로 복귀) + 미션 카운트 -1

### 2-4. 특수블록 상호작용
- 줄볼 라인이 그 셀 통과 + 그 셀 블록 제거 → 단계 -1
- 폭탄 폭발이 그 셀 블록 제거 → 단계 -1
- 타겟볼 타격이 그 셀 블록 제거 → 단계 -1 — **빈 셀 예외**: 잔디 셀에 블록이 없어도 타겟볼이 도착하면 단계 -1 (디자인 결정 v0.2)
- 무지개 색 매칭이 그 셀 블록 포함 → 단계 -1
- **위 모두 "그 셀의 블록이 효과로 제거"되어야 잔디 깎임** (단, 타겟볼 빈 셀 예외는 위 참고)

### 2-5. 배치 규칙
- 단독 배치: 빈 normal 셀에 깔림 → 위에 블록 정상 충전
- 다른 기믹과 겹쳐 배치: 돌/상자 아래에 잔디 깔기 가능 (위 기믹 먼저 제거 → 충전된 블록이 매칭되면 잔디 깎임)
- map_editor.html에서 잔디1/잔디2 + 위에 올릴 기믹 선택

### 2-6. 데이터 모델
```js
{ "col":3, "row":4, "type":"grass", "level":2 }
// 또는 위에 돌 같이:
{ "col":3, "row":4, "type":"grass", "level":2, "above":{ "type":"stone", "level":3 } }
```

---

## 3. 얼음 (Ice) — 신규

**블록 위에 설치되어 swap·매칭 방해**하는 부착형. 인접 매칭으로 깎이고 풀리면 안의 블록 정상 사용.

### 3-1. 개요
- 타입: **블록 부착형** (블록 위에 얼음 오버레이)
- 단계: 2단계 (얼음2 / 얼음1)
- 안의 블록: **swap X / 매칭 X** (해방 전까지)
- 미션 카운트: ✅

### 3-2. 비주얼
- 얼음2: **하늘색(#7ce0e0) 헥사 외곽선 굵게** + 안쪽 흐림(blur 2px) + 반짝임 텍스처
- 얼음1: 외곽선 가늘게, 흐림 약함
- 안의 블록은 비침 (opacity 0.5, 회색조 살짝)
- 자산 교체 시 `assets/gimmick/ice_1.png`, `ice_2.png` (반투명 PNG)

### 3-3. 매칭 상호작용
- **얼음 셀 인접에서 3+매치 발생** → 얼음 단계 -1 (안의 블록은 그대로)
- 단계 0 = 얼음 깨짐 + 안의 블록 해방 (다음 turn부터 정상 매칭/swap)
- 해방된 블록이 즉시 매칭 성립 시 다음 turn에 자동 처리

### 3-4. 특수블록 상호작용
- 줄볼 라인 통과: 얼음 단계 -1 (블록은 그대로)
- 폭탄 범위: 단계 -1
- 타겟볼 4칸: 단계 -1
- 무지개 색 매칭: 안의 블록 색이 매칭 색이면 **얼음 + 블록 동시 제거**

### 3-5. 배치 규칙
- 초기 보드의 일부 블록 위에 얼음 부착
- 얼음 깨진 후 해방 블록이 매칭으로 사라지면 → 정상 충전 (충전된 새 블록은 얼음 X)

### 3-6. 데이터 모델
```js
{ "col":4, "row":2, "type":"ice", "level":2, "blockColor":3 }
// blockColor 명시 (얼음 안에 어떤 색 블록 가둘지)
```

---

## 4. 상자 (Crate) — 신규

3단계 고정형. **최종단계 제거 시 주변 1셀 폭발 타격**. 단순 장벽이 아닌 폭발성 트리거.

### 4-1. 개요
- 타입: **고정형**
- 단계: 3단계 (상자3 / 상자2 / 상자1)
- 미션 카운트: ✅
- **특이점**: 단계 0이 되어 제거되는 순간 **인접 6셀 1단계 타격** (연쇄 폭발)

### 4-2. 비주얼
- 상자3: **갈색(#a78050) 정사각형 + 빗금 텍스처 진함** (튼튼한 상자)
- 상자2: 빗금 절반 + 모서리 깨진 자국
- 상자1: 거의 부서진 상태 (외곽선만)
- 자산 교체 시 `assets/gimmick/crate_1.png ~ crate_3.png`

### 4-3. 매칭 상호작용
- 인접 매칭 1회 → 단계 -1
- 효과 범위 1회 → 단계 -1
- **단계 0 = 제거 + 인접 6셀 폭발 타격** (각 셀에 -1 단계 또는 단발 제거)
  - 인접 6셀의 기믹: 단계 있으면 -1 / 단발이면 제거
  - 인접 6셀의 일반 블록: 같은 색 조건 무관 매칭 처리되어 사라짐 (점수 X)
  - 인접 6셀의 특수블록: 발동 (연쇄)
  - 폭발은 1회만 (다른 상자가 또 있으면 같이 터지면서 추가 폭발 가능)

### 4-4. 특수블록 상호작용
- 줄볼/폭탄/타겟볼/무지개 효과 범위 안 → 단계 -1
- 효과로 단계 0 도달 → 폭발 트리거
- 폭발 자체가 또 다른 기믹/블록을 덮침 → 연쇄 가능

### 4-5. 배치 규칙
- 빈 normal 셀에 배치 (블록 위치 차단)
- 보통 cluster로 배치하면 연쇄 폭발 가능 → 전략적 미션 디자인
- map_editor.html에서 1~3단계 직접 배치

### 4-6. 데이터 모델
```js
{ "col":5, "row":4, "type":"crate", "level":3 }
```

### 4-7. 돌과의 차이
| | 돌 | 상자 |
|---|---|---|
| 단계 | 5 | 3 |
| 제거 시 | 미션 카운트만 | **+ 인접 6셀 폭발** |
| 활용 | 장기 도전 | 연쇄 트리거 / 후반 폭발 미션 |

---

## 5. 열쇠 (Key) — 신규

**블록형 + 색 속성 없음** (특수블록과 같은 부류). 보드 최하단까지 떨어뜨리면 제거되며 미션 카운트.

### 5-1. 개요
- 타입: **블록형 (색 속성 없음)**
  - 중력 영향 ✅ / 매칭 X / swap 가능 (특수블록 swap 룰과 유사)
  - 색 매칭 대상 X — 일반블록과 별개
- 미션 카운트: ✅ (보드에서 사라뜨려야 클리어)
- **클리어 조건**: 최하단 행(`row == COLS_PATTERN[col] - 1`)에 도달하면 자동 제거

### 5-2. 비주얼
- **노란색(#ffd34d) 열쇠 모양 아이콘** (둥근 머리 + 사각 몸통 + 톱니)
- 일반 블록 크기와 동일 (BLOCK_D)
- 자산 교체 시 `assets/gimmick/key.png`

### 5-3. 매칭 상호작용
- 일반 블록 매칭에 참여 X (특수블록과 동일)
- 매칭으로 사라지지 않음
- 줄볼/폭탄/타겟볼/무지개 효과 범위에 들어가도 영향 X (특수블록처럼 보호되거나 연쇄 X)
- 단, **swap은 가능** (인접 일반 블록이나 빈 셀과 swap)
- swap 자체가 매칭 트리거하면 매칭은 정상 (열쇠는 빠짐)

### 5-4. 특수블록 상호작용
- 효과 범위에 들어가도 영향 X (열쇠는 견고함)
- 다만 무지개볼 단독 사용 시: 보드 모든 색 블록 제거 → 열쇠는 그대로 남음 (블록 사라진 칸을 채우러 떨어짐)

### 5-5. 동작 룰 — 최하단 도달 제거
- 매 충전/낙하 후 보드 검사 단계에서:
  ```
  for each 열쇠 in board:
    if 열쇠.row == COLS_PATTERN[열쇠.col] - 1:
      열쇠 제거 + 미션 카운트 -1 + "키 회수!" 짧은 연출
  ```
- entrance 셀에서 출현 → 자유 낙하 → 최하단 도달 → 자동 제거
- 중간에 dead 셀이 가로막으면 대각선 충전 룰로 우회

### 5-6. 출현/공급 룰
- 초기 보드 배치 시 N개 미리 배치 가능
- 또는 게임 진행 중 entrance에서 새 열쇠 공급 가능 (`spawnRate: 0.05` 같이)
- 미션 카운트: 보드에 있는 + 앞으로 공급될 열쇠 합산
- map_editor.html에서 초기 위치 직접 배치 + 추가 공급 수 명시

### 5-7. 데이터 모델
```js
// 초기 배치
{ "col":3, "row":2, "type":"key" }
// 미션 헤더에 추가 공급 수
{ "stage":1, "missions": { "stones":3, "keys":5 }, ... }
// → 보드 시작 시 0개 + 5개 공급
```

### 5-8. 활용
- "drop down" 미션 (Royal Match 옥수수, Candy Crush 체리/도토리 등)과 같은 카테고리
- 플레이어가 의도적으로 열쇠 아래의 블록을 매칭해서 떨어뜨려야 함 → 공간 사고 메커닉
- 돌/상자 (제거)와는 다른 결의 미션 → 다양성 확보

---

# 부록 A. 5종 분류표

| 기믹 | 타입 | 단계 | 미션 | 메인 메카닉 |
|---|---|---|---|---|
| 1. 돌 | 고정형 | 5 | ✅ | 인접 매칭으로 단계 감소 |
| 2. 잔디 | 타일형 | 2 | ✅ | 그 셀 매칭으로 깎임 |
| 3. 얼음 | 블록부착 | 2 | ✅ | 인접 매칭으로 깎임 + swap 차단 |
| 4. 상자 | 고정형 | 3 | ✅ | 단계 감소 + 최종 제거 시 주변 폭발 |
| 5. 열쇠 | 블록형(무색) | - | ✅ | 최하단 도달 시 제거 |

---

# 부록 B. 데이터 모델 통합 (stage_maps.js)

```js
{
  "stage": 1,
  "colorTypes": 5,
  "moves": 30,
  "missions": {
    "stones": 3,    // 돌 미션
    "grass":  4,    // 잔디 미션
    "ice":    2,    // 얼음 미션
    "crates": 1,    // 상자 미션
    "keys":   5     // 열쇠 회수 미션 (보드 + 추가 공급 합산)
  },
  "cells": [...],   // entrance/dead/pass (기존)
  "gimmicks": [
    { "col":2, "row":3, "type":"stone", "level":5 },
    { "col":4, "row":2, "type":"grass", "level":2 },
    { "col":3, "row":1, "type":"grass", "level":1, "above":{ "type":"stone", "level":3 } },
    { "col":5, "row":2, "type":"ice", "level":2, "blockColor":3 },
    { "col":1, "row":4, "type":"crate", "level":3 },
    { "col":6, "row":0, "type":"key" }
  ],
  "keyExtra": 4   // 추가 공급 키 수 (entrance에서 들어옴)
}
```

# 부록 C. 코드 구조 제안

### config.js — 기믹 타입 enum
```js
const GIMMICK_TYPES = {
  STONE:  'stone',
  GRASS:  'grass',
  ICE:    'ice',
  CRATE:  'crate',
  KEY:    'key',
};
```

### board.js — applyStageGimmicks 분기
```js
function applyStageGimmicks(stageNum){
  // ... (기존 로직)
  for(const g of stageData.gimmicks){
    const cell = { type: g.type, ...g };
    // 잔디 위에 다른 기믹 깔린 케이스
    if(g.above) {
      gimmick[g.col][g.row] = { type: 'grass', level: g.level };
      // 위 기믹은 별도 레이어 (예: gimmickAbove[col][row])
      gimmickAbove[g.col][g.row] = g.above;
    } else {
      gimmick[g.col][g.row] = cell;
    }
  }
}
```

### match.js — hitGimmick 일반화
```js
function hitGimmick(c, r){
  const g = gimmick[c]?.[r];
  if(!g) return;
  switch(g.type){
    case 'stone': case 'crate':
      g.level = (g.level|0) - 1;
      if(g.level <= 0){
        if(g.type === 'crate') triggerCrateExplosion(c, r);  // 폭발 분기
        destroyGimmick(c, r);
      } else updateGimmickVisual(c, r);
      break;
    case 'ice':
      g.level = (g.level|0) - 1;
      if(g.level <= 0) liberateBlock(c, r);  // 블록 해방
      else updateGimmickVisual(c, r);
      break;
    // 잔디는 별도: '그 셀에서 블록이 사라질 때' 트리거 → onBlockDestroyed에서 처리
    case 'key':
      // 매칭 트리거로 영향 X (특수블록처럼 무시)
      break;
  }
}

// 잔디 전용 — 셀 자체에서 블록 제거 시 호출
function onBlockDestroyedAt(c, r){
  const g = gimmick[c]?.[r];
  if(g?.type === 'grass'){
    g.level = (g.level|0) - 1;
    if(g.level <= 0) destroyGimmick(c, r);
    else updateGimmickVisual(c, r);
  }
}

// 상자 폭발 — 인접 6셀 타격
function triggerCrateExplosion(c, r){
  const neighbors = getNeighbors(c, r);
  for(const [nc, nr] of neighbors){
    const ng = gimmick[nc]?.[nr];
    if(ng) hitGimmick(nc, nr);   // 다른 기믹 단계 -1
    else if(board[nc]?.[nr]) {
      // 일반 블록은 매칭 처리 (점수 X)
      if(blockEls[nc][nr]) blockEls[nc][nr].classList.add('matched');
      board[nc][nr] = null;
    }
  }
}

// 열쇠 — 최하단 도달 검사 (충전 후)
function checkKeysReachedBottom(){
  for(let col=0; col<COLS_PATTERN.length; col++){
    const lastRow = COLS_PATTERN[col] - 1;
    const cell = board[col][lastRow];
    if(cell?.type === 'key'){
      removeKeyAt(col, lastRow);
      keyMissionCount--;
      playKeyCollectFx(col, lastRow);
    }
  }
}
```

---

# 부록 D. 구현 우선순위

### Phase 1 — 인프라 + 단순 기믹 (1세션)
- `hitGimmick`/`destroyGimmick` 일반화 (현재 돌 전용 → 타입 분기)
- `onBlockDestroyedAt` 콜백 추가 (잔디 트리거용)
- 잔디 (Grass) 구현 — 단계 시스템 + 매칭 카운트

### Phase 2 — 폭발 시스템 (1세션)
- 상자 (Crate) 3단계 + 폭발 메카닉
- `triggerCrateExplosion` 인접 6셀 처리 + 연쇄

### Phase 3 — 블록 부착 (1세션)
- 얼음 (Ice) 2단계 + swap·매칭 차단 + 해방 룰
- 새 데이터 모델 (블록 색 명시)

### Phase 4 — 블록형 미션 (1세션)
- 열쇠 (Key) 무색 블록형 + 최하단 도달 제거
- spawn 시스템 + 미션 카운트 합산

총 약 4세션. 각 세션마다 검증 스테이지 1~3에 1개씩 배치해서 동작 확인.

---

# 부록 E. 맵 에디터 UI 메모

`map_editor.html`에 기믹 5종 배치 버튼 추가:

```html
<div class="editor-gimmick-section">
  <!-- 돌 5단계 (기존) -->
  <button data-g="stone" data-level="5">돌5</button>
  <button data-g="stone" data-level="4">돌4</button>
  <button data-g="stone" data-level="3">돌3</button>
  <button data-g="stone" data-level="2">돌2</button>
  <button data-g="stone" data-level="1">돌1</button>

  <!-- 잔디 2단계 -->
  <button data-g="grass" data-level="2">잔디2</button>
  <button data-g="grass" data-level="1">잔디1</button>

  <!-- 얼음 2단계 -->
  <button data-g="ice" data-level="2">얼음2</button>
  <button data-g="ice" data-level="1">얼음1</button>

  <!-- 상자 3단계 -->
  <button data-g="crate" data-level="3">상자3</button>
  <button data-g="crate" data-level="2">상자2</button>
  <button data-g="crate" data-level="1">상자1</button>

  <!-- 열쇠 -->
  <button data-g="key">열쇠</button>
</div>
```

추가 입력 필드:
- 잔디: `above` 토글 (위에 다른 기믹 깔지)
- 얼음: 안의 블록 색 선택 (0~6)
- 열쇠: 추가 공급 수 (스테이지 헤더 `keyExtra`)

인게임 슬라이드 패널(`#placement-panel`)도 동일 동기화.

---

# 부록 G. 트리거 점검 체크리스트 (새 기믹 추가 시 필수)

새 기믹 도입 시 모든 트리거 경로에서 일관 동작하는지 점검. 항목별로 체크.

| # | 트리거 경로 | 코드 위치 | 돌 (단계형) | 잔디 (그 셀형) |
|---|---|---|---|---|
| 1 | 인접 매칭 단계 -1 | game.js processMatchStep | ✅ | ❌ (잔디는 자기 셀만) |
| 2 | 자기 셀 매치로 단계 -1 | game.js 매치 제거 루프 → onBlockDestroyedAt | — | ✅ |
| 3 | 줄볼 라인 효과 범위 | special.js stripe + game.js stripeQueue | ✅ | ✅ (v0.2 hook) |
| 4 | 폭탄 7칸/19칸 폭발 | special.js bomb + game.js bombQueue | ✅ | ✅ (v0.2 hook) |
| 5 | 타겟볼 4칸 area 타격 | game.js area 루프 | ✅ | ✅ |
| 6 | 타겟볼 발사체 도착 | game.js fireTargetProjectile + special.js | ✅ | ✅ (빈 셀 예외 포함) |
| 7 | 무지개 색 매칭 | game.js rainbow → allCellSet | ✅ | ✅ (v0.2 hook) |
| 8 | 무지개 단독 발동 | special.js activateRainbow | ✅ | ✅ (v0.2 hook) |
| 9 | 특수블록 생성 위치 인접 | game.js merge 직후 | ✅ | ❌ (잔디는 인접 무시) |
| 10 | 교차 효과 중첩 | special.js handleCrossEffect 모든 분기 | ✅ | ✅ (v0.2 hook) |

**구현 핵심**:
- 단계형 기믹(돌/상자/얼음): `hitGimmick(c,r)` 호출 (board.js dispatcher)
- 자기 셀형 기믹(잔디): `onBlockDestroyedAt(c,r)` 호출 (block null 직전 또는 빈 셀 예외 시 명시)
- 모든 `board[c][r]=null` 직전에 `onBlockDestroyedAt(c,r)` hook 필수

**검증 방법**:
- 각 트리거 경로별로 검증 스테이지 설계 (해당 효과만 발동하도록 셋업)
- "효과 범위가 잔디 셀을 통과 + 그 셀 블록 제거 → 잔디 깎임" 확인
- "효과 범위가 잔디 셀을 통과했지만 그 셀이 매치 영역 밖 → 잔디 변화 없음" 확인 (인접 무시)
- 타겟볼 빈 셀 도착 → 잔디 깎임 확인 (예외 룰)

---

# 부록 H. 타겟볼 우선순위 (모델 D)

타겟볼이 단독/교차 발동 시 어떤 셀로 날아갈지의 우선순위.

### 룰
1. **`stage_maps.missions` 배열 순서** = type 우선순위 (앞이 1순위)
2. 같은 type 안에서 **단계 높은 거** 우선 (돌 5 > 4 > 3 > 2 > 1, 잔디 2 > 1)
3. 같은 단계 안에서 **random**
4. 이미 카운트 0 인 미션은 skip
5. 모든 미션 후보 소진 시 **일반 블록 random fallback**

### 데이터 모델
```js
// stage_maps.js
{
  "stage": 1,
  "missions": [
    { "type": "grass",  "count": 2 },  // 1순위
    { "type": "stones", "count": 4 }   // 2순위
  ],
  ...
}
```

### ⚠️ 자동 sync 룰 (v0.2 핵심)
**보드 배치 갯수가 진실의 원천**이며 `missions[].count`는 자동 동기화됨:
- **에디터** (`map_editor.html`): 미션 count는 readonly span으로 표시. 보드에 기믹 배치/삭제하거나 미션 type 변경 시 즉시 보드 자동 갯수로 갱신. 사용자는 type 순서만 결정 (= 타겟볼 우선순위).
- **게임 코드** (`board.js loadStageMissions`): 명시 `missions[].count`를 무시하고 `countMissionType(type)`으로 보드 자동 카운트. 어긋남 자체가 발생 X.
- **export 시**: `missions[].count`는 보드 자동값으로 export됨 (사실상 reference value).

**결과**: 사용자가 stage_maps에 `missions: [{type:'grass', count:99}]`로 잘못 명시해도, 게임은 실제 보드의 잔디 갯수만 미션 카운트로 사용. 디자인 의도 보호.

### type별 후보 셀 추출 (board.js `collectMissionCells`)
| type | 후보 추출 룰 | hit 플래그 |
|---|---|---|
| stones | gimmick.type==='stone' | isStone:true |
| grass | tile.type==='grass' (블록 유무 무관 — 빈 셀 예외) | isGrass:true, isStone:false |
| crates | gimmick.type==='crate' (TBD) | isStone:true (셀 자체 타격) |
| ice | gimmick.type==='ice' (TBD) | isStone:false (블록 부착) |
| keys | board[c][r].type==='key' (TBD) | isStone:false |

### 도착 처리 분기 (special.js + game.js)
- `hit.isStone` → `hitStone(rc,rr)` 호출 (셀 자체 단계 -1)
- 그 외 → `onBlockDestroyedAt(rc,rr)` 호출 + board[rc][rr] 있으면 일반 블록 제거 (잔디 빈 셀이면 onBlockDestroyedAt만)

### 후방 호환
- `stage_maps`에 missions 미정의 시 → 기존 방식(돌만 우선) fallback
- 점진 마이그레이션 가능

### 디자인 자유도 확장 (향후)
- missions 항목에 `levelOrder: 'asc'|'desc'` 옵션
- 또는 별도 `targetPriority` 명시 모드 (level 단위까지 직접 지정)

---

# 부록 F. 이상한 점 / 의문점 / 다음 세션

## 이상한 점
1. **잔디 + 위 기믹 조합 데이터 모델**: 1셀에 2 기믹 ("위 기믹"과 "잔디")이 올라가는 건 처음. 코드 구조상 `gimmick[][]` 외에 `gimmickAbove[][]` 별도 배열 또는 `gimmick[][]` 객체에 `above` 필드 권장.
2. **상자 폭발 시 점수**: 현재 매칭 점수와 별개로 폭발은 점수 X로 명시. 다만 폭발이 또 다른 매칭 트리거할 경우 그 매칭은 정상 점수.
3. **열쇠 swap 룰**: 특수블록 swap 룰을 그대로 따른다고 했는데, 특수블록은 swap = 자기 발동. 열쇠는 swap = 단순 위치 이동만 (발동 X)이라는 점 명시 필요.

## 의문점
1. 열쇠가 entrance에서 spawn 빈도 — 고정 vs 확률? 우선 단순 "초기 보드 배치 + 미션 헤더 추가 공급" 모델 (총 N개 명시).
2. 잔디가 미션 카운트일 때 "그 셀의 블록이 매칭으로 사라져야 잔디 깎임"이 명확. 다만 진단 도구 필요 (왜 잔디가 안 깎이는지 디버그 어려울 수 있음).
3. 상자 폭발이 다른 상자의 폭발을 trigger하는 연쇄 — 무한 연쇄 방지 (`hitStones` Set 패턴 따라 같은 cell 중복 처리 방지 필수).

## 다음 세션 추천
1. 부록 D Phase 1부터 시작 — 인프라 일반화 + 잔디 구현
2. 동시에 design_coregame.md에서 §26~27 (돌 기믹) 항목을 design_gimmick.md로 이전 + "기믹 상세는 design_gimmick.md 참조" 링크만 남기기
3. 검증 스테이지: 1~3에 새 기믹 1개씩 배치
4. 맵 에디터 5종 배치 버튼 추가
