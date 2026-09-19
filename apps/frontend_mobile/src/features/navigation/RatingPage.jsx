// 경로 안내(GPS·시뮬레이션) 완료 후 별 5개로 만족도를 받는다. 아직 저장하지 않고 홈으로 이동한다.
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IoStar, IoStarOutline } from 'react-icons/io5'
import Header from '../../components/layout/Header.jsx'
import Button from '../../components/common/Button/Button.jsx'
import styles from './RatingPage.module.css'

const LABELS = ['', '매우 불만족', '불만족', '보통', '만족', '매우 만족']

export default function RatingPage() {
    const navigate = useNavigate(), location = useLocation()
    const [score, setScore] = useState(0)
    const destination = location.state?.destination
    const finish = () => navigate('/home', { replace: true })

    return (
        <main className={styles.page} data-testid="rating-page">
            <Header title="경로 안내 완료" onBack={finish} />
            <div className={styles.content}>
                <h2 className={styles.title}>경로 안내는 어떠셨나요?</h2>
                {destination && <p className={styles.destination}>{destination}까지 안내를 마쳤어요</p>}
                <div className={styles.stars} role="radiogroup" aria-label="경로 만족도">
                    {[1, 2, 3, 4, 5].map(n => (
                        <button
                            key={n}
                            type="button"
                            role="radio"
                            aria-checked={score === n}
                            aria-label={`${n}점 ${LABELS[n]}`}
                            className={n <= score ? `${styles.star} ${styles.filled}` : styles.star}
                            onClick={() => setScore(n)}
                        >
                            {n <= score ? <IoStar /> : <IoStarOutline />}
                        </button>
                    ))}
                </div>
                <p className={styles.label} aria-live="polite">{LABELS[score] || '별을 눌러 평가해주세요'}</p>
            </div>
            <div className={styles.footer}>
                <Button fullWidth disabled={!score} onClick={finish}>완료</Button>
            </div>
        </main>
    )
}
