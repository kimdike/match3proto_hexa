# Supabase PostgreSQL 셋업 가이드

이 프로젝트는 무료 PostgreSQL DB로 Supabase를 사용합니다. 로컬 개발 + Render 운영 모두 동일한 connection string을 씁니다.

## 1. Supabase 계정 + 프로젝트 생성

1. https://supabase.com 가입 (GitHub 로그인 가능)
2. **New Project** 클릭
3. 입력:
   - **Name**: `hexa-match3` (원하는 이름)
   - **Database Password**: 강력한 비밀번호 (저장해두세요 — 분실 시 재설정만 가능)
   - **Region**: `Northeast Asia (Seoul)` 권장 (한국 사용자 최저 latency)
   - **Pricing Plan**: Free
4. **Create new project** → 1~2분 프로비저닝 대기

## 2. Connection string 복사

1. 좌측 메뉴 **Project Settings** → **Database**
2. **Connection string** 섹션에서 **URI** 탭 선택
3. 표시되는 문자열 복사. 예시:
   ```
   postgresql://postgres.abcdefghij:[YOUR-PASSWORD]@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres
   ```
4. `[YOUR-PASSWORD]` 부분을 1단계에서 설정한 실제 비밀번호로 교체

## 3. server/.env 작성

`server/.env.example`을 복사해서 `server/.env` 생성 후 값 채우기:

```env
PORT=8080
JWT_SECRET=<openssl rand -base64 48 결과 또는 임의 32+ 문자열>
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
DATABASE_URL=postgresql://postgres.abcdefghij:실제비번@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres
```

⚠️ **`.env` 파일은 절대 git에 커밋하지 마세요** — `server/.gitignore`로 이미 차단됨.

## 4. 서버 기동 + 마이그레이션

```bash
cd server
npm install
npm start
```

기동 시 자동으로:
- DB 연결 + SSL 핸드셰이크
- `users`, `player_profiles`, `dex_entries`, `skin_slots`, `skin_unlocked` 테이블 자동 생성 (이미 있으면 skip)
- 콘솔에 `[db] migrations applied` + `[server] listening on port 8080`

## 5. 헬스체크

```bash
curl http://localhost:8080/api/health
# → {"ok":true,"ts":1234567890}
```

## 6. (옵션) Supabase Dashboard에서 테이블 확인

좌측 메뉴 **Table Editor** → 생성된 5개 테이블 확인 가능.

## 운영 (Render) 배포 시

동일한 `DATABASE_URL`을 Render 서비스의 환경변수에 설정하면 됨. Supabase는 외부 접속 허용되어 있어 별도 화이트리스트 불필요.

## 트러블슈팅

- **`DATABASE_URL is not set`** → `server/.env` 파일이 있는지, `DATABASE_URL=` 줄이 비어있지 않은지 확인
- **`ECONNREFUSED` / 연결 타임아웃** → connection string의 비밀번호 + region 정확한지 확인
- **`relation "users" does not exist`** → init 마이그레이션 실패. 콘솔 에러 + Supabase Dashboard SQL Editor에서 직접 실행 시도
