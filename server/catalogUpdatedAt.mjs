import { getSql, runSqlFile } from './db.mjs'

const CATALOG_TABLES = [
  'quests',
  'ports',
  'regions',
  'entry_permits',
  'discoveries',
  'skills',
  'titles',
  'fields',
  'sea_areas',
  'consumables',
  'equipments',
  'memorial_albums',
  'treasure_maps',
  'jobs',
  'refines',
  'ships',
  'ship_materials',
]

/**
 * updated_at 트리거. 매 부팅 DROP/CREATE 하면 Neon HTTP 왕복이 수십 초라
 * CREATE OR REPLACE 만 하고, 없는 트리거만 추가한다.
 */
export async function ensureCatalogUpdatedAt() {
  await runSqlFile('sql/037_catalog_updated_at.sql')
  const sql = getSql()
  await sql.query(
    `
    CREATE OR REPLACE FUNCTION catalog_touch_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    `,
    [],
  )

  const existing = await sql`
    SELECT t.tgname AS name
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND NOT t.tgisinternal
      AND t.tgname LIKE 'trg_%_updated_at'
  `
  const have = new Set(existing.map((row) => String(row.name)))

  for (const table of CATALOG_TABLES) {
    const trg = `trg_${table}_updated_at`
    if (have.has(trg)) continue
    await sql.query(
      `
      CREATE TRIGGER ${trg}
        BEFORE UPDATE ON ${table}
        FOR EACH ROW EXECUTE PROCEDURE catalog_touch_updated_at()
      `,
      [],
    )
  }
}
