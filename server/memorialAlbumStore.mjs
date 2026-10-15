import {
  bumpCatalogStat,
  bumpCatalogStatIfGrew,
} from './adminStats.mjs'
import { getSql, hasDatabaseUrl, runSqlFile } from './db.mjs'

export async function ensureMemorialAlbumStore() {
  if (!hasDatabaseUrl()) throw new Error('DATABASE_URL 이 없습니다.')
  await runSqlFile('sql/034_memorial_albums.sql')
}

function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
}

function asJsonArray(value) {
  if (Array.isArray(value)) return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function asNullableText(value) {
  const t = value == null ? '' : String(value).trim()
  return t || null
}

function asItems(value) {
  return asJsonArray(value)
    .map((item) => ({
      name: String(item?.name || '').trim(),
      note:
        item?.note == null || String(item.note).trim() === ''
          ? null
          : String(item.note).trim(),
    }))
    .filter((r) => r.name)
}

function asItemCount(value, items) {
  if (value == null || value === '') {
    return items.length || null
  }
  const n = Number(value)
  return Number.isFinite(n) ? n : items.length || null
}

function decorateMemorialAlbum(row) {
  const items = asItems(row.items)
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    altName: row.alt_name == null ? null : String(row.alt_name),
    description: row.description == null ? null : String(row.description),
    category: row.category == null ? null : String(row.category),
    rewardNpc: row.reward_npc == null ? null : String(row.reward_npc),
    rewardItem: row.reward_item == null ? null : String(row.reward_item),
    itemCount: asItemCount(row.item_count, items),
    items,
    updatedAt: row.updated_at
      ? new Date(/** @type {string|Date} */ (row.updated_at)).toISOString()
      : null,
  }
}

export async function listMemorialAlbums() {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM memorial_albums
    WHERE enabled = TRUE
    ORDER BY updated_at DESC NULLS LAST, id DESC
  `
  return rows.map(decorateMemorialAlbum)
}

export async function getMemorialAlbumBySlug(slug) {
  const sql = getSql()
  const rows = await sql`
    SELECT * FROM memorial_albums
    WHERE slug = ${slug} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateMemorialAlbum(rows[0]) : null
}

export async function getMemorialAlbumById(id) {
  const sql = getSql()
  const albumId = Number(id)
  if (!Number.isFinite(albumId)) return null
  const rows = await sql`
    SELECT * FROM memorial_albums
    WHERE id = ${albumId} AND enabled = TRUE LIMIT 1
  `
  return rows[0] ? decorateMemorialAlbum(rows[0]) : null
}

/**
 * @param {number} id
 * @param {Record<string, unknown>} patch
 */
export async function updateMemorialAlbumFields(id, patch) {
  const sql = getSql()
  const albumId = Number(id)
  if (!Number.isFinite(albumId)) {
    throw new Error('잘못된 메모리얼 앨범 ID입니다.')
  }

  const current = await getMemorialAlbumById(albumId)
  if (!current) throw new Error('메모리얼 앨범을 찾을 수 없습니다.')

  const items =
    'items' in patch ? asItems(patch.items) : current.items
  const next = {
    altName:
      'altName' in patch ? asNullableText(patch.altName) : current.altName,
    description:
      'description' in patch
        ? asNullableText(patch.description)
        : current.description,
    category:
      'category' in patch ? asNullableText(patch.category) : current.category,
    rewardNpc:
      'rewardNpc' in patch
        ? asNullableText(patch.rewardNpc)
        : current.rewardNpc,
    rewardItem:
      'rewardItem' in patch
        ? asNullableText(patch.rewardItem)
        : current.rewardItem,
    itemCount:
      'itemCount' in patch
        ? asItemCount(patch.itemCount, items)
        : asItemCount(current.itemCount, items),
    items,
  }

  await sql`
    UPDATE memorial_albums SET
      alt_name = ${next.altName},
      description = ${next.description},
      category = ${next.category},
      reward_npc = ${next.rewardNpc},
      reward_item = ${next.rewardItem},
      item_count = ${next.itemCount},
      items = ${JSON.stringify(next.items)}
    WHERE id = ${albumId}
  `
  return getMemorialAlbumById(albumId)
}

/** @param {number} id */
export async function deleteMemorialAlbum(id) {
  const sql = getSql()
  const albumId = Number(id)
  if (!Number.isFinite(albumId)) {
    throw new Error('잘못된 메모리얼 앨범 ID입니다.')
  }
  const rows = await sql`
    UPDATE memorial_albums SET enabled = FALSE
    WHERE id = ${albumId} AND enabled = TRUE
    RETURNING id
  `
  if (!rows[0]) throw new Error('메모리얼 앨범을 찾을 수 없습니다.')
  await bumpCatalogStat('memorial_albums', -1)
  return { ok: true }
}

async function findIdByName(sql, name) {
  const dup = await sql`
    SELECT id, slug, enabled FROM memorial_albums
    WHERE TRIM(BOTH FROM regexp_replace(name, '\\s+', ' ', 'g')) = ${name}
    LIMIT 1
  `
  return dup[0]
    ? {
        id: Number(dup[0].id),
        slug: String(dup[0].slug),
        enabled: Boolean(dup[0].enabled),
      }
    : null
}

export async function upsertMemorialAlbumFromParsed(parsed) {
  const sql = getSql()
  const name = normalizeName(parsed.name)
  if (!name) throw new Error('메모리얼 앨범 이름이 없습니다.')

  const items = asItems(parsed.items || [])
  const payload = {
    altName: asNullableText(parsed.altName),
    description: asNullableText(parsed.description),
    category: asNullableText(parsed.category),
    rewardNpc: asNullableText(parsed.rewardNpc),
    rewardItem: asNullableText(parsed.rewardItem),
    itemCount: asItemCount(parsed.itemCount, items),
    items,
  }

  const existing = await findIdByName(sql, name)
  if (existing) {
    await sql`
      UPDATE memorial_albums SET
        name = ${name},
        alt_name = ${payload.altName},
        description = ${payload.description},
        category = ${payload.category},
        reward_npc = ${payload.rewardNpc},
        reward_item = ${payload.rewardItem},
        item_count = ${payload.itemCount},
        items = ${JSON.stringify(payload.items)},
        enabled = TRUE
      WHERE id = ${existing.id}
    `
    await bumpCatalogStatIfGrew('memorial_albums', existing.enabled)
    return getMemorialAlbumBySlug(existing.slug)
  }

  let slug = parsed.slug
  let attempt = slug
  let n = 2
  while (true) {
    const clash = await sql`
      SELECT id FROM memorial_albums WHERE slug = ${attempt} LIMIT 1
    `
    if (!clash[0]) {
      slug = attempt
      break
    }
    attempt = `${parsed.slug}-${n++}`
  }

  const maxRows = await sql`
    SELECT COALESCE(MAX(id), 0) AS max_id FROM memorial_albums
  `
  const id = Number(maxRows[0].max_id) + 1
  const sortRows = await sql`
    SELECT COALESCE(MAX(sort_order), 0) AS max_sort FROM memorial_albums
  `
  const sortOrder = Number(sortRows[0].max_sort) + 1

  await sql`
    INSERT INTO memorial_albums (
      id, slug, name, alt_name, description, category,
      reward_npc, reward_item, item_count, items, enabled, sort_order
    ) VALUES (
      ${id}, ${slug}, ${name}, ${payload.altName}, ${payload.description},
      ${payload.category}, ${payload.rewardNpc}, ${payload.rewardItem},
      ${payload.itemCount}, ${JSON.stringify(payload.items)}, TRUE, ${sortOrder}
    )
  `

  await bumpCatalogStat('memorial_albums', 1)
  return getMemorialAlbumBySlug(slug)
}
