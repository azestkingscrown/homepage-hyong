# 💗 Azest_Kingscrown Homepage & Infra Dashboard — `hyeong-lang` Edition

**[난해한 혀엉... 언어 v0.4.5](https://gist.github.com/xnuk/d9f883ede568d97caa158255e4b4d069)**로 구동되는 개인 홈페이지 및 서버/인프라 관리 대시보드입니다.  
**CGI / Effect Bridge 아키텍처**를 채택해 HTTP 라우팅·언어 감지·서버 가동률 연산·SVG 배지 생성·HTML 페이지 렌더링·API 응답 조립까지 실제 `.hyeong` 프로그램이 요청마다 실행됩니다.

## Architecture

```text
HTTP Request ──▶ bridge/http.ts
                    │
                    ▼
             app/router.hyeong     (보안 경로 차단, chzzk. 서브도메인 리라우트, KO/EN 감지, 디스패치)
                    │
                    ▼
         app/pages/*.hyeong or     (Effect 요청 시 bridge/effects.ts가 OS/네트워크/Docker/OTP 수행 후
         app/api/*.hyeong           트램폴린으로 결과 전달 → .hyeong이 최종 HTML/JSON/SVG 조립)
```

- **런타임 의존성 0**: Node.js 24 이상만 있으면 `npm install`이나 번들 빌드 없이 바로 실행됩니다.
- **혀엉... 코어 (`engine/hyeong/`)**: `hyeong-lang` v0.4.5 TypeScript 파서 · 임의 정밀도 유리수 인터프리터 · 인코더 · 블록/스택 컴파일러(`compiler.ts`, `stdlib.ts`).
- **실시간 실행 트레이스**: 모든 HTML 응답에 실행된 `.hyeong` 모듈 경로, Effect 목록, 실행 시간(`X-Hyeong-Modules`, `X-Hyeong-Time-Ms`)이 포함됩니다.

## Directory Structure

```text
homepage-hyong/
├── server.ts                  # HTTP 서버 진입점
├── engine/hyeong/             # hyeong-lang v0.4.5 파서 · 유리수 인터프리터 · 인코더 · 컴파일러
├── bridge/
│   ├── http.ts                # HTTP 수신, 정적 파일 서빙, .hyeong 트램폴린 루프
│   ├── effects.ts             # 시스템 메트릭, Lanyard, Docker, DDNS, OTP, 샌드박스 실행기
│   └── hyeongRuntime.ts       # .hyeong AST 캐시 로드 및 HyeongSession 실행기
├── app/                       # 💗 혀엉...(.hyeong) 애플리케이션 본체
│   ├── router.hyeong          # HTTP 라우터
│   ├── api/                   # ip, status, discord, server, ddns, hosting, hyeong API (.hyeong)
│   └── pages/                 # home, playground, update, minecraft, ddns, hosting, admin, doc, unauthorized (.hyeong)
├── scripts/                   # API / 페이지 .hyeong 생성기
├── static/                    # styles.css, client.js, docs/
└── test/                      # 엔진, 표준라이브러리, E2E 통합 테스트
```

## Getting Started

1. 서버 실행 (Node.js >= 24):
   ```bash
   npm start
   # 또는 개발 감시 모드:
   npm run dev
   ```
   기본 주소: `http://localhost:3030` (`PORT=원하는포트 npm start`로 변경 가능)

2. 플레이그라운드 & `.hyeong` 소스 뷰어:
   - `http://localhost:3030/playground`에서 혀엉... 코드를 직접 실행하고, 사이트를 구동하는 `app/**/*.hyeong` 소스를 바로 열람할 수 있습니다.
   - `/admin` 및 `/hosting`의 데모 기본 OTP는 `000000`입니다 (`.env.local`에 `ADMIN_OTP_SECRET` 설정 시 실제 TOTP 검증).

3. 테스트 실행:
   ```bash
   npm test
   ```

4. `.hyeong` 페이지/API 재생성 (템플릿 수정 시):
   ```bash
   npm run build:apis
   npm run build:pages
   ```
