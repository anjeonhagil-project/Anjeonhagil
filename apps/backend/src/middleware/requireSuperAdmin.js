// # 기능: role=super_admin endpoint만 통과

export function requireSuperAdmin(req, res, next) {
    // requireAdmin middleware를 먼저 통과했는지 확인
    if (!req.admin) {
        return res.status(403).json({
            success: false,
            error: {
                message: '관리자 권한이 없습니다',
            },
        })
    }

    // 슈퍼관리자 권한 확인
    if (req.admin.role !== 'super_admin') {
        return res.status(403).json({
            success: false,
            error: {
                message: '슈퍼관리자 권한이 필요합니다',
            },
        })
    }

    next()
}