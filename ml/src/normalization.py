# 구현 예정(Anjeonhagil): X8의 단위를 맞추는 8개 양수 scale을 train 데이터에서만 적합하고 고정한다.
# 순서: 표시시간 차이, 거리 차이, raw6 차이. 부담 차이에 적용하는 가중치는 당시 profile_weights를 사용한다.
# 중심 이동은 하지 않아 A/B 교환 시 X의 부호가 반전되게 한다. 0 분산/결측/무한대 처리 정책은 명시적으로 검증한다.
# 출력: scale_version, feature_version, fit_split=train, fit_manifest_sha256, values[8] 및 scaler_sha256.
# apps/backend/routing/tools/runtime/learning.py의 validate_scaler/scaler_hash/pair_x8 계약을 재사용한다.
# 추론·검증·개인 보정에서는 fit하지 않는다. 학습 변환본의 scaler 메타데이터를 과거 서빙 시 사용한 값으로 위장하지 않는다.
