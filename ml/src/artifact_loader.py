# 구현 예정(Anjeonhagil): 서버가 등록한 model_version에 해당하는 모델·scaler·학습 manifest 묶음을 로드한다.
# ag_model_versions와 파일의 종류/contract/feature/ETA/scale 버전 및 SHA256이 일치할 때만 추론에 사용한다.
# 로컬 artifact 루트 안의 등록된 파일만 읽는다. 브라우저가 지정한 경로·직렬화 파일을 직접 로드하지 않는다.
# 캐시는 불변 model_version과 해시로 구분한다. 모델 교체 때 다른 scaler를 조합하거나 파일을 덮어쓰지 않는다.
# survey_only_v1은 학습 모델 파일이 없는 정상 상태이다. 로드 실패는 명시적 오류로 반환한다.
