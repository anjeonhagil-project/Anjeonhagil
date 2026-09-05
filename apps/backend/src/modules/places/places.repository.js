import { supabase } from '../../lib/supabase.js'

const FAVORITE_COLUMNS = 'id, user_id, place_type, place_name, custom_name, address, geom, created_at, updated_at'

// 프론트의 GeoJSON Point를 PostGIS가 받는 EWKT 문자열로 변환
function toPostgisPoint(geom) {
	const [longitude, latitude] = geom.coordinates
	return `SRID=4326;POINT(${longitude} ${latitude})`
}

// 사용자의 즐겨찾기 목록 조회
export async function findFavorites(userId) {
	const { data, error } = await supabase
		.from('favorite_places')
		.select(FAVORITE_COLUMNS)
		.eq('user_id', userId)
		.order('created_at', { ascending: true })

	if (error) throw error
	return data
}

// 사용자의 즐겨찾기 개수 조회
export async function countFavorites(userId) {
	const { count, error } = await supabase
		.from('favorite_places')
		.select('id', { head: true, count: 'exact' })
		.eq('user_id', userId)

	if (error) throw error
	return count ?? 0
}

// 사용자의 같은 유형 즐겨찾기 존재 여부 조회
export async function findFavoriteByType(userId, placeType) {
	const { data, error } = await supabase
		.from('favorite_places')
		.select('id')
		.eq('user_id', userId)
		.eq('place_type', placeType)
		.maybeSingle()

	if (error) throw error
	return data
}

// favorite_places 테이블에 즐겨찾기 생성
export async function createFavorite(userId, payload) {
	const { data, error } = await supabase
		.from('favorite_places')
		.insert({
			user_id: userId,
			place_type: payload.placeType,
			place_name: payload.placeName.trim(),
			custom_name: payload.customName?.trim() || null,
			address: payload.address.trim(),
			geom: toPostgisPoint(payload.geom),
		})
		.select(FAVORITE_COLUMNS)
		.single()

	if (error) throw error
	return data
}

// 사용자 소유의 즐겨찾기 정보 수정
export async function updateFavorite(userId, favoriteId, payload) {
	const values = {}
	if (payload.placeType !== undefined) values.place_type = payload.placeType
	if (payload.placeName !== undefined) values.place_name = payload.placeName.trim()
	if (payload.customName !== undefined) values.custom_name = payload.customName?.trim() || null
	if (payload.address !== undefined) values.address = payload.address.trim()
	if (payload.geom !== undefined) values.geom = toPostgisPoint(payload.geom)

	const { data, error } = await supabase
		.from('favorite_places')
		.update(values)
		.eq('id', favoriteId)
		.eq('user_id', userId)
		.select(FAVORITE_COLUMNS)
		.single()

	if (error) throw error
	return data
}

// 사용자 소유의 즐겨찾기 삭제
export async function deleteFavorite(userId, favoriteId) {
	const { error } = await supabase
		.from('favorite_places')
		.delete()
		.eq('id', favoriteId)
		.eq('user_id', userId)

	if (error) throw error
}
