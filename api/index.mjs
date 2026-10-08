import { handleRequest } from '../server/index.mjs'

/**
 * Vercel Serverless — /api/* rewrite 진입점.
 * rewrite 후 req.url 이 /api 로 바뀌므로, 원본 경로를 ?__p= 로 복원.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  const host = req.headers.host || 'localhost'
  const incoming = new URL(req.url || '/', `https://${host}`)
  const originalPath = incoming.searchParams.get('__p')

  if (originalPath) {
    incoming.searchParams.delete('__p')
    const qs = incoming.searchParams.toString()
    req.url = originalPath + (qs ? `?${qs}` : '')
  }

  await handleRequest(req, res)
}
