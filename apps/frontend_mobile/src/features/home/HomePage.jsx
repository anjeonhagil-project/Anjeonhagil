// 기능: M-HOME-001 홈 화면 - Kakao 지도 표시
import { useEffect, useRef } from 'react'
import { loadKakaoMaps } from '../../lib/kakaoMaps.js'
import BottomNav from '../../components/layout/BottomNav.jsx'
import styles from './HomePage.module.css'

const DEFAULT_CENTER = { lat: 37.4979, lng: 127.0276 } // 강남역 기준 기본 중심 좌표

function HomePage() {
    const mapContainerRef = useRef(null)

    useEffect(() => {
        let cancelled = false

        loadKakaoMaps().then((kakao) => {
            if (cancelled || !mapContainerRef.current) return

            new kakao.maps.Map(mapContainerRef.current, {
                center: new kakao.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
                level: 4,
            })
        })

        return () => {
            cancelled = true
        }
    }, [])

    return (
        <div className={styles.page}>
            <div ref={mapContainerRef} className={styles.map} />
            <BottomNav />
        </div>
    )
}

export default HomePage
