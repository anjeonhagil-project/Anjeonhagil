// 기능: M-ROUTE-004 경로 비교 화면 - 안심/최단시간/최단거리 경로 비교
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { loadKakaoMaps } from '../../lib/kakaoMaps.js'
import { Button, Modal } from '../../components/common/index.js'
import Header from '../../components/layout/Header.jsx'
import { getDirections } from './api.js'
import styles from './RouteComparePage.module.css'

const ROUTE_STYLES = {
    safe: { label: '안심 경로', color: '#00a99d' },
    shortestTime: { label: '최단 시간', color: '#00a99d' },
    shortestDistance: { label: '최단 거리', color: '#00a99d' },
}

// 출발/도착 핀 마커 SVG (위는 둥글고 아래는 뾰족한 물방울 모양, 끝부분이 정확한 좌표를 가리킴)
function pinMarkerSvg(color) {
    return `<svg width="28" height="38" viewBox="0 0 28 38" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 24 14 24s14-13.5 14-24c0-7.7-6.3-14-14-14z" fill="${color}" />
        <circle cx="14" cy="14" r="5" fill="white" />
    </svg>`
}

// 미터 단위 거리를 화면에 보기 좋은 문자열로 변환
// 1000m 이상인지 확인
//  -> 1000m 이상이면: km 단위로 바꾸고, 소수점 첫째짜리까지만 남김 (예: 13.8km)
//  -> 1000m 미만이면: m 단위 그대로 (예: 850m)
function formatDistance(meters) {
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`
}

// 초 단위 시간을 분 단위 문자열로 변환
// 초를 분으로 변환한 뒤 반올림하여 정수 분으로 만듦
function formatDuration(seconds) {
    const minutes = Math.round(seconds / 60)
    return `${minutes}분`
}

// 경로 기본 화면 전체 담당
function RouteComparePage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { origin, destination } = location.state || {}

    const mapContainerRef = useRef(null) // 지도 DOM 참조
    const sdkRef = useRef(null) // 카카오 지도 SDK 참조
    const polylinesRef = useRef({}) // 경로 Polyline 참조

    // 백엔드에서 받은 실제 경로 전체를 포함하는 bounds 참조
    // 지도 크기가 바뀔 때 ResizeObserver에서도 같은 bounds를 다시 사용할 수 있도록 ref로 관리
    const routeBoundsRef = useRef(null)

    const [routes, setRoutes] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [selectedType, setSelectedType] = useState('shortestTime')
    const [comingSoonOpen, setComingSoonOpen] = useState(false)

    // sdkRef.current 값이 바뀌어도 React는 다시 렌더링하지 않기 때문에
    // 지도 준비 여부를 별도 state로 관리
    const [mapReady, setMapReady] = useState(false)

    useEffect(() => {
        if (!origin || !destination) navigate('/search', { replace: true })
    }, [origin, destination, navigate])

    // 출발지/도착지를 백엔드로 보내 최단시간/최단거리 경로 요청
    const fetchRoutes = useCallback(() => {
        if (!origin || !destination) return

        setLoading(true)
        setError('')

        getDirections({ origin, destination })
            .then((data) => {
                setRoutes(data)
                setSelectedType('shortestTime')
            })
            .catch((requestError) => {
                setError(requestError.message)
            })
            .finally(() => {
                setLoading(false)
            })
    }, [origin, destination])

    useEffect(() => {
        fetchRoutes()
    }, [fetchRoutes])

    // 카카오 지도를 처음 생성하고, 출발지/도착지 둘 다 화면에 보이도록 세팅
    useEffect(() => {
        // 출발지/도착지 없으면 아무것도 안 함
        if (!origin || !destination) return undefined

        let cancelled = false

        // SDK 로드가 비동기이기 때문에 실제 지도 생성 후 만든 객체들의 cleanup을 따로 보관
        let cleanup = () => {}

        setMapReady(false)
        routeBoundsRef.current = null

        // 카카오 지도 SDK 로드
        loadKakaoMaps()
            .then((kakao) => {
                // 로드가 끝난 시점에 컴포넌트가 사라졌거나 지도 담을 div가 없으면 중단
                if (cancelled || !mapContainerRef.current) return

                // 출발지/도착지 좌표를 카카오 좌표 객체로 변환
                const originLatLng = new kakao.maps.LatLng(origin.lat, origin.lng)
                const destinationLatLng = new kakao.maps.LatLng(destination.lat, destination.lng)

                // 아직 백엔드 경로가 오기 전이므로 처음에는 출발지/도착지만 포함하는 bounds 생성
                const initialBounds = new kakao.maps.LatLngBounds()
                initialBounds.extend(originLatLng)
                initialBounds.extend(destinationLatLng)

                // 지도 생성
                const map = new kakao.maps.Map(mapContainerRef.current, {
                    center: originLatLng,
                    level: 5,
                })

                // 출발지/도착지 위치에 핀 마커를 하나씩 찍음 (출발=파란색, 도착=빨간색)
                const pinSize = new kakao.maps.Size(28, 38)
                const pinOffset = { offset: new kakao.maps.Point(14, 38) }

                const originMarkerImage = new kakao.maps.MarkerImage(
                    `data:image/svg+xml;base64,${btoa(pinMarkerSvg('#4285f4'))}`,
                    pinSize,
                    pinOffset,
                )

                const destinationMarkerImage = new kakao.maps.MarkerImage(
                    `data:image/svg+xml;base64,${btoa(pinMarkerSvg('#c94646'))}`,
                    pinSize,
                    pinOffset,
                )

                // 출발지, 도착지 마커 생성
                const originMarker = new kakao.maps.Marker({
                    map,
                    position: originLatLng,
                    image: originMarkerImage,
                })

                const destinationMarker = new kakao.maps.Marker({
                    map,
                    position: destinationLatLng,
                    image: destinationMarkerImage,
                })

                // 지도 영역 크기가 변경되면 카카오 지도 내부 크기를 다시 계산
                // 경로 데이터가 이미 있다면 실제 경로 전체 bounds를 사용하고,
                // 아직 없다면 출발지/도착지만 포함하는 initialBounds를 사용
                const resizeObserver = new ResizeObserver(() => {
                    if (cancelled || !mapContainerRef.current) return

                    requestAnimationFrame(() => {
                        if (cancelled || !mapContainerRef.current) return

                        map.relayout()

                        const currentBounds = routeBoundsRef.current || initialBounds
                        map.setBounds(currentBounds, 24, 24, 24, 24)
                    })
                })

                resizeObserver.observe(mapContainerRef.current)

                // kakao 객체, map 인스턴스, 초기 bounds를 sdkRef에 저장
                // 경로 데이터가 온 후 Polyline 그리는 다른 useEffect에서 꺼내서 사용
                sdkRef.current = {
                    kakao,
                    map,
                    initialBounds,
                }

                // 최초 지도 렌더링 시 출발지와 도착지가 화면에 모두 들어오도록 설정
                map.relayout()
                map.setBounds(initialBounds, 24, 24, 24, 24)

                // 지도 생성 완료
                setMapReady(true)

                // 지도 관련 객체 cleanup
                cleanup = () => {
                    resizeObserver.disconnect()
                    originMarker.setMap(null)
                    destinationMarker.setMap(null)
                }
            })
            .catch((mapError) => {
                if (!cancelled) {
                    setError(mapError.message)
                }
            })

        // 지도 생성 cleanup 함수
        // 컴포넌트가 화면에서 사라지거나 effect가 다시 실행되기 직전에 자동 호출
        return () => {
            cancelled = true

            cleanup()

            Object.values(polylinesRef.current).forEach((polyline) => {
                polyline.setMap(null)
            })

            polylinesRef.current = {}
            routeBoundsRef.current = null
            sdkRef.current = null
        }
    }, [origin, destination])

    // 백엔드에서 경로 데이터(routes) 받아서 실제로 지도 위에 Polyline 그리는 로직
    useEffect(() => {
        // 경로 데이터가 안 왔거나, 지도가 준비되지 않으면 아무것도 안 함
        if (!routes || !mapReady || !sdkRef.current) return undefined

        const { kakao, map } = sdkRef.current

        // 기존에 그려져있는 경로 선들 모두 제거
        Object.values(polylinesRef.current).forEach((polyline) => {
            polyline.setMap(null)
        })
        polylinesRef.current = {}

        // 출발지/도착지뿐 아니라 실제 경로 좌표 전체를 포함하는 bounds 생성
        const routeBounds = new kakao.maps.LatLngBounds()

        routeBounds.extend(
            new kakao.maps.LatLng(origin.lat, origin.lng),
        )

        routeBounds.extend(
            new kakao.maps.LatLng(destination.lat, destination.lng),
        )

        // 최단 거리, 최단 시간 두 타입 순회
        // 해당 타입 데이터가 없으면 건너뜀
        for (const type of ['shortestTime', 'shortestDistance']) {
            const route = routes[type]

            if (!route || !Array.isArray(route.path)) continue

            // 우리가 가공해둔 좌표 배열을 카카오가 요구하는 LatLng 객체 배열로 변환
            const path = route.path.map((point) => {
                const latLng = new kakao.maps.LatLng(point.lat, point.lng)

                // 실제 경로의 모든 좌표를 bounds에 추가
                routeBounds.extend(latLng)

                return latLng
            })

            const isSelected = type === selectedType

            // 실제로 선을 그리는 코드
            // 선택 안 된 경로도 계속 보이되, 회색·얇게·아래에 깔리도록 표시
            const polyline = new kakao.maps.Polyline({
                map,
                path,
                strokeWeight: isSelected ? 6 : 4,
                strokeColor: isSelected ? ROUTE_STYLES[type].color : '#9ca3af',
                strokeOpacity: 1,
                zIndex: isSelected ? 2 : 1,
            })

            polylinesRef.current[type] = polyline
        }

        // ResizeObserver에서도 실제 경로 bounds를 사용할 수 있도록 저장
        routeBoundsRef.current = routeBounds

        // 경로가 도착하면 하단 패널 높이가 커지면서 지도 영역이 줄어들기 때문에
        // 변경된 지도 크기를 다시 계산한 뒤 실제 경로 전체가 화면에 들어오도록 맞춤
        requestAnimationFrame(() => {
            if (!sdkRef.current) return

            map.relayout()
            map.setBounds(routeBounds, 24, 24, 24, 24)
        })
    }, [routes, selectedType, mapReady, origin, destination])

    return (
        <div className={styles.page}>
            <Header title="경로 안내" onBack={() => window.history.back()} />

            <div
                ref={mapContainerRef}
                className={styles.map}
                aria-label="추천 경로 지도"
            />

            <div className={styles.panel}>
                {loading && (
                    <p className={styles.message}>
                        경로를 계산하고 있어요.
                    </p>
                )}

                {!loading && !error && routes && (
                    <>
                        <p className={styles.summary}>
                            총 {['safe', 'shortestTime', 'shortestDistance'].filter((type) => routes[type]).length}개 경로 검색됨
                        </p>

                        <div className={styles.card}>
                            <span className={styles.badge}>
                                {ROUTE_STYLES.safe.label}
                            </span>

                            <p className={styles.comingSoon}>
                                준비 중인 기능
                            </p>
                        </div>

                        {['shortestTime', 'shortestDistance'].map((type) => {
                            const route = routes[type]

                            if (!route) return null

                            return (
                                <button
                                    key={type}
                                    type="button"
                                    className={
                                        type === selectedType
                                            ? `${styles.card} ${styles.cardSelected}`
                                            : styles.card
                                    }
                                    onClick={() => setSelectedType(type)}
                                >
                                    <span
                                        className={styles.badge}
                                        style={{ background: ROUTE_STYLES[type].color }}
                                    >
                                        {ROUTE_STYLES[type].label}
                                    </span>

                                    <span className={styles.stats}>
                                        {formatDuration(route.duration)} · {formatDistance(route.distance)}
                                    </span>
                                </button>
                            )
                        })}

                        <Button
                            fullWidth
                            className={styles.startBtn}
                            onClick={() => setComingSoonOpen(true)}
                        >
                            이 경로로 안내 시작
                        </Button>
                    </>
                )}
            </div>

            <Modal
                open={comingSoonOpen}
                title="준비 중인 기능"
                description={'실시간 경로 안내 기능은 아직 준비 중입니다.\n조금만 기다려주세요.'}
                confirmLabel="확인"
                onConfirm={() => setComingSoonOpen(false)}
            />

            <Modal
                open={!loading && Boolean(error)}
                icon="warning"
                title="경로 탐색 실패"
                description={error}
                cancelLabel="취소"
                onCancel={() => navigate('/search', { replace: true })}
                confirmLabel="다시 시도"
                onConfirm={fetchRoutes}
            />
        </div>
    )
}

export default RouteComparePage