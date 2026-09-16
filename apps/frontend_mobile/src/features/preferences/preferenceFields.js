// 구현 예정(Anjeonhagil): 온보딩·마이페이지가 공유할 Q1/Q2/Q3 항목 코드, 표시 문구, 입력 검증 규칙을 정의한다.
// Q1: daily/weekly/monthly/rarely/never. Q2 순서: COMPLEX_INTERSECTION, MERGE_BRANCH, NARROW_ROAD, UNFAMILIAR_TURN, CONSECUTIVE_ACTION, CHILD_ZONE_NEARBY.
// Q2는 선택 항목만 중복 없는 1..k, 상관없음 0; 미응답은 화면에서 따로 구분하고 제출하지 않는다.
// Q3는 null/0/5/10/15분. null은 '상황에 따라'이며 미응답과 다르다. 전부 상관없음은 유효하다.
// raw6 단위는 count, score*m, score*m, count, count, m. 어린이 항목은 시설 100m 원 내부 통과길이이다.
// 초기 가중치는 서버에서 확정한다. 이 파일에는 모델·학습·worker 접속 설정을 넣지 않는다.
