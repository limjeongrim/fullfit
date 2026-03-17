import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import ProtectedRoute from './routes/ProtectedRoute'
import Toast from './components/Toast'
import LoginPage from './pages/LoginPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminInventoryPage from './pages/admin/InventoryPage'
import AdminOrderPage from './pages/admin/OrderPage'
import AdminDeliveryPage from './pages/admin/DeliveryPage'
import AdminSettlementPage from './pages/admin/SettlementPage'
import AdminReturnPage from './pages/admin/ReturnPage'
import AdminChannelSyncPage from './pages/admin/ChannelSyncPage'
import AdminPromotionPage from './pages/admin/PromotionPage'
import AdminForecastPage from './pages/admin/ForecastPage'
import SellerManagementPage from './pages/admin/SellerManagementPage'
import AdminChatPage from './pages/admin/ChatPage'
import DeliveryMapPage from './pages/admin/DeliveryMapPage'
import WorkerDashboard from './pages/worker/WorkerDashboard'
import PickingPage from './pages/worker/PickingPage'
import InboundPage from './pages/worker/InboundPage'
import OutboundPage from './pages/worker/OutboundPage'
import SellerDashboard from './pages/seller/SellerDashboard'
import SellerInventoryPage from './pages/seller/InventoryPage'
import SellerOrderPage from './pages/seller/OrderPage'
import SellerDeliveryPage from './pages/seller/DeliveryPage'
import SellerSettlementPage from './pages/seller/SettlementPage'
import SellerReturnPage from './pages/seller/ReturnPage'
import SellerPromotionPage from './pages/seller/PromotionPage'
import SellerForecastPage from './pages/seller/ForecastPage'

export default function App() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage)

  useEffect(() => {
    loadFromStorage()
  }, [])

  return (
    <BrowserRouter>
      <Toast />
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/admin/*"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <Routes>
                <Route path="dashboard"    element={<AdminDashboard />} />
                <Route path="inventory"    element={<AdminInventoryPage />} />
                <Route path="orders"       element={<AdminOrderPage />} />
                <Route path="deliveries"   element={<AdminDeliveryPage />} />
                <Route path="settlements"  element={<AdminSettlementPage />} />
                <Route path="returns"      element={<AdminReturnPage />} />
                <Route path="channel-sync" element={<AdminChannelSyncPage />} />
                <Route path="promotions"   element={<AdminPromotionPage />} />
                <Route path="forecast"     element={<AdminForecastPage />} />
                <Route path="sellers"       element={<SellerManagementPage />} />
                <Route path="chat"         element={<AdminChatPage />} />
                <Route path="delivery-map" element={<DeliveryMapPage />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Routes>
            </ProtectedRoute>
          }
        />

        <Route
          path="/worker/*"
          element={
            <ProtectedRoute allowedRoles={['WORKER']}>
              <Routes>
                <Route path="dashboard" element={<WorkerDashboard />} />
                <Route path="picking"   element={<PickingPage />} />
                <Route path="inbound"   element={<InboundPage />} />
                <Route path="outbound"  element={<OutboundPage />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Routes>
            </ProtectedRoute>
          }
        />

        <Route
          path="/seller/*"
          element={
            <ProtectedRoute allowedRoles={['SELLER']}>
              <Routes>
                <Route path="dashboard"   element={<SellerDashboard />} />
                <Route path="inventory"   element={<SellerInventoryPage />} />
                <Route path="orders"      element={<SellerOrderPage />} />
                <Route path="deliveries"  element={<SellerDeliveryPage />} />
                <Route path="settlements" element={<SellerSettlementPage />} />
                <Route path="returns"     element={<SellerReturnPage />} />
                <Route path="promotions"  element={<SellerPromotionPage />} />
                <Route path="forecast"    element={<SellerForecastPage />} />
                <Route path="*" element={<Navigate to="dashboard" replace />} />
              </Routes>
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
