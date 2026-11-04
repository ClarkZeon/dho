import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  deleteShipMaterial,
  fetchShipMaterials,
  importShipMaterialText,
} from '../lib/api'
import type { ShipMaterialDetail } from '../types'
import { DetailModal } from './DetailModal'
import { ShipMaterialDetailView } from './ShipMaterialDetailView'
import { ShipMaterialList } from './ShipMaterialList'

type ShipMaterialCatalogProps = {
  token: string
  isAdmin?: boolean
  onToast?: (message: string) => void
}

export function ShipMaterialCatalog({
  token,
  isAdmin = false,
  onToast,
}: ShipMaterialCatalogProps) {
  const [materials, setMaterials] = useState<ShipMaterialDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<ShipMaterialDetail | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadMaterials = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchShipMaterials(token)
      setMaterials(res.materials)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '선박 재료 목록을 불러오지 못했습니다.',
      )
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadMaterials()
  }, [loadMaterials])

  async function handleImport(e: FormEvent) {
    e.preventDefault()
    if (!importText.trim()) {
      setImportNote('텍스트를 붙여넣어 주세요.')
      return
    }
    setImporting(true)
    setImportNote('')
    try {
      const res = await importShipMaterialText(token, importText)
      setImportText('')
      setShowImport(false)
      setImportNote(
        `「${res.material.name}」을(를) 저장했습니다. (동일 이름이면 내용이 갱신됩니다)`,
      )
      onToast?.(`선박 재료 「${res.material.name}」 저장 완료`)
      await loadMaterials()
    } catch (err) {
      setImportNote(
        err instanceof Error ? err.message : '저장에 실패했습니다.',
      )
    } finally {
      setImporting(false)
    }
  }

  async function handleDelete(material: ShipMaterialDetail) {
    if (!window.confirm(`「${material.name}」 재료를 삭제할까요?`)) return
    setDeletingId(material.id)
    try {
      await deleteShipMaterial(token, material.id)
      setMaterials((prev) => prev.filter((m) => m.id !== material.id))
      if (detail?.id === material.id) setDetail(null)
      onToast?.(`재료 「${material.name}」을(를) 삭제했습니다.`)
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
          <h1>선박 재료</h1>
          <p>
            {isAdmin
              ? '위키 텍스트로 추가·갱신합니다. 같은 이름이면 내용을 덮어씁니다.'
              : '재료 종류·스탯을 비교하고 상세를 엽니다.'}
          </p>
        </div>
        {isAdmin && (
          <div className="admin-page-actions">
            <button
              type="button"
              className="btn-admin"
              onClick={() => void loadMaterials()}
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
              {showImport ? '닫기' : '재료 추가'}
            </button>
          </div>
        )}
      </div>

      {isAdmin && showImport && (
        <form className="admin-import-form" onSubmit={handleImport}>
          <label className="field">
            <span>선박 재료 텍스트</span>
            <textarea
              className="quest-import-textarea"
              rows={14}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={`선박 재료스웨덴 제독 재료\n- 선박의 재질을 스웨덴 제독용 금속으로 바꾸기 위한 금속 재료.\n재료 종류\t재질\t가능\t전체\n선박 기본 재질\t스웨덴 제독 재료\t내구도\t0 ~ 20\n장갑\t0 ~ 2\n획득 방법\n트레져박스\n아이템\nTactic & Combo`}
              disabled={importing}
            />
          </label>
          <div className="form-actions">
            <button
              type="submit"
              className="btn-admin btn-admin-primary"
              disabled={importing}
            >
              {importing ? '저장 중…' : '저장'}
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
        <ShipMaterialList
          materials={materials}
          newestFirst={isAdmin}
          onOpen={(material) => setDetail(material)}
          onDelete={isAdmin ? handleDelete : undefined}
          deletingId={deletingId}
        />
      )}

      {detail && (
        <DetailModal
          title="선박 재료 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <ShipMaterialDetailView material={detail} />
        </DetailModal>
      )}
    </section>
  )
}
