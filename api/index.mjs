import { handleRequest } from '../server/index.mjs'

/**
 * Vercel Serverless — 모든 /api/* 요청을 여기로 rewrite 해서 처리
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  await handleRequest(req, res)
}
