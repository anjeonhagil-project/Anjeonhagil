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
    Search,
} from 'lucide-react'

import {
    getInquiries,
} from './api.js'

import styles from './InquiriesPage.module.css'


const STATUS_OPTIONS = [
    {
        value: '',
        label: '전체 상태',
    },
    {
        value: 'received',
        label: '접수',
    },
    {
        value: 'in_review',
        label: '처리중',
    },
    {
        value: 'answered',
        label: '답변완료',
    },
]


function getCategoryLabel(category) {
    const labels = {
        service: '서비스 문의',
    }

    return (
        labels[category] ||
        category ||
        '-'
    )
}


export default function InquiriesPage() {
    const navigate = useNavigate()

    const [
        inquiries,
        setInquiries,
    ] = useState([])

    const [
        searchInput,
        setSearchInput,
    ] = useState('')

    const [
        search,
        setSearch,
    ] = useState('')

    const [
        status,
        setStatus,
    ] = useState('')

    const [
        category,
        setCategory,
    ] = useState('')

    const [
        sortOrder,
        setSortOrder,
    ] = useState('desc')

    const [
        page,
        setPage,
    ] = useState(1)

    const [
        pagination,
        setPagination,
    ] = useState({
        total: 0,
        totalPages: 0,
    })

    const [
        isLoading,
        setIsLoading,
    ] = useState(true)

    const [
        errorMessage,
        setErrorMessage,
    ] = useState('')

    const size = 10


    useEffect(() => {
        async function loadInquiries() {
            try {
                setIsLoading(true)
                setErrorMessage('')

                const response =
                    await getInquiries({
                        search,
                        status:
                            status || undefined,
                        category:
                            category || undefined,
                        page,
                        size,
                        sortOrder,
                    })

                const data =
                    response.data

                setInquiries(
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
                    '문의사항 목록 조회 실패:',
                    error
                )

                setErrorMessage(
                    '문의사항을 불러오지 못했습니다.'
                )
            } finally {
                setIsLoading(false)
            }
        }

        loadInquiries()
    }, [
        search,
        status,
        category,
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


    function handlePageChange(
        nextPage
    ) {
        if (
            nextPage < 1 ||
            nextPage >
                pagination.totalPages
        ) {
            return
        }

        setPage(nextPage)
    }


    function getPageNumbers() {
        const totalPages =
            pagination.totalPages

        if (!totalPages) {
            return []
        }

        const start =
            Math.max(
                1,
                page - 2
            )

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

        const pages = []

        for (
            let number = adjustedStart;
            number <= end;
            number += 1
        ) {
            pages.push(number)
        }

        return pages
    }


    function formatDate(value) {
        if (!value) {
            return '-'
        }

        return new Intl.DateTimeFormat(
            'ko-KR',
            {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
            }
        )
            .format(new Date(value))
            .replace(/\s/g, '')
    }


    function getStatusClass(statusValue) {
        switch (statusValue) {
            case 'received':
                return styles.received

            case 'in_review':
                return styles.inReview

            case 'answered':
                return styles.answered

            default:
                return ''
        }
    }


    return (
        <section className={styles.page}>
            <div className={styles.toolbar}>
                <form
                    className={styles.searchBox}
                    onSubmit={
                        handleSearchSubmit
                    }
                >
                    <Search size={17} />

                    <input
                        type="text"
                        value={searchInput}
                        placeholder="문의사항 검색"
                        onChange={(event) =>
                            setSearchInput(
                                event.target.value
                            )
                        }
                    />
                </form>


                <select
                    className={styles.select}
                    value={category}
                    onChange={(event) => {
                        setPage(1)

                        setCategory(
                            event.target.value
                        )
                    }}
                >
                    <option value="">
                        전체 유형
                    </option>

                    <option value="service">
                        서비스 문의
                    </option>
                </select>


                <select
                    className={styles.select}
                    value={status}
                    onChange={(event) => {
                        setPage(1)

                        setStatus(
                            event.target.value
                        )
                    }}
                >
                    {STATUS_OPTIONS.map(
                        (option) => (
                            <option
                                key={option.value}
                                value={
                                    option.value
                                }
                            >
                                {option.label}
                            </option>
                        )
                    )}
                </select>


                <select
                    className={styles.select}
                    value={sortOrder}
                    onChange={(event) => {
                        setPage(1)

                        setSortOrder(
                            event.target.value
                        )
                    }}
                >
                    <option value="desc">
                        최신순
                    </option>

                    <option value="asc">
                        오래된순
                    </option>
                </select>
            </div>


            <div className={styles.tableCard}>
                <table className={styles.table}>
                    <colgroup>
                        <col className={styles.numberColumn} />
                        <col className={styles.categoryColumn} />
                        <col />
                        <col className={styles.userColumn} />
                        <col className={styles.dateColumn} />
                        <col className={styles.statusColumn} />
                    </colgroup>

                    <thead>
                        <tr>
                            <th>No.</th>
                            <th>문의 유형</th>
                            <th>문의 제목</th>
                            <th>작성자</th>
                            <th>등록일</th>
                            <th>처리 상태</th>
                        </tr>
                    </thead>

                    <tbody>
                        {isLoading && (
                            <tr>
                                <td
                                    colSpan="6"
                                    className={
                                        styles.emptyCell
                                    }
                                >
                                    문의사항을 불러오는 중입니다.
                                </td>
                            </tr>
                        )}


                        {!isLoading &&
                            errorMessage && (
                                <tr>
                                    <td
                                        colSpan="6"
                                        className={
                                            styles.emptyCell
                                        }
                                    >
                                        {
                                            errorMessage
                                        }
                                    </td>
                                </tr>
                            )}


                        {!isLoading &&
                            !errorMessage &&
                            inquiries.length ===
                                0 && (
                                <tr>
                                    <td
                                        colSpan="6"
                                        className={
                                            styles.emptyCell
                                        }
                                    >
                                        등록된 문의사항이 없습니다.
                                    </td>
                                </tr>
                            )}


                        {!isLoading &&
                            !errorMessage &&
                            inquiries.map(
                                (
                                    inquiry,
                                    index
                                ) => {
                                    const rowNumber =
                                        pagination.total -
                                        (page - 1) *
                                            size -
                                        index

                                    return (
                                        <tr
                                            key={
                                                inquiry.inquiryId
                                            }
                                            className={
                                                styles.clickableRow
                                            }
                                            onClick={() =>
                                                navigate(
                                                    `/inquiries/${inquiry.inquiryId}`
                                                )
                                            }
                                        >
                                            <td>
                                                {
                                                    rowNumber
                                                }
                                            </td>

                                            <td>
                                                {getCategoryLabel(
                                                    inquiry.category
                                                )}
                                            </td>

                                            <td
                                                className={
                                                    styles.titleCell
                                                }
                                            >
                                                {
                                                    inquiry.title
                                                }
                                            </td>

                                            <td>
                                                {inquiry
                                                    .user
                                                    ?.email ??
                                                    '-'}
                                            </td>

                                            <td>
                                                {formatDate(
                                                    inquiry.createdAt
                                                )}
                                            </td>

                                            <td>
                                                <span
                                                    className={`${styles.statusBadge} ${getStatusClass(
                                                        inquiry.status
                                                    )}`}
                                                >
                                                    {
                                                        inquiry.statusLabel
                                                    }
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                }
                            )}
                    </tbody>
                </table>


                {pagination.totalPages >
                    0 && (
                    <div
                        className={
                            styles.paginationArea
                        }
                    >
                        <button
                            type="button"
                            className={
                                styles.pageButton
                            }
                            disabled={
                                page === 1
                            }
                            onClick={() =>
                                handlePageChange(
                                    page - 1
                                )
                            }
                        >
                            <ChevronLeft
                                size={16}
                            />
                        </button>

                        {getPageNumbers().map(
                            (pageNumber) => (
                                <button
                                    type="button"
                                    key={
                                        pageNumber
                                    }
                                    className={`${styles.pageButton} ${
                                        page ===
                                        pageNumber
                                            ? styles.activePage
                                            : ''
                                    }`}
                                    onClick={() =>
                                        handlePageChange(
                                            pageNumber
                                        )
                                    }
                                >
                                    {
                                        pageNumber
                                    }
                                </button>
                            )
                        )}

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
                            <ChevronRight
                                size={16}
                            />
                        </button>
                    </div>
                )}
            </div>
        </section>
    )
}