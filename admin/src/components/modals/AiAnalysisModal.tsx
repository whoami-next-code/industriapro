import { useState, useEffect } from 'react';
import Modal from './Modal';
import { apiFetch } from '@/lib/api';
import { ClipboardDocumentCheckIcon, SparklesIcon } from '@heroicons/react/24/outline';

interface Contacto {
  id: number;
  nombre: string;
  email: string;
  mensaje: string;
}

interface AiAnalysisResult {
  categoria: string;
  prioridad: string;
  respuestaSugerida: string;
  analisis: string;
}

interface AiAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  contacto: Contacto | null;
  onUseSuggestion?: (text: string) => void;
}

export default function AiAnalysisModal({ isOpen, onClose, contacto, onUseSuggestion }: AiAnalysisModalProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiAnalysisResult | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && contacto) {
      analizarContacto();
    } else {
      setResult(null);
      setRespuesta('');
      setError(null);
    }
  }, [isOpen, contacto]);

  const analizarContacto = async () => {
    if (!contacto) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<AiAnalysisResult>('/ai/analizar-contacto', {
        method: 'POST',
        body: JSON.stringify({
          nombre: contacto.nombre,
          mensaje: contacto.mensaje,
          email: contacto.email,
        }),
      });
      setResult(data);
      setRespuesta(data.respuestaSugerida);
    } catch (error) {
      const msg =
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo obtener el análisis de IA.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const copiarRespuesta = () => {
    if (!respuesta.trim()) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(respuesta);
      alert('Respuesta copiada al portapapeles');
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = respuesta;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    alert('Respuesta copiada al portapapeles');
  };

  if (!contacto) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Análisis de IA" size="lg">
      <div className="space-y-6">
        {/* Header del Contacto */}
        <div className="sp-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm sp-muted">Analizando mensaje de:</p>
              <p className="font-medium">{contacto.nombre} ({contacto.email})</p>
            </div>
            <span className="sp-badge sp-badge--accent">IA Activa</span>
          </div>
          <p className="mt-2 text-sm sp-muted italic">"{contacto.mensaje}"</p>
        </div>

        <div className="sp-panel">
          <div className="text-xs sp-muted uppercase tracking-wider">Función del agente IA</div>
          <div className="mt-1 text-sm">
            Clasifica el mensaje, asigna prioridad y sugiere una respuesta para acelerar la atención al cliente.
          </div>
          <div className="mt-2 text-xs sp-muted">
            Implementación: Enero 2026 · Estado: Piloto en administración.
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <SparklesIcon className="w-12 h-12 text-indigo-500 animate-pulse" />
            <p className="sp-muted">La IA está analizando el contenido...</p>
          </div>
        ) : error ? (
          <div className="sp-panel">
            <div className="text-sm text-rose-600">{error}</div>
            <div className="mt-3 flex gap-2">
              <button className="sp-button sp-button-outline" onClick={analizarContacto}>
                Reintentar
              </button>
              <button className="sp-button sp-button-ghost" onClick={onClose}>
                Cerrar
              </button>
            </div>
          </div>
        ) : result ? (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Badges de Clasificación */}
            <div className="flex space-x-4">
              <div className="flex-1 p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border)]">
                <span className="text-xs sp-muted uppercase font-bold tracking-wider">Categoría</span>
                <p className="text-lg font-semibold text-[var(--brand-primary)]">{result.categoria}</p>
              </div>
              <div className="flex-1 p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border)]">
                <span className="text-xs sp-muted uppercase font-bold tracking-wider">Prioridad</span>
                <p className="text-lg font-semibold text-[var(--brand-accent)]">{result.prioridad}</p>
              </div>
            </div>

            {/* Explicación */}
            <div>
              <h4 className="text-sm font-medium mb-1">Análisis</h4>
              <p className="text-sm sp-muted">{result.analisis}</p>
            </div>

            {/* Respuesta Sugerida */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium">Respuesta Sugerida</h4>
                <div className="flex items-center gap-2">
                  {onUseSuggestion && (
                    <button
                      onClick={() => onUseSuggestion(respuesta)}
                      className="sp-button sp-button-primary text-xs"
                      disabled={!respuesta.trim()}
                    >
                      Usar respuesta
                    </button>
                  )}
                  <button
                    onClick={copiarRespuesta}
                    className="text-xs flex items-center text-indigo-600 hover:text-indigo-800"
                  >
                    <ClipboardDocumentCheckIcon className="w-4 h-4 mr-1" />
                    Copiar
                  </button>
                </div>
              </div>
              <textarea
                className="sp-textarea font-mono"
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-8 sp-muted">
            No se pudo obtener el análisis.
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-[var(--border)]">
          <button
            onClick={onClose}
            className="sp-button sp-button-secondary"
          >
            Cerrar
          </button>
        </div>
      </div>
    </Modal>
  );
}
