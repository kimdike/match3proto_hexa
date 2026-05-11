# 코어 개편 — 실시간 충전 ticker

**브랜치**: `refactor/realtime-fill-ticker`
**작업 일자**: 2026-05-11
**이유**: 상자 연쇄 폭발 시 "1번 폭발 → 충전 → 2번 폭발 → 충전" 흐름이 끊겨 보이는 문제 해결 + 사용자 의도("하단에서 빈 공간 생기면 즉시 위에서 블록 실시간 낙하") 반영

---

## 한 줄 요약 (비개발자용)

> 게임이 "매치 후에 새 블록을 떨어뜨린다" → "빈 칸만 생기면 즉시 알아서 새 블록이 흘러내린다"로 바뀌었어요.
> 폭발이나 매치가 일어나는 동안에도 블록이 끊김 없이 충전돼서 자연스러운 흐름이 됩니다.

---

## 비유로 이해하기

### Before (수정 전) — "공장 컨베이어 멈춤" 모델
> 가게에 손님이 빈 자리에 앉으려고 함.
> - 점원이 빈 자리 발견
> - 점원이 직접 "지금부터 채울게요" 하고 한 칸씩 채움
> - 채우는 동안 점원이 다른 일 못 함
> - 채움 끝나면 다음 손님 받음
>
> → 모든 일이 줄 서서 진행. 폭발 → 충전 → 폭발 → 충전 → 폭발 → 충전 (각 단계 "기다림")

### After (수정 후) — "자동 음료수 디스펜서" 모델
> 음료수 디스펜서가 옆에 항상 켜져 있어요.
> - 손님이 컵을 가져가면 디스펜서가 즉시 다음 컵을 채움
> - 손님이 컵 가져가는 행위 자체와 무관하게 디스펜서는 항상 동작
> - 점원은 다른 일에 집중 (재료/주문 받기 등)
>
> → 빈 자리 생기는 순간 자동 충전. 폭발은 자기 페이스로 연속 진행. 충전은 백그라운드에서 동시 진행.

---

## 게임 사용자 관점에서 무엇이 다른가?

| 상황 | Before | After |
|---|---|---|
| 매치 한 번 | 매치 → 잠시 멈춤 → 새 블록 떨어짐 → 다음 매치 검사 | 매치 → 즉시 새 블록이 흘러내림 → 안정화 후 매치 검사 |
| 상자 3개 연쇄 폭발 | 1번 폭발 → 멈춤 → 충전 → 2번 폭발 → 멈춤 → 충전 → 3번 폭발 → 멈춤 → 충전 (총 2~3초) | 1번 폭발 → 즉시 충전 시작 + 2번 폭발 → 충전 + 3번 폭발 → 충전 마무리 (총 1초 이내) |
| 무지개볼 전체 제거 | 큰 빈 공간 → "와르르 채우기" 한 묶음 | 빈 자리 생기는 순간순간 새 블록이 위에서 흘러내림 (폭포 흐름) |

---

## 기술 변경 디테일 (개발자용)

### 변경된 파일 (3개)

| 파일 | 변경 내용 |
|---|---|
| `gravity.js` | **Ticker 시스템 신설**. 기존 `applyGravity` / `fillEmpty` 함수는 호환 wrapper로 유지 (`waitForSettle` alias). |
| `main.js` | `startGame()` 끝에서 `startGravityTicker()`, `resetToStart()`에서 `stopGravityTicker()` 호출. 기존 `await applyGravity/fillEmpty` 호출처는 그대로 (wrapper가 처리). |
| `board.js` | `drainCrateExplosions` 단순화 — 폭발 사이 `await applyGravity/fillEmpty` 페어 폐기 → `markBoardDirty` + `await delay(150)` stagger만. 끝에 `await waitForSettle()` 한 번. |

### 핵심 API (gravity.js 신규)

```js
startGravityTicker()  // 게임 시작 시 호출 — ticker 가동
stopGravityTicker()   // 게임 종료 시 호출 — ticker 정지
markBoardDirty()      // 효과 코드가 board 변경 후 호출 (선택적, waitForSettle도 자동 처리)
waitForSettle()       // 보드 안정화까지 대기 — 매치 검사 직전 호출
```

### Ticker 내부 동작

```
50ms 간격 루프:
1. computeGravity / computeDiagonalFill / computeFill 호출
2. 변화 있으면:
   - animate (CSS transition 비동기 진행)
   - boardSettled = false
   - 다음 tick은 gravityIterDelay (70ms) 후
3. 변화 없으면:
   - boardSettled = true (이전이 false였다면)
   - refreshBlockElsCoordinates 호출
   - settleWaiters 모두 resolve
   - 다음 tick은 idle 50ms 후
```

### 호환 보장

- 기존 코드의 `await applyGravity(); await fillEmpty();` 패턴은 그대로 동작 (둘 다 `waitForSettle` alias).
- 효과 코드의 `board[c][r] = null` 후 명시적 `markBoardDirty` 호출 안 해도 `waitForSettle`이 강제 dirty 처리.
- ticker는 게임 중에만 가동 — 로비/메뉴 화면에서는 정지.

---

## 위험 평가

| 항목 | 위험도 | 완화 |
|---|---|---|
| Race condition (board 동시 수정) | **낮음** | JS single-threaded — `computeGravity` 등은 atomic. await 사이에만 다른 코드 실행 가능. ticker는 변경된 board를 다음 tick에 새로 읽음. |
| 매치 검사 도중 떨어지는 블록 hit | **낮음** | `waitForSettle()` 후에만 `findAllMatches` 호출 → 떨어지는 도중 블록은 매치 검사에 포함 X |
| ticker stop 안 됨 (메모리 누수) | **낮음** | `stopGravityTicker`가 setTimeout handle clear + pending waiter resolve. 게임 종료/로비 진입 시 명시적 정지. |
| 호환 wrapper에서 무한 대기 | **낮음** | `waitForSettle`은 ticker가 idle 상태일 때 즉시 resolve (settled=true 도달 시). ticker 정지 시 waiter 모두 resolve. |
| 폭발 + 매치 + 충전 동시 진행 시 시각적 버그 | **중간** | 사용자 검증 필요. 다음 섹션 참조. |

---

## 검증 권장 시나리오 (사용자 직접 테스트)

### ✅ 기본 흐름
1. 일반 매치 한 번 → 새 블록 즉시 떨어지는지
2. 연쇄 매치 (콤보) → 끊김 없이 진행되는지
3. 매치 후 매치 검사가 정상 동작 (떨어지는 블록 잘못 매치 안 되는지)

### ✅ 상자 (Crate)
1. 상자 1단계 단독 매치 → 폭발 + 인접 6셀 모두 정상 충전
2. 상자 3개 직선 인접 → 1번 폭발 → 충전 시작 → 2번 폭발 → 충전 진행 + 3번 폭발 → 충전 마무리. 끊김 없이 자연스럽게.
3. 상자 클러스터 (4~5개 뭉친) → 연쇄가 너무 빠르지 않은지 (stagger 150ms이 충분한지)

### ✅ 특수블록
1. 줄볼 / 폭탄볼 / 타겟볼 / 무지개볼 단독 발동 → 충전 정상
2. 무지개 × 무지개 (보드 전체 제거) → "와르르" 한 묶음이 아닌 "폭포" 흐름으로 충전
3. 줄볼 × 폭탄 등 교차 효과 → 정상

### ✅ 셀 타입
1. dead 셀 옆 대각선 충전 → 정상
2. entrance 셀 + pass 셀 → 정상
3. 기믹 셀(돌/잔디/상자) 옆 충전 → 정상

### ⚠️ 엣지 케이스
1. 게임 중 STOP → 로비로 → 다시 게임 진입: ticker 정지/재시작 정상
2. "처음으로" 버튼 → 다른 스테이지 진입: ticker 재시작 정상
3. 매우 빠른 swap 연속 입력 (실시간 매칭 skipDelay와 호환)

---

## 롤백 방법

문제 발견 시:

```bash
# 1. 코어 개편 브랜치 폐기
git checkout main
git branch -D refactor/realtime-fill-ticker

# 2. main의 working tree 변경 사항은 그대로 (오늘 작업한 다른 변경 + 코어 개편 변경이 섞여 있음)
#    필요 시 부분 폐기:
git checkout main -- gravity.js main.js board.js   # 이 3개 파일만 원복

# 3. 또는 완전 폐기 (모든 변경 사항 사라짐 — 주의):
git checkout main
git restore --source=main --staged --worktree .
```

---

## 다음 단계 (이번 작업에 포함 안 됨)

1. **실시간 매칭 v2 — 진정한 동시 진행** (12~16h, 3~5 세션). 현재는 큐 buffer + 순차 실행. 로얄매치 스타일 동시 시각 진행 원함 → 큰 코어 재설계.
2. **ticker rate 인스펙터 노출** — `_TICK_IDLE_MS` 50ms를 인스펙터에서 조절 가능하게.
3. **충전 페이싱 폴리싱** — 폭포 흐름이 너무 빠르면 시각적 부담. iter delay 조정으로 자연스러운 리듬 찾기.

---

## 📝 v2 추가 fix (2026.05.11 후속)

### 🐛 진단 + 해결 사이클 (사용자 피드백 기반)

#### Fix 1 — 폭발 셀 충전 race
**증상**: 상자 폭발 후 인접 6셀 중 일부가 영구 빈 칸으로 남음.
**원인**: `triggerCrateExplosion`의 `setTimeout(280ms)`로 인접 블록 제거 시, 그 사이 ticker가 새 element 생성 → setTimeout fire 시 새 element를 죽임.
**해결**: setTimeout closure에 element 참조를 캡쳐 → `blockEls[nc]?.[nr] === targetEl` 비교 후 같은 element일 때만 remove. 새 element는 보호.

#### Fix 2 — 순차 폭발 흐름
**증상**: 상자 3개 연쇄가 동시 폭발로 보임 (사용자 의도: 1→충전→2→충전→3→충전).
**해결**: `pendingCrateExplosions` 큐 + `drainCrateExplosions()` async 드레인. hitCrate level 0 도달 시 큐 push만, drain pop 시 visual + 인접 처리.

#### Fix 3 — 폭발 시각 끊김
**증상**: 1→2→3 순차는 되는데 게임이 끊기는 느낌.
**원인**: drain의 strict `await applyGravity/fillEmpty` 페어가 폭발 사이 동작 차단 → 충전이 폭발 동시에 진행 안 됨.
**해결**: drain 안의 `await applyGravity/fillEmpty` 폐기 → `markBoardDirty` + 짧은 stagger만 → ticker가 백그라운드에서 충전.

#### Fix 4 — 매치 후 빈 칸 발생 (가장 큰 race)
**증상**: 스왑 매치 후 충전 도중 빈 칸이 잠시 생김 (영구 빈 칸 아님, 시각 race).
**원인**: 매치 제거 코드 패턴이 **ticker race vulnerable**:
```js
board[c][r]=null;          // ticker가 빈 셀 인식
await delay(matchedDelay); // ← 이 사이 ticker가 fill로 새 element 생성
                           //    → blockEls[c][r] = newEl
blockEls[c][r].remove();   // ← 새 element를 죽임! 빈 칸 발생
```
**해결**: 두 가지 동시 적용
- **`delay()` 자체에 ticker pause/resume 묶기** (`game.js`): `await delay()` 동안 ticker 일시 정지 → 17곳의 race 자동 차단
- **매치 제거 패턴 element snapshot** (`game.js`): `matchedEl` 참조 캡쳐 + `blockEls[c][r]=null` 즉시 + setTimeout으로 detached 제거. matched anim은 setTimeout 시간만큼 정상 진행.
- **`bgDelay()` 신설**: ticker pause 안 함. drainCrateExplosions에서 사용 (폭발 stagger 도중 ticker가 백그라운드 충전 계속 진행).

#### Fix 5 — 실시간 매칭 (입력 큐 + 매크로 방지)
**증상**: 일반 매치/특수 진행 중 swap이나 클릭 입력이 무시됨.
**원인**: 클릭 핸들러에 `!busy` 차단 → 일반 매치 중 busy=true이므로 차단됨.
**해결**:
- `main.js` 클릭 핸들러에서 `!busy` 제거. `isBusyRainbow`만 체크 (무지개 잠금만 유지).
- 모든 입력은 `enqueueAnim` 큐로 들어가 buffer됨. 첫 매치 끝나면 자동으로 다음 입력 처리.
- **매크로 방지**: `ANIM_THROTTLE_MS=100` + `ANIM_QUEUE_MAX=2`. 100ms 이내 추가 입력 무시 + 큐 max 2개 (현재 진행 + 다음 1개).

#### Fix 6 — 압축 폐기 (사용자 의도 정정)
**잘못된 설계**: `_scaleDelay` 추가로 `delay()`, `bgDelay()`가 skipDelay=true 시 50% 압축. "매치 진행 중 새 입력 들어오면 빨라짐" 의도였음.
**사용자 정정**: 실시간 매칭 = 입력을 받아주는 기능. 게임 속도 압축 X. 연쇄는 평소 속도로 차분히 진행되어 구경 가능해야 함.
**해결**: `_scaleDelay` 폐기. `delay()` / `bgDelay()` / `waitForSettle` buffer 모두 평소 속도 유지.

### ✅ 최종 동작

| 시나리오 | 동작 |
|---|---|
| 일반 매치 한 번 | 평소 속도로 매치 → 충전 → 안정화 |
| 일반 매치 진행 중 추가 swap | 큐에 buffer (최대 2개) → 첫 매치 끝나면 두 번째 swap 자동 처리. 매치 속도 압축 X |
| 콤보 연쇄 | 평소 속도로 차분히 진행 (구경 가능). 빨라지지 않음 |
| 상자 연쇄 폭발 | 1→충전→2→충전→3→충전 (각 폭발 사이 220ms stagger, ticker가 백그라운드 충전 동시 진행) |
| 무지개 발동 / 무지개 교차 | `isBusyRainbow=true` → drag/swap/클릭 모두 차단. 모든 블록 마킹+터짐+제거 끝나면 잠금 풀림 |
| 매크로 (10번 연타) | throttle 100ms로 일부 무시. 정상 인간 속도는 통과 |

### 🚧 남은 작업 (다음 세션)

**진정한 동시 진행 (Realtime Matching v2)** — 두 매치가 시각적으로 겹쳐서 동시 진행. 큰 코어 재설계 필요 (12~16h, 3~5 세션). 현재 브랜치 `refactor/realtime-fill-ticker` 유지하며 디벨롭.
