# 구현 예정(Anjeonhagil): 실제 경로 선택 Y를 예측하는 절편 없는 Logistic 모델의 학습·확률 예측 어댑터이다.
# 입력: 공통 choice_data의 X8/Y/sample_weight와 split. 출력: 학습 모델, predict_pair 확률, 재현 가능한 학습 설정.
# A/B 기준은 고정 candidate ID 순서이며 Y=1은 A 선택이다. 역방향 증강 시 검색별 총 가중치를 보존한다.
# 정규화는 normalization.py 결과만 사용한다. 사고 위험 예측·규칙 생성 정답으로 목적을 바꾸지 않는다.
# XGBoost와 같은 데이터·평가를 사용하고 아티팩트는 train.py에서 scaler/버전/해시와 함께 저장한다.
