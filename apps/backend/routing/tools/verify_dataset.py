"""기능: 선별 반입한 계산기 파일과 데이터 해시를 검사한다. PostgreSQL 적재 도구를 가져오지 않는다."""
from pathlib import Path
import hashlib
import json


def verify_files():
    root = Path(__file__).resolve().parents[1]
    manifest = json.loads((root / 'service_manifest.json').read_text(encoding='utf-8'))
    for name, expected in manifest['files'].items():
        target = (root / name).resolve()
        if not target.is_relative_to(root) or not target.is_file():
            raise RuntimeError('Required runtime file missing: ' + name)
        with target.open('rb') as stream:
            actual = hashlib.file_digest(stream, 'sha256').hexdigest()
        if actual != expected:
            raise RuntimeError('Runtime hash mismatch: ' + name)
    return manifest['release_id']


if __name__ == '__main__':
    print(verify_files())
