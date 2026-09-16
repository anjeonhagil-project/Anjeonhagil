# 수정 필요(Anjeonhagil): database/export_choices.py의 JSONL을 학습 입력으로 변환한다. 원본 ZIP exporter는 profile_snapshot 컬럼과 출처 위치가 달라 그대로 사용하지 않는다.
# 입력: ag_searches/candidates/exposures/choices와 당시 profile/model snapshot. 원본 이력은 수정하지 않는다.
# 동일 exposure에서 실제 표시한 후보만 사용하고 선택한 후보가 그 집합에 있는지 검사한다. 실패/미노출/미선택을 Y로 만들지 않는다.
# service/onboarding/study 출처를 보존하며 합성 정답은 실제 사용자 성능 평가에서 제외한다.
# 사용자 분리 후 normalization.py의 train scaler로 learning.py.make_training_pairs를 호출한다. pair마다 user/search/exposure/choice ID를 보존한다.
# 한 검색의 선택 대 나머지 비교는 총 가중치 1이 되게 한다. 원본에 scaler가 없는 설문 단계 로그는 별도 변환본에 학습 scaler 출처를 기록한다.
