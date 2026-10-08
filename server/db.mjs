import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon } from '@neondatabase/serverless'
import 'dotenv/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let sql = null

export function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    ''
  ).trim()
}

/** @returns {import('@neondatabase/serverless').NeonQueryFunction<false, false>} */
export function getSql() {
  if (sql) return sql
  const url = getDatabaseUrl()
  if (!url) {
    throw new Error(
      'DATABASE_URL 이 없습니다. Vercel Storage에서 Neon을 연결하거나 .env 에 DATABASE_URL 을 넣으세요.',
    )
  }
  sql = neon(url)
  return sql
}

export function hasDatabaseUrl() {
  return Boolean(getDatabaseUrl())
}

/** SQL 파일을 스테이트먼트 단위로 실행 */
export async function runSqlFile(relativePathFromServer) {
  const full = path.join(__dirname, relativePathFromServer)
  const schema = await readFile(full, 'utf8')
  const statements = schema
    .split(';')
    .map((s) => s.replace(/--[^\n]*/g, '').trim())
    .filter(Boolean)
  const client = getSql()
  for (const statement of statements) {
    await client.query(statement, [])
  }
}
