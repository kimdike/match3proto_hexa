# 배포 가이드 — Render + 정적 클라이언트

본 게임은 두 부분으로 배포합니다:
1. **백엔드 (Node.js + Express)** → Render Web Service (무료 tier)
2. **정적 클라이언트 (HTML/CSS/JS)** → GitHub Pages 또는 Render Static Site

DB(Supabase PostgreSQL)는 이미 셋업 완료 — `server/SETUP_SUPABASE.md` 참고.

---

## Part 1 — Render에 백엔드 배포

### 1-1. Render 가입
1. https://render.com 가입 (GitHub 로그인 가능)
2. 첫 로그인 시 Dashboard로 이동

### 1-2. GitHub repo 연결
1. Dashboard 우상단 **New +** → **Web Service**
2. **Build and deploy from a Git repository** 선택
3. **Connect** → GitHub 계정 인증 → `match3proto_hexa` 선택
4. **Connect** 버튼

### 1-3. 서비스 설정
| 항목 | 값 |
|---|---|
| **Name** | `hexa-match3-server` (원하는 이름) |
| **Region** | `Singapore` 또는 `Oregon` (Supabase 서버 지역과 가까운 곳) |
| **Branch** | `main` |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `node index.js` |
| **Plan** | **Free** |

### 1-4. 환경변수 설정
**Environment Variables** 섹션에서 **Add Environment Variable** 클릭, 다음 추가:

| Key | Value |
|---|---|
| `PORT` | `8080` (Render는 자동으로 PORT 주입하지만 기본값 명시) |
| `JWT_SECRET` | 강력한 32자+ 랜덤 문자열 (`.env`와 다른 값 권장) |
| `ALLOWED_ORIGINS` | 1단계에선 비워두고, Part 2 후 정적 클라이언트 URL로 설정 |
| `DATABASE_URL` | Supabase connection string (`.env`와 동일) |

### 1-5. 배포
1. **Create Web Service** 클릭
2. Render가 자동으로 빌드 + 배포 (2~5분)
3. 완료 시 상단에 URL 표시: `https://hexa-match3-server.onrender.com` 같은 형태
4. 클릭해서 `/api/health` 접속 → `{"ok":true,"ts":...}` 응답 확인

⚠️ **Render Free tier 주의**: 15분간 요청 없으면 sleep → 첫 요청에 30~50초 지연. 운영 서비스로 쓰려면 유료 tier($7/월) 필요.

---

## Part 2 — 정적 클라이언트 배포

두 가지 옵션. **GitHub Pages 권장** (이미 GitHub repo에 코드 있음).

### 옵션 A — GitHub Pages (권장)

1. GitHub repo → **Settings** → **Pages**
2. **Source**: `Deploy from a branch`
3. **Branch**: `main` / **Folder**: `/ (root)`
4. **Save**
5. 1~2분 후 표시되는 URL 확인: `https://kimdike.github.io/match3proto_hexa/`

### 옵션 B — Render Static Site

1. Render Dashboard → **New +** → **Static Site**
2. 같은 repo 연결
3. 설정:
   - **Build Command**: 비워두기 (정적이라 빌드 X)
   - **Publish Directory**: `.` (루트)
4. **Create Static Site**
5. 발급되는 URL 사용 (예: `https://hexa-match3.onrender.com`)

---

## Part 3 — 클라이언트 ↔ 서버 연결

### 3-1. `index.html`의 `SERVER_URL` 교체

배포 전에 `index.html`에서 `SERVER_URL`을 production 백엔드 URL로 변경:

```html
<!-- index.html 상단 부근 -->
<script>window.SERVER_URL = 'https://hexa-match3-server.onrender.com';</script>
```

⚠️ **두 URL 패턴 분기 권장** (로컬 개발 + 운영 자동 분기):

```html
<script>
  window.SERVER_URL = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? 'http://localhost:8080'
    : 'https://hexa-match3-server.onrender.com';
</script>
```

→ 커밋 + push → GitHub Pages 자동 재배포 (1~2분).

### 3-2. Render 백엔드 CORS allowlist 갱신

Render Dashboard → 서비스 → **Environment** → `ALLOWED_ORIGINS` 갱신:

```
ALLOWED_ORIGINS=https://kimdike.github.io,http://localhost:3000,http://127.0.0.1:3000
```

→ **Save Changes** → 자동 재배포.

⚠️ GitHub Pages는 origin이 `https://kimdike.github.io` (path 제외). path 빼고 호스트만.

---

## Part 4 — 외부 사용자에게 공유

1. GitHub Pages URL을 친구에게 공유: `https://kimdike.github.io/match3proto_hexa/`
2. 친구는:
   - 접속 → 메인화면 → **회원가입** 클릭 → 계정 생성
   - 진행상황(stage, 도감, 골드 등)이 자동으로 Supabase에 저장
   - 다른 기기에서 로그인하면 진행 이어 가능

---

## Part 5 — S25 모바일에서 테스트

1. S25 Chrome에서 GitHub Pages URL 접속
2. 메인화면 → PRESS TO START → 게스트 또는 회원가입
3. 드래그/탭으로 게임 플레이
4. 화면이 깨지거나 동작 안 되면 알려주기 (모바일 보강 follow-up)

---

## 비용 정리 (모두 무료)

| 서비스 | 플랜 | 제한 |
|---|---|---|
| **Supabase** | Free | DB 500MB, 월 50,000 active users, 일시정지 (7일 비활동 시) |
| **Render Web Service** | Free | 750 시간/월, 15분 sleep |
| **GitHub Pages** | Free | 1GB repo, 100GB 대역폭/월 |

소규모 데모/포트폴리오 충분. 트래픽 늘면 Supabase Pro($25/월) + Render Starter($7/월).

---

## 트러블슈팅

| 증상 | 해결 |
|---|---|
| Render 배포 후 `/api/health` 500 | Environment 변수 누락 확인, 특히 `DATABASE_URL` |
| 클라이언트 콘솔 `CORS error` | `ALLOWED_ORIGINS`에 정확한 origin 추가 (path 제외) |
| 첫 요청 30초 지연 | Render Free tier sleep — 워밍업 필요 또는 유료 |
| GitHub Pages가 안 보임 | Settings → Pages 활성화 확인, 5분 후 재시도 |
| `Mixed Content` 에러 | HTTPS GitHub Pages에서 HTTP 백엔드 호출 시 발생 — 백엔드도 HTTPS여야 (Render는 자동) |

---

## 운영 체크리스트

- [ ] Supabase 프로젝트 설정 + connection string
- [ ] Render 백엔드 배포 + `/api/health` 응답 확인
- [ ] `index.html`의 `SERVER_URL` production URL로 교체
- [ ] GitHub Pages 활성화 + URL 확인
- [ ] Render `ALLOWED_ORIGINS`에 GitHub Pages origin 추가
- [ ] 친구 한 명에게 URL 공유 → 회원가입 → 진행상황 저장 확인
- [ ] S25 Chrome에서 접속 → 드래그/탭 동작 확인
