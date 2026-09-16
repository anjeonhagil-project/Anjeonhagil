// 수정 필요(Anjeonhagil): 개인화 상태/켜기/끄기/초기화와 모델 불일치 시 설문 프로필 복귀를 구현한다. DB 접근은 기존 preferences.repository.js, 갱신 기준은 config/personalizationPolicy.js를 공유한다.
// 기능: 개인화 프로필 조회·활성/중지·초기화를 기존 preferences 모듈 안에서 처리할 구현 자리. 기능은 아직 연결하지 않았다.
// 구현: ag_user_profiles와 ag_profile_versions 조회, ag_reset_profile RPC 호출, 사용자 ID는 인증 미들웨어에서만 취득.
// 설문 초기 가중치와 이력으로 보정한 effective_weights를 분리하고, 다음 검색부터 새 버전을 적용한다.
// 모델 불일치·정보 부족·상관없음·선택항목 1개이면 설문 프로필을 유지한다. 관련 구현 규칙은 연결 파일의 주석을 따른다.
