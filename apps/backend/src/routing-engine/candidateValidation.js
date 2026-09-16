// 구현 예정(Anjeonhagil): SQLite 계산 결과를 Supabase에 저장하기 전 검사하는 연결부. routes.service에서 routeSnapshot 변환보다 먼저 호출한다.
// 입력: 내부 worker 후보, 원래 OD/출발시각, 서버가 확정한 프로필/버전/Q3. 브라우저 계산값은 사용하지 않는다.
// 확인: 응답 5버전, profile_weights 일치, 동일 segments 중복, 양수 거리/시간, raw6 순서·단위·유한값, Q3 한도.
// README의 full-mirror SQL과 달리 현재 DB에는 ag_arcs/ag_edges가 없다. 지원 arc/부분비율/거리 합/원 내부 길이는 SQLite 계산기로 검산해야 한다.
// worker /evaluate에 동일 버전·출발시각·segments를 보내 source ID 유효성 및 distance_m/raw6/internal_duration_s를 대조한다. 거리·어린이 길이 허용차는 0.001m이다.
// 원본 /search의 설문 가중치와 learned 프로필이 다르면 응답 가중치만 덮어쓰지 않는다. profile_adapter 구현 전에는 설문 기준으로 명시적으로 복귀한다.
// DB RPC는 소유권·snapshot·노출/선택 관계를 추가 검사한다. SQLite 검산을 SQL의 raw6=quality 검사만으로 대체하지 않는다.
