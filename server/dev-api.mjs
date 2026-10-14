/**
 * 로컬 API 개발 러너
 * - server/ 변경 시 debounce 후 자식 프로세스 재시작
 * - node --watch 가 Windows에서 연속 재시작하다 멈추는 문제 완화
 */

import { spawn } from 'node:child_process'
import { watch } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const entry = path.join(__dirname, 'index.mjs')
const DEBOUNCE_MS = 500
const KILL_WAIT_MS = 400

/** @type {import('node:child_process').ChildProcess | null} */
let child = null
/** @type {ReturnType<typeof setTimeout> | null} */
let debounceTimer = null
let restartQueued = false
let shuttingDown = false

function log(msg) {
  console.log(`[dev-api] ${msg}`)
}

function shouldWatch(filename) {
  if (!filename) return false
  const base = filename.replace(/\\/g, '/')
  if (base.includes('node_modules/')) return false
  if (/(^|\/)dev-api\.mjs$/i.test(base)) return false
  return /\.(mjs|js|cjs|sql|env)$/i.test(base) || /(^|\/)\.env(\.|$)/i.test(base)
}

function startChild() {
  if (shuttingDown || child) return
  log('starting API…')
  child = spawn(process.execPath, [entry], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    windowsHide: true,
  })
  const current = child
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

function stopChild() {
  if (!child) return Promise.resolve()
  const current = child
  return new Promise((resolve) => {
    const done = () => resolve()
    current.once('exit', done)
    try {
      current.kill()
    } catch {
      done()
      return
    }
    setTimeout(() => {
      if (child === current) {
        try {
          current.kill('SIGKILL')
        } catch {
          // ignore
        }
      }
      done()
    }, 2500)
  })
}

function queueRestart(reason) {
  if (shuttingDown) return
  if (reason) log(reason)
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void (async () => {
      if (child) {
        restartQueued = true
        log('restarting…')
        await stopChild()
        // stopChild exit handler starts next when restartQueued
        if (!child && restartQueued) {
          restartQueued = false
          setTimeout(startChild, KILL_WAIT_MS)
        }
        return
      }
      startChild()
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
