import 'dotenv/config'
import { getSql } from '../db.mjs'

const sql = getSql()
await sql`
  DELETE FROM sessions
  WHERE user_id IN (
    SELECT id FROM users WHERE username IN ('captain01', 'sailor02')
  )
`
await sql`DELETE FROM users WHERE username IN ('captain01', 'sailor02')`
await sql`UPDATE users SET role = 'admin' WHERE username = 'shaki9'`
const rows = await sql`SELECT id, username, role FROM users ORDER BY username`
console.log(JSON.stringify(rows, null, 2))
