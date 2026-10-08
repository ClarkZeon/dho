/**
 * users.json → Neon Postgres 마이그레이션 + 스키마 적용
 *
 * 사용:
 *   $env:DATABASE_URL="postgresql://..."; node server/scripts/migrate-users-to-neon.mjs
 *   또는 .env 에 DATABASE_URL 설정 후 실행
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'
import { ensureUserStore, getUserById, createUser } from '../userStore.mjs'
import { getWritableDataDir } from '../paths.mjs'
import { hasDatabaseUrl } from '../db.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  if (!hasDatabaseUrl()) {
    console.error('DATABASE_URL 이 필요합니다. Vercel Neon 연결 후 .env 에 넣으세요.')
    process.exit(1)
  }

  console.log('스키마 적용 중…')
  await ensureUserStore()

  const usersPath = path.join(getWritableDataDir(), 'users.json')
  let raw
  try {
    raw = await readFile(usersPath, 'utf8')
  } catch {
    console.log(`로컬 ${usersPath} 없음 — 스키마만 적용했습니다.`)
    return
  }

  /** @type {Array<Record<string, unknown>>} */
  const users = JSON.parse(raw)
  let inserted = 0
  let skipped = 0

  for (const item of users) {
    const id = String(item.id || '')
    if (!id) continue
    const existing = await getUserById(id)
    if (existing) {
      skipped += 1
      continue
    }

    const username = String(item.username || '')
      .trim()
      .toLowerCase()
    const nickname = String(item.nickname || '').trim()
    if (!username || !nickname || !item.passwordHash || !item.salt) {
      console.warn(`건너뜀 (필드 부족): ${id}`)
      skipped += 1
      continue
    }

    await createUser({
      id,
      username,
      nickname,
      passwordHash: String(item.passwordHash),
      salt: String(item.salt),
      role: item.role === 'admin' || username === 'admin' ? 'admin' : 'member',
      level: Number(item.level) >= 1 ? Math.floor(Number(item.level)) : 1,
      xp: Number(item.xp) >= 0 ? Math.floor(Number(item.xp)) : 0,
      lastLoginAt:
        typeof item.lastLoginAt === 'string' ? item.lastLoginAt : null,
      createdAt:
        typeof item.createdAt === 'string'
          ? item.createdAt
          : new Date().toISOString(),
    })
    inserted += 1
    console.log(`  + ${username}`)
  }

  console.log(`완료: 삽입 ${inserted}, 건너뜀 ${skipped}`)
  console.log(`스키마: ${path.join(__dirname, '..', 'sql', '004_users_sessions.sql')}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
