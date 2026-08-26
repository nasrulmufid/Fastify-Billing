import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from "react"

import { addMonthsToExpiry } from "./dateUtils"
import api from "./axios"
import { useAuthStore } from "@/store/useAppStore"

/* ---------- types ---------- */
export interface Customer {
  id: string
  code: string
  name: string
  email: string
  phone: string
  address: string
  packageName: string
  status: "Active" | "Isolated" | "Pending"
  ipAddress: string
  router: string
  pppoeUsername: string
  pppoePassword: string
  loginUsername: string
  loginPassword: string
  odpId: string
  gps: string
  lastPayment: string
  expiryDate: string
  joinDate: string
}

export type CustomerInput = Omit<
  Customer,
  "id" | "code" | "status" | "lastPayment" | "expiryDate" | "joinDate"
>

type Action =
  | { type: "ADD_CUSTOMER"; payload: CustomerInput }
  | { type: "UPDATE_CUSTOMER"; payload: Customer }
  | { type: "DELETE_CUSTOMER"; payload: string }
  | { type: "SET_STATUS"; payload: { id: string; status: Customer["status"] } }
  | { type: "SET_EXPIRY"; payload: { id: string; expiryDate: string } }
  | { type: "EXTEND_EXPIRY"; payload: { id: string; months: number } }
  | { type: "SET_CUSTOMERS"; payload: Customer[] }
  | { type: "UPSERT_CUSTOMER"; payload: Customer }

/* ---------- initial seed ---------- */
const seed: Customer[] = [
  {
    id: "1", code: "001001", name: "Budi Santoso", email: "budi@email.com", phone: "0812-3456-7890",
    address: "RT 02 / RW 04, Kel. Merdeka", packageName: "Paket 20 Mbps",
    status: "Active", ipAddress: "192.168.1.2", router: "Mikrotik-Core-01",
    pppoeUsername: "ppp-budi", pppoePassword: "budi#2026", loginUsername: "budi.santoso", loginPassword: "budi2026", odpId: "ODP-01 / Port 4", gps: "-6.9175, 107.6191",
    lastPayment: "2026-08-02", expiryDate: "10 September 2026", joinDate: "12 Januari 2025",
  },
  {
    id: "2", code: "001002", name: "Siti Aminah", email: "siti@email.com", phone: "0813-9876-5432",
    address: "RT 01 / RW 05, Kel. Harapan", packageName: "Paket 10 Mbps",
    status: "Pending", ipAddress: "192.168.1.3", router: "Mikrotik-Core-01",
    pppoeUsername: "ppp-siti", pppoePassword: "siti#2026", loginUsername: "siti.aminah", loginPassword: "siti2026", odpId: "ODP-02 / Port 1", gps: "-6.9180, 107.6195",
    lastPayment: "2026-07-15", expiryDate: "05 Agustus 2026", joinDate: "20 Maret 2025",
  },
  {
    id: "3", code: "001003", name: "Rizki Putra", email: "rizki@email.com", phone: "0815-1111-2222",
    address: "RT 03 / RW 02, Kel. Sejahtera", packageName: "Paket 30 Mbps",
    status: "Isolated", ipAddress: "192.168.1.4", router: "Mikrotik-Core-02",
    pppoeUsername: "ppp-rizki", pppoePassword: "rizki#2026", loginUsername: "rizki.putra", loginPassword: "rizki2026", odpId: "ODP-03 / Port 2", gps: "-6.9170, 107.6188",
    lastPayment: "2026-07-20", expiryDate: "01 Agustus 2026", joinDate: "05 April 2025",
  },
  {
    id: "4", code: "001004", name: "Dewi Lestari", email: "dewi@email.com", phone: "0821-3344-5566",
    address: "Jl. Melati No. 12, Kel. Cempaka", packageName: "Paket 50 Mbps",
    status: "Active", ipAddress: "192.168.1.5", router: "Radius-ISP-01",
    pppoeUsername: "ppp-dewi", pppoePassword: "dewi#2026", loginUsername: "dewi.lestari", loginPassword: "dewi2026", odpId: "ODP-01 / Port 6", gps: "-6.9160, 107.6200",
    lastPayment: "2026-08-01", expiryDate: "15 September 2026", joinDate: "18 Juni 2025",
  },
  {
    id: "5", code: "001005", name: "Agus Wijaya", email: "agus@email.com", phone: "0856-7777-8899",
    address: "Jl. Kenanga No. 5, Kel. Mawar", packageName: "Paket 20 Mbps",
    status: "Active", ipAddress: "192.168.1.6", router: "Mikrotik-Core-01",
    pppoeUsername: "ppp-agus", pppoePassword: "agus#2026", loginUsername: "agus.wijaya", loginPassword: "agus2026", odpId: "ODP-02 / Port 3", gps: "-6.9185, 107.6210",
    lastPayment: "2026-07-28", expiryDate: "28 Agustus 2026", joinDate: "02 Februari 2025",
  },
  {
    id: "6", code: "001006", name: "Nur Aini", email: "nur@email.com", phone: "0812-9090-8080",
    address: "RT 04 / RW 03, Kel. Damai", packageName: "Paket 10 Mbps",
    status: "Pending", ipAddress: "192.168.1.7", router: "Mikrotik-Core-02",
    pppoeUsername: "ppp-nur", pppoePassword: "nur#2026", loginUsername: "nur.aini", loginPassword: "nur2026", odpId: "ODP-03 / Port 5", gps: "-6.9155, 107.6199",
    lastPayment: "-", expiryDate: "20 Agustus 2026", joinDate: "25 Juli 2026",
  },
  {
    id: "7", code: "001007", name: "Hendra Gunawan", email: "hendra@email.com", phone: "0857-2222-1111",
    address: "Jl. Flamboyan No. 8, Kel. Asri", packageName: "Paket 30 Mbps",
    status: "Active", ipAddress: "192.168.1.8", router: "Mikrotik-Core-01",
    pppoeUsername: "ppp-hendra", pppoePassword: "hendra#2026", loginUsername: "hendra.gunawan", loginPassword: "hendra2026", odpId: "ODP-01 / Port 8", gps: "-6.9190, 107.6180",
    lastPayment: "2026-07-30", expiryDate: "30 Agustus 2026", joinDate: "11 Mei 2025",
  },
  {
    id: "8", code: "001008", name: "Ratna Sari", email: "ratna@email.com", phone: "0813-5555-4444",
    address: "RT 02 / RW 06, Kel. Karya", packageName: "Paket 10 Mbps",
    status: "Isolated", ipAddress: "192.168.1.9", router: "Radius-ISP-01",
    pppoeUsername: "ppp-ratna", pppoePassword: "ratna#2026", loginUsername: "ratna.sari", loginPassword: "ratna2026", odpId: "ODP-02 / Port 7", gps: "-6.9148, 107.6205",
    lastPayment: "2026-07-10", expiryDate: "10 Agustus 2026", joinDate: "15 September 2025",
  },
  {
    id: "9", code: "001009", name: "Fajar Ramadhan", email: "fajar@email.com", phone: "0822-6666-7777",
    address: "Jl. Anggrek No. 21, Kel. Indah", packageName: "Paket 50 Mbps",
    status: "Active", ipAddress: "192.168.1.10", router: "Mikrotik-Core-02",
    pppoeUsername: "ppp-fajar", pppoePassword: "fajar#2026", loginUsername: "fajar.ramadhan", loginPassword: "fajar2026", odpId: "ODP-03 / Port 1", gps: "-6.9172, 107.6178",
    lastPayment: "2026-08-05", expiryDate: "05 Oktober 2026", joinDate: "23 Januari 2025",
  },
  {
    id: "10", code: "001010", name: "Maya Anggraini", email: "maya@email.com", phone: "0856-8888-9999",
    address: "RT 01 / RW 02, Kel. Sentosa", packageName: "Paket 20 Mbps",
    status: "Active", ipAddress: "192.168.1.11", router: "Mikrotik-Core-01",
    pppoeUsername: "ppp-maya", pppoePassword: "maya#2026", loginUsername: "maya.anggraini", loginPassword: "maya2026", odpId: "ODP-01 / Port 2", gps: "-6.9165, 107.6193",
    lastPayment: "2026-07-25", expiryDate: "25 Agustus 2026", joinDate: "30 April 2025",
  },
  {
    id: "11", code: "001011", name: "Yudi Pratama", email: "yudi@email.com", phone: "0812-1212-3434",
    address: "Jl. Dahlia No. 3, Kel. Bahagia", packageName: "Paket 30 Mbps",
    status: "Pending", ipAddress: "192.168.1.12", router: "Mikrotik-Core-02",
    pppoeUsername: "ppp-yudi", pppoePassword: "yudi#2026", loginUsername: "yudi.pratama", loginPassword: "yudi2026", odpId: "ODP-02 / Port 9", gps: "-6.9182, 107.6215",
    lastPayment: "-", expiryDate: "18 Agustus 2026", joinDate: "01 Agustus 2026",
  },
  {
    id: "12", code: "001012", name: "Sari Wulandari", email: "sari@email.com", phone: "0857-7777-0000",
    address: "RT 05 / RW 04, Kel. Rukun", packageName: "Paket 10 Mbps",
    status: "Active", ipAddress: "192.168.1.13", router: "Radius-ISP-01",
    pppoeUsername: "ppp-sari", pppoePassword: "sari#2026", loginUsername: "sari.wulandari", loginPassword: "sari2026", odpId: "ODP-03 / Port 6", gps: "-6.9150, 107.6185",
    lastPayment: "2026-08-03", expiryDate: "03 September 2026", joinDate: "14 Juli 2025",
  },
  {
    id: "13", code: "001013", name: "Bambang Susilo", email: "bambang@email.com", phone: "0813-4444-3333",
    address: "Jl. Cendana No. 15, Kel. Makmur", packageName: "Paket 20 Mbps",
    status: "Isolated", ipAddress: "192.168.1.14", router: "Mikrotik-Core-01",
    pppoeUsername: "ppp-bambang", pppoePassword: "bambang#2026", loginUsername: "bambang.susilo", loginPassword: "bambang2026", odpId: "ODP-01 / Port 10", gps: "-6.9178, 107.6208",
    lastPayment: "2026-06-30", expiryDate: "30 Juli 2026", joinDate: "09 Maret 2025",
  },
  {
    id: "14", code: "001014", name: "Intan Permata", email: "intan@email.com", phone: "0821-9999-8888",
    address: "RT 03 / RW 05, Kel. Lestari", packageName: "Paket 50 Mbps",
    status: "Active", ipAddress: "192.168.1.15", router: "Mikrotik-Core-02",
    pppoeUsername: "ppp-intan", pppoePassword: "intan#2026", loginUsername: "intan.permata", loginPassword: "intan2026", odpId: "ODP-02 / Port 4", gps: "-6.9168, 107.6190",
    lastPayment: "2026-08-04", expiryDate: "04 Oktober 2026", joinDate: "27 Mei 2025",
  },
  {
    id: "15", code: "001015", name: "Eko Prasetyo", email: "eko@email.com", phone: "0856-3333-2222",
    address: "Jl. Teratai No. 9, Kel. Aman", packageName: "Paket 10 Mbps",
    status: "Active", ipAddress: "192.168.1.16", router: "Mikrotik-Core-01",
    pppoeUsername: "ppp-eko", pppoePassword: "eko#2026", loginUsername: "eko.prasetyo", loginPassword: "eko2026", odpId: "ODP-03 / Port 8", gps: "-6.9195, 107.6175",
    lastPayment: "2026-07-22", expiryDate: "22 Agustus 2026", joinDate: "19 Oktober 2025",
  },
  {
    id: "16", code: "001016", name: "Lina Marlina", email: "lina@email.com", phone: "0812-4545-6767",
    address: "RT 06 / RW 03, Kel. Sukma", packageName: "Paket 20 Mbps",
    status: "Pending", ipAddress: "192.168.1.17", router: "Radius-ISP-01",
    pppoeUsername: "ppp-lina", pppoePassword: "lina#2026", loginUsername: "lina.marlina", loginPassword: "lina2026", odpId: "ODP-01 / Port 12", gps: "-6.9140, 107.6212",
    lastPayment: "-", expiryDate: "12 Agustus 2026", joinDate: "28 Juli 2026",
  },
  {
    id: "17", code: "001017", name: "Adi Saputra", email: "adi@email.com", phone: "0813-1111-2222",
    address: "Jl. Mawar No. 7, Kel. Cempaka", packageName: "Paket 30 Mbps",
    status: "Active", ipAddress: "192.168.1.18", router: "Mikrotik-Core-01",
    pppoeUsername: "ppp-adi", pppoePassword: "adi#2026", loginUsername: "adi.saputra", loginPassword: "adi2026", odpId: "ODP-02 / Port 5", gps: "-6.9162, 107.6189",
    lastPayment: "2026-08-01", expiryDate: "01 September 2026", joinDate: "15 Agustus 2025",
  },
  {
    id: "18", code: "001018", name: "Rina Kartika", email: "rina@email.com", phone: "0857-2222-3333",
    address: "RT 03 / RW 01, Kel. Mawar", packageName: "Paket 20 Mbps",
    status: "Active", ipAddress: "192.168.1.19", router: "Mikrotik-Core-02",
    pppoeUsername: "ppp-rina", pppoePassword: "rina#2026", loginUsername: "rina.kartika", loginPassword: "rina2026", odpId: "ODP-03 / Port 3", gps: "-6.9177, 107.6202",
    lastPayment: "2026-07-29", expiryDate: "29 Agustus 2026", joinDate: "03 September 2025",
  },
  {
    id: "19", code: "001019", name: "Toni Hidayat", email: "toni@email.com", phone: "0821-3333-4444",
    address: "Jl. Kamboja No. 4, Kel. Indah", packageName: "Paket 10 Mbps",
    status: "Isolated", ipAddress: "192.168.1.20", router: "Radius-ISP-01",
    pppoeUsername: "ppp-toni", pppoePassword: "toni#2026", loginUsername: "toni.hidayat", loginPassword: "toni2026", odpId: "ODP-01 / Port 15", gps: "-6.9158, 107.6179",
    lastPayment: "2026-06-25", expiryDate: "25 Juli 2026", joinDate: "11 November 2024",
  },
  {
    id: "20", code: "001020", name: "Putri Melati", email: "putri@email.com", phone: "0856-4444-5555",
    address: "RT 02 / RW 05, Kel. Lestari", packageName: "Paket 50 Mbps",
    status: "Active", ipAddress: "192.168.1.21", router: "Mikrotik-Core-01",
    pppoeUsername: "ppp-putri", pppoePassword: "putri#2026", loginUsername: "putri.melati", loginPassword: "putri2026", odpId: "ODP-02 / Port 8", gps: "-6.9188, 107.6218",
    lastPayment: "2026-08-05", expiryDate: "05 September 2026", joinDate: "22 Februari 2025",
  },
  {
    id: "21", code: "001021", name: "Andi Firmansyah", email: "andi@email.com", phone: "0812-5555-6666",
    address: "Jl. Anggrek No. 18, Kel. Damai", packageName: "Paket 20 Mbps",
    status: "Pending", ipAddress: "192.168.1.22", router: "Mikrotik-Core-02",
    pppoeUsername: "ppp-andi", pppoePassword: "andi#2026", loginUsername: "andi.firmansyah", loginPassword: "andi2026", odpId: "ODP-03 / Port 7", gps: "-6.9145, 107.6197",
    lastPayment: "-", expiryDate: "22 Agustus 2026", joinDate: "02 Agustus 2026",
  },
  {
    id: "22", code: "001022", name: "Sri Wahyuni", email: "sri@email.com", phone: "0857-6666-7777",
    address: "RT 04 / RW 02, Kel. Karya", packageName: "Paket 10 Mbps",
    status: "Active", ipAddress: "192.168.1.23", router: "Radius-ISP-01",
    pppoeUsername: "ppp-sri", pppoePassword: "sri#2026", loginUsername: "sri.wahyuni", loginPassword: "sri2026", odpId: "ODP-01 / Port 9", gps: "-6.9173, 107.6183",
    lastPayment: "2026-07-31", expiryDate: "31 Agustus 2026", joinDate: "17 Oktober 2025",
  },
  {
    id: "23", code: "001023", name: "Deni Kurniawan", email: "deni@email.com", phone: "0813-7777-8888",
    address: "Jl. Flamboyan No. 11, Kel. Asri", packageName: "Paket 30 Mbps",
    status: "Isolated", ipAddress: "192.168.1.24", router: "Mikrotik-Core-01",
    pppoeUsername: "ppp-deni", pppoePassword: "deni#2026", loginUsername: "deni.kurniawan", loginPassword: "deni2026", odpId: "ODP-02 / Port 12", gps: "-6.9191, 107.6207",
    lastPayment: "2026-07-05", expiryDate: "05 Agustus 2026", joinDate: "08 Desember 2024",
  },
  {
    id: "24", code: "001024", name: "Wulan Sari", email: "wulan@email.com", phone: "0822-8888-9999",
    address: "RT 01 / RW 06, Kel. Rukun", packageName: "Paket 20 Mbps",
    status: "Active", ipAddress: "192.168.1.25", router: "Mikrotik-Core-02",
    pppoeUsername: "ppp-wulan", pppoePassword: "wulan#2026", loginUsername: "wulan.sari", loginPassword: "wulan2026", odpId: "ODP-03 / Port 10", gps: "-6.9152, 107.6215",
    lastPayment: "2026-08-04", expiryDate: "04 September 2026", joinDate: "29 Maret 2025",
  },
  {
    id: "25", code: "001025", name: "Bagus Prasetyo", email: "bagus@email.com", phone: "0856-9999-0000",
    address: "Jl. Cendana No. 22, Kel. Makmur", packageName: "Paket 50 Mbps",
    status: "Active", ipAddress: "192.168.1.26", router: "Radius-ISP-01",
    pppoeUsername: "ppp-bagus", pppoePassword: "bagus#2026", loginUsername: "bagus.prasetyo", loginPassword: "bagus2026", odpId: "ODP-01 / Port 18", gps: "-6.9180, 107.6196",
    lastPayment: "2026-08-06", expiryDate: "06 September 2026", joinDate: "14 Juni 2025",
  },
  {
    id: "26", code: "001026", name: "Fitri Handayani", email: "fitri@email.com", phone: "0812-0000-1111",
    address: "RT 05 / RW 03, Kel. Sentosa", packageName: "Paket 10 Mbps",
    status: "Pending", ipAddress: "192.168.1.27", router: "Mikrotik-Core-01",
    pppoeUsername: "ppp-fitri", pppoePassword: "fitri#2026", loginUsername: "fitri.handayani", loginPassword: "fitri2026", odpId: "ODP-02 / Port 14", gps: "-6.9169, 107.6187",
    lastPayment: "-", expiryDate: "19 Agustus 2026", joinDate: "30 Juli 2026",
  },
  {
    id: "27", code: "001027", name: "Gilang Ramadhan", email: "gilang@email.com", phone: "0857-1111-2222",
    address: "Jl. Melati No. 30, Kel. Cempaka", packageName: "Paket 30 Mbps",
    status: "Active", ipAddress: "192.168.1.28", router: "Mikrotik-Core-02",
    pppoeUsername: "ppp-gilang", pppoePassword: "gilang#2026", loginUsername: "gilang.ramadhan", loginPassword: "gilang2026", odpId: "ODP-03 / Port 4", gps: "-6.9147, 107.6201",
    lastPayment: "2026-07-27", expiryDate: "27 Agustus 2026", joinDate: "05 November 2025",
  },
  {
    id: "28", code: "001028", name: "Ayu Lestari", email: "ayu@email.com", phone: "0821-2222-3333",
    address: "RT 03 / RW 04, Kel. Bahagia", packageName: "Paket 20 Mbps",
    status: "Active", ipAddress: "192.168.1.29", router: "Radius-ISP-01",
    pppoeUsername: "ppp-ayu", pppoePassword: "ayu#2026", loginUsername: "ayu.lestari", loginPassword: "ayu2026", odpId: "ODP-01 / Port 6", gps: "-6.9183, 107.6192",
    lastPayment: "2026-08-03", expiryDate: "03 September 2026", joinDate: "21 April 2025",
  },
  {
    id: "29", code: "001029", name: "Reza Maulana", email: "reza@email.com", phone: "0856-3333-4444",
    address: "Jl. Kenanga No. 14, Kel. Mawar", packageName: "Paket 10 Mbps",
    status: "Isolated", ipAddress: "192.168.1.30", router: "Mikrotik-Core-01",
    pppoeUsername: "ppp-reza", pppoePassword: "reza#2026", loginUsername: "reza.maulana", loginPassword: "reza2026", odpId: "ODP-02 / Port 16", gps: "-6.9175, 107.6210",
    lastPayment: "2026-06-18", expiryDate: "18 Juli 2026", joinDate: "12 Agustus 2024",
  },
  {
    id: "30", code: "001030", name: "Citra Ayu", email: "citra@email.com", phone: "0813-4444-5555",
    address: "RT 06 / RW 05, Kel. Harapan", packageName: "Paket 20 Mbps",
    status: "Active", ipAddress: "192.168.1.31", router: "Mikrotik-Core-02",
    pppoeUsername: "ppp-citra", pppoePassword: "citra#2026", loginUsername: "citra.ayu", loginPassword: "citra2026", odpId: "ODP-03 / Port 11", gps: "-6.9156, 107.6198",
    lastPayment: "2026-07-26", expiryDate: "26 Agustus 2026", joinDate: "09 Juli 2025",
  },
]

/* ---------- reducer ---------- */
function customerReducer(state: Customer[], action: Action): Customer[] {
  switch (action.type) {
    case "ADD_CUSTOMER": {
      const now = new Date()
      const id = String(Date.now())
      const newCustomer: Customer = {
        ...action.payload,
        id,
        code: String(state.length + 1001).padStart(6, '0'),
        status: "Active",
        lastPayment: "-",
        expiryDate: `${now.getDate()} ${now.toLocaleString("id-ID", { month: "long" })} ${now.getFullYear()}`,
        joinDate: `${now.getDate()} ${now.toLocaleString("id-ID", { month: "long" })} ${now.getFullYear()}`,
      }
      return [...state, newCustomer]
    }
    case "UPDATE_CUSTOMER":
      return state.map((c) => (c.id === action.payload.id ? action.payload : c))
    case "DELETE_CUSTOMER":
      return state.filter((c) => c.id !== action.payload)
    case "SET_STATUS":
      return state.map((c) => (c.id === action.payload.id ? { ...c, status: action.payload.status } : c))
    case "SET_EXPIRY":
      return state.map((c) => (c.id === action.payload.id ? { ...c, expiryDate: action.payload.expiryDate } : c))
    case "EXTEND_EXPIRY":
      return state.map((c) =>
        c.id === action.payload.id
          ? { ...c, status: "Active" as const, expiryDate: addMonthsToExpiry(c.expiryDate, action.payload.months) }
          : c
      )
    case "SET_CUSTOMERS":
      return action.payload
    case "UPSERT_CUSTOMER": {
      const exists = state.some((c) => c.id === action.payload.id)
      return exists
        ? state.map((c) => (c.id === action.payload.id ? action.payload : c))
        : [...state, action.payload]
    }
    default:
      return state
  }
}

/* ---------- mapping API -> Customer ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCustomerFromApi(c: any): Customer {
  return {
    id: String(c.id),
    code: c.code,
    name: c.name,
    email: c.email ?? "",
    phone: c.phone,
    address: c.address ?? "",
    packageName: c.packageName ?? "",
    status: c.status,
    ipAddress: c.ipAddress,
    router: c.router ?? "",
    pppoeUsername: c.pppoeUsername,
    pppoePassword: c.pppoePassword,
    loginUsername: c.loginUsername,
    loginPassword: c.loginPassword,
    odpId: c.odpId ?? "",
    gps: c.gps ?? "",
    lastPayment: c.lastPayment ?? "-",
    expiryDate: c.expiryDate ?? "",
    joinDate: c.joinDate ?? "",
  }
}

/* Cache mapping nama -> id utk payload API (package/router) */
let pkgIdCache: Record<string, number> = {}
let routerIdCache: Record<string, number> = {}

async function ensureMaps() {
  if (Object.keys(pkgIdCache).length && Object.keys(routerIdCache).length) return
  const [pkgs, routers] = await Promise.all([api.get("/packages"), api.get("/routers")])
  for (const p of pkgs.data.data) pkgIdCache[p.name] = Number(p.id)
  for (const r of routers.data.data) routerIdCache[r.name] = Number(r.id)
}

/* ---------- context ---------- */
const CustomerCtx = createContext<Customer[]>([])
const DispatchCtx = createContext<Dispatch<Action>>(() => {})

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customers, dispatch] = useReducer(customerReducer, seed)
  const token = useAuthStore((s) => s.token)

  // Hydrate dari backend Fastify (fasty-api) saat sudah login. Gagal -> tetap pakai seed.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    api
      .get("/customers", { params: { limit: 100 } })
      .then(({ data }) => {
        if (cancelled) return
        dispatch({ type: "SET_CUSTOMERS", payload: data.data.map(mapCustomerFromApi) })
      })
      .catch((err) => console.warn("Gagal memuat pelanggan dari API:", err?.message))
    return () => {
      cancelled = true
    }
  }, [token])

  return (
    <CustomerCtx.Provider value={customers}>
      <DispatchCtx.Provider value={dispatch}>{children}</DispatchCtx.Provider>
    </CustomerCtx.Provider>
  )
}

/* ---------- hook ---------- */
export function useCustomers() {
  return useContext(CustomerCtx)
}

export function useCustomerDispatch() {
  return useContext(DispatchCtx)
}

export function useCustomer(id: string | undefined) {
  const customers = useCustomers()
  if (!id) return undefined
  return customers.find((c) => c.id === id)
}

export function useCustomerActions() {
  const dispatch = useCustomerDispatch()
  const customers = useCustomers()

  const add = useCallback(
    async (input: CustomerInput) => {
      try {
        await ensureMaps()
        const payload: Record<string, unknown> = {
          name: input.name,
          phone: input.phone,
          email: input.email,
          address: input.address,
          ipAddress: input.ipAddress,
          pppoeUsername: input.pppoeUsername,
          pppoePassword: input.pppoePassword,
          loginUsername: input.loginUsername,
          loginPassword: input.loginPassword,
          odpId: input.odpId,
          gps: input.gps,
          packageId: input.packageName ? (pkgIdCache[input.packageName] ?? null) : null,
          routerId: input.router ? (routerIdCache[input.router] ?? null) : null,
        }
        const { data } = await api.post("/customers", payload)
        dispatch({ type: "UPSERT_CUSTOMER", payload: mapCustomerFromApi(data.data) })
      } catch (err) {
        console.error("Gagal menambah pelanggan:", err)
      }
    },
    [dispatch],
  )

  const update = useCallback(
    async (customer: Customer) => {
      try {
        await ensureMaps()
        const payload: Record<string, unknown> = {
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          address: customer.address,
          ipAddress: customer.ipAddress,
          pppoeUsername: customer.pppoeUsername,
          pppoePassword: customer.pppoePassword,
          loginUsername: customer.loginUsername,
          loginPassword: customer.loginPassword,
          odpId: customer.odpId,
          gps: customer.gps,
          packageId: customer.packageName ? (pkgIdCache[customer.packageName] ?? null) : null,
          routerId: customer.router ? (routerIdCache[customer.router] ?? null) : null,
        }
        const { data } = await api.put(`/customers/${customer.id}`, payload)
        dispatch({ type: "UPSERT_CUSTOMER", payload: mapCustomerFromApi(data.data) })
      } catch (err) {
        console.error("Gagal memperbarui pelanggan:", err)
      }
    },
    [dispatch],
  )

  const remove = useCallback(
    async (id: string) => {
      try {
        await api.delete(`/customers/${id}`)
        dispatch({ type: "DELETE_CUSTOMER", payload: id })
      } catch (err) {
        console.error("Gagal menghapus pelanggan:", err)
      }
    },
    [dispatch],
  )

  const setStatus = useCallback(
    async (id: string, status: Customer["status"]) => {
      try {
        const { data } = await api.post(`/network/isolir/${id}`, { isolate: status === "Isolated" })
        dispatch({ type: "UPSERT_CUSTOMER", payload: mapCustomerFromApi(data.data) })
      } catch (err) {
        console.error("Gagal mengubah status:", err)
      }
    },
    [dispatch],
  )

  const setExpiry = useCallback(
    async (id: string, expiryDate: string) => {
      try {
        const { data } = await api.put(`/customers/${id}/expiry`, { expiryDate })
        dispatch({ type: "UPSERT_CUSTOMER", payload: mapCustomerFromApi(data.data) })
      } catch (err) {
        console.error("Gagal mengubah masa aktif:", err)
      }
    },
    [dispatch],
  )

  /** Perpanjang masa aktif N bulan + aktifkan layanan (setelah pembayaran). */
  const extendExpiry = useCallback(
    async (id: string, months: number) => {
      try {
        const { data } = await api.post(`/customers/${id}/extend`, { months })
        dispatch({ type: "UPSERT_CUSTOMER", payload: mapCustomerFromApi(data.data) })
      } catch (err) {
        console.error("Gagal memperpanjang masa aktif:", err)
      }
    },
    [dispatch],
  )

  const nextId = String(customers.length + 1)

  return { add, update, remove, setStatus, setExpiry, extendExpiry, nextId }
}
