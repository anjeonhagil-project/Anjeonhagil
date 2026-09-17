// # 기능: 공통 {success:false,error:{...}} envelope로 오류 반환
export function errorHandler(err, req, res, next) {
    const status = err.status || (err.code==='P0001'?409:500)
    console.error('[api]',req.method,req.path,'status='+status,'code='+(err.code||'INTERNAL_ERROR'))
    res.status(status).json({
        success: false,
        error: {
            ...(err.code ? { code: err.code } : {}),
            message: status>=500&&!err.expose ? '요청을 처리하지 못했습니다. 서버 실행 상태를 확인하고 다시 시도해주세요.' : (err.message || '요청 내용을 확인해주세요.'),
        },
    })
}
