# 구현 예정(Anjeonhagil): 동결 RouteService와 개인화 effective_weights를 연결하는 A* 담당자의 구현 위치이다.
# 현재 runtime/routing_service.py의 search는 ranks에서 survey_weights를 다시 만들며 profile_weights 입력을 사용하지 않는다.
# 입력 계약: 기존 origin/destination/departure_at/ranks/max_detour_minutes + 서버 검증 profile_weights[6].
# ranks는 설문 원본으로 보존하고 profile_weights를 순위로 역변환하지 않는다. 비선택 요소=0, 비음수, 합=1 또는 전체 0을 검사한다.
# 후보 생성의 burden 비용과 후보 최종 raw6 정렬 모두 동일 effective_weights를 사용해야 한다. 응답의 profile_weights도 동일해야 한다.
# 현행 RouteService.route/evaluate/geometry와 제한 시퀀스·시간대·Q3 규칙을 재사용한다. 모델 순위는 별도 모델 API 책임이다.
# 연결 전에는 survey_only 검색만 지원한다. learned 프로필을 원본 /search로 보낸 뒤 응답 가중치만 덮어쓰는 구현은 금지한다.
# 실제 연결 시 serve 진입점/백엔드 routingClient/manifest를 함께 검증한다. 동결 원본과 내부 버전 식별자는 유지한다.
