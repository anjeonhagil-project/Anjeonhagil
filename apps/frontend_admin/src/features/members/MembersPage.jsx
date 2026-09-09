import { useEffect, useState } from 'react'

import { getMembers,getMemberById } from './api.js'

import MemberDetailModal from './components/MemberDetailModal.jsx'

import { getCurrentAdmin } from '../auth/api.js'

import MemberPermissionModal from './components/MemberPermissionModal.jsx'

import styles from './MembersPage.module.css'


export default function MembersPage() {
    const [members, setMembers] = useState([])
    const [pagination, setPagination] = useState(null)

    // 관리자 확인
    const [currentAdmin, setCurrentAdmin] = useState(null)

    const [searchInput, setSearchInput] = useState('')
    const [search, setSearch] = useState('')

    // 페이지네이션
    const [page, setPage] = useState(1)
    const limit = 10

    // 정렬
    const [sortBy, setSortBy] = useState('createdAt')
    const [sortOrder, setSortOrder] = useState('desc')

    const [isLoading, setIsLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')

    const [selectedMember, setSelectedMember] = useState(null)
    const [isDetailLoading, setIsDetailLoading] = useState(false)
    const [detailError, setDetailError] = useState('')

    const [isDetailOpen, setIsDetailOpen] = useState(false)
    const [isPermissionOpen, setIsPermissionOpen] = useState(false)

    // 슈퍼관리자
    const canManageAdmins = currentAdmin?.role === 'super_admin'

    // 회원 목록 조회
    useEffect(() => {
        async function loadMembers() {
            try {
                setIsLoading(true)
                setErrorMessage('')

                const response = await getMembers({
                    search,
                    page,
                    limit,
                    sortBy,
                    sortOrder,
                })

                setMembers(response.data.items)
                setPagination(response.data.pagination)
            } catch (error) {
                console.error(
                    '회원 목록 조회 실패:',
                    error
                )

                setErrorMessage(
                    '회원 목록을 불러오지 못했습니다.'
                )
            } finally {
                setIsLoading(false)
            }
        }

        loadMembers()
    }, [search, page, sortBy, sortOrder])

    // 현재 관리자 정보 조회
    useEffect(() => {
        async function loadCurrentAdmin() {
            try {
                const response = await getCurrentAdmin()
                setCurrentAdmin(response.data)
            } catch (error) {
                console.error('현재 관리자 정보 조회 실패:', error)
            }
        }

        loadCurrentAdmin()
    }, [])


    // 검색 실행
    function handleSearchSubmit(event) {
        event.preventDefault()

        // 새로운 검색을 하면 항상 1페이지부터 조회
        setPage(1)
        setSearch(searchInput.trim())
    }

    function handleSortByChange(event) {
        setPage(1)
        setSortBy(event.target.value)
    }

    function handleSortOrderChange(event){
        setPage(1)
        setSortOrder(event.target.value)
    }


    // 페이지 이동
    function handlePageChange(nextPage) {
        if (!pagination) {
            return
        }

        if (
            nextPage < 1 ||
            nextPage > pagination.totalPages
        ) {
            return
        }

        setPage(nextPage)
    }


    // 권한 표시 이름
    function getRoleLabel(role) {
        if (role === 'super_admin') {
            return '최고 관리자'
        }

        if (role === 'admin') {
            return '관리자'
        }

        return '일반 회원'
    }


    // 권한 Badge 스타일
    function getRoleBadgeClass(role) {
        if (role === 'super_admin') {
            return styles.superAdminBadge
        }

        if (role === 'admin') {
            return styles.adminBadge
        }

        return styles.userBadge
    }

    // 회원 상세 조회
    async function handleMemberClick(userId) {
        try {
            setIsDetailOpen(true)
            setIsDetailLoading(true)
            setDetailError('')
            setSelectedMember(null)

            const response = await getMemberById(userId)
            setSelectedMember(response.data)
        } catch (error) {
            console.error('회원 상세 조회 실패:', error)
            setDetailError('회원 상세 정보를 불러오지 못했습니다.')
        } finally {
            setIsDetailLoading(false)
        }
    }

    function handleDetailClose() {
        setIsDetailOpen(false)
        setSelectedMember(null)
        setDetailError('')
    }

    function handleEditPermission() {
        setIsDetailOpen(false)
        setIsPermissionOpen(true)
    }

    function handlePermissionClose() {
        setIsPermissionOpen(false)
    }

    function handlePermissionSubmit(selectedRole) {
        console.log('변경할 권한:', selectedRole)
    }


    return (
        <section className={styles.page}>
            {/* 페이지 상단 */}
            <div className={styles.pageHeader}>
                <div className={styles.titleArea}>
                    <h2 className={styles.title}>
                        회원 관리
                    </h2>

                    <p className={styles.description}>
                        서비스에 가입된 회원 정보를 조회하고
                        관리합니다.
                    </p>
                </div>

                <div className={styles.memberCount}>
                    전체 회원
                    <strong>
                        {pagination?.total ?? 0}
                    </strong>
                    명
                </div>
            </div>


            {/* 검색 영역 */}
            <div className={styles.toolbar}>
                <form
                    className={styles.searchArea}
                    onSubmit={handleSearchSubmit}
                >
                    <input
                        type="search"
                        className={styles.searchInput}
                        value={searchInput}
                        onChange={(event) =>
                            setSearchInput(
                                event.target.value
                            )
                        }
                        placeholder="아이디, 닉네임, 또는 이메일을 입력해주세요."
                    />

                    <button
                        type="submit"
                        className={styles.searchButton}
                    >
                        검색
                    </button>
                </form>

                {/* 정렬 */}
                <div className={styles.searchArea}>
                    <select
                        className={styles.select}
                        value={sortBy}
                        onChange={handleSortByChange}
                        aria-label="회원 정렬 기준"
                    >
                        <option value="createdAt">
                            가입일
                        </option>

                        <option value="username">
                            아이디
                        </option>

                        <option value="email">
                            이메일
                        </option>

                        <option value="isActive">
                            회원 상태
                        </option>

                        <option value="signupProvider">
                            가입 유형
                        </option>
                    </select>

                    <select
                        className={styles.select}
                        value={sortOrder}
                        onChange={handleSortOrderChange}
                        aria-label="정렬 방향"
                    >
                        <option value="desc">
                            내림차순
                        </option>

                        <option value="asc">
                            오름차순
                        </option>
                    </select>
                </div>
            </div>


            {/* 회원 목록 */}
            <div className={styles.tableCard}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>아이디</th>
                            <th>이메일</th>
                            <th>닉네임</th>
                            <th>가입 유형</th>
                            <th>회원 상태</th>
                            <th>권한</th>
                            <th>가입일</th>
                        </tr>
                    </thead>

                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td
                                    colSpan="7"
                                    className={styles.emptyCell}
                                >
                                    회원 목록을 불러오는 중입니다...
                                </td>
                            </tr>
                        ) : errorMessage ? (
                            <tr>
                                <td
                                    colSpan="7"
                                    className={styles.emptyCell}
                                >
                                    {errorMessage}
                                </td>
                            </tr>
                        ) : members.length === 0 ? (
                            <tr>
                                <td
                                    colSpan="7"
                                    className={styles.emptyCell}
                                >
                                    조회된 회원이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            members.map((member) => (
                                <tr
                                    key={member.userId}
                                    className={styles.clickableRow}
                                    onClick={() => handleMemberClick(member.userId)}
                                >
                                    <td>
                                        {member.username ?? '-'}
                                    </td>

                                    <td>
                                        {member.email ?? '-'}
                                    </td>

                                    <td>
                                        {member.nickname ?? '-'}
                                    </td>

                                    <td>
                                        {member.signupProvider ?? '-'}
                                    </td>

                                    <td>
                                        <span
                                            className={[
                                                styles.badge,
                                                member.isActive
                                                    ? styles.activeBadge
                                                    : styles.inactiveBadge,
                                            ].join(' ')}
                                        >
                                            {member.isActive
                                                ? '활성'
                                                : '탈퇴'}
                                        </span>
                                    </td>

                                    <td>
                                        <span
                                            className={[
                                                styles.badge,
                                                getRoleBadgeClass(
                                                    member.role
                                                ),
                                            ].join(' ')}
                                        >
                                            {getRoleLabel(
                                                member.role
                                            )}
                                        </span>
                                    </td>

                                    <td>
                                        {member.createdAt
                                            ? new Date(
                                                  member.createdAt
                                              ).toLocaleDateString(
                                                  'ko-KR'
                                              )
                                            : '-'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>


                {/* 페이지네이션 */}
                {pagination &&
                    pagination.totalPages > 1 && (
                        <div
                            className={
                                styles.paginationArea
                            }
                        >
                            {/* 이전 */}
                            <button
                                type="button"
                                className={
                                    styles.pageButton
                                }
                                disabled={page === 1}
                                onClick={() =>
                                    handlePageChange(
                                        page - 1
                                    )
                                }
                            >
                                이전
                            </button>


                            {/* 페이지 번호 */}
                            {Array.from(
                                {
                                    length:
                                        pagination.totalPages,
                                },
                                (_, index) =>
                                    index + 1
                            ).map((pageNumber) => (
                                <button
                                    key={pageNumber}
                                    type="button"
                                    className={[
                                        styles.pageButton,
                                        page ===
                                        pageNumber
                                            ? styles.activePageButton
                                            : '',
                                    ]
                                        .filter(Boolean)
                                        .join(' ')}
                                    onClick={() =>
                                        handlePageChange(
                                            pageNumber
                                        )
                                    }
                                >
                                    {pageNumber}
                                </button>
                            ))}


                            {/* 다음 */}
                            <button
                                type="button"
                                className={
                                    styles.pageButton
                                }
                                disabled={
                                    page ===
                                    pagination.totalPages
                                }
                                onClick={() =>
                                    handlePageChange(
                                        page + 1
                                    )
                                }
                            >
                                다음
                            </button>
                        </div>
                    )}
            </div>
            {isDetailOpen && (
                <MemberDetailModal
                    member={selectedMember}
                    isLoading={isDetailLoading}
                    errorMessage={detailError}
                    canManageAdmins={canManageAdmins}
                    onEditPermission={handleEditPermission}
                    onClose={handleDetailClose}
                />
            )}
            {isPermissionOpen && (
                <MemberPermissionModal
                    member={selectedMember}
                    onSubmit={handlePermissionSubmit}
                    onClose={handlePermissionClose}
                />
            )}
        </section>
    )
}