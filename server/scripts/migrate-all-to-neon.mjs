/**
 * 스키마 적용 + users.json 이전 + 선박 번들 시드
 *
 *   npm run db:migrate
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import 'dotenv/config'
import { ensureBoardStore } from '../boardStore.mjs'
import { hasDatabaseUrl } from '../db.mjs'
import { ensureMessageStore } from '../messageStore.mjs'
import { BUNDLED_DATA_DIR, getWritableDataDir } from '../paths.mjs'
import { ensureShipStore, reseedShipsFromBundle } from '../shipStore.mjs'
import {
  createUser,
  ensureUserStore,
  getUserById,
} from '../userStore.mjs'

async function migrateUsers() {
  const usersPath = path.join(getWritableDataDir(), 'users.json')
  let raw
  try {
    raw = await readFile(usersPath, 'utf8')
  } catch {
    console.log(`로컬 users.json 없음 — 건너뜀 (${usersPath})`)
    return
  }

  const users = JSON.parse(raw)
  let inserted = 0
  let skipped = 0
  for (const item of users) {
    const id = String(item.id || '')
    if (!id) continue
    if (await getUserById(id)) {
      skipped += 1
      continue
    }
    const username = String(item.username || '')
      .trim()
      .toLowerCase()
    const nickname = String(item.nickname || '').trim()
    if (!username || !nickname || !item.passwordHash || !item.salt) {
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
    console.log(`  + user ${username}`)
  }
  console.log(`users: 삽입 ${inserted}, 건너뜀 ${skipped}`)
}

async function main() {
  if (!hasDatabaseUrl()) {
    console.error('DATABASE_URL 이 필요합니다.')
    process.exit(1)
  }

  console.log('users/sessions…')
  await ensureUserStore()
  await migrateUsers()

  console.log('boards/posts/messages…')
  await ensureBoardStore()
  await ensureMessageStore()

  console.log('ships…')
  await ensureShipStore()
  // 번들이 있으면 최신 Fancy 스펙으로 동기화
  try {
    await readFile(path.join(BUNDLED_DATA_DIR, 'ships-db.json'), 'utf8')
    await reseedShipsFromBundle()
    console.log('ships: 번들 시드 동기화 완료')
  } catch {
    console.log('ships: 번들 없음 — ensure 만 적용')
  }

  console.log('완료')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
