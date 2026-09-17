"""실제 로컬 worker의 모델·데이터·부분 arc 경로를 재검산한다. 사용자 이력은 생성하지 않는다."""
from pathlib import Path
import json, os, socket, subprocess, sys, time, urllib.request, urllib.error, secrets, math
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'.test-tools'; OUT.mkdir(exist_ok=True)
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0)); port=sock.getsockname()[1]
token=secrets.token_urlsafe(24)
def request(endpoint, payload=None, auth=True):
    req=urllib.request.Request(f'http://127.0.0.1:{port}{endpoint}',data=None if payload is None else json.dumps(payload).encode(),headers={'Content-Type':'application/json',**({'Authorization':'Bearer '+token} if auth else {})})
    try:
        with urllib.request.urlopen(req,timeout=45) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as e:return e.code,json.load(e)
with (OUT/'service-worker-test.log').open('w',encoding='utf8') as log:
    proc=subprocess.Popen([sys.executable,'-X','utf8','apps/backend/routing/tools/serve.py'],cwd=ROOT,env=dict(os.environ,ROUTING_WORKER_PORT=str(port),ROUTING_WORKER_TOKEN=token),stdout=log,stderr=log,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    try:
        limit=time.monotonic()+120
        while True:
            if proc.poll() is not None:raise RuntimeError('Worker startup failed; inspect service-worker-test.log')
            try:
                status,health=request('/health')
                if status==200:break
            except OSError:pass
            if time.monotonic()>limit:raise RuntimeError('Worker startup timed out')
            time.sleep(.5)
        assert request('/health',auth=False)[0]==401
        assert health['model']['training_source']=='SYNTHETIC_TEAM_DATA'
        query=json.loads((ROOT/'apps/backend/routing/tools/examples/hourly_search.json').read_text())
        query.pop('max_detour_minutes')
        # Disconnect an in-flight search. The single worker must become available quickly.
        body=json.dumps(query).encode()
        with socket.create_connection(('127.0.0.1',port)) as client:
            client.sendall((f'POST /search HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {len(body)}\r\nConnection: close\r\n\r\n').encode()+body)
            time.sleep(.5)
        cancelled_at=time.monotonic()
        assert request('/health')[0]==200
        cancellation_seconds=time.monotonic()-cancelled_at
        assert cancellation_seconds<3,('Cancellation did not release worker',cancellation_seconds)
        status,result=request('/search',query)
        assert status==200,result
        assert 1<=len(result['candidates'])<=3
        assert result['profile_weights']==[2/6,0,3/6,0,0,1/6]
        checks=7
        for c in result['candidates']:
            status,explanation=request('/burden',{**health['versions'],'segments':c['segments'],'raw_features':c['raw_features']})
            assert status==200,explanation
            events=explanation['events']
            sums=[sum(e['value'] for e in events if e['factor_index']==i) for i in range(6)]
            assert all(math.isclose(a,b,rel_tol=1e-8,abs_tol=1e-6) for a,b in zip(sums,c['raw_features']))
            assert all(0<=e['start_m']<=e['end_m']<=c['distance_m']+1e-5 for e in events)
            assert all(0<e['start_m']-e['previous_action_m']<=100 for e in events if e['factor_index']==4)
            assert all(e['geometry']['coordinates'] for e in events)
            checks+=4
            status,guide=request('/guidance',{**health['versions'],'segments':c['segments']})
            assert status==200,guide
            assert guide['geometry']==c['geometry'], 'Guidance must preserve selected path exactly'
            assert guide['steps'][-1]['kind']=='arrival'
            assert all(0<=s['coordinate_index']<len(c['geometry']['coordinates']) for s in guide['steps'])
            checks+=4
            status,again=request('/evaluate',{**health['versions'],'departure_at':query['departure_at'],'segments':c['segments']})
            assert status==200,again
            for key in ('distance_m','internal_duration_s'):
                assert abs(c[key]-again[key])<.001
            assert all(abs(a-b)<.001 for a,b in zip(c['raw_features'],again['raw_features']))
            assert abs(c['raw_features'][5]-c['quality']['child_circle_inside_m'])<.001
            assert c['display_duration_s']==math.floor(c['internal_duration_s']/60+.5)*60
            checks+=6
        status,ranking=request('/rank',{'candidates':result['candidates'],'weights':result['profile_weights']})
        assert request('/guidance',{**health['versions'],'segments':[]})[0]==422
        checks+=1
        assert status==200 and ranking['recommended_index']==result['recommended_index'],ranking
        assert request('/search',dict(query,max_detour_minutes=5))[0]==422
        assert request('/search',dict(query,origin={'lng':129.1,'lat':35.1}))[0]==422
        assert request('/search',dict(query,departure_at='2026-09-16T08:00:00'))[0]==422
        checks+=4
        artifact={'test_only':True,'request':query,'response':result}
        (OUT/'service-routing-fixture.json').write_text(json.dumps(artifact,ensure_ascii=False,indent=2),encoding='utf8')
        import hashlib
        report={'passed':checks,'cancellation_seconds':cancellation_seconds,'candidate_count':len(result['candidates']),'diagnostics':result['diagnostics'],'model':health['model'],'versions':health['versions'],
                'manifest_sha256':hashlib.sha256((ROOT/'apps/backend/routing/service_manifest.json').read_bytes()).hexdigest(),
                'runtime_sha256':hashlib.sha256((ROOT/'apps/backend/routing/runtime_manifest.json').read_bytes()).hexdigest()}
        (OUT/'service-routing-report.json').write_text(json.dumps(report,indent=2),encoding='utf8')
        print(json.dumps(report,indent=2))
    finally:
        if os.name=='nt':subprocess.run(['taskkill','/PID',str(proc.pid),'/T','/F'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
        else:proc.terminate()
        try:proc.wait(timeout=10)
        except subprocess.TimeoutExpired:proc.kill();proc.wait(timeout=10)
