export type User = {
  id: string
  username: string
  nickname: string
  role: 'admin' | 'member'
  level: number
  xp: number
  xpToNext: number
  createdAt: string
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
  acquireMethod: string | null
  enhanceCount: number | null
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
  skills: string[]
  sailTotal: number
  loadTotal: number
}
