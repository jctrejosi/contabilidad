/* ============================================================
   CONTABDSI · Documento oficial (libro)
   ============================================================ */

import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, ErrorState, NoPermissionState, PageHeader } from '@/components/ui'
import { DebitCreditSummary } from '@/components/accounting/DataGrid'
import { TerceroLabel } from '@/components/accounting/Combobox'
import { ExportMenu, InfoStrip, usePageTitle } from '@/components/accounting/Widgets'
import { useCan, useStore } from '@/state/AppStore'
import { fecha, money, nitFmt, sum } from '@/core/format'

export function DocumentoOficialPage() {
  usePageTitle('Documento oficial')
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { state } = useStore()
  const puedeVer = useCan('consulta.ver')

  const doc = state.documentos.find((d) => d.id === id)

  if (!puedeVer) {
    return (
      <div className="page">
        <NoPermissionState perm="consulta.ver" />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="page">
        <PageHeader title="Documento oficial" icon="doc" />
        <ErrorState title="Documento no encontrado" detail="El documento solicitado no existe en el libro oficial." />
        <div className="center">
          <Button icon="chevronL" onClick={() => navigate(-1)}>Volver</Button>
        </div>
      </div>
    )
  }

  const voucher = state.vouchers.find((v) => v.code === doc.comprobante)
  const consecutivo = String(voucher?.consecutivo ?? 0).padStart(6, '0')
  const reversion = state.documentos.find((d) => d.reversoDe === doc.id)
  const original = doc.reversoDe ? state.documentos.find((d) => d.id === doc.reversoDe) : undefined
  const reversado = Boolean(reversion)
  const deb = sum(doc.lineas.map((l) => l.debito))
  const cre = sum(doc.lineas.map((l) => l.credito))

  return (
    <div className="page">
      <PageHeader
        title="Documento oficial"
        subtitle={`${doc.comprobante}-${consecutivo} · ${doc.documento}`}
        icon="doc"
        badge={
          doc.estado === 'ANULADO' || reversado
            ? <Badge tone="danger" icon="x">ANULADO</Badge>
            : <Badge tone="success" icon="check">Contabilizado</Badge>
        }
        actions={
          <div className="row gap-8">
            <Button icon="print" onClick={() => window.print()}>Imprimir</Button>
            <ExportMenu onExport={() => {}} filename={doc.documento} />
            <Button icon="chevronL" onClick={() => navigate(-1)}>Volver</Button>
          </div>
        }
      />

      {(reversado || doc.reversoDe) && (
        <Card title="Trazabilidad de reversión" icon="link" tone="warning">
          {doc.reversoDe && (
            <p className="small">
              Este documento es la <b>reversión</b> de{' '}
              {original ? (
                <Link to={`/documentos/${original.id}`}>{original.documento}</Link>
              ) : (
                'un documento original'
              )}.
            </p>
          )}
          {reversion && (
            <p className="small">
              Este documento fue <b>reversado</b> por <Link to={`/documentos/${reversion.id}`}>{reversion.documento}</Link>.
              El movimiento original permanece en el libro enlazado a su reversión.
            </p>
          )}
        </Card>
      )}

      <Card pad={false} title="Movimiento contable" icon="libro">
        <div className="doc-sheet">
          <InfoStrip
            items={[
              { label: 'Comprobante', value: <span className="tnum">{doc.comprobante}-{consecutivo}</span> },
              { label: 'Documento', value: <span className="tnum">{doc.documento}</span> },
              { label: 'Fecha', value: <span className="tnum">{fecha(doc.fecha)}</span> },
              { label: 'Período', value: <span className="tnum">{doc.periodo}</span> },
              { label: 'Tercero', value: <TerceroLabel nit={doc.nit} /> },
              { label: 'NIT', value: <span className="tnum">{doc.nit ? nitFmt(doc.nit) : '—'}</span> },
              { label: 'Concepto', value: doc.concepto },
              { label: 'Lote', value: <Link to={`/movimientos/lotes/${doc.lote}`}>{doc.lote}</Link> },
              { label: 'Usuario', value: doc.usuario },
            ]}
          />

          <table className="sheet-table">
            <thead>
              <tr>
                <th>Cuenta</th><th>NIT</th><th>Centro</th><th>Documento</th><th>Concepto</th>
                <th className="right">Débito</th><th className="right">Crédito</th><th className="right">Base</th><th>Clase</th>
              </tr>
            </thead>
            <tbody>
              {doc.lineas.map((l) => (
                <tr key={l.id}>
                  <td className="tnum">{l.cuenta}</td>
                  <td className="tnum">{l.nit || '—'}</td>
                  <td className="tnum">{l.centro || '—'}</td>
                  <td className="tnum">{l.documento || '—'}</td>
                  <td>{l.concepto}</td>
                  <td className="money">{l.debito ? money(l.debito) : ''}</td>
                  <td className="money">{l.credito ? money(l.credito) : ''}</td>
                  <td className="money">{l.base ? money(l.base) : ''}</td>
                  <td className="tnum">{l.clase || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <DebitCreditSummary debito={deb} credito={cre} />
        </div>
      </Card>
    </div>
  )
}
