# 구현 예정(Anjeonhagil): 공통 모델의 사용자 분리와 개인화의 시간 분리를 재현 가능한 manifest로 만든다.
# 공통 모델은 같은 user_id의 모든 검색을 동일 split에 넣는다. pair 생성 이전에 train/validation/test를 결정한다.
# 개인 보정은 cutoff 이전 과거 이력으로 조정하고 그 이후 검증·미래 평가를 분리한다. 초기화 history_start_at 이전 이력을 재사용하지 않는다.
# 입력 파일/검색 ID 집합, 분리 기준, seed, 출처별 수, SHA256을 기록한다. 행 순서나 pair 증강으로 분리가 달라지지 않게 한다.
# 동일 split manifest를 Logistic/XGBoost가 함께 사용하며 미래 선택으로 scaler·튜닝·개인 보정값을 적합하지 않는다.
