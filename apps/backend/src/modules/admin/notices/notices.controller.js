// # 기능: ADM-NOTICE 공지사항 목록/상세/등록/수정/삭제 HTTP req/res 처리

import * as noticesService from './notices.service.js'


// 공지사항 목록 조회
export async function getNotices(req, res, next) {
    try {
        const result = await noticesService.listNotices({
            search:
                req.query.search?.trim() ||
                '',

            isPublished:
                req.query.isPublished,

            page:
                req.query.page ||
                1,

            limit:
                req.query.limit ||
                10,

            sortBy:
                req.query.sortBy ||
                'createdAt',

            sortOrder:
                req.query.sortOrder ||
                'desc',
        })

        res.json({
            success: true,
            data: result,
        })
    } catch (err) {
        next(err)
    }
}


// 공지사항 상세 조회
export async function getNoticeById(
    req,
    res,
    next
) {
    try {
        const result =
            await noticesService.getNotice(
                req.params.noticeId
            )

        if (!result) {
            const error = new Error(
                '공지사항을 찾을 수 없습니다.'
            )

            error.status = 404
            error.code = 'NOTICE_NOT_FOUND'

            throw error
        }

        res.json({
            success: true,
            data: result,
        })
    } catch (err) {
        next(err)
    }
}


// 공지사항 등록
export async function createNotice(
    req,
    res,
    next
) {
    try {
        const {
            title,
            content,
            isPublished = false,
        } = req.body

        const result =
            await noticesService.addNotice({
                title,
                content,
                isPublished,

                // requireAdmin에서 저장한 현재 관리자 ID
                createdBy: req.admin.id,
            })

        res.status(201).json({
            success: true,
            data: result,
        })
    } catch (err) {
        next(err)
    }
}


// 공지사항 수정
export async function updateNotice(
    req,
    res,
    next
) {
    try {
        const {
            title,
            content,
            isPublished,
        } = req.body

        const result =
            await noticesService.editNotice(
                req.params.noticeId,
                {
                    title,
                    content,
                    isPublished,
                }
            )

        if (!result) {
            const error = new Error(
                '공지사항을 찾을 수 없습니다.'
            )

            error.status = 404
            error.code = 'NOTICE_NOT_FOUND'

            throw error
        }

        res.json({
            success: true,
            data: result,
        })
    } catch (err) {
        next(err)
    }
}


// 공지사항 삭제
export async function deleteNotice(
    req,
    res,
    next
) {
    try {
        const result =
            await noticesService.removeNotice(
                req.params.noticeId
            )

        if (!result) {
            const error = new Error(
                '공지사항을 찾을 수 없습니다.'
            )

            error.status = 404
            error.code = 'NOTICE_NOT_FOUND'

            throw error
        }

        res.json({
            success: true,
            data: result,
        })
    } catch (err) {
        next(err)
    }
}