// Display-only helpers. Never feed rounded values back into profile/model inputs.
export function burdenComparison(a,b){
    if(![a,b].every(v=>Number.isFinite(v)&&v>=0))return {valid:false,summary:'부담 지표를 확인할 수 없어요.',widths:[0,0]}
    const max=Math.max(a,b),gap=Math.abs(a-b),widths=max?[a/max*100,b/max*100]:[0,0]
    if(gap===0)return {valid:true,summary:max?'두 경로의 부담 지표가 같아요.':'두 경로 모두 해당 부담 지표 0',widths}
    const percent=gap/max*100,lower=a<b?'A':'B',higher=a>b?'A':'B'
    const reduction=percent<0.1?'0.1% 미만':percent>=99.95&&percent<100?'99.9%':`${Number(percent.toFixed(1))}%`
    return {valid:true,summary:`경로 ${lower} · ${higher}보다 부담 지표 ${reduction} 적음`,widths}
}
export function exactDuration(seconds){
    const s=Math.round(seconds)
    return s<60?`${s}초`:`${Math.floor(s/60)}분${s%60?` ${s%60}초`:''}`
}
export function metricNumber(value){return Number(value).toLocaleString('ko-KR',value>0&&value<0.01?{maximumSignificantDigits:2}:{maximumFractionDigits:2})}
