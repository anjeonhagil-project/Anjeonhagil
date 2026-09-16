// 구현 예정(Anjeonhagil): 계산 데이터·공통 모델·scaler·개인 프로필의 호환성을 한곳에서 검사한다.
// 기준: routingContract.js와 ag_model_versions의 contract/feature/ETA 버전, X8 순서, train 전용 scaler 및 해시.
// learned 프로필은 그 프로필을 만든 모델과 함께 사용한다. 다른 모델에 과거 보정 가중치를 그대로 결합하지 않는다.
// 모델 교체/실패 시 설문 가중치로 돌아갈 새 프로필 snapshot 저장 방법까지 preferences 계층과 연결한다.
// 출력: 사용 가능 여부와 서버용 사유 코드. 파일 제목을 바꾸더라도 내부 버전 문자열은 변경하지 않는다.
