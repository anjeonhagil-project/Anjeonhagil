// 수정 필요(Anjeonhagil): worker 응답을 ag_save_search 계약으로 변환한다. Q4는 search.onboarding_case_set_version/onboarding_case_id, 학습 모델은 후보 scale_version/scaler_sha256을 저장한다.
// 저장: UUID, 출발시각, release/5개 버전, profile/model, survey_version, raw6/단위, 부분 arc, geometry, 표시시간·coverage.
// 내부 계산 초와 화면 표시 초를 구분하고, 화면에 보낸 수치와 학습용 원본 snapshot이 일치하게 한다.
// 모델 사용 시 scale_version/scaler_sha256을 후보 snapshot에 함께 저장한다. 브라우저가 보내는 피처값을 저장하지 않는다.
// Q4는 서버가 검증한 사례 식별자를 search의 전용 컬럼에 추가한다. 출처는 search.sample_origin으로 구분한다.
// 노출 ID/표시 순서는 실제 노출 후 ag_exposures에 기록한다. 아직 노출되지 않은 후보를 displayed=true로 만들지 않는다.
// survey_only 이력을 학습할 때 scaler가 없던 사실을 보존하고, train에서 적합한 scaler를 별도 학습 변환본에 적용한다.
// 원본 worker에는 display_duration_s가 없다. Node에서 Math.round(internal_duration_s / 60) * 60과 display_duration_source=INTERNAL_HOURLY를 생성해 저장·화면 응답에 함께 사용한다.
