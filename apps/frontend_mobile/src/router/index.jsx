// 기능: 사용자 모바일 웹앱 M-* 화면 전용 라우팅
// 범위: auth/onboarding/home/search/route/navigation/favorites/my/support
// 관리자 A-* 화면은 frontend_admin에서 별도 관리
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from '../features/auth/LoginPage.jsx'
import SignUpPage from '../features/auth/SignUpPage.jsx'
import ForgotPasswordPage from '../features/auth/ForgotPasswordPage.jsx'
import HomePage from '../features/home/HomePage.jsx'
import OnboardingPage from '../features/onboarding/OnboardingPage.jsx'
import AuthRedirect from './AuthRedirect.jsx'

function AppRouter() {
    return (
        <BrowserRouter>
            <AuthRedirect />
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/signup" element={<SignUpPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/" element={<Navigate to="/login" replace />} />
            </Routes>
        </BrowserRouter>
    )
}

export default AppRouter
