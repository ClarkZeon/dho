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
  buildDays: number | null
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
  skills: QuestSkillReq[]
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
}

export type PortReward = {
  kind: string
  amount: string
  reward: string
}

export type PortCollectItem = {
  source: string
  rank: number | null
  type: string | null
  items: string
}

export type PortDetail = {
  id: number
  slug: string
  name: string
  description: string | null
  category: string | null
  region: string | null
  seaArea: string | null
  coordX: number | null
  coordY: number | null
  entryPermit: string | null
  culture: string | null
  language: string | null
  rewards: PortReward[]
  collectItems: PortCollectItem[]
}
