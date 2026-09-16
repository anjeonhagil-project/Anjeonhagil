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
import OperationsPage from '../features/dashboard/OperationsPage.jsx'
import AdminsPage from '../features/dashboard/AdminsPage.jsx'
import LoginPage from '../features/auth/LoginPage.jsx'
import ProtectedAdminRoute from '../features/auth/ProtectedAdminRoute.jsx'

import MembersPage from '../features/members/MembersPage.jsx'

import InquiriesPage from '../features/inquiries/InquiriesPage.jsx'
import InquiryDetailPage from '../features/inquiries/InquiryDetailPage.jsx'
import NoticesPage from '../features/notices/NoticesPage.jsx'
import NoticeFormPage from '../features/notices/NoticeFormPage.jsx'

// 아직 만들지 않은 페이지를 위한 임시 컴포넌트



function AppRouter() {
    return (
        <BrowserRouter>
            <Routes>
                {/* 로그인 화면 */}
                <Route
                    path="/login"
                    element={<LoginPage />}
                />

                {/* 관리자 인증이 필요한 화면 */}
                <Route element={<ProtectedAdminRoute />}>
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
                                <MembersPage />
                            }
                        />

                        <Route
                            path="/routes"
                            element={
                                <OperationsPage kind="routes" />
                            }
                        />

                        <Route
                            path="/datasets"
                            element={
                                <OperationsPage kind="datasets" />
                            }
                        />

                        <Route
                            path="/datasets/success"
                            element={
                                <OperationsPage kind="routes" />
                            }
                        />

                        <Route
                            path="/datasets/failure"
                            element={
                                <OperationsPage kind="failures" />
                            }
                        />

                        <Route
                            path="/notices"
                            element={
                                <NoticesPage />
                            }
                        />
                        <Route
                            path="/notices/new"
                            element={
                                <NoticeFormPage />
                            }
                        />
                        <Route
                            path="/notices/:noticeId/edit"
                            element={
                                <NoticeFormPage />
                            }
                        />

                        <Route
                            path="/inquiries"
                            element={
                                <InquiriesPage />
                            }
                        />
                        <Route
                            path="/inquiries/:inquiryId"
                            element={
                                <InquiryDetailPage />
                            }
                        />

                        <Route
                            path="/admins"
                            element={
                                <AdminsPage />
                            }
                        />
                    </Route>
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
