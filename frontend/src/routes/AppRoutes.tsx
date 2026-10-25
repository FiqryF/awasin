import { Navigate, Route, Routes, useLocation } from 'react-router'
import { RouteBoundary } from '../components/common/RouteBoundary'
import { lazy, Suspense } from 'react'
import { MainLayout } from '../layouts/MainLayout'
import { HomePage } from '../pages/HomePage'
const FeedbackPage = lazy(() => import('../pages/FeedbackPage').then(module => ({default:module.FeedbackPage})))
import { NotFoundPage } from '../pages/NotFoundPage'
import { PlaceholderPage } from '../pages/placeholders/PlaceholderPage'
import { placeholderRoutes } from './routeConfig'
const LoginPage = lazy(() => import('../pages/auth/LoginPage').then(module => ({default:module.LoginPage})))
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage').then(module => ({default:module.RegisterPage})))
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage').then(module => ({default:module.ForgotPasswordPage})))
const ResetPasswordPage = lazy(() => import('../pages/auth/ResetPasswordPage').then(module => ({default:module.ResetPasswordPage})))
const VerifyEmailPage = lazy(() => import('../pages/auth/VerifyEmailPage').then(module => ({default:module.VerifyEmailPage})))
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
const AccountPage = lazy(() => import('../pages/AccountPage').then(module => ({default:module.AccountPage})))
const SettingsPage = lazy(() => import('../pages/SettingsPage').then(module => ({default:module.SettingsPage})))
const EducationPage = lazy(() => import('../pages/EducationPage').then(module => ({default:module.EducationPage})))
const EducationArticlePage = lazy(() => import('../pages/EducationPage').then(module => ({default:module.EducationArticlePage})))
const DashboardPage = lazy(() => import('../pages/DashboardPage').then(module => ({default:module.DashboardPage})))
const ScanHistoryPage = lazy(() => import('../pages/ScanHistoryPage').then(module => ({default:module.ScanHistoryPage})))
const AnalysisDetailPage = lazy(() => import('../pages/AnalysisDetailPage').then(module => ({default:module.AnalysisDetailPage})))
import { ScanWorkspacePage } from '../pages/ScanWorkspacePage'
import '../features/history/history.css'
import { SessionLoading } from '../features/auth/SessionLoading'

export function AppRoutes() {
  const {pathname}=useLocation()
  return (
    <RouteBoundary resetKey={pathname}><Suspense fallback={<SessionLoading label="Memuat halaman…" />}><Routes>
      {/* Auth routes — full-screen tanpa navbar/footer */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/auth/mfa" element={<Navigate to="/settings" replace />} />

      {/* Routes utama — dengan FloatingNavbar dan Footer */}
      <Route element={<MainLayout />}>
        <Route path="/education" element={<EducationPage/>}/>
        <Route path="/education/:slug" element={<EducationArticlePage/>}/>
        <Route index element={<HomePage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route path="/scan/link" element={<ScanWorkspacePage mode="link"/>}/>
        <Route path="/scan/message" element={<ScanWorkspacePage mode="message"/>}/>
        <Route path="/scan/website" element={<ScanWorkspacePage mode="website"/>}/>
        <Route path="/scan/qr" element={<ScanWorkspacePage mode="qr"/>}/>
        <Route path="/scan/media" element={<ScanWorkspacePage mode="image"/>}/>
        <Route element={<ProtectedRoute/>}><Route path="/history" element={<ScanHistoryPage/>}/><Route path="/history/:id" element={<AnalysisDetailPage/>}/></Route>
        <Route element={<ProtectedRoute />}><Route path="/dashboard" element={<DashboardPage />} /></Route>
        <Route element={<ProtectedRoute admin />}><Route path="/admin/dashboard" element={<AccountPage admin />} /></Route>
        {placeholderRoutes.map(({ path, title, access }) => (
          <Route key={path} element={<ProtectedRoute admin={access === 'admin'} />}><Route path={path} element={path === '/settings' ? <SettingsPage /> : <PlaceholderPage title={title} access={access} />} /></Route>
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes></Suspense></RouteBoundary>
  )
}
