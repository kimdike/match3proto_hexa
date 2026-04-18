# 헥사 3매치 퍼즐 - TODO 리스트

## 🔥 진행 중 / 남은 작업

### 코어 게임플레이
- [ ] 속도 조절 슬라이더 UI (우측 패널)
- [ ] 매칭 계산 속도 개선 (배치 처리 방식)

### 리팩토링 후 정리 (2026.04.18 완료분 기반)
- [ ] Dead code / debug 로그 정리
  - `ui.js` `lastCleared` (write만 있고 read 없음)
  - `ui.js` setupUI Space 키 핸들러 DEBUG 로그 다수
  - `main.js` removeBlockAt / updateHoveredCellFromMouse DEBUG 로그
  - `gravity.js` dead code 4개 (animateGravity / animateDiagonalFill / animateFill / canFillFromTop)
- [ ] `boardData` 미사용 export 객체 제거 또는 실제 사용처 연결 (game.js)

---

## ✅ 완료된 작업

- [x] 헥사 그리드 렌더링 (77셀, 회색)
- [x] 블록 랜덤 배치 (3매치 없는 초기 배치)
- [x] 마우스 드래그 swap 조작
- [x] 6방향 3매치 감지 및 제거
- [x] 블록 낙하 보충
- [x] 점수 및 Move 시스템
- [x] 시작/종료 UI
- [x] Stop 버튼
- [x] 매치 애니메이션 (Juice)
- [x] 최고 점수 기록
- [x] 힌트 시스템 (5초 자동)
- [x] 줄볼 구현
- [x] 타겟볼 구현
- [x] 폭탄볼 구현
- [x] 무지개볼 구현
- [x] 블록 강제 제거 (Space키, 매칭 계산 포함)
- [x] 콤보 메시지 시스템 (네온사인 스타일)
- [x] 특수블록 교차 효과 10가지
- [x] 특수블록 생성 위치 로직 수정
- [x] 개발자 모드 패널 (비밀번호: 1013love)
  - [x] 특수블록 강제 배치 (토글 방식)
  - [x] 인스펙터 (실시간 값 조절)
  - [x] 툴팁 (친절한 설명 + 권장 범위)
  - [x] 카테고리별 초기화 버튼 + 커스텀 확인 팝업
  - [x] 배속 슬라이더 (0.5x~5x)
  - [x] 좌표 보기 토글
  - [x] 스테이지 이동 치트
  - [x] 매치 로그 (날짜+시각, skipDelay 표시)
  - [x] 맵 에디터 (돌 기믹 배치 도구)
- [x] 실시간 매칭 (skipDelay/skippableDelay 분리)
- [x] 스테이지 시작 시 즉시 클리어 버그 수정
- [x] 스테이지 건너뛰기 버그 수정
- [x] 스테이지별 출현 블록 타입 수 관리 (STAGE_CONFIG colorTypes)
- [x] 포켓몬 스프라이트 시트 연동 (pokemon_sprites_1.png)
- [x] 블록 스킨 시스템 (7슬롯, 기본 7종 해금)
- [x] 스킨 변경 화면 (151종 목록, 잠금/해금)
- [x] 메인화면 + 로비 UI
- [x] 스테이지 구조 (10스테이지)
- [x] 돌 기믹 구현 (5단계 이미지, 인접 매칭 타격)
- [x] 미션 시스템 (승리 조건: 돌 전부 제거)
- [x] 미션 UI (좌상단 돌 아이콘 + 남은 개수)
- [x] 맵 에디터 (map_editor.html, stage_maps.json 내보내기)
- [x] stage_maps.json 게임 연동
- [x] 점수 시스템 제거 (기믹 미션으로 대체)
- [x] fill delay 기본값 200ms로 변경
- [x] 타겟볼 스펙 변경 (기믹 우선 타격)
- [x] 고정형 기믹 셀 완전한 장애물 처리 (수직 통과 차단, 대각선 충전)
- [x] 기믹 타격 규칙 수정 (기믹 셀이 효과 범위에 포함될 때만 단계 -1)
- [x] 블록 크기 10% 증가 (BLOCK_D: 50→55)
- [x] 헥사 셀 이미지 편집 툴 (image_tool.html)
- [x] 특수블록 시스템 개편 완료
  - 색상 제거, 아이콘 형태 (assets/specialblock/)
  - 더블클릭/스왑 사용 방식
  - 타겟볼 범위 타격 (4칸, 방향별)
  - 생성 시 인접 기믹 타격
  - 무지개볼 가장 많은 색상 기준 발동
  - 교차 효과 전면 수정
- [x] 대각선 충전 fill→gravity 루프 최적화
- [x] 무지개x무지개 교차 후 충전 멈춤 버그 수정
- [x] diag transition / diag delay 인스펙터 항목 추가
- [x] **리팩토링 & 모듈화 완료** (2026.04.18)
  - game.js 2948줄 → 516줄 (-2432)
  - 10개 모듈 분리: config / grid / board / match / special / gravity / animation / ui / game / main
- [x] 폭탄×폭탄 19칸 범위 누락 버그 수정 (entrance/dead/pass gateway 문제)
- [x] 줄볼×폭탄 교차 기준점 버그 수정 (드래그 방향 대칭 깨짐)
- [x] 무지개×무지개 돌 기믹 2단계 감소 버그 수정
- [x] 폭탄×폭탄 / 무지개×무지개 배치 동시 발동 구현
- [x] 대각선 충전 DOM desync 수정 (fills 스냅샷 패턴)
- [x] 대각선 충전 연출 C안 구조 (fill+gravity+diag 동시 트리거, 폭포 느낌)
- [x] gravity→diagonal 정직한 L자 경로 (CSS transition 완료 후 꺾임)
- [x] gravity/diagonal transition 속도 단축 (스피디 + 정직 유지)
- [x] .claude/ 추적 제외 + .gitignore 추가

---

## 🗺️ 데모 프로토 로드맵

### Phase 1 - 완료 🎉
- 코어 게임플레이 완성

### Phase 2 - 다음 작업 (리팩토링)
- [x] 리팩토링 & 모듈화 ✅ (2026.04.18 완료, 10개 모듈)
  - game.js → grid.js / block.js / match.js / special.js / animation.js / ui.js
- [ ] 충전 애니메이션 매끄럽게 (대각선 경로 폴리싱, pathfinding 기반)
- [ ] 실시간 매칭 완전 구현

### Phase 2 - UI/디자인 개편
- [ ] 특수블록 비주얼 개선 (포켓몬 이미지 유지 + 패턴 반투명 오버레이)
- [ ] 퍼즐판 디자인 개편
- [ ] 전체 UI 리뉴얼 (요즘 3매치 퍼즐 스타일)
- [ ] 추후 2D → 3D 업그레이드 검토 (Three.js or Unity WebGL)

### Phase 3 - 기믹 추가
- [ ] 타일형 기믹 구현 (추후 정의)
- [ ] 기믹별 가중치 시스템 (타겟볼 우선순위)

### Phase 4 - 재화 & 아이템 시스템
- [ ] 골드(재화) 시스템 추가
- [ ] 블록 스킨 상점 연동 (골드로 구매)
- [ ] 인게임 아이템 4종 구현
  - [ ] 한 칸 선택 타격
  - [ ] 세로줄 한 줄 타격
  - [ ] 원하는 곳 누르면 랜덤 특수블록으로 변환
  - [ ] 전체 셔플

### Phase 5 - 서버 & 랭킹
- [ ] 서버 구축 (Node.js + Socket.io)
- [ ] 랭킹 시스템
- [ ] 메인화면 랭킹 표시

### Phase 6 - 메타게임
- [ ] 도감 시스템 (포켓몬 경험치/수집)
- [ ] 상점 시스템 (껍데기 → 골드 연동)

---

- [ ] 터치 이벤트 지원 (모바일)
- [ ] 사운드 효과 추가
- [ ] GitHub Pages 배포
- [ ] 대각선 충전 경로 폴리싱 (수직→대각 꺾임 자연스럽게)
  - 현재: 목적지로 직선 이동하는 케이스 존재
  - 리팩토링 시 pathfinding 기반 낙하 시스템으로 통째로 교체 예정
  - gravity/diagonal이 board계산+DOM이동 한 세트로 묶여있어 지금 단계에서 수정 시 안정성 위험
  - (2026.04.18) 폭포 연출 + 정직한 L자 경로까지 구현됨. pathfinding 기반 교체는 여전히 추후 과제