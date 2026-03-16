import { Navigate } from 'react-router-dom'
import useAuthStore from '../store/authStore'

const ROLE_DASHBOARDS = {
  ADMIN: '/admin/dashboard',
  WORKER: '/worker/dashboard',
  SELLER: '/seller/dashboard',
}

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    const ownDashboard = ROLE_DASHBOARDS[user?.role] || '/login'
    return <Navigate to={ownDashboard} replace />
  }

  return children
}
