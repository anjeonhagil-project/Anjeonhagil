// 구현 예정(Anjeonhagil): Q1~Q3 이후 Q4 사례 제공·진행 복구를 담당한다. DB의 ag_onboarding_progress가 완료 상태의 기준이다.
// 입력: 인증 사용자와 config/onboardingCases. Q1~Q3 저장 뒤 ag_start_onboarding(user,caseSetVersion,caseIds)으로 2~3개 필수 사례를 고정한다.
// Q4 검색은 sample_origin=onboarding, onboarding_case_set_version, onboarding_case_id를 서버에서 지정한다. 프로필의 survey_version도 일치해야 한다.
// routes의 후보 저장·실제 노출·선택 RPC를 재사용한다. Q4 노출은 정확히 두 후보이며 사용자 선택 전에 완료 처리하지 않는다.
// ag_record_choice가 현재 설문/사례 집합의 고유 선택을 집계해 completed_at과 users.onboarding을 한 트랜잭션으로 갱신한다.
// 중단 후 같은 사례를 재개하며 같은 사례의 여러 검색·재전송은 완료 수를 늘리지 않는다. 미완료 중 설문 변경 시 새 설문으로 사례를 다시 시작한다.
// 최초 Q4 완료 뒤 설정 화면에서 설문을 바꾸면 최초 온보딩 완료는 유지한다. 과거 선택/설문 이력은 그대로 보존한다.
// getMe/AuthRedirect는 새 설문 존재와 completed_at을 함께 확인한다. 원본 ZIP의 온보딩 코드나 구 boolean 단독 판정을 복사하지 않는다.
