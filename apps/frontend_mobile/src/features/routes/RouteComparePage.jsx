// 검색·실제 노출·명시적 최종 선택을 구분하며 새로고침 때 저장된 검색을 복구한다.
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import Header from '../../components/layout/Header.jsx'
import RouteMap from '../../components/map/RouteMap.jsx'
import RouteCandidateCard, { ROUTE_LABELS, durationLabel, distanceLabel } from './RouteCandidateCard.jsx'
import { searchRoutes, getSearch, recordRouteChoice } from './api.js'
import { useRouteExposure } from './useRouteExposure.js'
import BurdenTimeline from './BurdenTimeline.jsx'
import './serviceRoutes.css'
import './journey.css'

export default function RouteComparePage() {
    const location = useLocation(), navigate = useNavigate(), [params, setParams] = useSearchParams()
    const inputRef = useRef(null), promiseRef = useRef(null), choiceRef = useRef(crypto.randomUUID()), interaction = useRef({ selectionSource: null, selectionChanges: 0 }), frozenChoice = useRef(null), abortRef = useRef(null), cleanupRef = useRef(null)
    const [result, setResult] = useState(null), [selected, setSelected] = useState(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [chosen, setChosen] = useState(false), [attempt, setAttempt] = useState(0)
    
    useEffect(() => {
        clearTimeout(cleanupRef.current)

        let active = true
        const savedId = params.get('search')
        if (!inputRef.current && location.state?.origin && location.state?.destination){
            inputRef.current = {
                searchId: crypto.randomUUID(),
                origin: location.state.origin,
                destination: location.state.destination,
                departureAt: location.state.departureAt || new Date().toISOString()
            }
        }

        if (!savedId && !inputRef.current){
            navigate('/search', { replace: true })
            return
        }

        setLoading(true)
        setError('')

        if (!promiseRef.current){
            abortRef.current = new AbortController();
            promiseRef.current = savedId ? getSearch(savedId) : searchRoutes(inputRef.current, { signal: abortRef.current.signal })
        }

        promiseRef.current.then(data => {
            if (!active) return

            // 경로 탐색 시 내게 편한 길 최상단으로 노출
            // (백엔드 수정보다 프론트에서 순서를 바꿔서 노출하도록 수정함)
            const order = ['PERSONALIZED', 'SHORTEST_TIME', 'SHORTEST_DISTANCE']
            const rank = (c) => Math.min(...c.route_types.map((t) => {
                const i = order.indexOf(t)
                return i === -1 ? order.length : i
            }))
            setResult({ ...data, candidates: [...data.candidates].sort((a, b) => rank(a) - rank(b)) })
            setChosen(!!data.selectedCandidateId)

            if (!savedId) setParams({ search: data.searchId }, { replace: true })
        }).catch(e => { if (active) setError(e.message) }).finally(() => active && setLoading(false))
        
            return () => {
                active = false
                cleanupRef.current = setTimeout(() => abortRef.current?.abort(), 0)
            }
    }, [attempt])

    const exposure = useRouteExposure(
        { searchId: result?.searchId, candidateIds: result?.candidates.map(c => c.candidate_id), recommendedCandidateId: result?.recommendedCandidateId, enabled: !!result && !loading && !chosen }
    )

    async function choose() {
        if (!selected || !exposure.hasSeen(selected) || saving) return
        setSaving(true); setError('')
        try {
            if (!frozenChoice.current) {
                frozenChoice.current = { selected, exposure: await exposure.record(interaction.current) }
                await recordRouteChoice(frozenChoice.current.exposure.exposureId, { choiceEventId: choiceRef.current, selectedCandidateId: frozenChoice.current.selected })
                setChosen(true)
            }
        } catch (e) {
            setError(e.message)
        } finally {
            setSaving(false)
        }}

    const [expanded, setExpanded] = useState(true)
    const [focusEvent, setFocusEvent] = useState(null)
    function select(id, source) {
            if (saving || frozenChoice.current) return

            interaction.current = { selectionSource: source, selectionChanges: interaction.current.selectionChanges + (selected && selected !== id ? 1 : 0) }

            setSelected(id); setFocusEvent(null)
            setExpanded(true)
            
            if (source === 'map') {
                requestAnimationFrame(() => document.querySelector(`[data-candidate-id="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
            }
        }

    const selectedCard = result?.candidates.find(c => c.candidate_id === selected)

    return (
        <main className="service-page compare-page journey-wide">
            <Header title={chosen ? '선택한 경로' : '경로 비교'} onBack={() => navigate('/search')} />
            <div className="service-content compare-layout">
                {loading && <section className="route-loading" role="status">
                    <span className="route-spinner" />
                    <h2>내게 맞는 길을 찾고 있어요</h2>
                    <p>도로 연결과 운전 부담을 계산합니다.<br />
                    계산은 약 5~30초, 요청이 많으면 대기 시간이 더 걸릴 수 있어요.</p>
                    <button className="route-cancel" onClick={() => { abortRef.current?.abort(); navigate('/search') }}>검색 취소</button>
                </section>}

                {error && <section role="alert" className="service-error">{error}<button onClick={() => { if (result && !loading) { choose(); return } promiseRef.current = null; setAttempt(v => v + 1) }}>{result && !loading ? '선택 저장 다시 시도' : '다시 시도'}</button></section>}

                {result && !loading && <>
                    <div className="compare-map"><RouteMap originSnap={result.originSnap} destinationSnap={result.destinationSnap} focusEvent={focusEvent} candidates={result.candidates} selectedId={selected} onSelect={chosen ? undefined : id => select(id, 'map')} origin={result.origin} destination={result.destination} height="100%" /></div>
                    <section className={'compare-panel' + (expanded ? '' : ' collapsed')}>
                        <button className="compare-toggle" aria-expanded={expanded} onClick={() => setExpanded(v => !v)}>{expanded ? '▼ 경로 정보 접기' : '▲ 경로 정보 펼치기'}</button>
                        
                        <p className="route-endpoints">{result.origin.name || '출발지'} → {result.destination.name || '도착지'}</p>
                        <div className="compare-details hide-scrollbar" hidden={!expanded}>
                            {result.q4?.applied && <p className="service-note">{result.q4.changed ? '추천 평가가 비슷한 후보 중 시간·거리 설문 응답을 참고해 골랐어요.' : '시간·거리 설문 응답을 참고했으며 기존 추천을 유지했어요.'}</p>}
                            {result.candidates.length === 1 && <p>세 기준에서 같은 경로가 선정되어 하나로 표시합니다.</p>}
                            <div className="route-list">{result.candidates.filter(c => !chosen || c.candidate_id === selected).map(c => <RouteCandidateCard key={c.candidate_id} cardRef={node => exposure.register(c.candidate_id, node)} candidate={c} candidates={result.candidates} weights={result.profile?.effective_weights} selected={c.candidate_id === selected} recommended={c.candidate_id === result.recommendedCandidateId} recommendationMethod={result.recommendationMethod} q4={result.q4} onSelect={() => !chosen && select(c.candidate_id, 'card')} />)}</div>
                            {exposure.error && <p role="alert">{exposure.error} <button onClick={exposure.retry}>기록 다시 시도</button></p>}
                            {selectedCard && <BurdenTimeline key={selected} candidate={selectedCard} onFocus={e => { setFocusEvent(e); document.querySelector('.compare-map')?.scrollIntoView({ block: 'start', behavior: 'smooth' }) }} />}
                        </div>
                        <div className="compare-footer">{!chosen ? <><button className="service-primary" disabled={!selected || !exposure.hasSeen(selected) || saving} onClick={choose}>{saving ? '저장 중…' : '이 경로 선택하기'}</button></> : <section className="route-success" role="status"><h2>경로 선택을 저장했어요</h2><p>선택한 경로로 GPS 안내 또는 시뮬레이션을 시작하세요.</p><button className="service-primary" onClick={() => navigate('/navigation?search=' + result.searchId)}>이 경로 안내 시작</button></section>}</div>
                    </section>
                </>}
            </div>
        </main>
    )
}
