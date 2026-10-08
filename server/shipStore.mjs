import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const SHIPS_DB_FILE = path.join(__dirname, 'data', 'ships-db.json')

async function readDb() {
  return JSON.parse(await readFile(SHIPS_DB_FILE, 'utf8'))
}

async function writeDb(db) {
  await writeFile(SHIPS_DB_FILE, `${JSON.stringify(db, null, 2)}\n`, 'utf8')
}

function byId(list, id) {
  return list.find((item) => item.id === id)
}

function decorateShip(db, ship) {
  const size = byId(db.sizes, ship.sizeId)
  const form = byId(db.forms, ship.formId)
  const material = byId(db.materials, ship.materialId)
  const skills = (ship.skillIds || [])
    .map((id) => byId(db.skills, id)?.name)
    .filter(Boolean)

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
  try {
    await readFile(SHIPS_DB_FILE, 'utf8')
  } catch {
    // ships-db.json 은 저장소에 포함. 없으면 빈 골격만 생성
    await writeDb({
      sizes: [],
      forms: [],
      materials: [],
      skills: [],
      ships: [],
    })
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
