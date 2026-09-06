export const PLACE_TYPE_LABELS = { home: '집', work: '회사', custom: '저장 장소' }

export function getFavoriteName(favorite) {
    return favorite.customName?.trim() || PLACE_TYPE_LABELS[favorite.placeType] || PLACE_TYPE_LABELS.custom
}
