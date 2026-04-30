import {
  pgTable,
  text,
  integer,
  boolean,
  real,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─── horses ──────────────────────────────────────────────────────────────────
export const horses = pgTable('horses', {
  id:            text('id').primaryKey(),
  name:          text('name').notNull(),
  nameLower:     text('name_lower').notNull(),
  feiId:         text('fei_id'),
  birthYear:     integer('birth_year'),
  breed:         text('breed'),
  studbook:      text('studbook'),
  gender:        text('gender'),         // 'stallion' | 'mare' | 'gelding'
  color:         text('color'),
  countryCode:   text('country_code').notNull(),
  sire:          text('sire'),
  dam:           text('dam'),
  damSire:       text('dam_sire'),
  currentRider:  text('current_rider'),
  owner:         text('owner'),
  haras:         text('haras'),
  // TEXT[] — stored as PostgreSQL array
  sources:       text('sources').array().notNull().default(sql`ARRAY[]::text[]`),
  firstSeen:     text('first_seen').notNull(),
  lastUpdated:   text('last_updated').notNull(),
}, t => [
  index('horses_name_lower_idx').on(t.nameLower),
  index('horses_country_idx').on(t.countryCode),
  index('horses_fei_id_idx').on(t.feiId),
]);

// ─── results ─────────────────────────────────────────────────────────────────
export const results = pgTable('results', {
  id:             text('id').primaryKey(),
  horseId:        text('horse_id').notNull(),
  horseName:      text('horse_name').notNull(),
  horseNameNorm:  text('horse_name_norm').notNull(),
  riderName:      text('rider_name'),
  eventName:      text('event_name').notNull(),
  eventId:        text('event_id'),
  eventDate:      text('event_date').notNull(),   // YYYY-MM-DD
  eventCountry:   text('event_country').notNull(),
  club:           text('club'),
  level:          text('level').notNull(),
  category:       text('category'),
  placement:      integer('placement'),
  totalEntries:   integer('total_entries'),
  faults:         real('faults').notNull().default(0),
  timeFaults:     real('time_faults'),
  jumpFaults:     real('jump_faults'),
  time:           real('time'),
  clear:          boolean('clear').notNull().default(false),
  phase:          text('phase'),
  points:         real('points'),
  source:         text('source').notNull(),
  rawData:        text('raw_data'),
  importedAt:     text('imported_at').notNull(),
}, t => [
  index('results_horse_id_idx').on(t.horseId),
  index('results_name_norm_idx').on(t.horseNameNorm),
  index('results_source_idx').on(t.source),
  index('results_event_date_idx').on(t.eventDate),
]);

// ─── events ──────────────────────────────────────────────────────────────────
export const events = pgTable('events', {
  id:           text('id').primaryKey(),
  name:         text('name').notNull(),
  country:      text('country').notNull(),
  club:         text('club'),
  startDate:    text('start_date').notNull(),
  endDate:      text('end_date'),
  level:        text('level'),
  discipline:   text('discipline').notNull(),
  resultsUrl:   text('results_url'),
  pdfUrl:       text('pdf_url'),
  source:       text('source').notNull(),
  hasResults:   boolean('has_results').notNull().default(false),
  importedAt:   text('imported_at').notNull(),
}, t => [
  index('events_country_idx').on(t.country),
  index('events_start_date_idx').on(t.startDate),
]);

// ─── sales ────────────────────────────────────────────────────────────────────
export const sales = pgTable('sales', {
  id:            text('id').primaryKey(),
  horseName:     text('horse_name').notNull(),
  horseId:       text('horse_id'),
  auctionHouse:  text('auction_house').notNull(),
  auctionName:   text('auction_name').notNull(),
  saleDate:      text('sale_date').notNull(),
  salePriceARS:  real('sale_price_ars'),
  salePriceUSD:  real('sale_price_usd'),
  salePriceEUR:  real('sale_price_eur'),
  lots:          integer('lots'),
  haras:         text('haras'),
  country:       text('country').notNull(),
  url:           text('url').notNull(),
  source:        text('source').notNull(),
  importedAt:    text('imported_at').notNull(),
});

// ─── meta (key-value store for sync state) ────────────────────────────────────
export const meta = pgTable('meta', {
  key:   text('key').primaryKey(),
  value: text('value').notNull(),
});
