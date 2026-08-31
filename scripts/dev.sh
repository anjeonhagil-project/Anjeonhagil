#!/usr/bin/env bash
# 기능: Frontend/Backend 로컬 동시 실행

set -e

# 스크립트 위치 기준으로 레포 루트로 이동 (어디서 실행해도 동작하도록)
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# 실행할 워크스페이스 목록: "경로:표시이름"
APPS=(
    "apps/backend:BACKEND"
    "apps/frontend_admin:ADMIN"
    "apps/frontend_mobile:MOBILE"
)

PIDS=()

# Ctrl+C 누르면 띄운 프로세스 전부 같이 종료
cleanup() {
    echo ""
    echo "종료 중... 실행 중인 프로세스를 정리합니다."
    for pid in "${PIDS[@]}"; do
        kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null
    exit 0
}
trap cleanup INT TERM

for entry in "${APPS[@]}"; do
    path="${entry%%:*}"
    name="${entry##*:}"
    echo "[$name] npm run dev -w $path 시작"
    (npm run dev -w "$path" 2>&1 | sed "s/^/[$name] /") &
    PIDS+=($!)
done

wait