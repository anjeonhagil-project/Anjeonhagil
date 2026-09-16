// # 기능: NOTICE-001~002: 사용자 공지 목록/상세 HTTP req/res 처리
import * as noticesService from './notices.service.js'

export async function getNotices(req, res, next) {
    try {
        const notices = await noticesService.listPublishedNotices({
            page: req.query.page,
            limit: req.query.limit,
        })
        res.json({ success: true, data: notices })
    } catch (error) {
        next(error)
    }
}

export async function getNoticeById(req, res, next) {
    try {
        const notice = await noticesService.getPublishedNotice(req.params.noticeId)

        if (!notice) {
            const error = new Error('공지사항을 찾을 수 없습니다')
            error.status = 404
            error.code = 'NOTICE_NOT_FOUND'
            throw error
        }

        res.json({ success: true, data: notice })
    } catch (error) {
        next(error)
    }
}
