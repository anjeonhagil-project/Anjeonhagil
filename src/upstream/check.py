import sqlite3,json,struct,zlib,math,hashlib
from pathlib import Path
from collections import Counter
import numpy as np
import shapely
from shapely.geometry import shape,Point
from shapely.ops import transform
from pyproj import Transformer,CRS
P=Path('/workspace/scratch/5294593fb829/upload');out={}
def gpkg(f):
 c=sqlite3.connect('file:'+str(f)+'?mode=ro',uri=True);cont=c.execute('select table_name,srs_id,min_x,min_y,max_x,max_y from gpkg_contents').fetchall();t=cont[0][0];cols=[r[1] for r in c.execute('pragma table_info("'+t+'")')];rows=c.execute('select * from "'+t+'"').fetchall();gs=[];attrs=[];srs=Counter()
 for r in rows:
  a=dict(zip(cols,r));b=a.pop('geom');en=(b[3]>>1)&7;order='<' if b[3]&1 else '>';srs[struct.unpack_from(order+'i',b,4)[0]]+=1
  gs.append(shapely.from_wkb(b[8+{0:0,1:32,2:48,3:48,4:64}[en]:]));attrs.append(a)
 crsrows=c.execute('select organization,organization_coordsys_id,definition from gpkg_spatial_ref_sys where srs_id=?',(cont[0][1],)).fetchall()
 out[f.name]={'sha256':hashlib.file_digest(f.open('rb'),'sha256').hexdigest(),'count':len(gs),'declared_srs':cont[0][1],'geometry_header_srs':dict(srs),'crs_definition_matches_epsg':CRS.from_wkt(crsrows[0][2]).equals(CRS.from_epsg(cont[0][1])),'geometry_types':dict(Counter(g.geom_type for g in gs)),'invalid':sum(not g.is_valid for g in gs),'empty':sum(g.is_empty for g in gs),'bounds_actual':shapely.total_bounds(gs).tolist(),'bounds_metadata':cont[0][2:]}
 return gs,attrs
roads,ra=gpkg(next(P.glob('seoul_road_edges_childzone*.gpkg')));bg,ba=gpkg(next(P.glob('*1km*gpkg')));buf=bg[0]
length=np.array([g.length for g in roads]);stored=np.array([a['length_m'] for a in ra]);delta=abs(length-stored)
out['length']={'max_error_m':float(delta.max()),'mean_error_m':float(delta.mean()),'over_1mm':int(sum(delta>.001)),'over_1cm':int(sum(delta>.01)),'nonpositive':int(sum(length<=0)),'under_1m':int(sum(length<1)),'under_10cm':int(sum(length<.1)),'over_1km':int(sum(length>1000)),'total_km':float(length.sum()/1000),'quantiles_m':dict(zip(['min','p50','p95','p99','max'],map(float,np.quantile(length,[0,.5,.95,.99,1])))),'shortest_examples':[{'edge_id':ra[i]['edge_id'],'length_m':float(length[i])} for i in np.argsort(length)[:5]]}
tr=Transformer.from_crs(4326,5186,always_xy=True);rev=Transformer.from_crs(5186,4326,always_xy=True)
endpoints={};max_conflict=0
for g,a in zip(roads,ra):
 for n,co in [(a['from_node'],g.coords[0]),(a['to_node'],g.coords[-1])]:
  if n in endpoints:max_conflict=max(max_conflict,math.dist(co,endpoints[n]))
  else:endpoints[n]=co
out['geometry']={'nonfinite':sum(not np.isfinite(np.asarray(g.coords)).all() for g in roads),'nonsimple':sum(not g.is_simple for g in roads),'unique_endpoint_nodes':len(endpoints),'same_node_coordinate_max_difference_m':max_conflict,'road_bounds_lonlat':[rev.transform(*v) for v in [shapely.total_bounds(roads)[:2],shapely.total_bounds(roads)[2:]]]}
# Parse original PBF protobuf, including coordinate offsets/granularity.
def vi(b,p):
 n=s=0
 while True:
  x=b[p];p+=1;n|=(x&127)<<s
  if x<128:return n,p
  s+=7
  if s>70:raise ValueError('varint')
def fields(b):
 p=0
 while p<len(b):
  k,p=vi(b,p);wire=k&7
  if wire==0:v,p=vi(b,p)
  elif wire==2:n,p=vi(b,p);v=b[p:p+n];p+=n
  elif wire in [1,5]:n=8 if wire==1 else 4;v=b[p:p+n];p+=n
  else:raise ValueError(wire)
  yield k>>3,v
def vals(b):
 p=0
 while p<len(b):v,p=vi(b,p);yield v
def zz(n):return (n>>1)^-(n&1)
def signed(n):return n-(1<<64) if n>=1<<63 else n
node_ll={};ways={};wayids={a['osm_way_id'] for a in ra};pbf=next(P.glob('*.pbf'))
with pbf.open('rb') as f:
 while h:=f.read(4):
  hd=dict(fields(f.read(struct.unpack('>I',h)[0])));blob=dict(fields(f.read(hd[3])));data=blob[1] if 1 in blob else zlib.decompress(blob[3])
  if hd[1]!=b'OSMData':continue
  fs=list(fields(data));d=dict(fs);gran=d.get(17,100);lato=signed(d.get(19,0));lono=signed(d.get(20,0))
  for k,group in fs:
   if k!=2:continue
   for typ,msg in fields(group):
    n=dict(fields(msg))
    if typ==2:
     ni=la=lo=0
     for di,da,do in zip(vals(n[1]),vals(n[8]),vals(n[9])):
      ni+=zz(di);la+=zz(da);lo+=zz(do)
      if ni in endpoints:node_ll[ni]=((lono+gran*lo)*1e-9,(lato+gran*la)*1e-9)
    elif typ==1:
     ni=zz(n[1])
     if ni in endpoints:node_ll[ni]=((lono+gran*zz(n[9]))*1e-9,(lato+gran*zz(n[8]))*1e-9)
    elif typ==3 and n[1] in wayids:
     refs=[];r=0
     for v in vals(n[8]):r+=zz(v);refs.append(r)
     ways[n[1]]=refs
errs=[math.dist(endpoints[n],tr.transform(*ll)) for n,ll in node_ll.items()]
seq_bad=[]
for a in ra:
 refs=ways.get(a['osm_way_id'],[]);i=a['way_seq']
 if i+1>=len(refs) or refs[i:i+2]!=[a['from_node'],a['to_node']]:seq_bad.append(a['edge_id'])
out['pbf_coordinates']={'matched_nodes':len(node_ll),'missing_nodes':len(endpoints.keys()-node_ll.keys()),'max_error_m':max(errs),'above_1cm':sum(e>.01 for e in errs),'above_1mm':sum(e>.001 for e in errs),'way_sequence_mismatch_count':len(seq_bad),'mismatch_examples':seq_bad[:10]}
# Bounds: do not treat the additional boundary as an independently authenticated official boundary.
citydata=json.loads((P/'seoul_buffer.geojson').read_text());city=shapely.union_all([transform(tr.transform,shape(f['geometry'])) for f in citydata['features']]);out['boundary_reference']={'source':'seoul_buffer.geojson (uploaded OSM boundary candidate)','valid':city.is_valid,'area_km2':city.area/1e6,'buffer_area_km2':buf.area/1e6,'buffer_covers_reference':buf.covers(city),'buffer1000_comparisons':{}}
for q in [5,8,16]:
 expected=city.buffer(1000,quad_segs=q);out['boundary_reference']['buffer1000_comparisons'][q]={'symmetric_difference_m2':buf.symmetric_difference(expected).area,'hausdorff_m':buf.hausdorff_distance(expected)}
covered=shapely.covers(buf,roads);inter=shapely.intersects(buf,roads);insidecity=shapely.covers(city,roads);cross=shapely.intersects(city,roads)
ix=np.flatnonzero(~covered);outside_lengths=[]
for i in ix:outside_lengths.append({'edge_id':ra[i]['edge_id'],'outside_length_m':roads[i].difference(buf).length})
out['road_scope']={'buffer_fully_covered':int(sum(covered)),'buffer_crossing':int(sum(inter & ~covered)),'buffer_disjoint':int(sum(~inter)),'city_fully_covered':int(sum(insidecity)),'city_crossing':int(sum(cross & ~insidecity)),'city_disjoint':int(sum(~cross)),'outside_total_length_m':sum(x['outside_length_m'] for x in outside_lengths),'largest_outside_examples':sorted(outside_lengths,key=lambda x:x['outside_length_m'],reverse=True)[:10]}
cd=json.loads(next(P.glob('child_zones*.geojson')).read_text());points=[shape(f['geometry']) for f in cd['features']];pts=[transform(tr.transform,g) for g in points];outside=[{'record_id':f['properties']['record_id'],'facility_name':f['properties']['facility_name'],'distance_to_city_m':g.distance(city)} for f,g in zip(cd['features'],pts) if not city.covers(g)]
out['child_geometry']={'count':len(pts),'types':dict(Counter(g.geom_type for g in points)),'invalid':sum(not g.is_valid for g in points),'empty':sum(g.is_empty for g in points),'bounds_lonlat':shapely.total_bounds(points).tolist(),'outside_buffer':sum(not buf.covers(g) for g in pts),'outside_reference_city':outside,'duplicate_coordinate_extra_rows':len(points)-len({g.wkb for g in points})}
Path('/tmp/geo_audit/results.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps(out,ensure_ascii=False,indent=2))
