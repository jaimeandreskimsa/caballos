export interface Horse {
  id: string;
  name: string;
  feiId?: string;
  age: number;
  breed: string;
  studbook?: string;
  gender: 'stallion' | 'mare' | 'gelding';
  color?: string;
  country: string;
  sire?: string;       // padre
  dam?: string;        // madre
  damSire?: string;    // abuelo materno
  rider?: string;
  owner?: string;
  imageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompetitionResult {
  id: string;
  horseId: string;
  horseName: string;
  eventName: string;
  eventDate: string;
  level: JumpingLevel;
  placement?: number;
  totalEntries?: number;
  faults: number;
  time?: number;
  clear: boolean;
  country: string;
  source: 'FEI' | 'JUMPR' | 'FPH' | 'MANUAL';
}

export type JumpingLevel =
  | '1.00m' | '1.10m' | '1.20m' | '1.25m' | '1.30m'
  | '1.35m' | '1.40m' | '1.45m' | '1.50m' | '1.55m'
  | '1.60m' | 'GP' | 'GP*' | 'GP**';

export interface Valuation {
  id: string;
  horseId: string;
  horseName: string;
  date: string;
  valueMin: number;
  valueMax: number;
  valueMid: number;
  currency: 'USD' | 'EUR';
  scores: ValuationScores;
  comparables: ComparableSale[];
  projection2y: number;
  risk: 'low' | 'medium' | 'high';
  percentile: number;
  notes?: string;
}

export interface ValuationScores {
  performance: number;    // 0–100
  breeding: number;       // 0–100
  agePotential: number;   // 0–100
  marketDemand: number;   // 0–100
  overall: number;        // 0–100
}

export interface ComparableSale {
  horseName: string;
  saleDate: string;
  salePrice: number;
  currency: 'USD' | 'EUR';
  age: number;
  level: JumpingLevel;
  source: string;
  similarity: number; // 0–100
}

export interface MarketIndex {
  date: string;
  indexValue: number;
  level: JumpingLevel | 'ALL';
  avgPrice: number;
  volume: number;
}

export interface ScrapeJob {
  id: string;
  source: DataSource;
  status: 'pending' | 'running' | 'done' | 'error';
  startedAt?: string;
  finishedAt?: string;
  recordsFound: number;
  error?: string;
}

export type DataSource =
  | 'FEI'
  | 'FEI_ARG'
  | 'FEI_BRA'
  | 'JUMPR'
  | 'FPH'
  | 'FEDECUARG'
  | 'CBH'
  | 'EQUIPE'
  | 'DATAFECH'
  | 'FDM_REMATES'
  | 'MANUAL';

// ─── DB Horse (extended, all sources) ───────────────────────────────────────
export interface DBHorse {
  id: string;
  name: string;
  nameLower: string;           // for fast search
  feiId?: string;
  birthYear?: number;
  breed?: string;
  studbook?: string;
  gender?: 'stallion' | 'mare' | 'gelding';
  color?: string;
  countryCode: string;         // ISO2: AR, BR, CL, etc.
  sire?: string;
  dam?: string;
  damSire?: string;
  currentRider?: string;
  owner?: string;
  haras?: string;
  sources: DataSource[];       // which sources provided data
  firstSeen: string;           // ISO date
  lastUpdated: string;
}

// ─── DB Competition Result (all sources) ────────────────────────────────────
export interface DBResult {
  id: string;
  horseId: string;             // references DBHorse.id
  horseName: string;
  horseNameNorm: string;       // normalized for dedup
  riderName?: string;
  eventName: string;
  eventId?: string;            // FEI/Equipe event ID
  eventDate: string;           // ISO date YYYY-MM-DD
  eventCountry: string;
  club?: string;
  level: JumpingLevel;
  category?: string;           // e.g. "CSI1*", "CICO A", "GP"
  placement?: number;
  totalEntries?: number;
  faults: number;
  timeFaults?: number;
  jumpFaults?: number;
  time?: number;               // seconds
  clear: boolean;              // double clear
  phase?: 'Q' | 'F' | '1' | '2' | 'JO'; // qualifier / final / barrage
  points?: number;             // ranking points awarded
  source: DataSource;
  rawData?: string;            // original JSON/HTML snippet for debugging
  importedAt: string;
}

// ─── DB Sale / Auction result ─────────────────────────────────────────────
export interface DBSale {
  id: string;
  horseName: string;
  horseId?: string;
  auctionHouse: string;        // "Fin del Mundo", "Haras Henry Jota", etc.
  auctionName: string;
  saleDate: string;
  salePriceARS?: number;
  salePriceUSD?: number;
  salePriceEUR?: number;
  lots?: number;
  haras?: string;
  country: string;
  url: string;
  source: DataSource;
  importedAt: string;
}

// ─── DB Event / Competition ────────────────────────────────────────────────
export interface DBEvent {
  id: string;
  name: string;
  country: string;
  club?: string;
  startDate: string;
  endDate?: string;
  level?: string;              // "CSI1*", "CSI2*", "CICO A", etc.
  discipline: 'SALTO' | 'DRESSAGE' | 'CCE' | 'OTHER';
  resultsUrl?: string;
  pdfUrl?: string;             // Google Drive or direct PDF
  source: DataSource;
  hasResults: boolean;
  importedAt: string;
}

// ─── DB Stats aggregate per horse ────────────────────────────────────────
export interface DBHorseStats {
  horseId: string;
  totalResults: number;
  clearRounds: number;
  clearRoundPct: number;
  avgPlacement?: number;
  bestPlacement?: number;
  topLevelReached: JumpingLevel;
  countriesCompeted: string[];
  lastCompetitionDate?: string;
  updatedAt: string;
}
