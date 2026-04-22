# 포켓몬 3매치 퍼즐

헥사 그리드 기반 3매치 퍼즐 + 포켓몬 탐험/수집 메타게임 (프로토타입)

## 실행

```bash
npx serve .
```
→ http://localhost:3000

개발자 모드: 비밀번호 `1013love`

## 구조

- 바닐라 JS (빌드 도구 없음)
- 모듈: `config / grid / board / match / special / gravity / animation / ui / game / main`
- 에셋: `assets/` (이미지, BGM, SFX)

## 문서

- 코어 게임 스펙: [design_coregame.md](./design_coregame.md)
- 메타게임 스펙: [design_system.md](./design_system.md)
- 작업 목록: [todolist.md](./todolist.md)
- 개발 이력: [devlog.md](./devlog.md)
