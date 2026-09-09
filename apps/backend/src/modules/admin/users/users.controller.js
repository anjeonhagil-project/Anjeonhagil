// # 기능: ADM-USER: 회원 목록/상세 HTTP req/res 처리

import * as usersService from './users.service.js'


// query string의 boolean 값을 실제 boolean으로 변환
function parseBoolean(value) {
    if (value === undefined || value === '') {
        return undefined
    }

    if (value === 'true') {
        return true
    }

    if (value === 'false') {
        return false
    }

    const err = new Error(
        'isActive는 true 또는 false여야 합니다'
    )
    err.status = 400
    throw err
}


// page / limit 값을 양의 정수로 변환
function parsePositiveInteger(
    value,
    defaultValue,
    fieldName
) {
    if (value === undefined || value === '') {
        return defaultValue
    }

    const parsed = Number(value)

    if (!Number.isInteger(parsed) || parsed < 1) {
        const err = new Error(
            `${fieldName}는 1 이상의 정수여야 합니다`
        )
        err.status = 400
        throw err
    }

    return parsed
}


// 정렬 기준 검증
function parseSortBy(value) {
    if (value === undefined || value === '') {
        return 'createdAt'
    }

    const allowedSortBy = [
        'createdAt',
        'username',
        'email',
        'isActive',
        'signupProvider',
    ]

    if (!allowedSortBy.includes(value)) {
        const err = new Error(
            'sortBy는 createdAt, username, email, isActive, signupProvider 중 하나여야 합니다'
        )
        err.status = 400
        throw err
    }

    return value
}


// 정렬 방향 검증
function parseSortOrder(value) {
    if (value === undefined || value === '') {
        return 'desc'
    }

    if (
        value !== 'asc' &&
        value !== 'desc'
    ) {
        const err = new Error(
            'sortOrder는 asc 또는 desc여야 합니다'
        )
        err.status = 400
        throw err
    }

    return value
}


// 회원 목록 조회
export async function getUsers(req, res, next) {
    try {
        const result = await usersService.getUsers({
            search:
                req.query.search?.trim() ||
                undefined,

            isActive: parseBoolean(
                req.query.isActive
            ),

            signupProvider:
                req.query.signupProvider?.trim() ||
                undefined,

            page: parsePositiveInteger(
                req.query.page,
                1,
                'page'
            ),

            limit: parsePositiveInteger(
                req.query.limit,
                10,
                'limit'
            ),

            sortBy: parseSortBy(
                req.query.sortBy
            ),

            sortOrder: parseSortOrder(
                req.query.sortOrder
            ),
        })

        res.json({
            success: true,
            data: result,
        })
    } catch (err) {
        next(err)
    }
}


// 회원 상세 조회
export async function getUserById(
    req,
    res,
    next
) {
    try {
        const result =
            await usersService.getUserById(
                req.params.userId
            )

        res.json({
            success: true,
            data: result,
        })
    } catch (err) {
        next(err)
    }
}