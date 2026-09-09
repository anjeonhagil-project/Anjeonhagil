// # 기능: Super Admin 관리자 목록/생성/역할·상태 변경 HTTP req/res 처리

import * as adminsService from './admins.service.js'


// 현재 로그인 관리자 조회
export async function getCurrentAdmin(req, res, next) {
    try {
        res.json({
            success: true,
            data: req.admin,
        })
    } catch (err) {
        next(err)
    }
}



// 관리자 목록 조회
export async function getAdmins(req, res, next) {
    try {
        const result = await adminsService.getAdmins()

        res.json({
            success: true,
            data: result,
        })
    } catch (err) {
        next(err)
    }
}


// 관리자 권한 부여
export async function grantAdmin(req, res, next) {
    try {
        const { adminId, role = 'admin' } = req.body

        const result = await adminsService.grantAdmin({
            adminId,
            role,
            grantedByAdminId: req.admin.id,
        })

        res.status(201).json({
            success: true,
            data: result,
        })
    } catch (err) {
        next(err)
    }
}


// 관리자 역할 / 활성 상태 변경
export async function updateAdmin(req, res, next) {
    try {
        const { adminId } = req.params
        const { role, isActive } = req.body

        const result = await adminsService.modifyAdmin({
            adminId,
            role,
            isActive,
            grantedByAdminId: req.admin.id,
        })

        res.json({
            success: true,
            data: result,
        })
    } catch (err) {
        next(err)
    }
}


// 관리자 권한 회수
export async function revokeAdmin(req, res, next) {
    try {
        const result = await adminsService.revokeAdmin(
            req.params.adminId
        )

        res.json({
            success: true,
            data: result,
        })
    } catch (err) {
        next(err)
    }
}