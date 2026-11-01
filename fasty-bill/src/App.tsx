import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom"
import { Toaster } from "sonner"
import { useAuthStore } from "@/store/useAppStore"

// Redirect component that reads :id from source route params
function CustomerRedirect() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <Navigate to="/admin/pppoe/customers" replace />
  return <Navigate to={`/admin/pppoe/customers/${id}`} replace />
}

// Protected route wrapper - block access jika role tidak sesuai
function ProtectedRoute({ 
  children, 
  allowedRoles 
}: { 
  children: React.ReactNode
  allowedRoles?: ("super_admin" | "admin" | "finance" | "teknisi")[]
}) {
  const user = useAuthStore((s) => s.user)
  
  if (!user) {
    return <Navigate to="/login" replace />
  }
  
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect ke dashboard jika tidak punya akses
    return <Navigate to="/admin" replace />
  }
  
  return <>{children}</>
}

import { AdminLayout } from "@/components/layouts/AdminLayout"
import { AuthLayout } from "@/components/layouts/AuthLayout"
import { PortalLayout } from "@/components/layouts/PortalLayout"
import { QueryProvider } from "@/lib/queryProvider"
import { CustomerProvider } from "@/lib/customerStore"
import { PackageProvider } from "@/lib/packageStore"
import { ActivityLogPage } from "@/pages/admin/ActivityLogPage"
import { AdminDashboard } from "@/pages/admin/AdminDashboard"
import { CustomerLayout } from "@/pages/admin/CustomerDetail"
import { InvoiceCreatePage, InvoiceDetailPage } from "@/pages/admin/InvoiceDetail"
import { InvoicesPage } from "@/pages/admin/InvoicesPage"
import { NetworkPage } from "@/pages/admin/NetworkPage"
import { NotificationsPage } from "@/pages/admin/NotificationsPage"
import { TelegramSettingsPage } from "@/pages/admin/TelegramSettingsPage"
import { PaymentApprovalPage, PaymentDetailPage } from "@/pages/admin/PaymentDetail"
import { PaymentsPage } from "@/pages/admin/PaymentsPage"
import { WAGatewayPage } from "@/pages/admin/WAGatewayPage"
import { AcsPage } from "@/pages/admin/AcsPage"
import { AcsConfigPage } from "@/pages/admin/AcsConfigPage"
import { SettingsPage } from "@/pages/admin/SettingsPage"
import { TicketDetailPage } from "@/pages/admin/TicketDetail"
import { TicketsPage } from "@/pages/admin/TicketsPage"
import { PppoeCustomersPage } from "@/pages/admin/pppoe/CustomersPage"
import { PppoePackagesPage } from "@/pages/admin/pppoe/PackagesPage"
import { LoginPage } from "@/pages/auth/LoginPage"
import { PortalLoginPage } from "@/pages/auth/PortalLoginPage"
import { NotFoundPage } from "@/pages/NotFound"
import { PortalAccountPage } from "@/pages/portal/AccountPage"
import { PortalInvoicesPage } from "@/pages/portal/InvoicesPage"
import { PortalPaymentsPage } from "@/pages/portal/PaymentsPage"
import { PortalTicketDetailPage } from "@/pages/portal/TicketDetailPage"
import { PortalTicketsPage } from "@/pages/portal/TicketsPage"
import { PortalHome } from "@/pages/portal/PortalHome"

export function App() {
  return (
    <QueryProvider>
      <CustomerProvider>
        <PackageProvider>
          <BrowserRouter>
          <Routes>
            {/* Root redirect */}
            <Route path="/" element={<Navigate to="/portal" replace />} />

            {/* Login portal pelanggan (di luar PortalLayout agar tidak redirect) */}
            <Route path="/portal/login" element={<PortalLoginPage />} />

            {/* Portal pelanggan */}
            <Route path="/portal" element={<PortalLayout />}>
              <Route index element={<PortalHome />} />
              <Route path="invoices" element={<PortalInvoicesPage />} />
              <Route path="payments" element={<PortalPaymentsPage />} />
              <Route path="tickets" element={<PortalTicketsPage />} />
              <Route path="tickets/:id" element={<PortalTicketDetailPage />} />
              <Route path="account" element={<PortalAccountPage />} />
            </Route>

            {/* Auth routes */}
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            {/* Admin routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
                {/* PPPoE routes — super_admin & admin only */}
                <Route path="pppoe/customers" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><PppoeCustomersPage /></ProtectedRoute>} />
                <Route path="pppoe/customers/:id/*" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><CustomerLayout /></ProtectedRoute>} />
                <Route path="pppoe/packages" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><PppoePackagesPage /></ProtectedRoute>} />
                {/* Legacy routes (redirect) */}
                <Route path="customers" element={<Navigate to="/admin/pppoe/customers" replace />} />
                <Route path="customers/:id/*" element={<CustomerRedirect />} />
                <Route path="packages" element={<Navigate to="/admin/pppoe/packages" replace />} />
                {/* Transaction routes — super_admin, admin, finance */}
              <Route path="invoices" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "finance"]}><InvoicesPage /></ProtectedRoute>} />
              <Route path="invoices/new" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "finance"]}><InvoiceCreatePage /></ProtectedRoute>} />
              <Route path="invoices/:id" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "finance"]}><InvoiceDetailPage /></ProtectedRoute>} />
              <Route path="payments" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "finance"]}><PaymentsPage /></ProtectedRoute>} />
              <Route path="payments/approval" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "finance"]}><PaymentApprovalPage /></ProtectedRoute>} />
              <Route path="payments/:id" element={<ProtectedRoute allowedRoles={["super_admin", "admin", "finance"]}><PaymentDetailPage /></ProtectedRoute>} />
              {/* Network routes — super_admin & admin only */}
              <Route path="network" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><NetworkPage /></ProtectedRoute>} />
              <Route path="acs" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><AcsPage /></ProtectedRoute>} />
              <Route path="acs/config" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><AcsConfigPage /></ProtectedRoute>} />
              {/* Communication routes */}
              <Route path="wa-gateway" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><WAGatewayPage /></ProtectedRoute>} />
              <Route path="telegram" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><TelegramSettingsPage /></ProtectedRoute>} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="tickets" element={<TicketsPage />} />
              <Route path="tickets/:id" element={<TicketDetailPage />} />
              {/* System routes */}
              <Route path="activity-log" element={<ProtectedRoute allowedRoles={["super_admin", "admin"]}><ActivityLogPage /></ProtectedRoute>} />
              <Route path="settings" element={<ProtectedRoute allowedRoles={["super_admin"]}><SettingsPage /></ProtectedRoute>} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
          <Toaster richColors position="top-right" />
          </BrowserRouter>
        </PackageProvider>
      </CustomerProvider>
    </QueryProvider>
  )
}

export default App
