import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import {
  deleteAdminUser,
  deleteConsumable,
  deleteDiscovery,
  deleteField,
  deleteSeaArea,
  deleteSkill,
  deletePort,
  deleteRegion,
  deleteEntryPermit,
  deleteQuest,
  deleteShip,
  deleteShipMaterial,
  fetchAdminUsers,
  fetchBoards,
  fetchConsumables,
  fetchDiscoveries,
  fetchFields,
  fetchSeaAreas,
  fetchSkills,
  fetchPorts,
  fetchRegions,
  fetchEntryPermits,
  fetchQuest,
  fetchQuests,
  fetchShipMaterials,
  fetchShips,
  importConsumableText,
  importDiscoveryText,
  importFieldText,
  importSeaAreaText,
  importSkillText,
  importPortText,
  importRegionText,
  importEntryPermitText,
  importQuestText,
  importShipMaterialText,
  importShipText,
  updateAdminUserRole,
  updateDiscovery,
  updateQuest,
} from '../lib/api'
import type {
  AdminUser,
  BoardSummary,
  ConsumableDetail,
  DiscoveryDetail,
  DiscoveryQuestRef,
  FieldDetail,
  SeaAreaDetail,
  SkillDetail,
  PortDetail,
  RegionDetail,
  EntryPermitDetail,
  QuestDetail,
  ShipDetail,
  ShipMaterialDetail,
  User,
} from '../types'
import { AdminDashboard } from './AdminDashboard'
import { BoardView } from './BoardView'
import { BrandMark } from './BrandMark'
import { ConsumableDetailView } from './ConsumableDetailView'
import { DetailModal } from './DetailModal'
import { DiscoveryDetailView } from './DiscoveryDetailView'
import { FieldDetailView } from './FieldDetailView'
import { SeaAreaDetailView } from './SeaAreaDetailView'
import { SkillDetailView } from './SkillDetailView'
import { PortDetailView } from './PortDetailView'
import { RegionDetailView } from './RegionDetailView'
import { EntryPermitDetailView } from './EntryPermitDetailView'
import { QuestDiscoveryLabel } from './DiscoveryRankMark'
import { QuestDetailView } from './QuestDetailView'
import { ShipDetailView } from './ShipDetailView'
import { ShipMaterialDetailView } from './ShipMaterialDetailView'
import { ShipList } from './ShipList'
import { ShipMaterialList } from './ShipMaterialList'
import { SortableTh } from './SortableTh'
import { formatDiscoveryAcquire } from '../lib/discoveryAcquire'
import { matchesPortQuery } from '../lib/portSearch'
import { matchesRegionQuery } from '../lib/regionSearch'
import { matchesEntryPermitQuery } from '../lib/entryPermitSearch'
import { compareIdDesc, useTableSort } from '../lib/tableSort'

const SKILL_PAGE_SIZE = 15
const USER_PAGE_SIZE = 15
const QUEST_PAGE_SIZE = 15

type UserSortKey =
  | 'username'
  | 'nickname'
  | 'role'
  | 'level'
  | 'lastLoginAt'
type QuestSortKey =
  | 'name'
  | 'category'
  | 'difficulty'
  | 'requestPlaces'
  | 'destination'
  | 'discovery'
type PortSortKey =
  | 'name'
  | 'category'
  | 'region'
  | 'seaArea'
  | 'entryPermit'
  | 'language'
type RegionSortKey = 'name' | 'altName'
type EntryPermitSortKey = 'name' | 'altName'
type DiscoverySortKey =
  | 'name'
  | 'category'
  | 'rank'
  | 'cardPoints'
  | 'acquire'
type SkillSortKey =
  | 'name'
  | 'category'
  | 'rangeScope'
  | 'learnCost'
  | 'useCities'

type AdminNav =
  | 'dashboard'
  | 'users'
  | 'boards'
  | 'ships'
  | 'quests'
  | 'ports'
  | 'regions'
  | 'entry-permits'
  | 'discoveries'
  | 'skills'
  | 'fields'
  | 'sea-areas'
  | 'materials'
  | 'consumables'

type AdminPanelProps = {
  user: User
  token: string
  onLogout: () => void
  onToast: (text: string) => void
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return value
  }
}

export function AdminPanel({ user, token, onLogout, onToast }: AdminPanelProps) {
  const [nav, setNav] = useState<AdminNav>('dashboard')
  const [manageMenuOpen, setManageMenuOpen] = useState(false)
  const [communityMenuOpen, setCommunityMenuOpen] = useState(false)
  const [shipsMenuOpen, setShipsMenuOpen] = useState(false)
  const [atlasMenuOpen, setAtlasMenuOpen] = useState(false)
  const [regionsMenuOpen, setRegionsMenuOpen] = useState(false)
  const [itemsMenuOpen, setItemsMenuOpen] = useState(false)
  const [captainMenuOpen, setCaptainMenuOpen] = useState(false)
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [boardId, setBoardId] = useState<string | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [usersError, setUsersError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [userQuery, setUserQuery] = useState('')
  const [userPage, setUserPage] = useState(0)

  function goNav(next: AdminNav) {
    setNav(next)
    if (next === 'users') {
      setManageMenuOpen(true)
    }
    if (next === 'boards') {
      setCommunityMenuOpen(true)
    }
    if (next === 'ships' || next === 'materials') {
      setShipsMenuOpen(true)
    }
    if (next === 'quests' || next === 'discoveries') {
      setAtlasMenuOpen(true)
    }
    if (
      next === 'ports' ||
      next === 'regions' ||
      next === 'entry-permits' ||
      next === 'fields' ||
      next === 'sea-areas'
    ) {
      setRegionsMenuOpen(true)
    }
    if (next === 'consumables') {
      setItemsMenuOpen(true)
    }
    if (next === 'skills') {
      setCaptainMenuOpen(true)
    }
  }

  function goBoard(id: string) {
    setBoardId(id)
    goNav('boards')
  }

  const [ships, setShips] = useState<ShipDetail[]>([])
  const [loadingShips, setLoadingShips] = useState(false)
  const [shipsError, setShipsError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState('')
  const [detailShip, setDetailShip] = useState<ShipDetail | null>(null)

  const [quests, setQuests] = useState<QuestDetail[]>([])
  const [loadingQuests, setLoadingQuests] = useState(false)
  const [questsError, setQuestsError] = useState('')
  const [showQuestImport, setShowQuestImport] = useState(false)
  const [questImportText, setQuestImportText] = useState('')
  const [importingQuest, setImportingQuest] = useState(false)
  const [questImportNote, setQuestImportNote] = useState('')
  const [detailQuest, setDetailQuest] = useState<QuestDetail | null>(null)
  const [busyQuestId, setBusyQuestId] = useState<number | null>(null)
  const [busyDiscoveryId, setBusyDiscoveryId] = useState<number | null>(null)
  const [questQuery, setQuestQuery] = useState('')
  const [questQueryDebounced, setQuestQueryDebounced] = useState('')
  const [questPage, setQuestPage] = useState(0)
  const [questTotal, setQuestTotal] = useState(0)
  const questsSort = useTableSort<QuestSortKey>()

  const [ports, setPorts] = useState<PortDetail[]>([])
  const [loadingPorts, setLoadingPorts] = useState(false)
  const [portsError, setPortsError] = useState('')
  const [showPortImport, setShowPortImport] = useState(false)
  const [portImportText, setPortImportText] = useState('')
  const [importingPort, setImportingPort] = useState(false)
  const [portImportNote, setPortImportNote] = useState('')
  const [detailPort, setDetailPort] = useState<PortDetail | null>(null)
  const [portQuery, setPortQuery] = useState('')

  const [regions, setRegions] = useState<RegionDetail[]>([])
  const [loadingRegions, setLoadingRegions] = useState(false)
  const [regionsError, setRegionsError] = useState('')
  const [showRegionImport, setShowRegionImport] = useState(false)
  const [regionImportText, setRegionImportText] = useState('')
  const [importingRegion, setImportingRegion] = useState(false)
  const [regionImportNote, setRegionImportNote] = useState('')
  const [detailRegion, setDetailRegion] = useState<RegionDetail | null>(null)
  const [regionQuery, setRegionQuery] = useState('')

  const [entryPermits, setEntryPermits] = useState<EntryPermitDetail[]>([])
  const [loadingEntryPermits, setLoadingEntryPermits] = useState(false)
  const [entryPermitsError, setEntryPermitsError] = useState('')
  const [showEntryPermitImport, setShowEntryPermitImport] = useState(false)
  const [entryPermitImportText, setEntryPermitImportText] = useState('')
  const [importingEntryPermit, setImportingEntryPermit] = useState(false)
  const [entryPermitImportNote, setEntryPermitImportNote] = useState('')
  const [detailEntryPermit, setDetailEntryPermit] =
    useState<EntryPermitDetail | null>(null)
  const [entryPermitQuery, setEntryPermitQuery] = useState('')

  const [discoveries, setDiscoveries] = useState<DiscoveryDetail[]>([])
  const [loadingDiscoveries, setLoadingDiscoveries] = useState(false)
  const [discoveriesError, setDiscoveriesError] = useState('')
  const [showDiscoveryImport, setShowDiscoveryImport] = useState(false)
  const [discoveryImportText, setDiscoveryImportText] = useState('')
  const [importingDiscovery, setImportingDiscovery] = useState(false)
  const [discoveryImportNote, setDiscoveryImportNote] = useState('')
  const [detailDiscovery, setDetailDiscovery] =
    useState<DiscoveryDetail | null>(null)

  const [skills, setSkills] = useState<SkillDetail[]>([])
  const [loadingSkills, setLoadingSkills] = useState(false)
  const [skillsError, setSkillsError] = useState('')
  const [showSkillImport, setShowSkillImport] = useState(false)
  const [skillImportText, setSkillImportText] = useState('')
  const [importingSkill, setImportingSkill] = useState(false)
  const [skillImportNote, setSkillImportNote] = useState('')
  const [detailSkill, setDetailSkill] =
    useState<SkillDetail | null>(null)
  const [skillPage, setSkillPage] = useState(0)

  const [fields, setFields] = useState<FieldDetail[]>([])
  const [loadingFields, setLoadingFields] = useState(false)
  const [fieldsError, setFieldsError] = useState('')
  const [showFieldImport, setShowFieldImport] = useState(false)
  const [fieldImportText, setFieldImportText] = useState('')
  const [importingField, setImportingField] = useState(false)
  const [fieldImportNote, setFieldImportNote] = useState('')
  const [detailField, setDetailField] = useState<FieldDetail | null>(null)
  const [fieldQuery, setFieldQuery] = useState('')

  const [seaAreas, setSeaAreas] = useState<SeaAreaDetail[]>([])
  const [loadingSeaAreas, setLoadingSeaAreas] = useState(false)
  const [seaAreasError, setSeaAreasError] = useState('')
  const [showSeaAreaImport, setShowSeaAreaImport] = useState(false)
  const [seaAreaImportText, setSeaAreaImportText] = useState('')
  const [importingSeaArea, setImportingSeaArea] = useState(false)
  const [seaAreaImportNote, setSeaAreaImportNote] = useState('')
  const [detailSeaArea, setDetailSeaArea] = useState<SeaAreaDetail | null>(null)
  const [seaAreaQuery, setSeaAreaQuery] = useState('')

  const [consumables, setConsumables] = useState<ConsumableDetail[]>([])
  const [loadingConsumables, setLoadingConsumables] = useState(false)
  const [consumablesError, setConsumablesError] = useState('')
  const [showConsumableImport, setShowConsumableImport] = useState(false)
  const [consumableImportText, setConsumableImportText] = useState('')
  const [importingConsumable, setImportingConsumable] = useState(false)
  const [consumableImportNote, setConsumableImportNote] = useState('')
  const [detailConsumable, setDetailConsumable] =
    useState<ConsumableDetail | null>(null)
  const [consumableQuery, setConsumableQuery] = useState('')

  const [materials, setMaterials] = useState<ShipMaterialDetail[]>([])
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  const [materialsError, setMaterialsError] = useState('')
  const [showMaterialImport, setShowMaterialImport] = useState(false)
  const [materialImportText, setMaterialImportText] = useState('')
  const [importingMaterial, setImportingMaterial] = useState(false)
  const [materialImportNote, setMaterialImportNote] = useState('')
  const [detailMaterial, setDetailMaterial] =
    useState<ShipMaterialDetail | null>(null)

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    setUsersError('')
    try {
      const res = await fetchAdminUsers(token)
      setUsers(res.users)
    } catch (err) {
      setUsersError(
        err instanceof Error ? err.message : '회원 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoadingUsers(false)
    }
  }, [token])

  const loadShips = useCallback(async () => {
    setLoadingShips(true)
    setShipsError('')
    try {
      const res = await fetchShips(token)
      setShips(res.ships)
    } catch (err) {
      setShipsError(
        err instanceof Error ? err.message : '선박 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoadingShips(false)
    }
  }, [token])

  const loadQuests = useCallback(async (opts?: { quiet?: boolean }) => {
    setQuestsError('')
    if (!opts?.quiet) setLoadingQuests(true)
    try {
      const res = await fetchQuests(token, {
        q: questQueryDebounced,
        limit: QUEST_PAGE_SIZE,
        offset: questPage * QUEST_PAGE_SIZE,
        sort: questsSort.sortKey,
        dir: questsSort.sortKey ? questsSort.sortDir : undefined,
      })
      setQuests(res.quests)
      setQuestTotal(res.total)
    } catch (err) {
      setQuestsError(
        err instanceof Error ? err.message : '퀘스트 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoadingQuests(false)
    }
  }, [
    token,
    questQueryDebounced,
    questPage,
    questsSort.sortKey,
    questsSort.sortDir,
  ])

  const loadPorts = useCallback(async () => {
    setLoadingPorts(true)
    setPortsError('')
    try {
      const res = await fetchPorts(token)
      setPorts(res.ports)
    } catch (err) {
      setPortsError(
        err instanceof Error
          ? err.message
          : '항구(도시) 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoadingPorts(false)
    }
  }, [token])

  const loadRegions = useCallback(async () => {
    setLoadingRegions(true)
    setRegionsError('')
    try {
      const res = await fetchRegions(token)
      setRegions(res.regions)
    } catch (err) {
      setRegionsError(
        err instanceof Error
          ? err.message
          : '지역 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoadingRegions(false)
    }
  }, [token])

  const loadEntryPermits = useCallback(async () => {
    setLoadingEntryPermits(true)
    setEntryPermitsError('')
    try {
      const res = await fetchEntryPermits(token)
      setEntryPermits(res.entryPermits)
    } catch (err) {
      setEntryPermitsError(
        err instanceof Error
          ? err.message
          : '입항허가 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoadingEntryPermits(false)
    }
  }, [token])

  const loadDiscoveries = useCallback(async () => {
    setLoadingDiscoveries(true)
    setDiscoveriesError('')
    try {
      const res = await fetchDiscoveries(token)
      setDiscoveries(res.discoveries)
    } catch (err) {
      setDiscoveriesError(
        err instanceof Error
          ? err.message
          : '발견물 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoadingDiscoveries(false)
    }
  }, [token])

  const loadSkills = useCallback(async () => {
    setLoadingSkills(true)
    setSkillsError('')
    try {
      const res = await fetchSkills(token)
      setSkills(res.skills)
      setSkillPage(0)
    } catch (err) {
      setSkillsError(
        err instanceof Error
          ? err.message
          : '스킬 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoadingSkills(false)
    }
  }, [token])

  const loadFields = useCallback(async () => {
    setLoadingFields(true)
    setFieldsError('')
    try {
      const res = await fetchFields(token)
      setFields(res.fields)
    } catch (err) {
      setFieldsError(
        err instanceof Error ? err.message : '필드 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoadingFields(false)
    }
  }, [token])

  const loadSeaAreas = useCallback(async () => {
    setLoadingSeaAreas(true)
    setSeaAreasError('')
    try {
      const res = await fetchSeaAreas(token)
      setSeaAreas(res.seaAreas)
    } catch (err) {
      setSeaAreasError(
        err instanceof Error ? err.message : '해역 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoadingSeaAreas(false)
    }
  }, [token])

  const loadConsumables = useCallback(async () => {
    setLoadingConsumables(true)
    setConsumablesError('')
    try {
      const res = await fetchConsumables(token)
      setConsumables(res.consumables)
    } catch (err) {
      setConsumablesError(
        err instanceof Error
          ? err.message
          : '소비품 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoadingConsumables(false)
    }
  }, [token])

  const usersSort = useTableSort<UserSortKey>()
  const portsSort = useTableSort<PortSortKey>()
  const regionsSort = useTableSort<RegionSortKey>()
  const entryPermitsSort = useTableSort<EntryPermitSortKey>()
  const discoveriesSort = useTableSort<DiscoverySortKey>()
  const skillsSort = useTableSort<SkillSortKey>()

  const userQueryLower = userQuery.trim().toLowerCase()
  const filteredUsers = users.filter((row) => {
    if (!userQueryLower) return true
    const haystack = [
      row.username,
      row.nickname,
      row.role,
      row.level,
      row.lastLoginAt,
    ]
      .filter((v) => v != null && v !== '')
      .join(' ')
      .toLowerCase()
    return haystack.includes(userQueryLower)
  })
  const sortedUsers = usersSort.sortRows(
    filteredUsers,
    (row, key) => {
      if (key === 'lastLoginAt') return row.lastLoginAt || ''
      return row[key]
    },
    (a, b) => a.username.localeCompare(b.username, 'ko'),
    (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')),
  )
  const userTotalPages = Math.max(
    1,
    Math.ceil(sortedUsers.length / USER_PAGE_SIZE),
  )
  const userSafePage = Math.min(userPage, userTotalPages - 1)
  const userPageItems = sortedUsers.slice(
    userSafePage * USER_PAGE_SIZE,
    userSafePage * USER_PAGE_SIZE + USER_PAGE_SIZE,
  )
  const questTotalPages = Math.max(
    1,
    Math.ceil(questTotal / QUEST_PAGE_SIZE),
  )
  const questSafePage = Math.min(questPage, questTotalPages - 1)
  const sortedPorts = portsSort.sortRows(
    ports.filter((port) => matchesPortQuery(port, portQuery)),
    (port, key) => port[key],
    (a, b) => a.id - b.id,
    compareIdDesc,
  )
  const sortedRegions = regionsSort.sortRows(
    regions.filter((region) => matchesRegionQuery(region, regionQuery)),
    (region, key) => region[key],
    (a, b) => a.id - b.id,
    compareIdDesc,
  )
  const sortedEntryPermits = entryPermitsSort.sortRows(
    entryPermits.filter((item) => matchesEntryPermitQuery(item, entryPermitQuery)),
    (item, key) => item[key],
    (a, b) => a.id - b.id,
    compareIdDesc,
  )
  const sortedDiscoveries = discoveriesSort.sortRows(
    discoveries,
    (discovery, key) => {
      if (key === 'acquire') {
        return formatDiscoveryAcquire(discovery)
      }
      return discovery[key]
    },
    (a, b) => a.id - b.id,
    compareIdDesc,
  )
  const sortedSkills = skillsSort.sortRows(
    skills,
    (skill, key) => {
      if (key === 'useCities') {
        return skill.useCities?.length
          ? skill.useCities.map((c) => c.city).join(', ')
          : ''
      }
      return skill[key]
    },
    (a, b) => a.id - b.id,
    compareIdDesc,
  )

  const skillTotalPages = Math.max(
    1,
    Math.ceil(sortedSkills.length / SKILL_PAGE_SIZE),
  )
  const skillSafePage = Math.min(skillPage, skillTotalPages - 1)
  const skillPageItems = sortedSkills.slice(
    skillSafePage * SKILL_PAGE_SIZE,
    skillSafePage * SKILL_PAGE_SIZE + SKILL_PAGE_SIZE,
  )

  const loadMaterials = useCallback(async () => {
    setLoadingMaterials(true)
    setMaterialsError('')
    try {
      const res = await fetchShipMaterials(token)
      setMaterials(res.materials)
    } catch (err) {
      setMaterialsError(
        err instanceof Error
          ? err.message
          : '선박 재료 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoadingMaterials(false)
    }
  }, [token])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetchBoards(token)
        if (!alive) return
        setBoards(res.boards)
        setBoardId((prev) => prev || res.boards[0]?.id || null)
      } catch {
        if (!alive) return
        setBoards([])
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  useEffect(() => {
    if (nav === 'users') void loadUsers()
    if (nav === 'ships') void loadShips()
    if (nav === 'ports') void loadPorts()
    if (nav === 'regions') void loadRegions()
    if (nav === 'entry-permits') void loadEntryPermits()
    if (nav === 'discoveries') {
      void loadDiscoveries()
    }
    if (nav === 'skills') void loadSkills()
    if (nav === 'fields') void loadFields()
    if (nav === 'sea-areas') void loadSeaAreas()
    if (nav === 'consumables') void loadConsumables()
    if (nav === 'materials') void loadMaterials()
  }, [
    nav,
    loadUsers,
    loadShips,
    loadPorts,
    loadRegions,
    loadEntryPermits,
    loadDiscoveries,
    loadSkills,
    loadFields,
    loadSeaAreas,
    loadConsumables,
    loadMaterials,
  ])

  useEffect(() => {
    const next = questQuery.trim()
    const timer = window.setTimeout(() => {
      setQuestQueryDebounced((prev) => {
        if (prev !== next) setQuestPage(0)
        return next
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [questQuery])

  useEffect(() => {
    if (nav !== 'quests') return
    void loadQuests()
  }, [nav, loadQuests])

  useEffect(() => {
    if (questPage > questSafePage) setQuestPage(questSafePage)
  }, [questPage, questSafePage])

  async function openQuestByRef(ref: DiscoveryQuestRef) {
    const cached = quests.find((q) => q.id === ref.id)
    if (cached) {
      setDetailQuest(cached)
      return
    }
    try {
      const res = await fetchQuest(token, ref.id)
      setDetailQuest(res.quest)
    } catch {
      onToast(`「${ref.name}」 퀘스트가 아직 등록되지 않았습니다.`)
    }
  }

  async function handleRoleChange(target: AdminUser, role: 'admin' | 'member') {
    if (target.role === role) return
    setBusyId(target.id)
    try {
      const res = await updateAdminUserRole(token, target.id, role)
      setUsers((prev) =>
        prev.map((u) => (u.id === target.id ? res.user : u)),
      )
      onToast(`${target.nickname} 역할을 ${role}(으)로 변경했습니다.`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '역할 변경에 실패했습니다.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDeleteUser(target: AdminUser) {
    if (
      !window.confirm(
        `「${target.nickname}」(${target.username}) 계정을 삭제할까요?`,
      )
    ) {
      return
    }
    const key = `user:${target.id}`
    setDeletingKey(key)
    try {
      await deleteAdminUser(token, target.id)
      setUsers((prev) => prev.filter((u) => u.id !== target.id))
      onToast(`${target.nickname} 계정을 삭제했습니다.`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingKey(null)
    }
  }

  async function handleDeleteShip(ship: ShipDetail) {
    if (!window.confirm(`「${ship.name}」 선박을 삭제할까요?`)) return
    const key = `ship:${ship.id}`
    setDeletingKey(key)
    try {
      await deleteShip(token, ship.id)
      setShips((prev) => prev.filter((s) => s.id !== ship.id))
      if (detailShip?.id === ship.id) setDetailShip(null)
      onToast(`선박 「${ship.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingKey(null)
    }
  }

  async function handleDeleteQuest(quest: QuestDetail) {
    if (!window.confirm(`「${quest.name}」 퀘스트를 삭제할까요?`)) return
    const key = `quest:${quest.id}`
    setDeletingKey(key)
    try {
      await deleteQuest(token, quest.id)
      if (detailQuest?.id === quest.id) setDetailQuest(null)
      onToast(`퀘스트 「${quest.name}」을(를) 삭제했습니다.`)
      await loadQuests({ quiet: true })
    } catch (err) {
      onToast(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingKey(null)
    }
  }

  async function handleDeletePort(port: PortDetail) {
    if (!window.confirm(`「${port.name}」 항구(도시)를 삭제할까요?`)) return
    const key = `port:${port.id}`
    setDeletingKey(key)
    try {
      await deletePort(token, port.id)
      setPorts((prev) => prev.filter((p) => p.id !== port.id))
      if (detailPort?.id === port.id) setDetailPort(null)
      onToast(`항구 「${port.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingKey(null)
    }
  }

  async function handleDeleteRegion(region: RegionDetail) {
    if (!window.confirm(`「${region.name}」 지역을 삭제할까요?`)) return
    const key = `region:${region.id}`
    setDeletingKey(key)
    try {
      await deleteRegion(token, region.id)
      setRegions((prev) => prev.filter((r) => r.id !== region.id))
      if (detailRegion?.id === region.id) setDetailRegion(null)
      onToast(`지역 「${region.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingKey(null)
    }
  }

  async function handleDeleteEntryPermit(permit: EntryPermitDetail) {
    if (!window.confirm(`「${permit.name}」 입항허가를 삭제할까요?`)) return
    const key = `entry-permit:${permit.id}`
    setDeletingKey(key)
    try {
      await deleteEntryPermit(token, permit.id)
      setEntryPermits((prev) => prev.filter((p) => p.id !== permit.id))
      if (detailEntryPermit?.id === permit.id) setDetailEntryPermit(null)
      onToast(`입항허가 「${permit.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingKey(null)
    }
  }

  async function handleDeleteField(field: FieldDetail) {
    if (!window.confirm(`「${field.name}」 필드를 삭제할까요?`)) return
    const key = `field:${field.id}`
    setDeletingKey(key)
    try {
      await deleteField(token, field.id)
      setFields((prev) => prev.filter((f) => f.id !== field.id))
      if (detailField?.id === field.id) setDetailField(null)
      onToast(`필드 「${field.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingKey(null)
    }
  }

  async function handleDeleteSeaArea(seaArea: SeaAreaDetail) {
    if (!window.confirm(`「${seaArea.name}」 해역을 삭제할까요?`)) return
    const key = `sea-area:${seaArea.id}`
    setDeletingKey(key)
    try {
      await deleteSeaArea(token, seaArea.id)
      setSeaAreas((prev) => prev.filter((s) => s.id !== seaArea.id))
      if (detailSeaArea?.id === seaArea.id) setDetailSeaArea(null)
      onToast(`해역 「${seaArea.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingKey(null)
    }
  }

  async function handleDeleteConsumable(consumable: ConsumableDetail) {
    if (!window.confirm(`「${consumable.name}」 소비품을 삭제할까요?`)) return
    const key = `consumable:${consumable.id}`
    setDeletingKey(key)
    try {
      await deleteConsumable(token, consumable.id)
      setConsumables((prev) => prev.filter((c) => c.id !== consumable.id))
      if (detailConsumable?.id === consumable.id) setDetailConsumable(null)
      onToast(`소비품 「${consumable.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingKey(null)
    }
  }

  async function handleDeleteDiscovery(discovery: DiscoveryDetail) {
    if (!window.confirm(`「${discovery.name}」 발견물을 삭제할까요?`)) return
    const key = `discovery:${discovery.id}`
    setDeletingKey(key)
    try {
      await deleteDiscovery(token, discovery.id)
      setDiscoveries((prev) => prev.filter((d) => d.id !== discovery.id))
      if (detailDiscovery?.id === discovery.id) setDetailDiscovery(null)
      onToast(`발견물 「${discovery.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingKey(null)
    }
  }

  async function handleDeleteSkill(skill: SkillDetail) {
    if (!window.confirm(`「${skill.name}」 스킬을 삭제할까요?`)) return
    const key = `skill:${skill.id}`
    setDeletingKey(key)
    try {
      await deleteSkill(token, skill.id)
      setSkills((prev) => prev.filter((l) => l.id !== skill.id))
      if (detailSkill?.id === skill.id) setDetailSkill(null)
      onToast(`스킬 「${skill.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingKey(null)
    }
  }

  async function handleDeleteMaterial(material: ShipMaterialDetail) {
    if (!window.confirm(`「${material.name}」 재료를 삭제할까요?`)) return
    const key = `material:${material.id}`
    setDeletingKey(key)
    try {
      await deleteShipMaterial(token, material.id)
      setMaterials((prev) => prev.filter((m) => m.id !== material.id))
      if (detailMaterial?.id === material.id) setDetailMaterial(null)
      onToast(`재료 「${material.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingKey(null)
    }
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!importText.trim()) {
      setImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImporting(true)
    setImportNote('')
    try {
      const res = await importShipText(token, importText)
      setImportText('')
      setShowImport(false)
      setImportNote(`「${res.ship.name}」을(를) 등록했습니다.`)
      onToast(`선박 「${res.ship.name}」 저장 완료`)
      await loadShips()
    } catch (err) {
      setImportNote(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setImporting(false)
    }
  }

  async function handleQuestImport(e: FormEvent) {
    e.preventDefault()
    if (!questImportText.trim()) {
      setQuestImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImportingQuest(true)
    setQuestImportNote('')
    try {
      const res = await importQuestText(token, questImportText)
      setQuestImportText('')
      setShowQuestImport(false)
      setQuestImportNote(
        `「${res.quest.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast(`퀘스트 「${res.quest.name}」 저장 완료`)
      await loadQuests()
    } catch (err) {
      setQuestImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImportingQuest(false)
    }
  }

  async function handleFieldImport(e: FormEvent) {
    e.preventDefault()
    if (!fieldImportText.trim()) {
      setFieldImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImportingField(true)
    setFieldImportNote('')
    try {
      const res = await importFieldText(token, fieldImportText)
      setFieldImportText('')
      setShowFieldImport(false)
      setFieldImportNote(
        `「${res.field.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast(`필드 「${res.field.name}」 저장 완료`)
      await loadFields()
    } catch (err) {
      setFieldImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImportingField(false)
    }
  }

  async function handleSeaAreaImport(e: FormEvent) {
    e.preventDefault()
    if (!seaAreaImportText.trim()) {
      setSeaAreaImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImportingSeaArea(true)
    setSeaAreaImportNote('')
    try {
      const res = await importSeaAreaText(token, seaAreaImportText)
      setSeaAreaImportText('')
      setShowSeaAreaImport(false)
      setSeaAreaImportNote(
        `「${res.seaArea.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast(`해역 「${res.seaArea.name}」 저장 완료`)
      await loadSeaAreas()
    } catch (err) {
      setSeaAreaImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImportingSeaArea(false)
    }
  }

  async function handlePortImport(e: FormEvent) {
    e.preventDefault()
    if (!portImportText.trim()) {
      setPortImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImportingPort(true)
    setPortImportNote('')
    try {
      const res = await importPortText(token, portImportText)
      setPortImportText('')
      setShowPortImport(false)
      setPortImportNote(
        `「${res.port.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast(`항구 「${res.port.name}」 저장 완료`)
      await loadPorts()
    } catch (err) {
      setPortImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImportingPort(false)
    }
  }

  async function handleRegionImport(e: FormEvent) {
    e.preventDefault()
    if (!regionImportText.trim()) {
      setRegionImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImportingRegion(true)
    setRegionImportNote('')
    try {
      const res = await importRegionText(token, regionImportText)
      setRegionImportText('')
      setShowRegionImport(false)
      setRegionImportNote(
        `「${res.region.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast(`지역 「${res.region.name}」 저장 완료`)
      await loadRegions()
    } catch (err) {
      setRegionImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImportingRegion(false)
    }
  }

  async function handleEntryPermitImport(e: FormEvent) {
    e.preventDefault()
    if (!entryPermitImportText.trim()) {
      setEntryPermitImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImportingEntryPermit(true)
    setEntryPermitImportNote('')
    try {
      const res = await importEntryPermitText(token, entryPermitImportText)
      setEntryPermitImportText('')
      setShowEntryPermitImport(false)
      setEntryPermitImportNote(
        `「${res.entryPermit.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast(`입항허가 「${res.entryPermit.name}」 저장 완료`)
      await loadEntryPermits()
    } catch (err) {
      setEntryPermitImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImportingEntryPermit(false)
    }
  }

  async function handleDiscoveryImport(e: FormEvent) {
    e.preventDefault()
    if (!discoveryImportText.trim()) {
      setDiscoveryImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImportingDiscovery(true)
    setDiscoveryImportNote('')
    try {
      const res = await importDiscoveryText(token, discoveryImportText)
      setDiscoveryImportText('')
      setShowDiscoveryImport(false)
      setDiscoveryImportNote(
        `「${res.discovery.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast(`발견물 「${res.discovery.name}」 저장 완료`)
      await loadDiscoveries()
    } catch (err) {
      setDiscoveryImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImportingDiscovery(false)
    }
  }

  async function handleSkillImport(e: FormEvent) {
    e.preventDefault()
    if (!skillImportText.trim()) {
      setSkillImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImportingSkill(true)
    setSkillImportNote('')
    try {
      const res = await importSkillText(token, skillImportText)
      setSkillImportText('')
      setShowSkillImport(false)
      setSkillImportNote(
        `「${res.skill.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast(`스킬 「${res.skill.name}」 저장 완료`)
      await loadSkills()
    } catch (err) {
      setSkillImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImportingSkill(false)
    }
  }

  async function handleMaterialImport(e: FormEvent) {
    e.preventDefault()
    if (!materialImportText.trim()) {
      setMaterialImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImportingMaterial(true)
    setMaterialImportNote('')
    try {
      const res = await importShipMaterialText(token, materialImportText)
      setMaterialImportText('')
      setShowMaterialImport(false)
      setMaterialImportNote(
        `「${res.material.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast(`선박 재료 「${res.material.name}」 저장 완료`)
      await loadMaterials()
    } catch (err) {
      setMaterialImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImportingMaterial(false)
    }
  }

  async function handleConsumableImport(e: FormEvent) {
    e.preventDefault()
    if (!consumableImportText.trim()) {
      setConsumableImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImportingConsumable(true)
    setConsumableImportNote('')
    try {
      const res = await importConsumableText(token, consumableImportText)
      setConsumableImportText('')
      setShowConsumableImport(false)
      setConsumableImportNote(
        `「${res.consumable.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast(`소비품 「${res.consumable.name}」 저장 완료`)
      await loadConsumables()
    } catch (err) {
      setConsumableImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImportingConsumable(false)
    }
  }

  function applyQuestUpdate(quest: QuestDetail) {
    setQuests((prev) => prev.map((q) => (q.id === quest.id ? quest : q)))
    setDetailQuest((prev) => (prev?.id === quest.id ? quest : prev))
  }

  async function handleDifficultyChange(
    quest: QuestDetail,
    value: string,
  ) {
    const difficulty = value === '' ? null : Number(value)
    if (difficulty !== null && (!Number.isInteger(difficulty) || difficulty < 0 || difficulty > 10)) {
      return
    }
    if (difficulty === quest.difficulty) return
    setBusyQuestId(quest.id)
    try {
      const res = await updateQuest(token, quest.id, { difficulty })
      applyQuestUpdate(res.quest)
      onToast(`「${res.quest.name}」 난이도 저장`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '난이도 저장에 실패했습니다.')
    } finally {
      setBusyQuestId(null)
    }
  }

  function applyDiscoveryUpdate(discovery: DiscoveryDetail) {
    setDiscoveries((prev) =>
      prev.map((d) => (d.id === discovery.id ? discovery : d)),
    )
    setDetailDiscovery((prev) =>
      prev?.id === discovery.id ? discovery : prev,
    )
  }

  async function handleDiscoveryRankChange(
    discovery: DiscoveryDetail,
    value: string,
  ) {
    const rank = value === '' ? null : Number(value)
    if (rank !== null && (!Number.isInteger(rank) || rank < 0 || rank > 10)) {
      return
    }
    if (rank === discovery.rank) return
    setBusyDiscoveryId(discovery.id)
    try {
      const res = await updateDiscovery(token, discovery.id, { rank })
      applyDiscoveryUpdate(res.discovery)
      onToast(`「${res.discovery.name}」 난이도 저장`)
    } catch (err) {
      onToast(err instanceof Error ? err.message : '난이도 저장에 실패했습니다.')
    } finally {
      setBusyDiscoveryId(null)
    }
  }

  const adminCount = users.filter((u) => u.role === 'admin').length

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-glow" aria-hidden="true" />

        <div className="admin-sidebar-brand">
          <p className="admin-sidebar-mark">
            <BrandMark />
          </p>
          <p className="admin-sidebar-sub">관리자 콘솔</p>
        </div>

        <nav className="admin-sidebar-nav" aria-label="관리 메뉴">
          <p className="admin-sidebar-label">메뉴</p>
          <button
            type="button"
            className={nav === 'dashboard' ? 'active' : ''}
            onClick={() => setNav('dashboard')}
          >
            <span className="admin-nav-index">00</span>
            <span className="admin-nav-text">대시보드</span>
          </button>
          <div
            className={`admin-nav-group${
              nav === 'users' ? ' is-active' : ''
            }${manageMenuOpen ? ' is-open' : ''}`}
          >
            <button
              type="button"
              className="admin-nav-group-toggle"
              aria-expanded={manageMenuOpen}
              aria-controls="admin-nav-manage"
              onClick={() => setManageMenuOpen((open) => !open)}
            >
              <span className="admin-nav-index">01</span>
              <span className="admin-nav-text">관리메뉴</span>
              <span className="admin-nav-chevron" aria-hidden="true" />
            </button>
            <div
              id="admin-nav-manage"
              className="admin-nav-group-items"
              hidden={!manageMenuOpen}
            >
              <button
                type="button"
                className={nav === 'users' ? 'active' : ''}
                onClick={() => goNav('users')}
              >
                <span className="admin-nav-text">회원 리스트</span>
              </button>
            </div>
          </div>
          <div
            className={`admin-nav-group${
              nav === 'boards' ? ' is-active' : ''
            }${communityMenuOpen ? ' is-open' : ''}`}
          >
            <button
              type="button"
              className="admin-nav-group-toggle"
              aria-expanded={communityMenuOpen}
              aria-controls="admin-nav-community"
              onClick={() => setCommunityMenuOpen((open) => !open)}
            >
              <span className="admin-nav-index">02</span>
              <span className="admin-nav-text">게시판</span>
              <span className="admin-nav-chevron" aria-hidden="true" />
            </button>
            <div
              id="admin-nav-community"
              className="admin-nav-group-items"
              hidden={!communityMenuOpen}
            >
              {boards.length === 0 ? (
                <p className="admin-nav-empty">게시판 없음</p>
              ) : (
                boards.map((board) => (
                  <button
                    key={board.id}
                    type="button"
                    className={
                      nav === 'boards' && boardId === board.id ? 'active' : ''
                    }
                    onClick={() => goBoard(board.id)}
                  >
                    <span className="admin-nav-text">{board.title}</span>
                  </button>
                ))
              )}
            </div>
          </div>
          <div
            className={`admin-nav-group${
              nav === 'ships' || nav === 'materials' ? ' is-active' : ''
            }${shipsMenuOpen ? ' is-open' : ''}`}
          >
            <button
              type="button"
              className="admin-nav-group-toggle"
              aria-expanded={shipsMenuOpen}
              aria-controls="admin-nav-ships"
              onClick={() => setShipsMenuOpen((open) => !open)}
            >
              <span className="admin-nav-index">03</span>
              <span className="admin-nav-text">선박</span>
              <span className="admin-nav-chevron" aria-hidden="true" />
            </button>
            <div
              id="admin-nav-ships"
              className="admin-nav-group-items"
              hidden={!shipsMenuOpen}
            >
              <button
                type="button"
                className={nav === 'ships' ? 'active' : ''}
                onClick={() => goNav('ships')}
              >
                <span className="admin-nav-text">선박 리스트</span>
              </button>
              <button
                type="button"
                className={nav === 'materials' ? 'active' : ''}
                onClick={() => goNav('materials')}
              >
                <span className="admin-nav-text">선박 재료 리스트</span>
              </button>
            </div>
          </div>
          <div
            className={`admin-nav-group${
              nav === 'quests' || nav === 'discoveries' ? ' is-active' : ''
            }${atlasMenuOpen ? ' is-open' : ''}`}
          >
            <button
              type="button"
              className="admin-nav-group-toggle"
              aria-expanded={atlasMenuOpen}
              aria-controls="admin-nav-atlas"
              onClick={() => setAtlasMenuOpen((open) => !open)}
            >
              <span className="admin-nav-index">04</span>
              <span className="admin-nav-text">도감</span>
              <span className="admin-nav-chevron" aria-hidden="true" />
            </button>
            <div
              id="admin-nav-atlas"
              className="admin-nav-group-items"
              hidden={!atlasMenuOpen}
            >
              <button
                type="button"
                className={nav === 'quests' ? 'active' : ''}
                onClick={() => goNav('quests')}
              >
                <span className="admin-nav-row">
                  <span className="admin-nav-text">퀘스트 리스트</span>
                  <span className="ver2-chip">ver.2</span>
                </span>
              </button>
              <button
                type="button"
                className={nav === 'discoveries' ? 'active' : ''}
                onClick={() => goNav('discoveries')}
              >
                <span className="admin-nav-text">발견물 리스트</span>
              </button>
            </div>
          </div>
          <div
            className={`admin-nav-group${
              nav === 'ports' ||
              nav === 'regions' ||
              nav === 'entry-permits' ||
              nav === 'fields' ||
              nav === 'sea-areas'
                ? ' is-active'
                : ''
            }${regionsMenuOpen ? ' is-open' : ''}`}
          >
            <button
              type="button"
              className="admin-nav-group-toggle"
              aria-expanded={regionsMenuOpen}
              aria-controls="admin-nav-regions"
              onClick={() => setRegionsMenuOpen((open) => !open)}
            >
              <span className="admin-nav-index">05</span>
              <span className="admin-nav-text">개척</span>
              <span className="admin-nav-chevron" aria-hidden="true" />
            </button>
            <div
              id="admin-nav-regions"
              className="admin-nav-group-items"
              hidden={!regionsMenuOpen}
            >
              <button
                type="button"
                className={nav === 'ports' ? 'active' : ''}
                onClick={() => goNav('ports')}
              >
                <span className="admin-nav-row">
                  <span className="admin-nav-text">항구(도시) 리스트</span>
                  <span className="ver2-chip">ver.2</span>
                </span>
              </button>
              <button
                type="button"
                className={nav === 'regions' ? 'active' : ''}
                onClick={() => goNav('regions')}
              >
                <span className="admin-nav-row">
                  <span className="admin-nav-text">지역 리스트</span>
                  <span className="ver2-chip">ver.2</span>
                </span>
              </button>
              <button
                type="button"
                className={nav === 'entry-permits' ? 'active' : ''}
                onClick={() => goNav('entry-permits')}
              >
                <span className="admin-nav-row">
                  <span className="admin-nav-text">입항허가 리스트</span>
                  <span className="ver2-chip">ver.2</span>
                </span>
              </button>
              <button
                type="button"
                className={nav === 'fields' ? 'active' : ''}
                onClick={() => goNav('fields')}
              >
                <span className="admin-nav-row">
                  <span className="admin-nav-text">필드 리스트</span>
                  <span className="ver2-chip">ver.2</span>
                </span>
              </button>
              <button
                type="button"
                className={nav === 'sea-areas' ? 'active' : ''}
                onClick={() => goNav('sea-areas')}
              >
                <span className="admin-nav-row">
                  <span className="admin-nav-text">해역 리스트</span>
                  <span className="ver2-chip">ver.2</span>
                </span>
              </button>
            </div>
          </div>
          <div
            className={`admin-nav-group${
              nav === 'consumables' ? ' is-active' : ''
            }${itemsMenuOpen ? ' is-open' : ''}`}
          >
            <button
              type="button"
              className="admin-nav-group-toggle"
              aria-expanded={itemsMenuOpen}
              aria-controls="admin-nav-items"
              onClick={() => setItemsMenuOpen((open) => !open)}
            >
              <span className="admin-nav-index">06</span>
              <span className="admin-nav-text">아이템</span>
              <span className="admin-nav-chevron" aria-hidden="true" />
            </button>
            <div
              id="admin-nav-items"
              className="admin-nav-group-items"
              hidden={!itemsMenuOpen}
            >
              <button
                type="button"
                className={nav === 'consumables' ? 'active' : ''}
                onClick={() => goNav('consumables')}
              >
                <span className="admin-nav-text">소비품 리스트</span>
              </button>
            </div>
          </div>
          <div
            className={`admin-nav-group${
              nav === 'skills' ? ' is-active' : ''
            }${captainMenuOpen ? ' is-open' : ''}`}
          >
            <button
              type="button"
              className="admin-nav-group-toggle"
              aria-expanded={captainMenuOpen}
              aria-controls="admin-nav-captain"
              onClick={() => setCaptainMenuOpen((open) => !open)}
            >
              <span className="admin-nav-index">07</span>
              <span className="admin-nav-text">함장</span>
              <span className="admin-nav-chevron" aria-hidden="true" />
            </button>
            <div
              id="admin-nav-captain"
              className="admin-nav-group-items"
              hidden={!captainMenuOpen}
            >
              <button
                type="button"
                className={nav === 'skills' ? 'active' : ''}
                onClick={() => goNav('skills')}
              >
                <span className="admin-nav-row">
                  <span className="admin-nav-text">스킬 리스트</span>
                  <span className="ver2-chip">ver.2</span>
                </span>
              </button>
            </div>
          </div>
        </nav>

        <div className="admin-sidebar-foot">
          <div className="admin-sidebar-who">
            <span className="admin-sidebar-who-label">접속 중</span>
            <strong>{user.nickname}</strong>
            <span>{user.username}</span>
          </div>
          <div className="admin-sidebar-foot-actions">
            <a href="/">사이트로</a>
            <button type="button" onClick={onLogout}>
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      <div className="admin-workspace">
        {nav === 'dashboard' && (
          <AdminDashboard token={token} onNavigate={goNav} />
        )}

        {nav === 'boards' && boardId && (
          <section className="admin-section admin-section-board">
            <BoardView
              token={token}
              user={user}
              boardId={boardId}
              onToast={onToast}
            />
          </section>
        )}

        {nav === 'users' && (
          <section className="admin-section">
            <div className="admin-page-head">
              <div>
                <h1>회원 리스트</h1>
                <p>
                  역할 변경과 계정 삭제를 처리합니다. 마지막 관리자는 강등·삭제할
                  수 없습니다.
                </p>
              </div>
              <button
                type="button"
                className="admin-btn"
                onClick={() => void loadUsers()}
                disabled={loadingUsers}
              >
                새로고침
              </button>
            </div>

            {usersError && (
              <p className="form-note error" role="alert">
                {usersError}
              </p>
            )}

            <label className="field catalog-search">
              <input
                type="search"
                value={userQuery}
                onChange={(e) => {
                  setUserQuery(e.target.value)
                  setUserPage(0)
                }}
                placeholder="아이디·닉네임·역할로 검색"
                aria-label="회원 검색"
                autoComplete="off"
                disabled={loadingUsers}
              />
            </label>

            {loadingUsers ? (
              <p className="form-note">불러오는 중…</p>
            ) : (
              <>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <SortableTh
                          label="아이디"
                          sortKey="username"
                          activeKey={usersSort.sortKey}
                          dir={usersSort.sortDir}
                          onSort={(key) => {
                            usersSort.toggleSort(key)
                            setUserPage(0)
                          }}
                        />
                        <SortableTh
                          className="col-desk"
                          label="닉네임"
                          sortKey="nickname"
                          activeKey={usersSort.sortKey}
                          dir={usersSort.sortDir}
                          onSort={(key) => {
                            usersSort.toggleSort(key)
                            setUserPage(0)
                          }}
                        />
                        <SortableTh
                          className="col-desk"
                          label="역할"
                          sortKey="role"
                          activeKey={usersSort.sortKey}
                          dir={usersSort.sortDir}
                          onSort={(key) => {
                            usersSort.toggleSort(key)
                            setUserPage(0)
                          }}
                        />
                        <SortableTh
                          className="col-desk"
                          label="레벨"
                          sortKey="level"
                          activeKey={usersSort.sortKey}
                          dir={usersSort.sortDir}
                          onSort={(key) => {
                            usersSort.toggleSort(key)
                            setUserPage(0)
                          }}
                        />
                        <SortableTh
                          className="col-desk"
                          label="최근 로그인"
                          sortKey="lastLoginAt"
                          activeKey={usersSort.sortKey}
                          dir={usersSort.sortDir}
                          onSort={(key) => {
                            usersSort.toggleSort(key)
                            setUserPage(0)
                          }}
                        />
                        <th className="col-desk">삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userPageItems.map((row) => {
                        const isSelf = row.id === user.id
                        const isLastAdmin =
                          row.role === 'admin' && adminCount <= 1
                        const busy = busyId === row.id
                        const deleting = deletingKey === `user:${row.id}`
                        const roleLocked = busy || isLastAdmin
                        const deleteLocked =
                          deleting || isSelf || isLastAdmin
                        const lockHint = isLastAdmin
                          ? '마지막 관리자는 역할을 변경할 수 없습니다.'
                          : isSelf
                            ? '자신의 계정은 삭제할 수 없습니다.'
                            : undefined
                        return (
                          <tr key={row.id}>
                            <td>{row.username}</td>
                            <td className="col-desk">{row.nickname}</td>
                            <td className="col-desk">
                              <select
                                value={row.role}
                                disabled={roleLocked}
                                title={
                                  roleLocked && isLastAdmin
                                    ? lockHint
                                    : undefined
                                }
                                onChange={(e) =>
                                  void handleRoleChange(
                                    row,
                                    e.target.value === 'admin'
                                      ? 'admin'
                                      : 'member',
                                  )
                                }
                              >
                                <option value="member">member</option>
                                <option value="admin">admin</option>
                              </select>
                            </td>
                            <td className="col-desk">Lv.{row.level}</td>
                            <td className="col-desk">
                              {formatDate(row.lastLoginAt)}
                            </td>
                            <td className="col-desk">
                              <button
                                type="button"
                                className="admin-danger-btn"
                                disabled={deleteLocked}
                                title={deleteLocked ? lockHint : undefined}
                                onClick={() => void handleDeleteUser(row)}
                              >
                                삭제
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                      {sortedUsers.length === 0 && (
                        <tr>
                          <td colSpan={6}>
                            {users.length === 0
                              ? '등록된 회원이 없습니다.'
                              : '검색 결과가 없습니다.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {sortedUsers.length > 0 && (
                  <div className="catalog-pager" aria-label="회원 목록 페이지">
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={userSafePage <= 0}
                      onClick={() => setUserPage((p) => Math.max(0, p - 1))}
                    >
                      이전
                    </button>
                    <span>
                      {userSafePage + 1} / {userTotalPages}
                      <em>
                        · {sortedUsers.length}개
                        {userQuery.trim() ? ` (전체 ${users.length})` : ''}
                      </em>
                    </span>
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={userSafePage >= userTotalPages - 1}
                      onClick={() =>
                        setUserPage((p) =>
                          Math.min(userTotalPages - 1, p + 1),
                        )
                      }
                    >
                      다음
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {nav === 'ships' && (
          <section className="admin-section">
            <div className="admin-page-head">
              <div>
                <h1>선박 리스트</h1>
                <p>
                  위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.
                </p>
              </div>
              <div className="admin-page-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => void loadShips()}
                  disabled={loadingShips}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    setShowImport((v) => !v)
                    setImportNote('')
                  }}
                >
                  {showImport ? '닫기' : '선박 추가'}
                </button>
              </div>
            </div>

            {showImport && (
              <form
                className="admin-import-form"
                onSubmit={handleImport}
              >
                <label className="field">
                  <span>선박 텍스트</span>
                  <textarea
                    rows={12}
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="위키 등에서 복사한 선박 정보를 붙여넣으세요."
                    disabled={importing}
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={importing}
                  >
                    {importing ? '등록 중…' : '등록'}
                  </button>
                </div>
              </form>
            )}

            {importNote && (
              <p
                className={`form-note${
                  /실패|못|오류|에러|중복/.test(importNote) ? ' error' : ''
                }`}
              >
                {importNote}
              </p>
            )}

            {shipsError && (
              <p className="form-note error" role="alert">
                {shipsError}
              </p>
            )}

            {loadingShips ? (
              <p className="form-note">불러오는 중…</p>
            ) : (
              <ShipList
                ships={ships}
                newestFirst
                onOpen={(ship) => setDetailShip(ship)}
                onDelete={(ship) => void handleDeleteShip(ship)}
                deletingId={
                  deletingKey?.startsWith('ship:')
                    ? Number(deletingKey.slice(5))
                    : null
                }
              />
            )}
          </section>
        )}

        {nav === 'quests' && (
          <section className="admin-section quest-catalog">
            <div className="admin-page-head">
              <div>
                <h1>퀘스트 리스트</h1>
                <p>
                  위키 텍스트로 추가·갱신합니다. 같은 이름이면 공략·진행 포함 전체를
                  덮어씁니다.
                </p>
              </div>
              <div className="admin-page-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => void loadQuests()}
                  disabled={loadingQuests}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    setShowQuestImport((v) => !v)
                    setQuestImportNote('')
                  }}
                >
                  {showQuestImport ? '닫기' : '퀘스트 추가'}
                </button>
              </div>
            </div>

            {showQuestImport && (
              <form className="admin-import-form" onSubmit={handleQuestImport}>
                <label className="field">
                  <span>퀘스트 텍스트 (분류~진행 전체)</span>
                  <textarea
                    className="quest-import-textarea"
                    rows={22}
                    value={questImportText}
                    onChange={(e) => setQuestImportText(e.target.value)}
                    placeholder={`퀘스트이름\n소개 문단\n\n분류\t[모험] 일반\t난이도\t\n…\n공략\t1. …\n진행\t1. …\n결론 - …`}
                    disabled={importingQuest}
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={importingQuest}
                  >
                    {importingQuest ? '저장 중…' : '저장'}
                  </button>
                </div>
              </form>
            )}

            {questImportNote && (
              <p
                className={`form-note${
                  /실패|못|오류|에러|중복/.test(questImportNote) ? ' error' : ''
                }`}
              >
                {questImportNote}
              </p>
            )}

            {questsError && (
              <p className="form-note error" role="alert">
                {questsError}
              </p>
            )}

            <label className="field catalog-search">
              <input
                type="search"
                value={questQuery}
                onChange={(e) => setQuestQuery(e.target.value)}
                placeholder="이름·장소·발견물로 검색"
                aria-label="퀘스트 검색"
                autoComplete="off"
              />
            </label>

            {loadingQuests && quests.length === 0 ? (
              <p className="form-note">불러오는 중…</p>
            ) : (
              <>
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <SortableTh
                        label="이름"
                        sortKey="name"
                        activeKey={questsSort.sortKey}
                        dir={questsSort.sortDir}
                        onSort={(key) => {
                          questsSort.toggleSort(key)
                          setQuestPage(0)
                        }}
                      />
                      <SortableTh
                        className="col-desk"
                        label="분류"
                        sortKey="category"
                        activeKey={questsSort.sortKey}
                        dir={questsSort.sortDir}
                        onSort={(key) => {
                          questsSort.toggleSort(key)
                          setQuestPage(0)
                        }}
                      />
                      <SortableTh
                        className="col-desk col-diff"
                        label="난이도"
                        sortKey="difficulty"
                        activeKey={questsSort.sortKey}
                        dir={questsSort.sortDir}
                        onSort={(key) => {
                          questsSort.toggleSort(key)
                          setQuestPage(0)
                        }}
                      />
                      <SortableTh
                        className="col-desk"
                        label="의뢰 장소"
                        sortKey="requestPlaces"
                        activeKey={questsSort.sortKey}
                        dir={questsSort.sortDir}
                        onSort={(key) => {
                          questsSort.toggleSort(key)
                          setQuestPage(0)
                        }}
                      />
                      <SortableTh
                        className="col-desk"
                        label="목적지"
                        sortKey="destination"
                        activeKey={questsSort.sortKey}
                        dir={questsSort.sortDir}
                        onSort={(key) => {
                          questsSort.toggleSort(key)
                          setQuestPage(0)
                        }}
                      />
                      <SortableTh
                        className="col-desk"
                        label="발견물"
                        sortKey="discovery"
                        activeKey={questsSort.sortKey}
                        dir={questsSort.sortDir}
                        onSort={(key) => {
                          questsSort.toggleSort(key)
                          setQuestPage(0)
                        }}
                      />
                      <th className="col-desk col-action">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quests.map((quest, index) => (
                      <tr
                        key={quest.id}
                        className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                        tabIndex={0}
                        onClick={() => setDetailQuest(quest)}
                        onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setDetailQuest(quest)
                          }
                        }}
                      >
                        <td>{quest.name}</td>
                        <td className="col-desk">
                          {quest.category
                            ? `[${quest.category}] ${quest.questType || ''}`.trim()
                            : '-'}
                        </td>
                        <td
                          className="admin-cell-control col-desk col-diff"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <select
                            className="quest-diff-select"
                            value={quest.difficulty ?? ''}
                            disabled={busyQuestId === quest.id}
                            aria-label={`${quest.name} 난이도`}
                            onChange={(e) =>
                              void handleDifficultyChange(quest, e.target.value)
                            }
                          >
                            <option value="">-</option>
                            {Array.from({ length: 11 }, (_, n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="col-desk">{quest.requestPlaces || '-'}</td>
                        <td className="col-desk">{quest.destination || '-'}</td>
                        <td className="col-desk">
                          <QuestDiscoveryLabel quest={quest} />
                        </td>
                        <td
                          className="admin-cell-control col-desk col-action"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="admin-danger-btn"
                            disabled={deletingKey === `quest:${quest.id}`}
                            onClick={() => void handleDeleteQuest(quest)}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                    {quests.length === 0 && (
                      <tr>
                        <td colSpan={7}>
                          {questQueryDebounced
                            ? '검색 결과가 없습니다.'
                            : '등록된 퀘스트가 없습니다.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {questTotal > 0 && (
                <div className="catalog-pager" aria-label="퀘스트 목록 페이지">
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={questSafePage <= 0 || loadingQuests}
                    onClick={() => setQuestPage((p) => Math.max(0, p - 1))}
                  >
                    이전
                  </button>
                  <span>
                    {questSafePage + 1} / {questTotalPages}
                    <em>· {questTotal}개</em>
                  </span>
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={
                      questSafePage >= questTotalPages - 1 || loadingQuests
                    }
                    onClick={() =>
                      setQuestPage((p) =>
                        Math.min(questTotalPages - 1, p + 1),
                      )
                    }
                  >
                    다음
                  </button>
                </div>
              )}
              </>
            )}
          </section>
        )}

        {nav === 'regions' && (
          <section className="admin-section">
            <div className="admin-page-head">
              <div>
                <h1>지역 리스트</h1>
                <p>
                  위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.
                </p>
              </div>
              <div className="admin-page-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => void loadRegions()}
                  disabled={loadingRegions}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    setShowRegionImport((v) => !v)
                    setRegionImportNote('')
                  }}
                >
                  {showRegionImport ? '닫기' : '지역 추가'}
                </button>
              </div>
            </div>

            {showRegionImport && (
              <form className="admin-import-form" onSubmit={handleRegionImport}>
                <label className="field">
                  <span>지역 텍스트</span>
                  <textarea
                    className="quest-import-textarea"
                    rows={14}
                    value={regionImportText}
                    onChange={(e) => setRegionImportText(e.target.value)}
                    placeholder={`지역아프리카 동부-인도\n해역\n해역 그룹\t해역\n홍해\t메소포타미아 유역, 아라비아 해, …\n인도양\t남동인도양, 남인도양, …`}
                    disabled={importingRegion}
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={importingRegion}
                  >
                    {importingRegion ? '저장 중…' : '저장'}
                  </button>
                </div>
              </form>
            )}

            {regionImportNote && (
              <p
                className={`form-note${
                  /실패|못|오류|에러|중복/.test(regionImportNote)
                    ? ' error'
                    : ''
                }`}
              >
                {regionImportNote}
              </p>
            )}

            {regionsError && (
              <p className="form-note error" role="alert">
                {regionsError}
              </p>
            )}

            <label className="field catalog-search">
              <input
                type="search"
                value={regionQuery}
                onChange={(e) => setRegionQuery(e.target.value)}
                placeholder="이름·해역으로 검색"
                aria-label="지역 검색"
                autoComplete="off"
                disabled={loadingRegions}
              />
            </label>

            {loadingRegions ? (
              <p className="form-note">불러오는 중…</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <SortableTh
                        label="이름"
                        sortKey="name"
                        activeKey={regionsSort.sortKey}
                        dir={regionsSort.sortDir}
                        onSort={regionsSort.toggleSort}
                      />
                      <SortableTh
                        className="col-desk"
                        label="추가 이름"
                        sortKey="altName"
                        activeKey={regionsSort.sortKey}
                        dir={regionsSort.sortDir}
                        onSort={regionsSort.toggleSort}
                      />
                      <th className="col-desk">해역 그룹</th>
                      <th className="col-desk">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRegions.map((region, index) => (
                      <tr
                        key={region.id}
                        className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                        tabIndex={0}
                        onClick={() => setDetailRegion(region)}
                        onKeyDown={(
                          event: KeyboardEvent<HTMLTableRowElement>,
                        ) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setDetailRegion(region)
                          }
                        }}
                      >
                        <td>{region.name}</td>
                        <td className="col-desk">{region.altName || '-'}</td>
                        <td className="col-desk">
                          {(region.seaGroups || [])
                            .map((g) => g.group)
                            .join(', ') || '-'}
                        </td>
                        <td
                          className="admin-cell-control col-desk"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="admin-danger-btn"
                            disabled={deletingKey === `region:${region.id}`}
                            onClick={() => void handleDeleteRegion(region)}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sortedRegions.length === 0 && (
                      <tr>
                        <td colSpan={4}>
                          {regions.length === 0
                            ? '등록된 지역이 없습니다.'
                            : '검색 결과가 없습니다.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {nav === 'entry-permits' && (
          <section className="admin-section">
            <div className="admin-page-head">
              <div>
                <h1>입항허가 리스트</h1>
                <p>
                  위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.
                </p>
              </div>
              <div className="admin-page-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => void loadEntryPermits()}
                  disabled={loadingEntryPermits}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    setShowEntryPermitImport((v) => !v)
                    setEntryPermitImportNote('')
                  }}
                >
                  {showEntryPermitImport ? '닫기' : '입항허가 추가'}
                </button>
              </div>
            </div>

            {showEntryPermitImport && (
              <form
                className="admin-import-form"
                onSubmit={handleEntryPermitImport}
              >
                <label className="field">
                  <span>입항허가 텍스트</span>
                  <textarea
                    className="quest-import-textarea"
                    rows={16}
                    value={entryPermitImportText}
                    onChange={(e) => setEntryPermitImportText(e.target.value)}
                    placeholder={`입항허가동남아시아\n퀘스트 (택일)\n캘리컷\n종류\t난이도\t퀘스트\n모험\t4\t미지의 매력\n…`}
                    disabled={importingEntryPermit}
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={importingEntryPermit}
                  >
                    {importingEntryPermit ? '저장 중…' : '저장'}
                  </button>
                </div>
              </form>
            )}

            {entryPermitImportNote && (
              <p
                className={`form-note${
                  /실패|못|오류|에러|중복/.test(entryPermitImportNote)
                    ? ' error'
                    : ''
                }`}
              >
                {entryPermitImportNote}
              </p>
            )}

            {entryPermitsError && (
              <p className="form-note error" role="alert">
                {entryPermitsError}
              </p>
            )}

            <label className="field catalog-search">
              <input
                type="search"
                value={entryPermitQuery}
                onChange={(e) => setEntryPermitQuery(e.target.value)}
                placeholder="이름·도시·퀘스트로 검색"
                aria-label="입항허가 검색"
                autoComplete="off"
                disabled={loadingEntryPermits}
              />
            </label>

            {loadingEntryPermits ? (
              <p className="form-note">불러오는 중…</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <SortableTh
                        label="이름"
                        sortKey="name"
                        activeKey={entryPermitsSort.sortKey}
                        dir={entryPermitsSort.sortDir}
                        onSort={entryPermitsSort.toggleSort}
                      />
                      <SortableTh
                        className="col-desk"
                        label="추가 이름"
                        sortKey="altName"
                        activeKey={entryPermitsSort.sortKey}
                        dir={entryPermitsSort.sortDir}
                        onSort={entryPermitsSort.toggleSort}
                      />
                      <th className="col-desk">도시</th>
                      <th className="col-desk">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntryPermits.map((permit, index) => (
                      <tr
                        key={permit.id}
                        className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                        tabIndex={0}
                        onClick={() => setDetailEntryPermit(permit)}
                        onKeyDown={(
                          event: KeyboardEvent<HTMLTableRowElement>,
                        ) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setDetailEntryPermit(permit)
                          }
                        }}
                      >
                        <td>{permit.name}</td>
                        <td className="col-desk">{permit.altName || '-'}</td>
                        <td className="col-desk">
                          {(permit.cityQuests || [])
                            .map((c) => c.city)
                            .join(', ') || '-'}
                        </td>
                        <td
                          className="admin-cell-control col-desk"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="admin-danger-btn"
                            disabled={
                              deletingKey === `entry-permit:${permit.id}`
                            }
                            onClick={() => void handleDeleteEntryPermit(permit)}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sortedEntryPermits.length === 0 && (
                      <tr>
                        <td colSpan={4}>
                          {entryPermits.length === 0
                            ? '등록된 입항허가가 없습니다.'
                            : '검색 결과가 없습니다.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {nav === 'ports' && (
          <section className="admin-section">
            <div className="admin-page-head">
              <div>
                <h1>항구(도시) 리스트</h1>
                <p>
                  위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.
                </p>
              </div>
              <div className="admin-page-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => void loadPorts()}
                  disabled={loadingPorts}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    setShowPortImport((v) => !v)
                    setPortImportNote('')
                  }}
                >
                  {showPortImport ? '닫기' : '항구 추가'}
                </button>
              </div>
            </div>

            {showPortImport && (
              <form className="admin-import-form" onSubmit={handlePortImport}>
                <label className="field">
                  <span>항구(도시) 텍스트</span>
                  <textarea
                    className="quest-import-textarea"
                    rows={16}
                    value={portImportText}
                    onChange={(e) => setPortImportText(e.target.value)}
                    placeholder={`도시리스본\n분류\t포르투갈본거지\t지역\t유럽 서부\n해역\t리스본 앞바다\t좌표\t15784, 3205\n입항허가\t북대서양\t문화\t이베리아\n언어\t포르투갈어\n보상\n종류\t금액\t보상\n투자\t1,000,000두캇\t…\n수집 아이템\n낚시\n랭크\t종류\t아이템\n1\t교역품\t고등어(교환), …`}
                    disabled={importingPort}
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={importingPort}
                  >
                    {importingPort ? '저장 중…' : '저장'}
                  </button>
                </div>
              </form>
            )}

            {portImportNote && (
              <p
                className={`form-note${
                  /실패|못|오류|에러|중복/.test(portImportNote) ? ' error' : ''
                }`}
              >
                {portImportNote}
              </p>
            )}

            {portsError && (
              <p className="form-note error" role="alert">
                {portsError}
              </p>
            )}

            <label className="field catalog-search">
              <input
                type="search"
                value={portQuery}
                onChange={(e) => setPortQuery(e.target.value)}
                placeholder="이름·지역·해역·언어로 검색"
                aria-label="항구 검색"
                autoComplete="off"
                disabled={loadingPorts}
              />
            </label>

            {loadingPorts ? (
              <p className="form-note">불러오는 중…</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <SortableTh
                        label="이름"
                        sortKey="name"
                        activeKey={portsSort.sortKey}
                        dir={portsSort.sortDir}
                        onSort={portsSort.toggleSort}
                      />
                      <SortableTh
                        className="col-desk"
                        label="분류"
                        sortKey="category"
                        activeKey={portsSort.sortKey}
                        dir={portsSort.sortDir}
                        onSort={portsSort.toggleSort}
                      />
                      <SortableTh
                        className="col-desk"
                        label="지역"
                        sortKey="region"
                        activeKey={portsSort.sortKey}
                        dir={portsSort.sortDir}
                        onSort={portsSort.toggleSort}
                      />
                      <SortableTh
                        className="col-desk"
                        label="해역"
                        sortKey="seaArea"
                        activeKey={portsSort.sortKey}
                        dir={portsSort.sortDir}
                        onSort={portsSort.toggleSort}
                      />
                      <SortableTh
                        className="col-desk"
                        label="입항허가"
                        sortKey="entryPermit"
                        activeKey={portsSort.sortKey}
                        dir={portsSort.sortDir}
                        onSort={portsSort.toggleSort}
                      />
                      <SortableTh
                        className="col-desk"
                        label="언어"
                        sortKey="language"
                        activeKey={portsSort.sortKey}
                        dir={portsSort.sortDir}
                        onSort={portsSort.toggleSort}
                      />
                      <th className="col-desk">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPorts.map((port, index) => (
                      <tr
                        key={port.id}
                        className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                        tabIndex={0}
                        onClick={() => setDetailPort(port)}
                        onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setDetailPort(port)
                          }
                        }}
                      >
                        <td>{port.name}</td>
                        <td className="col-desk">{port.category || '-'}</td>
                        <td className="col-desk">{port.region || '-'}</td>
                        <td className="col-desk">{port.seaArea || '-'}</td>
                        <td className="col-desk">{port.entryPermit || '-'}</td>
                        <td className="col-desk">{port.language || '-'}</td>
                        <td
                          className="admin-cell-control col-desk"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="admin-danger-btn"
                            disabled={deletingKey === `port:${port.id}`}
                            onClick={() => void handleDeletePort(port)}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sortedPorts.length === 0 && (
                      <tr>
                        <td colSpan={7}>
                          {ports.length === 0
                            ? '등록된 항구(도시)가 없습니다.'
                            : '검색 결과가 없습니다.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {nav === 'discoveries' && (
          <section className="admin-section">
            <div className="admin-page-head">
              <div>
                <h1>발견물 리스트</h1>
                <p>
                  위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.
                </p>
              </div>
              <div className="admin-page-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => void loadDiscoveries()}
                  disabled={loadingDiscoveries}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    setShowDiscoveryImport((v) => !v)
                    setDiscoveryImportNote('')
                  }}
                >
                  {showDiscoveryImport ? '닫기' : '발견물 추가'}
                </button>
              </div>
            </div>

            {showDiscoveryImport && (
              <form
                className="admin-import-form"
                onSubmit={handleDiscoveryImport}
              >
                <label className="field">
                  <span>발견물 텍스트</span>
                  <textarea
                    className="quest-import-textarea"
                    rows={16}
                    value={discoveryImportText}
                    onChange={(e) => setDiscoveryImportText(e.target.value)}
                    placeholder={`발견물 | 비단뱀\n대형 뱀으로 특히 큰 것은 10m나 된다. …\n분류\t생물 » 대형생물\n난이도\t5\n카드 포인트\t6\n발견 경험치\t1,118\n카드 획득 경험치\t559\n보고시 명성\t559\n발견 방법\t[퀘스트] 모험 | 악어냐 물고기냐 (7 생태 조사 8, 생물학 10, 프랑스어 1) - 마르세이유`}
                    disabled={importingDiscovery}
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={importingDiscovery}
                  >
                    {importingDiscovery ? '저장 중…' : '저장'}
                  </button>
                </div>
              </form>
            )}

            {discoveryImportNote && (
              <p
                className={`form-note${
                  /실패|못|오류|에러|중복/.test(discoveryImportNote)
                    ? ' error'
                    : ''
                }`}
              >
                {discoveryImportNote}
              </p>
            )}

            {discoveriesError && (
              <p className="form-note error" role="alert">
                {discoveriesError}
              </p>
            )}

            {loadingDiscoveries ? (
              <p className="form-note">불러오는 중…</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <SortableTh
                        label="이름"
                        sortKey="name"
                        activeKey={discoveriesSort.sortKey}
                        dir={discoveriesSort.sortDir}
                        onSort={discoveriesSort.toggleSort}
                      />
                      <SortableTh
                        className="col-desk"
                        label="분류"
                        sortKey="category"
                        activeKey={discoveriesSort.sortKey}
                        dir={discoveriesSort.sortDir}
                        onSort={discoveriesSort.toggleSort}
                      />
                      <SortableTh
                        className="col-desk"
                        label="난이도"
                        sortKey="rank"
                        activeKey={discoveriesSort.sortKey}
                        dir={discoveriesSort.sortDir}
                        onSort={discoveriesSort.toggleSort}
                      />
                      <SortableTh
                        className="col-desk"
                        label="카드P"
                        sortKey="cardPoints"
                        activeKey={discoveriesSort.sortKey}
                        dir={discoveriesSort.sortDir}
                        onSort={discoveriesSort.toggleSort}
                      />
                      <SortableTh
                        className="col-desk"
                        label="발견 방법"
                        sortKey="acquire"
                        activeKey={discoveriesSort.sortKey}
                        dir={discoveriesSort.sortDir}
                        onSort={discoveriesSort.toggleSort}
                      />
                      <th className="col-desk">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedDiscoveries.map((discovery, index) => (
                      <tr
                        key={discovery.id}
                        className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                        tabIndex={0}
                        onClick={() => setDetailDiscovery(discovery)}
                        onKeyDown={(
                          event: KeyboardEvent<HTMLTableRowElement>,
                        ) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            setDetailDiscovery(discovery)
                          }
                        }}
                      >
                        <td>{discovery.name}</td>
                        <td className="col-desk">{discovery.category || '-'}</td>
                        <td
                          className="admin-cell-control col-desk col-diff"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <select
                            className="quest-diff-select"
                            value={discovery.rank ?? ''}
                            disabled={busyDiscoveryId === discovery.id}
                            aria-label={`${discovery.name} 난이도`}
                            onChange={(e) =>
                              void handleDiscoveryRankChange(
                                discovery,
                                e.target.value,
                              )
                            }
                          >
                            <option value="">-</option>
                            {Array.from({ length: 11 }, (_, n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="col-desk">
                          {discovery.cardPoints != null
                            ? discovery.cardPoints
                            : '-'}
                        </td>
                        <td
                          className="col-desk"
                          onClick={(event) => {
                            if (discovery.acquireQuest) event.stopPropagation()
                          }}
                        >
                          {discovery.acquireQuest ? (
                            <button
                              type="button"
                              className="discovery-quest-link"
                              onClick={(event) => {
                                event.stopPropagation()
                                void openQuestByRef(discovery.acquireQuest!)
                              }}
                            >
                              {formatDiscoveryAcquire(discovery) || '-'}
                            </button>
                          ) : (
                            formatDiscoveryAcquire(discovery) || '-'
                          )}
                        </td>
                        <td
                          className="admin-cell-control col-desk"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="admin-danger-btn"
                            disabled={
                              deletingKey === `discovery:${discovery.id}`
                            }
                            onClick={() => void handleDeleteDiscovery(discovery)}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                    {sortedDiscoveries.length === 0 && (
                      <tr>
                        <td colSpan={6}>등록된 발견물이 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {nav === 'skills' && (
          <section className="admin-section">
            <div className="admin-page-head">
              <div>
                <h1>스킬 리스트</h1>
                <p>
                  위키 스킬 텍스트로 추가·갱신합니다. 분류(언어 등)는 텍스트의 분류 칸을
                  따릅니다. 같은 이름이면 내용을 덮어씁니다.
                </p>
              </div>
              <div className="admin-page-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => void loadSkills()}
                  disabled={loadingSkills}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    setShowSkillImport((v) => !v)
                    setSkillImportNote('')
                  }}
                >
                  {showSkillImport ? '닫기' : '스킬 추가'}
                </button>
              </div>
            </div>

            {showSkillImport && (
              <form
                className="admin-import-form"
                onSubmit={handleSkillImport}
              >
                <label className="field">
                  <span>스킬 텍스트</span>
                  <textarea
                    className="quest-import-textarea"
                    rows={14}
                    value={skillImportText}
                    onChange={(e) => setSkillImportText(e.target.value)}
                    placeholder={`스킬생태 조사\n동식물의 생태를 연구하고 발견한다.\n\n분류\t모험\t부관담당\t감시\n행동력\t5\t범위\t자신\n습득 비용\t3,000두캇\t연성 효과\t발견 시 피로 회복\n우대 직업\t궁정 정원사*, 레인저, 바이킹, 브리더, 사냥꾼*, 생물학자\n습득 조건\n종류\t내용\n레벨\t모험 Lv3\n스킬 습득\n지역\t도시\t도시 인물\n유럽 북부\t런던\t모험가 조합 마스터`}
                    disabled={importingSkill}
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={importingSkill}
                  >
                    {importingSkill ? '저장 중…' : '저장'}
                  </button>
                </div>
              </form>
            )}

            {skillImportNote && (
              <p
                className={`form-note${
                  /실패|못|오류|에러|중복/.test(skillImportNote)
                    ? ' error'
                    : ''
                }`}
              >
                {skillImportNote}
              </p>
            )}

            {skillsError && (
              <p className="form-note error" role="alert">
                {skillsError}
              </p>
            )}

            {loadingSkills ? (
              <p className="form-note">불러오는 중…</p>
            ) : (
              <>
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <SortableTh
                          label="이름"
                          sortKey="name"
                          activeKey={skillsSort.sortKey}
                          dir={skillsSort.sortDir}
                          onSort={(key) => {
                            skillsSort.toggleSort(key)
                            setSkillPage(0)
                          }}
                        />
                        <SortableTh
                          className="col-desk"
                          label="분류"
                          sortKey="category"
                          activeKey={skillsSort.sortKey}
                          dir={skillsSort.sortDir}
                          onSort={(key) => {
                            skillsSort.toggleSort(key)
                            setSkillPage(0)
                          }}
                        />
                        <SortableTh
                          className="col-desk"
                          label="범위"
                          sortKey="rangeScope"
                          activeKey={skillsSort.sortKey}
                          dir={skillsSort.sortDir}
                          onSort={(key) => {
                            skillsSort.toggleSort(key)
                            setSkillPage(0)
                          }}
                        />
                        <SortableTh
                          className="col-desk"
                          label="습득 비용"
                          sortKey="learnCost"
                          activeKey={skillsSort.sortKey}
                          dir={skillsSort.sortDir}
                          onSort={(key) => {
                            skillsSort.toggleSort(key)
                            setSkillPage(0)
                          }}
                        />
                        <SortableTh
                          className="col-desk"
                          label="사용 도시"
                          sortKey="useCities"
                          activeKey={skillsSort.sortKey}
                          dir={skillsSort.sortDir}
                          onSort={(key) => {
                            skillsSort.toggleSort(key)
                            setSkillPage(0)
                          }}
                        />
                        <th className="col-desk">삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skillPageItems.map((skill, index) => (
                        <tr
                          key={skill.id}
                          className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                          tabIndex={0}
                          onClick={() => setDetailSkill(skill)}
                          onKeyDown={(
                            event: KeyboardEvent<HTMLTableRowElement>,
                          ) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setDetailSkill(skill)
                            }
                          }}
                        >
                          <td>{skill.name}</td>
                          <td className="col-desk">
                            {skill.category || '언어'}
                          </td>
                          <td className="col-desk">{skill.rangeScope || '-'}</td>
                          <td className="col-desk">
                            {skill.learnCost != null
                              ? `${skill.learnCost.toLocaleString('ko-KR')}두캇`
                              : '-'}
                          </td>
                          <td className="admin-table-wrap-cell col-desk">
                            {skill.useCities?.length
                              ? skill.useCities.map((c) => c.city).join(', ')
                              : '-'}
                          </td>
                          <td
                            className="admin-cell-control col-desk"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="admin-danger-btn"
                              disabled={
                                deletingKey === `skill:${skill.id}`
                              }
                              onClick={() => void handleDeleteSkill(skill)}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                      {sortedSkills.length === 0 && (
                        <tr>
                          <td colSpan={6}>등록된 스킬이 없습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {sortedSkills.length > 0 && (
                  <div className="catalog-pager" aria-label="스킬 목록 페이지">
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={skillSafePage <= 0}
                      onClick={() =>
                        setSkillPage((p) => Math.max(0, p - 1))
                      }
                    >
                      이전
                    </button>
                    <span>
                      {skillSafePage + 1} / {skillTotalPages}
                      <em>· {sortedSkills.length}개</em>
                    </span>
                    <button
                      type="button"
                      className="admin-btn"
                      disabled={skillSafePage >= skillTotalPages - 1}
                      onClick={() =>
                        setSkillPage((p) =>
                          Math.min(skillTotalPages - 1, p + 1),
                        )
                      }
                    >
                      다음
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {nav === 'sea-areas' && (
          <section className="admin-section">
            <div className="admin-page-head">
              <div>
                <h1>해역 리스트</h1>
                <p>
                  위키 텍스트로 추가·갱신합니다. 같은 이름이면 기본 정보·장소·수집·목적지·해상
                  NPC를 덮어씁니다.
                </p>
              </div>
              <div className="admin-page-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => void loadSeaAreas()}
                  disabled={loadingSeaAreas}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    setShowSeaAreaImport((v) => !v)
                    setSeaAreaImportNote('')
                  }}
                >
                  {showSeaAreaImport ? '닫기' : '해역 추가'}
                </button>
              </div>
            </div>

            {showSeaAreaImport && (
              <form
                className="admin-import-form"
                onSubmit={handleSeaAreaImport}
              >
                <label className="field">
                  <span>해역 텍스트</span>
                  <textarea
                    className="quest-import-textarea"
                    rows={20}
                    value={seaAreaImportText}
                    onChange={(e) => setSeaAreaImportText(e.target.value)}
                    placeholder={`해역 | 동 캐롤라인 해저분지\n분류\t남태평양\t지역\t동남아시아\n경계\t북 : 4096, 서 : 6400, 남 : 5120, 동 : 7168\t파도\t12\n조류\t16\t최대 속도 증가\t50%\n해역 내 장소\n종류\t내용\n도시\t괌\n상륙지\t뉴기니 섬 남해안\n수집 아이템\n낚시\n랭크\t종류\t아이템\n1\t교역품\t정어리\n목적지\n보물지도\n발견물\t내용\n[지리] 1 비스마크 제도\t다 쓰여지지 않은 지도 …\n해상 NPC\n함대 수\t특징\t해상 NPC\n2\t기습\t표류선습격단`}
                    disabled={importingSeaArea}
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={importingSeaArea}
                  >
                    {importingSeaArea ? '저장 중…' : '저장'}
                  </button>
                </div>
              </form>
            )}

            {seaAreaImportNote && (
              <p
                className={`form-note${
                  /실패|못|오류|에러|중복/.test(seaAreaImportNote)
                    ? ' error'
                    : ''
                }`}
              >
                {seaAreaImportNote}
              </p>
            )}

            {seaAreasError && (
              <p className="form-note error" role="alert">
                {seaAreasError}
              </p>
            )}

            <label className="field catalog-search">
              <input
                type="search"
                value={seaAreaQuery}
                onChange={(e) => setSeaAreaQuery(e.target.value)}
                placeholder="이름·분류·지역으로 검색"
                aria-label="해역 검색"
                autoComplete="off"
                disabled={loadingSeaAreas}
              />
            </label>

            {loadingSeaAreas && seaAreas.length === 0 ? (
              <p className="form-note">불러오는 중…</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th className="col-desk">분류</th>
                      <th className="col-desk">지역</th>
                      <th className="col-desk">파도</th>
                      <th className="col-desk">조류</th>
                      <th className="col-desk col-action">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seaAreas
                      .filter((item) => {
                        const q = seaAreaQuery.trim().toLowerCase()
                        if (!q) return true
                        const hay = [
                          item.name,
                          item.category,
                          item.region,
                          item.wave,
                          item.current,
                        ]
                          .filter((v) => v != null && v !== '')
                          .join(' ')
                          .toLowerCase()
                        return hay.includes(q)
                      })
                      .slice()
                      .sort(compareIdDesc)
                      .map((item, index) => (
                        <tr
                          key={item.id}
                          className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                          tabIndex={0}
                          onClick={() => setDetailSeaArea(item)}
                          onKeyDown={(
                            event: KeyboardEvent<HTMLTableRowElement>,
                          ) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setDetailSeaArea(item)
                            }
                          }}
                        >
                          <td>{item.name}</td>
                          <td className="col-desk">{item.category || '-'}</td>
                          <td className="col-desk">{item.region || '-'}</td>
                          <td className="col-desk">{item.wave ?? '-'}</td>
                          <td className="col-desk">{item.current ?? '-'}</td>
                          <td
                            className="admin-cell-control col-desk col-action"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="admin-danger-btn"
                              disabled={deletingKey === `sea-area:${item.id}`}
                              onClick={() => void handleDeleteSeaArea(item)}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    {seaAreas.length === 0 && (
                      <tr>
                        <td colSpan={6}>등록된 해역이 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {nav === 'fields' && (
          <section className="admin-section">
            <div className="admin-page-head">
              <div>
                <h1>필드 리스트</h1>
                <p>
                  위키 텍스트로 추가·갱신합니다. 같은 이름이면 기본 정보·육지
                  조사·재조사 보상을 덮어씁니다.
                </p>
              </div>
              <div className="admin-page-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => void loadFields()}
                  disabled={loadingFields}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    setShowFieldImport((v) => !v)
                    setFieldImportNote('')
                  }}
                >
                  {showFieldImport ? '닫기' : '필드 추가'}
                </button>
              </div>
            </div>

            {showFieldImport && (
              <form className="admin-import-form" onSubmit={handleFieldImport}>
                <label className="field">
                  <span>필드 텍스트 (기본 정보·육지 조사·재조사 보상)</span>
                  <textarea
                    className="quest-import-textarea"
                    rows={20}
                    value={fieldImportText}
                    onChange={(e) => setFieldImportText(e.target.value)}
                    placeholder={`필드 | 조선 반도 서쪽 해안\n필드 종류\t상륙지\t지역\t동아시아\n해역\t동아시아 동부\t좌표\t5776, 3292\n연결된 장소\n종류\t내용\n2차 필드\t공주 북쪽\n육지 조사\n단계\t필수\t종류\t조사 항목\t횟수\t획득 완성도\t완성도 제한\n1\t\t인식\t301ac\t1\t10%\t10%\n…\n육지 재조사 보상\n종류\t아이템\n소비품\t…`}
                    disabled={importingField}
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={importingField}
                  >
                    {importingField ? '저장 중…' : '저장'}
                  </button>
                </div>
              </form>
            )}

            {fieldImportNote && (
              <p
                className={`form-note${
                  /실패|못|오류|에러|중복/.test(fieldImportNote) ? ' error' : ''
                }`}
              >
                {fieldImportNote}
              </p>
            )}

            {fieldsError && (
              <p className="form-note error" role="alert">
                {fieldsError}
              </p>
            )}

            <label className="field catalog-search">
              <input
                type="search"
                value={fieldQuery}
                onChange={(e) => setFieldQuery(e.target.value)}
                placeholder="이름·종류·지역·해역으로 검색"
                aria-label="필드 검색"
                autoComplete="off"
                disabled={loadingFields}
              />
            </label>

            {loadingFields && fields.length === 0 ? (
              <p className="form-note">불러오는 중…</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th className="col-desk">종류</th>
                      <th className="col-desk">지역</th>
                      <th className="col-desk">해역</th>
                      <th className="col-desk">좌표</th>
                      <th className="col-desk col-action">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields
                      .filter((field) => {
                        const q = fieldQuery.trim().toLowerCase()
                        if (!q) return true
                        const hay = [
                          field.name,
                          field.fieldKind,
                          field.region,
                          field.seaArea,
                          field.coordX,
                          field.coordY,
                        ]
                          .filter((v) => v != null && v !== '')
                          .join(' ')
                          .toLowerCase()
                        return hay.includes(q)
                      })
                      .slice()
                      .sort(compareIdDesc)
                      .map((field, index) => (
                        <tr
                          key={field.id}
                          className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                          tabIndex={0}
                          onClick={() => setDetailField(field)}
                          onKeyDown={(
                            event: KeyboardEvent<HTMLTableRowElement>,
                          ) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setDetailField(field)
                            }
                          }}
                        >
                          <td>{field.name}</td>
                          <td className="col-desk">{field.fieldKind || '-'}</td>
                          <td className="col-desk">{field.region || '-'}</td>
                          <td className="col-desk">{field.seaArea || '-'}</td>
                          <td className="col-desk">
                            {field.coordX != null && field.coordY != null
                              ? `${field.coordX}, ${field.coordY}`
                              : '-'}
                          </td>
                          <td
                            className="admin-cell-control col-desk col-action"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="admin-danger-btn"
                              disabled={deletingKey === `field:${field.id}`}
                              onClick={() => void handleDeleteField(field)}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    {fields.length === 0 && (
                      <tr>
                        <td colSpan={6}>등록된 필드가 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {nav === 'consumables' && (
          <section className="admin-section">
            <div className="admin-page-head">
              <div>
                <h1>소비품 리스트</h1>
                <p>
                  위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.
                </p>
              </div>
              <div className="admin-page-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => void loadConsumables()}
                  disabled={loadingConsumables}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    setShowConsumableImport((v) => !v)
                    setConsumableImportNote('')
                  }}
                >
                  {showConsumableImport ? '닫기' : '초기 데이터 추가'}
                </button>
              </div>
            </div>

            {showConsumableImport && (
              <form
                className="admin-import-form"
                onSubmit={handleConsumableImport}
              >
                <label className="field">
                  <span>초기 데이터 텍스트</span>
                  <textarea
                    className="quest-import-textarea"
                    rows={16}
                    value={consumableImportText}
                    onChange={(e) => setConsumableImportText(e.target.value)}
                    placeholder={`소비품의뢰 알선서\n조합의 의뢰를 새롭게 제시받을 수 있다.\n\n분류\t아이템 획득\t사용효과\t의뢰 알선\n획득 방법\n구입생산퀘스트…`}
                    disabled={importingConsumable}
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={importingConsumable}
                  >
                    {importingConsumable ? '저장 중…' : '저장'}
                  </button>
                </div>
              </form>
            )}

            {consumableImportNote && (
              <p
                className={`form-note${
                  /실패|못|오류|에러|중복/.test(consumableImportNote)
                    ? ' error'
                    : ''
                }`}
              >
                {consumableImportNote}
              </p>
            )}

            {consumablesError && (
              <p className="form-note error" role="alert">
                {consumablesError}
              </p>
            )}

            <label className="field catalog-search">
              <input
                type="search"
                value={consumableQuery}
                onChange={(e) => setConsumableQuery(e.target.value)}
                placeholder="이름·분류·사용효과로 검색"
                aria-label="소비품 검색"
                autoComplete="off"
                disabled={loadingConsumables}
              />
            </label>

            {loadingConsumables && consumables.length === 0 ? (
              <p className="form-note">불러오는 중…</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>이름</th>
                      <th className="col-desk">분류</th>
                      <th className="col-desk">사용효과</th>
                      <th className="col-desk col-action">삭제</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consumables
                      .filter((item) => {
                        const q = consumableQuery.trim().toLowerCase()
                        if (!q) return true
                        const hay = [
                          item.name,
                          item.category,
                          item.useEffect,
                          item.description,
                        ]
                          .filter((v) => v != null && v !== '')
                          .join(' ')
                          .toLowerCase()
                        return hay.includes(q)
                      })
                      .slice()
                      .sort(compareIdDesc)
                      .map((item, index) => (
                        <tr
                          key={item.id}
                          className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                          tabIndex={0}
                          onClick={() => setDetailConsumable(item)}
                          onKeyDown={(
                            event: KeyboardEvent<HTMLTableRowElement>,
                          ) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setDetailConsumable(item)
                            }
                          }}
                        >
                          <td>{item.name}</td>
                          <td className="col-desk">{item.category || '-'}</td>
                          <td className="col-desk">{item.useEffect || '-'}</td>
                          <td
                            className="admin-cell-control col-desk col-action"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="admin-danger-btn"
                              disabled={
                                deletingKey === `consumable:${item.id}`
                              }
                              onClick={() => void handleDeleteConsumable(item)}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    {consumables.length === 0 && (
                      <tr>
                        <td colSpan={4}>등록된 소비품이 없습니다.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {nav === 'materials' && (
          <section className="admin-section">
            <div className="admin-page-head">
              <div>
                <h1>선박 재료 리스트</h1>
                <p>
                  위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.
                </p>
              </div>
              <div className="admin-page-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => void loadMaterials()}
                  disabled={loadingMaterials}
                >
                  새로고침
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => {
                    setShowMaterialImport((v) => !v)
                    setMaterialImportNote('')
                  }}
                >
                  {showMaterialImport ? '닫기' : '재료 추가'}
                </button>
              </div>
            </div>

            {showMaterialImport && (
              <form
                className="admin-import-form"
                onSubmit={handleMaterialImport}
              >
                <label className="field">
                  <span>선박 재료 텍스트</span>
                  <textarea
                    className="quest-import-textarea"
                    rows={14}
                    value={materialImportText}
                    onChange={(e) => setMaterialImportText(e.target.value)}
                    placeholder={`선박 재료스웨덴 제독 재료\n- 선박의 재질을 스웨덴 제독용 금속으로 바꾸기 위한 금속 재료.\n재료 종류\t재질\t가능\t전체\n선박 기본 재질\t스웨덴 제독 재료\t내구도\t0 ~ 20\n장갑\t0 ~ 2\n획득 방법\n트레져박스\n아이템\nTactic & Combo`}
                    disabled={importingMaterial}
                  />
                </label>
                <div className="form-actions">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary"
                    disabled={importingMaterial}
                  >
                    {importingMaterial ? '저장 중…' : '저장'}
                  </button>
                </div>
              </form>
            )}

            {materialImportNote && (
              <p
                className={`form-note${
                  /실패|못|오류|에러|중복/.test(materialImportNote)
                    ? ' error'
                    : ''
                }`}
              >
                {materialImportNote}
              </p>
            )}

            {materialsError && (
              <p className="form-note error" role="alert">
                {materialsError}
              </p>
            )}

            {loadingMaterials ? (
              <p className="form-note">불러오는 중…</p>
            ) : (
              <ShipMaterialList
                materials={materials}
                newestFirst
                onOpen={(material) => setDetailMaterial(material)}
                onDelete={(material) => void handleDeleteMaterial(material)}
                deletingId={
                  deletingKey?.startsWith('material:')
                    ? Number(deletingKey.slice(9))
                    : null
                }
              />
            )}
          </section>
        )}
      </div>

      {detailShip && (
        <DetailModal
          title="선박 상세"
          label={`${detailShip.name} 상세`}
          onClose={() => setDetailShip(null)}
        >
          <ShipDetailView ship={detailShip} />
        </DetailModal>
      )}

      {detailPort && (
        <DetailModal
          title="항구(도시) 상세"
          label={`${detailPort.name} 상세`}
          onClose={() => setDetailPort(null)}
        >
          <PortDetailView
            port={detailPort}
            edit={{
              token,
              onToast,
              onSaved: (next) => {
                setPorts((prev) =>
                  prev.map((p) => (p.id === next.id ? next : p)),
                )
                setDetailPort(next)
              },
            }}
          />
        </DetailModal>
      )}

      {detailRegion && (
        <DetailModal
          title="지역 상세"
          label={`${detailRegion.name} 상세`}
          onClose={() => setDetailRegion(null)}
        >
          <RegionDetailView
            region={detailRegion}
            edit={{
              token,
              onToast,
              onSaved: (next) => {
                setRegions((prev) =>
                  prev.map((r) => (r.id === next.id ? next : r)),
                )
                setDetailRegion(next)
              },
            }}
          />
        </DetailModal>
      )}

      {detailEntryPermit && (
        <DetailModal
          title="입항허가 상세"
          label={`${detailEntryPermit.name} 상세`}
          onClose={() => setDetailEntryPermit(null)}
        >
          <EntryPermitDetailView
            permit={detailEntryPermit}
            edit={{
              token,
              onToast,
              onSaved: (next) => {
                setEntryPermits((prev) =>
                  prev.map((p) => (p.id === next.id ? next : p)),
                )
                setDetailEntryPermit(next)
              },
            }}
          />
        </DetailModal>
      )}

      {detailField && (
        <DetailModal
          title="필드 상세"
          label={`${detailField.name} 상세`}
          onClose={() => setDetailField(null)}
        >
          <FieldDetailView
            field={detailField}
            edit={{
              token,
              onToast,
              onSaved: (next) => {
                setFields((prev) =>
                  prev.map((f) => (f.id === next.id ? next : f)),
                )
                setDetailField(next)
              },
            }}
          />
        </DetailModal>
      )}

      {detailSeaArea && (
        <DetailModal
          title="해역 상세"
          label={`${detailSeaArea.name} 상세`}
          onClose={() => setDetailSeaArea(null)}
        >
          <SeaAreaDetailView
            seaArea={detailSeaArea}
            edit={{
              token,
              onToast,
              onSaved: (next) => {
                setSeaAreas((prev) =>
                  prev.map((s) => (s.id === next.id ? next : s)),
                )
                setDetailSeaArea(next)
              },
            }}
          />
        </DetailModal>
      )}

      {detailConsumable && (
        <DetailModal
          title="소비품 상세"
          label={`${detailConsumable.name} 상세`}
          onClose={() => setDetailConsumable(null)}
        >
          <ConsumableDetailView
            consumable={detailConsumable}
            edit={{
              token,
              onToast,
              onSaved: (next) => {
                setConsumables((prev) =>
                  prev.map((c) => (c.id === next.id ? next : c)),
                )
                setDetailConsumable(next)
              },
            }}
          />
        </DetailModal>
      )}

      {detailDiscovery && (
        <DetailModal
          title="발견물 상세"
          label={`${detailDiscovery.name} 상세`}
          onClose={() => setDetailDiscovery(null)}
        >
          <DiscoveryDetailView
            discovery={detailDiscovery}
            onOpenQuest={(ref) => void openQuestByRef(ref)}
            basicInfoEdit={{
              token,
              onToast,
              onSaved: (next) => {
                setDiscoveries((prev) =>
                  prev.map((d) => (d.id === next.id ? next : d)),
                )
                setDetailDiscovery(next)
              },
            }}
          />
        </DetailModal>
      )}

      {detailQuest && (
        <DetailModal
          title="퀘스트 상세"
          label={`${detailQuest.name} 상세`}
          onClose={() => setDetailQuest(null)}
          stack={detailDiscovery ? 1 : 0}
        >
          <QuestDetailView
            quest={detailQuest}
            token={token}
            walkthroughEdit={{
              token,
              onSaved: applyQuestUpdate,
            }}
          />
        </DetailModal>
      )}

      {detailSkill && (
        <DetailModal
          title="스킬 상세"
          label={`${detailSkill.name} 상세`}
          onClose={() => setDetailSkill(null)}
        >
          <SkillDetailView
            skill={detailSkill}
            edit={{
              token,
              onToast,
              onSaved: (next) => {
                setSkills((prev) =>
                  prev.map((s) => (s.id === next.id ? next : s)),
                )
                setDetailSkill(next)
              },
            }}
          />
        </DetailModal>
      )}

      {detailMaterial && (
        <DetailModal
          title="선박 재료 상세"
          label={`${detailMaterial.name} 상세`}
          onClose={() => setDetailMaterial(null)}
        >
          <ShipMaterialDetailView material={detailMaterial} />
        </DetailModal>
      )}

    </div>
  )
}

export function AdminForbidden() {
  return (
    <div className="admin-shell admin-forbidden">
      <div className="admin-workspace">
        <section className="admin-section">
          <h1>접근 권한이 없습니다</h1>
          <p>관리자만 `/admin`에 들어갈 수 있습니다.</p>
          <a className="admin-btn admin-btn-primary" href="/">
            메인으로
          </a>
        </section>
      </div>
    </div>
  )
}
