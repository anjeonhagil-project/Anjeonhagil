# 안전하길 (Anjeonhagil)

초보 운전자가 부담스러워하는 도로 요소를 비교하는 **로컬 경로 추천 포트폴리오**입니다. 내부 A*·Yen, 공통 Logistic 모델, 카카오 지도, Supabase를 연결했습니다.

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

인터넷 연결이 필요합니다(Supabase·카카오). 모델 성능은 합성 데이터 평가이며 실제 사고 위험을 예측하거나 실시간 주행을 안내하는 서비스가 아닙니다.
