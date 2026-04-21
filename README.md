# 포켓몬 3매치 퍼즐 - 클로드 코드 작업 지침서

## 세션 시작 시 필수 (매번 붙여넣기)

```
기획서_코어게임.md, 기획서_메타게임.md, todo리스트.md, 작업일지.md 읽고
현재 구현 상태 파악 후 작업 이어서 진행해줘.
```

## 개발 환경

- 로컬 서버: `npx serve .` (CMD에서 실행, PowerShell 아님)
- 접속: http://localhost:3000
- 개발자 모드 비밀번호: `1013love`
- Korean 파일 git add 시:
  ```
  git add "기획서_코어게임.md" "기획서_메타게임.md" "작업일지.md" "todo리스트.md"
  git add .
  ```

## 프로젝트 구조

### 모듈 로드 순서

```
config → grid → board → match → special → gravity
→ animation → ui → stage_maps → game → main
```

### 핵심 모듈 역할

| 파일 | 역할 |
|---|---|
| config.js | 상수, CFG 설정값 |
| grid.js | 헥사 좌표 계산, 인접 셀 |
| board.js | 보드 상태, 셀/블록/기믹 DOM |
| match.js | 매치 감지, 특수블록 생성 판정 |
| special.js | 특수블록 발동, 교차 효과 10종 |
| gravity.js | 중력, 충전, 대각선 충전 |
| animation.js | swap/팝업/힌트 애니메이션 |
| ui.js | HUD, 화면 전환, BGM/SFX |
| game.js | 전역 상태, 매치 처리 코어 |
| main.js | 진입점, 이벤트 핸들러 |

### 에셋 구조

```
assets/
├── main_bg.jpg / main_logo.png
├── main_bgm.mp3 / lobby_bgm.mp3 / ingame_play_bgm.mp3
├── character_man.png / character_woman.png
├── pokemon_sprites_1.png
├── gimmick/
│     stone_1.png ~ stone_5.png
├── specialblock/
│     sb_stripe1~3, sb_bombball, sb_targetball, sb_rainbow
└── sfx/
      sfx_match_pop.wav / sfx_stone_hit.wav
      sfx_stone_break.wav / sfx_btn_click.wav / sfx_select.wav
```

## 작업 원칙

1. 기획서 먼저, 구현 나중 (스펙 변경 시 기획서 업데이트 후 구현)
2. 한 번에 하나씩 (완료 확인 후 다음 작업)
3. 버그 수정과 기능 개발 커밋 분리

## 커밋 메시지 규칙

| prefix | 용도 |
|---|---|
| feat | 신규 기능 |
| fix | 버그 수정 |
| refactor | 리팩토링 |
| docs | 문서 업데이트 |
| chore | 설정/정리 |
| content | 에셋/맵 데이터 |

## 커밋/푸시 템플릿

```
git status 확인
git add [파일들]
git commit -m "[prefix]: [내용]"
git push origin main
git log --oneline -5
```

## 자주 쓰는 프롬프트 패턴

### 기능 구현

```
기획서_코어게임.md, todo리스트.md 읽고
[파일명들] 읽고 [기능] 구현해줘.
커밋은 내가 직접 할게, 하지 마.
```

### 버그 진단 (수정 전)

```
[파일명들] 읽고 아래 버그 원인 찾아줘.
코드 수정은 하지 마.
증상: [증상 설명]
```

### UI/디자인

```
기획서_코어게임.md 읽고
index.html, style.css 읽고 [UI 작업] 해줘.
게임 로직 건드리지 마.
커밋은 내가 직접 할게, 하지 마.
```

### 문서 업데이트

```
작업일지.md, todo리스트.md 읽고
오늘 작업 내용 추가해줘.
기존 내용 수정/삭제 없이 추가만.
커밋은 내가 직접 할게, 하지 마.
```

### 에러 발생 시

```
[파일명들] 읽고 아래 에러 원인 파악하고 수정해줘.
에러 메시지: [F12 콘솔에서 복사]
발생 상황: [어떤 동작 했을 때]
```

## 주의사항

- 게임 로직(js)과 UI(html/css) 수정은 항상 분리 요청
- 특수블록/기믹 관련 수정 시 기획서 17~18섹션 반드시 참고
- blockScale 보정: `adj = BLOCK_D × (scale-1) / 2`
  적용 위치: `createBlockEl`, `animateGravityDOM`, `animateDiagonalDOM`, `animateFillDOM`
- Korean 파일명은 `git add`에서 따옴표로 감싸기
