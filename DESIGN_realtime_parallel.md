# 실시간 매칭 — 코어 race 차단 재설계

**브랜치**: `refactor/realtime-fill-ticker`
**작성일**: 2026-05-12 (Phase 1 후속)
**상태**: 🟡 사용자 검토 대기 — 코드 미착수
**전체 추정**: 8~12h, 2~4 세션 분할

---

## 한 줄 요약

> 어제: ticker 백그라운드 충전 + 큐 buffer 실시간 매칭. 오늘: 다중 흐름 동시 진행 도입 → race 다발 → patch 식 fix 누적.
> 결론: patch 폐기 + 코어 재설계로 race 근본 차단. 사용자 의도(ticker 백그라운드 + 동시 매칭) 유지.

---

## Phase 1 완료 사항 (이미 적용)

- ticker pauseCount 카운터화 (gravity.js)
- `_activeFlowCount` derived busy state (game.js)
- `enqueueAnim` 즉시 fire-and-track (큐 폐기, `_activeFlows` Set)
- `ANIM_THROTTLE_MS` 30ms (매크로 방지)
- `ANIM_QUEUE_MAX` 4 (동시 흐름 max)
- swap 2셀 lock + click 1셀 lock (다른 흐름 차단)
- ticker `computeFill`에서 lock 셀 skip
- 매치 라인 lock (인접 X, 라인 셀만)
- swap PRE-TRANS 강제 안착 (fill/gravity 중 element도 swap 시작)
- `getLineDirFromCells` 축 판정 버그 fix
- 무지개 사전 차단 (enqueueAnim 큐 buffer 사이 입력 누수 방지)
- 타겟볼 영역 타격 + 발사 동안 ticker 충전 동시 진행 (delay → bgDelay)

### Phase 1 patch 식 fix (재검토 필요)
- GRAVITY/DIAG/FILL OVERWRITE 자동 제거 — 잘못된 element 죽일 위험
- SWAP-RACE 종료 시 orphan 자동 제거 — 부분 효과
- 매치 처리 null-skip 가드 — 흐름 충돌 시 blockEls 정리 누락 발생

---

## 오늘 발견된 race — 카테고리화

### Race A — blockEls reference 덮어쓰기
- swap의 220ms 동안 blockEls 변경 race
- ticker animateGravity/Diagonal/FillDOM이 blockEls 덮어쓸 때 옛 element가 DOM 잔존 = orphan
- 매치 처리의 setTimeout이 element reference 잡고 200ms 후 .remove() — race 시간

### Race B — board=null 처리 race
- 매치 처리에서 board=null + setTimeout으로 element detach
- 그 사이 ticker fill이 새 element 생성 → blockEls 덮어쓰기
- null-skip 가드로 인한 다른 흐름의 blockEls 정리 누락

### Race C — fill 알고리즘 도달 불가
- 매치 후 중간 row board=null + 위 row 채워진 상태
- `computeFill`은 source(entrance) 위→아래만 → 막힌 빈 셀 못 도달
- gravity가 도와줘야 하지만 lock 또는 시간 race로 못 옮김

### Race D — swap element 보호 부족
- swap 시작 시 blockEls[c1][r1]=el_A 잡음
- 220ms 사이 매치 처리가 (c1,r1)을 매치 셀로 → blockEls=null + setTimeout(el_A.remove)
- swap 종료 시 blockEls swap이 다시 el_A 또는 el_B로 set
- 결국 매치 처리의 setTimeout이 swap의 element를 죽임 → 빈 셀

---

## 코어 재설계 — 4가지 변경

### 변경 1. 매치 처리 setTimeout 폐기

**현재**:
```js
matchedEl.classList.add('matched');
setTimeout(() => { if(matchedEl.parentNode) matchedEl.remove(); }, 200);
blockEls[c][r] = null;
board[c][r] = null;
```

**문제**: setTimeout 200ms 사이 race 가능 — 다른 흐름이 element를 swap 잡거나, ticker fill이 같은 셀에 새 element 만듦.

**제안**: matched class 추가 후 **즉시 detach** (DOM에서 제거). matched class는 CSS animation으로 fade-out 효과를 detached 부모(예: container 임시 자식)에서 진행, 또는 element를 즉시 detach 후 CSS animation 끝나면 remove.

```js
matchedEl.classList.add('matched');
// 즉시 detach but DOM에는 잠시 잔존 (애니메이션용)
// 옵션 A: 부모를 별도 container로 옮김 (z-index 영향)
// 옵션 B: CSS animationend 이벤트로 .remove()
matchedEl.addEventListener('animationend', () => matchedEl.remove(), { once: true });
blockEls[c][r] = null;
board[c][r] = null;
```

→ blockEls는 즉시 null. setTimeout race 0.

### 변경 2. blockEls reference → board cell에 element 통합

**현재**: `board[c][r] = {color, type, dir}` + `blockEls[c][r] = DOMElement` — 두 reference 분리.

**문제**: 두 reference가 다른 시간에 갱신되어 일관성 깨짐.

**제안**: `board[c][r] = {color, type, dir, el}` — cell이 element를 직접 소유.
- swap 시 `[board[c1][r1], board[c2][r2]] = [board[c2][r2], board[c1][r1]]` 한 줄로 element도 자동 swap (cell.el이 같이 이동)
- 매치 시 `cell.el?.remove(); board[c][r] = null;` 한 줄로 정리
- ticker fill 시 `board[c][r] = {color, ..., el: newEl}` 한 줄로 일관 set

전역 `blockEls` 폐기. `cell.el` 통합.

→ Race A의 reference 덮어쓰기 자체가 사라짐 (board가 진실의 원천).

### 변경 3. swap의 atomic 처리

**현재**:
```js
// 시작 시점에 el ref 잡음
const el1 = blockEls[c1][r1], el2 = blockEls[c2][r2];
// CSS transition 시작
el1.style.transition = ...; el2.style.transition = ...;
el1.style.left = ...; el2.style.left = ...;
// 220ms 대기
await skippableDelay(220);
// 220ms 후 blockEls swap
blockEls[c1][r1] = el2; blockEls[c2][r2] = el1;
```

**문제**: 220ms 사이 다른 흐름이 blockEls 변경 가능. swap 종료 시 충돌.

**제안**: swap 시작 시점에 **board cell 즉시 swap** (sync). 그 시점 즉시 element도 swap (cell.el 통합 후엔 자동).

```js
// sync: board + cell.el 모두 즉시 swap
[board[c1][r1], board[c2][r2]] = [board[c2][r2], board[c1][r1]];
// element CSS transition은 별도 (sync 후 시작)
const el1 = board[c1][r1]?.el, el2 = board[c2][r2]?.el;
// transition 시작 (이미 swap된 상태)
// dataset 갱신
// 220ms 후 transition cleanup만 (board는 이미 swap됨)
await skippableDelay(220);
// cleanup (transition='')
```

→ swap의 220ms 사이 다른 흐름이 변경해도 board가 이미 swap된 상태라 race 0.

### 변경 4. fill 알고리즘 — 막힌 빈 셀 도달

**현재 computeFill**: 각 source(entrance)에서 아래로 검사. 첫 not-null 셀 만나면 break. **막힌 빈 셀 못 도달**.

**제안**: 모든 빈 셀에 대해 위쪽에 도달 가능한 source 또는 cell이 있는지 검사. 없으면 fill로 새 cell 생성.

또는: gravity가 board=null 빈 셀을 위쪽에서 끌어오는 알고리즘을 보수적으로 (lock 시 잠시 대기).

알고리즘 옵션:
- A. **빈 셀 forward-fill**: 모든 빈 셀에 대해 (col, row) 위쪽 entrance source가 직접 닿는지 확인. 막혔으면 인접 column에서 대각선으로 도달 가능한지 확인.
- B. **bottom-up fill**: 한 column의 가장 아래 빈 셀부터 채움. 위 셀에 cell 있으면 gravity로 끌어옴. 위 셀도 빈 셀이면 fill (source 추가).
- C. **flood-fill**: BFS로 빈 셀 영역을 찾고 위쪽 source에서 채움.

가장 단순한 A 안 검토.

---

## 단계별 로드맵 (Phase 2)

### 2-1. patch 식 fix 검토 + 일부 폐기 (1h)
- GRAVITY/DIAG/FILL OVERWRITE 자동 제거 — 코어 fix 후 불필요할 가능성. 일단 유지하며 다음 단계 진행
- SWAP-RACE 종료 orphan 제거 — 동일
- 진단 로그는 유지 (검증용)

### 2-2. 매치 처리 setTimeout 폐기 (1.5h)
- matched class + animationend 이벤트로 detach
- CSS animation 기간 동안 element가 DOM 잔존 + matched 시각 효과
- animationend 후 .remove() — race 0 (transition 시간이 race 시간이 아니라 CSS animation 끝까지 자동 보장)

### 2-3. swap의 atomic board+element 처리 (1.5h)
- animateSwap에서 board cell 즉시 swap (sync)
- CSS transition은 swap 결과 후 시작
- 220ms 후 cleanup만

### 2-4. fill 알고리즘 개선 — 막힌 빈 셀 도달 (2h)
- computeFill을 빈 셀 forward-fill 또는 bottom-up 방식으로 재작성
- 모든 빈 셀이 채워지도록 보장

### 2-5. (옵션) element 모델 통합 — blockEls → cell.el (3h)
- 큰 작업. Phase 2-1~4 검증 후 결정
- 효과 크지만 위험도 큼

### 2-6. 회귀 검증 (1~2h)
- 단독 매치 / 콤보 / 특수 / 무지개 / 폭발 모두 정상
- 두 swap 동시 시 race 0
- 빈 셀 / DOM-DUP / orphan 모두 0

---

## 사용자 검토 요청

1. **방향 동의?** 매치 setTimeout 폐기 + swap atomic + fill 알고리즘 개선
2. **element 모델 통합 (2-5)** — 진행 / 보류?
3. **단계별 commit?** — 2-1, 2-2, 2-3, 2-4 각각 별도 commit
4. **검증 시점** — 단계별 사용자 검증 / 2-4 후 1번
5. **patch 코드 정리** — 코어 fix 후 OVERWRITE 자동 제거 / SWAP-RACE 자동 제거 폐기 검토

---

## 위험 평가

| 항목 | 위험도 | 완화 |
|---|---|---|
| 매치 setTimeout → animationend 변경 | 낮음 | CSS animation 기간이 비결정적 — fallback timeout 추가 가능 |
| swap atomic board swap | **중간** | swap 시작 시점에 즉시 board 변경 → 매치 처리 흐름과 시각 일관성. 검증 필요 |
| fill 알고리즘 변경 | **중간** | gravity와 협력 → 다양한 셀 타입(dead/entrance/pass/기믹) 호환 검증 필요 |
| element 모델 통합 | **높음** | 광범위 코드 변경. 모든 매치/swap/render 코드 수정. 단계 2-5는 별도 PR 추천 |

---

## 롤백 방법

각 단계 commit 별 revert 가능. 2-5는 별도 브랜치 분기 후 통합.
