import { useEffect, useState, type KeyboardEvent } from 'react'
import { fetchPorts } from '../lib/api'
import type { PortDetail } from '../types'
import { DetailModal } from './DetailModal'
import { PortDetailView } from './PortDetailView'

type PortCatalogProps = {
  token: string
}

export function PortCatalog({ token }: PortCatalogProps) {
  const [ports, setPorts] = useState<PortDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<PortDetail | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setLoading(true)
        setError('')
        const res = await fetchPorts(token)
        if (!alive) return
        setPorts(res.ports)
      } catch (err) {
        if (!alive) return
        setError(
          err instanceof Error
            ? err.message
            : '항구(도시) 목록을 불러오지 못했습니다.',
        )
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [token])

  return (
    <section className="tool-page">
      <div className="messages-head">
        <div>
          <h1>항구(도시)</h1>
          <p>등록된 항구(도시)를 확인하고 상세를 엽니다.</p>
        </div>
      </div>

      {error && (
        <p className="form-note error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="form-note">불러오는 중…</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>이름</th>
                <th>분류</th>
                <th>지역</th>
                <th>해역</th>
                <th>입항허가</th>
                <th>언어</th>
              </tr>
            </thead>
            <tbody>
              {ports.map((port, index) => (
                <tr
                  key={port.id}
                  className={`admin-row-clickable${index % 2 === 0 ? ' is-even' : ' is-odd'}`}
                  tabIndex={0}
                  onClick={() => setDetail(port)}
                  onKeyDown={(event: KeyboardEvent<HTMLTableRowElement>) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setDetail(port)
                    }
                  }}
                >
                  <td>{port.name}</td>
                  <td>{port.category || '-'}</td>
                  <td>{port.region || '-'}</td>
                  <td>{port.seaArea || '-'}</td>
                  <td>{port.entryPermit || '-'}</td>
                  <td>{port.language || '-'}</td>
                </tr>
              ))}
              {ports.length === 0 && (
                <tr>
                  <td colSpan={6}>등록된 항구(도시)가 없습니다.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <DetailModal
          title="항구(도시) 상세"
          label={`${detail.name} 상세`}
          onClose={() => setDetail(null)}
        >
          <PortDetailView port={detail} />
        </DetailModal>
      )}
    </section>
  )
}
