import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../../components/common/Button/Button.jsx'
import Input from '../../../components/common/Input/Input.jsx'
import Header from '../../../components/layout/Header.jsx'
import { createInquiry } from '../../support/api.js'
import styles from './InquiryCreatePage.module.css'

function InquiryCreatePage() {
    const navigate = useNavigate()
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (!title.trim() || !content.trim() || isSubmitting) return

        setIsSubmitting(true)
        setErrorMessage('')

        try {
            await createInquiry({ title: title.trim(), content: content.trim() })
            navigate('/my/support/inquiries', { replace: true })
        } catch (error) {
            setErrorMessage(error.message || '문의 등록에 실패했습니다')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <main className={styles.page}>
            <Header title="문의 작성" onBack={() => navigate('/my/support/inquiries')} />

            <form className={`${styles.form} hide-scrollbar`} onSubmit={handleSubmit}>
                <Input
                    label="제목"
                    value={title}
                    placeholder="제목을 입력해주세요"
                    onChange={(event) => setTitle(event.target.value)}
                />

                <label className={styles.contentField}>
                    <span>내용</span>
                    <textarea
                        value={content}
                        placeholder="문의 내용을 입력해주세요"
                        onChange={(event) => setContent(event.target.value)}
                    />
                </label>

                {errorMessage && <p className={styles.errorMessage} role="alert">{errorMessage}</p>}

                <Button
                    type="submit"
                    fullWidth
                    disabled={!title.trim() || !content.trim() || isSubmitting}
                >
                    {isSubmitting ? '등록 중...' : '문의 등록'}
                </Button>
            </form>
        </main>
    )
}

export default InquiryCreatePage
