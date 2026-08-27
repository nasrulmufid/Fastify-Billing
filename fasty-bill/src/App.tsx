import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom"
import { Toaster } from "sonner"

// Redirect component that reads :id from source route params
function CustomerRedirect() {
  const { id } = useParams<{ id: string }>()
  if (!id) return <Navigate to="/admin/pppoe/customers" replace />
  return <Navigate to={`/admin/pppoe/customers/${id}`} replace />
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
import { PaymentApprovalPage, PaymentDetailPage } from "@/pages/admin/PaymentDetail"
import { PaymentsPage } from "@/pages/admin/PaymentsPage"
import { WAGatewayPage } from "@/pages/admin/WAGatewayPage"
import { SettingsPage } from "@/pages/admin/SettingsPage"
import { TicketDetailPage } from "@/pages/admin/TicketDetail"
import { TicketsPage } from "@/pages/admin/TicketsPage"
import { PppoeCustomersPage } from "@/pages/admin/pppoe/CustomersPage"
import { PppoePackagesPage } from "@/pages/admin/pppoe/PackagesPage"
import { ForgotPasswordPage } from "@/pages/auth/ForgotPasswordPage"
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
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            {/* Admin routes */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
                {/* PPPoE routes */}
                <Route path="pppoe/customers" element={<PppoeCustomersPage />} />
                <Route path="pppoe/customers/:id/*" element={<CustomerLayout />} />
                <Route path="pppoe/packages" element={<PppoePackagesPage />} />
                {/* Legacy routes (redirect) */}
                <Route path="customers" element={<Navigate to="/admin/pppoe/customers" replace />} />
                <Route path="customers/:id/*" element={<CustomerRedirect />} />
                <Route path="packages" element={<Navigate to="/admin/pppoe/packages" replace />} />
                {/* Other routes */}
              <Route path="invoices" element={<InvoicesPage />} />
              <Route path="invoices/new" element={<InvoiceCreatePage />} />
              <Route path="invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="payments/approval" element={<PaymentApprovalPage />} />
              <Route path="payments/:id" element={<PaymentDetailPage />} />
              <Route path="network" element={<NetworkPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="tickets" element={<TicketsPage />} />
              <Route path="tickets/:id" element={<TicketDetailPage />} />
              <Route path="activity-log" element={<ActivityLogPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="wa-gateway" element={<WAGatewayPage />} />
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
