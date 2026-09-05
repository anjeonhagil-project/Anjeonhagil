// 기능: M-AUTH-008 위치 권한 설정
import { useNavigate } from 'react-router-dom'
import { FaLocationDot } from 'react-icons/fa6'
import { Button } from '../../components/common/index.js'
import Header from '../../components/layout/Header.jsx'
import { LOCATION_PERMISSION_SEEN_KEY } from '../../router/AuthRedirect.jsx'
import styles from './LocationPermissionPage.module.css'

function LocationPermissionPage() {
    const navigate = useNavigate()

    const goNext = () => {
        localStorage.setItem(LOCATION_PERMISSION_SEEN_KEY, 'true')
        navigate('/onboarding', { replace: true })
    }

    const handleAllow = () => {
        if (!navigator.geolocation) {
            goNext()
            return
        }

        // 허용/거부 어느 쪽이든 다음 화면으로 진행 (거부 시 출발지 직접 입력으로 대체 가능)
        navigator.geolocation.getCurrentPosition(goNext, goNext)
    }

    return (
        <div>
            <Header title="권한 설정" onBack={() => window.history.back()} />
            <div className={styles.page}>
                <div className={styles.iconCircle}>
                    <FaLocationDot size={26} />
                </div>
                <h1 className={styles.title}>위치 권한을 허용해 주세요</h1>
                <p className={styles.description}>
                    현재 위치에서 출발하거나 지도를 탐색할 때 사용합니다.
                    <br />
                    설정에서 언제든 변경할 수 있어요.
                </p>
                <p className={styles.note}>권한 거부 시 출발지를 직접 입력할 수 있습니다</p>
                <Button fullWidth onClick={handleAllow} className={styles.submitBtn}>
                    위치 권한 허용
                </Button>
            </div>
        </div>
    )
}

export default LocationPermissionPage
