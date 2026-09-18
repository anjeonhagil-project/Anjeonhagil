# XGBoost Q2+Q4 최종 결과

## 최종 하이퍼파라미터

- max_depth: 6
- learning_rate: 0.06
- n_estimators: 300
- subsample: 1.0
- colsample_bytree: 0.8

## 최종 학습 방식

- Train + Validation: 85%
- Test: 15%
- Train+Validation로 최종 재학습 후 Test 평가

## 최종 Test 결과

- Accuracy: 87.89%
- ROC-AUC: 0.951932
- Log Loss: 0.283823
- Search Top-1: 79.78% (359/450)

## 참고

- Test는 하이퍼파라미터 선택에 사용하지 않음
- Test는 최종 평가에서만 사용
- Q4의 m_time, m_distance는 현재 합성 프로필 기반