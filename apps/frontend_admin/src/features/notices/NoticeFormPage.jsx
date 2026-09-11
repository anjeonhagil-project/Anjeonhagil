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
    createNotice,
    deleteNotice,
    getNoticeById,
    updateNotice,
} from './api.js'

import styles from './NoticeFormPage.module.css'


export default function NoticeFormPage() {
    const navigate = useNavigate()
    const { noticeId } = useParams()

    const isEditMode = Boolean(noticeId)

    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')

    // 수정 시 기존 노출 상태 유지
    const [isPublished, setIsPublished] =
        useState(true)

    const [isLoading, setIsLoading] =
        useState(isEditMode)

    const [isSubmitting, setIsSubmitting] =
        useState(false)

    const [errorMessage, setErrorMessage] =
        useState('')

    // 등록 / 수정 완료 모달
    const [
        showSuccessModal,
        setShowSuccessModal,
    ] = useState(false)

    // 삭제 확인 모달
    const [
        showDeleteModal,
        setShowDeleteModal,
    ] = useState(false)


    // =========================================================
    // 수정 모드: 기존 공지사항 조회
    // =========================================================

    useEffect(() => {
        if (!isEditMode) {
            return
        }

        async function loadNotice() {
            try {
                setIsLoading(true)
                setErrorMessage('')

                const response =
                    await getNoticeById(noticeId)

                const notice = response.data

                setTitle(notice.title ?? '')
                setContent(notice.content ?? '')

                setIsPublished(
                    notice.isPublished ?? true
                )
            } catch (error) {
                console.error(
                    '공지사항 상세 조회 실패:',
                    error
                )

                setErrorMessage(
                    '공지사항 정보를 불러오지 못했습니다.'
                )
            } finally {
                setIsLoading(false)
            }
        }

        loadNotice()
    }, [
        isEditMode,
        noticeId,
    ])


    // =========================================================
    // 등록 / 수정
    // =========================================================

    async function handleSubmit(event) {
        event.preventDefault()

        const trimmedTitle =
            title.trim()

        const trimmedContent =
            content.trim()


        if (!trimmedTitle) {
            setErrorMessage(
                '공지사항 제목을 입력해주세요.'
            )

            return
        }


        if (!trimmedContent) {
            setErrorMessage(
                '공지사항 내용을 입력해주세요.'
            )

            return
        }


        try {
            setIsSubmitting(true)
            setErrorMessage('')


            // 수정
            if (isEditMode) {
                await updateNotice(
                    noticeId,
                    {
                        title: trimmedTitle,
                        content: trimmedContent,

                        // 기존 노출 상태 유지
                        isPublished,
                    }
                )
            }

            // 신규 등록
            else {
                await createNotice({
                    title: trimmedTitle,
                    content: trimmedContent,

                    // 신규 등록 공지는 노출
                    isPublished: true,
                })
            }


            setShowSuccessModal(true)
        } catch (error) {
            console.error(
                '공지사항 저장 실패:',
                error
            )

            setErrorMessage(
                isEditMode
                    ? '공지사항 수정에 실패했습니다.'
                    : '공지사항 등록에 실패했습니다.'
            )
        } finally {
            setIsSubmitting(false)
        }
    }


    // =========================================================
    // 삭제
    // =========================================================

    async function handleDelete() {
        try {
            setIsSubmitting(true)
            setErrorMessage('')

            await deleteNotice(noticeId)

            setShowDeleteModal(false)

            navigate('/notices')
        } catch (error) {
            console.error(
                '공지사항 삭제 실패:',
                error
            )

            setErrorMessage(
                '공지사항 삭제에 실패했습니다.'
            )

            setShowDeleteModal(false)
        } finally {
            setIsSubmitting(false)
        }
    }


    // =========================================================
    // 취소
    // =========================================================

    function handleCancel() {
        navigate('/notices')
    }


    // =========================================================
    // 등록 / 수정 완료 모달 확인
    // =========================================================

    function handleModalConfirm() {
        setShowSuccessModal(false)

        navigate('/notices')
    }


    // =========================================================
    // Loading
    // =========================================================

    if (isLoading) {
        return (
            <section className={styles.page}>
                <div className={styles.loading}>
                    공지사항을 불러오는 중입니다.
                </div>
            </section>
        )
    }


    return (
        <>
            <section className={styles.page}>
                <form
                    className={styles.formCard}
                    onSubmit={handleSubmit}
                >

                    {/* 공지 제목 */}
                    <div className={styles.field}>
                        <label htmlFor="notice-title">
                            공지 제목

                            <span className={styles.required}>
                                *
                            </span>
                        </label>

                        <input
                            id="notice-title"
                            type="text"
                            value={title}
                            maxLength={200}
                            placeholder="공지사항 제목을 입력해주세요."
                            onChange={(event) => {
                                setTitle(
                                    event.target.value
                                )

                                if (errorMessage) {
                                    setErrorMessage('')
                                }
                            }}
                        />

                        <div className={styles.inputInfo}>
                            <span>
                                필수 입력
                            </span>

                            <span>
                                {title.length} / 200
                            </span>
                        </div>
                    </div>


                    {/* 공지 내용 */}
                    <div className={styles.field}>
                        <label htmlFor="notice-content">
                            공지 내용

                            <span className={styles.required}>
                                *
                            </span>
                        </label>

                        <textarea
                            id="notice-content"
                            value={content}
                            placeholder="공지사항 내용을 입력해주세요."
                            onChange={(event) => {
                                setContent(
                                    event.target.value
                                )

                                if (errorMessage) {
                                    setErrorMessage('')
                                }
                            }}
                        />
                    </div>


                    {/* 오류 메시지 */}
                    {errorMessage && (
                        <p
                            className={styles.errorMessage}
                            role="alert"
                        >
                            {errorMessage}
                        </p>
                    )}


                    {/* 하단 버튼 */}
                    <div className={styles.buttonArea}>

                        {/* 수정 화면에서만 삭제 버튼 */}
                        <div>
                            {isEditMode && (
                                <button
                                    type="button"
                                    className={
                                        styles.deleteButton
                                    }
                                    onClick={() =>
                                        setShowDeleteModal(
                                            true
                                        )
                                    }
                                    disabled={
                                        isSubmitting
                                    }
                                >
                                    삭제
                                </button>
                            )}
                        </div>


                        <div className={styles.rightButtons}>
                            <button
                                type="button"
                                className={
                                    styles.cancelButton
                                }
                                onClick={handleCancel}
                                disabled={
                                    isSubmitting
                                }
                            >
                                취소
                            </button>

                            <button
                                type="submit"
                                className={
                                    styles.submitButton
                                }
                                disabled={
                                    isSubmitting
                                }
                            >
                                {isSubmitting
                                    ? '저장 중...'
                                    : isEditMode
                                        ? '수정'
                                        : '등록'}
                            </button>
                        </div>
                    </div>
                </form>
            </section>


            {/* =================================================
                등록 / 수정 완료 모달
            ================================================= */}

            {showSuccessModal && (
                <div
                    className={styles.modalBackdrop}
                    role="presentation"
                >
                    <div
                        className={styles.modal}
                        role="dialog"
                        aria-modal="true"
                    >
                        <div
                            className={
                                styles.successIcon
                            }
                        >
                            <CheckCircle2 size={30} />
                        </div>

                        <h2>
                            {isEditMode
                                ? '공지사항 수정 완료'
                                : '공지사항 등록 완료'}
                        </h2>

                        <p>
                            {isEditMode
                                ? '공지사항이 정상적으로 수정되었습니다.'
                                : '공지사항이 정상적으로 등록되었습니다.'}
                        </p>

                        <button
                            type="button"
                            className={
                                styles.modalButton
                            }
                            onClick={
                                handleModalConfirm
                            }
                        >
                            확인
                        </button>
                    </div>
                </div>
            )}


            {/* =================================================
                삭제 확인 모달
            ================================================= */}

            {showDeleteModal && (
                <div
                    className={styles.modalBackdrop}
                    role="presentation"
                >
                    <div
                        className={styles.modal}
                        role="dialog"
                        aria-modal="true"
                    >
                        <h2>
                            공지사항 삭제
                        </h2>

                        <p>
                            해당 공지사항을 삭제하시겠습니까?
                            <br />
                            삭제된 공지사항은 복구할 수 없습니다.
                        </p>

                        <div
                            className={
                                styles.modalButtons
                            }
                        >
                            <button
                                type="button"
                                className={
                                    styles.modalCancelButton
                                }
                                onClick={() =>
                                    setShowDeleteModal(
                                        false
                                    )
                                }
                                disabled={
                                    isSubmitting
                                }
                            >
                                취소
                            </button>

                            <button
                                type="button"
                                className={
                                    styles.modalDeleteButton
                                }
                                onClick={
                                    handleDelete
                                }
                                disabled={
                                    isSubmitting
                                }
                            >
                                {isSubmitting
                                    ? '삭제 중...'
                                    : '삭제'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}