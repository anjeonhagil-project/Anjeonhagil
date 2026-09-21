# 안전하길 (Anjeonhagil)

초보운전자를 위한 "무서운 도로 회피형" 개인화 내비게이션 서비스 — KDT 중간프로젝트 2팀

🕑개발 기간: 2026-09-01 ~ 2026-09-21

## 1. 주요 기능
### 🧑‍💻 일반 사용자

- **회원가입 / 로그인** — Supabase 인증, 이메일 가입과 카카오 · 구글 · 네이버 소셜 로그인, 약관 동의와 위치 권한 안내
- **운전 성향 설문** — Q1 운전 빈도, Q2 부담 요소 순위(복잡한 교차로 · 좁은 도로 · 어린이 시설 주변 등), Q3 두 경로 중 하나를 고르는 비교 4문항
- **장소 검색** — 카카오 장소 검색, 즐겨찾기(집 · 회사 · 기타)와 최근 검색으로 출발지 · 도착지 지정
- **경로 비교** — 같은 출발·도착에 대해 *내게 편한 길 · 최소 시간 · 최단 거리* 후보를 함께 계산하고, 지도와 부담 지표로 비교. 같은 경로로 선정된 유형은 한 카드로 합쳐서 표시
- **부담 구간 미리보기** — 선택한 경로에서 부담이 커지는 구간을 순서대로 보여주고, 누르면 지도에서 해당 위치를 확인
- **경로 안내** — GPS 실시간 안내와 시뮬레이션 안내, 회전 방향 · 남은 거리 · 예상 시간 표시, 음성 안내, 경로 이탈 시 현위치에서 다시 검색
- **만족도 평가** — 안내가 끝나면 별 5개로 경로 만족도를 입력하고 홈으로 복귀
- **개인화 설정** — 설문 기준 가중치와 실제 선택 이력 기반 행동 보정을 확인하고, 반영을 끄거나 설문 기준으로 초기화
- **고객 지원** — 공지사항 확인, 1:1 문의 작성과 답변 확인, 약관 열람

### 🛠️ 관리자

- **대시보드** — 기간별 경로 검색 · 선택 수, 사용자 활동 지표
- **회원 관리** — 가입 회원 조회와 상태 관리
- **관리자 계정 관리** — 관리자 권한 부여와 회수
- **데이터셋 · 모델 상태** — 적재된 도로 데이터와 학습 모델 버전 확인
- **경로 기록** — 실제 검색 · 선택 이력 조회
- **공지 · 문의** — 공지 작성과 게시, 사용자 문의 답변

## 2. 기술 스택

#### 언어

[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)]()
[![Python](https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white)]()
[![SQL](https://img.shields.io/badge/SQL-336791?style=for-the-badge&logo=postgresql&logoColor=white)]()

#### Backend

[![NodeJS](https://img.shields.io/badge/Node.js%2024-5FA04E?style=for-the-badge&logo=nodedotjs&logoColor=white)]()
[![Express](https://img.shields.io/badge/Express%205-000000?style=for-the-badge&logo=express&logoColor=white)]()
[![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white)]()
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)]()
[![NumPy](https://img.shields.io/badge/NumPy-013243?style=for-the-badge&logo=numpy&logoColor=white)]()
[![Shapely](https://img.shields.io/badge/Shapely%20%C2%B7%20pyproj-3C7EBB?style=for-the-badge)]()

#### Frontend

[![React](https://img.shields.io/badge/React%2019-61DAFB?style=for-the-badge&logo=react&logoColor=black)]()
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)]()
[![Kakao Maps](https://img.shields.io/badge/Kakao%20Maps-FFCD00?style=for-the-badge&logo=kakao&logoColor=black)]()

## 3. 프로젝트 실행

경로 계산은 Python 계산기(worker)가 담당하고, Express API가 이를 호출한다. 사용자 · 관리자 화면은 Vite 개발 서버로 실행한다. 아래 한 명령으로 네 프로세스를 모두 띄운다.

### 로컬 환경에서 실행

1. 사전 준비

    - **Node.js 24 이상**과 **Python 3.12 이상**이 필요하다.
    - 의존성을 설치한다.

        ```bash
        npm install
        ```

    - Python 가상환경(`.venv`)을 만들고 계산기 의존성을 설치한다.

        ```powershell
        powershell -ExecutionPolicy Bypass -File scripts/setup-python.ps1
        ```

    - 도로 데이터를 `apps/backend/routing/data`에 적재한다. 팀 배포본 ZIP 경로를 인자로 준다.

        ```powershell
        powershell -ExecutionPolicy Bypass -File scripts/import-routing-data.ps1 -Zip <배포본.zip>
        ```

    - 아래 **4. 환경 변수 설정**을 참고해 `.env` 파일 세 개를 만든다. 각 앱의 `.env.example`을 복사해 값을 채우면 된다.

    > 계산기는 시작할 때 데이터와 코드의 해시를 검사한다. 파일이 한 바이트라도 바뀌면 실행이 중단되므로 `apps/backend/routing` 아래 파일은 수정하지 않는다.

2. backend, frontend 모두 실행

    ```bash
    npm start
    ```

    - 사용자 화면 **http://localhost:5173**, 관리자 화면 **http://localhost:5174**, API **http://localhost:3000/api**
    - 포트를 바꾸려면 `npm start -- --api-port=3001` 처럼 지정한다. (`--worker-port`, `--mobile-port`, `--admin-port`)
    - 실행 환경을 점검하려면 `npm run doctor`, 도로 데이터 무결성만 확인하려면 `npm run verify:data`를 쓴다.

    개별 실행이 필요하면 아래 명령을 쓴다. 계산기가 먼저 떠 있어야 경로 검색이 동작한다.

    ```bash
    npm run dev:api      # Express API
    npm run dev:mobile   # 사용자 웹
    npm run dev:admin    # 관리자 웹
    ```

## 4. 환경 변수 설정

`.env`는 저장소에 올리지 않는다. 각 앱의 `.env.example`을 복사해 값을 채운다.

### backend 환경변수

`apps/backend/.env`

| 변수명 | 설명 |
| --- | --- |
| `PORT` | API 서버 포트 (기본 3000) |
| `SUPABASE_URL` | Supabase 프로젝트 URL |
| `SUPABASE_SECRET_KEY` | Supabase 서비스 키 (서버 전용, 외부 노출 금지) |
| `KAKAO_REST_API_KEY` | 카카오 장소 검색 REST API 키 |
| `ROUTING_WORKER_URL` | Python 계산기 주소 (기본 `http://127.0.0.1:8100`) |
| `ROUTING_WORKER_TOKEN` | 계산기 호출 인증 토큰. 비워두면 실행 시 자동 생성 |
| `DATABASE_URL` | PostgreSQL 연결 문자열 (마이그레이션 · 검증용) |

### frontend_mobile 환경변수

`apps/frontend_mobile/.env`

| 변수명 | 설명 |
| --- | --- |
| `VITE_API_BASE_URL` | API 주소 (기본 `http://localhost:3000/api`) |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase 공개 키 |
| `VITE_KAKAO_JS_KEY` | 카카오 지도 JavaScript 키 |

> 카카오 지도와 소셜 로그인은 카카오 개발자 콘솔에 접속 도메인이 등록되어 있어야 동작한다. 로컬은 `http://localhost:5173`이 등록되어 있다.

### frontend_admin 환경변수

`apps/frontend_admin/.env`

| 변수명 | 설명 |
| --- | --- |
| `VITE_API_BASE_URL` | API 주소 (기본 `http://localhost:3000/api`) |
| `VITE_SUPABASE_URL` | Supabase 프로젝트 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase 공개 키 |



## 5. 팀명 및 팀원
| 고진서 | 배성욱 | 양수연 | 이다원 | 이서진(팀장) |
| --- | --- | --- | --- | --- |
| [@Jinseo](https://github.com/kohjinseo) | [@Sunguk](https://github.com/BaeSungUk) | [@Suyeon](https://github.com/YsuY) | [@Dawon](https://github.com/DaWonniee) | [@Seojin](https://github.com/leeseojin-dev) |
