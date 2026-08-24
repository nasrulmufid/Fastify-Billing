import axios from "axios"
import { useAuthStore } from "@/store/useAppStore"
import { useCustomerStore } from "@/store/customerStore"

const api = axios.create({
  // Relative path — mengikuti origin browser (localhost:5173 ATAU domain tunnel).
  // Di dev, Vite proxy meneruskan /api → http://localhost:3000.
  baseURL: import.meta.env.VITE_API_URL ?? "/api",
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
})

/** Route yang memakai token customer portal (role "customer"). */
const CUSTOMER_ROUTES = ["/portal", "/auth/customer-login"]

// Request interceptor — attach Bearer token (customer utk portal, admin utk lainnya)
api.interceptors.request.use((config) => {
  const url = config.url ?? ""
  const isCustomerRoute = CUSTOMER_ROUTES.some((p) => url.startsWith(p))
  const token = isCustomerRoute
    ? useCustomerStore.getState().token
    : useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor — handle 401, global errors
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        const url = error.config?.url ?? ""
        const isCustomerRoute = CUSTOMER_ROUTES.some((p) => url.startsWith(p))
        if (isCustomerRoute) {
          useCustomerStore.getState().logout()
          window.location.href = "/portal/login"
        } else {
          useAuthStore.getState().logout()
          window.location.href = "/login"
        }
      }
    }
    return Promise.reject(error)
  },
)

export default api
