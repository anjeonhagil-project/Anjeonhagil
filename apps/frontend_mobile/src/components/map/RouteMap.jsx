// 구현 예정(Anjeonhagil): 경로 비교와 Q4에서 서버가 반환한 후보 geometry 및 선택 미리보기를 카카오 지도에 그린다.
// 입력: candidate_id별 LineString과 선택 후보 ID, OD. GeoJSON [경도,위도]를 지도 API 좌표 순서에 맞춰 변환한다.
// 기존 lib/kakaoMaps.js 로더를 재사용하고 언마운트/후보 교체 때 이벤트·polyline을 정리한다.
// 지도는 표시 역할이다. 이미 계산된 내부 경로를 카카오 길찾기 API로 다시 생성하거나 ETA를 바꾸지 않는다.
// 지도 클릭은 미리보기이며 최종 선택 저장과 분리한다. 현재 어떤 화면에서도 import하지 않은 주석 골격이다.
