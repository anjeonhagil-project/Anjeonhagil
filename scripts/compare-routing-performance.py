"""Before/after integrated search on the same machine, data and frozen graph rules."""
from pathlib import Path
import sys,json,time,subprocess,ctypes,hashlib
ROOT=Path(__file__).resolve().parents[1]
variant=sys.argv[1] if len(sys.argv)>1 else None
if variant is None:
    reports={}
    for name in ('before','after'):
        subprocess.run([sys.executable,'-X','utf8',__file__,name],cwd=ROOT,check=True)
        reports[name]=json.loads((ROOT/f'.test-tools/performance-{name}.json').read_text())
    for before,after in zip(reports['before']['cases'],reports['after']['cases']):
        if not before['degraded'] and not after['degraded']:
            assert before['routes']==after['routes'],(before['case'],'unbounded results changed')
    (ROOT/'.test-tools/performance-comparison.json').write_text(json.dumps(reports,indent=2),encoding='utf8')
    print(json.dumps(reports,indent=2));sys.exit()
sys.path.insert(0,str(ROOT/'apps/backend/routing/tools/runtime'))
from shapely import Point
if variant=='before':
    code=subprocess.check_output(['git','show','HEAD:apps/backend/routing/tools/runtime/integrated_service.py'],cwd=ROOT).decode('utf8')
    scope={'__file__':str(ROOT/'apps/backend/routing/tools/runtime/integrated_service.py'),'__name__':'baseline_integrated'}
    exec(compile(code,scope['__file__'],'exec'),scope);Engine=scope['IntegratedService']
else:
    from integrated_service import IntegratedService as Engine
engine=Engine();origin={'lng':127.0331208,'lat':37.5110356};xy=engine.to_xy.transform(origin['lng'],origin['lat']);rows=[]
for label,dx,dy in [('nearby',500,1000),('medium',3000,-1000),('cross_river',-4000,6000),('long',-10000,4000)]:
    idx=int(engine.tree.nearest(Point(xy[0]+dx,xy[1]+dy)));point=engine.spatial[idx].interpolate(.5,normalized=True)
    lng,lat=engine.to_ll.transform(point.x,point.y)
    query={'origin':origin,'destination':{'lng':lng,'lat':lat},'departure_at':'2026-09-16T08:00:00+09:00','profile_weights':[2/6,0,3/6,0,0,1/6]}
    start=time.perf_counter();r=engine.search(query)
    row={'case':label,'seconds':round(time.perf_counter()-start,3),'degraded':r['degraded'],'pool':r['diagnostics']['candidate_count'],
         'routes':sorted(c['route_key'] for c in r['candidates']),'response_bytes':len(json.dumps(r).encode()),'explanation_seconds':r['diagnostics'].get('explanation_seconds',0)}
    rows.append(row);print(variant,label,row['seconds'],flush=True)
class Memory(ctypes.Structure):
    _fields_=[('cb',ctypes.c_ulong),('PageFaultCount',ctypes.c_ulong)]+[(k,ctypes.c_size_t) for k in ('PeakWorkingSetSize','WorkingSetSize','QuotaPeakPagedPoolUsage','QuotaPagedPoolUsage','QuotaPeakNonPagedPoolUsage','QuotaNonPagedPoolUsage','PagefileUsage','PeakPagefileUsage')]
mem=Memory();mem.cb=ctypes.sizeof(mem)
ctypes.windll.kernel32.GetCurrentProcess.restype=ctypes.c_void_p
ctypes.windll.psapi.GetProcessMemoryInfo.argtypes=[ctypes.c_void_p,ctypes.POINTER(Memory),ctypes.c_ulong]
if not ctypes.windll.psapi.GetProcessMemoryInfo(ctypes.windll.kernel32.GetCurrentProcess(),ctypes.byref(mem),mem.cb):raise ctypes.WinError()
report={'variant':variant,'cases':rows,'peak_working_set_mb':round(mem.PeakWorkingSetSize/1024**2,1),'scope':'one pass per case, same frozen core; timed-out candidate pools may differ'}
(ROOT/f'.test-tools/performance-{variant}.json').write_text(json.dumps(report,indent=2),encoding='utf8')
