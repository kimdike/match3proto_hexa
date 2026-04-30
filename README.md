# 포켓몬 3매치 퍼즐

[![GitHub release](https://img.shields.io/github/v/release/kimdike/match3proto_hexa?include_prereleases&display_name=release&label=release)](https://github.com/kimdike/match3proto_hexa/releases)
[![Last commit](https://img.shields.io/github/last-commit/kimdike/match3proto_hexa)](https://github.com/kimdike/match3proto_hexa/commits/main)
[![Stars](https://img.shields.io/github/stars/kimdike/match3proto_hexa?style=flat)](https://github.com/kimdike/match3proto_hexa/stargazers)

헥사 그리드 기반 3매치 퍼즐 + 포켓몬 탐험/수집 메타게임 (프로토타입).
바닐라 JS, 빌드 도구 없음.

## 실행

```bash
npx serve .
```
→ http://localhost:3000

개발자 모드: 비밀번호 `1013love`

> `file://` 로 바로 열면 fetch / 오디오 / 이미지 로드가 막히므로 반드시 로컬 서버를 띄울 것.

## 디렉터리 구조

```
my-game/
├── index.html              # 진입점 (스크립트 로드 순서 포함)
├── style.css
├── config.js               # 상수, CFG 설정값
├── grid.js                 # 헥사 좌표, 인접 셀 계산
├── board.js                # 보드 상태, 셀/블록/기믹 DOM
├── match.js                # 매치 감지, 특수블록 생성 판정
├── special.js              # 특수블록 발동, 교차 효과 10종
├── gravity.js              # 중력, 직선/대각선 충전
├── animation.js            # swap/팝업/힌트 애니메이션
├── ui.js                   # HUD, 화면 전환, BGM/SFX
├── game.js                 # 전역 상태, 매치 처리 코어
├── main.js                 # 이벤트 핸들러, 게임 흐름
├── stage_maps.js           # 스테이지 데이터 (전역변수)
├── map_editor.html         # 스테이지/기믹/셀타입 배치 도구
├── image_tool.html         # 헥사 셀 이미지 편집 툴
├── assets/                 # 이미지, BGM, SFX, 특수블록/기믹 스프라이트
├── design_coregame.md      # 코어 게임 스펙
├── design_system.md        # 메타게임 스펙
├── todolist.md             # 진행/완료 작업 목록
├── devlog.md               # 일자별 작업 일지
└── CLAUDE.md               # Claude Code 작업 지침
```

**모듈 로드 순서**:
`config → grid → board → match → special → gravity → animation → ui → stage_maps → game → main`

## 워크플로우 (rtk → graphify → llm-wiki)

이 저장소는 Claude Code 기반 작업을 가정하며, 다음 3단 지식 루프를 컨벤션으로 둔다.

| 단계 | 도구 | 역할 |
|---|---|---|
| 1. 압축 | [`rtk`](https://github.com/akillness/rtk) | 셸 출력 토큰 압축 (`rtk git status`, `rtk grep`, `rtk cargo build` …) |
| 2. 정제 | [`graphify`](https://github.com/safishamsi/graphify) | 코드/문서를 지식 그래프(`graphify-out/`)로 추출, 관계 질의 |
| 3. 적재 | `llm-wiki` | 영속 마크다운 위키 — 출처/엔티티/개념/질의 응답 적재 |

**루프**:
```
사용자 질문
   ↓
(rtk 로 셸 출력 압축)
   ↓
graphify query/path/explain 으로 그래프 우선 조회
   ↓ (필요 시)
원본 파일 grep → 답변 합성
   ↓
durable 한 답변은 wiki/queries 또는 wiki/reports 로 적재
   ↓
주요 코드 변경 후 `graphify update .` 로 그래프 갱신
```

**현실적인 자동/수동 경계**:
- rtk: 셸 명령 한정. 사용자 프롬프트 자체는 압축하지 않음. Windows에서는 `--claude-md` 모드(설치 시점에 CLAUDE.md 에 사용 지침 주입).
- graphify: PreToolUse 훅(`.claude/settings.json`)이 grep/find 류 명령에 컨텍스트 주입 — 단, `graphify-out/graph.json` 존재 시에만 동작.
- llm-wiki: 자동화 없음. 수동으로 `bash scripts/bootstrap-vault.sh <path>` 후 사용.

## 작업 원칙

1. 기획서 먼저, 구현 나중 — 스펙 변경 시 `design_coregame.md` / `design_system.md` 부터 업데이트
2. 한 번에 하나씩 — 완료 확인 후 다음 작업
3. 커밋/푸시 금지 — 항상 사용자가 직접 수행
4. 로직/UI 분리 — 게임 로직(js)과 UI(html/css) 수정은 섞지 말 것
5. 버그 수정과 기능 개발은 별도 커밋

## 커밋 prefix
`feat / fix / refactor / docs / chore / content`

## 문서

- 코어 게임 스펙: [design_coregame.md](./design_coregame.md)
- 메타게임 스펙: [design_system.md](./design_system.md)
- 작업 목록: [todolist.md](./todolist.md)
- 개발 이력: [devlog.md](./devlog.md)
- 작업 지침: [CLAUDE.md](./CLAUDE.md)
