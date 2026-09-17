# 구현 예정(Anjeonhagil): data/seoul_boundary.gpkg로 출발·도착점의 서울 서비스 영역 포함 여부를 검사한다.
# 입력: WGS84 경도/위도 OD. 경계 CRS를 확인해 같은 좌표계로 변환하고 경계 위 점 포함 정책을 명시한다.
# 서울 경계와 1km 도로 연결 버퍼는 목적이 다르다. 40m 스냅 성공만으로 서비스 가능 여부를 판단하지 않는다.
# 출력: 서비스 가능 여부와 영역 밖/잘못된 좌표 사유. 부분 arc 스냅과 실제 경로 계산은 기존 runtime으로 위임한다.
# 현재 API에는 연결하지 않은 주석 골격이다. 연결 시 api.py/serve.py와 service_manifest.json의 해시를 함께 갱신한다.
# 동결 데이터·내부 버전은 유지하며 별도 서울 경계 데이터나 Supabase 도로 복제 테이블을 추가하지 않는다.
from pathlib import Path
import sqlite3
from shapely import from_wkb, Point, union_all
from pyproj import Transformer

class ServiceArea:
    def __init__(self):
        path = Path(__file__).resolve().parents[1] / 'data/seoul_boundary.gpkg'
        with sqlite3.connect(f'file:{path}?mode=ro',uri=True) as db:
            table, column, srid = db.execute('select table_name,column_name,srs_id from gpkg_geometry_columns').fetchone()
            # 식별자는 파일 내부 SQLite 스키마에서 읽으며 따옴표를 이스케이프한다.
            table=table.replace('"','""'); column=column.replace('"','""')
            geometries=[]
            for (blob,) in db.execute(f'SELECT "{column}" FROM "{table}"'):
                offset=8+{0:0,1:32,2:48,3:48,4:64}[(blob[3]>>1)&7]
                geometries.append(from_wkb(blob[offset:]))
        self.area=union_all(geometries)
        self.transform=Transformer.from_crs(4326,srid,always_xy=True)

    def contains(self, location):
        return self.area.covers(Point(*self.transform.transform(location['lng'],location['lat'])))
