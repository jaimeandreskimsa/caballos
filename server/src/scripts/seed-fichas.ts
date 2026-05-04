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
    sources: ['HORSETELEX'],
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
    // Money Maker
    {
      id: 'money-maker-csi-140-2024',
      horse_id: 'money-maker-arg',
      horse_name: 'Money Maker',
      horse_name_norm: 'money maker',
      rider_name: 'Pablo Arias Martinez',
      event_name: 'CSI competition 1.40m',
      event_id: null,
      event_date: '2024-01-01',
      event_country: 'ARG',
      club: null,
      level: 'CSI',
      category: '1.40m',
      placement: null,
      total_entries: null,
      faults: 0,
      time_faults: null,
      jump_faults: null,
      time: null,
      clear: false,
      phase: null,
      points: null,
      source: 'HORSETELEX',
      raw_data: null,
      imported_at: now,
    },
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
    // Samurai do Triunfo
    {
      id: 'samurai-csi4w-sp-2025-a',
      horse_id: 'samurai-do-triunfo-bra',
      horse_name: 'Samurai do Triunfo',
      horse_name_norm: 'samurai do triunfo',
      rider_name: 'Mauricio Zalles',
      event_name: 'CSI4*-W São Paulo',
      event_id: null,
      event_date: '2025-04-01',
      event_country: 'BRA',
      club: 'São Paulo',
      level: 'CSI4*-W',
      category: '145cm',
      placement: 36,
      total_entries: null,
      faults: 0,
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
      id: 'samurai-csi4w-sp-2025-b',
      horse_id: 'samurai-do-triunfo-bra',
      horse_name: 'Samurai do Triunfo',
      horse_name_norm: 'samurai do triunfo',
      rider_name: 'Mauricio Zalles',
      event_name: 'CSI4*-W São Paulo',
      event_id: null,
      event_date: '2025-04-02',
      event_country: 'BRA',
      club: 'São Paulo',
      level: 'CSI4*-W',
      category: '150cm',
      placement: 27,
      total_entries: null,
      faults: 0,
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
