import { DiscoveryRankMark } from '../DiscoveryRankMark'

export type DiscoveryChipItem = {
  name: string
  category?: string | null
  rank?: number | null
  id?: number
  slug?: string
}

type DiscoveryChipsProps = {
  items: Array<string | DiscoveryChipItem | null | undefined>
  onOpen?: (item: DiscoveryChipItem) => void
}

/**
 * `[지리] 2 샤크 만` / `[화석] ★3 이름` / `[분류] 이름` → 칩 필드
 */
export function parseDiscoveryLabel(raw: string): DiscoveryChipItem | null {
  const text = String(raw || '').trim()
  if (!text) return null

  const withRank = text.match(
    /^\[([^\]]+)\]\s*(?:★\s*)?(\d+(?:\.\d+)?)\s*(?:성)?\s+(.+)$/,
  )
  if (withRank) {
    const rank = Number(withRank[2])
    return {
      category: withRank[1].trim(),
      rank: Number.isFinite(rank) ? rank : null,
      name: withRank[3].trim(),
    }
  }

  const withCat = text.match(/^\[([^\]]+)\]\s*(.+)$/)
  if (withCat) {
    return {
      category: withCat[1].trim(),
      name: withCat[2].trim(),
    }
  }

  return { name: text }
}

function normalizeChipItem(
  raw: string | DiscoveryChipItem,
): DiscoveryChipItem | null {
  if (typeof raw === 'string') return parseDiscoveryLabel(raw)

  const name = String(raw.name || '').trim()
  if (!name) return null

  // name 자체에 `[분류] n 이름`이 들어 있으면 펼침
  if (
    !raw.category &&
    raw.rank == null &&
    /^\[[^\]]+\]/.test(name)
  ) {
    const parsed = parseDiscoveryLabel(name)
    if (!parsed) return null
    return {
      ...parsed,
      id: raw.id,
      slug: raw.slug,
    }
  }

  return {
    name,
    category: raw.category ?? null,
    rank: raw.rank ?? null,
    id: raw.id,
    slug: raw.slug,
  }
}

/** 발견물 이름(들)을 칩으로 표시. 분류·등급이 있으면 함께 표기 */
export function DiscoveryChips({ items, onOpen }: DiscoveryChipsProps) {
  const list = (items || [])
    .map((raw): DiscoveryChipItem | null => {
      if (raw == null) return null
      return normalizeChipItem(raw)
    })
    .filter((item): item is DiscoveryChipItem => item != null)

  if (list.length === 0) return null

  return (
    <ul className="quest-skill-chips">
      {list.map((item, index) => {
        const clickable =
          Boolean(onOpen) && item.id != null && Boolean(item.slug)
        return (
          <li key={item.id != null ? `id:${item.id}` : `${item.name}-${index}`}>
            {clickable ? (
              <button
                type="button"
                className="quest-skill-chip-btn"
                onClick={() => onOpen?.(item)}
              >
                <DiscoveryChipInner item={item} />
              </button>
            ) : (
              <span>
                <DiscoveryChipInner item={item} />
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function DiscoveryChipInner({ item }: { item: DiscoveryChipItem }) {
  return (
    <span className="discovery-chip-inner">
      {item.category ? (
        <em className="discovery-chip-cat">[{item.category}]</em>
      ) : null}
      <DiscoveryRankMark rank={item.rank} />
      <span className="discovery-chip-name">{item.name}</span>
    </span>
  )
}
