import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { deleteShip, fetchShips, importShipText } from '../lib/api'
import type { ShipDetail } from '../types'
import { DetailModal } from './DetailModal'
import { ShipDetailView } from './ShipDetailView'
import { ShipList } from './ShipList'

type ShipInfoProps = {
  token: string
  isAdmin?: boolean
  onToast?: (message: string) => void
}

export function ShipInfo({
  token,
  isAdmin = false,
  onToast,
}: ShipInfoProps) {
  const [ships, setShips] = useState<ShipDetail[]>([])
  const [detail, setDetail] = useState<ShipDetail | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadShips = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchShips(token)
      setShips(res.ships)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '선박 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadShips()
  }, [loadShips])

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!importText.trim()) {
      setImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImporting(true)
    setImportNote('')
    try {
      const res = await importShipText(token, importText)
      setImportText('')
      setShowImport(false)
      setImportNote(`「${res.ship.name}」을(를) 등록했습니다.`)
      onToast?.(`선박 「${res.ship.name}」 저장 완료`)
      await loadShips()
    } catch (err) {
      setImportNote(err instanceof Error ? err.message : '등록에 실패했습니다.')
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(ship: ShipDetail) {
    if (!window.confirm(`「${ship.name}」 선박을 삭제할까요?`)) return
    setDeletingId(ship.id)
    try {
      await deleteShip(token, ship.id)
      setShips((prev) => prev.filter((s) => s.id !== ship.id))
      if (detail?.id === ship.id) setDetail(null)
      onToast?.(`선박 「${ship.name}」을(를) 삭제했습니다.`)
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>선박 정보</h1>
          <p>
            {isAdmin
              ? '위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.'
              : '등록된 선박을 검색·비교하고 상세를 엽니다.'}
          </p>
        </div>
        {isAdmin && (
          <div className="admin-page-actions">
            <button
              type="button"
              className="btn-admin"
              onClick={() => void loadShips()}
              disabled={loading}
            >
              새로고침
            </button>
            <button
              type="button"
              className="btn-admin btn-admin-primary"
              onClick={() => {
                setShowImport((v) => !v)
                setImportNote('')
              }}
            >
              {showImport ? '닫기' : '선박 추가'}
            </button>
          </div>
        )}
      </div>

      {isAdmin && showImport && (
        <form className="admin-import-form" onSubmit={handleImport}>
          <label className="field">
            <span>선박 텍스트</span>
            <textarea
              rows={12}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="위키 등에서 복사한 선박 정보를 붙여넣으세요."
              disabled={importing}
            />
          </label>
          <div className="form-actions">
            <button
              type="submit"
              className="btn-admin btn-admin-primary"
              disabled={importing}
            >
              {importing ? '등록 중…' : '등록'}
            </button>
          </div>
        </form>
      )}

      {importNote && (
        <p
          className={`form-note${
            /실패|못|오류|에러|중복/.test(importNote) ? ' error' : ''
          }`}
        >
          {importNote}
        </p>
      )}

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="form-note">불러오는 중…</p>
      ) : (
        <ShipList
          ships={ships}
          newestFirst={isAdmin}
          onOpen={setDetail}
          onDelete={isAdmin ? handleDelete : undefined}
          deletingId={deletingId}
        />
      )}

      {detail && (
        <DetailModal
          title="선박 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <ShipDetailView ship={detail} />
        </DetailModal>
      )}
    </section>
  )
}
