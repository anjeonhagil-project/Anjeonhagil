// Q4 초기 선호와 실제 선택 기반 행동 보정을 구분해 표시한다.
import {useEffect,useState} from 'react'
import {apiClient} from '../../lib/apiClient.js'
const labels={accept_both:'두 예시에서 부담 감소를 선택했어요',prefer_shorter:'두 예시에서 짧은 이동을 선택했어요',accept_small:'작은 증가 예시에서만 부담 감소를 선택했어요',inconsistent:'예시별 선택이 달라 기본 기준을 유지해요',unconfirmed:'판단 보류가 있어 기본 기준을 유지해요',no_reference:'비교할 부담 순위를 먼저 선택해주세요'}
export default function Q4PreferenceSummary({value}){
    const [loaded,setLoaded]=useState(null),[error,setError]=useState('')
    useEffect(()=>{if(value!==undefined)return;let active=true;apiClient.get('/driving-preferences/personalization').then(r=>active&&setLoaded(r.q4)).catch(e=>active&&setError(e.message));return ()=>{active=false}},[value])
    const q4=value??loaded
    return <section className="q4-summary" style={{background:'#edf6f5',borderRadius:14,padding:16,margin:'16px 0',fontSize:13,lineHeight:1.65}}>
        <h3 style={{fontSize:16,margin:'0 0 10px'}}>시간·거리 선호</h3>
        {error&&<p role="alert">{error}</p>}
        {!q4&&!error&&<p role="status">설문 결과를 불러오고 있어요…</p>}
        {q4&&<>{q4.status==='INCOMPLETE'?<p>현재 부담 설정에 맞는 경로 비교 설문을 진행해주세요.</p>:<>
            <p>시간 · {labels[q4.axes?.TIME?.state]??'기본 기준 유지'}</p><p>거리 · {labels[q4.axes?.DISTANCE?.state]??'기본 기준 유지'}</p>
            <p>{!q4.enabled?'시간·거리 선호 반영을 껐어요.':q4.applicable?'추천 평가가 비슷한 후보에서 보조 기준으로 반영해요.':'현재 응답에서는 공통 추천 기준을 유지해요.'}</p>
        </>}{q4.pending&&<p>진행 중인 설문이 있습니다. 기존 완료 결과는 유지됩니다.</p>}{q4.training&&<p role="status">{q4.training.status==='TRIAL_ONLY'?'새 답변을 저장했습니다. 시간·거리 선호는 모델 검증 후 추천에 반영할 예정입니다.':'답변은 저장했습니다. 아직 선호를 확정하기 어려워 기본 기준을 유지합니다.'}</p>}<p className="service-note">정확한 우회 허용시간·거리로 해석하지 않습니다. 새 설문은 모델 학습 준비용이며 실제 이용 건수에 포함되지 않습니다.</p></>}
    </section>
}
