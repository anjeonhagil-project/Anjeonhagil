// 한국 시간의 오늘/이번 달/올해를 UTC 반개구간으로 변환한다. 날짜 경계 중복 집계를 막는다.
export function usageBuckets(period,now=new Date()){
    if(!['today','month','year'].includes(period))throw new Error('INVALID_PERIOD')
    const local=new Date(now.getTime()+9*3600000),year=local.getUTCFullYear(),month=local.getUTCMonth(),day=local.getUTCDate()
    const stamp=(m,d,h=0)=>new Date(Date.UTC(year,m,d,h)-9*3600000).toISOString()
    const count=period==='today'?12:period==='year'?12:new Date(Date.UTC(year,month+1,0)).getUTCDate()
    return Array.from({length:count},(_,i)=>period==='today'?{label:`${String(i*2).padStart(2,'0')}~${String(i*2+2).padStart(2,'0')}`,start:stamp(month,day,i*2),end:stamp(month,day,i*2+2)}:period==='year'?{label:`${i+1}월`,start:stamp(i,1),end:stamp(i+1,1)}:{label:`${i+1}일`,start:stamp(month,i+1),end:stamp(month,i+2)})
}
