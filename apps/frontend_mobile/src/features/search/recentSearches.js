// 기능: 최근 검색한 장소를 localStorage에 보관 (추후 recent_searches 테이블 연동 전까지 임시)
// db 사용하게 되면 api.js에 코드 옮길 예정
const STORAGE_KEY = 'anjeonhagil:recentSearches'
const MAX_ITEMS = 10

export function loadRecentSearches() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)
        return raw ? JSON.parse(raw) : []
    } catch {
        return []
    }
}

function save(list) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
    } catch {
        // localStorage 접근 불가(프라이빗 모드 등) 시 조용히 무시
    }
}

// 같은 주소가 이미 있으면 맨 앞으로 올리고, 없으면 새로 추가
export function addRecentSearch(place) {
    const list = loadRecentSearches().filter((item) => item.address !== place.address)
    const next = [place, ...list].slice(0, MAX_ITEMS)
    save(next)
    return next
}

export function removeRecentSearch(address) {
    const next = loadRecentSearches().filter((item) => item.address !== address)
    save(next)
    return next
}

export function clearRecentSearches() {
    save([])
    return []
}
