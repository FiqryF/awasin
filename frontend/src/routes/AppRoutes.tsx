import { Route, Routes } from 'react-router'
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

export function AppRoutes() {
  return (
    <Routes>
      {/* Auth routes — full-screen tanpa navbar/footer */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      {/* Routes utama — dengan FloatingNavbar dan Footer */}
      <Route element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="/feedback" element={<FeedbackPage />} />
        {placeholderRoutes.map(({ path, title, access }) => (
          <Route key={path} path={path} element={<PlaceholderPage title={title} access={access} />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
