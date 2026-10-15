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
  'ships',
  'ship_materials',
]

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
  for (const table of CATALOG_TABLES) {
    const trg = `trg_${table}_updated_at`
    await sql.query(`DROP TRIGGER IF EXISTS ${trg} ON ${table}`, [])
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
