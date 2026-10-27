/**
 * Local store for ACS (GenieACS) device management.
 *
 * Keeps filter/search state so it's preserved across navigations.
 */

import { create } from "zustand"

export type AcsDeviceStatusFilter = "all" | "Online" | "Offline"

type AcsFilterState = {
  search: string
  status: AcsDeviceStatusFilter
}

type AcsUiState = {
  /** Filters applied to the device table */
  filters: AcsFilterState
  setSearch: (search: string) => void
  setStatus: (status: AcsDeviceStatusFilter) => void
  resetFilters: () => void
}

const defaultFilters: AcsFilterState = {
  search: "",
  status: "all",
}

export const useAcsStore = create<AcsUiState>((set) => ({
  filters: defaultFilters,

  setSearch: (search) =>
    set((s) => ({ filters: { ...s.filters, search } })),

  setStatus: (status) =>
    set((s) => ({ filters: { ...s.filters, status } })),

  resetFilters: () => set({ filters: defaultFilters }),
}))
