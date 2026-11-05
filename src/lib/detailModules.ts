/**
 * 상세 화면 모듈 레지스트리 (점진 확장).
 *
 * - 모듈 = 위키처럼 이름으로 이어 붙일 수 있는 단위 (발견물, 퀘스트, 직업, 스킬, …)
 * - 기본 정보 = 그 모듈 인스턴스의 고유 필드 (모듈이 아님)
 * - 선박·재료 = 현행 유지, 이번 모듈화 대상 아님
 *
 * 모듈 단위는 사용자가 항목별로 확정한 뒤 여기에만 추가한다.
 */

export type DetailModuleId =
  | 'discovery'
  | 'quest'
  | 'job'
  | 'skill'
  | 'refine'

export type DetailModuleDef = {
  id: DetailModuleId
  /** 섹션·배지 표시 제목 */
  title: string
}

/** 등록된 모듈 종류 */
export const DETAIL_MODULES: readonly DetailModuleDef[] = [
  { id: 'discovery', title: '발견물' },
  { id: 'quest', title: '퀘스트' },
  { id: 'job', title: '직업' },
  { id: 'skill', title: '스킬' },
  { id: 'refine', title: '연성 효과' },
] as const

/**
 * 어떤 모듈 페이지에 어떤 모듈을 붙일 수 있는지.
 * host 페이지의 기본 정보 아래에 attachment 모듈 섹션이 온다.
 * 같은 attachment는 여러 개 등록 가능 (예: 발견물 ← 퀘스트 N개 = 위키 「발견 방법」 다건).
 */
export const MODULE_ATTACHMENTS: readonly {
  host: DetailModuleId
  attachment: DetailModuleId
  /** 동일 종류를 여러 인스턴스로 붙일 수 있는지 */
  multiple: boolean
}[] = [
  { host: 'discovery', attachment: 'quest', multiple: true },
  { host: 'quest', attachment: 'discovery', multiple: false },
  { host: 'job', attachment: 'skill', multiple: true },
  { host: 'skill', attachment: 'job', multiple: true },
  { host: 'refine', attachment: 'skill', multiple: true },
] as const

export function getModuleDef(id: DetailModuleId): DetailModuleDef | undefined {
  return DETAIL_MODULES.find((mod) => mod.id === id)
}

export function attachmentsFor(host: DetailModuleId): DetailModuleId[] {
  return MODULE_ATTACHMENTS.filter((row) => row.host === host).map(
    (row) => row.attachment,
  )
}
