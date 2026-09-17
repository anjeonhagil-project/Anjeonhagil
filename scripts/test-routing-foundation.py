# 기능(Anjeonhagil): 동결 HTTP worker의 인증/계산/거절 응답을 실행 검사하고 로컬 DB 통합용 실제 후보 fixture를 저장한다.
# 사용: .venv\Scripts\python.exe -X utf8 scripts/test-routing-foundation.py. 시험 입력은 학습용 사용자 선택이 아니다.
from pathlib import Path
import hashlib
import json
import math
import os
import secrets
import socket
import subprocess
import sys
import time
import urllib.request
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
ROUTING = ROOT / 'apps/backend/routing'
OUT = ROOT / '.test-tools'


def main():
    OUT.mkdir(exist_ok=True)
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        port = sock.getsockname()[1]
    token = secrets.token_urlsafe(24)
    env = dict(os.environ, ROUTING_WORKER_HOST='127.0.0.1', ROUTING_WORKER_PORT=str(port), ROUTING_WORKER_TOKEN=token, PYTHONUTF8='1')
    checks = 0

    def request(endpoint, payload=None, authenticated=True):
        headers = {'Content-Type': 'application/json'}
        if authenticated:
            headers['Authorization'] = 'Bearer ' + token
        data = None if payload is None else json.dumps(payload).encode()
        req = urllib.request.Request(f'http://127.0.0.1:{port}{endpoint}', data=data, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=180) as reply:
                return reply.status, json.load(reply)
        except urllib.error.HTTPError as exc:
            return exc.code, json.load(exc)

    with (OUT / 'routing-worker-test.log').open('w', encoding='utf-8') as log:
        process = subprocess.Popen([sys.executable, '-X', 'utf8', str(ROUTING / 'tools/serve.py')], cwd=ROOT, env=env, stdout=log, stderr=log, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        try:
            deadline = time.monotonic() + 120
            while True:
                if process.poll() is not None:
                    raise RuntimeError('Worker exited during startup; inspect .test-tools/routing-worker-test.log')
                try:
                    status, health = request('/health')
                    if status == 200:
                        break
                except (OSError, urllib.error.URLError):
                    pass
                if time.monotonic() >= deadline:
                    raise RuntimeError('Worker did not become ready within 120 seconds')
                time.sleep(0.5)
            assert health['ok'] and health['mapped_arcs'] == 53516
            assert request('/health', authenticated=False)[0] == 401
            checks += 2
            evaluate = json.loads((ROUTING / 'tools/examples/hourly_request.json').read_text(encoding='utf-8'))
            status, fixed = request('/evaluate', evaluate)
            assert status == 200 and abs(fixed['distance_m'] - 1422.031757501335) < .001
            assert abs(fixed['internal_duration_s'] - 242.786) < .01
            checks += 2
            wrong = dict(evaluate, contract_version='invalid-test-contract')
            assert request('/evaluate', wrong)[0] == 422
            checks += 1
            search = json.loads((ROUTING / 'tools/examples/hourly_search.json').read_text(encoding='utf-8'))
            status, result = request('/search', search)
            assert status == 200, result
            assert result['profile_weights'] == [2/6, 0, 3/6, 0, 0, 1/6]
            assert len(result['candidate_pool']) >= 2
            seen = set()
            for candidate in result['candidate_pool']:
                key = json.dumps(candidate['segments'], sort_keys=True)
                assert key not in seen
                seen.add(key)
                assert candidate['internal_duration_s'] <= result['minimum_internal_duration_s'] + search['max_detour_minutes'] * 60 + 1e-6
                assert len(candidate['raw_features']) == 6 and all(math.isfinite(v) and v >= 0 for v in candidate['raw_features'])
                assert abs(candidate['raw_features'][5] - candidate['quality']['child_circle_inside_m']) <= .001
                assert candidate['time_source'] == 'INTERNAL_HOURLY'  # 표시시간은 Node 저장 변환 계층에서 만든다.
                checks += 5
            assert request('/search', dict(search, max_detour_minutes=20))[0] == 422
            assert request('/search', dict(search, departure_at='2026-09-15T08:00:00'))[0] == 422
            checks += 5
            artifact = {'test_only': True, 'request': search, 'response': result}
            (OUT / 'routing-http-fixture.json').write_text(json.dumps(artifact, ensure_ascii=False, allow_nan=False, indent=2), encoding='utf-8')
            manifest_bytes = (ROUTING / 'service_manifest.json').read_bytes()
            report = {'passed': checks, 'python': sys.version.split()[0], 'mapped_arcs': health['mapped_arcs'], 'candidate_count': len(seen), 'versions': health['versions'], 'manifest_sha256': hashlib.sha256(manifest_bytes).hexdigest(), 'scope': 'loopback worker; no remote DB or real user records'}
            (OUT / 'routing-smoke.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
            print(json.dumps(report, indent=2))
        finally:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=10)


if __name__ == '__main__':
    main()
