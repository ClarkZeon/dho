import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { getSql } from '../db.mjs'

const sql = getSql()
const token = `e2e-${Date.now()}`
await sql`
  INSERT INTO sessions (token, user_id, created_at)
  VALUES (${token}, 'ebf30003c4eb1ea5', ${new Date().toISOString()})
`

const sample = await readFile(
  new URL('./fixtures/british-cog.txt', import.meta.url),
  'utf8',
).catch(() => null)

const text =
  sample ||
  `선박브리티쉬 코그
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
획득 방법 	
구입`

const res = await fetch('http://localhost:17778/api/ships/import-text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({ text }),
})
const body = await res.json()
console.log(res.status, JSON.stringify(body, null, 2))
await sql`DELETE FROM sessions WHERE token = ${token}`
if (!res.ok) process.exit(1)
