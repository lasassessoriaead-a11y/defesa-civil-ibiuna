import React, { useRef } from 'react'
import { Printer, X, MapPin, AlertTriangle, FileText, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Occurrence, Municipality, OccurrenceFile } from '@/types/defesa-civil'
import {
  TYPE_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  ORIGIN_LABELS,
  LOCATION_ORIGIN_LABELS,
} from '@/components/defesa-civil/StatusBadges'
import { municipalitiesService } from '@/services/defesa-civil'
import pb from '@/lib/pocketbase/client'

interface OccurrencePrintViewProps {
  occurrence: Occurrence | null
  municipality: Municipality | null
  files?: OccurrenceFile[]
  isOpen: boolean
  onClose: () => void
}

export const OccurrencePrintView: React.FC<OccurrencePrintViewProps> = ({
  occurrence,
  municipality,
  files = [],
  isOpen,
  onClose,
}) => {
  const printContentRef = useRef<HTMLDivElement>(null)

  if (!occurrence) return null

  const hasCoords =
    occurrence.latitude !== undefined &&
    occurrence.latitude !== null &&
    occurrence.longitude !== undefined &&
    occurrence.longitude !== null

  const hasAddress = !!(
    occurrence.address?.trim() ||
    occurrence.street?.trim() ||
    occurrence.neighborhood?.trim() ||
    occurrence.city?.trim()
  )

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=950,height=1000')
    if (!printWindow) {
      window.print()
      return
    }

    const logoHtml = municipality?.logo
      ? `<img src="${municipalitiesService.getLogoUrl(municipality)}" alt="Brasão" style="height: 60px; object-fit: contain; margin-bottom: 8px;" />`
      : ''

    const originLabel = occurrence.location_origin
      ? LOCATION_ORIGIN_LABELS[occurrence.location_origin] || occurrence.location_origin
      : 'Não informada'

    const coordsDisplay = hasCoords
      ? `${occurrence.latitude!.toFixed(6)}, ${occurrence.longitude!.toFixed(6)}${
          occurrence.location_accuracy
            ? ` (Precisão estimada: ±${occurrence.location_accuracy}m)`
            : ''
        }`
      : 'Coordenadas não informadas'

    const addressDisplay = hasAddress
      ? [
          occurrence.street
            ? `${occurrence.street}${occurrence.number ? ', ' + occurrence.number : ''}`
            : '',
          occurrence.neighborhood ? `Bairro: ${occurrence.neighborhood}` : '',
          occurrence.city
            ? `${occurrence.city}${occurrence.state ? ' - ' + occurrence.state : ''}`
            : '',
          occurrence.postal_code ? `CEP: ${occurrence.postal_code}` : '',
        ]
          .filter(Boolean)
          .join(' • ') ||
        occurrence.address ||
        'Endereço não informado'
      : 'Endereço não informado'

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório Oficial de Ocorrência - ${occurrence.code || occurrence.id}</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 18mm 18mm 18mm 18mm;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #111;
              line-height: 1.5;
              font-size: 10.5pt;
              margin: 0;
              padding: 0;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #1e3a8a;
              padding-bottom: 10px;
              margin-bottom: 16px;
            }
            .header h2 {
              font-size: 12pt;
              margin: 0;
              font-weight: bold;
              text-transform: uppercase;
              color: #1e3a8a;
            }
            .header h3 {
              font-size: 10pt;
              margin: 3px 0 0 0;
              color: #333;
              text-transform: uppercase;
            }
            .header p {
              font-size: 8.5pt;
              margin: 2px 0 0 0;
              color: #666;
            }
            .doc-title-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              background: #f1f5f9;
              padding: 8px 12px;
              border-left: 4px solid #1e3a8a;
              margin-bottom: 16px;
            }
            .doc-title-bar .code {
              font-size: 12pt;
              font-weight: bold;
              font-family: monospace;
              color: #0f172a;
            }
            .section {
              margin-bottom: 16px;
            }
            .section-title {
              font-size: 10pt;
              font-weight: bold;
              text-transform: uppercase;
              background: #e2e8f0;
              padding: 4px 8px;
              margin-bottom: 8px;
              letter-spacing: 0.5px;
              color: #1e293b;
            }
            .grid-2 {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
            }
            .grid-3 {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 8px;
            }
            .field-box {
              padding: 4px 0;
            }
            .field-label {
              font-size: 8pt;
              color: #64748b;
              text-transform: uppercase;
              font-weight: bold;
            }
            .field-value {
              font-size: 10pt;
              color: #0f172a;
            }
            .location-box {
              border: 1px solid #cbd5e1;
              background: #f8fafc;
              padding: 10px;
              border-radius: 4px;
            }
            .description-box {
              border: 1px solid #e2e8f0;
              background: #fff;
              padding: 10px;
              min-height: 80px;
              white-space: pre-wrap;
              font-size: 10pt;
            }
            .signature-area {
              margin-top: 40px;
              page-break-inside: avoid;
              display: flex;
              justify-content: space-around;
              text-align: center;
            }
            .sig-block {
              width: 250px;
            }
            .sig-line {
              border-top: 1px solid #333;
              margin-bottom: 4px;
            }
            .footer {
              margin-top: 30px;
              border-top: 1px solid #cbd5e1;
              padding-top: 8px;
              text-align: center;
              font-size: 8pt;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoHtml}
            <h2>${municipality?.doc_header || 'PREFEITURA MUNICIPAL — COORDENADORIA DE DEFESA CIVIL'}</h2>
            <h3>${municipality?.name || 'MUNICÍPIO'} • ${municipality?.city || ''}/${municipality?.state || ''}</h3>
            <p>RELATÓRIO OFICIAL DE REGISTRO E ATENDIMENTO DE OCORRÊNCIA</p>
          </div>

          <div class="doc-title-bar">
            <div>
              <span class="code">${occurrence.code || occurrence.id}</span>
              ${occurrence.prov_code ? `<span style="font-size: 9pt; color: #b45309; margin-left: 8px;">(Provisório: ${occurrence.prov_code})</span>` : ''}
            </div>
            <div style="font-size: 9pt; color: #475569;">
              Registrado em: ${new Date(occurrence.created).toLocaleString('pt-BR')}
            </div>
          </div>

          <div class="section">
            <div class="section-title">1. Dados Básicos do Evento</div>
            <div class="grid-2">
              <div class="field-box">
                <div class="field-label">Título da Ocorrência</div>
                <div class="field-value" style="font-weight: bold;">${occurrence.title}</div>
              </div>
              <div class="field-box">
                <div class="field-label">Tipo de Evento Adverso</div>
                <div class="field-value">${TYPE_LABELS[occurrence.type] || occurrence.type}</div>
              </div>
            </div>
            <div class="grid-3" style="margin-top: 6px;">
              <div class="field-box">
                <div class="field-label">Severidade / Nível de Risco</div>
                <div class="field-value">${SEVERITY_LABELS[occurrence.severity] || occurrence.severity}</div>
              </div>
              <div class="field-box">
                <div class="field-label">Situação Atual (Status)</div>
                <div class="field-value">${STATUS_LABELS[occurrence.status] || occurrence.status}</div>
              </div>
              <div class="field-box">
                <div class="field-label">Canal de Origem</div>
                <div class="field-value">${ORIGIN_LABELS[occurrence.origin || '199'] || occurrence.origin}</div>
              </div>
            </div>
            <div class="grid-2" style="margin-top: 6px;">
              <div class="field-box">
                <div class="field-label">População Estimada Afetada</div>
                <div class="field-value">${occurrence.affectable_population || 0} pessoa(s)</div>
              </div>
              <div class="field-box">
                <div class="field-label">Data de Resolução</div>
                <div class="field-value">${occurrence.resolved_at ? new Date(occurrence.resolved_at).toLocaleString('pt-BR') : 'Em aberto'}</div>
              </div>
            </div>
          </div>

          <!-- SEÇÃO OBRIGATÓRIA: LOCALIZAÇÃO DA OCORRÊNCIA -->
          <div class="section">
            <div class="section-title">2. Localização da Ocorrência</div>
            <div class="location-box">
              <div class="grid-2">
                <div class="field-box">
                  <div class="field-label">Endereço Principal / Formatado</div>
                  <div class="field-value" style="font-weight: 600;">${addressDisplay}</div>
                </div>
                <div class="field-box">
                  <div class="field-label">Ponto de Referência</div>
                  <div class="field-value">${occurrence.reference_point || 'Não informado'}</div>
                </div>
              </div>

              <div class="grid-3" style="margin-top: 6px;">
                <div class="field-box">
                  <div class="field-label">Logradouro / Rua</div>
                  <div class="field-value">${occurrence.street || 'Não informado'}</div>
                </div>
                <div class="field-box">
                  <div class="field-label">Número</div>
                  <div class="field-value">${occurrence.number || 'S/N ou Não identificado'}</div>
                </div>
                <div class="field-box">
                  <div class="field-label">Bairro</div>
                  <div class="field-value">${occurrence.neighborhood || 'Não informado'}</div>
                </div>
              </div>

              <div class="grid-3" style="margin-top: 6px;">
                <div class="field-box">
                  <div class="field-label">Município / UF</div>
                  <div class="field-value">${occurrence.city || municipality?.city || 'Não informado'} / ${occurrence.state || municipality?.state || 'UF'}</div>
                </div>
                <div class="field-box">
                  <div class="field-label">CEP</div>
                  <div class="field-value">${occurrence.postal_code || 'Não informado'}</div>
                </div>
                <div class="field-box">
                  <div class="field-label">Complemento</div>
                  <div class="field-value">${occurrence.complement || 'Não informado'}</div>
                </div>
              </div>

              <div class="grid-2" style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #cbd5e1;">
                <div class="field-box">
                  <div class="field-label">Coordenadas Geográficas (Lat/Lng)</div>
                  <div class="field-value" style="font-family: monospace; font-weight: bold;">
                    ${coordsDisplay}
                  </div>
                </div>
                <div class="field-box">
                  <div class="field-label">Origem da Localização</div>
                  <div class="field-value">${originLabel}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">3. Descrição e Relato Operacional de Campo</div>
            <div class="description-box">
              ${occurrence.description ? occurrence.description : 'Nenhum detalhe adicional inserido.'}
            </div>
          </div>

          <div class="section">
            <div class="section-title">4. Requerente e Responsáveis</div>
            <div class="grid-2">
              <div class="field-box">
                <div class="field-label">Requerente / Notificante</div>
                <div class="field-value">
                  ${occurrence.expand?.requester?.name ? `${occurrence.expand.requester.name} (${occurrence.expand.requester.document})` : 'Cidadão Não Identificado / Chamado 199'}
                </div>
              </div>
              <div class="field-box">
                <div class="field-label">Agente Registrante</div>
                <div class="field-value">
                  ${occurrence.expand?.reported_by?.name || occurrence.expand?.reported_by?.email || 'Agente Operacional'}
                </div>
              </div>
            </div>
          </div>

          ${
            files.length > 0
              ? `
            <div class="section">
              <div class="section-title">5. Registro Fotográfico / Documental (${files.length} anexo(s))</div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px;">
                ${files
                  .map((f) => {
                    const isImg = f.file_type === 'foto' || /\.(jpg|jpeg|png|webp)$/i.test(f.file)
                    return isImg
                      ? `<div style="border: 1px solid #cbd5e1; padding: 4px; border-radius: 4px; text-align: center;">
                           <img src="${pb.files.getURL(f, f.file)}" style="max-height: 120px; max-width: 180px; object-fit: cover;" />
                           <div style="font-size: 7.5pt; color: #64748b; margin-top: 2px;">${f.caption || f.file}</div>
                         </div>`
                      : `<div style="border: 1px solid #cbd5e1; padding: 8px; border-radius: 4px; font-size: 8.5pt;">
                           Documento: ${f.caption || f.file}
                         </div>`
                  })
                  .join('')}
              </div>
            </div>
          `
              : ''
          }

          <div class="signature-area">
            <div class="sig-block">
              <div class="sig-line"></div>
              <div style="font-size: 9pt; font-weight: bold;">
                ${occurrence.expand?.reported_by?.name || 'Agente Responsável'}
              </div>
              <div style="font-size: 8pt; color: #64748b;">Defesa Civil Operacional</div>
            </div>
            <div class="sig-block">
              <div class="sig-line"></div>
              <div style="font-size: 9pt; font-weight: bold;">
                Coordenadoria Municipal
              </div>
              <div style="font-size: 8pt; color: #64748b;">${municipality?.name || 'Prefeitura Municipal'}</div>
            </div>
          </div>

          <div class="footer">
            ${municipality?.doc_footer || 'Defesa Civil Municipal — Atendimento de Emergência 199'}
            <div>Relatório emitido pelo Sistema Oficial de Gestão Municipal em ${new Date().toLocaleString('pt-BR')}.</div>
          </div>
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 400)
  }

  const logoUrl = municipality?.logo ? municipalitiesService.getLogoUrl(municipality) : null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white">
        <DialogHeader className="p-4 border-b bg-slate-50 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-800">
              Visualização e Impressão de Ocorrência
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Relatório institucional com seção auditável de localização e endereço para PDF
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-xs"
            >
              <Printer className="w-4 h-4" /> Imprimir Relatório / Salvar PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Pré-visualização do Relatório Oficial */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
          <div
            ref={printContentRef}
            className="w-full max-w-[760px] bg-white shadow-md border rounded p-8 text-slate-900 leading-relaxed text-sm flex flex-col justify-between"
          >
            <div>
              {/* Header Institucional */}
              <div className="text-center border-b-2 border-indigo-900 pb-3 mb-5">
                {logoUrl && (
                  <div className="flex justify-center mb-2">
                    <img src={logoUrl} alt="Brasão" className="h-14 object-contain" />
                  </div>
                )}
                <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-950 font-sans">
                  {municipality?.doc_header ||
                    'PREFEITURA MUNICIPAL — COORDENADORIA DE DEFESA CIVIL'}
                </h2>
                <h3 className="text-xs font-semibold uppercase text-slate-700 font-sans mt-0.5">
                  {municipality?.name || 'MUNICÍPIO'} • {municipality?.city || ''}/
                  {municipality?.state || ''}
                </h3>
                <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                  RELATÓRIO OFICIAL DE REGISTRO E ATENDIMENTO DE OCORRÊNCIA
                </p>
              </div>

              {/* Barra de Título / Código */}
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded border-l-4 border-indigo-700 mb-4">
                <div>
                  <span className="font-mono text-base font-bold text-slate-900">
                    {occurrence.code || occurrence.id}
                  </span>
                  {occurrence.prov_code && (
                    <span className="ml-2 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                      Provisório: {occurrence.prov_code}
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  Data: {new Date(occurrence.created).toLocaleString('pt-BR')}
                </span>
              </div>

              {/* Seção 1: Dados Básicos */}
              <div className="mb-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-1 rounded mb-2">
                  1. Dados Básicos do Evento
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                      Título do Evento
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{occurrence.title}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                      Tipo de Evento
                    </span>
                    <span className="font-medium text-slate-800">
                      {TYPE_LABELS[occurrence.type] || occurrence.type}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                      Severidade
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {SEVERITY_LABELS[occurrence.severity] || occurrence.severity}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                      Status
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {STATUS_LABELS[occurrence.status] || occurrence.status}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Seção 2: LOCALIZAÇÃO DA OCORRÊNCIA */}
              <div className="mb-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-1 rounded mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-600" />
                    2. Localização da Ocorrência
                  </span>
                  {occurrence.address_confirmed && (
                    <span className="text-[10px] text-emerald-700 font-semibold flex items-center gap-1 normal-case">
                      <CheckCircle2 className="w-3 h-3" /> Endereço conferido
                    </span>
                  )}
                </div>

                <div className="bg-slate-50/80 p-3 rounded border border-slate-200 text-xs space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                        Endereço Completo
                      </span>
                      <span className="font-semibold text-slate-900">
                        {occurrence.address || 'Endereço não informado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                        Ponto de Referência
                      </span>
                      <span className="text-slate-800">
                        {occurrence.reference_point || 'Não informado'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/60">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                        Rua / Logradouro
                      </span>
                      <span className="text-slate-800">{occurrence.street || 'Não informado'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                        Número
                      </span>
                      <span className="text-slate-800">
                        {occurrence.number || 'S/N ou Não identificado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                        Bairro
                      </span>
                      <span className="text-slate-800">
                        {occurrence.neighborhood || 'Não informado'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                        Município / UF
                      </span>
                      <span className="text-slate-800">
                        {occurrence.city || municipality?.city || 'Não informado'} /{' '}
                        {occurrence.state || municipality?.state || 'UF'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                        CEP
                      </span>
                      <span className="text-slate-800">
                        {occurrence.postal_code || 'Não informado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                        Complemento
                      </span>
                      <span className="text-slate-800">
                        {occurrence.complement || 'Não informado'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed border-slate-200">
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                        Coordenadas Geográficas (Lat/Lng)
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {hasCoords
                          ? `${occurrence.latitude!.toFixed(6)}, ${occurrence.longitude!.toFixed(6)}`
                          : 'Coordenadas não informadas'}
                      </span>
                      {occurrence.location_accuracy && (
                        <span className="text-[10px] text-slate-500 ml-1">
                          (±{occurrence.location_accuracy}m)
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                        Origem da Localização
                      </span>
                      <span className="font-medium text-slate-800">
                        {occurrence.location_origin
                          ? LOCATION_ORIGIN_LABELS[occurrence.location_origin] ||
                            occurrence.location_origin
                          : 'Não especificada'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Seção 3: Descrição */}
              <div className="mb-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-1 rounded mb-2">
                  3. Descrição e Relato Operacional
                </div>
                <div className="p-3 bg-white border rounded text-xs text-slate-800 min-h-[60px] whitespace-pre-wrap">
                  {occurrence.description || 'Nenhum detalhe adicional informado.'}
                </div>
              </div>

              {/* Seção 4: Requerente */}
              <div className="mb-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-1 rounded mb-2">
                  4. Envolvidos e Responsáveis
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                      Requerente / Notificante
                    </span>
                    <span className="font-medium text-slate-800">
                      {occurrence.expand?.requester?.name
                        ? `${occurrence.expand.requester.name} (${occurrence.expand.requester.document})`
                        : 'Chamado 199 / Cidadão Não Identificado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] uppercase font-semibold block">
                      Agente Registrante
                    </span>
                    <span className="font-medium text-slate-800">
                      {occurrence.expand?.reported_by?.name ||
                        occurrence.expand?.reported_by?.email ||
                        'Agente Operacional'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Assinaturas */}
            <div className="mt-8 pt-4 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-8 text-center">
                <div>
                  <div className="w-48 mx-auto border-t border-slate-700 mb-1" />
                  <div className="text-xs font-bold text-slate-900">
                    {occurrence.expand?.reported_by?.name || 'Agente de Campo'}
                  </div>
                  <div className="text-[10px] text-slate-500">Defesa Civil Operacional</div>
                </div>
                <div>
                  <div className="w-48 mx-auto border-t border-slate-700 mb-1" />
                  <div className="text-xs font-bold text-slate-900">Coordenadoria Municipal</div>
                  <div className="text-[10px] text-slate-500">{municipality?.name}</div>
                </div>
              </div>

              <div className="mt-6 text-center text-[10px] text-slate-400">
                {municipality?.doc_footer ||
                  'Defesa Civil Municipal — Atendimento de Emergência 199'}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 border-t bg-slate-50 flex justify-between items-center sm:justify-between">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> Fechar
          </Button>
          <Button
            onClick={handlePrint}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
          >
            <Printer className="w-4 h-4" /> Imprimir Documento (PDF)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
