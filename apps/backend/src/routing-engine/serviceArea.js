// 수정 필요(Anjeonhagil): 서울 내부 OD 여부는 Python tools/service_area.py의 실제 경계 검사와 연결한다. 1km 연결 버퍼나 40m 스냅을 서비스 영역으로 대체하지 않는다.
// # 기능: service_areas.geom에 대해 ST_Covers로 출발/도착 서비스 가능 여부 판정
