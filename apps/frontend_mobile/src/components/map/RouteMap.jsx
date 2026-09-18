// 서버 LineString을 카카오 지도에 표시하며 지도 클릭은 경로 미리보기만 변경한다.
import { useEffect, useRef, useState } from 'react'
import { loadKakaoMaps } from '../../lib/kakaoMaps.js'
import { buildTrack, pointAt } from '../../features/navigation/navigationMath.js'
import styles from './RouteMap.module.css'
import markerStyles from './MapMarkers.module.css'

export default function RouteMap({ candidates = [], selectedId, onSelect, origin, destination, size, position, progress = 0, follow = false, onPan, comparison = false, focusEvent, originSnap, destinationSnap }) {
    const container = useRef(null), instance = useRef(null), selectRef = useRef(onSelect)
    const [ready, setReady] = useState(false), [error, setError] = useState('')
    const panRef = useRef(onPan)
    panRef.current = onPan
    selectRef.current = onSelect
    useEffect(() => {
        let active = true, observer
        loadKakaoMaps().then(kakao => {
            if (!active || !container.current) return
            const map = new kakao.maps.Map(container.current, { center: new kakao.maps.LatLng(37.505, 127.035), level: 5 })
            instance.current = { kakao, map }
            kakao.maps.event.addListener(map, 'dragstart', () => panRef.current?.())
            observer = new ResizeObserver(() => map.relayout()); observer.observe(container.current)
            setReady(true)
        }).catch(e => active && setError(e.message || '지도를 불러올 수 없습니다'))
        return () => { active = false; observer?.disconnect(); instance.current = null }
    }, [])
    useEffect(() => {
        if (!ready || !instance.current) return
        const { kakao, map } = instance.current, lines = [], markers = []
        const bounds = new kakao.maps.LatLngBounds()
        for (const c of candidates) {
            const path = c.geometry.coordinates.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng))
            path.forEach(p => bounds.extend(p))
            const line = new kakao.maps.Polyline({ map, path, strokeWeight: c.candidate_id === selectedId ? 7 : 4, strokeColor: comparison ? (c.label === 'B' ? '#5264ba' : '#087f8c') : c.candidate_id === selectedId ? '#087f8c' : '#a7b6c6', strokeStyle: comparison && c.label === 'B' ? 'dash' : 'solid', strokeOpacity: .9, zIndex: c.candidate_id === selectedId ? 3 : 1 })
            const click = () => selectRef.current?.(c.candidate_id)
            kakao.maps.event.addListener(line, 'click', click); lines.push([line, click])
        }
        for (const [index, p] of [origin, destination].entries()) {
            if (!p) continue
            const position = new kakao.maps.LatLng(p.lat, p.lng); bounds.extend(position)
            const label = document.createElement('span'); label.textContent = index === 0 ? '출발' : '도착'
            label.className = `${markerStyles.pin} ${index === 0 ? markerStyles.pinOrigin : markerStyles.pinDestination}`
            markers.push(new kakao.maps.CustomOverlay({ map, position, content: label, yAnchor: 1.2, zIndex: 4 }))
        }
        if (candidates.length || origin || destination) map.setBounds(bounds, 30, 30, 30, 30)
        return () => { lines.forEach(([l, f]) => { kakao.maps.event.removeListener(l, 'click', f); l.setMap(null) }); markers.forEach(m => m.setMap(null)) }
    }, [ready, candidates, selectedId, origin, destination, comparison])
    useEffect(() => {
        if (!ready || !instance.current || !position) return
        const { kakao, map } = instance.current, here = new kakao.maps.LatLng(position.lat, position.lng)
        const dot = document.createElement('span'); dot.setAttribute('aria-label', '현위치'); dot.className = markerStyles.currentDot
        const overlay = new kakao.maps.CustomOverlay({ map, position: here, content: dot, zIndex: 10 })
        const circle = Number.isFinite(position.accuracy) ? new kakao.maps.Circle({ map, center: here, radius: Math.min(position.accuracy, 200), strokeWeight: 1, strokeColor: '#1476e8', strokeOpacity: .3, fillColor: '#1476e8', fillOpacity: .08 }) : null
        if (follow) { map.setLevel(3); map.panTo(here) }
        return () => { overlay.setMap(null); circle?.setMap(null) }
    }, [ready, position, follow])
    useEffect(() => {
        if (!ready || !instance.current) return
        const { kakao, map } = instance.current, objects = []
        for (const [requested, snap] of [[origin, originSnap], [destination, destinationSnap]]) {
            if (!requested || !snap) continue
            const position = new kakao.maps.LatLng(snap.lat, snap.lng)
            const dot = document.createElement('span'); dot.title = '계산 경로의 도로 연결점'; dot.className = markerStyles.snapDot
            objects.push(new kakao.maps.CustomOverlay({ map, position, content: dot, zIndex: 6 }))
            objects.push(new kakao.maps.Polyline({ map, path: [new kakao.maps.LatLng(requested.lat, requested.lng), position], strokeStyle: 'dash', strokeColor: '#b94b15', strokeWeight: 2, zIndex: 6 }))
        }
        return () => objects.forEach(o => o.setMap(null))
    }, [ready, origin, destination, originSnap, destinationSnap])
    useEffect(() => {
        if (!ready || !instance.current || progress <= 0) return
        const chosen = candidates.find(c => c.candidate_id === selectedId)
        if (!chosen) return
        const { kakao, map } = instance.current, track = buildTrack(chosen.geometry), point = pointAt(track, progress)
        const coordinates = [...track.coordinates.slice(0, point.index), [point.lng, point.lat]]
        const line = new kakao.maps.Polyline({ map, path: coordinates.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng)), strokeWeight: 7, strokeColor: '#92b4ae', strokeOpacity: 1, zIndex: 5 })
        return () => line.setMap(null)
    }, [ready, candidates, selectedId, progress])
    useEffect(() => {
        if (!ready || !instance.current || !focusEvent) return
        const { kakao, map } = instance.current, path = focusEvent.geometry.coordinates.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng))
        const line = new kakao.maps.Polyline({ map, path, strokeWeight: 11, strokeColor: '#b94b15', strokeOpacity: .9, zIndex: 8 })
        const marker = new kakao.maps.Marker({ map, position: path[0], zIndex: 9 })
        map.setLevel(3); map.panTo(path[0])
        return () => { line.setMap(null); marker.setMap(null) }
    }, [ready, focusEvent])
    return <section aria-label="경로 지도" className={size ? `${styles.map} ${styles[size]}` : styles.map}>
        <div ref={container} className={styles.canvas} />
        {error && <p role="alert" className={styles.error}>{error}<br />아래 카드에서 계산된 경로 조건은 확인할 수 있습니다.</p>}
    </section>
}
