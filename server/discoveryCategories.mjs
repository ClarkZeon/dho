/**
 * 발견물 분류 (파일 상수).
 * 저장값은 항상 리프 이름만 (예: 해양생물).
 * 위키의 「생물 » 해양생물」 표기는 파서가 리프로 정규화한다.
 */

export const DISCOVERY_CATEGORY_GROUPS = [
  '유물',
  '보물',
  '생물',
  '지리·천문',
  '기상·전승',
]

/** 그룹 → 리프 목록 */
export const DISCOVERY_CATEGORIES_BY_GROUP = {
  유물: ['사적', '종교건축물', '역사유물', '종교유물'],
  보물: ['미술품', '보물', '화석'],
  생물: [
    '식물',
    '곤충',
    '조류',
    '소형생물',
    '중형생물',
    '대형생물',
    '해양생물',
  ],
  '지리·천문': ['항구·마을', '지리', '천문'],
  '기상·전승': ['기상 현상', '전승'],
}

/** 파서·매칭용 리프 전체 (긴 이름 우선 정렬은 호출측에서) */
export const DISCOVERY_CATEGORY_LEAVES = [
  ...DISCOVERY_CATEGORIES_BY_GROUP['유물'],
  ...DISCOVERY_CATEGORIES_BY_GROUP['보물'],
  ...DISCOVERY_CATEGORIES_BY_GROUP['생물'],
  ...DISCOVERY_CATEGORIES_BY_GROUP['지리·천문'],
  ...DISCOVERY_CATEGORIES_BY_GROUP['기상·전승'],
  // 위키 표기 변형
  '항구-마을',
  '기상현상',
]
