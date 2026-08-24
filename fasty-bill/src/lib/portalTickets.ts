export type PortalTicketStatus = "Dibuka" | "Diproses" | "Selesai"

export interface PortalTicketTimelineEntry {
  status: PortalTicketStatus
  actor: string
  date: string
  note: string
}

export interface PortalTicket {
  id: string
  customer: string
  title: string
  category: string
  date: string
  updatedAt: string
  status: PortalTicketStatus
  description: string
  timeline: PortalTicketTimelineEntry[]
}

export const portalTickets: PortalTicket[] = [
  {
    id: "TCK-1042",
    customer: "Budi Santoso",
    title: "Internet tidak tersambung",
    category: "Gangguan jaringan",
    date: "2 Agustus 2026, 09.12",
    updatedAt: "3 Agustus 2026, 14.05",
    status: "Selesai",
    description:
      "Internet di rumah tidak dapat tersambung sejak pagi. Sudah mencoba restart modem beberapa kali tetapi tetap tidak ada koneksi.",
    timeline: [
      {
        status: "Dibuka",
        actor: "Sistem",
        date: "2 Agustus 2026, 09.12",
        note: "Tiket dibuat otomatis oleh sistem berdasarkan laporan pelanggan.",
      },
      {
        status: "Diproses",
        actor: "Teknisi",
        date: "2 Agustus 2026, 10.30",
        note: "Teknisi diterjunkan ke lokasi untuk pengecekan jaringan.",
      },
      {
        status: "Selesai",
        actor: "Teknisi",
        date: "3 Agustus 2026, 14.05",
        note: "Masalah teratasi — kabel putus di tiang telah diganti.",
      },
    ],
  },
  {
    id: "TCK-1038",
    customer: "Budi Santoso",
    title: "Kecepatan menurun di malam hari",
    category: "Keluhan kecepatan",
    date: "21 Juli 2026, 19.45",
    updatedAt: "22 Juli 2026, 08.15",
    status: "Diproses",
    description:
      "Kecepatan internet turun drastis setiap malam sekitar pukul 19.00–23.00. Pagi hari kecepatan kembali normal.",
    timeline: [
      {
        status: "Dibuka",
        actor: "Sistem",
        date: "21 Juli 2026, 19.45",
        note: "Tiket dibuat otomatis oleh sistem berdasarkan laporan pelanggan.",
      },
      {
        status: "Diproses",
        actor: "Teknisi",
        date: "22 Juli 2026, 08.15",
        note: "Teknisi sedang mengecek beban OLT dan kualitas sinyal di area pelanggan.",
      },
    ],
  },
  {
    id: "TCK-1031",
    customer: "Budi Santoso",
    title: "Permintaan pindah alamat",
    category: "Perubahan layanan",
    date: "8 Juli 2026, 11.20",
    updatedAt: "8 Juli 2026, 11.20",
    status: "Dibuka",
    description:
      "Mohon bantuan untuk pemindahan layanan internet ke alamat baru. Alamat lama: RT 02 / RW 04, Kec. Sukamaju.",
    timeline: [
      {
        status: "Dibuka",
        actor: "Sistem",
        date: "8 Juli 2026, 11.20",
        note: "Tiket dibuat otomatis oleh sistem berdasarkan laporan pelanggan.",
      },
    ],
  },
]

export const portalTicketStatusStyles: Record<
  PortalTicketStatus,
  { badge: string; banner: string; dot: string; text: string }
> = {
  Selesai: {
    badge: "bg-emerald-500/10 text-emerald-600",
    banner: "from-emerald-500/15 to-primary/10",
    dot: "bg-emerald-500",
    text: "text-emerald-600",
  },
  Diproses: {
    badge: "bg-amber-500/10 text-amber-600",
    banner: "from-amber-500/15 to-primary/10",
    dot: "bg-amber-500",
    text: "text-amber-600",
  },
  Dibuka: {
    badge: "bg-blue-500/10 text-blue-600",
    banner: "from-blue-500/15 to-primary/10",
    dot: "bg-blue-500",
    text: "text-blue-600",
  },
}
