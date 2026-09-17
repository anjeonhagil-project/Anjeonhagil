// Pure route projection and GPS quality rules; meters are geometric, ETA is historical.
const R=6371000,rad=Math.PI/180
export function distance(a,b){
    const x=(b[0]-a[0])*rad*Math.cos((a[1]+b[1])/2*rad),y=(b[1]-a[1])*rad
    return Math.hypot(x,y)*R
}
export function buildTrack(geometry,steps=[]){
    const coordinates=geometry?.coordinates
    if(!Array.isArray(coordinates)||coordinates.length<2||coordinates.some(p=>p.length<2||!p.every(Number.isFinite)||Math.abs(p[0])>180||Math.abs(p[1])>90))throw new Error('안내할 경로 좌표가 올바르지 않습니다.')
    const cumulative=[0]
    for(let i=1;i<coordinates.length;i++)cumulative.push(cumulative[i-1]+distance(coordinates[i-1],coordinates[i]))
    const total=cumulative.at(-1)
    if(total<1)throw new Error('안내할 경로가 너무 짧습니다.')
    return {coordinates,cumulative,total,steps:steps.map((s,i)=>({...s,id:i,at:cumulative[s.coordinate_index]})).filter(s=>Number.isFinite(s.at))}
}
export function pointAt(track,meters){
    const m=Math.max(0,Math.min(track.total,meters))
    let i=1
    while(i<track.cumulative.length-1&&track.cumulative[i]<m)i++
    const a=track.coordinates[i-1],b=track.coordinates[i],length=track.cumulative[i]-track.cumulative[i-1]
    const f=length?(m-track.cumulative[i-1])/length:0
    return {lng:a[0]+(b[0]-a[0])*f,lat:a[1]+(b[1]-a[1])*f,index:i}
}
export function projectPosition(track,fix,previous=null){
    const p=[fix.lng,fix.lat],scaleX=R*rad*Math.cos(fix.lat*rad),scaleY=R*rad
    let best=null
    for(let i=1;i<track.coordinates.length;i++){
        const a=track.coordinates[i-1],b=track.coordinates[i]
        const dx=(b[0]-a[0])*scaleX,dy=(b[1]-a[1])*scaleY,length2=dx*dx+dy*dy
        if(length2<.001)continue
        const t=Math.max(0,Math.min(1,((p[0]-a[0])*scaleX*dx+(p[1]-a[1])*scaleY*dy)/length2))
        const lng=a[0]+t*(b[0]-a[0]),lat=a[1]+t*(b[1]-a[1]),offset=distance(p,[lng,lat])
        const progress=track.cumulative[i-1]+t*(track.cumulative[i]-track.cumulative[i-1])
        // Penalize backwards travel/jumps at crossing and parallel roads.
        const delta=previous?progress-previous.progress:0
        const elapsed=previous?Math.max(0,(fix.timestamp-previous.timestamp)/1000):0
        const plausible=previous?Math.max(60,elapsed*45):Infinity
        const jump=previous&&Math.abs(delta)>plausible
        const bearing=(Math.atan2(dx,dy)/rad+360)%360
        const headingDifference=Number.isFinite(fix.heading)&&fix.speed>2?Math.abs((bearing-fix.heading+540)%360-180):0
        const headingPenalty=headingDifference/4
        const score=offset+headingPenalty+(jump?100+Math.abs(delta)*.2:0)+(delta< -30?30:0)
        if(!best||score<best.score)best={lng,lat,progress,offset,score,index:i,timestamp:fix.timestamp,jump,headingDifference}
    }
    return best
}
export function validFix(fix,now=Date.now()){
    return !!fix&&Number.isFinite(fix.lng)&&Math.abs(fix.lng)<=180&&Number.isFinite(fix.lat)&&Math.abs(fix.lat)<=90&&Number.isFinite(fix.accuracy)&&fix.accuracy>=0&&fix.accuracy<=35&&Number.isFinite(fix.timestamp)&&now-fix.timestamp<=12000&&fix.timestamp<=now+1000
}
export function advanceGps(track,fix,state={},now=Date.now()){
    if(!validFix(fix,now))return {...state,fix,status:'weak',offCount:0,arrivalCount:0}
    if(state.lastTimestamp&&fix.timestamp<=state.lastTimestamp)return state
    const match=projectPosition(track,fix,state.match)
    const offCount=match.offset>Math.max(35,fix.accuracy*1.5)||match.headingDifference>110?(state.offCount||0)+1:0
    if(offCount)return {...state,fix,lastTimestamp:fix.timestamp,offCount,arrivalCount:0,status:offCount>=3?'offroute':'checking'}
    if(match.jump)return {...state,fix,lastTimestamp:fix.timestamp,offCount:0,arrivalCount:0,status:'checking'}
    const remaining=track.total-match.progress
    const arrivalCount=remaining<25&&distance([fix.lng,fix.lat],track.coordinates.at(-1))<25?(state.arrivalCount||0)+1:0
    return {fix,match,lastTimestamp:fix.timestamp,offCount:0,arrivalCount,status:arrivalCount>=3?'arrived':'tracking'}
}
