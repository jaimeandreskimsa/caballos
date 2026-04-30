import type { Horse, CompetitionResult, Valuation, ValuationScores, ComparableSale, JumpingLevel } from '../types';

// ── Scoring helpers ──────────────────────────────────────────────────────────

const LEVEL_RANK: Record<JumpingLevel, number> = {
  '1.00m': 1, '1.10m': 2, '1.20m': 3, '1.25m': 4, '1.30m': 5,
  '1.35m': 6, '1.40m': 7, '1.45m': 8, '1.50m': 9, '1.55m': 10,
  '1.60m': 11, 'GP': 12, 'GP*': 13, 'GP**': 14,
};

// Top sires that command premium (simplified list)
const PREMIUM_SIRES = [
  'Heartbreaker', 'Cornet Obolensky', 'Verdi TN', 'Chacco-Blue',
  'Kannan', 'Numero Uno', 'Zirocco Blue VDL', 'Messenger',
  'Conthargos', 'Qlassic Bois Margot', 'Comme il faut',
];

const TOP_STUDBOOKS = ['KWPN', 'Holsteiner', 'Selle Français', 'Hanoverian', 'BWP', 'Oldenburg'];

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

// ── Performance score ────────────────────────────────────────────────────────

export function calcPerformanceScore(results: CompetitionResult[]): number {
  if (results.length === 0) return 0;

  const recent = results
    .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())
    .slice(0, 30);

  const maxLevel = Math.max(...recent.map((r) => LEVEL_RANK[r.level] ?? 0));
  const levelScore = (maxLevel / 14) * 40; // max 40 pts

  const clearRatio = recent.filter((r) => r.clear).length / recent.length;
  const consistencyScore = clearRatio * 30; // max 30 pts

  const podiums = recent.filter(
    (r) => r.placement && r.placement <= 3 && r.totalEntries && r.totalEntries >= 5
  ).length;
  const podiumScore = clamp((podiums / recent.length) * 30, 0, 30);

  return clamp(levelScore + consistencyScore + podiumScore);
}

// ── Breeding score ──────────────────────────────────────────────────────────

export function calcBreedingScore(horse: Horse): number {
  let score = 30; // base

  if (horse.sire && PREMIUM_SIRES.some((s) => horse.sire!.toLowerCase().includes(s.toLowerCase()))) {
    score += 40;
  } else if (horse.sire) {
    score += 15;
  }

  if (horse.studbook && TOP_STUDBOOKS.includes(horse.studbook)) {
    score += 20;
  }

  if (horse.damSire && PREMIUM_SIRES.some((s) => horse.damSire!.toLowerCase().includes(s.toLowerCase()))) {
    score += 10;
  }

  return clamp(score);
}

// ── Age / potential score ────────────────────────────────────────────────────

export function calcAgePotentialScore(age: number): number {
  // Peak: 9-12, high potential: 5-8, declining: 13+
  if (age <= 4) return 55;
  if (age === 5) return 72;
  if (age === 6) return 80;
  if (age === 7) return 88;
  if (age === 8) return 92;
  if (age >= 9 && age <= 11) return 95;
  if (age === 12) return 90;
  if (age === 13) return 75;
  if (age === 14) return 60;
  if (age === 15) return 45;
  return clamp(45 - (age - 15) * 5);
}

// ── Market demand score ─────────────────────────────────────────────────────

export function calcMarketDemandScore(horse: Horse, results: CompetitionResult[]): number {
  let score = 50;
  const maxLevel = results.length
    ? Math.max(...results.map((r) => LEVEL_RANK[r.level] ?? 0))
    : 0;
  if (maxLevel >= 12) score += 30; // GP horse
  else if (maxLevel >= 9) score += 20; // 1.50+
  else if (maxLevel >= 7) score += 10; // 1.40+

  if (horse.gender === 'mare') score += 5; // mares have breeding premium
  if (horse.studbook && TOP_STUDBOOKS.includes(horse.studbook)) score += 5;

  return clamp(score);
}

// ── Comparable sales (synthetic based on level & age) ───────────────────────

const LEVEL_BASE_PRICE_USD: Record<number, number> = {
  1: 5000, 2: 8000, 3: 15000, 4: 20000, 5: 30000,
  6: 45000, 7: 70000, 8: 100000, 9: 160000, 10: 220000,
  11: 300000, 12: 400000, 13: 550000, 14: 750000,
};

export function generateComparables(horse: Horse, results: CompetitionResult[]): ComparableSale[] {
  const maxLevelRank = results.length
    ? Math.max(...results.map((r) => LEVEL_RANK[r.level] ?? 1))
    : 3;
  const basePrice = LEVEL_BASE_PRICE_USD[maxLevelRank] ?? 15000;

  const comparable = (name: string, ageDiff: number, priceMult: number, sim: number): ComparableSale => ({
    horseName: name,
    saleDate: new Date(Date.now() - Math.random() * 365 * 24 * 3600000).toISOString().split('T')[0],
    salePrice: Math.round(basePrice * priceMult),
    currency: 'USD',
    age: horse.age + ageDiff,
    level: (Object.keys(LEVEL_RANK) as JumpingLevel[]).find((k) => LEVEL_RANK[k] === maxLevelRank) ?? '1.20m',
    source: ['Fences Auction', 'WEF Sale', 'Private Sale', 'Verascht'][Math.floor(Math.random() * 4)],
    similarity: sim,
  });

  return [
    comparable('Comparable A', 0, 1.05, 94),
    comparable('Comparable B', 1, 0.92, 87),
    comparable('Comparable C', -1, 1.12, 81),
    comparable('Comparable D', 2, 0.85, 76),
  ];
}

// ── Main valuation ───────────────────────────────────────────────────────────

export function calculateValuation(horse: Horse, results: CompetitionResult[]): Valuation {
  const perfScore = calcPerformanceScore(results);
  const breedScore = calcBreedingScore(horse);
  const ageScore = calcAgePotentialScore(horse.age);
  const marketScore = calcMarketDemandScore(horse, results);

  const overall = clamp(
    perfScore * 0.40 + breedScore * 0.25 + ageScore * 0.20 + marketScore * 0.15
  );

  const scores: ValuationScores = {
    performance: Math.round(perfScore),
    breeding: Math.round(breedScore),
    agePotential: Math.round(ageScore),
    marketDemand: Math.round(marketScore),
    overall: Math.round(overall),
  };

  const maxLevelRank = results.length
    ? Math.max(...results.map((r) => LEVEL_RANK[r.level] ?? 1))
    : 3;
  const basePrice = LEVEL_BASE_PRICE_USD[maxLevelRank] ?? 15000;

  // Multipliers
  const perfMult = 0.5 + (perfScore / 100) * 1.5;
  const breedMult = 0.8 + (breedScore / 100) * 0.8;
  const ageMult = 0.6 + (ageScore / 100) * 0.8;

  const mid = Math.round(basePrice * perfMult * breedMult * ageMult);
  const spread = mid * 0.20;

  const comparables = generateComparables(horse, results);

  const percentile = Math.round(overall);
  const risk: 'low' | 'medium' | 'high' =
    overall >= 70 ? 'low' : overall >= 45 ? 'medium' : 'high';

  const projection2y = Math.round(((ageScore < 90 ? 1.15 : 0.95) - 1) * 100);

  return {
    id: crypto.randomUUID(),
    horseId: horse.id,
    horseName: horse.name,
    date: new Date().toISOString(),
    valueMin: Math.round(mid - spread),
    valueMax: Math.round(mid + spread),
    valueMid: mid,
    currency: 'USD',
    scores,
    comparables,
    projection2y,
    risk,
    percentile,
  };
}
