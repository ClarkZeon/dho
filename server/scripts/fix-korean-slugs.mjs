import 'dotenv/config'
import { createHash } from 'node:crypto'
import { getSql } from '../db.mjs'

const sql = getSql()
const rows = await sql`SELECT id, name, slug FROM ships`
let n = 0
for (const row of rows) {
  const slug = String(row.slug)
  if (/^[a-z0-9-]+$/.test(slug)) continue
  const hash = createHash('sha1')
    .update(String(row.name).trim().toLowerCase())
    .digest('hex')
    .slice(0, 10)
  const next = `ship-${hash}`
  await sql`UPDATE ships SET slug = ${next} WHERE id = ${row.id}`
  console.log(`#${row.id} ${row.name}: ${slug} -> ${next}`)
  n += 1
}
console.log(`updated ${n}`)
