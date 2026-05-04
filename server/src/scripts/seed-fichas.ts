/**
 * seed-fichas.ts — Inserts 3 real horse profiles requested by Juan Etchepareborda
 * Run: tsx src/scripts/seed-fichas.ts
 */
import 'dotenv/config';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL env var is required');

const sql = postgres(connectionString);
const now = new Date().toISOString();

const horses = [
  {
    id: 'money-maker-arg',
    name: 'Money Maker',
    name_lower: 'money maker',
    fei_id: '108MV97',
    birth_year: 2016,
    breed: 'BAVAR',
    studbook: 'BAVAR',
    gender: 'stallion',
    color: 'Bay',
    country_code: 'ARG',
    sire: 'Stakkato Gold',
    dam: 'Corno Grande',
    dam_sire: 'Contendro I',
    current_rider: 'Pablo Arias Martinez',
    owner: null,
    haras: null,
    sources: ['FEI', 'HORSETELEX'],
    first_seen: now,
    last_updated: now,
  },
  {
    id: 'nemerald-bra',
    name: 'Nemerald',
    name_lower: 'nemerald',
    fei_id: '108LD41',
    birth_year: 2018,
    breed: 'KWPN',
    studbook: 'KWPN',
    gender: 'gelding',
    color: 'Chestnut',
    country_code: 'BRA',
    sire: "Emerald van't Ruytershof",
    dam: null,
    dam_sire: 'Nimmerdor',
    current_rider: 'Vitor Dantas Medeiros De Carvalho',
    owner: null,
    haras: null,
    sources: ['RIMONDO'],
    first_seen: now,
    last_updated: now,
  },
  {
    id: 'samurai-do-triunfo-bra',
    name: 'Samurai do Triunfo',
    name_lower: 'samurai do triunfo',
    fei_id: '109JG09',
    birth_year: 2012,
    breed: 'BH',
    studbook: 'BH',
    gender: 'stallion',
    color: 'Chestnut',
    country_code: 'BRA',
    sire: null,
    dam: null,
    dam_sire: null,
    current_rider: 'Mauricio Zalles',
    owner: null,
    haras: null,
    sources: ['FEI'],
    first_seen: now,
    last_updated: now,
  },
];

async function run() {
  console.log('🐴 Inserting 3 horse fichas...');

  for (const h of horses) {
    await sql`
      INSERT INTO horses (
        id, name, name_lower, fei_id, birth_year, breed, studbook,
        gender, color, country_code, sire, dam, dam_sire,
        current_rider, owner, haras, sources, first_seen, last_updated
      ) VALUES (
        ${h.id}, ${h.name}, ${h.name_lower}, ${h.fei_id}, ${h.birth_year},
        ${h.breed}, ${h.studbook}, ${h.gender}, ${h.color}, ${h.country_code},
        ${h.sire}, ${h.dam}, ${h.dam_sire}, ${h.current_rider},
        ${h.owner}, ${h.haras}, ${h.sources as string[]}, ${h.first_seen}, ${h.last_updated}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        fei_id = EXCLUDED.fei_id,
        birth_year = EXCLUDED.birth_year,
        breed = EXCLUDED.breed,
        studbook = EXCLUDED.studbook,
        gender = EXCLUDED.gender,
        color = EXCLUDED.color,
        country_code = EXCLUDED.country_code,
        sire = EXCLUDED.sire,
        dam = EXCLUDED.dam,
        dam_sire = EXCLUDED.dam_sire,
        current_rider = EXCLUDED.current_rider,
        sources = EXCLUDED.sources,
        last_updated = EXCLUDED.last_updated
    `;
    console.log(`  ✅ ${h.name} (${h.country_code}) — ${h.fei_id}`);
  }

  // Also insert competition results
  const results = [
    // ── Money Maker — 37 FEI results (fuente: fei.org/horse/108MV97/results) ──
    // Pablo Arias Martinez 2025
    { id: 'mm-20251130-lezama-tworounds', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Pablo Arias Martinez', event_name: 'Lezama, Buenos Aires', event_id: null, event_date: '2025-11-30', event_country: 'ARG', club: 'Lezama', level: 'CSI1*', category: 'Two Rounds 140cm', placement: null, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20251128-lezama-tablea', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Pablo Arias Martinez', event_name: 'Lezama, Buenos Aires', event_id: null, event_date: '2025-11-28', event_country: 'ARG', club: 'Lezama', level: 'CSI1*', category: 'Table A 140cm', placement: 13, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20251023-bsas-2nd', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Pablo Arias Martinez', event_name: 'Buenos Aires', event_id: null, event_date: '2025-10-23', event_country: 'ARG', club: 'Buenos Aires', level: 'CSI1*', category: '2nd Competition 140cm', placement: 9, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20251022-bsas-1st', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Pablo Arias Martinez', event_name: 'Buenos Aires', event_id: null, event_date: '2025-10-22', event_country: 'ARG', club: 'Buenos Aires', level: 'CSI1*', category: '1st Competition 135cm', placement: 17, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20250914-rosario-gp', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Pablo Arias Martinez', event_name: 'Rosario, Santa Fe', event_id: null, event_date: '2025-09-14', event_country: 'ARG', club: 'Rosario', level: 'CSI1*', category: 'Grand Prix Two Rounds 140cm', placement: 9, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20250912-rosario-tablea-140', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Pablo Arias Martinez', event_name: 'Rosario, Santa Fe', event_id: null, event_date: '2025-09-12', event_country: 'ARG', club: 'Rosario', level: 'CSI1*', category: 'Table A 140cm', placement: 5, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20250911-rosario-tablea-135', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Pablo Arias Martinez', event_name: 'Rosario, Santa Fe', event_id: null, event_date: '2025-09-11', event_country: 'ARG', club: 'Rosario', level: 'CSI1*', category: 'Table A 135cm', placement: 17, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    // Mario Prieto 2024
    { id: 'mm-20240707-esposende-gp', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Esposende', event_id: null, event_date: '2024-07-07', event_country: 'POR', club: 'Esposende', level: 'CSI2*', category: 'Grand Prix 145cm', placement: null, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240706-esposende-big-1st', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Esposende', event_id: null, event_date: '2024-07-06', event_country: 'POR', club: 'Esposende', level: 'CSI2*', category: 'Big Class 140cm', placement: 1, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: true, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240705-esposende-big-37', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Esposende', event_id: null, event_date: '2024-07-05', event_country: 'POR', club: 'Esposende', level: 'CSI2*', category: 'Big Class 140cm', placement: 37, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240630-esposende-med-8', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Esposende', event_id: null, event_date: '2024-06-30', event_country: 'POR', club: 'Esposende', level: 'CSI2*', category: 'Medium Class 130cm', placement: 8, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240629-esposende-big-nr', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Esposende', event_id: null, event_date: '2024-06-29', event_country: 'POR', club: 'Esposende', level: 'CSI2*', category: 'Big Class 140cm', placement: null, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240628-esposende-big-20', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Esposende', event_id: null, event_date: '2024-06-28', event_country: 'POR', club: 'Esposende', level: 'CSI2*', category: 'Big Class 140cm', placement: 20, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240616-matosinhos-med-16', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Matosinhos', event_id: null, event_date: '2024-06-16', event_country: 'POR', club: 'Matosinhos', level: 'CSI2*', category: 'Medium Class 130cm', placement: 16, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240615-matosinhos-big-19', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Matosinhos', event_id: null, event_date: '2024-06-15', event_country: 'POR', club: 'Matosinhos', level: 'CSI2*', category: 'Big Class 140cm', placement: 19, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240614-matosinhos-med-8', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Matosinhos', event_id: null, event_date: '2024-06-14', event_country: 'POR', club: 'Matosinhos', level: 'CSI2*', category: 'Medium Class 130cm', placement: 8, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240511-pontelima-big-29', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Ponte de Lima', event_id: null, event_date: '2024-05-11', event_country: 'POR', club: 'Ponte de Lima', level: 'CSI1*', category: 'Big Class 140cm', placement: 29, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240510-pontelima-med-4', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Ponte de Lima', event_id: null, event_date: '2024-05-10', event_country: 'POR', club: 'Ponte de Lima', level: 'CSI1*', category: 'Medium Class 130cm', placement: 4, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240419-oliva-silver2-6', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Oliva', event_id: null, event_date: '2024-04-19', event_country: 'ESP', club: 'Oliva', level: 'CSI1*', category: 'CSI1* Silver 2 140cm', placement: 6, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240418-oliva-silver2-2', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Oliva', event_id: null, event_date: '2024-04-18', event_country: 'ESP', club: 'Oliva', level: 'CSI1*', category: 'CSI1* Silver 2 135cm', placement: 2, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240413-oliva-silver1-15', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Oliva', event_id: null, event_date: '2024-04-13', event_country: 'ESP', club: 'Oliva', level: 'CSI1*', category: 'CSI1* Silver 1 130cm', placement: 15, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240412-oliva-silver2-39', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Oliva', event_id: null, event_date: '2024-04-12', event_country: 'ESP', club: 'Oliva', level: 'CSI1*', category: 'CSI1* Silver 2 140cm', placement: 39, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240411-oliva-silver2-16', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Oliva', event_id: null, event_date: '2024-04-11', event_country: 'ESP', club: 'Oliva', level: 'CSI1*', category: 'CSI1* Silver 2 135cm', placement: 16, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240323-vejer-csi4-64', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Vejer de la Frontera', event_id: null, event_date: '2024-03-23', event_country: 'ESP', club: 'Vejer de la Frontera', level: 'CSI4*', category: 'M. Tour 1.40m', placement: 64, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240322-vejer-csi4-35', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Vejer de la Frontera', event_id: null, event_date: '2024-03-22', event_country: 'ESP', club: 'Vejer de la Frontera', level: 'CSI4*', category: 'M. Tour 1.40m', placement: 35, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240321-vejer-csi4-25', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Vejer de la Frontera', event_id: null, event_date: '2024-03-21', event_country: 'ESP', club: 'Vejer de la Frontera', level: 'CSI4*', category: 'B. Tour 1.35m', placement: 25, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240317-vejer-csi4-24', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Vejer de la Frontera', event_id: null, event_date: '2024-03-17', event_country: 'ESP', club: 'Vejer de la Frontera', level: 'CSI4*', category: 'B. Tour 1.35m', placement: 24, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240316-vejer-csi4-4', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Vejer de la Frontera', event_id: null, event_date: '2024-03-16', event_country: 'ESP', club: 'Vejer de la Frontera', level: 'CSI4*', category: 'M. Tour 1.30m', placement: 4, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20240314-vejer-csi4-29', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Mario Prieto', event_name: 'Vejer de la Frontera', event_id: null, event_date: '2024-03-14', event_country: 'ESP', club: 'Vejer de la Frontera', level: 'CSI4*', category: 'M. Tour 1.30m', placement: 29, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    // Ines Joly 2023
    { id: 'mm-20231109-vilamoura-twophases-16', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Ines Joly', event_name: 'Vilamoura', event_id: null, event_date: '2023-11-09', event_country: 'POR', club: 'Vilamoura', level: 'CSIYH1*', category: 'Two Phases 130cm', placement: 16, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20231108-vilamoura-tablea-nr', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Ines Joly', event_name: 'Vilamoura', event_id: null, event_date: '2023-11-08', event_country: 'POR', club: 'Vilamoura', level: 'CSIYH1*', category: 'Table A 130cm', placement: null, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20231107-vilamoura-tablea-19', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Ines Joly', event_name: 'Vilamoura', event_id: null, event_date: '2023-11-07', event_country: 'POR', club: 'Vilamoura', level: 'CSIYH1*', category: 'Table A 130cm', placement: 19, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20231102-vilamoura-twophases-13', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Ines Joly', event_name: 'Vilamoura', event_id: null, event_date: '2023-11-02', event_country: 'POR', club: 'Vilamoura', level: 'CSIYH1*', category: 'Two Phases 130cm', placement: 13, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20231101-vilamoura-tablea-24', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Ines Joly', event_name: 'Vilamoura', event_id: null, event_date: '2023-11-01', event_country: 'POR', club: 'Vilamoura', level: 'CSIYH1*', category: 'Table A 130cm', placement: 24, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20231031-vilamoura-tablea-17', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Ines Joly', event_name: 'Vilamoura', event_id: null, event_date: '2023-10-31', event_country: 'POR', club: 'Vilamoura', level: 'CSIYH1*', category: 'Table A 130cm', placement: 17, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20231027-vejer-csiyh-26', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Ines Joly', event_name: 'Vejer de la Frontera', event_id: null, event_date: '2023-10-27', event_country: 'ESP', club: 'Vejer de la Frontera', level: 'CSIYH1*', category: '7 Years Old 135cm', placement: 26, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    { id: 'mm-20231025-vejer-csiyh-30', horse_id: 'money-maker-arg', horse_name: 'Money Maker', horse_name_norm: 'money maker', rider_name: 'Ines Joly', event_name: 'Vejer de la Frontera', event_id: null, event_date: '2023-10-25', event_country: 'ESP', club: 'Vejer de la Frontera', level: 'CSIYH1*', category: '7 Years Old 130cm', placement: 30, total_entries: null, faults: 0, time_faults: null, jump_faults: null, time: null, clear: false, phase: null, points: null, source: 'FEI', raw_data: null, imported_at: now },
    // Nemerald
    {
      id: 'nemerald-csi1-deurne-2025',
      horse_id: 'nemerald-bra',
      horse_name: 'Nemerald',
      horse_name_norm: 'nemerald',
      rider_name: 'Vitor Dantas Medeiros De Carvalho',
      event_name: 'CSI1* Deurne',
      event_id: null,
      event_date: '2025-03-01',
      event_country: 'NED',
      club: 'Deurne',
      level: 'CSI1*',
      category: '120-135cm',
      placement: null,
      total_entries: null,
      faults: 0,
      time_faults: null,
      jump_faults: null,
      time: null,
      clear: true,
      phase: null,
      points: null,
      source: 'RIMONDO',
      raw_data: null,
      imported_at: now,
    },
    // Samurai do Triunfo — São Paulo SP CSI4*-W agosto 2025
    {
      id: 'samurai-20250823-sp-classic-145',
      horse_id: 'samurai-do-triunfo-bra',
      horse_name: 'Samurai do Triunfo',
      horse_name_norm: 'samurai do triunfo',
      rider_name: 'Mauricio Zalles',
      event_name: 'São Paulo SP',
      event_id: null,
      event_date: '2025-08-23',
      event_country: 'BRA',
      club: 'São Paulo SP',
      level: 'CSI4*-W',
      category: 'Classic - Gold Tour 145cm',
      placement: 36,
      total_entries: null,
      faults: null,
      time_faults: null,
      jump_faults: null,
      time: null,
      clear: false,
      phase: null,
      points: null,
      source: 'FEI',
      raw_data: null,
      imported_at: now,
    },
    {
      id: 'samurai-20250822-sp-gold-150',
      horse_id: 'samurai-do-triunfo-bra',
      horse_name: 'Samurai do Triunfo',
      horse_name_norm: 'samurai do triunfo',
      rider_name: 'Mauricio Zalles',
      event_name: 'São Paulo SP',
      event_id: null,
      event_date: '2025-08-22',
      event_country: 'BRA',
      club: 'São Paulo SP',
      level: 'CSI4*-W',
      category: 'Gold Tour 150cm',
      placement: 27,
      total_entries: null,
      faults: null,
      time_faults: null,
      jump_faults: null,
      time: null,
      clear: false,
      phase: null,
      points: null,
      source: 'FEI',
      raw_data: null,
      imported_at: now,
    },
    {
      id: 'samurai-20250821-sp-gold-145',
      horse_id: 'samurai-do-triunfo-bra',
      horse_name: 'Samurai do Triunfo',
      horse_name_norm: 'samurai do triunfo',
      rider_name: 'Mauricio Zalles',
      event_name: 'São Paulo SP',
      event_id: null,
      event_date: '2025-08-21',
      event_country: 'BRA',
      club: 'São Paulo SP',
      level: 'CSI4*-W',
      category: 'Gold Tour 145cm',
      placement: 51,
      total_entries: null,
      faults: null,
      time_faults: null,
      jump_faults: null,
      time: null,
      clear: false,
      phase: null,
      points: null,
      source: 'FEI',
      raw_data: null,
      imported_at: now,
    },
  ];

  console.log('\n📊 Inserting competition results...');
  for (const r of results) {
    await sql`
      INSERT INTO results (
        id, horse_id, horse_name, horse_name_norm, rider_name,
        event_name, event_id, event_date, event_country, club,
        level, category, placement, total_entries, faults,
        time_faults, jump_faults, time, clear, phase,
        points, source, raw_data, imported_at
      ) VALUES (
        ${r.id}, ${r.horse_id}, ${r.horse_name}, ${r.horse_name_norm}, ${r.rider_name},
        ${r.event_name}, ${r.event_id}, ${r.event_date}, ${r.event_country}, ${r.club},
        ${r.level}, ${r.category}, ${r.placement}, ${r.total_entries}, ${r.faults},
        ${r.time_faults}, ${r.jump_faults}, ${r.time}, ${r.clear}, ${r.phase},
        ${r.points}, ${r.source}, ${r.raw_data}, ${r.imported_at}
      )
      ON CONFLICT (id) DO NOTHING
    `;
    console.log(`  ✅ ${r.event_name} — ${r.horse_name} pos.${r.placement ?? '?'} (${r.level})`);
  }

  console.log('\n🎉 Done! 3 fichas + results inserted.');
  await sql.end();
}

run().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
