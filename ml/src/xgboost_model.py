# 구현 예정(Anjeonhagil): Logistic과 동일한 X8/Y/sample_weight를 사용하는 XGBoost 선택모델 어댑터이다.
# 역할: 학습과 A 선택 확률 반환. 공통 후보 순위·A/B 대칭화·실패 복귀는 predict_choice.py에 둔다.
# 데이터와 split/scaler를 별도로 만들지 않는다. 검증 세트로 튜닝하고 test는 최종 평가에만 사용한다.
# 성능은 실제 사용자 선택 기준으로 비교한다. 모델 파일·설정·라이브러리 버전·학습 manifest 해시를 함께 보존한다.
