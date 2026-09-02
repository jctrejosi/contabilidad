import { useState, useRef, useEffect } from 'react';
import { TERCEROS, CENTROS, USUARIO, fmtCOP } from '../data/mock';
import type { Lote, LoteEstado, LoteLinea } from '../types';

const USUARIOS_LOTES = ['Laura Gómez', 'Carlos Pérez', 'Ana Torres', 'Diego Ramírez', 'Sofía Herrera'];

const ESTADO_COLORS: Record<string, string> = {
  'Borrador': 'bg-gray-100 text-gray-600',
  'Con errores': 'bg-red-100 text-red-700',
  'Verificado': 'bg-blue-100 text-blue-700',
  'Pendiente aprobación': 'bg-amber-100 text-amber-700',
  'Aprobado': 'bg-purple-100 text-purple-700',
  'Contabilizando': 'bg-blue-100 text-blue-700',
  'Contabilizado': 'bg-green-100 text-green-700',
  'Fallido': 'bg-red-100 text-red-700',
  'Anulado': 'bg-gray-100 text-gray-500',
};

function EstadoBadge({ estado }: { estado: LoteEstado }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_COLORS[estado] || 'bg-gray-100 text-gray-600'}`}>
      {estado}
    </span>
  );
}

interface LotesPageProps {
  lotes: Lote[];
  selectedLoteId: string | null;
  onUpdateLotes: (lotes: Lote[]) => void;
  onNavigateToDoc: () => void;
  onNavigateToMensual: () => void;
}

type LoteView = 'list' | 'editor' | 'receipt' | 'document';

type EditingCell = { lineId: string; field: 'tercero' | 'centro' } | null;

function ReceiptModal({ lote, onClose, onVerDoc }: { lote: Lote; onClose: () => void; onVerDoc: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200" style={{ backgroundColor: '#EFFAFF' }}>
          <div>
            <div className="text-sm font-bold text-gray-800">Comprobante contabilizado exitosamente</div>
            <div className="text-xs text-gray-500 mt-0.5">Lote {lote.codigo} · {lote.nombre}</div>
          </div>
          <span className="text-2xl text-green-500">✓</span>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-gray-400 mb-1">Comprobante</div>
              <div className="font-mono font-semibold text-gray-800">CE-000245</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">Documento</div>
              <div className="font-mono font-semibold text-gray-800">NOM-2026-02</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">Período</div>
              <div className="font-medium text-gray-800">Febrero 2026</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">Fecha contabilización</div>
              <div className="font-medium text-gray-800">28/02/2026 {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">Total débitos</div>
              <div className="font-mono font-bold text-gray-800">{fmtCOP(lote.debito)}</div>
            </div>
            <div>
              <div className="text-gray-400 mb-1">Total créditos</div>
              <div className="font-mono font-bold text-gray-800">{fmtCOP(lote.credito)}</div>
            </div>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <div className="text-xs text-gray-500 mb-2">Líneas contabilizadas</div>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {lote.lineas.slice(0, 6).map(l => (
                <div key={l.id} className="flex items-center gap-3 text-xs">
                  <span className="font-mono text-gray-500 w-16 shrink-0">{l.cuenta}</span>
                  <span className="text-gray-600 flex-1 truncate">{l.nombreCuenta}</span>
                  {l.debito > 0 && <span className="font-mono text-gray-800 text-right">{fmtCOP(l.debito)}</span>}
                  {l.credito > 0 && <span className="font-mono text-gray-500 text-right">({fmtCOP(l.credito)})</span>}
                </div>
              ))}
              {lote.lineas.length > 6 && (
                <div className="text-xs text-gray-400">... y {lote.lineas.length - 6} líneas más</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded text-xs text-green-700">
            <span>✓</span>
            <span>Asiento registrado. Disponible en consultas y en el documento oficial.</span>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onVerDoc} className="text-xs px-4 py-2 rounded font-medium border border-gray-200 hover:bg-gray-50 transition-colors text-gray-700">
            Ver documento oficial
          </button>
          <button onClick={onClose} className="text-xs px-4 py-2 rounded font-medium text-white transition-colors" style={{ backgroundColor: '#0073C0' }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

function ApproveModal({ onConfirm, onCancel, title, message }: { onConfirm: () => void; onCancel: () => void; title: string; message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 p-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">{title}</h3>
        <p className="text-xs text-gray-600 mb-5">{message}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Cancelar</button>
          <button onClick={onConfirm} className="text-xs px-4 py-2 rounded text-white font-medium transition-colors" style={{ backgroundColor: '#0073C0' }}>Confirmar</button>
        </div>
      </div>
    </div>
  );
}

function PostingProgress({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('Iniciando contabilización...');

  useEffect(() => {
    const steps = [
      [20, 'Validando estructura del lote...'],
      [40, 'Verificando período y permisos...'],
      [60, 'Aplicando movimientos a cuentas...'],
      [80, 'Actualizando saldos y centros...'],
      [100, 'Contabilización completada'],
    ];
    let i = 0;
    const interval = setInterval(() => {
      if (i < steps.length) {
        setProgress(steps[i][0] as number);
        setStep(steps[i][1] as string);
        i++;
      } else {
        clearInterval(interval);
        setTimeout(onDone, 600);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Contabilizando lote...</h3>
        <p className="text-xs text-gray-500 mb-4">Por favor no cierre esta ventana</p>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: '#0073C0' }}
          />
        </div>
        <div className="text-xs text-gray-600">{step}</div>
        <div className="text-right text-xs font-mono text-gray-400 mt-1">{progress}%</div>
      </div>
    </div>
  );
}

function LoteEditor({
  lote,
  onBack,
  onUpdateLote,
  onNavigateToDoc,
  onNavigateToMensual,
}: {
  lote: Lote;
  onBack: () => void;
  onUpdateLote: (updated: Lote) => void;
  onNavigateToDoc: () => void;
  onNavigateToMensual: () => void;
}) {
  const [lines, setLines] = useState<LoteLinea[]>(lote.lineas);
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [flowState, setFlowState] = useState<LoteEstado>(lote.estado);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showPosting, setShowPosting] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showValidation, setShowValidation] = useState(true);
  const [showAnular, setShowAnular] = useState(false);
  const [motivoAnular, setMotivoAnular] = useState('');
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const totalDebit = lines.reduce((s, l) => s + l.debito, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credito, 0);
  const diff = totalDebit - totalCredit;
  const totalErrors = lines.reduce((s, l) => s + l.errores.length, 0);
  const isBalanced = diff === 0;
  const canVerify = totalErrors === 0 && isBalanced && flowState === 'Con errores';
  const canSendApproval = flowState === 'Verificado';
  const canApprove = flowState === 'Pendiente aprobación';
  const canPost = flowState === 'Aprobado';
  const isPosted = flowState === 'Contabilizado';
  const bloqueado = isPosted || flowState === 'Anulado';

  function fixLine(lineId: string, field: 'tercero' | 'centro', value: string) {
    setLines(prev => prev.map(l => {
      if (l.id !== lineId) return l;
      const updated = { ...l, [field]: value };
      if (field === 'tercero') {
        const t = TERCEROS.find(t => t.nombre === value);
        updated.nit = t ? t.nit : updated.nit;
        updated.errores = updated.errores.filter(e => !e.includes('tercero'));
      }
      if (field === 'centro') {
        updated.errores = updated.errores.filter(e => !e.includes('centro'));
      }
      return updated;
    }));
    setEditingCell(null);
  }

  function scrollToLine(lineId: string) {
    rowRefs.current[lineId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => {
      const line = lines.find(l => l.id === lineId);
      if (line) {
        const field = line.errores.some(e => e.includes('tercero')) ? 'tercero' : 'centro';
        setEditingCell({ lineId, field });
      }
    }, 300);
  }

  function propagate(next: LoteEstado) {
    setFlowState(next);
    onUpdateLote({
      ...lote,
      lineas: lines,
      estado: next,
      erroresCount: next === 'Contabilizado' ? 0 : totalErrors,
      lineasCount: lines.length,
      debito: totalDebit,
      credito: totalCredit,
      diferencia: diff,
    });
  }

  function handleVerify() {
    propagate('Verificado');
  }
  function handleSendApproval() {
    setShowApproveModal(true);
  }
  function confirmSendApproval() {
    propagate('Pendiente aprobación');
    setShowApproveModal(false);
  }
  function handleApprove() {
    setShowApproveModal(true);
  }
  function confirmApprove() {
    propagate('Aprobado');
    setShowApproveModal(false);
  }
  function handlePost() {
    setShowPostModal(true);
  }
  function confirmPost() {
    setShowPostModal(false);
    setShowPosting(true);
  }
  function onPostingDone() {
    propagate('Contabilizado');
    setShowPosting(false);
    setShowReceipt(true);
  }

  function depurar() {
    const enCero = lines.filter(l => l.debito === 0 && l.credito === 0).length;
    if (!enCero) {
      setAviso({ tipo: 'error', texto: 'No hay líneas en cero para depurar.' });
      return;
    }
    setLines(prev => prev.filter(l => l.debito !== 0 || l.credito !== 0));
    setAviso({ tipo: 'success', texto: `Depuración aplicada: se eliminaron ${enCero} línea(s) en cero.` });
  }

  function confirmarAnular() {
    if (!motivoAnular.trim()) return;
    propagate('Anulado');
    setShowAnular(false);
    setMotivoAnular('');
    setAviso({ tipo: 'success', texto: 'Lote anulado. La anulación quedó registrada en la bitácora con el motivo indicado.' });
  }

  function imprimir() {
    setAviso({ tipo: 'success', texto: 'Ventana de impresión lista — use el diálogo del navegador.' });
    window.print();
  }

  function exportar() {
    const filas = lines.map(l => [l.cuenta, l.nombreCuenta, l.nit, l.tercero, l.centro, l.comprobante, l.documento, l.fecha, String(l.debito), String(l.credito), String(l.base), l.clase, l.concepto].join(';'));
    const csv = ['Cuenta;Nombre cuenta;NIT;Tercero;Centro;Comprobante;Documento;Fecha;Débito;Crédito;Base;Clase;Concepto', ...filas].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lote-${lote.codigo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setAviso({ tipo: 'success', texto: `Lote ${lote.codigo} exportado a CSV (${lines.length} líneas).` });
  }

  const updatedLoteForReceipt: Lote = { ...lote, lineas: lines, debito: totalDebit, credito: totalCredit };

  return (
    <div className="flex flex-col h-full">
      {/* Breadcrumb + actions bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
        <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-700">← Lotes</button>
        <span className="text-gray-300">/</span>
        <span className="text-xs font-medium text-gray-800">{lote.codigo} — {lote.nombre}</span>
        <div className="ml-2">
          <EstadoBadge estado={flowState} />
        </div>
        {totalErrors > 0 && (
          <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">
            {totalErrors} error{totalErrors !== 1 ? 'es' : ''}
          </span>
        )}

        <div className="flex-1" />

        {/* Flow action buttons */}
        <div className="flex items-center gap-2">
          {canVerify && (
            <button
              onClick={handleVerify}
              className="text-xs px-3 py-1.5 rounded font-medium text-white transition-colors"
              style={{ backgroundColor: '#2563EB' }}
            >
              ✓ Verificar
            </button>
          )}
          {canSendApproval && (
            <button
              onClick={handleSendApproval}
              className="text-xs px-3 py-1.5 rounded font-medium text-white transition-colors"
              style={{ backgroundColor: '#D97706' }}
            >
              → Enviar a aprobación
            </button>
          )}
          {canApprove && (
            <button
              onClick={handleApprove}
              className="text-xs px-3 py-1.5 rounded font-medium text-white transition-colors"
              style={{ backgroundColor: '#7C3AED' }}
            >
              ✓ Aprobar
            </button>
          )}
          {canPost && (
            <button
              onClick={handlePost}
              className="text-xs px-3 py-1.5 rounded font-medium text-white transition-colors"
              style={{ backgroundColor: '#0073C0' }}
            >
              ⚡ Contabilizar
            </button>
          )}
          {isPosted && (
            <button
              onClick={() => setShowReceipt(true)}
              className="text-xs px-3 py-1.5 rounded font-medium border border-gray-200 text-gray-700 transition-colors hover:bg-gray-50"
            >
              Ver recibo
            </button>
          )}
          {flowState !== 'Anulado' && !isPosted && lines.some(l => l.debito === 0 && l.credito === 0) && (
            <button
              onClick={depurar}
              title="Eliminar líneas en cero"
              className="text-xs px-2.5 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              🧹 Depurar
            </button>
          )}
          {flowState !== 'Anulado' && !isPosted && (
            <button
              onClick={() => { setMotivoAnular(''); setShowAnular(true); }}
              className="text-xs px-2.5 py-1.5 rounded border border-red-200 text-red-600 hover:bg-red-50 font-medium"
            >
              Anular lote
            </button>
          )}
          <button onClick={imprimir} title="Imprimir" className="text-xs px-2.5 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">⎙</button>
          <button onClick={exportar} title="Exportar XLSX" className="text-xs px-2.5 py-1.5 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">↓ Exportar</button>
        </div>
      </div>

      {aviso && (
        <div className={`shrink-0 flex items-center justify-between px-4 py-2 text-xs border-b ${aviso.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
          <span>{aviso.texto}</span>
          <button onClick={() => setAviso(null)} className="text-gray-400 hover:text-gray-600">×</button>
        </div>
      )}

      {/* Lote meta */}
      <div className="shrink-0 flex items-center gap-6 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-500">
        <span><strong>Período:</strong> {lote.periodo}</span>
        <span><strong>Fecha:</strong> {lote.fecha}</span>
        <span><strong>Usuario:</strong> {lote.usuario}</span>
        <span><strong>Origen:</strong> {lote.origen}</span>
        <span><strong>Líneas:</strong> {lote.lineasCount}</span>
      </div>

      {/* Validation panel */}
      {totalErrors > 0 && showValidation && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-red-700">Centro de validación — {totalErrors} error{totalErrors !== 1 ? 'es' : ''} encontrado{totalErrors !== 1 ? 's' : ''}</span>
            <button onClick={() => setShowValidation(false)} className="text-xs text-red-400 hover:text-red-600">Ocultar</button>
          </div>
          <div className="space-y-1">
            {lines.filter(l => l.errores.length > 0).map(l => (
              l.errores.map((err, i) => (
                <div key={`${l.id}-${i}`} className="flex items-center gap-3 text-xs">
                  <span className="text-red-400">⚠</span>
                  <span className="text-red-600 font-mono w-14 shrink-0">{l.id}</span>
                  <span className="text-red-700">{l.cuenta} {l.nombreCuenta} —</span>
                  <span className="text-red-800 font-medium">{err}</span>
                  <button
                    onClick={() => scrollToLine(l.id)}
                    className="ml-auto text-xs px-2 py-0.5 rounded text-white shrink-0"
                    style={{ backgroundColor: '#DC2626' }}
                  >
                    Ir a celda
                  </button>
                </div>
              ))
            ))}
          </div>
        </div>
      )}

      {!isPosted && totalErrors === 0 && isBalanced && flowState !== 'Verificado' && flowState !== 'Pendiente aprobación' && flowState !== 'Aprobado' && (
        <div className="shrink-0 border-b border-green-200 bg-green-50 px-4 py-2 flex items-center gap-2 text-xs text-green-700">
          <span className="text-green-500">✓</span>
          <span>Lote sin errores y cuadrado — listo para verificar</span>
          <button
            onClick={handleVerify}
            className="ml-auto text-xs px-3 py-1 rounded font-medium text-white"
            style={{ backgroundColor: '#16A34A' }}
          >
            Verificar ahora
          </button>
        </div>
      )}

      {/* Flow progress indicator */}
      {flowState !== 'Con errores' && (
        <div className="shrink-0 flex items-center gap-0 px-4 py-2 bg-white border-b border-gray-100 overflow-x-auto">
          {(['Verificado', 'Pendiente aprobación', 'Aprobado', 'Contabilizado'] as LoteEstado[]).map((s, idx) => {
            const states: LoteEstado[] = ['Verificado', 'Pendiente aprobación', 'Aprobado', 'Contabilizado'];
            const currentIdx = states.indexOf(flowState);
            const stepIdx = states.indexOf(s);
            const isDone = stepIdx <= currentIdx;
            const isCurrent = stepIdx === currentIdx;
            return (
              <div key={s} className="flex items-center shrink-0">
                <div className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-medium ${
                  isDone ? (isCurrent ? 'text-white' : 'text-green-700') : 'text-gray-400'
                }`}
                  style={isCurrent ? { backgroundColor: '#0073C0' } : {}}>
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs ${
                    isDone ? (isCurrent ? 'bg-white/30 text-white' : 'bg-green-100 text-green-700') : 'bg-gray-100 text-gray-400'
                  }`}>
                    {isDone && !isCurrent ? '✓' : idx + 1}
                  </span>
                  {s}
                </div>
                {idx < 3 && <span className="text-gray-300 mx-1">→</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-auto table-fixed-header">
          <table className="w-full text-xs border-collapse min-w-max">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-8">#</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-24">Cuenta</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-48">Nombre cuenta</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-28">NIT</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-48">Tercero</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-24">Centro</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-24">Comprobante</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 w-28">Documento</th>
                <th className="px-2 py-2 text-right font-semibold text-gray-600 border-b border-gray-200 w-28">Débito</th>
                <th className="px-2 py-2 text-right font-semibold text-gray-600 border-b border-gray-200 w-28">Crédito</th>
                <th className="px-2 py-2 text-left font-semibold text-gray-600 border-b border-gray-200 min-w-36">Concepto</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const hasError = line.errores.length > 0;
                const isEditingTercero = editingCell?.lineId === line.id && editingCell.field === 'tercero';
                const isEditingCentro = editingCell?.lineId === line.id && editingCell.field === 'centro';
                return (
                  <tr
                    key={line.id}
                    ref={el => { rowRefs.current[line.id] = el; }}
                    className={`border-b border-gray-100 hoverable ${hasError ? 'row-error' : ''}`}
                  >
                    <td className="px-2 py-1.5 text-gray-400">{idx + 1}</td>
                    <td className="px-2 py-1.5 font-mono text-gray-700">{line.cuenta}</td>
                    <td className="px-2 py-1.5 text-gray-600 max-w-48 truncate">{line.nombreCuenta}</td>
                    <td className="px-2 py-1.5 font-mono text-gray-600">{line.nit || <span className="text-gray-300">—</span>}</td>
                    <td
                      className={`px-2 py-1.5 relative ${
                        line.errores.some(e => e.includes('tercero')) ? 'bg-red-50' : ''
                      }`}
                    >
                      {isEditingTercero && !bloqueado ? (
                        <div className="relative z-10">
                          <select
                            autoFocus
                            className="w-full border border-blue-400 rounded text-xs p-1 bg-white"
                            defaultValue=""
                            onChange={e => e.target.value && fixLine(line.id, 'tercero', e.target.value)}
                            onBlur={() => setEditingCell(null)}
                          >
                            <option value="" disabled>Seleccione tercero...</option>
                            {TERCEROS.filter(t => t.estado === 'Activo').map(t => (
                              <option key={t.nit} value={t.nombre}>{t.nombre}</option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <div
                          className={`flex items-center gap-1 cursor-pointer ${line.errores.some(e => e.includes('tercero')) ? 'group' : ''}`}
                          onClick={() => !bloqueado && line.errores.some(e => e.includes('tercero')) && setEditingCell({ lineId: line.id, field: 'tercero' })}
                        >
                          {line.tercero ? (
                            <span className="text-gray-700 text-xs truncate max-w-40">{line.tercero}</span>
                          ) : (
                            <span className="text-red-400 text-xs font-medium flex items-center gap-1">
                              ⚠ Requerido
                              {!bloqueado && <span className="text-blue-500 underline ml-1">→ clic para editar</span>}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td
                      className={`px-2 py-1.5 relative ${
                        line.errores.some(e => e.includes('centro')) ? 'bg-red-50' : ''
                      }`}
                    >
                      {isEditingCentro && !bloqueado ? (
                        <select
                          autoFocus
                          className="w-full border border-blue-400 rounded text-xs p-1 bg-white"
                          defaultValue=""
                          onChange={e => e.target.value && fixLine(line.id, 'centro', e.target.value)}
                          onBlur={() => setEditingCell(null)}
                        >
                          <option value="" disabled>Seleccione centro...</option>
                          {CENTROS.map(c => (
                            <option key={c.codigo} value={c.codigo}>{c.codigo} — {c.nombre}</option>
                          ))}
                        </select>
                      ) : (
                        <div
                          className="flex items-center gap-1 cursor-pointer"
                          onClick={() => !bloqueado && line.errores.some(e => e.includes('centro')) && setEditingCell({ lineId: line.id, field: 'centro' })}
                        >
                          {line.centro ? (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              line.centro === 'ADM' ? 'bg-blue-50 text-blue-700' :
                              line.centro === 'VEN' ? 'bg-green-50 text-green-700' :
                              'bg-amber-50 text-amber-700'
                            }`}>{line.centro}</span>
                          ) : (
                            <span className="text-red-400 text-xs font-medium flex items-center gap-1">
                              ⚠ Requerido
                              {!bloqueado && <span className="text-blue-500 underline ml-1">→ clic</span>}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-1.5 font-mono text-gray-500 text-xs">{line.comprobante}</td>
                    <td className="px-2 py-1.5 font-mono text-gray-500 text-xs">{line.documento}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-gray-800">
                      {line.debito > 0 ? fmtCOP(line.debito) : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-gray-500">
                      {line.credito > 0 ? fmtCOP(line.credito) : <span className="text-gray-200">—</span>}
                    </td>
                    <td className="px-2 py-1.5 text-gray-500 max-w-48 truncate">{line.concepto}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals bar */}
        <div className="shrink-0 border-t-2 bg-gray-50 flex items-center gap-6 px-4 py-2.5">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-500">Totales:</span>
            <span className="font-mono font-semibold text-gray-800">{fmtCOP(totalDebit)}</span>
            <span className="text-gray-400">débito</span>
            <span className="text-gray-300">|</span>
            <span className="font-mono font-semibold text-gray-800">{fmtCOP(totalCredit)}</span>
            <span className="text-gray-400">crédito</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Diferencia:</span>
            <span className={`text-xs font-mono font-bold ${diff === 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmtCOP(Math.abs(diff))}
            </span>
          </div>
          <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
            totalErrors > 0 ? 'bg-red-100 text-red-700' :
            isBalanced ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {totalErrors > 0 ? `⚠ ${totalErrors} error${totalErrors !== 1 ? 'es' : ''}` :
             isBalanced ? '✓ Cuadrado' : '✗ Descuadrado'}
          </div>
          <div className="flex-1" />
          {!isPosted && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigateToMensual()}
                className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-100"
              >
                Ir a consulta mensual
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showApproveModal && canSendApproval && (
        <ApproveModal
          title="Enviar a aprobación"
          message="El lote NOM2 será enviado para aprobación del contador principal. ¿Confirma esta acción?"
          onConfirm={confirmSendApproval}
          onCancel={() => setShowApproveModal(false)}
        />
      )}
      {showApproveModal && canApprove && (
        <ApproveModal
          title="Aprobar lote"
          message="Al aprobar el lote quedará listo para contabilización. Esta acción queda registrada en la bitácora con su usuario y hora. ¿Confirma la aprobación?"
          onConfirm={confirmApprove}
          onCancel={() => setShowApproveModal(false)}
        />
      )}
      {showPostModal && (
        <ApproveModal
          title="Confirmar contabilización"
          message="Se contabilizarán 12 líneas del lote NOM2 — Nómina febrero 2026. Los movimientos quedarán definitivos en el libro mayor. ¿Desea continuar?"
          onConfirm={confirmPost}
          onCancel={() => setShowPostModal(false)}
        />
      )}
      {showPosting && <PostingProgress onDone={onPostingDone} />}
      {showReceipt && (
        <ReceiptModal
          lote={updatedLoteForReceipt}
          onClose={() => setShowReceipt(false)}
          onVerDoc={() => { setShowReceipt(false); onNavigateToDoc(); }}
        />
      )}
      {showAnular && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Anular lote</h3>
            <p className="text-xs text-gray-600 mb-3">El lote {lote.codigo} quedará en estado «Anulado» y no podrá contabilizarse. Esta acción queda registrada en la bitácora.</p>
            <label htmlFor="motivo-anular" className="block text-xs font-medium text-gray-600 mb-1">Motivo de la anulación (obligatorio)</label>
            <textarea id="motivo-anular" autoFocus value={motivoAnular} onChange={e => setMotivoAnular(e.target.value)} rows={3}
              placeholder="Explique por qué anula el lote..."
              className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 mb-1" />
            {motivoAnular.trim().length === 0 && <p className="text-xs text-gray-400">Debe escribir un motivo para poder anular.</p>}
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => { setShowAnular(false); setMotivoAnular(''); }} className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button disabled={motivoAnular.trim().length === 0} onClick={confirmarAnular}
                className="text-xs px-4 py-2 rounded font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#DC2626' }}>
                Anular lote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LotesPage({
  lotes,
  selectedLoteId,
  onUpdateLotes,
  onNavigateToDoc,
  onNavigateToMensual,
}: LotesPageProps) {
  const [view, setView] = useState<LoteView>(selectedLoteId ? 'editor' : 'list');
  const [activeLoteId, setActiveLoteId] = useState<string | null>(selectedLoteId);
  const [filterEstado, setFilterEstado] = useState<string>('');
  const [filterSearch, setFilterSearch] = useState('');
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [showNuevo, setShowNuevo] = useState(false);
  const [formNuevo, setFormNuevo] = useState({ nombre: '', periodo: '2026-02', origen: 'Manual' });
  const [errorNuevo, setErrorNuevo] = useState('');
  const [showReasign, setShowReasign] = useState<string | null>(null);
  const [usuarioReasign, setUsuarioReasign] = useState('Laura Gómez');
  const [showEliminar, setShowEliminar] = useState<string | null>(null);

  const activeLote = lotes.find(l => l.id === activeLoteId);

  function openLote(id: string) {
    setActiveLoteId(id);
    setView('editor');
  }

  function updateLote(updated: Lote) {
    onUpdateLotes(lotes.map(l => l.id === updated.id ? updated : l));
  }

  function crearLote() {
    const nombre = formNuevo.nombre.trim();
    if (!nombre) {
      setErrorNuevo('El nombre del lote es obligatorio.');
      return;
    }
    const n = lotes.filter(l => l.codigo.startsWith('BOR-')).length + 1;
    const codigo = `BOR-${String(n).padStart(2, '0')}`;
    const fecha = `${formNuevo.periodo}-28`;
    const nuevo: Lote = {
      id: `lote-${Date.now()}`,
      codigo,
      nombre,
      periodo: formNuevo.periodo,
      usuario: USUARIO.nombre,
      origen: formNuevo.origen,
      fecha,
      lineasCount: 1,
      debito: 0,
      credito: 0,
      diferencia: 0,
      erroresCount: 0,
      estado: 'Borrador',
      lineas: [{ id: 'L01', cuenta: '', nombreCuenta: '', nit: '', tercero: '', centro: '', comprobante: '', documento: '', fecha, debito: 0, credito: 0, base: 0, clase: '', docAfectado: '', concepto: '', errores: [] }],
    };
    onUpdateLotes([...lotes, nuevo]);
    setShowNuevo(false);
    setFormNuevo({ nombre: '', periodo: '2026-02', origen: 'Manual' });
    setErrorNuevo('');
    setAviso({ tipo: 'success', texto: `Lote ${codigo} creado en estado Borrador con una línea inicial.` });
    openLote(nuevo.id);
  }

  function exportarCSV() {
    const filas = filtered.map(l => [l.codigo, l.nombre, l.periodo, l.usuario, l.origen, String(l.lineasCount), String(l.debito), String(l.credito), String(l.diferencia), String(l.erroresCount), l.estado].join(';'));
    const csv = ['Código;Nombre;Período;Usuario;Origen;Líneas;Débito;Crédito;Diferencia;Errores;Estado', ...filas].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'lotes.csv';
    a.click();
    URL.revokeObjectURL(url);
    setAviso({ tipo: 'success', texto: `Lista de lotes exportada a CSV (${filtered.length} lotes).` });
  }

  function confirmarEliminar() {
    if (!showEliminar) return;
    onUpdateLotes(lotes.filter(l => l.id !== showEliminar));
    setAviso({ tipo: 'success', texto: 'Lote borrador eliminado.' });
    setShowEliminar(null);
  }

  function confirmarReasign() {
    if (!showReasign) return;
    onUpdateLotes(lotes.map(l => l.id === showReasign ? { ...l, usuario: usuarioReasign } : l));
    setAviso({ tipo: 'success', texto: 'Usuario del lote reasignado.' });
    setShowReasign(null);
  }

  const filtered = lotes.filter(l => {
    if (filterEstado && l.estado !== filterEstado) return false;
    if (filterSearch) {
      const q = filterSearch.toLowerCase();
      return l.codigo.toLowerCase().includes(q) || l.nombre.toLowerCase().includes(q);
    }
    return true;
  });

  if (view === 'editor' && activeLote) {
    return (
      <div className="h-full flex flex-col">
        <LoteEditor
          lote={activeLote}
          onBack={() => setView('list')}
          onUpdateLote={updateLote}
          onNavigateToDoc={onNavigateToDoc}
          onNavigateToMensual={onNavigateToMensual}
        />
      </div>
    );
  }

  const estados = [...new Set(lotes.map(l => l.estado))];

  return (
    <div className="p-4 space-y-4 max-w-screen-2xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="mb-1 text-xs text-gray-400">Movimientos / Lotes</div>
          <h1 className="text-base font-semibold text-gray-800">Lotes</h1>
          <p className="text-xs text-gray-500">Gestión de lotes contables — captura, validación, aprobación y contabilización</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportarCSV} className="text-xs px-3 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">↓ Exportar XLSX</button>
          <button onClick={() => { setErrorNuevo(''); setShowNuevo(true); }} className="text-xs px-3 py-1.5 rounded text-white font-medium" style={{ backgroundColor: '#0073C0' }}>
            + Nuevo lote
          </button>
        </div>
      </div>

      {aviso && (
        <div className={`flex items-center justify-between rounded border px-4 py-2 text-sm ${aviso.tipo === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-800'}`}>
          <span>{aviso.texto}</span>
          <button onClick={() => setAviso(null)} className="text-xs text-gray-400 hover:text-gray-600">×</button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 bg-white p-3 rounded border border-gray-200">
        <input
          type="text"
          placeholder="Buscar lote..."
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 w-48"
        />
        <select
          value={filterEstado}
          onChange={e => setFilterEstado(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1"
        >
          <option value="">Todos los estados</option>
          {estados.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <button onClick={() => window.print()} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">⎙ Imprimir</button>
        <button onClick={exportarCSV} className="text-xs px-2.5 py-1.5 border border-gray-200 rounded text-gray-600 hover:bg-gray-50">↓ Exportar XLSX</button>
      </div>

      {/* Table */}
      <div className="bg-white rounded border border-gray-200 overflow-hidden">
        <div className="table-fixed-header overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Código</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Nombre</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Período</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Usuario</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Origen</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Líneas</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Débito</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Crédito</th>
                <th className="px-3 py-2.5 text-right font-semibold text-gray-600">Diferencia</th>
                <th className="px-3 py-2.5 text-center font-semibold text-gray-600">Errores</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Estado</th>
                <th className="px-3 py-2.5 text-left font-semibold text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(lote => (
                <tr
                  key={lote.id}
                  className={`hoverable cursor-pointer ${lote.erroresCount > 0 ? 'row-error' : ''}`}
                  onClick={() => openLote(lote.id)}
                >
                  <td className="px-3 py-2.5 font-mono font-medium text-gray-800">{lote.codigo}</td>
                  <td className="px-3 py-2.5 text-gray-700 max-w-48 truncate">{lote.nombre}</td>
                  <td className="px-3 py-2.5 text-gray-600 font-mono">{lote.periodo}</td>
                  <td className="px-3 py-2.5 text-gray-600">{lote.usuario}</td>
                  <td className="px-3 py-2.5 text-gray-600">{lote.origen}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-600">{lote.lineasCount}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-800">{fmtCOP(lote.debito)}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-gray-600">{fmtCOP(lote.credito)}</td>
                  <td className={`px-3 py-2.5 text-right font-mono font-semibold ${lote.diferencia === 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {lote.diferencia === 0 ? '—' : fmtCOP(Math.abs(lote.diferencia))}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {lote.erroresCount > 0 ? (
                      <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">{lote.erroresCount}</span>
                    ) : (
                      <span className="text-green-500 text-sm">✓</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5"><EstadoBadge estado={lote.estado} /></td>
                  <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openLote(lote.id)}
                        className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        Abrir
                      </button>
                      <button
                        onClick={() => { setUsuarioReasign(lote.usuario); setShowReasign(lote.id); }}
                        className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
                      >
                        Reasignar
                      </button>
                      {lote.estado === 'Borrador' && (
                        <button
                          onClick={() => setShowEliminar(lote.id)}
                          className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50"
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <span>{filtered.length} lote{filtered.length !== 1 ? 's' : ''}</span>
          <span className="font-mono">
            Total débitos: <strong className="text-gray-700">{fmtCOP(filtered.reduce((s, l) => s + l.debito, 0))}</strong>
          </span>
        </div>
      </div>

      {/* Nuevo lote */}
      {showNuevo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">Nuevo lote</h3>
              <button onClick={() => setShowNuevo(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
            </div>
            <form noValidate onSubmit={e => { e.preventDefault(); crearLote(); }}>
              <div className="p-5 space-y-3">
                <div>
                  <label htmlFor="nuevo-lote-nombre" className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                  <input id="nuevo-lote-nombre" autoFocus className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1"
                    value={formNuevo.nombre} placeholder="Ej. Ajustes febrero 2026"
                    onChange={e => { setFormNuevo({ ...formNuevo, nombre: e.target.value }); setErrorNuevo(''); }} />
                  {errorNuevo && <p className="mt-1 text-xs text-red-600">{errorNuevo}</p>}
                </div>
                <div>
                  <label htmlFor="nuevo-lote-periodo" className="block text-xs font-medium text-gray-600 mb-1">Período</label>
                  <select id="nuevo-lote-periodo" className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1"
                    value={formNuevo.periodo} onChange={e => setFormNuevo({ ...formNuevo, periodo: e.target.value })}>
                    <option value="2026-02">2026-02 — Febrero 2026</option>
                    <option value="2026-01">2026-01 — Enero 2026</option>
                    <option value="2026-03">2026-03 — Marzo 2026</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="nuevo-lote-origen" className="block text-xs font-medium text-gray-600 mb-1">Origen</label>
                  <select id="nuevo-lote-origen" className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1"
                    value={formNuevo.origen} onChange={e => setFormNuevo({ ...formNuevo, origen: e.target.value })}>
                    {['Manual', 'Excel', 'Nómina', 'Importación', 'Plantilla'].map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <p className="text-xs text-gray-400">El lote se creará en estado <strong>Borrador</strong> con una línea inicial en cero (débito/crédito $ 0).</p>
              </div>
              <div className="flex justify-end gap-3 px-5 py-4 border-t border-gray-100">
                <button type="button" onClick={() => setShowNuevo(false)} className="text-xs px-4 py-2 border border-gray-200 rounded text-gray-600">Cancelar</button>
                <button type="submit" className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#0073C0' }}>Crear lote</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reasignar usuario */}
      {showReasign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Reasignar lote</h3>
            <p className="text-xs text-gray-600 mb-3">Seleccione el usuario al que quedará asignado el lote.</p>
            <label htmlFor="reasignar-usuario" className="block text-xs font-medium text-gray-600 mb-1">Usuario</label>
            <select id="reasignar-usuario" autoFocus className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1"
              value={usuarioReasign} onChange={e => setUsuarioReasign(e.target.value)}>
              {USUARIOS_LOTES.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setShowReasign(null)} className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmarReasign} className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#0073C0' }}>Reasignar</button>
            </div>
          </div>
        </div>
      )}

      {/* Eliminar lote borrador */}
      {showEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">Eliminar lote borrador</h3>
            <p className="text-xs text-gray-600 mb-5">¿Confirma la eliminación del lote {lotes.find(l => l.id === showEliminar)?.codigo} — {lotes.find(l => l.id === showEliminar)?.nombre}? Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowEliminar(null)} className="text-xs px-4 py-2 rounded border border-gray-200 text-gray-600 hover:bg-gray-50">Cancelar</button>
              <button onClick={confirmarEliminar} className="text-xs px-4 py-2 rounded text-white font-medium" style={{ backgroundColor: '#DC2626' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
