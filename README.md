# 안전하길 (Anjeonhagil)

초보 운전자가 부담스러워하는 도로 요소를 비교하는 **로컬 경로 추천 포트폴리오**입니다. 내부 A*·Yen, 공통 Logistic 모델, 카카오 지도, Supabase를 연결했습니다.

2026-09-17: 명시적 경로 선택, 실제 카드 노출 기록, 개인화 작업 복구, 부담 구간 미리보기와 검색 취소를 보완했습니다. [최신 수정·검증 내역](docs/IMPLEMENTATION_20260917.md)을 참고하세요.

처음 받은 PC에서는 Node.js 24 이상과 Python 3.12를 준비하고, 팀에서 안전하게 전달받은 값으로 세 앱의 `.env.example`을 각각 `.env`로 복사해 채웁니다. 그다음 원본 도로 데이터 ZIP을 별도로 받아 아래 순서로 실행합니다.

```powershell
npm ci
.\scripts\setup-python.ps1
.\scripts\import-routing-data.ps1 -ArchivePath 'C:\자료\Anjeonhagil_FINAL_CHILD100_20260915 (1).zip'
npm run doctor -- --db
npm start -- --api-port=3001
```

사용자 화면은 **http://localhost:5173**, 관리자는 **http://localhost:5174**입니다. 기존 계정으로 로그인하세요. 종료는 실행 터미널에서 Ctrl+C입니다. 기본 API 포트는 3000이며, 위 명령은 기존 개발 서버와 겹치지 않는 3001을 사용합니다. 공유 Supabase를 쓰는 팀원은 DB migration·bootstrap·activate를 다시 실행하지 않습니다.

다른 PC의 최초 준비, 변경 구조, 담당별 확인 지점은 [변경 안내](docs/ANJEON_CHANGES.md), 시연 순서와 검증 결과는 [시연 안내](docs/DEMO.md)를 참고하세요. 테스트는 `npm run test:local`, 화면 빌드는 `npm run build`입니다.

**Git만으로 설정과 대용량 데이터까지 내려오지는 않습니다.** Node.js 24 이상/Python 3.12, 앱별 `.env`, 원본 데이터 ZIP이 필요합니다. 공유 DB 사용자는 재적재하지 않으며, 별도 Supabase를 만들 때만 변경 안내의 `bootstrap → 검증 → activate` 순서를 따릅니다.

인터넷 연결이 필요합니다(Supabase·카카오). 모델 성능은 합성 데이터 평가이며 실제 사고 위험을 예측하지 않습니다. 선택한 우리 경로에 대해 **전경 GPS 참고 안내와 주행 시뮬레이션**을 제공합니다. 차선·신호·실시간 교통·백그라운드 주행 안내는 제공하지 않습니다.

경로 선택 후 **이 경로 안내 시작 → 시뮬레이션 시작**으로 PC 시연이 가능합니다. GPS 모드는 위치 권한을 허용하고 화면을 켠 상태에서 사용합니다. 정확도가 낮거나 위치가 오래되면 안내를 멈추며, 이탈 시 현재 위치에서 새 경로를 검색하고 다시 선택합니다. 시뮬레이션·안내 시작/종료는 선택 학습 기록을 추가하지 않습니다.

휴대폰은 같은 네트워크의 **신뢰된 HTTPS 주소**로 접속해야 합니다. PC 주소를 포함하고 휴대폰에서도 신뢰하는 개발용 인증서를 준비한 경우에만 아래 옵션을 사용합니다. `.local-certs/`는 Git에서 제외됩니다. 단순 HTTP LAN 주소나 신뢰하지 않는 인증서는 GPS용으로 사용하지 마세요.

```powershell
$env:MOBILE_HOST='0.0.0.0'
$env:MOBILE_HTTPS_CERT=(Resolve-Path '.local-certs/mobile.pem').Path
$env:MOBILE_HTTPS_KEY=(Resolve-Path '.local-certs/mobile-key.pem').Path
npm start -- --api-port=3001
```

휴대폰에서 `https://PC주소:5173`으로 접속합니다. 해당 주소를 카카오 지도 허용 도메인에 등록하고, 소셜 로그인을 쓰면 인증 제공자의 리다이렉트 설정도 맞춥니다. API는 같은 HTTPS 주소의 `/api` 프록시를 사용하므로 휴대폰에서 PC의 `localhost:3001`을 직접 호출하지 않습니다. 실제 휴대폰 수신·음성 출력·현장 주행 검증은 별도로 필요합니다.
