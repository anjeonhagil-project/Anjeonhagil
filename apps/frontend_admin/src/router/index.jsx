// # 기능: 관리자 화면 A-* 전용 라우팅
// # 예: /login, /dashboard, /members, /datasets, /notices, /inquiries, /routes, /admins
import {
    BrowserRouter,
    Navigate,
    Route,
    Routes,
} from 'react-router-dom'

import AdminLayout from '../components/layout/AdminLayout.jsx'
import DashboardPage from '../features/dashboard/DashboardPage.jsx'
import LoginPage from '../features/auth/LoginPage.jsx'

// 아직 만들지 않은 페이지를 위한 임시 컴포넌트
function PlaceholderPage({ title }) {
    return (
        <section>
            <h2>{title}</h2>
            <p>화면 준비 중입니다.</p>
        </section>
    )
}

function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                {/* 로그인 화면은 AdminLayout 밖 */}
                <Route
                    path="/login"
                    element={<LoginPage />}
                />

                {/* 사이드바와 헤더가 표시되는 관리자 화면 */}
                <Route element={<AdminLayout />}>
                    <Route
                        index
                        element={
                            <Navigate
                                to="/dashboard"
                                replace
                            />
                        }
                    />

                    <Route
                        path="/dashboard"
                        element={<DashboardPage />}
                    />

                    <Route
                        path="/members"
                        element={
                            <PlaceholderPage title="회원 관리" />
                        }
                    />

                    <Route
                        path="/routes"
                        element={
                            <PlaceholderPage title="경로 관리" />
                        }
                    />

                    <Route
                        path="/datasets"
                        element={
                            <PlaceholderPage title="데이터 관리" />
                        }
                    />

                    <Route
                        path="/notices"
                        element={
                            <PlaceholderPage title="공지사항" />
                        }
                    />

                    <Route
                        path="/inquiries"
                        element={
                            <PlaceholderPage title="문의사항" />
                        }
                    />

                    <Route
                        path="/admins"
                        element={
                            <PlaceholderPage title="관리자 관리" />
                        }
                    />
                </Route>

                {/* 존재하지 않는 주소 처리 */}
                <Route
                    path="*"
                    element={
                        <Navigate
                            to="/dashboard"
                            replace
                        />
                    }
                />
            </Routes>
        </BrowserRouter>
    )
}

export default AppRouter