import { Navigate, Route, Routes } from 'react-router'
import { MainLayout } from '../layouts/MainLayout'
import { HomePage } from '../pages/HomePage'
import { FeedbackPage } from '../pages/FeedbackPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PlaceholderPage } from '../pages/placeholders/PlaceholderPage'
import { placeholderRoutes } from './routeConfig'
import { LoginPage } from '../pages/auth/LoginPage'
import { RegisterPage } from '../pages/auth/RegisterPage'
import { ForgotPasswordPage } from '../pages/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '../pages/auth/ResetPasswordPage'
import { VerifyEmailPage } from '../pages/auth/VerifyEmailPage'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { AccountPage } from '../pages/AccountPage'

export function AppRoutes() {
  return (
    <Routes>
      {/* Auth routes — full-screen tanpa navbar/footer */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/auth/mfa" element={<Navigate to="/settings" replace />} />

      {/* Routes utama — dengan FloatingNavbar dan Footer */}
      <Route element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        <Route element={<ProtectedRoute />}><Route path="/dashboard" element={<AccountPage />} /></Route>
        <Route element={<ProtectedRoute admin />}><Route path="/admin/dashboard" element={<AccountPage admin />} /></Route>
        {placeholderRoutes.map(({ path, title, access }) => (
          access === 'public' ? <Route key={path} path={path} element={<PlaceholderPage title={title} access={access} />} /> :
          <Route key={path} element={<ProtectedRoute admin={access === 'admin'} />}><Route path={path} element={path === '/settings' ? <AccountPage settings /> : <PlaceholderPage title={title} access={access} />} /></Route>
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
