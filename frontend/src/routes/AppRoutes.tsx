import { Route, Routes } from 'react-router'
import { MainLayout } from '../layouts/MainLayout'
import { HomePage } from '../pages/HomePage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { PlaceholderPage } from '../pages/placeholders/PlaceholderPage'
import { placeholderRoutes } from './routeConfig'

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route index element={<HomePage />} />
        {placeholderRoutes.map(({ path, title, access }) => (
          <Route key={path} path={path} element={<PlaceholderPage title={title} access={access} />} />
        ))}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
