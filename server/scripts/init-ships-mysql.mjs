/**
 * MySQL 선박 DB 초기화 + 팬시 시드
 * 사용: MYSQL_PASSWORD=... node server/scripts/init-ships-mysql.mjs
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SQL_DIR = path.join(__dirname, '..', 'sql')
const mysqlBin =
  process.env.MYSQL_BIN ||
  'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe'
const host = process.env.MYSQL_HOST || 'localhost'
const user = process.env.MYSQL_USER || 'root'
const password = process.env.MYSQL_PASSWORD

if (password == null) {
  console.error(
    'MYSQL_PASSWORD 환경변수가 필요합니다. 예:\n  $env:MYSQL_PASSWORD=\"비밀번호\"; node server/scripts/init-ships-mysql.mjs',
  )
  process.exit(1)
}

const files = [
  '000_create_database.sql',
  '003_reset_ships.sql',
  '001_ships.sql',
  '002_seed_fancy.sql',
]

for (const file of files) {
  const full = path.join(SQL_DIR, file)
  console.log(`> ${file}`)
  const args = ['-h', host, '-u', user, `--password=${password}`]
  const result = spawnSync(mysqlBin, args, {
    input: await import('node:fs').then((fs) => fs.readFileSync(full, 'utf8')),
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout)
    process.exit(result.status ?? 1)
  }
}

console.log('선박 DB 초기화 완료 (팬시 포함)')
