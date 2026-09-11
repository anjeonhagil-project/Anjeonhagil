import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IoHeart, IoHeartOutline } from 'react-icons/io5'
import { loadKakaoMaps } from '../../lib/kakaoMaps.js'
import { buildSafeRouteSearchState, hasSelectedLocation, toSelectedPlace } from '../../lib/placeSelection.js'
import { Button } from '../../components/common/index.js'
import BottomNav from '../../components/layout/BottomNav.jsx'
import { createFavorite, deleteFavorite, getFavorites } from '../favorites/api.js'
import { buildFavoriteLocationResult, createFavoriteMarkerImage, findFavoriteForPlace, toFavoriteMarkerLocations } from '../favorites/favoriteContract.js'
import { PLACE_TYPE_LABELS } from '../favorites/favoriteName.js'
import styles from './HomePage.module.css'

const DEFAULT_CENTER = { lat: 37.4979, lng: 127.0276 }
const DETOUR_TIME_OPTIONS = [10, 20, 30, 60]

function HomePage() {
    const navigate = useNavigate()
    const location = useLocation()
    const mapContainerRef = useRef(null)
    const sdkRef = useRef(null)
    const requestRef = useRef(0)
    const searchTimerRef = useRef(null)
    const composingRef = useRef(false)
    const favoriteMarkersRef = useRef([])
    const [ready, setReady] = useState(false)
    const [attempt, setAttempt] = useState(0)
    const [query, setQuery] = useState('')
    const [results, setResults] = useState([])
    const [selected, setSelected] = useState(null)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [mapError, setMapError] = useState('')
    const [favorites, setFavorites] = useState([])
    const [favoriteBusy, setFavoriteBusy] = useState(false)
    const [favoriteError, setFavoriteError] = useState('')
    const [detourMinutes, setDetourMinutes] = useState(20)
    const placeType = location.state?.placeType || 'custom'
    const editingFavoriteId = location.state?.editingFavoriteId
    const selectingFavoriteLocation = Boolean(location.state?.placeType) && !editingFavoriteId
    const selectedFavorite = findFavoriteForPlace(favorites, selected)

    useEffect(() => {
        let active = true
        getFavorites()
            .then((data) => {
                if (active) setFavorites(data ?? [])
            })
            .catch(() => {
                if (active) setFavorites([])
            })

        return () => {
            active = false
        }
    }, [])

    useEffect(() => {
        let cancelled = false
        let cleanup = () => {}
        setMapError('')
        setReady(false)
        loadKakaoMaps().then((kakao) => {
            if (cancelled || !mapContainerRef.current) return
            if (!kakao.maps.services) throw new Error('장소 검색을 준비하지 못했습니다. 페이지를 새로고침해주세요.')
            const map = new kakao.maps.Map(mapContainerRef.current, {
                center: new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng), level: 4,
            })
            const marker = new kakao.maps.Marker()
            const geocoder = new kakao.maps.services.Geocoder()
            sdkRef.current = { kakao, map, marker, places: new kakao.maps.services.Places() }
            const onClick = ({ latLng }) => {
                clearTimeout(searchTimerRef.current)
                const request = ++requestRef.current
                setSelected(null)
                setFavoriteError('')
                setResults([])
                setBusy(true)
                setMessage('선택한 위치의 주소를 확인하고 있어요.')
                marker.setPosition(latLng)
                marker.setMap(map)
                geocoder.coord2Address(latLng.getLng(), latLng.getLat(), (data, status) => {
                    if (cancelled || request !== requestRef.current) return
                    setBusy(false)
                    const address = data?.[0]?.road_address?.address_name || data?.[0]?.address?.address_name
                    if (status !== kakao.maps.services.Status.OK || !address) {
                        setMessage('이 위치의 주소를 찾지 못했어요. 다른 위치를 선택하거나 장소를 검색해주세요.')
                        return
                    }
                    setMessage('')
                    setSelected({
                        placeName: data[0].road_address?.building_name || '선택한 위치', address,
                        latitude: latLng.getLat(), longitude: latLng.getLng(),
                    })
                })
            }
            kakao.maps.event.addListener(map, 'click', onClick)
            const observer = new ResizeObserver(() => {
                const center = map.getCenter()
                map.relayout()
                map.setCenter(center)
            })
            observer.observe(mapContainerRef.current)
            cleanup = () => {
                observer.disconnect()
                kakao.maps.event.removeListener(map, 'click', onClick)
                marker.setMap(null)
                favoriteMarkersRef.current.forEach(({ favoriteMarker, onClick }) => {
                    kakao.maps.event.removeListener(favoriteMarker, 'click', onClick)
                    favoriteMarker.setMap(null)
                })
                favoriteMarkersRef.current = []
            }
            setReady(true)
        }).catch((error) => {
            if (!cancelled) setMapError(error.message)
        })
        return () => {
            cancelled = true
            clearTimeout(searchTimerRef.current)
            requestRef.current++
            cleanup()
            sdkRef.current = null
        }
    }, [attempt])

    useEffect(() => {
        if (!ready || !sdkRef.current) return undefined

        const { kakao, map } = sdkRef.current
        favoriteMarkersRef.current.forEach(({ favoriteMarker, onClick }) => {
            kakao.maps.event.removeListener(favoriteMarker, 'click', onClick)
            favoriteMarker.setMap(null)
        })
        favoriteMarkersRef.current = toFavoriteMarkerLocations(favorites).map((favorite) => {
            const position = new kakao.maps.LatLng(favorite.latitude, favorite.longitude)
            const favoriteMarker = new kakao.maps.Marker({
                map,
                position,
                title: favorite.title,
                image: createFavoriteMarkerImage(kakao, favorite.placeType),
            })
            const onClick = () => {
                sdkRef.current?.marker.setMap(null)
                map.panTo(position)
                setSelected({
                    placeName: favorite.placeName,
                    address: favorite.address,
                    latitude: favorite.latitude,
                    longitude: favorite.longitude,
                })
                setResults([])
                setMessage('')
                setFavoriteError('')
            }
            kakao.maps.event.addListener(favoriteMarker, 'click', onClick)
            return { favoriteMarker, onClick }
        })

        return () => {
            favoriteMarkersRef.current.forEach(({ favoriteMarker, onClick }) => {
                kakao.maps.event.removeListener(favoriteMarker, 'click', onClick)
                favoriteMarker.setMap(null)
            })
            favoriteMarkersRef.current = []
        }
    }, [favorites, ready])

    const searchPlaces = useCallback((keyword) => {
        clearTimeout(searchTimerRef.current)
        if (!keyword.trim() || !sdkRef.current) return
        const { kakao, map, marker, places } = sdkRef.current
        const request = ++requestRef.current
        setBusy(true)
        setMessage('장소를 검색하고 있어요.')
        setSelected(null)
        setResults([])
        marker.setMap(null)
        places.keywordSearch(keyword.trim(), (data, status) => {
            if (request !== requestRef.current) return
            setBusy(false)
            if (status === kakao.maps.services.Status.ZERO_RESULT) {
                setMessage('검색 결과가 없어요. 지역명과 장소명을 함께 입력해보세요.')
            } else if (status !== kakao.maps.services.Status.OK) {
                setMessage('검색에 실패했어요. 잠시 후 다시 검색해주세요.')
            } else {
                setResults(data)
                setMessage('검색 결과를 선택하거나 지도에서 위치를 눌러주세요.')
            }
        }, { location: map.getCenter(), size: 15 })
    }, [])

    useEffect(() => {
        // 한글은 입력을 멈춰도 마지막 글자가 조합 중일 수 있으므로 검색을 막지 않습니다.
        if (!ready || !query.trim()) return
        searchTimerRef.current = setTimeout(() => searchPlaces(query), 300)
        return () => clearTimeout(searchTimerRef.current)
    }, [query, ready, searchPlaces])

    const changeQuery = (value) => {
        // 입력 즉시 이전 응답을 무효화해 새 검색어에 오래된 결과가 표시되지 않게 합니다.
        clearTimeout(searchTimerRef.current)
        requestRef.current++
        setQuery(value)
        setResults([])
        setSelected(null)
        setFavoriteError('')
        setBusy(false)
        setMessage(value.trim() ? '입력한 장소를 검색할게요.' : '')
        sdkRef.current?.marker.setMap(null)
    }

    const search = (event) => {
        event.preventDefault()
        if (composingRef.current) return
        searchPlaces(query)
    }

    const selectResult = (result) => {
        clearTimeout(searchTimerRef.current)
        requestRef.current++
        const place = toSelectedPlace(result)
        const { kakao, map, marker } = sdkRef.current
        const position = new kakao.maps.LatLng(place.latitude, place.longitude)
        marker.setPosition(position)
        marker.setMap(map)
        map.setLevel(3)
        map.panTo(position)
        setSelected(place)
        setFavoriteError('')
        setResults([])
        setBusy(false)
        setMessage('')
    }

    const toggleFavorite = async () => {
        if (!selected || favoriteBusy || editingFavoriteId) return

        setFavoriteBusy(true)
        setFavoriteError('')
        try {
            if (selectedFavorite) {
                await deleteFavorite(selectedFavorite.id)
                setFavorites((current) => current.filter((favorite) => favorite.id !== selectedFavorite.id))
            } else {
                const created = await createFavorite({
                    ...selected,
                    placeType: 'custom',
                })
                setFavorites((current) => [...current, created])
            }
        } catch (error) {
            setFavoriteError(error.message)
        } finally {
            setFavoriteBusy(false)
        }
    }

    const completeFavoriteLocationSelection = () => {
        if (!hasSelectedLocation(selected)) return

        const destination = buildFavoriteLocationResult({
            selectedPlace: selected,
            favoriteId: editingFavoriteId,
            placeType,
            draftName: location.state?.draftName,
        })
        navigate(destination.to, {
            replace: destination.replace,
            state: destination.state,
        })
    }

    return (
        <div className={styles.page}>
            <div ref={mapContainerRef} className={styles.map} aria-label="위치를 선택할 카카오 지도" />
            <section className={styles.searchPanel} aria-label="장소 검색">
                <form className={styles.searchForm} onSubmit={search} role="search">
                    <input
                        aria-label="장소 검색어"
                        placeholder="카페, 미용실 등 장소를 입력하세요"
                        autoComplete="off"
                        value={query}
                        onChange={(event) => changeQuery(event.target.value)}
                        onCompositionStart={() => {
                            composingRef.current = true
                        }}
                        onCompositionEnd={() => {
                            composingRef.current = false
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' && (event.nativeEvent.isComposing || event.keyCode === 229)) event.preventDefault()
                        }}
                    />
                    <Button type="submit" size="sm" disabled={!ready || !query.trim()}>검색</Button>
                </form>
                <p className={styles.hint} role="status">{mapError ? '지도를 불러오지 못했어요.' : message || (ready ? '지도를 누르거나 장소를 검색해 위치를 선택하세요.' : '지도를 불러오고 있어요.')}</p>
                {results.length > 0 && (
                    <ul className={`${styles.results} hide-scrollbar`} aria-label="장소 검색 결과">
                        {results.map((result) => (
                            <li key={result.id}>
                                <button type="button" onClick={() => selectResult(result)}>
                                    <strong>{result.place_name}</strong>
                                    <span>{result.road_address_name || result.address_name}</span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
            {mapError && <div className={styles.selection} role="alert"><p>{mapError}</p><Button onClick={() => setAttempt(value => value + 1)}>다시 시도</Button></div>}
            {selected && (
                <section className={styles.selection} aria-label="선택한 장소">
                    <div className={styles.selectionHeader}>
                        <div className={styles.selectionText}>
                            <strong>{selected.placeName}</strong>
                            <p>{selected.address}</p>
                        </div>
                        {!editingFavoriteId && !selectingFavoriteLocation && (
                            <button
                                type="button"
                                className={[styles.favoriteButton, selectedFavorite ? styles.favoriteButtonActive : ''].filter(Boolean).join(' ')}
                                aria-label={selectedFavorite ? '즐겨찾기에서 삭제' : '즐겨찾기에 추가'}
                                aria-pressed={Boolean(selectedFavorite)}
                                disabled={favoriteBusy || !hasSelectedLocation(selected)}
                                onClick={toggleFavorite}
                            >
                                {selectedFavorite ? <IoHeart aria-hidden="true" /> : <IoHeartOutline aria-hidden="true" />}
                            </button>
                        )}
                    </div>
                    {favoriteError && <p className={styles.favoriteError} role="alert">{favoriteError}</p>}
                    {(editingFavoriteId || selectingFavoriteLocation) && (
                        <Button
                            className={styles.editLocationButton}
                            fullWidth
                            disabled={busy || !hasSelectedLocation(selected)}
                            onClick={completeFavoriteLocationSelection}
                        >
                            {editingFavoriteId ? '이 위치로 변경' : `이 위치를 ${PLACE_TYPE_LABELS[placeType]}로 등록`}
                        </Button>
                    )}
                    {!editingFavoriteId && !selectingFavoriteLocation && (
                        <div className={styles.routeControls}>
                            <fieldset className={styles.timeFieldset}>
                                <legend>얼마나 돌아가도 괜찮으세요?</legend>
                                <div className={styles.timeOptions}>
                                    {DETOUR_TIME_OPTIONS.map((minutes) => (
                                        <button
                                            key={minutes}
                                            type="button"
                                            className={minutes === detourMinutes ? styles.timeOptionActive : ''}
                                            aria-pressed={minutes === detourMinutes}
                                            onClick={() => setDetourMinutes(minutes)}
                                        >
                                            {minutes === 60 ? '1시간' : `${minutes}분`}
                                        </button>
                                    ))}
                                </div>
                            </fieldset>
                            <Button
                                className={styles.safeRouteButton}
                                fullWidth
                                disabled={busy || favoriteBusy || !hasSelectedLocation(selected)}
                                onClick={() => navigate('/search', {
                                    state: buildSafeRouteSearchState(selected, detourMinutes),
                                })}
                            >안심경로 찾기</Button>
                        </div>
                    )}
                </section>
            )}
            <BottomNav />
        </div>
    )
}

export default HomePage
