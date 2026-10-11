import 'dotenv/config'
import { parseShipText } from '../shipTextParse.mjs'
import {
  ensureShipStore,
  upsertShipFromParsed,
  getShipBySlug,
} from '../shipStore.mjs'

const t = `선박브리티쉬 코그
잉글랜드 지역에서 볼 수 있는 2마스트 코그.

분류	모험용 (소형1  , 범선)	레벨	모험 Lv4, 교역 Lv2
기본 재질	너도밤나무	강화 횟수	8 (기본 강화 : 6, 재강화 : 2)
선박 건조	조선 랭크 : 1, 건조 일수 : 6일		
기본 성능	
내구도	세로돛	가로돛	조력	선회	내파	장갑
85	130	35	0	11	4	4
적재	
선실	필요 선원	포실	창고
18	7	6	111
강화 상한 	
내구도	세로돛	가로돛	조력	선회	내파	장갑	선실	포실	창고
100	70	70	0	28	28	7	15	15	15
선박 부품	
보조돛	선수상	문장	특수장비	추가장갑	선측포	선수포	선미포
2	1	1	1	1	1	0	0
선박 스킬	
선박 스킬	선박 재료
돛	포문	선박 재료 1	선박 재료 2
조타강화			목재 가공	기능성 돛줄
표류물 탐색			마스트 톱	투망
일반 건조 도시	
지역	일반 건조 도시
유럽 북부	런던, 플리머스
획득 방법 	
구입
판매 NPC	지역	장소
조선소주인	유럽 북부	런던, 맨체스터, 플리머스`

try {
  const parsed = parseShipText(t)
  console.log('parsed', {
    name: parsed.name,
    slug: parsed.slug,
    sizeName: parsed.sizeName,
    formName: parsed.formName,
    materialName: parsed.materialName,
  })
  await ensureShipStore()
  const ship = await upsertShipFromParsed(parsed)
  console.log('upserted', ship && { id: ship.id, slug: ship.slug, name: ship.name })
  const again = await getShipBySlug(ship.slug)
  console.log('refetch', again && again.name)
} catch (err) {
  console.error('FAIL', err)
  process.exit(1)
}
