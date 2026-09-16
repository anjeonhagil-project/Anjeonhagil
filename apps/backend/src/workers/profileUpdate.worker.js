// 수정 필요(Anjeonhagil): 원자적 queued→running 조건부 갱신으로 작업을 선점하고 modelInference로 계산 후 ag_apply_profile_update를 호출한다. 실패 복구와 held 사유를 기록한다.
// 기능: 실제 선택 이력으로 개인 프로필 보정 작업을 수행할 구현 자리. 독립 프로세스/수동 배치로 시작하며 별도 큐 서버는 추가하지 않는다.
// 구현: ag_profile_update_jobs에서 작업 1건 잠금 → 고정 모델로 보정 → 최근 이력 검증 → ag_apply_profile_update RPC로 경합 검사 후 활성화.
// cutoff/모델/입력 프로필로 중복 실행을 방지하고, held/failed 사유를 남긴다. 검색 응답에서 학습 완료를 기다리지 않는다.
