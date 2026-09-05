// 기능: M-AUTH-006 이메일 인증 - 자체 회원가입 후 6자리 인증번호 확인
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { IoTimeOutline } from 'react-icons/io5'
import { supabase } from '../../lib/supabaseClient.js'
import { Button, Modal } from '../../components/common/index.js'
import Header from '../../components/layout/Header.jsx'
import styles from './EmailVerifyPage.module.css'

const CODE_LENGTH = 6
const TIMER_SECONDS = 180

function formatTime(seconds) {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0')
    const s = String(seconds % 60).padStart(2, '0')
    return `${m}:${s}`
}

function EmailVerifyPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const email = location.state?.email
    const inputRefs = useRef([])

    const [digits, setDigits] = useState(Array(CODE_LENGTH).fill(''))
    const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS)
    const [status, setStatus] = useState('idle') // idle | expired | mismatch
    const [verifying, setVerifying] = useState(false)
    const [successOpen, setSuccessOpen] = useState(false)

    useEffect(() => {
        if (!email) navigate('/signup', { replace: true })
    }, [email, navigate])

    useEffect(() => {
        if (status === 'expired' || successOpen) return undefined
        if (secondsLeft <= 0) {
            setStatus('expired')
            return undefined
        }
        const timer = setTimeout(() => setSecondsLeft((prev) => prev - 1), 1000)
        return () => clearTimeout(timer)
    }, [secondsLeft, status, successOpen])

    const focusBox = (index) => {
        inputRefs.current[index]?.focus()
    }

    const handleDigitChange = (index, value) => {
        const char = value.replace(/[^0-9]/g, '').slice(-1)
        setDigits((prev) => {
            const next = [...prev]
            next[index] = char
            return next
        })
        if (status === 'mismatch') setStatus('idle')
        if (char && index < CODE_LENGTH - 1) focusBox(index + 1)
    }

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            focusBox(index - 1)
        }
    }

    const handleVerify = async () => {
        const code = digits.join('')
        if (code.length !== CODE_LENGTH || status === 'expired' || verifying) return

        setVerifying(true)
        const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'signup' })
        setVerifying(false)

        if (error) {
            setStatus('mismatch')
            setDigits(Array(CODE_LENGTH).fill(''))
            focusBox(0)
            return
        }

        setSuccessOpen(true)
    }

    const handleResend = async () => {
        await supabase.auth.resend({ type: 'signup', email })
        setDigits(Array(CODE_LENGTH).fill(''))
        setSecondsLeft(TIMER_SECONDS)
        setStatus('idle')
        focusBox(0)
    }

    const hasError = status === 'expired' || status === 'mismatch'
    const filled = digits.every((d) => d !== '')

    return (
        <div>
            <Header title="이메일 인증" onBack={() => window.history.back()} />
            <div className={styles.page}>
                <p className={styles.guide}>
                    <strong>{email}</strong>으로
                    <br />
                    <strong>인증번호를 보냈어요.</strong>
                </p>
                <p className={styles.subGuide}>수신된 메일의 6자리 인증번호를 입력해주세요.</p>

                <div className={styles.otpRow}>
                    {digits.map((digit, index) => (
                        <input
                            key={index}
                            ref={(el) => { inputRefs.current[index] = el }}
                            type="text"
                            inputMode="numeric"
                            maxLength={1}
                            className={hasError ? `${styles.otpBox} ${styles.otpBoxError}` : styles.otpBox}
                            value={digit}
                            onChange={(e) => handleDigitChange(index, e.target.value)}
                            onKeyDown={(e) => handleKeyDown(index, e)}
                        />
                    ))}
                </div>

                <p className={hasError ? `${styles.timer} ${styles.timerError}` : styles.timer}>
                    <IoTimeOutline size={16} /> 남은 시간 {formatTime(secondsLeft)}
                </p>

                {status === 'expired' && (
                    <p className={styles.errorMessage}>
                        입력 시간이 만료되었습니다.
                        <br />
                        인증번호를 재전송해주세요.
                    </p>
                )}
                {status === 'mismatch' && (
                    <p className={styles.errorMessage}>
                        인증번호가 일치하지 않습니다.
                        <br />
                        다시 확인해 주세요.
                    </p>
                )}

                <Button
                    fullWidth
                    className={styles.confirmBtn}
                    disabled={!filled || status === 'expired' || verifying}
                    onClick={handleVerify}
                >
                    {verifying ? '확인 중...' : '인증번호 확인'}
                </Button>

                <div className={styles.linkRow}>
                    <button type="button" className={styles.link} onClick={handleResend}>
                        인증번호 재전송
                    </button>
                    <span className={styles.linkDivider} />
                    <button type="button" className={styles.link} onClick={() => navigate('/signup', { replace: true })}>
                        이메일 변경
                    </button>
                </div>
            </div>

            <Modal
                open={successOpen}
                icon="success"
                title="이메일 인증 성공"
                description="이메일 인증에 성공했습니다."
                confirmLabel="확인"
                onConfirm={() => navigate('/', { replace: true })}
            />
        </div>
    )
}

export default EmailVerifyPage
