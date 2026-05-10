# 헥사 3매치 퍼즐 - 작업일지

> 💡 이 문서는 처음 개발을 시작하는 분들을 위해 작업 흐름을 순서대로 기록한 문서입니다.
> 각 날짜별로 무엇을 했는지, 왜 했는지, 어떤 순서로 진행했는지를 담았습니다.

---

## 2026.05.10 (19일차 후반) — C-3 몬스터볼 자연충전 + skin/devClear 호환 fix

기믹 phase 1 검증 후 메타게임 C-3 (몬스터볼 자연충전) 진행.

### C-3 자연충전 단일 풀 모델
사용자 검토 결과 처음 짠 3-rail (natural / freeBasic / 일반 basic) 분리는 너무 복잡. **단일 풀 모델**로 단순화 — `hexPuzzleBalls.basic` 자체가 자연 + 보상 통합 풀. 자연충전은 풀이 5 미만일 때만 진행, 5 이상이면 정지. 보상으로 11개 등 5 초과 보유 가능.

- balls.js 전체 갈아엎기 — 단일 풀 + `hexPuzzleBasicChargeAt` 트래킹
- 소비 우선순위 분기 폐기 (단일 풀이라 단순 -=1)
- main.js `onStageCleared` 폐기 (freeBasic 무료 휘발 폐기, 향후 재료 시스템으로 대체)
- ui.js 로비 "기본볼 자연충전" 카드 (`🔴 N/5 +mm:ss`) — N이 5 이상이면 timer 숨김 + is-full

### `Date.now() | 0` 비트 버그 (root cause)
처음 `saveChargeAt(t | 0)` 사용. 13자리 timestamp(약 1.7e12)가 **32-bit 정수로 잘려 음수**로 저장됨. 다음 호출 `loadChargeAt`이 음수 반환 → `elapsed = Date.now() - 음수` = 거대한 양수 → 자연충전 트리거 → b.basic 4→5 다시 차오름. 사용자 보고 "throw 후에도 5/5 그대로" 원인.
- fix: `String(t | 0)` → `String(Math.floor(t))`

### 셀렉터 카운트 표시 fix (encounter.js)
`refreshBallButtons` / `refreshSelectedBall`이 `getAllBalls()` (일반 인벤토리만) 사용해서 자연 풀 변화 안 보였음. `getBalls(t)` (단일 풀이라 합산 의미 X, 그대로 풀 카운트) 사용으로 변경.

### devForceClear 미션 모델 D 호환
C 치트가 미션 모델 D 도입 후 안 작동. 옛 카운터(`totalStones=0`)만 set + score=stageTarget 했는데, `isMissionCleared()`가 `currentMissions[].count` 기반 → sync 안 됨.
- fix: `currentMissions[].count = 0` 모두 강제 + `updateMissionUI()` 호출

### 가방 (인벤토리) 화면 신규
사용자 컨셉: "관리 UI"가 아니라 "탐험 도구함" — 포켓몬GO 스타일 toy 감성. 우하단 "준비중" → 🎒 가방.

- 3탭: 포획(4종 볼) / 재료(사탕 + 향후 재료) / 특수(실루엣 placeholder)
- 골드/다이아는 가방 X — 로비 헤더 카드에서 관리 (역할 분리)
- 리스트형 카드 (그리드 X), 자연충전 ⏱는 로비 카드만 표시 (가방 X)
- 카드 탭: bounce 애니 (scale 1.0→1.10→1.04→1.0 + ±2° wiggle, 200ms)
- 모달: 닌텐도 스타일 + hero 아이콘 idle bob (1.6s 무한)
- 모달 닫기: ✕ 버튼 + 바깥 영역 탭 둘 다
- **첫 시도 fix**: showScreen 화면 목록에 'bag-screen' 빠뜨림 → 뒤로가기 시 bag이 lobby 위에 그대로 떠있어 안 닫힘. 배열에 추가하여 해결
- **톤 fix**: 처음 soft green으로 짰는데 도감/스킨과 톤 안 맞아 어색 → 크림/옐로우(#fff8e7 + 도트 패턴 + Black Han Sans 24px)로 통일
- 카운터 배지 + 헤더 타이틀 폰트도 도감/스킨과 1:1 통일

### 기획서 갱신 (design_system.md v0.6)
- §4-5 몬스터볼 — 단일 풀 모델로 단순화 (자연충전 = basic 자체, 5 미만일 때만 진행, 보상으로 5 초과 가능)
- §4-6 재료 시스템 신규 — 3종 재료(기본/슈퍼/하이퍼), 클리어 시 60/30/10% 드롭, 5개 합성 → 볼 1개. 옛 조각 시스템 폐기
- §12-8 가방 화면 신규
- §14 상점 시스템 갱신 — 합성 탭 + 골드 구매 + 스킨/프리미엄
- §16 개발 진행 현황 — 19개 완료 항목 정리 + TODO에 재료/상점/볼 부족 다이얼로그 추가

### skinData 캐시 reload
"처음으로" → 새 계정 생성 → stage 1 시 옛 스킨 그대로 보이는 버그. game.js `let skinData = loadSkinData()` 가 모듈 로드 시 한 번만 호출되어 메모리 캐시. 인트로에서 슬롯 set 후 캐시 갱신 X.
- fix: `lobby.js` 인트로 끝(starter 지급 후) `skinData = loadSkinData()` 재호출
- fix: `main.js startGame` 시작에도 동일 재호출

### 💡 오늘의 교훈
1. **`x | 0` 트릭은 32-bit 안전 영역만**: timestamp/큰 숫자에 쓰면 silently wrap. `Math.floor(x)` 또는 그냥 `Number(x)` 써야 안전. 한 글자 차이로 자연충전 시스템 전체가 무한 트리거되는 버그 생김.
2. **다중 풀 분리는 도입 전 한 번 더 검토**: 처음 짠 3-rail은 구조상 단순해 보였지만 사용자 의도(단일 풀 + 5 임계값)와 안 맞아 갈아엎었다. 스펙 §4-5의 휘발 동기는 차후 "재료 + 합성"으로 대체될 예정 — 디자인 의도를 코드 구조에 직접 박기 전에 한 번 더 사용자 모델 확인이 단축 경로.
3. **메모리 캐시는 명시 reload 지점 필수**: `let x = loadX()` 모듈 로드 시 한 번 캐시는 편하지만, 데이터 변경(slots/missions 등) 후 reload 안 하면 stale. 갱신 시점이 다양하면 함수 호출자가 책임지고 reload — 또는 `getX()` 매 호출 reload.
4. **디버그 console.log 박는 시점**: 사용자가 "5 그대로" 보고 → 첫 try에서 storage 자체 변화도 안 보였음. forEach 안에 `console.log(els.length, before, after)` 박으니 즉시 원인(getBalls가 4 받고 다시 5 반환)이 드러남. 의심 시점에 한 번 박는 게 시간 절약.

---

## 2026.05.10 (19일차) — 기믹 인프라 일반화 + 잔디(Grass) Phase 1 + 미션 모델 D + 맵 에디터 미션 설정

design_gimmick.md 부록 D Phase 1을 시작. 잔디 단일 기믹만 들어가는 줄 알았는데 검증하면서 줄볼/폭탄/무지개 트리거 누락이 드러나서 special.js 21곳 통합 마이그레이션, 그리고 미션 모델 + 타겟볼 우선순위 + 맵 에디터까지 한 패키지로 묶여 진행됐다.

### Phase 1: 잔디 인프라 + 단독 잔디 구현
- **별도 레이어 결정**: 잔디는 타일형이라 `gimmick[][]` 에 넣으면 gravity 시스템(stone과 동일 장벽 처리)이 깨짐. 별도 `tile[col][row]` + `tileEls[col][row]` 신설로 해결.
- **board.js**:
  - 일반화 dispatcher 신설: `hitGimmick` (type 분기) / `destroyGimmick` / `placeGimmick`
  - 잔디 헬퍼: `placeGrass` / `removeTile` / `updateTileVisual` / `spawnTiles` / `countGrass` / `hasGrass`
  - 트리거: `onBlockDestroyedAt(c,r)` — 그 셀에 잔디 있으면 단계 -1, 0이면 제거 + 미션 카운트 -1
  - `applyStageGimmicks` type 분기: `g.type === 'grass'` → tile 적재 / 나머지 → gimmick 그대로
  - `clearAllBlocks` / `initBoard` 등에 tile 초기화 추가
- **game.js**: 매치 제거 루프 / 타겟볼 area / 발사 3곳에 `onBlockDestroyedAt` hook
- **main.js startGame**: `spawnTiles()` + `initialGrass = countGrass()` 초기화
- **main.js checkGameEnd**: 돌+잔디 둘 다 0이어야 클리어 (이후 `isMissionCleared()`로 일반화됨)
- **style.css**: `.gimmick-tile` z-index 0 (hex-cell 위, hex-block 아래로 정확히 끼움). grass-2=진녹 #2c5a2c / grass-1=연녹 #79c95c + 격자 텍스처
- **stage_maps stage 1**: 검증용 잔디 2개 배치

### Phase 1 검증 중 발견한 이슈 3건
1. **z-index 충돌** — 처음 `.gimmick-tile` z-index를 1로 했는데 `.hex-block`도 1. DOM 순서로 잔디가 블록 위에 덮여 시작 시 블록이 가려짐. 잔디 0으로 낮춰서 hex-cell(0)/잔디(0, DOM 후행)/hex-block(1) 정확히 stack.
2. **HUD 미션 카드가 잔디 미반영** — 단순 합산 표시(`totalStones+totalGrass`)라 잔디 갯수 시각화 X. 멀티 카드(1/2/3/4 카운트별 레이아웃) 도입.
3. **줄볼/폭탄/무지개로 잔디 안 깎임** — Phase 1에서 의도적으로 미룬 special.js 21곳 통합이 수면 위로. game.js 메인 매치 제거 루프 + 타겟볼만 hook 됐고 special.js 직접 `board[c][r]=null` 경로 다수가 잔디 트리거 누락.

### Phase 1.5: special.js 16곳 onBlockDestroyedAt 통합 마이그레이션
- 모든 `board[c][r]=null` 직전에 `onBlockDestroyedAt(c,r)` hook 추가 (rainbow self/targets, chainSpecials, target step2, self destroy, cross removeBoth, destroyCells, initialDestroy×2, areaKill×3, stripe inline destroyed, rainbow+bomb converts, rainbow+target finalHit, target self)
- 동일 패턴(`initialDestroy` 루프, `areaKill` 처리)은 `replace_all=true`로 묶음 처리
- 결과: 줄볼/폭탄/타겟볼/무지개/10가지 교차 효과 모두 잔디 일관 트리거

### 미션 모델 D 도입
사용자 제안: "에디터에서 미션 설정도 사용자가 직접 할 수 있게 하자" + "어떤 기믹에 우선으로 갈지, 어떤 기믹의 높은 단계부터 우선으로 갈지 이런 걸 넣어야 해서". 두 축의 우선순위 — 기믹 종류(cross-type) + 같은 종류 안 단계(intra-type) — 를 분석해 후보 D(Two-key sort, missions 순서 + 자연 룰 단계 정렬)로 결정.

- **데이터 모델**: `stage_maps.missions: [{type, count}, ...]` — 배열 순서가 우선순위
- **board.js**: `currentMissions` 글로벌 + 헬퍼 6개 (`loadStageMissions` / `decrementMission` / `isMissionCleared` / `hasMissionDefined` / `collectMissionCells` / `countMissionType`)
- **타겟볼 우선순위 일반화** (special.js `getTargetBallTarget`): missions 순서 → 같은 type 안 단계 높은 거 → random fallback. 후방 호환: missions 미정의 시 기존 돌 우선
- **잔디 빈 셀 예외**: 사용자 결정 — "잔디 셀 빈 셀이어도 타겟볼 도착해서 단계 -1". 도착 처리 5곳(game.js + special.js stripe+target / target+target / bomb+target / rainbow+target / computeSpecialEffect step2)에 `if(!board[rc]?.[rr]) onBlockDestroyedAt(rc,rr)` 추가
- **HUD 멀티 카드** (`updateMissionUI` 동적 렌더링): 1개=정중앙(큰)/2개=가로(중)/3개=2+1(작)/4개=2x2(작). `mission-list[data-count]` CSS grid 레이아웃 + `MISSION_ICONS` 매핑

### 맵 에디터 미션 설정 UI + 자동 sync
사용자 이슈: "돌 미션 개수가 맵에 배치된 돌 기믹 수랑 다르네. 자동 체크가 되어야 해."
→ "보드 배치 = 진실의 원천" 통일. 양쪽(에디터 + 게임 코드) 자동 sync.

- **에디터 (`map_editor.html`)**:
  - 잔디 도구 버튼 2개 (CSS 헥사 도형, gimmick-tile과 동일 톤)
  - 잔디 셀 렌더링 + `onCellClick` stone/grass 일반화
  - 미션 패널: 4개까지 + type 드롭다운 + count **readonly span** + ✕ 삭제 + "+ 미션 추가" 버튼
  - 우선순위 안내 텍스트
  - `syncMissionsToBoard()` 헬퍼 — `renderMissions` 시작에서 자동 호출 → 모든 진입점에서 `count = countTypeOnBoard(type)` 보장
  - import/export missions 처리
  - addMission 디폴트 type = "미션에 없는 첫 type" (작은 UX 개선)
  - 스테이지 요약에 미션 카운트 추가
- **게임 코드 (`board.js loadStageMissions`)**: 명시 `missions[].count` 무시하고 `countMissionType(type)`으로 보드 자동. 어긋남 자체가 발생 X.

### design_gimmick.md v0.2
- §2-4 잔디 빈 셀 예외 룰 추가
- **부록 G** 신설: 트리거 점검 체크리스트 (10경로 × 2기믹). 새 기믹 추가 시 필수 점검
- **부록 H** 신설: 타겟볼 우선순위 룰 (모델 D) + 자동 sync 룰 + 도착 처리 분기

### 💡 오늘의 교훈
1. **타일형은 별도 레이어**: 같은 차원(`gimmick[][]`)에 다른 동작 룰을 욱여넣으면 시스템이 깨진다. 잔디는 셀 바닥 + 위 블록 공존 — 처음부터 별도 레이어로 분리한 게 정답이었음.
2. **트리거 누락은 신규 기믹의 산문**: special.js의 21곳을 Phase 1에서 미뤘는데 검증 즉시 드러남. design_gimmick.md 부록 G 체크리스트가 그 증거. 새 기믹 추가 시 모든 트리거 경로를 점검하지 않으면 일관성 깨짐.
3. **z-index 동일 + DOM 순서 의존은 함정**: hex-block(1) vs gimmick-tile(1) 동일이면 DOM 순서가 결정. spawn 순서가 바뀌면 시각이 바뀜. 0/0/1 같이 정확히 끼우는 게 안전.
4. **자동 sync = 진실의 원천 단일화**: missions count를 사용자 입력 + 보드 배치 두 곳 두면 어긋남 발생 가능. "보드 = 진실의 원천" 한 줄로 단순화하니 디자인 의도(type 순서)와 구현 정합성(count) 분리됨.
5. **모델 D vs 명시 우선순위**: 처음엔 별도 `targetPriority` 필드도 고려했지만, 미션 정의 = 우선순위 통합이 디자인 의도를 직접 표현(type 순서가 곧 우선순위). 향후 자유도가 더 필요하면 `levelOrder` 옵션 필드 / 명시 모드를 점진 추가 가능 — 처음부터 over-engineering 안 한 게 옳았음.

---

## 2026.05.09~10 (17~18일차) — 야생 조우/포획 풀스펙 + UI 전면 리디자인

집-회사 git divergence 복구로 시작 → 18지역 매핑 → 조우/포획 풀스펙 → UI 리디자인까지 한 묶음.

### Git divergence 복구 (집 세션 시작)
- 회사가 04f4b6a "도감 풀스펙 + 천장 게이지 + 스킨 정비" push했으나 집에서 fetch 안 함
- 집에서 18지역 매핑 + 속도 변수 분리 + 인스펙터 툴팁 버그 수정 작업 후 발견
- `git stash push -u` → `git pull` → `git stash pop` 자동 머지 성공 (충돌 0건)
- 회사 ui.js 177줄 vs 집 ui.js 24줄이 영역 안 겹쳐서 운 좋게 머지됨
- 메모리화: `feedback_multimachine_git.md` — 다음부터 세션 시작 시 fetch 의무

### 18지역 매핑 시스템 (config.js)
- `STAGES_PER_REGION` 한 줄로 프로토(10) ↔ 출시(100) 토글
- `REGIONS` 18종 + `getRegionByStage` / `getStageInRegion` / `isRegionLastStage` / `getStageConfig` / `getMonstersByRegion` 헬퍼
- 기존 `STAGES` 배열 폐기 → `getStageConfig`로 통합 (stage_maps 우선 + DEFAULT_STAGE_CONFIG 폴백)
- 로비 상단 "KANTO LEAGUE" → "풀의 지역 1/10" 동적 표시
- 속도 변수 분리: `gravityDelay` → `gravityIterDelay` (iter 페이싱) + `gravitySettleDelay` (콤보 호흡)
- dead code 제거: `fillDelay` / `diagDelay` (4월 18일 모듈화 후 미참조)
- 인스펙터 툴팁 transform 부모 영향 회피: `body`로 detach + CSS 셀렉터 단순화

### 야생 조우 시스템 (encounter.js 신설)
- `decideEncounter(stage, pityResult, combo, mode)`: **튜토리얼 > 천장 > 25%+콤보보너스** 우선순위
- rarity 가중치 (normal 80 / rare 18 / epic·legendary 2) 1마리 추첨
- 풀 부족 지역(악 등) 비어있으면 조우 무발생
- pity.js `rollEncounter` 결과 + 자체 확률 통과 시 `resetPity`로 카운터 0 동기화
- 튜토리얼 강제: 1=이상해씨 / 5=뚜벅쵸 / 10=모다피 / 15=아라리 (`monster_table.tutorial_stage` 매칭)

### 포획 시스템 (balls.js 신설)
- 4종 인벤토리: 기본 5 / 슈퍼 3 / 하이퍼 2 / 마스터 1 (시작값)
- 확률 공식: `ballRate × MonsterDifficulty × StackBonus × ComboBonus` (최소 5% / 최대 100%)
- failStack 누적 (포획 실패 시 +1, 성공 시 0 리셋), 콤보 보너스 (5/10/15+)
- 마스터볼 100% 확정 / 다른 볼은 rarity별 차감

### DEV 즉시 클리어 + 인벤토리 stepper
- 우상단 `⚡ 클리어! (C)` 버튼 + 단축키 C → `totalStones=0 + score=stageTarget` → `checkGameEnd` 트리거
- 개발자 패널: 4종 볼 ±5 stepper (이벤트 위임으로 안정적 바인딩)
- `addBall` 클램프 추가 (음수 차감 시 0 미만 방지)

### 자동 도망 영구 토글 + 점진 노출
- `localStorage hexPuzzleAutoFlee` (ON/OFF) + `hexPuzzleAutoFleeSeen` (첫 ON 트리거)
- 신규 유저: 로비 토글 안 보임 → 첫 v체크 ON 시점에 노출 시작
- 로비 풀밭 우상단 골드 펄스 / 반투명 OFF
- 양쪽 UI 자동 동기화 (조우 화면 ↔ 로비)
- "처음으로" 청소 키 확장: `hexPuzzleBalls` / `AutoFlee` / `AutoFleeSeen` / `Pity*`

### UI 전면 리디자인 (포켓몬 GO 스타일)
디자인 키워드: 야생 조우 경험, 같은 공간 안에서 결과 발생, 모바일 캐주얼 polish.

**진입 transition** — 검은 유기 wipe (`.enc-vortex` ::before/::after 블롭 2개가 반대 방향 회전 + border-radius 변화로 화면 덮음 → 사라짐). 포켓몬 전투 진입 느낌.

**타입별 분위기 배경** — 18타입 모두 매핑 (`[data-region-type="grass"]` radial-gradient 등). 떠오르는 파티클 6개 + vignette.

**레이아웃 시선 흐름**:
- 좌상단 X (도망 보조 액션, 32×32 원형)
- 지역 라벨 (uppercase letter-spacing 4px)
- 큰 이름 36px Black Han Sans ("야생 OO!")
- 스프라이트 180px + drop-shadow + soft white glow + radial spotlight
- 메타 #001 · 타입 태그
- **볼 셀렉터** (좌우 화살표 + 큰 볼 56px + 이름/수량/난이도)
- 난이도 dots: ●○○ 어려움 / ●●○ 보통 / ●●● 높음 / ★★★ 확정 (failStack 자동 반영)
- **메인 CTA** 22px 골드 알약 + pulse + 플라스틱 광택 (안쪽 하이라이트 + 음영)
- 자동 도망 v체크 (하단 작게)

### 결과 = 모달 팝업 (페이지 이동 X)
- `.enc-result-overlay` — 메인 패널 위 backdrop blur 모달
- 팝업 scale 0.85→1 bounce + 아이콘 0.4→1.2→1 (장난감 느낌)
- 성공: ✨ 잡았다! + **별 8개 outward burst** + #번호 + [계속하기/도감 보기]
- 실패: 💨 앗! 도망쳤다! + 다음 시도 +5% 보정 안내 + [다시 던지기/도망가기]
- 성공 시 sprite 볼 안 유지 (scale 0) — "잡힌 후 포켓몬은 볼 안에 있다"는 시각적 일관성

### 던지기 연출 (포물선 + 흔들림 + 결과)
- 포물선 비행 0.6s, peak 90% / land 70% / 회전 720°
- 몬스터 흡수: filter brightness/sepia/saturate/hue-rotate로 빨간 flash → scale 0
- 흔들림 3회 진폭 점점 감소: ±12° → ±8° → ±4° (총 1.2s)
- 성공: 별빛 펄스 (box-shadow glow) / 실패: 볼 깨짐 + 몬스터 재등장

### 도감 → 스킨 연결
- 도감 상세 모달 (포획/진화 상태)에 `🎨 스킨으로 장착하기` 버튼
- 클릭 시 도감 상세 닫고 스킨 화면 진입
- 잡기 → 도감 보기 → 스킨 장착 자연스러운 루프 완성

### 💡 오늘의 교훈

1. **멀티머신 git divergence는 발견 시점이 비용**: 일찍 발견하면 stash+pull+pop만으로 끝, 늦으면 충돌 다발. 세션 시작 시 fetch 의무화 메모리.
2. **자동 머지 성공도 "운"이라는 인식**: ui.js 177줄 vs 24줄이 영역 안 겹쳤기 때문. 다음엔 운 안 좋을 수도.
3. **UI 리디자인은 단계별 검증**: 한 번에 갈아엎지 말고 [구조 → 기본 스타일 → 텍스트 → 버튼 polish → 연출] 순서로 사용자가 단계마다 확인. 사용자 피드백 흐름 따라가는 게 결과물 퀄리티 높음.
4. **결과 = 페이지 vs 모달의 UX 차이**: 페이지 전환은 정보 전달용, 모달은 흐름 유지용. "같은 공간 안에서 결과 발생"이 도파민 강화. UX 디테일이 곧 게임감.
5. **failStack 시각화**: 단순 데이터 누적이 아닌 dots 자연 상승으로 시각화 → "계속 시도하면 잡을 수 있다" 직관 전달. 메커닉이 UI 통해 대화하는 게 좋은 디자인.
6. **개발자 모드 stepper의 견고함**: querySelectorAll로 직접 바인딩보다 부모 컨테이너에 이벤트 위임이 안전. 동적 DOM 변경에도 강함.

---

## 2026.05.06 (16일차)

### 🎯 로비 재설계 한 묶음 구현

design_system.md v0.5 기반 로비 재설계를 한 세션에 묶어 구현. 트레이너만 자산 이슈로 보류.

#### 풀밭 자유 워크 (POC → 6마리 동시)
- `lobby.js` 신설: ui.js의 풀밭 코드 이전 + 트레이너/단계전환/오라/인트로 통합
- 6마리 덱 슬롯(`hexPuzzleSlots`) 기반 .gif 도트 동시 워크
- 경계 점진 회귀 스티어링(직각 반사 폐기) + 22% 휴식 + 마리별 속도 22~36px/s
- z-index 자동 정렬(y 좌표 기준 앞뒤 깊이감)
- 좌우 방향: `vx>0?-1:1` (.gif 본디 왼쪽 향함)

#### 시각 키 보정 시스템 (visual_h 필드 신설)
- monster_table.json에 `visual_h` 옵셔널 필드 추가 (도트가 키보다 크게/작게 그려진 종 보정용)
- 도감의 진실 데이터(`height_m`)와 표시 보정(`visual_h`)을 분리
- 독침붕(15)에 `visual_h: 1.6` 부여 (S → L 카테고리 진입)
- ui.js 사이즈 매핑 6단계: XS(38) / S(48) / M(56) / L(76) / XL(96) / XXL(116)

#### 풀밭 단계 자동 교체
- 보유 마릿수 기반 0~9 / 10~19 / 20~29 / 30+ → stage_0~3 배경 자동
- `applyMeadowStageBackground()` — startLobbyMeadow 시 `.lobby-character-area` background 갱신

#### 프로필 카드 통합 (UI 노출만)
- `.lobby-top` 1단 → 2단 (상단 프로필+처음으로 / 하단 메타 묶음)
- 골드 / 다이아 / 천장 가로 배지 — 다이아/천장은 UI만, 동작 로직은 다음 세션
- localStorage 키: `hexPuzzleDiamond` / `hexPuzzleEncounterStreak`

#### 같은 타입 발밑 오라
- 덱 6슬롯 types 카운트 → 카운트 ≥3 타입에 속하는 마리 발밑에 색 글로우
- TYPE_COLORS 18타입 색상표(config.js, 도감 등 공유)
- solid 색 + blur(8px) + opacity 0.9 (radial-gradient 옅음 → solid로 변경)
- z-index 보정: 도트 (i*2+1), aura (i*2) → aura가 항상 자기 도트 바로 뒤

#### 오박사 인트로 시퀀스
- intro-screen 신규 화면 (오박사 placeholder + 멘트 + 6종 등장 + 여행 시작 버튼)
- 닉네임 직후 `hexPuzzleIntroDone` 미설정이면 인트로, 설정이면 로비 직행
- 6종 등장 후 ~2.5초 뒤 버튼 활성화 → 클릭 시 도감/슬롯/플래그 일괄 저장
- 스타터 6종은 monster_table.json `is_starter:true` 필터 (동적), fallback으로 정적 ID

#### ADVENTURE START 버튼 위치/크기
- absolute, 폭 240px 가운데 정렬 (`left:50% / transform:translateX(-50%)`)
- bottom: `calc(80px + env(safe-area-inset-bottom) + 14px)` — 4탭 바로 위

#### 트레이너 도트 — 보류
- BW RIP 시트(`character_sprite_01.png`)가 영역마다 frame layout이 달라(영역1=132px / 영역2=128px / 영역3=192px) 정확한 슬라이싱 어려움
- 시트 자체에 풀 녹색 배경 매팅 필요(런타임 캔버스 매팅 시도했으나 의상 가장자리 픽셀 영향 가능)
- TRAINER_SHEET / getTrainerRow / getTrainerCol / 4방향 워크 사이클 / 길찾기 코드 모두 보존 — `const trainer=null`로만 비활성
- 다음 패스: 매팅된 깔끔한 자산 확보(또는 외주) 후 재활성화

### 🛠 콘솔 디버그 치트
- `devAddCaught(N)` — 도감에 N마리 추가 후 풀밭 자동 재시작
- `devSetSlots([...])` — 덱 6슬롯 강제 변경 (오라 검증용)
- `devClearCaught()` — 도감 초기화
- Chrome paste 차단 시 `allow pasting` 입력 후 사용 또는 직접 타이핑(자동완성)

### 📝 문서 갱신
- design_coregame.md 데이터 저장 섹션: 메타게임 키 4개 추가, "처음으로" 삭제 키 목록 갱신
- design_system.md 스키마: `visual_h` 옵셔널 필드 명시
- todolist.md: 풀밭/오라/인트로/프로필카드 체크, 트레이너 보류 표기

### 💡 오늘의 교훈

1. **자산 정확도 vs 코드 시간의 균형**: BW RIP 시트는 빠른 프로토에 좋지만 영역마다 layout이 달라 코드로 일관 처리 어려움. 깔끔한 매팅된 단일 도트 자산이 결국 더 빠른 길.
2. **데이터 정확성과 표시 보정의 분리**: `height_m`(진실)과 `visual_h`(표시) 분리는 도감/포획 시스템과 시각 표시 모두를 깨끗하게 유지. 한 룰로 모든 종을 처리하지 않고 예외만 명시.
3. **mix-blend-mode + radial-gradient + blur + opacity 합성은 위험**: 4중 효과가 겹치면 거의 안 보이는 결과. solid 색 + 강한 blur + 명확한 opacity 한 단계가 더 확실.
4. **z-index inline override는 정적 CSS를 무시**: JS가 매 프레임 z-index 부여할 때 형제 요소(aura)와 stack 충돌. 도트와 aura 모두 동적으로 짝지어 부여하는 게 안전.
5. **사용자 메모와 실제 자산 차이는 자주 발생**: "32×32 frame, 3프레임×4방향" 메모는 일부 영역만 맞고 다른 영역은 다른 layout. 메모 의존 X, 자산 자체 측정.

---

### 🎯 세션 2: 도감 + 천장 게이지 + 스킨 정비 (오후)

design_system.md v0.5 도감 풀스펙 + 천장 게이지를 한 세션에 묶어 구현. 사탕 시스템 종별→공통으로 스펙 변경.

#### 도감 데이터 모델 (dex.js 신설)
- `MonsterDex {state, captureCount, failStack, biggest, smallest, firstCaught}` 풀스펙 (사탕은 글로벌로 분리)
- 4단계 state: `undiscovered / discovered / captured / evolved`
- `captureNow(id)`: state 전환 + count+1 + 글로벌 사탕+2 + biggest/smallest 갱신 + firstCaught
- `markDiscovered(id) / incFailStack(id)` 부분 액션 분리
- 레거시 `hexPuzzleDexCaught` (배열) → `hexPuzzleDex` (객체) 자동 1회 마이그레이션
- 인트로 6종 `#15(독침붕) → #16(구구)` 보정 (config.js DEFAULT_UNLOCKED/SLOTS)

#### 도감 화면 (151 그리드 + 상세 모달)
- 5열 grid + grid-auto-rows 70px (aspect-ratio가 컨텐츠에 밀리는 문제 해결)
- 상태별 시각 4단계: 검은 실루엣 / 회색 / 컬러 / 골드 보더
- 도트 GIF(`assets/dot/pokemon/{id}.gif`)를 실루엣 베이스로 사용 — 블록 시트 흑백보다 형태 가독성 우수
- 상세 모달: 정보 단계화 (미발견=실루엣 / 발견=이름+타입 / 포획=+사탕/키/무게/잡은수/최초)
- 개발자 인증 시 ⚡ 즉시 잡기 버튼 (콘솔 치트 대체)

#### 사탕 시스템: 종별 → 공통 통화 (스펙 변경)
- design_system.md v0.5 changelog + 4-7 본문 갱신
- `hexPuzzleCandy` 단일 키, 모든 포획 시 +2 누적, 어느 종 진화든 같은 풀에서 차감
- 마이그레이션: 기존 `entry.candy` 합산해서 글로벌로 이전

#### 도감 captured → 스킨 자동 해금
- `loadSkinData()`가 `DEFAULT_UNLOCKED ∪ getCapturedIds() ∪ legacy unlocked` 합집합 반환
- 즉시 잡기 / 포획 직후 스킨창 진입하면 자동 컬러 표시

#### 스킨창 도감 톤 개편
- 390 프레임 통일, 크림/옐로우 배경, 헤더 (← + 타이틀 + N/151 카운터)
- 슬롯 6개 + 컬렉션 5열 + grid-auto-rows 68px
- 안내문: "🌿 슬롯에 장착한 포켓몬은 로비 풀밭에 함께 등장해요"
- 컬렉션 sprite: 블록 시트 이미지(인게임 블록 미리보기), 잠금 시 brightness(0) 실루엣

#### 신규 해금 레드닷 시스템
- `hexPuzzleSkinNew` 큐: captureNow 시 첫 captured 전환이면 push
- 스킨 컬렉션 셀 우상단 + 로비 🎨 스킨 버튼 우상단 펄스
- 컬렉션 클릭 시 clear, 로비 진입 시 재계산

#### 포켓몬 콜라이더 (lobby.js)
- 픽셀 높이 35% 반경, 매 tick pairwise separation
- 거리 < r1+r2면 절반씩 정반대로 push, 경계 클램프 재적용

#### 스테이지 버튼 z-index 60
- 풀밭 도트 동적 z-index(1~24) 위로 항상 노출
- ADVENTURE START 버튼이 포켓몬에 가려지지 않음

#### 로비 DEV 버튼 + 전역 인증 흐름
- 로비 우하단 작은 DEV (`#lobby-dev-btn`, 28×22, opacity 0.45 → hover/active 1)
- `dev-pw-overlay`를 `#game-container` 밖으로 이동 → 로비/인게임 어디서든 호출 가능
- `tryPassword` 화면별 분기: 인게임이면 패널 자동 오픈, 로비/도감이면 인증만
- DEV 인증 시 도감 즉시잡기 + 배치 도구 탭 + 인게임 패널 모두 활성화

#### 천장 게이지 (pity.js 신설)
- 메인/반복 독립 카운터: `hexPuzzlePityMain` / `hexPuzzlePityRepeat`
- `getPity / incPity / resetPity / isPityFull / rollEncounter(mode)` API
- `rollEncounter` stub: 이전 5/5면 강제 조우 + 0 리셋, 아니면 +1 (justFilled 시 신호)
- 레거시 `hexPuzzleEncounterStreak` → 메인 카운터 자동 마이그레이션
- 실제 조우 화면/포획 UI는 후속 세션 (스펙은 v0.5 5절에 정의됨)

#### 클리어 화면 천장 위젯
- 5tick 가로바 + 숫자 + 힌트 (`#end-pity-gauge`)
- 0.6s 지연 후 갱신: before → after 채우기 애니메이션
- `justFilled`: ✨ "천장 도달! 다음 클리어 = 무조건 조우" + tick 펄스
- `encountered`: 🎯 "조우 발동! (다음 세션에서 구현)" + 5→0 리셋
- 로비 ⭐ 천장 카드도 5/5 도달 시 노란 그라디언트 + pulse 애니메이션

#### "처음으로" 버튼 = 계정 초기화 정비
- dev용 계정 초기화 개념. 14개 키 일괄 청소 (신키 + 레거시 안전망 모두)
- 청소: profile/stage/intro/gold/diamond/candy/dex/dexCaught/unlocked/slots/skinNew/pityMain/pityRepeat/encounterStreak
- 보존: highScore, darkMode (환경 설정)
- 메모리 캐시 동기화: currentStage=1, currentGold=0, devUnlocked=false
- UI 갱신: gold/diamond/streak/skinBadge + DEV 버튼 active 해제 + 배치 탭 hidden

### 💡 세션 2 교훈

1. **CSS aspect-ratio는 자식 컨텐츠 크기에 밀리면 무력화**: 도트 GIF 본래 96px이 셀을 늘려서 행 단위 침범 발생. `grid-auto-rows` row 높이 강제 + 셀 `min-height:0` + `overflow:hidden`이 안정적. 컨텐츠가 부모를 결정하지 않고 부모가 컨텐츠를 결정하도록 흐름 뒤집기.
2. **이미 보유한 자산을 먼저 활용**: 도감 실루엣을 별도 자산으로 구하기 전에, 어제 받은 5세대 BW 도트(151 GIF)를 흑백 처리하니 즉시 명확한 실루엣 확보. 자산 추가 비용 0.
3. **localStorage 키 라이프사이클**: 신키 도입 시 ① 마이그레이션 코드 ② 옛 키 보존(롤백 안전망) ③ "초기화" 버튼은 신키+옛키 모두 청소 — 세 가지가 일관되어야 사용자 혼란 없음.
4. **`position: absolute` overlay의 부모 종속성**: `#dev-pw-overlay`가 `#game-container.hidden` 안에 있어 로비에서 못 띄움. body 직속으로 이동하니 `inset:0`만으로 viewport 덮어 정상 동작.
5. **스펙 변경은 기획서 먼저**: 사탕 종별→공통 변경 시 design_system.md v0.5 changelog + 본문 4-7을 먼저 갱신한 뒤 코드 수정 — 코드와 문서가 어긋나지 않음.

---

## 2026.05.05 (15일차)

### 🎯 메타게임 기획 v0.4 / v0.5 정리

6일 만에 재개. 코드 한 줄 안 건드리고 design_system.md를 v0.3 → v0.5까지 격상.
조우/포획/도감/로비/연출까지 메타게임 전반의 실행 가능 스펙으로 정리하고,
별도 데이터 파일(monster_table.json) 신설.

#### 조우 / 포획 시스템 구체화
- 18타입 = 18지역 매핑 (100스테이지 = 1지역)
- 18지역 순서: 풀→불꽃→물→전기→노말→비행→독→벌레→격투→땅→바위→에스퍼→얼음→고스트→강철→드래곤→페어리→악
- 1세대 풀 부족 후반 4타입(강철/드래곤/페어리/악) 처리는 v0.6 후속 (2세대 추가 또는 두 타입 합친 지역)
- 메인 25% / 반복 35% / 튜토리얼 100%
- 천장 0/5 — 로비 상단 + 클리어 화면 양쪽 노출
- 한 조우당 여러 번 볼 시도 가능 + 도망가기 버튼 + v체크 자동도망
- 실패 스택형 보정 +5% (포획 성공 시 0 리셋)

#### 몬스터볼 시스템
- 4종: 기본(33%) / 슈퍼(60%) / 하이퍼(80%) / 마스터(100%, 이벤트 한정)
- 자체 조각 재화 (흰/파랑/노랑) + 골드 제작
- 하이브리드 공급: 클리어 시 무료 1개(휘발) + 10분 자연충전(Max 5)
- 봉구리 차용은 폐기 (인지도 낮음, 자체 조각 직관성 우선)

#### 사탕 시스템 (v0.5 신설)
- 종별 통화 (포켓몬고 차용)
- 중복 포획 +2 / 진화 N개 소비 (monster_table.json `evolution.candy_required`)
- "한 종 수십 마리 잡고 싶은 욕구"를 자연 충족 (수집/성장/희귀도 3축 동시 보상)

#### 크기/무게 시스템
- IV 풀세트(공/방/체) 도입 X — 본 게임은 전투 없으므로 부적합
- 포켓몬고의 XXS/XXL 마킹만 차용
- 도감에 최대/최소 개체 영구 기록 → 같은 종 재포획 동기

#### 6종 라인업 + 오박사 인트로 (v0.5)
- 시작 6종: 파이리/구구/피카츄/캐터피/꼬부기/이상해씨 (#4/#16/#25/#10/#7/#1)
- 색 슬롯 매핑: red→indigo 순서
- 캐릭터 생성 직후 오박사 등장 → 6종 자동 지급 연출
- 로비 진입 시 6마리 도트가 공터 자유 워크 → "이 친구들과 모험" 비주얼 메시지

#### 튜토리얼 1/5/10/15 100% 조우
- 1: 이상해씨 / 5: 뚜벅쵸 / 10: 모다피 / 15: 아라리
- 사용자가 처음 단데기로 잡으셨던 자리 → 단데기는 벌레 단일타입(풀 X)이라 뚜벅쵸로 정정

#### 로비 시스템 전면 재설계
- 중앙 큰 캐릭터 일러스트 제거 → "모험 공터 + 가운데 그루터기" 컨셉
- 5세대 BW 도트 차용 (포켓몬 + 트레이너 남/여)
- 트레이너 + 포켓몬 6마리 자유 워크
- 풀밭 단계: 보유 0/10/20/30 마리 기준 4단계 배경 변화 (GPT로 4장 생성 예정)
- 같은 타입 3+ 발밑 색 오라 (시각 효과 only, 게임플레이 보너스는 별도)
- 프로필 카드: 얼굴/닉/골드/다이아/천장 게이지 통합

#### 덱 타입 보너스 (계단형)
- 지역 타입 매칭 같은 타입 N마리 → 골드 배율
- 3=1.3 / 4=1.5 / 5=1.7 / 6=2.0
- 모이는 만큼 보상 ↑ → 컬렉션 동기 강화

#### 클리어 후 연출 시퀀스
- 클리어 → 골드/사탕 보상 → 천장 게이지 갱신 → 띠로리 효과음 → 회오리 화면 전환 → 야생 등장 → 포획 → 도감 등록

### 📦 monster_table.json 신설

151마리 1세대 메타데이터를 외부 데이터로 분리.
- 11개 컬럼 (id/name_ko/name_en/types/regions/rarity/height_m/weight_kg/evolution/is_starter/tutorial_stage)
- 스키마에 데이터타입(integer/string/array/enum/boolean) + 제약 + enum 후보값 명시
- 진화 분기(이브이→샤미드/쥬피썬더/부스터) 케이스 처리
- node로 JSON 유효성 검증 — 151마리 / 11필드 / 스타터 6 / 튜토리얼 4 정상

### 💡 오늘의 교훈

1. **자료 신뢰성 우선**: 단데기 = 벌레 단일타입(풀 아님)이라는 점 짚을 때, 사용자가 헷갈린 부분을 데이터로 잡아주는 게 기획 신뢰도에 직결. monster_table 외부 데이터화로 같은 실수가 반복될 여지 줄어듦.
2. **포켓몬고 시스템 차용은 강력한 단축**: 사탕 시스템 도입이 (a) 중복 포획 보상 (b) 진화 재료 (c) "한 종 수십 마리" 욕구 — 3가지 고민을 한 번에 해결. 자체 메커니즘 발명보다 검증된 시스템 차용이 효율적.
3. **풀 부족 타입은 미루는 게 합리적**: 1세대 한정 강철/드래곤/페어리/악 4타입은 풀이 0~5종밖에 안 됨. 컨텐츠 확장(2세대+) 시점에 자연 해소될 문제라 미리 구체 해결책 내지 않고 메모만 남김.
4. **저작권 명시 = 미래의 나에게 신호 보내기**: 도트/일러스트 양쪽에 "데모 한정, 상업화 시 자체 외주 필수" 박아둠. 잊을 틈을 안 남김.
5. **개체값 시스템 도입할 땐 게임 메카닉과 매칭 확인**: 포켓몬고 IV(공/방/체)는 우리 게임에 부적합 (전투 없음). XXS/XXL 마킹만 차용해서 핵심 재미 유지하고 복잡도 0으로 떨어뜨림.

---

## 2026.04.29 (14일차)

### 🎯 특수블록 교차 효과 개선

#### 기믹 중첩 타격 구현
- 교차 효과 시 동일 기믹이 여러 범위에 포함되면 횟수만큼 단계 감소
- 중첩 허용: 줄볼×줄볼(같은방향), 줄볼×무지개, 폭탄×무지개, 타겟볼×무지개
- 예외 유지: 폭탄×폭탄(19칸 단일), 무지개×무지개(전체 단일)

#### 무지개 × 줄볼 순차 발동
- 기존 동시 발동 → 순차 발동으로 변경
- 변환된 순서대로 하나씩 발동 (1.2배 속도)
- 줄볼 라인 겹치는 기믹 중첩 타격 적용

#### 무지개 × 타겟볼 mid-flight redirect 구현
- 기존: 도착 후 스톤 없으면 대기 → 재발사 (블록 충전 멈춤 문제)
- 변경: 날아가는 도중 목표 스톤 destroyed되면 즉시 방향 전환
- 50ms 폴링으로 목표 유효성 실시간 감지
- redirect 후 ease-in-out easing (호 모양 자연스럽게 유지)
- MAX_REDIRECTS=5, 스톤 소진 시 일반 블록 fallback
- 발사 겹쳐서 진행, 같은 스톤 중복 타격 허용

### 💡 오늘의 교훈
1. CSS transition 도중 style 재지정으로 mid-flight 방향 전환 가능
   브라우저가 현재 보간 위치에서 새 목표로 자동 재보간
2. "대기 후 재발사" 패턴은 블록 충전을 막아 게임 흐름을 끊음
   실시간 redirect가 게임플레이 연속성 면에서 훨씬 우수
3. 폴링(50ms) 기반 유효성 검사는 게임플레이상 충분히 즉각적
   이벤트 기반보다 구현 단순하고 안정적

### 🎨 UI/디자인 개선

#### 로비화면 UI 조정
- 스테이지 입장 버튼 위치 위로 조정
- 캐릭터 하체까지 보이도록 조정

#### 골드 시스템 구현
- localStorage 키: hexPuzzleGold, 최초 0골드
- 클리어 보상: 기본 300골드 + 남은턴 × 5골드
- 클리어 화면 점수 제거 → 골드 획득량 표시로 교체
- 로비 상단 골드 표시
- 개발자 모드 골드 추가 기능
- "처음으로" 클릭 시 골드 초기화 버그 수정

#### 미션 UI 개선
- 돌 0개 달성 시 미션 카드 사라지지 않고 ✅ 체크 표시로 교체

#### 실패 화면 개편
- 슬픈 피카츄 이미지 추가 (assets/fail_pokemon.png)
- 말풍선 "앗...이런!" + 피카츄 중앙 배치
- 버튼 2개: 재도전하기 / 로비로 돌아가기
- 카드 배경 베이지 (#FFF6E5) 적용

#### 스킨 슬롯 7→6종 변경
- 기본 해금 스킨 6종 (1,4,7,10,15,25번)
- 모든 스테이지 colorTypes 최대 6으로 변경
- 기존 7슬롯 데이터 자동 마이그레이션

#### 콤보 메시지 개편
- Black Han Sans 폰트 적용
- italic 제거 → skewX(-7deg)로 기울임 대체
- 외곽선 2px + drop shadow 단순화로 가독성 확보
- 콤보별 텍스트/색상:
  * 2콤보: "시작이 좋은데!" (파랑, 36px)
  * 3콤보: "감이 왔어!" (보라, 40px)
  * 4콤보: "진화할 흐름!" (주황, 44px)
  * 5+콤보: "전설급 콤보다!" (핑크/보라핑크/시안 랜덤, 48px)

### 💡 UI/디자인 작업 교훈
1. Black Han Sans + italic 합성은 폰트가 얇아지는 부작용
   → font-style: italic 제거 후 skewX로 대체
2. text-stroke가 fill 영역을 침식 → 2px 이하로 유지해야 fill 색 살아남
3. 다중 glow shadow는 외곽선을 흐리게 만듦 → drop shadow 1줄이 효과적
4. mid-flight redirect: CSS transition 도중 style 재지정으로
   날아가는 도중 방향 전환 가능 (브라우저 자동 재보간)

---

## 2026.04.22 (13일차)

### 🗂️ 문서 파일명 영문 변환
- 한글 파일명 → 영문 변환
  * 기획서_코어게임.md → design_coregame.md
  * 기획서_메타게임.md → design_system.md
  * 작업일지.md → devlog.md
  * todo리스트.md → todolist.md
- 모든 참조 경로 일괄 업데이트 (README.md, todolist.md)
- .gitignore에 *.xlsx, *.lnk 패턴 추가

### 🔧 3단 워크플로우 개선
- CLAUDE.md 신규 생성 (Claude Code 자동 로드용)
  * 시니어 풀스택 개발자 페르소나 추가
  * 작업 원칙, 모듈 구조, 기술 주의사항
  * @문서 참조로 관련 파일 자동 로드
  * 세션 시작 붙여넣기 불필요해짐
- README.md GitHub 방문자용으로 축소
  * 프로젝트 소개, 실행법, 문서 링크만 유지
- archive/ 폴더 신설 + 안 쓰는 문서 정리

### 📝 Claude.ai 프로젝트 설정 개선
- 지침 칸: 시니어 게임 기획자 겸 실무형 PM 페르소나 추가
- Knowledge: 영문 파일 4개로 교체

### 💡 오늘의 교훈
1. CLAUDE.md를 루트에 두면 Claude Code가 세션 시작 시 자동 로드
   → 매번 긴 프롬프트 붙여넣기 불필요
2. 문서/도구/코드 각각의 독자가 다름
   README(GitHub 방문자) / CLAUDE.md(Claude Code) / 지침(Claude 웹)
3. git add -A 전에 untracked 파일 항상 확인
   → 프로젝트 무관 파일 실수로 커밋되는 것 방지

---

## 2026.04.21 (12일차)

### 🐛 버그 수정
- fix: 스왑 후 블록 "띡" 튀는 현상 수정
  (animateSwap + processMatchStep 머지에 adj 보정 누락)
- fix: 타겟볼 생성 시 클러스터 인접 기믹 미타격
  (Step 4 루프를 curCells + clusters 전체로 확장)
  (원인: curClusters → clusters 변수명 오타로 ReferenceError 발생)
- fix: 타겟볼 스왑 시 타격 방향 정반대로 뒤집히는 버그
  (sp1 케이스에서 _swapDir 방향 반전 적용)

### 📝 메타게임 기획서 v0.3 전면 재작성
- 게임 컨셉 재정의: 점수/3별 → 포켓몬 탐험/수집
- 스테이지 구조 재설계 (메인 1회 클리어 / 반복 파밍 분리)
- 포켓몬 조우/포획 시스템 정의
- 콤보 역할 재정의 (점수 → 조우/포획 보정)
- 덱 시스템 정의 (6슬롯, 타입 보너스)
- 하트/블루하트 재화 시스템 정의
  (10분 충전, Max5, 5개 초과 시 타이머 정지)
- 도감 시스템 상세화 (미발견/발견/포획/강화 4단계)
- 조우 화면 흐름 정의 (스킵 가능, 스킵 시 발견 등록)
- 클리어 화면에 미발견 포켓몬 N마리 상시 표시

### 🎵 BGM 시스템 구축
- BGM 3종 화면별 교체 시스템 구현
  * 메인화면: main_bgm.mp3 (volume 0.8)
  * 로비: lobby_bgm.mp3 (volume 0.06)
  * 인게임: ingame_play_bgm.mp3 (volume 0.12)
- 화면 전환 시 이전 BGM 정지 → 새 BGM 재생
- 모바일 자동재생 차단 폴백 처리
- "처음으로" 클릭 시 main_bgm 재시작

### 🔊 효과음 6종 추가 (Web Audio API)
- sfx_match_pop: 블록 매칭 제거 시
- sfx_stone_hit: 돌 기믹 단계 하향 시
- sfx_stone_break: 돌 기믹 최종 제거 시
- sfx_btn_click: 일반 버튼 클릭 시
- sfx_select: 스킨 선택 시
- sfx_swap: 스왑 시도 시 (매치 여부 무관)
- Web Audio API 방식으로 즉시 재생 (딜레이 최소화)
- playSfx() 헬퍼 함수로 통합 관리

### 📝 README.md 작업 지침서로 전면 교체
- 세션 시작 프롬프트 (4개 문서 읽기)
- 개발 환경, 모듈 구조, 에셋 구조
- 커밋 규칙, 자주 쓰는 프롬프트 패턴
- 주의사항 (blockScale 보정, Korean 파일명 등)

### 💡 오늘의 교훈
1. 변수명 오타(curClusters vs clusters)가 ReferenceError를 유발해
   async 함수 전체가 중단됨. "swap만 되고 매칭 안 됨" 증상의 원인.
   진단 없이 수정 재시도했다면 원인 못 찾았을 것.
2. 버그 수정은 한 번에 하나씩. 두 버그를 묶어서 수정했다가
   변수명 오타로 전체가 깨지면 어디가 문제인지 추적 어려움.
3. 효과음 딜레이는 파일 자체의 무음 구간이 원인일 수 있음
   → Audacity로 앞부분 무음 구간 잘라내면 해결
4. Web Audio API (decodeAudioData)는 new Audio()보다
   즉시 재생에 유리함. 단 file:// 프로토콜에서 fetch 차단됨
5. git add -A 전에 untracked 파일 목록 확인 필요
   → 프로젝트 무관 파일이 섞여 들어갈 수 있음

---

## 2026.04.20 (11일차)

### 🎯 오늘의 핵심 성과
인게임 화면 크림/옐로우 톤앤매너 전면 개편. 상단 HUD 3카드 + 중앙 캐릭터 구조로 확장. 배치 도구 슬라이드 패널 분리. 블록 배율 인스펙터 신설 + 셀 중앙 정렬 보정 수식 적용.

### 🎨 인게임 화면 톤앤매너 개편
- 배경: 어두운 네이비 → 크림/옐로우 radial-gradient + 도트 패턴
- 헥사 셀: 어두운 톤 → 크림 베이지 + 경계선 명확화
  (clip-path로 box-shadow 불가 → filter: drop-shadow로 대체)
- 콤보/힌트/오버레이 등 전체 톤앤매너 통일
- 하단 밤낮/개발자 버튼: 크림 글래스 pill 스타일

### 🧭 상단 HUD 3카드 + 중앙 캐릭터
- HUD 높이 확장 (60px → 136px), 크림 그라디언트 + 하단 곡선
- 좌: 목표 카드 (돌 아이콘 + 빨간 뱃지)
- 중앙: 캐릭터 상반신 (hexPuzzlePlayerCharacter 기준 자동 주입)
- 우: 이동 카드 (MOVES 숫자)
- STOP 버튼: 우상단 → 하단 중앙 absolute 이동

### 🛠️ 배치 도구 슬라이드 패널 신규
- 개발자 모드 오버레이에서 배치 UI 분리
- 인게임 우측 ◀/▶ 탭으로 슬라이드 토글
- 개발자 인증 시에만 탭 표시
- 패널: 특수블록 6종 + 기믹 7종 + 좌표 보기
- 하단 팔레트: 선택 항목 표시 + X로 해제
- 게임판과 동시 조작 가능 (배경 차단 없음)

### ⚙️ 블록 배율 + 중앙 정렬 보정
- CFG.blockScale 추가 (기본값 1.1, 범위 0.5~2.0)
- 개발자 모드 🎨 비주얼 인스펙터 섹션 신설
- 배율 변경 시 셀 중앙 정렬 보정:
  adj = BLOCK_D × (scale - 1) / 2
  createBlockEl / applyBlockScale / gravity 3종 함수에 일괄 적용

### 💡 오늘의 교훈
1. clip-path와 box-shadow는 상성이 안 맞음 → filter: drop-shadow로 대체
2. overflow:hidden 컨테이너에서 음수 top은 곧 클리핑
   캐릭터 돌출 효과 대신 HUD 자체를 늘려 해결
3. BLOCK_D 고정 기반 좌표식의 취약점
   블록 크기 변경 시 낙하/충전/재스냅 모든 경로에
   보정(adj)을 일관 적용해야 함. 한 곳이라도 빠지면 "툭" 튐
4. CSS 형제 셀렉터로 DOM 동기화:
   #info-bar.hidden ~ #stop-btn { display:none }
   JS 없이 CSS만으로 연동 가능

---

## 2026.04.19 (10일차)

### 🎨 메인화면 UI 개편
- 기존 헥사 로고(⬡) + "헥사 3매치 퍼즐" 타이틀 마크업 제거
- 배경 이미지(assets/main_bg.jpg) + 상하단 짙고 중앙 옅은 4-stop 스크림 그라디언트
- 로고(assets/main_logo.png) 중앙 배치, 크기 확대
- 로고 인터랙션: 호버 시 scale(1.06), 클릭 시 띠용 바운스 효과 (클래스 토글 + reflow 재시작 패턴)
- "PRESS TO START" 깜빡이는 텍스트 버튼
- Plus Jakarta Sans 폰트 적용
- #main-screen도 390×844 프레임 통일, resizeGrid에서 일괄 스케일

### 🎵 메인 BGM 추가
- assets/main_bgm.mp3 자동재생 (loop, volume 0.4)
- 모바일 자동재생 차단 폴백: pointerdown/keydown/touchstart 3종 등록 → 첫 발화 시 나머지 수동 해제
- PRESS TO START 클릭 시 BGM 정지
- "처음으로" 클릭 시 startMainBgm() 재호출

### 🔧 개발자 모드 오버레이 전환
- 기존 우측 사이드바 → 오버레이 팝업으로 변경
- 닫기(×) 버튼 카드 상단 우측
- 카드 제약: max-width 360px / max-height 80vh / 스크롤
- touch-action 분리: 백드롭 none, 카드 pan-y (배경 차단 + 카드 내 스크롤 허용)
- 오버레이 활성화 시 배경 입력 차단, 외부 터치 시 닫기

### 👤 캐릭터 선택 + 닉네임 입력 화면 신규
- 캐릭터 선택: 남/여 트레이너 2종 (character_man.png, character_woman.png)
- 미선택 시 다음 버튼 비활성 (disabled 가드)
- 닉네임 입력: 최대 12자, "N / 12" 카운터 표시, Enter 키 지원
- 빈 입력 시 START 버튼 비활성
- 닉네임 화면 뒤로가기(←): 캐릭터 재선택 가능
- localStorage 저장 (hexPuzzlePlayerName, hexPuzzlePlayerCharacter)
- 재진입 시 저장값 있으면 캐릭터 선택 스킵 → 바로 로비

### 🏠 로비 화면 개편
- 기존 스테이지 목표점수/Move 표시/플레이스홀더 등 구 DOM 전체 교체
- 레퍼런스 기반 크림/옐로우 톤앤매너
- 상단: KANTO LEAGUE 레이블 + 캐릭터 프로필 아이콘 + 닉네임 표시
- 중앙: 선택한 캐릭터 일러스트 크게
- 하단: ADVENTURE START 노란 필 버튼 (box-shadow 6px + press translateY(3px))
- 하단 탭: 스킨(기존 연결) / 상점·도감·준비중 표시
- 우상단 "처음으로" 버튼:
  hexPuzzlePlayerName/hexPuzzlePlayerCharacter/hexPuzzleStage 삭제
  (하이스코어·테마는 보존) + currentStage=1 메모리 동기화 + 메인으로 이동 + BGM 재시작

### 🛠 공통 리팩토링
- FRAME_SCREEN_IDS 배열로 5개 화면 일괄 스케일 (resizeGrid 공용화)
- showScreen 타겟에 character-select-screen, nickname-screen 추가
- 플레이어 프로필 헬퍼 4종 추가
  (loadPlayerProfile/savePlayerProfile/hasPlayerProfile/getCharacterImgPath)
- updateLobbyStage 리팩토링: 신규 마크업 대응 + null-guard + all-clear 배너 해제

### 📝 기획서 업데이트
- 화면 흐름 / 캐릭터 선택 화면 / 닉네임 입력 화면 / 로비 화면(개편) / 데이터 저장 섹션 신규 추가

### 💡 오늘의 교훈
1. 3-키프레임 일회성 애니메이션은 순수 CSS로 어렵다 — :active는 press 중에만 유지되어 중단. 클래스 토글 + reflow(void el.offsetWidth) 재시작 패턴이 표준.
2. 모바일 autoplay 폴백은 리스너 정리까지 포함해야 한다 — {once:true}만으론 다른 인터랙션이 먼저 발화해도 나머지 리스너가 살아남아 이후 화면에서 BGM이 엉뚱하게 부활.
3. localStorage 리셋은 메모리 상태 동기화가 같이 필요 — removeItem 후 이미 로드된 전역변수(예: currentStage)는 유지되므로 즉시 다음 흐름에서 구 값 사용됨.

---

## 2026.04.18 (9일차)

### 🎯 오늘의 핵심 성과
game.js 단일 파일 **2948줄 → 516줄** (-2432줄)로 축소, 기능별 **10개 모듈**로 분리 완료. 리팩토링 중 기존 잠재 버그 3건 추가로 발견·수정.

### 🏗️ 모듈 분리 순서 (의존성 역순)
1. **config.js** (90줄) — 상수, CFG, STAGES, ALL_COLORS, SPECIAL_IMAGES 등
2. **grid.js** (97줄) — 헥사 좌표 계산, 인접 셀, 셀 타입 헬퍼 (isDead/isEntrance/isPass/isNonPlayable)
3. **board.js** (262줄) — 보드 상태 배열, 초기화(initBoard), 셀/블록/기믹 DOM
4. **match.js** (237줄) — 매치 감지, 특수블록 생성 판정(determineSpecial), 점수 계산
5. **special.js** (786줄) — 특수블록 발동, 교차 효과 10종, 비주얼(빔/폭발/발사체), 무지개 발동
6. **gravity.js** (274줄) — 중력, 직선 충전, 대각선 충전
7. **animation.js** (89줄) — swap 애니메이션, 점수/콤보 팝업, 힌트
8. **ui.js** (605줄) — HUD, 화면 전환, 개발자 모드, 스킨 화면, 테마
9. **game.js** (516줄, 남은 부분) — 전역 상태, 애니메이션 큐 엔진, 유틸, 매치 처리 코어(processMatchStep), 보드 swap 로직
10. **main.js** (331줄) — 진입점 IIFE, 드래그/클릭 핸들러, 게임 흐름(startGame/resetToStart/checkGameEnd/trySwap/tryActivateSpecialClick)

### 📦 index.html 최종 로드 순서
```
config → grid → board → match → special → gravity → animation → ui → stage_maps → game → main
```

### 🐛 리팩토링 중 발견한 기존 버그 (리팩토링 회귀 아님)

**1. 폭탄×폭탄 19칸 범위 누락** (커밋 `30d0919` 및 `c7b583b`)
- `getCellsInRange2`가 `getNeighbors`로 BFS하는데 `getNeighbors`가 entrance/dead/pass 셀을 필터링
- 경유 ring-1 셀이 non-playable이면 그 너머 ring-2 꼭짓점이 단절됨
- 직전 커밋 `f9b2628 셀타입 4종 완성`에서 entrance/dead/pass 도입 시 드러난 잠재 버그
- → `step()` 기반 BFS로 교체해 19셀 온전히 반환

**2. 줄볼×폭탄 교차 기준점 오류** (커밋 `7d55bdc`)
- `handleCrossEffect`의 priority 스왑 로직이 드래그 방향에 따라 기준점을 시작점/끝점으로 뒤집음
- 폭탄→줄볼 방향에서만 재현되는 대칭 깨짐
- → bomb+stripe 분기만 `c2,r2` 고정으로 해결

**3. 무지개×무지개 돌 기믹 2단계 감소** (커밋 `205b236`)
- 명시적 stone 타격 루프 + `destroyCells` 내부 `hitStone`로 레벨 2+ 돌이 중복 감소
- → `hitStoneKeys` Set으로 dedupe

### ✨ 추가 개선: 폭탄×폭탄 / 무지개×무지개 배치 동시 발동
- 기존: 범위 내 특수블록이 순차 발동 (A 끝날 때까지 대기 → B 발동)
- 변경: 모든 특수의 효과를 일괄 compute → 이펙트 동시 재생 → 파괴 셀 dedupe → DOM 일괄 제거
- `computeSpecialEffect` rainbow 분기에 `cell._forceTargetColor` 지원 추가 (배치 내 무지개 색 통일)

### ⚙️ 대각선 충전 폭포 연출 개선 (커밋 `9c8d31b` + `c7b583b`)
- **DOM desync 버그 수정**: `fillEmpty`가 compute 3종 후 일괄 animate하면서 `animateFillDOM`이 이미 gravity로 이동된 board 위치를 재조회 → `createBlockEl` null → blockEls 누락. `fills` 항목에 `block` 스냅샷을 저장해 재조회 제거.
- **C안 구조로 재작성**: 서브루프 제거, 매 iter에서 fill + gravity + diag 동시 트리거. iter 간 짧은 겹침으로 "폭포처럼 흐르는" 연출
- **gravity → diagonal 시차**: 직선이 완전히 착지한 후(CSS transition 완료) 대각 시작 → "정직한 L자 경로"
- **transition 시간 단축**: `gravityTransition` 0.2→0.1, `diagTransition` 0.15→0.075 (정직한 루트 유지하면서 스피디)

### 🧹 기타
- `.claude/settings.json` 추적 제외 + `.gitignore` 추가
- 스테이지 맵 수정 반영 (서버 띄워 테스트 후 커밋)

### 💡 오늘의 교훈
1. **리팩토링은 "이동만"이 원칙이어도, 의심 가는 기존 버그는 반드시 드러나게 되어 있다.** 분리 중 세 건의 잠재 버그 발견. 이는 리팩토링과 무관한 기존 코드의 문제였고, 기능 추가(셀 타입 4종)와 함께 수면 위로 떠오른 경우도 있었음.
2. **"compute 후 일괄 animate" 패턴의 함정**: 중간에 board를 다시 읽으면 이미 달라진 상태. 첫 compute에서 필요한 스냅샷을 바로 캡쳐해둬야 함.
3. **클래식 스크립트의 script-scope 공유**는 의외로 강력해서 모듈 간 참조가 ES 모듈 없이도 매끄럽게 동작함. 다만 향후 ES 모듈 전환 시에는 getter/setter 패턴 또는 명시적 import로 재구성 필요.

### 🧹 Dead code 및 DEBUG 로그 정리
- gravity.js dead code 4개 제거 (animateGravity/animateDiagonalFill/animateFill/canFillFromTop)
- board.js/main.js/ui.js/game.js DEBUG 로그 전체 제거
- boardData 미사용 객체 제거
- game - 백업본.js 삭제

### 📱 모바일 UI 1단계
- 390×844 모바일 프레임 적용 (데스크탑: 중앙 배치 + 외곽 딤 배경)
- 인게임 HUD 재구성: 미션(좌) / MOVES+STOP(중앙) / 캐릭터 자리(우)
- 타이틀 / SCORE / TARGET / 최고점수 제거
- 개발자 버튼 우하단, 밤낮 버튼 좌하단 이동
- 퍼즐판 9열 잘림 없이 390px 프레임에 꽉 차게 조정
- viewport user-scalable=no, touch-action: none 추가

---

## 2026.04.13 (8일차)

### 🏗️ 셀 타입 시스템 4종으로 확장
- NORMAL / DEAD / ENTRANCE / PASS 4가지로 정의
- 각 타입별 동작 정확히 분리:
  - DEAD: 완전 장벽, 아래 셀은 대각선 충전만 가능
  - ENTRANCE(E): 장벽이지만 아래로 새 블록 생성 (B형태)
  - PASS(P): 투명 통과, 블록이 관통하며 매칭 제외 (A형태)

### 📦 stage_maps 로딩 방식 변경 (CORS 해결)
- file:// 프로토콜에서 fetch 차단 문제 해결
- stage_maps.json → stage_maps.js (`var STAGE_MAPS_DATA = {...};`)
- index.html에 `<script src="stage_maps.js">` 추가
- 맵 에디터 내보내기도 .js 파일로 변경
- 전역변수 우선, fetch는 HTTP 서버 환경 폴백

### ⚙️ 중력/충전 로직 재설계
- isDead / isEntrance / isPass / isNonPlayable 헬퍼 분리
- computeGravity: dead/entrance=장벽, pass=투명통과 (row 건너뛰기)
- computeFill: entrance=충전 시작점, dead/기믹=장벽, pass=통과
- computeDiagonalFill: dead/기믹 아래만 대각선, entrance 아래는 computeFill 담당
- canFillFromTop: dead/entrance/기믹 차단, pass 투명

### 🗺️ stage_maps 구조 변경
- cells 배열 추가 (entrance/dead/pass 셀 위치 저장)
- normal은 기본값이라 생략
- colorTypes, moves 필드 포함

### 🛠️ 맵 에디터 기능 보강
- 셀 타입 버튼 3종: E 사출구 / D 데드셀 / P 패스셀
- entrance를 퍼즐보드 내 임의 위치에 배치 가능
- 스테이지 최대 1000개, 추가(+) 버튼
- 스테이지별 [저장] 버튼 - 저장해야 반영, 미저장 상태 경고
- JSON 가져오기 추가 (기존 맵 데이터 로드)
- localStorage v2 포맷 + 구버전 자동 마이그레이션

### 🐛 버그 수정
- 맵 에디터에서 entrance 보드 내 설치 불가 → 모든 row에서 토글 가능
- 게임 시작 시 맵 데이터 로드 실패 (CORS) → script 태그 방식으로 해결
- 데드셀 hex-cell 배경이 인게임에서 계속 보이던 문제 → hexCellEls 참조로 가시성 제어
- loadStageMaps에 캐시 방지(`?t=`) + HTTP 상태 체크 + 디버그 로그 추가

---

### 💡 오늘의 개발 교훈

1. **셀 타입은 초창기에 정의했어야 함**: 대각선 충전 같은 복잡한 로직도 셀 타입 개념이 명확했다면 훨씬 쉽게 구현할 수 있었음
2. **CORS 문제는 배포 환경에서도 발생**: file:// 대신 script 태그 방식으로 전역변수로 데이터를 공유하는 것이 로컬/서버 환경 모두에서 안정적
3. **코어 기능 완성**: 특수블록, 기믹, 셀 타입, 맵 에디터까지 코어 게임플레이 완성. 다음은 리팩토링



### ⚙️ 맵 에디터 기능 확장

**colorTypes / moves 맵 에디터에서 관리**
- 기존에는 game.js STAGE_CONFIG에 하드코딩
- 맵 에디터에서 스테이지별 colorTypes(5/6/7), moves 직접 설정 가능
- JSON 내보내기 시 포함되어 game.js에서 참조

**스테이지 관리 개선**
- 기본 10스테이지 → 최대 1000스테이지까지 추가 가능
- 스테이지별 [저장] 버튼 추가
  - 저장 버튼 눌러야만 변경사항 반영
  - 저장 안 하고 다른 스테이지 이동 시 변경사항 미반영

---

### 🏗️ 셀 타입 4가지 시스템 구현

**왜 셀 타입이 필요했나?**
- 기존에는 블록 충전이 최상단에서만 수직으로 내려오는 단순한 구조
- 데드셀, 사출구 위치 변경 등 다양한 맵 구성을 위해 셀 개념 체계화 필요
- 초창기에 정의했어야 했으나 개발하면서 자연스럽게 필요성이 생겨 정의하게 됨

**4가지 셀 타입 정의**

| 타입 | 블록 위치 | 중력 차단 | 충전 방식 | 매칭 |
|---|---|---|---|---|
| normal | ✅ | ❌ | 위에서 낙하 | ✅ |
| entrance | ❌ | ✅ | 아래로 새 블록 생성 | ❌ |
| dead | ❌ | ✅ | 대각선으로 우회 | ❌ |
| pass | ❌ | ❌ | 블록 투명 통과 | ❌ (통과 순간) |

**구현 핵심**
- `isBarrier()`: dead/entrance → 중력 차단 장벽
- `isNonOccupiable()`: dead/entrance/pass → 블록 위치 불가
- entrance: B형태 (중력 차단 + 아래로 새 블록 직접 생성, 위/아래 독립 구역)
- dead: 수직 충전 완전 차단, 대각선에서만 충전
- pass: 중력 차단 안 함, 블록이 투명하게 통과

**맵 에디터 도구 추가**
- entrance (초록 E) / dead (빨강 D) / pass (보라 P)
- 인게임에서 모두 투명 처리

**stage_maps.json 구조 변경**
- cells 배열 추가 (entrance/dead/pass 셀 위치 저장)
- normal은 기본값이라 생략

---

### 💡 오늘의 개발 교훈

1. **셀 타입은 초창기에 정의했어야 함**: 대각선 충전 같은 복잡한 로직도 셀 타입 개념이 명확했다면 훨씬 쉽게 구현할 수 있었음. 기획 초반에 퍼즐판 구성 요소를 체계화하는 것이 중요
2. **코어 기능 완성**: 특수블록, 기믹, 셀 타입, 맵 에디터까지 코어 게임플레이가 완성됨. 다음은 리팩토링



### 🎮 특수블록 시스템 전면 개편

**왜 개편했나?**
- 기존 특수블록은 색상 속성을 가져 일반 매칭에 포함되어 자동 발동
- 플레이어가 원하는 타이밍에 사용하기 어렵고, 의도치 않게 소모되는 문제
- 더블클릭/스왑으로 직접 사용하는 방식으로 전환

**변경된 스펙**
- 색상 속성 제거 → 아이콘 형태 (assets/specialblock/ 폴더)
- 매칭 대상 완전 제외 (여러 개 모여도 자동 발동 안 됨)
- 더블클릭: 제자리 발동 (move -1)
- 스왑: 이동한 자리에서 즉시 발동 (move -1, 매칭 여부 무관)
- 무지개볼: 맵에서 가장 많은 색상 전체 제거

**타겟볼 범위 타격 추가**
- 더블클릭: 자신 + 상/우하/좌하 = 4칸 즉시 타격 후 날아감
- 스왑: 자신 + 날아온 반대 방향 3칸 = 4칸 즉시 타격 후 날아감
- 2스텝으로 처리: 범위 타격 완료 → 타겟볼 1개 발사

**교차 효과 수정**
- 줄볼x타겟볼: 4칸 타격 → 날아가서 줄볼 효과
- 폭탄볼x타겟볼: 4칸 타격 → 날아가서 폭탄 효과
- 타겟볼x타겟볼: 7칸 즉시 타격 → 4개로 쪼개져 날아감
- 무지개볼x타겟볼: 기존과 동일 (범위 타격 없이 변환 후 날아감)

**생성 시 인접 기믹 타격 추가**
- 특수블록 생성 위치 인접 기믹 셀 단계 -1

---

### 🔧 블록 충전 시스템 개선

**fill→gravity 루프 최적화**
- 기존: gravity(반복) → fill(1회) → 대각선 충전 후 위 빈칸 미채움
- 수정: fill → gravity → fill 반복, 빈 셀 없어질 때까지 처리
- gravity 내부 루프 delay 제거 → CSS transition이 최종 위치까지 부드럽게 처리

**무지개x무지개 교차 후 충전 멈춤 버그 수정**
- 전체 블록 제거 후 applyGravity→fillEmpty 호출 누락 수정

**diag transition / diag delay 인스펙터 항목 추가**
- 대각선 충전 전용 속도 변수 분리 (기존 gravityDelay 공유에서 독립)
- 기본값: diagTransition 0.15s, diagDelay 180ms

---

### ⚠️ 대각선 충전 경로 폴리싱 보류

**현상**: 블록이 수직으로 내려오다 대각선으로 꺾여야 하는데 목적지로 직선 이동하는 케이스 존재

**보류 이유**:
- gravity/diagonal이 board계산+DOM이동 한 세트로 묶여있어 수정 시 리스크 큼
- 수직→대각→수직 경로 애니메이션을 하려면 waypoint 기반 CSS keyframes 필요
- gravity 시스템 자체를 리팩토링하는 수준의 작업
- 오늘만 해도 충전 버그를 여러 번 수정했는데 더 건드리면 안정성 위험
- **리팩토링 시 pathfinding 기반 낙하 시스템으로 통째로 교체 예정**

---

### 🛠️ 헥사 셀 이미지 편집 툴 (image_tool.html)

**왜 만들었나?**
- 기믹/특수블록 이미지 교체 시 셀 크기와 안 맞는 문제 반복
- 매번 코드로 크기 수정하는 건 비효율적

**기능**
- 이미지 업로드 → 실제 헥사 셀 위에서 미리보기
- Width/Height/X/Y 슬라이더 실시간 조절
- game.js와 동일한 렌더링 방식 (background-image + contain + clip-path)
- PNG 다운로드 후 assets 폴더에 넣기만 하면 끝

---

### ⚙️ 블록 크기 조정
- BLOCK_D: 50px → 55px (10% 증가)
- 포켓몬 스킨은 BLOCK_D * 1.1 = 60.5px로 자동 적용

---

### 💡 오늘의 개발 교훈

1. **폴리싱은 타이밍이 중요**: 코어 기능이 안정화되기 전에 세부 애니메이션을 건드리면 오히려 더 큰 버그가 생길 수 있음
2. **클로드 코드의 "지금은 스킵" 판단 존중**: AI가 리스크를 경고할 때는 이유가 있음. 무리하게 진행하지 말 것
3. **2스텝 처리의 중요성**: 범위 타격 → 발사처럼 순서가 있는 효과는 await로 명확히 순서를 보장해야 함
4. **렌더링 방식 일치**: 프리뷰 툴은 실제 게임과 동일한 CSS 렌더링을 써야 WYSIWYG 보장



### 🐛 버그 수정

**스테이지 건너뛰기 버그 수정**
- 현상: 4스테이지 클리어 후 6스테이지로 넘어감 (2씩 건너뜀)
- 원인: 이전 스테이지 점수 미초기화 → 새 스테이지 즉시 클리어 → 연쇄 스킵
- 수정: 스테이지 전환 시 점수/move/상태 초기화 순서 보장

**블록 뭉텅이 사라짐 버그 수정**
- 원인: skipDelay=true 시 연쇄 콤보 내부 딜레이까지 0ms로 압축
- 수정: delay()/skippableDelay() 분리
  - skippableDelay(): swap/낙하/충전 애니메이션만 압축
  - delay(): 매치 팝/콤보/특수블록 연출은 항상 정상 속도 유지
- 매치 로그로 원인 추적 (skipDelay:true 빨간색 표시)

---

### ⚙️ 스테이지별 출현 블록 타입 수 관리
- STAGE_CONFIG에 colorTypes 항목 추가
- 스테이지별 설정: 1~2스테이지=5종, 3~4스테이지=6종, 5스테이지~=7종
- 블록 생성 시 현재 스테이지 colorTypes 참조

---

### 🎮 포켓몬 스킨 시스템 구현

**왜 포켓몬 테마로 갔나?**
- 데모 프로토타입에 캐릭터 컨셉 필요
- 포켓몬 1세대 151종 스프라이트 시트 활용 (데모용)
- 상업화 시 오리지널 캐릭터로 교체 예정

**스프라이트 시트 방식**
- 파일: pokemon_sprites_1.png (투명 배경 PNG, 3228x2375px)
- 1마리 크기: 215x215px, 가로 15마리 x 세로 11줄
- 151개 파일 개별 저장 불필요 → CSS background-position으로 잘라서 표시
- 좌표 계산:
  - col = (N-1) % 15
  - row = Math.floor((N-1) / 15)

**스킨 변경 화면**
- 7개 슬롯에 포켓몬 장착
- 기본 해금 7종: 1, 4, 7, 10, 15, 20, 25번
- 나머지 144종 잠금 상태 (🔒 표시)
- 장착된 포켓몬이 퍼즐에서 해당 색상 블록으로 등장

**배경 처리**
- 흰 배경 제거한 투명 PNG로 교체 → 포켓몬이 자연스럽게 표시
- 로컬 서버(npx serve .) 필요 (file:// 방식은 이미지 로드 차단)

---

### 🗺️ 돌 기믹 + 맵 에디터 구현

**왜 기믹 시스템이 필요했나?**
- 점수 달성 방식은 스테이지별 차별화가 어려움
- 퍼즐판에 제거해야 할 오브젝트를 배치 → 더 전략적인 플레이 유도

**돌 기믹 (Stone Gimmick)**
- 타입: 고정형 (중력 영향 없음, 배치 셀 고정)
- 5단계 (stone_1.png ~ stone_5.png)
- 인접 매칭 또는 특수블록 직접 타격 시 단계 -1
- 1단계에서 타격 시 완전 제거
- 미션 카운트: 단계 무관, 퍼즐판 위 돌 셀 개수 기준

**오브젝트 타입 정의**
- 블록형: 일반블록, 특수블록 → 중력 영향, 매칭 대상
- 고정형: 돌 기믹 → 중력 무시, 배치 셀 고정, 직접 타격만 반응

**충전 룰 변경**
- 고정형 기믹 셀은 완전한 장애물
- 수직 아래 빈 셀 → 대각선에서 블록 흘러들어와 충전
- 양쪽 대각선 동시 가능 시 왼쪽 우선

**맵 에디터 (map_editor.html)**
- 왜 별도 파일로 만들었나?
  - 게임 화면과 분리된 제작 환경
  - 코드 건드리지 않고 클릭으로 맵 제작
  - JSON으로 내보내서 Git 버전 관리 가능
- 1~10스테이지 탭으로 관리
- 돌 1~5단계 버튼 선택 후 셀 클릭 배치
- [JSON 내보내기] → stage_maps.json 다운로드
- 게임에서 fetch로 로드하여 스테이지별 기믹 배치

**왜 JSON인가?**
- 좌표 + 타입 + 단계 3가지 정보를 구조적으로 저장
- 나중에 기믹 종류 늘어도 구조 유지
- Git 커밋으로 맵 변경 이력 추적 가능
- 서버 붙일 때도 그대로 활용 가능

**로컬 서버가 필요한 이유**
- 브라우저에서 file://로 열면 보안상 다른 파일 읽기 차단 (CORS)
- npx serve .로 http://localhost:3000 서버 실행 시 정상 로드
- CMD 터미널에서 실행 (PowerShell은 보안 정책으로 막힐 수 있음)

---

### 🛠️ 개발자 모드 개선

**매치 로그 추가**
- 목적: 블록 뭉텅이 사라짐 버그 추적
- 형식: [MM.DD HH:MM:SS] N콤보 | 매치종류 | 제거N개 | skipDelay:true/false
- skipDelay:true 줄 빨간색 강조
- 최근 20개 표시, 로그 지우기 버튼

**스테이지 이동 치트 추가**
- 1~10 숫자 입력 후 [이동] 버튼으로 즉시 스테이지 이동
- 테스트 효율 대폭 향상

**배치 버튼 토글 방식 수정**
- 돌 기믹/특수블록 배치 버튼 다시 클릭 시 선택 해제
- 배치 모드 해제 후 정상 게임 조작 가능

---

### 🔧 대각선 충전 로직 구현 및 버그 수정

**왜 대각선 충전이 필요했나?**
- 고정형 기믹(돌) 수직 아래 빈 셀에 위에서 블록이 내려올 수 없음
- 옆 열에서 대각선으로 블록이 흘러들어와 채워야 함
- 양쪽 대각선 동시 가능 시 왼쪽 우선

**겪은 버그들과 해결 과정**

1. **고정형 기믹 셀에서 간헐적으로 블록 생성**
   - 원인: 블록 생성 로직에서 고정형 기믹 셀 체크 누락
   - 수정: 블록 생성/낙하 경로 계산 시 고정형 기믹 셀 장애물 처리

2. **대각 충전 중 공급열 상단 충전 타이밍 불일치**
   - 현상: 대각 충전이 완료된 후에야 공급열 상단에서 충전 시작
   - 시도: 동시 처리 로직 추가 → 블록 겹침 버그 발생 → 롤백

3. **대각선 충전 중간 좌표에서 블록 생성 버그**
   - 현상: 대각선 경로 경유 좌표(예: 3,3)에서 새 블록이 생성됨
   - 원인: `computeFill`이 `applyGravity` 루프 안에서 호출되어
     중간 경로에서도 블록 생성 시도
   - **최종 수정**:
     - `computeFill`을 `applyGravity` 루프에서 분리
     - `fillEmpty`에서만 호출 → 최상단에서만 새 블록 생성 보장
     - 대각 이동으로 생긴 빈 칸은 다음 루프의 gravity가 처리
     - 대각 충전과 상단 충전이 동시에 진행됨

**핵심 교훈**: 충전(fill)과 낙하(gravity)는 반드시 분리되어야 함. 충전은 항상 최상단에서만.

---

### 💡 오늘의 개발 교훈

1. **로그로 버그 잡기**: 눈으로 못 잡는 버그는 로그로 추적. skipDelay:true 패턴으로 원인 특정
2. **타입 시스템의 중요성**: 블록형/고정형 구분으로 충전 룰이 명확해짐. 나중에 기믹 추가도 쉬워짐
3. **별도 툴 만들기**: 맵 에디터를 별도 HTML로 만든 덕분에 10개 스테이지 맵을 빠르게 제작
4. **file:// vs http://**: 로컬 파일을 읽어야 할 땐 반드시 로컬 서버 필요. npx serve .로 해결
5. **롤백을 두려워하지 말기**: 버그가 심각해지면 원복 후 다시 접근하는 게 결국 빠름
6. **fill과 gravity 분리**: 충전 로직은 반드시 최상단에서만. gravity와 섞이면 중간 좌표에서 블록 생성 버그 발생

---

## 2026.04.04 (4일차)

### 🐛 버그 수정

**스테이지 시작 시 즉시 클리어 버그 수정**
- 현상: 2스테이지 시작하자마자 바로 클리어 처리됨
- 원인: 이전 스테이지 점수가 초기화되지 않은 채 새 스테이지 목표 점수 달성으로 판정
- 수정: 스테이지 시작 시 점수 0 초기화, move 수를 해당 스테이지 설정값으로 초기화, 게임 상태(playing/busy 등) 초기화, 초기화 완료 후 게임 시작 보장

---

### ⚙️ 스테이지별 출현 블록 타입 수 관리

**왜 필요했나?**
- 기존에는 블록 종류(5/6/7)가 게임 시작 시 플레이어가 직접 선택하는 방식
- 스테이지가 생기면서 스테이지마다 난이도를 다르게 줄 필요 생김
- 초반 스테이지는 블록 종류가 적어서 매칭이 쉽고, 후반으로 갈수록 블록 종류가 늘어나 난이도 상승

**구현 방식**
- STAGE_CONFIG 테이블에 colorTypes 항목 추가
- 블록 생성 시 현재 스테이지의 colorTypes 참조
- 스테이지 전환 시 colorTypes도 새 스테이지 설정으로 갱신

**스테이지별 colorTypes 설정 (초안)**
| 스테이지 | colorTypes |
|---|---|
| 1, 2 | 5 |
| 3, 4 | 6 |
| 5 이상 | 7 |

> 수치는 플레이 테스트 후 조정 예정

---

## 2026.04.03 (3일차)

### 🐛 버그 수정

**타겟볼 감지 로직 개선**
- 기존 평행사변형 패턴만 감지하던 방식이 너무 까다로워서 타겟볼이 거의 생성 안 되던 문제 수정
- BFS 클러스터 방식으로 교체: 같은 색 블록 4~5개가 인접 연결되면 타겟볼 생성
- 최종적으로 헥사 그리드의 3가지 평행사변형 패턴 + 인접 1개 확장 패턴으로 정의
- 총 6가지 패턴 하드코딩 감지 방식으로 구현

**좌표 보기 기능 추가**
- 개발자 모드에 [좌표 보기] 토글 버튼 추가
- 켜면 각 셀에 col, row 좌표를 붉은 텍스트로 표시
- 버그 발견 시 스크린샷으로 정확한 좌표 파악 가능

---

### ⚡ 실시간 매칭 구현

**왜 실시간 매칭을 구현했나?**
- 기존 방식: 매치/낙하/충전 연출이 끝날 때까지 조작 완전 차단 → 답답한 조작감
- 로얄매치 조사 결과: 연쇄 중에도 swap이 가능한 "Concurrent Matching" 방식이 핵심
- 퀄리티 우선 결정으로 대규모 리팩토링 진행

**구현 방식 (skipDelay)**
```
새 swap 입력 감지
    ↓
skipDelay = true
    ↓
진행 중인 모든 delay(ms) → delay(0ms)로 변환
    ↓
현재 연출이 순식간에 완료
    ↓
새 swap 즉시 시작
skipDelay = false (다시 정상 속도)
```

**단계별 작업:**
- 1단계: boardData 네임스페이스 분리
- 2단계: executeSwap(로직) / animateSwap(애니메이션) 분리
- 3단계: processMatches / playMatchResult 분리
- 4단계: 특수블록 로직/애니메이션 분리 + 무지개볼 입력 차단
- 5단계: skipDelay 방식으로 실시간 입력 큐 적용

**해결된 버그들:**
- 덩어리 버그: 첫 매치 이후 연쇄는 skipDelay=false로 강제 → 의도치 않은 대량 제거 방지
- 큐 누적 버그: animQueue 최대 1개 유지 → 갈수록 느려지는 현상 방지
- 1.5초 만료: 오래된 입력 버리기 → 한참 뒤에 갑자기 swap되는 현상 방지

**남은 과제:**
- 완전한 로직/애니메이션 분리는 리팩토링 때 진행 예정
- 현재는 skipDelay 방식으로 부분 구현된 상태

---

### 🛠️ 개발자 모드 개선

**배속 슬라이더 추가**
- 0.5x / 1x / 2x / 3x / 4x / 5x 총 6단계
- 전체 게임 속도 동일 배율로 조절
- 개발/테스트 용도

**인스펙터 항목 추가**
- special activate delay (특수블록 발동 후 충전 대기, 기본 100ms)
- cross effect delay (교차 효과 후 충전 대기, 기본 200ms)

---

### 📦 Git/GitHub 설정

**왜 Git을 도입했나?**
- 기존 방식: `game_backup_0403.js` 처럼 파일을 직접 복사해서 백업
- 문제점: 파일이 쌓이고, 버전 관리가 어렵고, 롤백이 번거로움
- Git 도입 후: 커밋만 하면 모든 버전이 자동으로 관리됨

**설정 순서:**
1. `git init` → 로컬 저장소 초기화
2. `git config` → 이름/이메일 설정
3. `git add . && git commit` → 초기 커밋
4. GitHub에서 저장소 생성 후 연결
5. `git push` → GitHub에 업로드

**앞으로 작업 흐름:**
```
작업 완료 → git commit -m "설명" → git push → GitHub 자동 백업
```

💡 **팁**: `game_backup_xxxx.js` 같은 파일은 이제 필요 없어요. Git이 모든 버전을 관리해줘요!

---

### 💡 오늘의 개발 교훈

1. **대규모 리팩토링은 단계별로**: 한 번에 다 바꾸면 어디서 버그 났는지 찾기 어려움
2. **Git 커밋은 자주**: 작업 단위별로 커밋해두면 언제든 롤백 가능
3. **버그 재현 방법 중요**: 좌표 보기 같은 디버그 도구가 있으면 버그 설명이 훨씬 쉬움
4. **레퍼런스 게임 조사**: 로얄매치 분석으로 실시간 매칭 방향을 잡을 수 있었음

---

## 2026.04.02 (2일차)

### 🛠️ 개발자 모드 패널 구현

**왜 개발자 모드가 필요했나?**
- 특수블록을 테스트하려면 직접 게임을 플레이하면서 특정 상황을 만들어야 함
- 매번 우연히 4매치/5매치가 나올 때까지 기다리는 건 비효율적
- 개발자 도구를 만들어서 원하는 상황을 즉시 재현할 수 있게 함

**접근 방법:**
- 게임 우측 상단 [개발자 모드] 버튼 클릭
- 비밀번호 입력 (`1013love`, 대소문자 무관)
- 인증 후 개발자 패널 열림

**특수블록 강제 배치:**
- 줄볼 / 타겟볼 / 폭탄볼 / 무지개볼 버튼 선택
- 선택 후 게임판 셀 클릭 → 해당 위치에 즉시 배치
- 연속 배치 가능 (선택 상태 유지)

**인스펙터 (유니티 인스펙터 스타일):**
- 게임 팩터값을 실시간으로 조절하면서 눈으로 확인
- 각 항목에 [?] 툴팁 (친절한 설명 + 권장 범위)
- 카테고리별 [초기화] 버튼 (커스텀 확인 팝업)
- 값 변경 시 즉시 게임에 반영

**인스펙터 카테고리:**
- ⚡ 속도 관련 (gravity transition/delay, fill transition/delay, projectile transition)
- ✨ 연출 타이밍 (matched delay, merge delay, explosion lifetime)
- 🎯 점수 (3/4/5매치 점수, 2/3/4연쇄 보너스)

💡 **개발 팁**: 인스펙터로 값을 바꿔보면서 최적의 게임 느낌을 찾을 수 있어요. 이걸 "폴리싱"이라고 해요.

---

### ✨ 특수블록 교차 효과 10가지 구현

**교차 효과란?**
- 특수블록 두 개를 직접 swap하면 색상이 달라도 교차 효과 발동
- 각 조합마다 더 강력한 효과 발생

**구현된 10가지 조합:**
| 조합 | 효과 |
|---|---|
| 줄볼 x 줄볼 | 두 위치에서 각각 줄볼 발동 |
| 줄볼 x 폭탄볼 | 3줄 동시 제거 |
| 폭탄볼 x 폭탄볼 | 19칸 제거 |
| 줄볼 x 타겟볼 | 날아가서 줄볼 효과 |
| 타겟볼 x 타겟볼 | 발사체 4개 |
| 폭탄볼 x 타겟볼 | 날아가서 폭탄 효과 |
| 무지개볼 x 줄볼 | 같은 색 → 줄볼로 변환 후 발동 |
| 무지개볼 x 폭탄볼 | 같은 색 → 폭탄볼로 변환 후 발동 |
| 무지개볼 x 타겟볼 | 같은 색 → 타겟볼로 변환 후 발동 |
| 무지개볼 x 무지개볼 | 전체 제거 |

**무지개볼 x 특수블록 교차 연출:**
- 일반블록들이 한번에 변환 ❌
- 거미줄처럼 하나씩 순차 탐지하며 변환 ✅
- 변환 완료 후 동시에 발동

---

### 📍 특수블록 생성 위치 로직 수정

**기존 문제:**
- swap 방향에 따라 특수블록 생성 위치가 달라지는 버그

**올바른 규칙:**
- swap으로 매치 시 → swap한 두 블록 중 매치 영역에 포함된 블록 위치
- 두 블록 모두 매치 영역 안이면 → 매치 영역 중앙에 가장 가까운 위치
- 낙하로 매치 시 → 매치 영역 중 랜덤 위치

---

### 🎨 콤보 메시지 시스템 개선

**기존:** 숫자만 표시 ("2 COMBO!")
**개선:** 콤보별 재미있는 메시지 + 네온사인 디자인

| 콤보 | 메시지 |
|---|---|
| 2콤보 | "굿!" |
| 3콤보 | "어-썸!" |
| 4콤보 | "쩌는 콤보!" |
| 5콤보+ | "오지고 지리고 렛잇고!" 등 랜덤 |

**디자인:**
- 네온사인 스타일 (형광 테두리, 배경 없음)
- 콤보별 다른 색상 (파랑/보라/주황/골드)
- 게임판 정중앙에 표시
- 2초 후 위로 스르륵 fade-out

---

### 💡 오늘의 개발 교훈

1. **디버그 도구의 중요성**: 개발자 모드 만들고 나서 테스트 효율이 크게 올라감
2. **폴리싱은 수치로**: 인스펙터로 값을 바꿔보며 게임 느낌을 직접 확인하는 게 제일 빠름
3. **교차 효과는 복잡**: 10가지 조합을 한 번에 구현하려면 에러 날 가능성이 높음. 나눠서 하는 게 좋음

---

## 2026.04.01 (1일차)

### 🛠️ 환경 세팅

**1. Node.js 설치**
- [nodejs.org](https://nodejs.org) 에서 LTS 버전 다운로드 후 설치
- Node.js를 설치하면 npm(패키지 관리 도구)도 자동으로 함께 설치됨
- 터미널에서 확인:
  ```bash
  node --version
  npm --version
  ```

**2. 클로드 코드 설치**
- 터미널에서 아래 명령어 입력:
  ```bash
  npm install -g @anthropic-ai/claude-code
  ```
- 설치 후 `claude` 명령어로 실행, claude.ai 계정으로 로그인

**3. VS Code 설치**
- [code.visualstudio.com](https://code.visualstudio.com) 에서 다운로드
- 코드를 보고 수정할 때 사용하는 편집기
- CLAUDE CODE 탭을 통해 VS Code 안에서 바로 클로드와 대화하며 작업 가능
- ⚠️ VS Code 내 CHAT 탭은 GitHub Copilot(다른 AI)이므로 반드시 **CLAUDE CODE** 탭 사용

**4. 작업 폴더 생성**
```bash
mkdir my-game
cd my-game
claude
```

---

### 📋 기획 작업

게임 개발 전 기획서를 먼저 작성했습니다.
코드를 바로 짜는 것보다 기획서를 먼저 정리하면 클로드 코드가 훨씬 정확하게 구현해줍니다.

**기획서에 담은 내용:**
- 게임 장르 및 플랫폼 (헥사고날 3매치, 브라우저)
- 그리드 구조 (77셀, 9-8-9-8-9-8-9-8-9 벌집 형태)
- 블록 구성 (5/6/7종 선택, 무지개 7색, 원형 블록)
- 조작 방식 (마우스 드래그 swap)
- 점수/Move 시스템
- UI 구성

💡 **팁**: 기획서는 `기획서.md` 파일로 저장해두면 클로드 코드에 매번 던져줄 수 있어서 편합니다.

---

### 🎮 게임 개발 (단계별 진행)

클로드 코드에 한 번에 다 만들어달라고 하지 않고, **단계별로 하나씩** 구현하면서 확인했습니다.

**1단계: 헥사 그리드 렌더링**
```
기획서.md 읽고 1단계만 해줘: 헥사 그리드 77셀을 브라우저에 렌더링하기.
```
- 결과물: `index.html`, `style.css`, `game.js` 3개 파일 자동 생성
- 브라우저에서 `index.html` 열어서 확인 (F5로 새로고침)

**2단계: 블록 배치 및 조작**
- 셀/블록 디자인 분리 (셀은 회색 고정, 블록은 셀보다 작은 원형)
- Play 버튼 누르기 전까지 셀만 보이도록
- 마우스 드래그 swap 조작 구현
- 초기 배치에서 3매치/4매치/5매치 없도록 보장

**3단계: 게임 로직**
- 6방향 3매치 감지 및 제거
- 블록 낙하 보충 (위에서 새 블록 떨어짐)
- 점수 시스템 (3매치=300점, 4매치=500점, 5매치=800점)
- Move 시스템 (swap 성공 시 -1)
- 콤보 보너스 (2연쇄+500, 3연쇄+1000, 4연쇄+2000)

**4단계: UI 완성**
- 시작 화면 (블록 종류 5/6/7 선택, Move 수 20/30/50 선택)
- 게임 중 HUD (점수, 목표점수, 남은 Move, Stop 버튼)
- 종료 화면 (클리어/실패 메시지, 재시작 버튼)
- 최고 점수 기록 (localStorage 저장)
- 목표 점수: 50,000점

**5단계: 게임 완성도 향상**
- 매치 애니메이션 Juice 효과 (scale pop)
- 힌트 시스템 (5초 대기 후 자동 반짝임, 5매치→4매치→3매치 우선순위)
- 콤보 메시지 네온사인 스타일

---

### ✨ 특수블록 시스템 구현

3매치 이상의 매칭 시 특수블록이 생성됩니다.
특수블록은 직접 클릭이 아닌, 일반 매치에 포함될 때 자동으로 발동됩니다.

**특수블록 4종:**

| 이름 | 생성 조건 | 효과 |
|---|---|---|
| 줄볼 | 1자 직선 4매치 | swap 방향으로 라인 전체 제거 |
| 타겟볼 | 평행사변형 4매치 | 랜덤 1칸 제거 |
| 폭탄볼 | 5매치 (비직선) | 주변 6칸 제거 |
| 무지개볼 | 1자 직선 5매치 | swap한 블록 색상 전체 제거 |

---

### 📱 모바일 대응 & 배포

**모바일 반응형 적용**
- 화면 너비에 따라 헥사 그리드 크기 자동 조절
- 퍼즐판이 모바일 화면에 꽉 차게 맞춰지도록

**배포용 단일 파일 생성**
- 개발은 `index.html` + `style.css` + `game.js` 분리 방식으로 유지
- 배포/공유 시 세 파일을 하나로 합친 `hexa_match3_demo_tool.html` 생성
- 이 파일 하나만 전달하면 누구나 바로 실행 가능

---

### 💡 클로드 코드 활용 팁 (1일차 경험)

1. **기획서 먼저 작성**: 클로드 코드에 기획서.md를 던지면 훨씬 정확하게 만들어줌
2. **단계별로 진행**: 한 번에 다 시키지 말고 하나씩 완료 확인 후 다음으로
3. **에러 나면 F12**: 브라우저 콘솔 탭에서 에러 복사 후 클로드 코드에 붙여넣기
4. **VS Code CLAUDE CODE 탭 사용**: CHAT 탭은 GitHub Copilot(다른 AI)임
5. **파일 3개 항상 같이**: index.html, style.css, game.js는 항상 같은 폴더에
6. **배포는 단일 파일로**: 공유할 때는 세 파일을 하나로 합친 파일 사용