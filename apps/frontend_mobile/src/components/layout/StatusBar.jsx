// 기능: 상태바(시간 + 신호/와이파이/배터리 아이콘) - Splash 제외 모든 화면 상단 고정
import { IoBatteryFull } from 'react-icons/io5'
import { FaWifi } from 'react-icons/fa'
import { BsBarChartFill } from 'react-icons/bs'
import styles from './StatusBar.module.css'

function StatusBar() {
    return (
        <div className={styles.statusBar}>
            <span className={styles.time}>9:41</span>
            <div className={styles.icons}>
                <BsBarChartFill size={16} />
                <FaWifi size={16} />
                <IoBatteryFull size={20} />
            </div>
        </div>
    )
}

export default StatusBar
