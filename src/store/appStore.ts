import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Horse, Valuation, CompetitionResult, ScrapeJob } from '../types';
import type { SyncProgress } from '../services/sync';

interface AppState {
  isAuthenticated: boolean;
  horses: Horse[];
  valuations: Valuation[];
  results: CompetitionResult[];
  scrapeJobs: ScrapeJob[];
  selectedHorseId: string | null;

  // DB sync state (not persisted — refreshed on load)
  syncProgress: SyncProgress | null;
  dbStats: { totalHorses: number; totalResults: number; totalEvents: number; totalSales: number; lastSyncBySource: Record<string, string> } | null;

  login: () => void;
  logout: () => void;
  addHorse: (horse: Horse) => void;
  updateHorse: (id: string, data: Partial<Horse>) => void;
  deleteHorse: (id: string) => void;
  selectHorse: (id: string | null) => void;

  addValuation: (v: Valuation) => void;
  addResults: (r: CompetitionResult[]) => void;
  addScrapeJob: (job: ScrapeJob) => void;
  updateScrapeJob: (id: string, data: Partial<ScrapeJob>) => void;

  setSyncProgress: (p: SyncProgress | null) => void;
  setDbStats: (s: AppState['dbStats']) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      horses: [],
      valuations: [],
      results: [],
      scrapeJobs: [],
      selectedHorseId: null,
      syncProgress: null,
      dbStats: null,

      login: () => set({ isAuthenticated: true }),
      logout: () => set({ isAuthenticated: false }),
      addHorse: (horse) => set((s) => ({
        horses: s.horses.some((h) => h.id === horse.id)
          ? s.horses.map((h) => (h.id === horse.id ? { ...h, ...horse } : h))
          : [...s.horses, horse],
      })),
      updateHorse: (id, data) =>
        set((s) => ({ horses: s.horses.map((h) => (h.id === id ? { ...h, ...data } : h)) })),
      deleteHorse: (id) =>
        set((s) => ({
          horses: s.horses.filter((h) => h.id !== id),
          valuations: s.valuations.filter((v) => v.horseId !== id),
          results: s.results.filter((r) => r.horseId !== id),
        })),
      selectHorse: (id) => set({ selectedHorseId: id }),

      addValuation: (v) => set((s) => ({ valuations: [v, ...s.valuations] })),
      addResults: (r) => set((s) => ({ results: [...s.results, ...r] })),
      addScrapeJob: (job) => set((s) => ({ scrapeJobs: [job, ...s.scrapeJobs] })),
      updateScrapeJob: (id, data) =>
        set((s) => ({
          scrapeJobs: s.scrapeJobs.map((j) => (j.id === id ? { ...j, ...data } : j)),
        })),

      setSyncProgress: (p) => set({ syncProgress: p }),
      setDbStats: (s) => set({ dbStats: s }),
    }),
    {
      name: 'equivalue-storage',
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        const s = persisted as AppState;
        if (version < 2 && s.horses) {
          const seen = new Set<string>();
          s.horses = s.horses.filter((h) => {
            if (seen.has(h.id)) return false;
            seen.add(h.id);
            return true;
          });
        }
        return s;
      },
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        horses: state.horses,
        valuations: state.valuations,
        results: state.results,
        scrapeJobs: state.scrapeJobs,
        selectedHorseId: state.selectedHorseId,
      }),
    }
  )
);
