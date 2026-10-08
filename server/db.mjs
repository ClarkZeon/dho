import { neon } from '@neondatabase/serverless'
import 'dotenv/config'

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
