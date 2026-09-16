# 원본 자료 보관 안내

이 폴더는 A*·ML·DB 팀 전달용 실행 데이터셋이다. 현재 계산에 쓰는 정제 DB, 계산기, 계약, 컬럼 사전과 검증 증거는 모두 포함한다.

대용량 `source_materials.zip`은 계산·DB 적재·A*·ML에 필요하지 않아 제외했다. 그 파일은 데이터 담당자가 별도로 보관하는 감사·원본 재생성 자료이며 PBF, 경계, 시설 원좌표, TAAS, TOPIS Excel, 정밀도로지도, 초기 기획서와 과거 단계 문서를 담는다. 팀원은 일반 구현 과정에서 받을 필요가 없다.

현재 출처·기준일·좌표계·적용 여부·갱신 정책은 루트 `source_register.json`과 `README.html` 4장·12장을 기준으로 한다. 현재 계산 규칙은 `tools/runtime/current_feature_contract.json`, 데이터 파일 해시는 `package_manifest.json`, 검증 결과는 `evidence/`에서 확인한다.

원본부터 동일 산출물을 다시 만들어야 하는 데이터 담당자만 전체 보관본 `Anjeonhagil_DATASET_FINAL_CHILD100_20260915.zip`을 사용한다. 두 패키지는 같은 release·계산 계약을 사용하며 팀 전달용은 원본 재생성 범위만 제외한다.
