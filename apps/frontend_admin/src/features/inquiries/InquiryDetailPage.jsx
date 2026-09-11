import {
    useEffect,
    useState,
} from 'react'

import {
    useNavigate,
    useParams,
} from 'react-router-dom'

import {
    CheckCircle2,
} from 'lucide-react'

import {
    answerInquiry,
    getInquiryById,
    updateInquiryStatus,
} from './api.js'

import styles from './InquiryDetailPage.module.css'


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


function formatDateTime(value) {
    if (!value) {
        return '-'
    }

    return new Intl.DateTimeFormat(
        'ko-KR',
        {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
        }
    ).format(new Date(value))
}


export default function InquiryDetailPage() {
    const navigate = useNavigate()

    const { inquiryId } =
        useParams()

    const [
        inquiry,
        setInquiry,
    ] = useState(null)

    const [
        answerContent,
        setAnswerContent,
    ] = useState('')

    const [
        isLoading,
        setIsLoading,
    ] = useState(true)

    const [
        isSubmitting,
        setIsSubmitting,
    ] = useState(false)

    const [
        errorMessage,
        setErrorMessage,
    ] = useState('')

    const [
        showSuccessModal,
        setShowSuccessModal,
    ] = useState(false)


    useEffect(() => {
        async function loadInquiry() {
            try {
                setIsLoading(true)
                setErrorMessage('')

                const response =
                    await getInquiryById(
                        inquiryId
                    )

                const data =
                    response.data

                setInquiry(data)

                setAnswerContent(
                    data.answerContent ??
                        ''
                )
            } catch (error) {
                console.error(
                    '문의사항 상세 조회 실패:',
                    error
                )

                setErrorMessage(
                    '문의사항 정보를 불러오지 못했습니다.'
                )
            } finally {
                setIsLoading(false)
            }
        }

        loadInquiry()
    }, [inquiryId])


    async function handleStatusChange(
        event
    ) {
        const nextStatus =
            event.target.value

        if (
            !nextStatus ||
            nextStatus ===
                inquiry.status
        ) {
            return
        }

        try {
            setIsSubmitting(true)
            setErrorMessage('')

            const response =
                await updateInquiryStatus(
                    inquiryId,
                    nextStatus
                )

            setInquiry(
                response.data
            )
        } catch (error) {
            console.error(
                '문의 상태 변경 실패:',
                error
            )

            setErrorMessage(
                '문의 처리 상태 변경에 실패했습니다.'
            )
        } finally {
            setIsSubmitting(false)
        }
    }


    async function handleAnswer() {
        const trimmedAnswer =
            answerContent.trim()

        if (!trimmedAnswer) {
            setErrorMessage(
                '관리자 답변을 입력해주세요.'
            )

            return
        }

        try {
            setIsSubmitting(true)
            setErrorMessage('')

            const response =
                await answerInquiry(
                    inquiryId,
                    trimmedAnswer
                )

            setInquiry(
                response.data
            )

            setAnswerContent(
                response.data
                    .answerContent ?? ''
            )

            setShowSuccessModal(
                true
            )
        } catch (error) {
            console.error(
                '문의 답변 등록 실패:',
                error
            )

            setErrorMessage(
                error.message ||
                    '문의 답변 등록에 실패했습니다.'
            )
        } finally {
            setIsSubmitting(false)
        }
    }


    if (isLoading) {
        return (
            <section
                className={styles.page}
            >
                <div
                    className={
                        styles.loading
                    }
                >
                    문의사항을 불러오는 중입니다.
                </div>
            </section>
        )
    }


    if (
        !inquiry ||
        errorMessage &&
        !inquiry
    ) {
        return (
            <section
                className={styles.page}
            >
                <div
                    className={
                        styles.loading
                    }
                >
                    {errorMessage ||
                        '문의사항을 찾을 수 없습니다.'}
                </div>
            </section>
        )
    }


    const isAnswered =
        inquiry.status === 'answered'


    return (
        <>
            <section
                className={styles.page}
            >
                <div
                    className={
                        styles.detailGrid
                    }
                >

                    {/* 문의 내용 */}
                    <article
                        className={
                            styles.card
                        }
                    >
                        <div
                            className={
                                styles.cardHeader
                            }
                        >
                            <div>
                                <span
                                    className={
                                        styles.category
                                    }
                                >
                                    {getCategoryLabel(
                                        inquiry.category
                                    )}
                                </span>

                                <h2>
                                    {
                                        inquiry.title
                                    }
                                </h2>
                            </div>

                            <span
                                className={`${styles.statusBadge} ${
                                    inquiry.status ===
                                    'answered'
                                        ? styles.answered
                                        : inquiry.status ===
                                            'in_review'
                                          ? styles.inReview
                                          : styles.received
                                }`}
                            >
                                {
                                    inquiry.statusLabel
                                }
                            </span>
                        </div>


                        <div
                            className={
                                styles.metaGrid
                            }
                        >
                            <div>
                                <span>
                                    작성자
                                </span>

                                <strong>
                                    {inquiry
                                        .user
                                        ?.nickname ||
                                        '-'}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    이메일
                                </span>

                                <strong>
                                    {inquiry
                                        .user
                                        ?.email ||
                                        '-'}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    문의 유형
                                </span>

                                <strong>
                                    {getCategoryLabel(
                                        inquiry.category
                                    )}
                                </strong>
                            </div>

                            <div>
                                <span>
                                    등록일
                                </span>

                                <strong>
                                    {formatDateTime(
                                        inquiry.createdAt
                                    )}
                                </strong>
                            </div>
                        </div>


                        <div
                            className={
                                styles.contentBox
                            }
                        >
                            {
                                inquiry.content
                            }
                        </div>
                    </article>


                    {/* 관리자 답변 */}
                    <article
                        className={
                            styles.card
                        }
                    >
                        <div
                            className={
                                styles.answerHeader
                            }
                        >
                            <h2>
                                관리자 답변
                            </h2>

                            {!isAnswered && (
                                <select
                                    value={
                                        inquiry.status
                                    }
                                    onChange={
                                        handleStatusChange
                                    }
                                    disabled={
                                        isSubmitting
                                    }
                                >
                                    <option value="received">
                                        접수
                                    </option>

                                    <option value="in_review">
                                        처리중
                                    </option>
                                </select>
                            )}
                        </div>


                        {isAnswered && (
                            <div
                                className={
                                    styles.answerInfo
                                }
                            >
                                <span>
                                    답변자{' '}
                                    {inquiry
                                        .answeredBy
                                        ?.email ||
                                        '-'}
                                </span>

                                <span>
                                    {formatDateTime(
                                        inquiry.answeredAt
                                    )}
                                </span>
                            </div>
                        )}


                        <textarea
                            className={
                                styles.answerTextarea
                            }
                            value={
                                answerContent
                            }
                            readOnly={
                                isAnswered
                            }
                            placeholder="문의에 대한 답변을 입력해주세요."
                            onChange={(event) => {
                                setAnswerContent(
                                    event.target.value
                                )

                                if (
                                    errorMessage
                                ) {
                                    setErrorMessage(
                                        ''
                                    )
                                }
                            }}
                        />


                        {errorMessage && (
                            <p
                                className={
                                    styles.errorMessage
                                }
                            >
                                {
                                    errorMessage
                                }
                            </p>
                        )}


                        <div
                            className={
                                styles.buttonArea
                            }
                        >
                            <button
                                type="button"
                                className={
                                    styles.listButton
                                }
                                onClick={() =>
                                    navigate(
                                        '/inquiries'
                                    )
                                }
                            >
                                목록으로
                            </button>

                            <button
                                type="button"
                                className={
                                    styles.answerButton
                                }
                                disabled={
                                    isAnswered ||
                                    isSubmitting
                                }
                                onClick={
                                    handleAnswer
                                }
                            >
                                {isAnswered
                                    ? '답변완료'
                                    : isSubmitting
                                      ? '등록 중...'
                                      : '답변 등록'}
                            </button>
                        </div>
                    </article>
                </div>
            </section>


            {showSuccessModal && (
                <div
                    className={
                        styles.modalBackdrop
                    }
                >
                    <div
                        className={
                            styles.modal
                        }
                    >
                        <div
                            className={
                                styles.successIcon
                            }
                        >
                            <CheckCircle2
                                size={30}
                            />
                        </div>

                        <h2>
                            답변 등록 완료
                        </h2>

                        <p>
                            문의 답변이 정상적으로
                            등록되었습니다.
                        </p>

                        <button
                            type="button"
                            onClick={() => {
                                setShowSuccessModal(
                                    false
                                )

                                navigate(
                                    '/inquiries'
                                )
                            }}
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}