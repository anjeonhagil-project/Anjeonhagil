// 구현 예정(Anjeonhagil): 경로의 표시 시간·거리·부담 단위·유형·coverage를 일관된 화면 문구로 변환한다.
// 서버 display_duration_s를 표시하며 화면에서 별도 ETA 반올림 규칙을 만들지 않는다. INTERNAL_HOURLY는 과거 시간대 추정임을 알린다.
// raw6 순서와 단위는 preferenceFields.js와 맞춘다. score*m을 구간 개수로 표시하거나 서로 다른 단위를 합산하지 않는다.
// 하나의 후보가 가진 복수 route_types는 한 카드의 여러 유형 표시로 처리한다. 카드 순서와 candidate_id는 보존한다.
// 어린이 시설 100m 원 내부 통과길이를 법정 보호구역 전체 길이 또는 사고 위험으로 표현하지 않는다.
