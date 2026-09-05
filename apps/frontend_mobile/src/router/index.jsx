// 기능: 사용자 모바일 웹앱 M-* 화면 전용 라우팅
// 범위: auth/onboarding/home/search/route/navigation/favorites/my/support
// 관리자 A-* 화면은 frontend_admin에서 별도 관리
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import SplashPage from '../features/auth/SplashPage.jsx'
import LoginPage from '../features/auth/LoginPage.jsx'
import SignUpPage from '../features/auth/SignUpPage.jsx'
import ForgotPasswordPage from '../features/auth/ForgotPasswordPage.jsx'
import TermsPage from '../features/auth/TermsPage.jsx'
import TermsDetailPage from '../features/auth/TermsDetailPage.jsx'
import LocationPermissionPage from '../features/auth/LocationPermissionPage.jsx'
import HomePage from '../features/home/HomePage.jsx'
import SearchPage from '../features/search/SearchPage.jsx'
import FavoritesPage from '../features/favorites/FavoritesPage.jsx'
import MyPage from '../features/my/MyPage.jsx'
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
                <Route path="/terms" element={<TermsPage />} />
                <Route path="/terms/:type" element={<TermsDetailPage />} />
                <Route path="/location-permission" element={<LocationPermissionPage />} />
                <Route path="/home" element={<HomePage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/favorites" element={<FavoritesPage />} />
                <Route path="/my" element={<MyPage />} />
                <Route path="/onboarding" element={<OnboardingPage />} />
                <Route path="/" element={<SplashPage />} />
            </Routes>
        </BrowserRouter>
    )
}

export default AppRouter
