import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../../../components/common/Button/Button.jsx'
import Input from '../../../components/common/Input/Input.jsx'
import Header from '../../../components/layout/Header.jsx'
import styles from './InquiryCreatePage.module.css'

function InquiryCreatePage() {
    const navigate = useNavigate()
    const [title, setTitle] = useState('')
    const [content, setContent] = useState('')

    const handleSubmit = (event) => {
        event.preventDefault()

        if (!title.trim() || !content.trim()) return

        navigate('/my/support/inquiries', {
            replace: true,
            state: {
                createdInquiry: {
                    id: Date.now(),
                    title: title.trim(),
                    date: new Date().toLocaleDateString('sv-SE').replaceAll('-', '.'),
                    status: '답변 대기',
                },
            },
        })
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

                <Button
                    type="submit"
                    fullWidth
                    disabled={!title.trim() || !content.trim()}
                >
                    문의 등록
                </Button>
            </form>
        </main>
    )
}

export default InquiryCreatePage