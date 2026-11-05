/**
 * 로컬 API 개발 러너
 * - server/ 변경 시 debounce 후 자식 프로세스 재시작
 * - Windows 에서 child.kill() 만으로는 자식 트리가 안 죽어
 *   포트/Neon 연결이 겹치며 ensure 가 멈추는 문제를 taskkill /T 로 완화
 */

import { spawn, execFile } from 'node:child_process'
import { watch } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const entry = path.join(__dirname, 'index.mjs')
const DEBOUNCE_MS = 600
const KILL_WAIT_MS = 500
const isWin = process.platform === 'win32'

/** @type {import('node:child_process').ChildProcess | null} */
let child = null
/** @type {ReturnType<typeof setTimeout> | null} */
let debounceTimer = null
let restartQueued = false
let shuttingDown = false
let starting = false

function log(msg) {
  console.log(`[dev-api] ${msg}`)
}

function shouldWatch(filename) {
  if (!filename) return false
  const base = filename.replace(/\\/g, '/')
  if (base.includes('node_modules/')) return false
  if (/(^|\/)dev-api\.mjs$/i.test(base)) return false
  if (/(^|\/)scripts\//i.test(base)) return false
  return /\.(mjs|js|cjs|sql|env)$/i.test(base) || /(^|\/)\.env(\.|$)/i.test(base)
}

function treeKill(pid) {
  return new Promise((resolve) => {
    if (!pid || pid <= 0) {
      resolve()
      return
    }
    if (!isWin) {
      try {
        process.kill(pid, 'SIGTERM')
      } catch {
        // ignore
      }
      setTimeout(() => {
        try {
          process.kill(pid, 'SIGKILL')
        } catch {
          // ignore
        }
        resolve()
      }, 800)
      return
    }
    execFile(
      'taskkill',
      ['/pid', String(pid), '/T', '/F'],
      { windowsHide: true },
      () => resolve(),
    )
  })
}

function startChild() {
  if (shuttingDown || child || starting) return
  starting = true
  log('starting API…')
  child = spawn(process.execPath, [entry], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
  })
  const current = child
  starting = false
  current.on('exit', (code, signal) => {
    if (child === current) child = null
    if (shuttingDown) return
    if (restartQueued) {
      restartQueued = false
      setTimeout(startChild, KILL_WAIT_MS)
      return
    }
    if (signal) {
      log(`API stopped (${signal}); restarting in 1s`)
      setTimeout(startChild, 1000)
      return
    }
    if (code && code !== 0) {
      log(`API exited with code ${code}; retry in 1s`)
      setTimeout(startChild, 1000)
    }
  })
}

async function stopChild() {
  const current = child
  if (!current?.pid) {
    child = null
    return
  }
  const pid = current.pid
  child = null
  await treeKill(pid)
  await new Promise((r) => setTimeout(r, KILL_WAIT_MS))
}

function queueRestart(reason) {
  if (shuttingDown) return
  if (reason) log(reason)
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void (async () => {
      restartQueued = true
      log('restarting…')
      await stopChild()
      if (restartQueued) {
        restartQueued = false
        startChild()
      }
    })()
  }, DEBOUNCE_MS)
}

try {
  watch(__dirname, { recursive: true }, (_event, filename) => {
    if (!shouldWatch(String(filename || ''))) return
    queueRestart(`changed: ${filename}`)
  })
} catch (err) {
  console.error('[dev-api] watch failed; falling back to single run', err)
}

startChild()

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  if (debounceTimer) clearTimeout(debounceTimer)
  void stopChild().finally(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
