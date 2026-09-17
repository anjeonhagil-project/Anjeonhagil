// 서버가 저장한 검색·실제 노출·최종 선택 API. 재시도는 같은 이벤트 ID를 사용한다.
import { apiClient } from '../../lib/apiClient.js'
export const searchRoutes=(input,options)=>apiClient.post('/routes/searches',input,options)
export const getSearch=id=>apiClient.get('/routes/searches/'+id)
export const getHistory=()=>apiClient.get('/routes/searches')
export const recordRouteExposure=(id,input)=>apiClient.post('/routes/searches/'+id+'/exposures',input)
export const recordRouteChoice=(id,input)=>apiClient.post('/routes/exposures/'+id+'/choices',input)
