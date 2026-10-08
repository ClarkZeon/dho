import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 패키지에 포함된 시드/정적 데이터 (읽기 전용 가능) */
export const BUNDLED_DATA_DIR = path.join(__dirname, 'data')

/**
 * 쓰기 가능한 데이터 디렉터리.
 * Vercel 등 서버리스는 로컬 data가 읽기 전용이므로 /tmp 사용.
 */
export function getWritableDataDir() {
  if (process.env.DHO_DATA_DIR) return process.env.DHO_DATA_DIR
  if (process.env.VERCEL) return path.join('/tmp', 'dho-data')
  return BUNDLED_DATA_DIR
}
