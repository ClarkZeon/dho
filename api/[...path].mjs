import { handleRequest } from '../server/index.mjs'

/**
 * Vercel Serverless — /api/* 전부 기존 Node API 핸들러로 전달
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function handler(req, res) {
  await handleRequest(req, res)
}
