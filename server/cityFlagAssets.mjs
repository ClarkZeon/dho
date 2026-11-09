/**
 * 파파야 CDN 도시/국가 깃발 → 로컬 public/{cities|countries} 미러
 * (배포 산출물에 포함되도록 public/ 에 저장)
 */

import { createWriteStream } from 'node:fs'
import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC_DIR = path.resolve(__dirname, '../public')

const FLAG_RE =
  /https?:\/\/static\.papayaplay\.co\.kr\/static\/dho\/(cities|countries)\/([a-f0-9-]+)/i

/** 분류 `프랑스본거지` / `프랑스 본거지` → 국가 CDN id */
export const COUNTRY_FLAG_IDS = {
  프랑스: '68dd7eed-7343-4d0e-936b-ed98573fe492',
  잉글랜드: 'f1cb4725-6c5e-4968-9c8f-610b0aca38ae',
  네덜란드: 'cbf1b26a-a611-43a7-964a-0c4169310b41',
}

export function countryFlagLocalPath(countryName) {
  const id = COUNTRY_FLAG_IDS[String(countryName || '').trim()]
  return id ? `/countries/${id}.png` : null
}

const NATION_KINDS = ['개척지', '본거지', '영지']

/** `포르투갈본거지` / `네덜란드 » 개척지` / `프랑스 본거지` → 나라명 */
export function countryNameFromCategory(category) {
  const raw = String(category || '').trim()
  if (!raw) return null
  const sep = raw.split(/\s*»\s*|\s*>>\s*|\s*›\s*/)
  if (sep.length >= 2 && sep[0].trim()) {
    const kind = sep.slice(1).join(' » ').trim()
    if (NATION_KINDS.includes(kind)) return sep[0].trim()
  }
  for (const kind of NATION_KINDS) {
    const spaced = raw.match(new RegExp(`^(.+?)\\s+${kind}$`))
    if (spaced?.[1]?.trim()) return spaced[1].trim()
    const glued = raw.match(new RegExp(`^(.+?)${kind}$`))
    if (glued?.[1]?.trim() && glued[1].trim() !== kind) return glued[1].trim()
  }
  return null
}

export function extractCityFlagFromText(text) {
  return extractFlagFromText(text)
}

export function extractFlagFromText(text) {
  const raw = String(text || '')
  const img = raw.match(
    /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*(?:\balt=["']([^"']*)["'])?[^>]*>/i,
  )
  const src = img?.[1] || raw.match(FLAG_RE)?.[0] || null
  if (!src) return null
  const idMatch = String(src).match(FLAG_RE)
  if (!idMatch) return null
  const kind = idMatch[1].toLowerCase()
  const id = idMatch[2]
  return {
    sourceUrl: idMatch[0],
    kind,
    id,
    alt: img?.[2] ? String(img[2]).trim() : null,
    localPath: `/${kind}/${id}.png`,
  }
}

export function localizeCityFlagUrl(url) {
  return localizeFlagUrl(url)
}

export function localizeFlagUrl(url) {
  const m = String(url || '').match(FLAG_RE)
  if (!m) return null
  return `/${m[1].toLowerCase()}/${m[2]}.png`
}

async function fileExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

/** CDN → public/{cities|countries}/{id}.png (이미 있으면 스킵) */
export async function ensureCityFlagLocal(sourceUrl) {
  return ensureFlagLocal(sourceUrl)
}

export async function ensureFlagLocal(sourceUrl) {
  const m = String(sourceUrl || '').match(FLAG_RE)
  if (!m) return null
  const kind = m[1].toLowerCase()
  const id = m[2]
  const localPath = `/${kind}/${id}.png`
  const dir = path.join(PUBLIC_DIR, kind)
  const abs = path.join(dir, `${id}.png`)

  if (await fileExists(abs)) return localPath

  await mkdir(dir, { recursive: true })
  const res = await fetch(m[0])
  if (!res.ok) {
    throw new Error(`깃발 다운로드 실패 (${res.status})`)
  }
  if (!res.body) {
    throw new Error('깃발 응답 본문이 비어 있습니다.')
  }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(abs))
  return localPath
}

/** 로컬 `/cities|countries/{id}.png` → CDN 미러 보장 */
export async function ensureLocalFlagPath(localOrCdn) {
  const raw = String(localOrCdn || '').trim()
  if (!raw) return null
  const localized = localizeFlagUrl(raw)
  if (localized) {
    try {
      return (await ensureFlagLocal(raw.match(FLAG_RE)?.[0] || raw)) || localized
    } catch (err) {
      console.warn('[flags] mirror skipped:', err?.message || err)
      return localized
    }
  }
  const localMatch = raw.match(/^\/(cities|countries)\/([a-f0-9-]+)\.png$/i)
  if (!localMatch) return raw
  const kind = localMatch[1].toLowerCase()
  const id = localMatch[2]
  const cdn = `https://static.papayaplay.co.kr/static/dho/${kind}/${id}`
  try {
    return (await ensureFlagLocal(cdn)) || raw
  } catch (err) {
    console.warn('[flags] mirror skipped:', err?.message || err)
    return raw
  }
}

/** 분류 본거지 → 국가 깃발 로컬 경로 (미러 시도) */
export async function resolveCountryFlagFromCategory(category) {
  const country = countryNameFromCategory(category)
  if (!country) return null
  const id = COUNTRY_FLAG_IDS[country]
  if (!id) return null
  const cdn = `https://static.papayaplay.co.kr/static/dho/countries/${id}`
  try {
    return await ensureFlagLocal(cdn)
  } catch (err) {
    console.warn('[flags] country flag mirror skipped:', err?.message || err)
    return `/countries/${id}.png`
  }
}
