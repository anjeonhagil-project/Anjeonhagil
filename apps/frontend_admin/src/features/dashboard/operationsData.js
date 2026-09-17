export function normalizeOperationsData(kind,value){
    if(kind==='datasets'){
        if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('데이터·모델 응답 형식을 확인할 수 없습니다. 새로고침해주세요.')
        if(!Array.isArray(value.releases))throw new Error('도로 데이터 목록을 불러오지 못했습니다. 새로고침해주세요.')
        if(!Array.isArray(value.models))throw new Error('추천 모델 목록을 불러오지 못했습니다. 새로고침해주세요.')
        return value
    }
    if(!Array.isArray(value))throw new Error('경로 기록 목록을 불러오지 못했습니다. 새로고침해주세요.')
    return value
}
