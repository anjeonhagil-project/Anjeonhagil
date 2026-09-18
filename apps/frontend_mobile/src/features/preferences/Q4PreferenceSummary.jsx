// Q4 초기 선호와 실제 선택 기반 행동 보정을 구분해 표시한다.
import {useEffect,useState} from 'react'
import {apiClient} from '../../lib/apiClient.js'
import styles from './Q4PreferenceSummary.module.css'

const labels={accept_both:'두 예시에서 부담 감소를 선택했어요',prefer_shorter:'두 예시에서 짧은 이동을 선택했어요',accept_small:'작은 증가 예시에서만 부담 감소를 선택했어요',inconsistent:'예시별 선택이 달라 기본 기준을 유지해요',unconfirmed:'판단 보류가 있어 기본 기준을 유지해요',no_reference:'비교할 부담 순위를 먼저 선택해주세요'}
export default function Q4PreferenceSummary({value}){
    const [loaded,setLoaded]=useState(null),[error,setError]=useState('')
    useEffect(()=>{if(value!==undefined)return;let active=true;apiClient.get('/driving-preferences/personalization').then(r=>active&&setLoaded(r.q4)).catch(e=>active&&setError(e.message));return ()=>{active=false}},[value])
    const q4=value??loaded
    return <section className={styles.summary} data-testid="q4-summary">
        <h3 className={styles.title}>시간·거리 선호</h3>
        {error&&<p role="alert">{error}</p>}
        {!q4&&!error&&<p role="status">설문 결과를 불러오고 있어요…</p>}
        {q4&&<>{q4.status==='INCOMPLETE'?<p>경로 비교 설문을 완료하면 첫 추천부터 참고합니다.</p>:<>
            <p>시간 · {labels[q4.axes?.TIME?.state]??'기본 기준 유지'}</p><p>거리 · {labels[q4.axes?.DISTANCE?.state]??'기본 기준 유지'}</p>
            <p>{!q4.enabled?'시간·거리 선호 반영을 껐어요.':q4.applicable?'추천 평가가 비슷한 후보에서 보조 기준으로 반영해요.':'현재 응답에서는 공통 추천 기준을 유지해요.'}</p>
        </>}</>}
    </section>
}
