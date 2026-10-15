export type User = {
  id: string
  username: string
  nickname: string
  role: 'admin' | 'member'
  level: number
  xp: number
  xpToNext: number
  createdAt: string
  lastLoginAt?: string | null
}

export type AdminUser = {
  id: string
  username: string
  nickname: string
  role: 'admin' | 'member'
  level: number
  xp: number
  xpToNext: number
  createdAt: string
  lastLoginAt: string | null
}

export type Session = {
  user: User
  token: string
}

export type MessageUser = {
  id: string
  username: string
  nickname: string
}

export type MessageItem = {
  id: string
  subject: string
  body: string
  parentId: string | null
  threadId: string
  createdAt: string
  readAt: string | null
  isRead: boolean
  from: MessageUser
  to: MessageUser
}

export type BoardPost = {
  id: string
  boardId: string
  title: string
  body: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
  author: {
    id: string
    username: string
    nickname: string
    role: 'admin' | 'member'
  }
}

export type BoardSummary = {
  id: string
  title: string
  description: string
  writeRole: 'admin' | 'member' | 'none'
  previewCount: number
  canWrite: boolean
  posts?: BoardPost[]
}

export type ShipDetail = {
  id: number
  slug: string
  name: string
  category: string | null
  description: string | null
  size: string | null
  sizeCode: string | null
  form: string | null
  formCode: string | null
  material: string | null
  adventureLv: number
  tradeLv: number
  battleLv: number
  /** 예: 아이템 사용, 조선소 건조 */
  acquireType: string | null
  /** 예: 선박 교환권(NO. 719) */
  acquireMethod: string | null
  enhanceCount: number | null
  enhanceBase: number | null
  enhanceRe: number | null
  buildDays: number | null
  shipyardRank: number | null
  buildCities: ShipBuildCity[]
  specialBuilds: ShipSpecialBuild[]
  durability: number
  sailVertical: number
  sailHorizontal: number
  oar: number
  turn: number
  wave: number
  armor: number
  cabin: number
  crewRequired: number
  guns: number
  warehouse: number
  caps: {
    durability: number | null
    sailVertical: number | null
    sailHorizontal: number | null
    oar: number | null
    turn: number | null
    wave: number | null
    armor: number | null
    cabin: number | null
    guns: number | null
    warehouse: number | null
  }
  parts: {
    auxSail: number
    figurehead: number
    emblem: number
    special: number
    extraArmor: number
    broadside: number
    bow: number
    stern: number
  }
  skills: ShipSkillRow[]
  sailTotal: number
  loadTotal: number
}

export type ShipSkillRow = {
  id: number
  name: string
  sail: string | null
  gunPort: string | null
  material1: string | null
  material2: string | null
}

export type ShipBuildCity = {
  region: string
  cities: string[]
}

export type ShipSpecialBuild = {
  hull: string | null
  rank: number | null
  material: string | null
  region: string | null
  city: string | null
}

export type QuestSkillReq = {
  name: string
  level: number | null
}

export type QuestRewardItem = {
  name: string
  qty: number | null
}

export type QuestChainItem = {
  category?: string
  name?: string
  difficulty?: number
  skills?: QuestSkillReq[]
  places?: string
  raw?: string
}

/** 필요 → 선행 발견/퀘스트 */
export type QuestPrerequisite = {
  kind: 'discovery' | 'quest' | 'other'
  raw: string
  discoveryCategory?: string | null
  discoveryRank?: number | null
  discoveryName?: string | null
  nested?: string | null
  category?: string
  name?: string
  difficulty?: number
  skills?: QuestSkillReq[]
  places?: string
}

export type QuestDetail = {
  id: number
  slug: string
  name: string
  description: string | null
  category: string | null
  questType: string | null
  difficulty: number | null
  requestPlaces: string | null
  destination: string | null
  discoveryCategory: string | null
  discoveryRank: number | null
  discoveryName: string | null
  /** 발견물 DB 이름 매칭 시 참조 (없으면 null, 표시는 discoveryName 유지) */
  discoveryRef?: DiscoveryQuestRef | null
  skills: QuestSkillReq[]
  prerequisites: QuestPrerequisite[]
  rewardDucat: number | null
  rewardAdvance: number | null
  expDiscovery: number | null
  expCard: number | null
  expReport: number | null
  fameReport: number | null
  rewardItems: QuestRewardItem[]
  chainQuests: QuestChainItem[]
  linkedQuests: QuestChainItem[]
  walkthrough: string | null
  progress: string | null
  /** 로그인 유저 기준 완료 여부 */
  completed?: boolean
  completedAt?: string | null
}

export type PortReward = {
  kind: string
  amount: string
  reward: string
}

export type PortCollectItem = {
  source: string
  name: string
  rank: number | null
  type: string | null
  recommendSpot: string | null
  canExchange: boolean | null
  canRelease: boolean | null
  /** @deprecated 구 데이터 호환 — name 으로 이전 */
  items?: string
}

export type PortLinkedPlace = {
  kind: string
  content: string
}

export type PortCharacter = {
  name: string
  preferredReport: string | null
  skills: string | null
  tarot: string | null
}

export type PortProduction = {
  tab: string
  maker: string
  items: string
}

export type PortDestination = {
  source: string
  discovery: string
  content: string
}

export type PortSaleItem = {
  vendor: string
  category: string
  item: string
  development: string | null
  investment: string | null
  contribution: string | null
  capital: string | null
  era: string | null
  price: string | null
}

export type PortDetail = {
  id: number
  slug: string
  name: string
  altName: string | null
  description: string | null
  category: string | null
  region: string | null
  seaArea: string | null
  coordX: number | null
  coordY: number | null
  entryPermit: string | null
  culture: string | null
  language: string | null
  facilities: string | null
  flagQuest: string | null
  rewards: PortReward[]
  collectItems: PortCollectItem[]
  linkedPlaces: PortLinkedPlace[]
  characters: PortCharacter[]
  productions: PortProduction[]
  destinations: PortDestination[]
  saleItems: PortSaleItem[]
}

export type RegionSeaGroup = {
  group: string
  seaAreas: string[]
}

export type RegionDetail = {
  id: number
  slug: string
  name: string
  altName: string | null
  description: string | null
  seaGroups: RegionSeaGroup[]
}

export type EntryPermitQuest = {
  kind: string
  difficulty: number | null
  name: string
}

export type EntryPermitCityQuests = {
  city: string
  quests: EntryPermitQuest[]
}

export type EntryPermitFame = {
  nationality: string | null
  general: string | null
  countryEvent: string | null
}

export type EntryPermitDetail = {
  id: number
  slug: string
  name: string
  altName: string | null
  description: string | null
  requirement: string | null
  fame: EntryPermitFame[]
  cityQuests: EntryPermitCityQuests[]
}

export type MemorialAlbumItem = {
  name: string
  note: string | null
}

export type MemorialAlbumDetail = {
  id: number
  slug: string
  name: string
  altName: string | null
  description: string | null
  category: string | null
  rewardNpc: string | null
  rewardItem: string | null
  itemCount: number | null
  items: MemorialAlbumItem[]
}

export type FieldSurveyTask = {
  required: boolean
  kind: string | null
  item: string | null
  count: number | null
  completionGain: string | null
}

export type FieldLandSurvey = {
  stage: number
  completionLimit: string | null
  tasks: FieldSurveyTask[]
}

export type FieldResurveyRewardItem = {
  name: string
  qty: number | null
}

export type FieldResurveyReward = {
  kind: string
  items: FieldResurveyRewardItem[]
  raw: string
}

export type FieldLinkedPlace = {
  kind: string
  name: string
}

export type FieldCollectItem = {
  source: string
  name: string
  rank: number | null
  type: string | null
  recommendSpot: string | null
  canExchange: boolean | null
  canRelease: boolean | null
}

export type FieldDestination = {
  source: string
  discovery: string
  content: string
}

export type FieldLandNpc = {
  level: number | null
  trait: string | null
  names: string[]
}

export type FieldDetail = {
  id: number
  slug: string
  name: string
  altName: string | null
  description: string | null
  fieldKind: string | null
  region: string | null
  seaArea: string | null
  coordX: number | null
  coordY: number | null
  linkedPlaces: FieldLinkedPlace[]
  landSurveys: FieldLandSurvey[]
  resurveyRewards: FieldResurveyReward[]
  collectItems: FieldCollectItem[]
  destinations: FieldDestination[]
  landNpcs: FieldLandNpc[]
}

export type SeaAreaPlace = {
  kind: string
  name: string
}

/** 낚시·채집·애완동물 항목 (1행 = 1아이템) */
export type SeaAreaCollectItem = {
  source: string
  name: string
  rank: number | null
  type: string | null
  recommendSpot: string | null
  canExchange: boolean | null
  canRelease: boolean | null
}

export type SeaAreaDestination = {
  source: string
  discovery: string
  content: string
}

export type SeaAreaNpc = {
  fleetCount: number | null
  trait: string | null
  names: string[]
}

export type SeaAreaDetail = {
  id: number
  slug: string
  name: string
  /** 추가 이름 */
  altName: string | null
  description: string | null
  category: string | null
  /** 대표 지역 (regions[0]) */
  region: string | null
  regions: string[]
  boundNorth: number | null
  boundWest: number | null
  boundSouth: number | null
  boundEast: number | null
  wave: number | null
  current: number | null
  maxSpeedBonus: string | null
  places: SeaAreaPlace[]
  collectItems: SeaAreaCollectItem[]
  destinations: SeaAreaDestination[]
  seaNpcs: SeaAreaNpc[]
}

export type ConsumablePurchase = {
  npc: string
  region: string
  place: string
  price?: string | null
}

/** 퀘스트·아이템 사용·트레져박스·이벤트 */
export type ConsumableInfoRow = {
  name: string
  detail: string | null
}

export type ConsumableProduction = {
  recipeBook: string
  recipe: string
  skill: string
  materials: string
}

export type ConsumableLandResurvey = {
  region: string
  fields: string
}

export type ConsumablePet = {
  category: string
  region: string
  place: string
}

export type ConsumableDetail = {
  id: number
  slug: string
  name: string
  description: string | null
  category: string | null
  useEffect: string | null
  acquireMethods: string[]
  purchases: ConsumablePurchase[]
  productions: ConsumableProduction[]
  quests: ConsumableInfoRow[]
  itemUses: ConsumableInfoRow[]
  treasureBoxes: ConsumableInfoRow[]
  events: ConsumableInfoRow[]
  landResurveys: ConsumableLandResurvey[]
  pets: ConsumablePet[]
}

export type EquipmentSkillBonus = {
  name: string
  rank: string | null
}

export type EquipmentRequirements = {
  fame: string | null
  infamy: string | null
  gender: string | null
  jobClass: string | null
  title: string | null
  alias: string | null
}

export type EquipmentTransmutation = {
  policy: string
  skills: string
  materials: string
  product: string
}

export type EquipmentQuestAcquire = {
  quest: string
  destination: string
}

export type EquipmentInfoRow = {
  name: string
  detail: string | null
}

export type EquipmentDetail = {
  id: number
  slug: string
  name: string
  altName: string | null
  description: string | null
  category: string | null
  useEffect: string | null
  equipSlot: string | null
  durability: string | null
  attack: string | null
  defense: string | null
  dressEtiquette: string | null
  disguise: string | null
  skills: EquipmentSkillBonus[]
  equipmentEffects: EquipmentSkillBonus[]
  memorialAlbum: string | null
  requirements: EquipmentRequirements
  nonTradable: boolean
  acquireMethods: string[]
  purchases: ConsumablePurchase[]
  transmutations: EquipmentTransmutation[]
  quests: EquipmentQuestAcquire[]
  treasureMaps: EquipmentInfoRow[]
  memorialAlbums: EquipmentInfoRow[]
}

export type DiscoveryCategory = {
  id: number
  code: string
  name: string
  sortOrder: number
}

export type DiscoveryCategoryGroup = {
  id: number
  code: string
  name: string
  sortOrder: number
  categories: DiscoveryCategory[]
}

export type DiscoveryQuestRef = {
  id: number
  slug: string
  name: string
  /** 발견 방법 풀 문구용 (acquireQuest 매칭 시) */
  category?: string | null
  questType?: string | null
  difficulty?: number | null
  requestPlaces?: string | null
  skills?: QuestSkillReq[]
}

export type DiscoveryLinkedQuest = {
  tag: string | null
  title: string
  raw: string
  quest: DiscoveryQuestRef | null
}

export type DiscoveryDebateCombo = {
  effect: string | null
  comboName: string | null
  cards: string[]
}

export type SkillPlace = {
  region: string
  city: string
  npc: string | null
}

export type SkillCity = {
  region: string
  city: string
}

export type SkillAcquireCondition = {
  kind: string
  content: string
}

export type SkillOfficer = {
  name: string
  job: string | null
  adventure: string | null
  trade: string | null
  battle: string | null
  trait: string | null
}

export type SkillEffectItem = {
  kind: string
  item: string
}

export type SkillDetail = {
  id: number
  slug: string
  name: string
  altName: string | null
  description: string | null
  category: string | null
  officerDuty: string | null
  rangeScope: string | null
  actionPower: string | null
  autoEffect: string | null
  refineEffect: string | null
  learnCost: number | null
  equipCost: number | null
  prerequisite: string | null
  preferredJobs: string[]
  acquireConditions: SkillAcquireCondition[]
  learnPlaces: SkillPlace[]
  useCities: SkillCity[]
  officers: SkillOfficer[]
  effectItems: SkillEffectItem[]
}

export type ShipMaterialEffect = {
  stat: string
  min: number | null
  max: number | null
}

export type ShipMaterialAcquire = {
  source: string
  items: string[]
}

export type ShipMaterialDetail = {
  id: number
  code: string
  name: string
  description: string | null
  materialKind: string | null
  materialLabel: string | null
  effects: ShipMaterialEffect[]
  acquireMethods: ShipMaterialAcquire[]
  sortOrder: number
}

export type DiscoveryDetail = {
  id: number
  slug: string
  name: string
  description: string | null
  category: string | null
  categoryGroup: string | null
  categoryId: number | null
  rank: number | null
  cardPoints: number | null
  discoveryExp: number | null
  cardExp: number | null
  reportFame: number | null
  skills: QuestSkillReq[]
  acquireType: string | null
  acquireName: string | null
  place: string | null
  linkedQuests: DiscoveryLinkedQuest[]
  debateCombo: DiscoveryDebateCombo | null
  acquireQuest: DiscoveryQuestRef | null
}
