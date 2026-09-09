// 기능: M-SRCH-001~004 경로검색 화면 - 출발지/목적지 검색 후 경로 비교로 이동
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IoClose, IoSearchOutline, IoTimeOutline, IoHomeOutline, IoBusinessOutline } from 'react-icons/io5'
import { FaLocationDot } from 'react-icons/fa6'
import { loadKakaoMaps } from '../../lib/kakaoMaps.js'
import { toSelectedPlace, hasSelectedLocation } from '../../lib/placeSelection.js'
import BottomNav from '../../components/layout/BottomNav.jsx'
import { getFavorites } from '../favorites/api.js'
import { loadRecentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } from './recentSearches.js'
import styles from './SearchPage.module.css'

// TODO: 서비스 지역(강남구) 판정 - 전처리 팀원의 service_areas 데이터 받으면 "서비스 지역 밖" 배지 추가
function distanceMeters(a, b) {
    const R = 6371000
    const toRad = (deg) => (deg * Math.PI) / 180
    const dLat = toRad(b.latitude - a.latitude)
    const dLng = toRad(b.longitude - a.longitude)
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.asin(Math.sqrt(h))
}

function formatDistance(meters) {
    if (meters == null) return ''
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.round(meters)}m`
}

const EMPTY_FIELD = { text: '', place: null }

function SearchPage() {
    const navigate = useNavigate()
    const sdkRef = useRef(null)
    const searchTimerRef = useRef(null)
    const composingRef = useRef(false)
    const requestRef = useRef(0)

    const [ready, setReady] = useState(false)
    const [origin, setOrigin] = useState(EMPTY_FIELD)
    const [destination, setDestination] = useState(EMPTY_FIELD)
    const [activeField, setActiveField] = useState('origin')
    const [results, setResults] = useState([])
    const [message, setMessage] = useState('')
    const [favorites, setFavorites] = useState([])
    const [recentSearches, setRecentSearches] = useState(() => loadRecentSearches())
    const [currentPosition, setCurrentPosition] = useState(null)

    useEffect(() => {
        let cancelled = false
        loadKakaoMaps().then((kakao) => {
            if (!cancelled) sdkRef.current = { kakao, places: new kakao.maps.services.Places() }
            if (!cancelled) setReady(true)
        })
        return () => {
            cancelled = true
        }
    }, [])

    useEffect(() => {
        getFavorites().then((data) => setFavorites(data ?? [])).catch(() => setFavorites([]))
    }, [])

    useEffect(() => {
        navigator.geolocation?.getCurrentPosition(
            (position) => setCurrentPosition({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
            () => setCurrentPosition(null),
        )
    }, [])

    const activeText = activeField === 'origin' ? origin.text : destination.text
    const activeResolved = activeField === 'origin' ? origin.place : destination.place

    const searchPlaces = useCallback((keyword, field) => {
        if (!keyword.trim() || !sdkRef.current) return
        const { kakao, places } = sdkRef.current
        const request = ++requestRef.current
        setMessage('장소를 검색하고 있어요.')
        places.keywordSearch(keyword.trim(), (data, status) => {
            if (request !== requestRef.current) return
            if (status === kakao.maps.services.Status.ZERO_RESULT) {
                setResults([])
                setMessage(field === 'origin' ? '검색한 출발지를 찾을 수 없습니다' : '검색한 목적지를 찾을 수 없습니다')
            } else if (status !== kakao.maps.services.Status.OK) {
                setResults([])
                setMessage('검색에 실패했어요. 잠시 후 다시 검색해주세요.')
            } else {
                setResults(data)
                setMessage('')
            }
        }, currentPosition ? { x: currentPosition.longitude, y: currentPosition.latitude } : undefined)
    }, [currentPosition])

    useEffect(() => {
        clearTimeout(searchTimerRef.current)
        if (!ready || activeResolved || !activeText.trim()) {
            setResults([])
            setMessage('')
            return undefined
        }
        searchTimerRef.current = setTimeout(() => searchPlaces(activeText, activeField), 300)
        return () => clearTimeout(searchTimerRef.current)
    }, [ready, activeField, activeText, activeResolved, searchPlaces])

    const changeField = (field, value) => {
        clearTimeout(searchTimerRef.current)
        requestRef.current++
        const setter = field === 'origin' ? setOrigin : setDestination
        setter({ text: value, place: null })
        setActiveField(field)
        setResults([])
        setMessage('')
    }

    const resolveField = (field, place) => {
        const setter = field === 'origin' ? setOrigin : setDestination
        setter({ text: place.placeName, place })
        setResults([])
        setMessage('')
        setRecentSearches(addRecentSearch(place))
    }

    const selectResult = (result) => resolveField(activeField, toSelectedPlace(result))

    const selectShortcut = (place) => resolveField(activeField, place)

    // 출발지를 안 정했으면 현재 위치를 출발지로 대신 사용
    const canSearchRoute = hasSelectedLocation(destination.place) && (hasSelectedLocation(origin.place) || Boolean(currentPosition))

    const handleSearchRoute = () => {
        if (!canSearchRoute) return
        const originLocation = hasSelectedLocation(origin.place)
            ? { lat: origin.place.latitude, lng: origin.place.longitude }
            : { lat: currentPosition.latitude, lng: currentPosition.longitude }

        navigate('/route-compare', {
            state: {
                origin: originLocation,
                destination: {
                    lat: destination.place.latitude,
                    lng: destination.place.longitude,
                    name: destination.place.placeName,
                    address: destination.place.address,
                },
            },
        })
    }

    const homeFavorite = favorites.find((favorite) => favorite.placeType === 'home')
    const workFavorite = favorites.find((favorite) => favorite.placeType === 'work')

    return (
        <div className={styles.page} data-page="search">
            <div className={styles.searchBar}>
                <div className={styles.searchForm}>
                    {[
                        { field: 'origin', dotClass: styles.dotOrigin, placeholder: '출발지 입력 (미입력 시 현위치)', value: origin },
                        { field: 'destination', dotClass: styles.dotDestination, placeholder: '목적지 입력', value: destination },
                    ].map(({ field, dotClass, placeholder, value }) => (
                        <div key={field} className={styles.inputRow}>
                            <span className={dotClass} aria-hidden="true" />
                            <input
                                className={styles.input}
                                placeholder={placeholder}
                                autoComplete="off"
                                value={value.text}
                                onFocus={() => setActiveField(field)}
                                onChange={(event) => changeField(field, event.target.value)}
                                onCompositionStart={() => { composingRef.current = true }}
                                onCompositionEnd={() => { composingRef.current = false }}
                            />
                            {value.text && (
                                <button type="button" className={styles.clearBtn} aria-label="입력 지우기" onClick={() => changeField(field, '')}>
                                    <IoClose size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                <button
                    type="button"
                    className={styles.searchBtn}
                    aria-label="경로 검색"
                    disabled={!canSearchRoute}
                    onClick={handleSearchRoute}
                >
                    <IoSearchOutline size={20} />
                </button>
            </div>

            <div className={`${styles.content} hide-scrollbar`}>
            {results.length === 0 && !message && (
                <div className={styles.shortcuts}>
                    <section>
                        <h2>즐겨찾기</h2>
                        <div className={styles.favoriteRow}>
                            {homeFavorite && (
                                <button type="button" className={styles.favoriteItem} onClick={() => selectShortcut({
                                    placeName: '집',
                                    address: homeFavorite.address,
                                    latitude: homeFavorite.latitude,
                                    longitude: homeFavorite.longitude,
                                })}>
                                    <IoHomeOutline size={18} />
                                    <div><strong>집</strong><span>{homeFavorite.address}</span></div>
                                </button>
                            )}
                            {workFavorite && (
                                <button type="button" className={styles.favoriteItem} onClick={() => selectShortcut({
                                    placeName: '회사',
                                    address: workFavorite.address,
                                    latitude: workFavorite.latitude,
                                    longitude: workFavorite.longitude,
                                })}>
                                    <IoBusinessOutline size={18} />
                                    <div><strong>회사</strong><span>{workFavorite.address}</span></div>
                                </button>
                            )}
                            {!homeFavorite && !workFavorite && <p className={styles.emptyHint}>저장된 집/회사가 없어요.</p>}
                        </div>
                    </section>

                    {recentSearches.length > 0 && (
                        <section>
                            <div className={styles.sectionHeading}>
                                <h2>최근 검색</h2>
                                <button type="button" className={styles.textAction} onClick={() => setRecentSearches(clearRecentSearches())}>전체 삭제</button>
                            </div>
                            <ul className={styles.recentList}>
                                {recentSearches.map((place) => (
                                    <li key={place.address}>
                                        <button type="button" className={styles.recentItem} onClick={() => selectShortcut(place)}>
                                            <IoTimeOutline size={18} aria-hidden="true" />
                                            <div><strong>{place.placeName}</strong><span>{place.address}</span></div>
                                        </button>
                                        <button type="button" className={styles.removeBtn} aria-label="최근 검색 삭제" onClick={() => setRecentSearches(removeRecentSearch(place.address))}>
                                            <IoClose size={14} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}
                </div>
            )}

            {message && <p className={styles.message} role="status">{message}</p>}

            {results.length > 0 && (
                <ul className={styles.results} aria-label="장소 검색 결과">
                    {results.map((result) => {
                        const distance = currentPosition
                            ? distanceMeters(currentPosition, { latitude: Number(result.y), longitude: Number(result.x) })
                            : null
                        return (
                            <li key={result.id}>
                                <button type="button" className={styles.resultItem} onClick={() => selectResult(result)}>
                                    <div className={styles.resultHeader}>
                                        <strong>{result.place_name}</strong>
                                    </div>
                                    <span className={styles.resultAddress}>{result.road_address_name || result.address_name}</span>
                                    {distance != null && (
                                        <span className={styles.resultDistance}>
                                            <FaLocationDot size={12} aria-hidden="true" /> 현재 위치에서 {formatDistance(distance)}
                                        </span>
                                    )}
                                </button>
                            </li>
                        )
                    })}
                </ul>
            )}
            </div>

            <BottomNav />
        </div>
    )
}

export default SearchPage
