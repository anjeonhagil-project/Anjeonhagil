// # 기능: 공통 {success:false,error:{...}} envelope로 오류 반환
export function errorHandler(err, req, res, next) {
    console.error(err)
    const status = err.status || 500
    res.status(status).json({
        success: false,
        error: { message: err.message || 'Internal Server Error' },
    })
}
