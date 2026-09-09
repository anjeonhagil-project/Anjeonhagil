import { FiChevronRight } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import Header from '../../../components/layout/Header.jsx'
import styles from './HelpSupportPage.module.css'

const SUPPORT_ITEMS = [
    {
        id: 'notices',
        title: '공지사항',
        description: '서비스 업데이트 및 점검 공지',
    },
    {
        id: 'inquiries',
        title: '문의하기',
        description: '고객센터 운영 시간 09:00 - 18:00',
    },
    {
        id: 'terms',
        title: '약관 및 개인정보',
        description: '이용 규정 및 수집 정책 안내',
    },
]

function HelpSupportPage() {
    const navigate = useNavigate()

    const handleItemClick = (itemId) => {
        if (itemId === 'notices') {
            navigate('/my/support/notices')
        }
        if (itemId === 'inquiries') {
            navigate('/my/support/inquiries')
        }

        if (itemId === 'terms') {
            navigate('/my/support/terms')
        }
    }

    return (
        <main className={styles.page}>
            <Header title="도움말 / 지원" onBack={() => navigate('/my')} />

            <section className={`${styles.content} hide-scrollbar`}>
                <section className={styles.introCard}>
                    <h2>무엇을 도와드릴까요?</h2>
                    <p>
                        찾고 계신 정보를 빠르게 안내해 드릴게요.
                        <br />
                        안전하길입니다. 문의사항에 성실히 답변해 드립니다.
                    </p>
                </section>

                <section className={styles.menuList} aria-label="도움말 및 지원 메뉴">
                    {SUPPORT_ITEMS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            className={styles.menuItem}
                            onClick={() => handleItemClick(item.id)}
                        >
                            <span className={styles.menuCopy}>
                                <strong>{item.title}</strong>
                                <small>{item.description}</small>
                            </span>
                            <FiChevronRight size={22} aria-hidden="true" />
                        </button>
                    ))}
                </section>
            </section>
        </main>
    )
}

export default HelpSupportPage