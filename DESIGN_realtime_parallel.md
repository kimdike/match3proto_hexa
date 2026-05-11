# 실시간 매칭 v2 — 진정한 동시 진행 설계

**브랜치**: `refactor/realtime-fill-ticker`
**작성일**: 2026-05-12 (20일차 다음 세션)
**상태**: 🟡 사용자 검토 대기 — 코드 미착수
**전체 추정**: 12~16h, 3~5 세션 분할

---

## 한 줄 요약 (비개발자용)

> 지금: 매치 한 번 → 끝까지 진행 → 그 다음 매치 시작 (순서대로 한 명씩)
> 목표: 매치 A 진행 중 매치 B도 함께 진행 → 두 매치가 시각적으로 겹쳐 보이면서 동시에 흘러감 (로얄매치 스타일)

---

## 비유로 이해하기

### v1 (현재) — "1차선 도로"

> 가게에 손님이 한 명씩만 줄 서서 들어옴.
> - 1번 손님이 주문 → 받기 → 결제 → 나가기 (전체 사이클 끝)
> - 그동안 2번 손님은 줄 서서 기다림 (큐 buffer)
> - 1번 손님 나간 후 2번 손님 시작
> - 입력은 받지만 처리는 직렬

### v2 (목표) — "다차선 셀프 키오스크"

> 가게에 키오스크 여러 대.
> - 1번 손님 키오스크 A에서 주문 진행
> - 2번 손님 들어오면 키오스크 B 사용
> - 두 명이 **동시에** 주문 진행
> - 같은 메뉴를 동시에 누르면? → 자연스럽게 한 사람이 가져가고 다른 사람은 다음 메뉴 (lock 없이 합쳐짐 가정)
> - 충돌(=영역 겹침)이 잦으면 키오스크 분리 룰 도입 (Phase 2 lock 시스템)

---

## 사용자 관점 변화

| 시나리오 | v1 (지금) | v2 (목표) |
|---|---|---|
| 매치 후 다른 위치에 또 매치 | A 끝까지 진행 → 다음에 B 시작 | A 진행 중 B도 함께 진행. 두 곳에서 매치 pop 동시에 보임 |
| 연쇄 콤보 중 새 swap | 콤보 완료 대기 → 그 다음 처리 | 연쇄 진행 중에도 새 swap 동시 진행. 흐름 끊김 없음 |
| 무지개볼 발동 중 | 모든 입력 차단 (지금도 v2도 동일) | 동일 — 무지개는 v2에서도 잠금 유지 |

---

## 현재 코드 구조 분석 (변경 대상 식별)

### v1 핵심 구조

```
[입력]
  └─ trySwap(c1,r1,c2,r2)
       └─ enqueueAnim(async () => {
            busy=true; isBusyNormal=true;
            (executeSwap, animateSwap, processMatchStep, applyGravity/fillEmpty, 연쇄 매치 루프)
            busy=false; isBusyNormal=false;
          })
            └─ animQueue.push({fn, ts})
                 └─ drainAnimQueue:
                      while(animQueue.length>0){
                        const item = animQueue.shift()
                        await item.fn()  // ← 직렬 실행. 한 번에 하나만.
                      }
```

### 직렬 보장에 의존하는 것들

| 항목 | 위치 | 의존 방식 |
|---|---|---|
| `busy` / `isBusyNormal` 글로벌 | game.js | 하나의 흐름만 동작한다 가정. 시작 시 true, 끝 시 false |
| `skipDelay` | game.js | 큐에 다음 item 있으면 true → 현재 흐름 압축. 한 흐름만 활성 |
| `_tickerPaused` (ticker) | gravity.js | 단순 boolean. `delay()` 시작 시 pause, 끝 시 resume. 두 흐름 동시 pause/resume 호출 시 한쪽이 resume → 다른 쪽 아직 await 중에 ticker 재가동 → race |
| `_lastEnqueueTs` | game.js | 100ms throttle. 동시 진행 시에도 의미 그대로 (매크로 방지) |
| `dragState` / `hintTimer` | game.js | 흐름과 무관 (입력 레이어). 그대로 OK |
| `_lastClearReward` / `_lastClearDiamond` | main.js | 클리어 시점에 단발 set. 직렬 가정 |

### processMatchStep의 분리 가능 단위

```
processMatchStep(curLines, curCells, clusters, ...)
  1. 특수볼 생성 판정 (determineSpecial)         ← 순수 함수
  2. 특수볼 발동 수집 (board 읽기)               ← 순수 함수
  3. 발동 큐 처리 (showStripeBeam/showBombExplosion + 효과 범위 누적)  ← board 읽기, DOM 그리기, await 없음
  4. 무지개볼 피격 체크                           ← board 읽기, await 없음
  4b. 돌 기믹 인접 타격                           ← board 읽기/쓰기, await 없음
  5. 점수 / 콤보 메시지                           ← await 없음
  6a. 특수블록 생성 연출                          ← await delay(mergeDelay) × 2
  6b. 나머지 매치 블록 제거                       ← await delay(matchedDelay)
  6c. 타겟볼 발동 (스텝1 영역 → await → 스텝2 발사 → await)  ← await delay × N
  6d. drainCrateExplosions                       ← await + 폭발 stagger
```

→ **step 단위 자연 분할 지점**:
- A. **계획 단계** (1~5, await 없음, board 변경은 hitGimmick 정도): 순수 계산 + DOM 마킹
- B. **연출 단계** (6a~6d, await 다수): 시각 연출 + board null 설정

A는 atomic하게 끝낼 수 있음. B만 동시 진행 대상.

---

## Phase 분할 전략

### Phase 1 (이번 세션, 5~7h) — 큐 다중 실행 (lock 없이)

**목표**: `drainAnimQueue`가 여러 item을 **동시에 await** 시작. 두 매치가 자연스럽게 겹치면 합쳐서 한쪽이 처리되도록 가정.

**핵심 변경 4개**:

1. **drainAnimQueue → drainAnimQueueParallel**
   - `await item.fn()` 직렬 → `item.fn()` 호출 후 `_activeFlows.push(promise)` (await 안 함)
   - 큐가 비면 `Promise.all(_activeFlows)` 대기 후 종료
   - 매크로 방지(`ANIM_THROTTLE_MS`)는 유지, `ANIM_QUEUE_MAX`는 늘림(2 → 4)

2. **흐름 로컬 상태 도입** — 글로벌 → 흐름별 context
   - `trySwap` / `tryActivateSpecialClick` 내부에서 `const ctx = { flowId, busyLocal:true }`
   - 글로벌 `busy` / `isBusyNormal`은 "활성 흐름 수 > 0"으로 derived state
   - `_activeFlowCount` 카운터 도입 → 0이면 busy=false

3. **ticker pause/resume 카운터화**
   - `_tickerPauseCount` 정수 카운터. `pauseTicker()` → +1, `resumeTicker()` → -1
   - 0 도달 시에만 실제 ticker 재가동
   - 두 흐름이 동시 pause/resume 해도 안전

4. **processMatchStep "충돌 친화"** — board[c][r]=null 했는데 이미 null이면 skip
   - `board[c][r] = null` 직전에 `if(board[c][r] === null) continue;`
   - blockEls도 동일. 다른 흐름이 이미 처리한 셀은 자연 skip
   - 매치 검사는 흐름별 독립 (`findAllMatches`는 순수 함수, 호출 시점 board 스냅샷 사용)

**가정 (사용자 동의 필요)**: 두 매치 영역이 자주 겹치진 않음. 겹치면 한쪽이 board=null 봐서 자연 skip. 시각 충돌(matched anim 중첩) 정도는 허용 — Phase 2에서 영역 lock으로 해결.

**비검증 영역 (Phase 1에서 의도적 미해결)**:
- 폭발 + 매치가 같은 셀에 동시 진행 → matched 클래스 중첩 가능 (시각 깜빡임)
- 줄볼 라인이 다른 매치 영역 통과 → 두 흐름의 hitGimmick 카운터 race (스톤 단계 어긋남 가능)
- 콤보 카운터 흐름 간 공유 (현재 `combo`는 trySwap 내 local) → 그대로 두면 흐름별 독립 OK

### Phase 2 (5~7h) — 영역 lock + 시각 충돌 처리

**필요 시점**: Phase 1 검증 후 사용자가 "영역 겹침으로 깜빡임 거슬림" 보고 시.

**도입할 lock 시스템 3안 (사용자 선택)**:
- 안 A: **셀별 lock** (`_cellLock[c][r]`). 흐름이 처리할 셀 미리 점유. 충돌 시 한쪽 후순위
- 안 B: **영역 lock** (`_areaLock`: bbox set). 흐름이 영향 범위 미리 계산 → 겹치면 후속 큐로 미룸
- 안 C: **소프트 lock** (race 허용, 시각 보정만). board/blockEls는 atomic하게 set만, 시각 효과(pop animation)는 dedupe

### Phase 3 (3~4h) — 무지개 잠금 재정의 + 광범위 검증

- 무지개 발동 중에는 v2에서도 단독 흐름 보장
- 폭발 → 매치 chain 교차 (drainCrateExplosions가 다른 흐름의 매치 검사와 만남) 처리
- 회귀 테스트: 매치/특수/폭발/잔디/도감/미션/천장 전 시스템

---

## Phase 1 디테일 — 이번 세션 작업 계획

### 작업 단위 (commit 분할)

각 단계마다 **사용자 검증 → commit**. 위험 시 직전 commit으로 rollback.

| 순서 | 작업 | 검증 시점 | 추정 |
|---|---|---|---|
| 1 | ticker pauseCount 카운터화 (gravity.js) | 단독 매치/콤보 기존 동작 OK | 30~45m |
| 2 | `_activeFlowCount` 도입 + busy derived (game.js) | 단독 매치 OK, busy 표시 정상 | 30~45m |
| 3 | processMatchStep null-skip 가드 (game.js) | 단독 매치 동일 동작 (skip 안 일어나면 변화 없음) | 30~45m |
| 4 | drainAnimQueueParallel — 큐 동시 await | 두 swap 동시 입력 → 두 매치 시각 겹침 확인 | 2~3h |
| 5 | 검증 + 미세 조정 | 회귀 점검 (10~15가지 시나리오) | 1.5~2h |

총 5~7h. 한 commit씩 작게 가서 위험 시 일부만 rollback 가능.

### 1단계: ticker pauseCount 카운터화

**변경 (gravity.js)**:
```js
// before
let _tickerPaused = false;
function pauseTicker(){ _tickerPaused = true; }
function resumeTicker(){ _tickerPaused = false; }

// after
let _tickerPauseCount = 0;
function pauseTicker(){ _tickerPauseCount++; }
function resumeTicker(){ if(_tickerPauseCount > 0) _tickerPauseCount--; }
// _gravityTickerLoop에서 _tickerPaused 참조 → _tickerPauseCount > 0
```

**영향**: 흐름 1개 시 동일 동작. 흐름 2개가 동시에 pause 호출하면 +1+1=2 → 양쪽 다 resume까지 ticker pause 유지. 안전.

### 2단계: _activeFlowCount + busy derived

**변경 (game.js)**:
```js
let _activeFlowCount = 0;
// busy / isBusyNormal 직접 set 폐기. 흐름 시작/종료에서 카운터만 조작.
function _flowStart(){ _activeFlowCount++; busy = true; isBusyNormal = true; }
function _flowEnd(){
  _activeFlowCount = Math.max(0, _activeFlowCount - 1);
  if(_activeFlowCount === 0){ busy = false; isBusyNormal = false; }
}
```

`trySwap` / `tryActivateSpecialClick` 시작/끝에 `_flowStart` / `_flowEnd` 호출. 글로벌 `busy = true` 직접 set은 모두 교체.

### 3단계: processMatchStep null-skip 가드

**변경 (game.js)** — 6b 루프:
```js
for(const [c,r] of allCells){
  if(mergeSet.has(`${c},${r}`)) continue;
  if(board[c]?.[r] == null) continue;  // ← 추가. 다른 흐름이 이미 처리
  const matchedEl = blockEls[c]?.[r];
  ...
}
```

타겟볼 6c, hitGimmick 호출처 등도 동일한 가드 추가.

**영향**: 흐름 1개 시 이전과 동일 (board != null인 셀만 처리는 기존 그대로). 흐름 2개 충돌 시 한쪽 자연 skip.

### 4단계: drainAnimQueueParallel

**변경 (game.js)**:
```js
// before
async function drainAnimQueue(){
  animRunning = true;
  while(animQueue.length > 0){
    const item = animQueue.shift();
    if(Date.now() - item.ts > SWAP_EXPIRE_MS) continue;
    skipDelay = animQueue.length > 0;
    try{ await item.fn(); }catch(e){ console.error(e); }
  }
  skipDelay = false;
  animRunning = false;
}

// after
const _activeFlows = new Set();
async function drainAnimQueueParallel(){
  animRunning = true;
  while(animQueue.length > 0 || _activeFlows.size > 0){
    while(animQueue.length > 0){
      const item = animQueue.shift();
      if(Date.now() - item.ts > SWAP_EXPIRE_MS) continue;
      const p = item.fn()
        .catch(e => console.error('[flow]', e))
        .finally(() => _activeFlows.delete(p));
      _activeFlows.add(p);
    }
    // 큐 비어 있고 활성 흐름 있으면 하나라도 끝날 때까지 대기
    if(_activeFlows.size > 0){
      await Promise.race(_activeFlows);
    }
  }
  animRunning = false;
}
```

`skipDelay` 사용 폐기 (이미 v1 막바지에서 압축 제거됨 — `delay()`는 평소 속도. 큐는 buffer 역할만이므로 v2에서 큐 다중 실행하면 skipDelay 의미 자동 사라짐).

`ANIM_QUEUE_MAX`: 2 → 4로 상향 (동시 4 흐름까지 받음). 매크로 throttle은 그대로.

### 5단계: 회귀 점검 시나리오

**기본 동작 (v1 대비 회귀 없어야 함)**:
- [ ] 일반 매치 1개 → 정상 진행 + 충전 + 매치 검사
- [ ] 연쇄 매치 (콤보) → 콤보 메시지 + 골드 표시
- [ ] 줄볼 / 폭탄볼 / 타겟볼 / 무지개볼 단독 발동
- [ ] 무지개볼 발동 중 swap 시도 → 차단 (`isBusyRainbow`)
- [ ] STOP → 로비 → 재진입 → ticker 정상 재시작

**v2 신기능 확인**:
- [ ] 빠르게 두 swap (양쪽 끝 위치 매치) → 두 매치가 시각적으로 겹쳐 진행
- [ ] swap A 후 매치 진행 중 swap B (가까운 위치) → 자연 합쳐짐 또는 한쪽 skip
- [ ] 콤보 진행 중 새 swap → 콤보 + 새 매치 시각 동시
- [ ] 폭탄 발동 중 다른 위치 swap → 동시 진행

**위험 시나리오 (Phase 1에서 시각 깜빡임 허용)**:
- 두 매치 영역 직접 겹침 (예: 같은 셀 포함) → matched anim 중첩 깜빡임 가능 (Phase 2 해결)
- 줄볼 라인이 다른 매치 영역 관통 → 점수 누락 가능 (Phase 2 해결)

---

## 위험 평가

| 항목 | 위험도 | 완화 |
|---|---|---|
| ticker pause/resume 비대칭 (count 누수) | **중간** | _flowEnd에서 강제 pause count = 0 보장 / 또는 흐름별 pause count 분리 |
| board[c][r] = null 직후 다른 흐름이 같은 셀 처리 시도 | **낮음** | null-skip 가드 (3단계) |
| blockEls remove() 중복 호출 → DOMException | **낮음** | matchedEl 참조 캡쳐 시점에 이미 null이면 skip (snapshot 패턴 그대로 유지) |
| hitGimmick 동시 호출 → 스톤 단계 race | **중간** | hitStones Set은 흐름별 local. 같은 셀 동시 hit 시 양쪽 다 단계 -1 → 1번 더 깎임. Phase 2에서 cell lock 도입 시 해결 |
| 점수 / 콤보 카운터 흐름 간 race | **낮음** | `score += turnScore` 단순 누적. JS single-threaded라 atomic. 콤보는 흐름별 local |
| `_lastClearReward` 두 흐름 동시 클리어 set | **낮음** | 마지막 흐름의 값이 살아남음. 일반 플레이에선 동시 클리어 거의 없음 |
| 무지개 발동 중 일반 매치 흐름 진행 | **중간** | `isBusyRainbow=true` 시 enqueueAnim에서 차단 (현재 main.js에 이미 있음). 진행 중 흐름은 그대로 두고 새 흐름만 막음. 무지개 시작은 큐 비울 때까지 대기 (Phase 3에서 정교화) |

---

## 사용자에게 확인 필요한 결정 사항

1. **Phase 1 가정 동의 확인** — "두 매치 영역 자주 겹치지 않음. 겹치면 한쪽 자연 skip 허용 (시각 깜빡임은 Phase 2)"
   → ☑️ OK / ❌ 깜빡임도 첫 단계부터 막아야 함 (→ Phase 1+2 합쳐서 작업)

2. **ANIM_QUEUE_MAX 상한** — 2 (현재) → 4 (제안). 동시 진행 최대 흐름 수.
   → ☑️ 4 OK / ❌ 다른 값 (2 / 3 / 6 등)

3. **commit 단위** — 5단계 각각 commit (5 commit) / 또는 큰 묶음 (Phase 1 전체 1 commit)
   → ☑️ 단계별 5 commit (rollback 안전) / ❌ 통째 1 commit

4. **검증 시점** — 5단계 끝에 사용자 검증 1번 / 각 단계마다 사용자 검증
   → ☑️ 단계별 검증 (1, 2, 3 단계는 회귀 0 확인 후 4단계로) / ❌ 5단계 후 1번만

5. **무지개 흐름 처리** — Phase 1에서는 무지개 진행 중 = 다른 흐름 차단 그대로 유지 / Phase 3에서 정교화
   → ☑️ Phase 3에서 정교화 / ❌ Phase 1에서 같이

---

## 롤백 방법

```bash
# 단계별 commit 한 경우 — 특정 commit만 revert
git revert <commit-sha>

# Phase 1 전체 폐기
git reset --hard 8fb35ca  # 어제 마지막 commit으로

# 또는 새 브랜치로 격리 후 main에서 작업 분리
git branch realtime-v2-attempt
git reset --hard 8fb35ca
```

---

## 다음 단계 (이 설계 OK 시)

1. 사용자가 위 5가지 결정 사항 응답
2. 작업 순서 + commit 단위 확정
3. 1단계 (ticker pauseCount) 코드 변경 → 검증 → commit
4. 2단계, 3단계, 4단계, 5단계 순차 진행
5. Phase 1 완료 후 사용자 만족도 확인 → Phase 2 필요 여부 판단

---

## 참고 — 기존 문서

- `CHANGE_LOG_realtime_fill.md` — v1 코어 개편 (ticker 모델, 입력 큐 buffer)
- `devlog.md` 20일차 — 어제 작업 + 사용자 피드백 사이클 + 5가지 교훈
- `todolist.md` — "🔥 실시간 매칭 v2" Phase 1/2/3 큰 그림
