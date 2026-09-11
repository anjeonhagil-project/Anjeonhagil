import {
    useEffect,
    useState,
} from 'react'

import {
    useNavigate,
} from 'react-router-dom'

import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Search,
} from 'lucide-react'

import { getNotices } from './api.js'

import styles from './NoticesPage.module.css'


export default function NoticesPage() {
    const navigate = useNavigate()

    const [notices, setNotices] = useState([])

    const [searchInput, setSearchInput] =
        useState('')

    const [search, setSearch] =
        useState('')

    const [isPublished, setIsPublished] =
        useState('all')

    const [page, setPage] =
        useState(1)

    const [pagination, setPagination] =
        useState({
            total: 0,
            totalPages: 0,
        })

    const [sortOrder, setSortOrder] =
        useState('desc')

    const [isLoading, setIsLoading] =
        useState(true)

    const [errorMessage, setErrorMessage] =
        useState('')

    const limit = 10


    useEffect(() => {
        async function loadNotices() {
            try {
                setIsLoading(true)
                setErrorMessage('')

                const response =
                    await getNotices({
                        search,

                        isPublished:
                            isPublished === 'all'
                                ? undefined
                                : isPublished === 'published',

                        page,
                        limit,

                        sortBy: 'createdAt',
                        sortOrder,
                    })

                const data = response.data

                setNotices(
                    data.items ?? []
                )

                setPagination({
                    total:
                        data.total ?? 0,

                    totalPages:
                        data.totalPages ?? 0,
                })
            } catch (error) {
                console.error(
                    '공지사항 목록 조회 실패:',
                    error
                )

                setErrorMessage(
                    '공지사항을 불러오지 못했습니다.'
                )
            } finally {
                setIsLoading(false)
            }
        }

        loadNotices()
    }, [
        search,
        isPublished,
        page,
        sortOrder,
    ])


    function handleSearchSubmit(event) {
        event.preventDefault()

        setPage(1)

        setSearch(
            searchInput.trim()
        )
    }


    function handlePublishedChange(event) {
        setPage(1)

        setIsPublished(
            event.target.value
        )
    }


    function handleSortChange(event) {
        setPage(1)

        setSortOrder(
            event.target.value
        )
    }


    function handlePageChange(nextPage) {
        if (
            nextPage < 1 ||
            nextPage > pagination.totalPages
        ) {
            return
        }

        setPage(nextPage)
    }


    function handleNoticeClick(noticeId) {
        navigate(
            `/notices/${noticeId}/edit`
        )
    }


    function handleCreateClick() {
        navigate('/notices/new')
    }


    function formatDate(dateValue) {
        if (!dateValue) {
            return '-'
        }

        const date =
            new Date(dateValue)

        return new Intl.DateTimeFormat(
            'ko-KR',
            {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }
        )
            .format(date)
            .replace(/\s/g, '')
    }


    function getPageNumbers() {
        const totalPages =
            pagination.totalPages

        if (!totalPages) {
            return []
        }

        const start =
            Math.max(1, page - 2)

        const end =
            Math.min(
                totalPages,
                start + 4
            )

        const adjustedStart =
            Math.max(
                1,
                end - 4
            )

        const numbers = []

        for (
            let number = adjustedStart;
            number <= end;
            number += 1
        ) {
            numbers.push(number)
        }

        return numbers
    }


    return (
        <section className={styles.page}>
            <div className={styles.toolbar}>
                <div className={styles.leftTools}>
                    <form
                        className={styles.searchBox}
                        onSubmit={handleSearchSubmit}
                    >
                        <Search
                            size={17}
                            aria-hidden="true"
                        />

                        <input
                            type="text"
                            value={searchInput}
                            onChange={(event) =>
                                setSearchInput(
                                    event.target.value
                                )
                            }
                            placeholder="공지사항 검색"
                        />
                    </form>

                    <select
                        className={styles.select}
                        value={sortOrder}
                        onChange={handleSortChange}
                    >
                        <option value="desc">
                            최신순
                        </option>

                        <option value="asc">
                            오래된순
                        </option>
                    </select>

                    <select
                        className={styles.select}
                        value={isPublished}
                        onChange={handlePublishedChange}
                    >
                        <option value="all">
                            전체 상태
                        </option>

                        <option value="published">
                            노출
                        </option>

                        <option value="hidden">
                            미노출
                        </option>
                    </select>
                </div>

                <button
                    type="button"
                    className={styles.createButton}
                    onClick={handleCreateClick}
                >
                    <Plus
                        size={17}
                        aria-hidden="true"
                    />

                    신규 작성
                </button>
            </div>


            <div className={styles.tableCard}>
                <table className={styles.table}>
                    <colgroup>
                        <col className={styles.numberColumn} />
                        <col />
                        <col className={styles.authorColumn} />
                        <col className={styles.dateColumn} />
                        <col className={styles.statusColumn} />
                    </colgroup>

                    <thead>
                        <tr>
                            <th>No.</th>
                            <th>제목</th>
                            <th>작성자</th>
                            <th>작성일</th>
                            <th>노출 상태</th>
                        </tr>
                    </thead>

                    <tbody>
                        {isLoading && (
                            <tr>
                                <td
                                    colSpan="5"
                                    className={styles.emptyCell}
                                >
                                    공지사항을 불러오는 중입니다.
                                </td>
                            </tr>
                        )}

                        {!isLoading &&
                            errorMessage && (
                                <tr>
                                    <td
                                        colSpan="5"
                                        className={styles.emptyCell}
                                    >
                                        {errorMessage}
                                    </td>
                                </tr>
                            )}

                        {!isLoading &&
                            !errorMessage &&
                            notices.length === 0 && (
                                <tr>
                                    <td
                                        colSpan="5"
                                        className={styles.emptyCell}
                                    >
                                        등록된 공지사항이 없습니다.
                                    </td>
                                </tr>
                            )}

                        {!isLoading &&
                            !errorMessage &&
                            notices.map(
                                (
                                    notice,
                                    index
                                ) => {
                                    const rowNumber =
                                        pagination.total -
                                        (page - 1) * limit -
                                        index

                                    return (
                                        <tr
                                            key={notice.noticeId}
                                            className={
                                                styles.clickableRow
                                            }
                                            onClick={() =>
                                                handleNoticeClick(
                                                    notice.noticeId
                                                )
                                            }
                                        >
                                            <td>
                                                {rowNumber}
                                            </td>

                                            <td
                                                className={
                                                    styles.titleCell
                                                }
                                            >
                                                {notice.title}
                                            </td>

                                            <td>
                                                {notice.author?.email ??
                                                    '-'}
                                            </td>

                                            <td>
                                                {formatDate(
                                                    notice.createdAt
                                                )}
                                            </td>

                                            <td>
                                                <span
                                                    className={`${styles.badge} ${
                                                        notice.isPublished
                                                            ? styles.publishedBadge
                                                            : styles.hiddenBadge
                                                    }`}
                                                >
                                                    {notice.isPublished
                                                        ? '노출'
                                                        : '미노출'}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                }
                            )}
                    </tbody>
                </table>


                {pagination.totalPages > 0 && (
                    <div
                        className={styles.paginationArea}
                    >
                        <button
                            type="button"
                            className={styles.pageButton}
                            disabled={page === 1}
                            onClick={() =>
                                handlePageChange(
                                    page - 1
                                )
                            }
                            aria-label="이전 페이지"
                        >
                            <ChevronLeft size={16} />
                        </button>

                        {getPageNumbers().map(
                            (pageNumber) => (
                                <button
                                    type="button"
                                    key={pageNumber}
                                    className={`${styles.pageButton} ${
                                        page === pageNumber
                                            ? styles.activePageButton
                                            : ''
                                    }`}
                                    onClick={() =>
                                        handlePageChange(
                                            pageNumber
                                        )
                                    }
                                >
                                    {pageNumber}
                                </button>
                            )
                        )}

                        <button
                            type="button"
                            className={styles.pageButton}
                            disabled={
                                page ===
                                pagination.totalPages
                            }
                            onClick={() =>
                                handlePageChange(
                                    page + 1
                                )
                            }
                            aria-label="다음 페이지"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </section>
    )
}