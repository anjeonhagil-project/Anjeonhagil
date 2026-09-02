// 기능: 사용자 모바일 웹앱 최상위 앱 컴포넌트
// TODO: MobileLayout, 공통 Provider, Router outlet 구성
import AppRouter from './router/index.jsx'
import StatusBar from './components/layout/StatusBar.jsx'
import styles from './App.module.css'

function App() {
    return (
        <div className={styles.wrapper}>
            <img className={styles.logo} src="../public/brand/logo.png" alt='안전하길 로고'/>
            <div className={styles.mobileFrame}>
                <StatusBar />
                <AppRouter />
            </div>
        </div>
    )
}

export default App
