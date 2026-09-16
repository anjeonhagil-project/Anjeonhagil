// 수정 필요(Anjeonhagil): 첫 통합은 단일 Python worker 호출로 시작. queued/polling API 구현 시에만 이 파일 연결하고 중복 계산기 추가 금지.
// # 기능: route_requests queued row를 processing→terminal 상태로 계산하는 비동기 worker
