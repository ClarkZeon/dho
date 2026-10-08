import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BUNDLED_DATA_DIR, getWritableDataDir } from './paths.mjs'

const BUNDLED_SHIPS_FILE = path.join(BUNDLED_DATA_DIR, 'ships-db.json')
const CURRENT_DB_VERSION = 2

function shipsDbFile() {
  return path.join(getWritableDataDir(), 'ships-db.json')
}

async function readDb() {
  return JSON.parse(await readFile(shipsDbFile(), 'utf8'))
}

async function writeDb(db) {
  await writeFile(shipsDbFile(), `${JSON.stringify(db, null, 2)}\n`, 'utf8')
}

function byId(list, id) {
  return list.find((item) => item.id === id)
}

function decorateSkills(db, ship) {
  // 신규: ship.skills[{ skillId, sail, gunPort, material1, material2 }]
  if (Array.isArray(ship.skills) && ship.skills.length > 0) {
    return ship.skills.map((row, index) => {
      const master = byId(db.skills, row.skillId)
      return {
        id: row.skillId ?? index + 1,
        name: master?.name ?? row.name ?? `스킬 ${index + 1}`,
        sail: row.sail ?? null,
        gunPort: row.gunPort ?? null,
        material1: row.material1 ?? null,
        material2: row.material2 ?? null,
      }
    })
  }

  // 구버전: skillIds: number[]
  return (ship.skillIds || [])
    .map((id) => {
      const master = byId(db.skills, id)
      if (!master) return null
      return {
        id: master.id,
        name: master.name,
        sail: null,
        gunPort: null,
        material1: null,
        material2: null,
      }
    })
    .filter(Boolean)
}

function decorateShip(db, ship) {
  const size = byId(db.sizes, ship.sizeId)
  const form = byId(db.forms, ship.formId)
  const material = byId(db.materials, ship.materialId)
  const skills = decorateSkills(db, ship)

  return {
    id: ship.id,
    slug: ship.slug,
    name: ship.name,
    category: ship.category,
    description: ship.description,
    size: size?.name ?? null,
    sizeCode: size?.code ?? null,
    form: form?.name ?? null,
    formCode: form?.code ?? null,
    material: material?.name ?? null,
    adventureLv: ship.adventureLv,
    tradeLv: ship.tradeLv,
    battleLv: ship.battleLv,
    acquireMethod: ship.acquireMethod,
    enhanceCount: ship.enhanceCount,
    durability: ship.durability,
    sailVertical: ship.sailVertical,
    sailHorizontal: ship.sailHorizontal,
    oar: ship.oar,
    turn: ship.turn,
    wave: ship.wave,
    armor: ship.armor,
    cabin: ship.cabin,
    crewRequired: ship.crewRequired,
    guns: ship.guns,
    warehouse: ship.warehouse,
    caps: {
      durability: ship.capDurability,
      sailVertical: ship.capSailVertical,
      sailHorizontal: ship.capSailHorizontal,
      oar: ship.capOar,
      turn: ship.capTurn,
      wave: ship.capWave,
      armor: ship.capArmor,
      cabin: ship.capCabin,
      guns: ship.capGuns,
      warehouse: ship.capWarehouse,
    },
    parts: {
      auxSail: ship.partAuxSail,
      figurehead: ship.partFigurehead,
      emblem: ship.partEmblem,
      special: ship.partSpecial,
      extraArmor: ship.partExtraArmor,
      broadside: ship.partBroadside,
      bow: ship.partBow,
      stern: ship.partStern,
    },
    skills,
    sailTotal: ship.sailVertical + ship.sailHorizontal,
    loadTotal: ship.cabin + ship.guns + ship.warehouse,
  }
}

export async function ensureShipStore() {
  const dir = getWritableDataDir()
  await mkdir(dir, { recursive: true })
  const target = shipsDbFile()

  let needsSeed = false
  try {
    const current = JSON.parse(await readFile(target, 'utf8'))
    if (current.version !== CURRENT_DB_VERSION) needsSeed = true
  } catch {
    needsSeed = true
  }

  if (needsSeed) {
    try {
      await copyFile(BUNDLED_SHIPS_FILE, target)
    } catch {
      await writeDb({
        version: CURRENT_DB_VERSION,
        sizes: [],
        forms: [],
        materials: [],
        skills: [],
        ships: [],
      })
    }
  }
}

export async function listShipLookups() {
  const db = await readDb()
  return {
    sizes: db.sizes.filter((x) => x.enabled !== false).sort((a, b) => a.sortOrder - b.sortOrder),
    forms: db.forms.filter((x) => x.enabled !== false).sort((a, b) => a.sortOrder - b.sortOrder),
    materials: db.materials
      .filter((x) => x.enabled !== false)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }
}

export async function listShips() {
  const db = await readDb()
  return db.ships
    .filter((s) => s.enabled !== false)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((s) => decorateShip(db, s))
}

export async function getShipBySlug(slug) {
  const db = await readDb()
  const ship = db.ships.find((s) => s.slug === slug && s.enabled !== false)
  return ship ? decorateShip(db, ship) : null
}
