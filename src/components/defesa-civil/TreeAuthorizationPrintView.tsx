import React, { useRef } from 'react'
import { Printer, X, ShieldCheck, TreeDeciduous } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { TreeAuthorization, Municipality } from '@/types/defesa-civil'
import { municipalitiesService } from '@/services/defesa-civil'

interface TreeAuthorizationPrintViewProps {
  authorization: TreeAuthorization | null
  municipality: Municipality | null
  isOpen: boolean
  onClose: () => void
}

export const TreeAuthorizationPrintView: React.FC<TreeAuthorizationPrintViewProps> = ({
  authorization,
  municipality,
  isOpen,
  onClose,
}) => {
  const printContentRef = useRef<HTMLDivElement>(null)

  if (!authorization) return null

  const typeLabels = {
    corte: 'AUTORIZAÇÃO DE CORTE DE ÁRVORE(S)',
    poda: 'AUTORIZAÇÃO DE PODA DRÁSTICA/PREVENTIVA DE ÁRVORE(S)',
    corte_e_poda: 'AUTORIZAÇÃO DE CORTE E PODA DE ÁRVORE(S)',
  }

  const issueDateFormatted = authorization.issue_date
    ? new Date(authorization.issue_date).toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR')

  const expDateFormatted = authorization.expiration_date
    ? new Date(authorization.expiration_date).toLocaleDateString('pt-BR')
    : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')

  const handlePrint = () => {
    const printWindow = window.open('', '_blank', 'width=900,height=1000')
    if (!printWindow) {
      window.print()
      return
    }

    const logoHtml = municipality?.logo
      ? `<img src="${municipalitiesService.getLogoUrl(municipality)}" alt="Brasão" style="height: 65px; object-fit: contain; margin-bottom: 8px;" />`
      : ''

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${authorization.number || 'Autorização'} - Corte e Poda - Defesa Civil</title>
          <style>
            @page {
              size: A4;
              margin: 18mm 18mm 18mm 18mm;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              color: #111;
              line-height: 1.5;
              font-size: 11pt;
              margin: 0;
              padding: 0;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #222;
              padding-bottom: 10px;
              margin-bottom: 16px;
            }
            .header h2 {
              font-size: 12pt;
              margin: 0;
              font-weight: bold;
              text-transform: uppercase;
            }
            .header h3 {
              font-size: 10.5pt;
              margin: 2px 0 0 0;
              color: #333;
            }
            .title-box {
              text-align: center;
              background-color: #f3f4f6;
              border: 1px solid #d1d5db;
              padding: 10px;
              margin: 16px 0;
              border-radius: 4px;
            }
            .title-box h1 {
              font-size: 13pt;
              margin: 0;
              font-weight: bold;
              color: #111827;
            }
            .title-box .num {
              font-size: 12pt;
              font-weight: bold;
              color: #15803d;
              margin-top: 4px;
            }
            .validity-alert {
              border: 1.5px solid #16a34a;
              background-color: #f0fdf4;
              color: #166534;
              padding: 8px 12px;
              border-radius: 4px;
              font-size: 10pt;
              font-weight: bold;
              text-align: center;
              margin-bottom: 16px;
            }
            .grid-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 14px;
            }
            .grid-table td {
              border: 1px solid #e5e7eb;
              padding: 6px 10px;
              font-size: 10pt;
              vertical-align: top;
            }
            .grid-table .label {
              font-weight: bold;
              background-color: #f9fafb;
              width: 25%;
              color: #374151;
            }
            .report-section {
              margin: 16px 0;
            }
            .report-section h4 {
              font-size: 10.5pt;
              font-weight: bold;
              margin: 0 0 6px 0;
              text-transform: uppercase;
              color: #1f2937;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 4px;
            }
            .report-box {
              background-color: #fff;
              border: 1px solid #e5e7eb;
              padding: 10px;
              font-size: 10.5pt;
              line-height: 1.5;
              text-align: justify;
            }
            .signature-area {
              margin-top: 36px;
              display: flex;
              justify-content: space-around;
              page-break-inside: avoid;
            }
            .signature-box {
              text-align: center;
              width: 45%;
            }
            .signature-line {
              border-top: 1px solid #111;
              margin-bottom: 4px;
            }
            .footer {
              margin-top: 30px;
              border-top: 1px solid #ccc;
              padding-top: 6px;
              text-align: center;
              font-size: 8.5pt;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoHtml}
            <h2>${municipality?.doc_header || 'PREFEITURA MUNICIPAL — COORDENADORIA DE DEFESA CIVIL'}</h2>
            <h3>${municipality?.name || 'MUNICÍPIO'} • ${municipality?.city || ''}/${municipality?.state || ''}</h3>
            <p style="margin: 2px 0 0 0; font-size: 9pt; color: #555;">Sistema de Autorizações de Manejo Arbóreo e Mitigação de Risco</p>
          </div>

          <div class="title-box">
            <h1>${typeLabels[authorization.type] || 'AUTORIZAÇÃO DE INTERVENÇÃO ARBÓREA'}</h1>
            <div class="num">NÚMERO OFICIAL: ${authorization.number || '[RASCUNHO / NÃO EMITIDA]'}</div>
          </div>

          <div class="validity-alert">
            PRAZO DE VALIDADE DA AUTORIZAÇÃO: 90 DIAS<br/>
            Emitida em: ${issueDateFormatted} • Válida até: ${expDateFormatted}
          </div>

          <table class="grid-table">
            <tr>
              <td class="label">Requerente:</td>
              <td><strong>${authorization.expand?.requester?.name || 'Não identificado'}</strong> (Doc: ${authorization.expand?.requester?.document || '-'})</td>
            </tr>
            <tr>
              <td class="label">Endereço da Intervenção:</td>
              <td>${authorization.address}${authorization.neighborhood ? ' - Bairro ' + authorization.neighborhood : ''}</td>
            </tr>
            <tr>
              <td class="label">Quantidade de Árvores:</td>
              <td><strong>${authorization.tree_quantity} árvore(s)</strong> ${authorization.tree_species ? ' | Espécie(s): ' + authorization.tree_species : ''}</td>
            </tr>
            <tr>
              <td class="label">Motivo de Risco:</td>
              <td>${authorization.risk_reason || 'Risco iminente de queda ou sinistro avaliado pela vistoria'}</td>
            </tr>
            ${
              authorization.compensatory_measures
                ? `<tr>
              <td class="label">Medidas Compensatórias:</td>
              <td>${authorization.compensatory_measures}</td>
            </tr>`
                : ''
            }
          </table>

          <div class="report-section">
            <h4>Laudo e Parecer Técnico Conclusivo</h4>
            <div class="report-box">
              ${authorization.technical_report}
            </div>
          </div>

          <div style="font-size: 9pt; color: #555; margin-top: 10px;">
            * A execução dos serviços deve observar as normas técnicas de segurança (NR-35 para trabalho em altura e isolamento de tráfego) e destinação ambiental adequada dos resíduos vegetais gerados.
          </div>

          <div class="signature-area">
            <div class="signature-box">
              <div class="signature-line"></div>
              <div style="font-weight: bold; font-size: 10pt;">
                ${authorization.authorized_by_name || authorization.expand?.authorized_by?.name || 'Responsável Designado'}
              </div>
              <div style="font-size: 9pt; color: #444;">
                ${authorization.authorized_by_role || 'Emissor Autorizado pela Coordenadoria'}
              </div>
            </div>
            <div class="signature-box">
              <div class="signature-line"></div>
              <div style="font-weight: bold; font-size: 10pt;">
                ${authorization.expand?.requester?.name || 'Requerente / Proprietário'}
              </div>
              <div style="font-size: 9pt; color: #444;">Ciente e Responsável pela Execução</div>
            </div>
          </div>

          <div class="footer">
            ${municipality?.doc_footer || 'Defesa Civil Municipal — Atendimento de Emergência 199'}
            <div>Documento autêntico com numeração única no banco de dados municipal. Válido por 90 dias a contar da data de emissão.</div>
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
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 border-b bg-slate-50 flex flex-row items-center justify-between">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <TreeDeciduous className="w-5 h-5 text-emerald-600" />
              Visualização e Impressão de Autorização de Corte/Poda
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Documento oficial regulamentar com prazo de validade de 90 dias
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Pré-visualização na tela */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
          <div
            ref={printContentRef}
            className="w-full max-w-[750px] bg-white shadow-md border rounded p-8 text-slate-900 leading-relaxed text-sm min-h-[850px] flex flex-col justify-between"
          >
            <div>
              {/* Header */}
              <div className="text-center border-b-2 border-slate-900 pb-3 mb-4">
                {logoUrl && (
                  <div className="flex justify-center mb-2">
                    <img src={logoUrl} alt="Brasão" className="h-14 object-contain" />
                  </div>
                )}
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-950">
                  {municipality?.doc_header ||
                    'PREFEITURA MUNICIPAL — COORDENADORIA DE DEFESA CIVIL'}
                </h2>
                <h3 className="text-xs font-semibold uppercase text-slate-700 mt-0.5">
                  {municipality?.name || 'MUNICÍPIO'} • {municipality?.city || ''}/
                  {municipality?.state || ''}
                </h3>
              </div>

              {/* Título e Número */}
              <div className="bg-slate-50 border border-slate-200 rounded p-3 text-center mb-4">
                <div className="font-bold text-base text-slate-900">
                  {typeLabels[authorization.type] || 'AUTORIZAÇÃO DE INTERVENÇÃO ARBÓREA'}
                </div>
                <div className="text-emerald-700 font-extrabold text-base tracking-wide mt-1">
                  Nº {authorization.number || '[RASCUNHO - NÃO EMITIDA]'}
                </div>
              </div>

              {/* Alerta de Validade de 90 dias */}
              <div className="bg-emerald-50 border border-emerald-300 rounded p-2.5 text-center text-xs text-emerald-900 font-medium mb-4 flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  <strong>PRAZO DE VALIDADE: 90 DIAS</strong> (Emitida: {issueDateFormatted} • Vence
                  em: {expDateFormatted})
                </span>
              </div>

              {/* Tabela de dados */}
              <div className="border border-slate-200 rounded overflow-hidden mb-4 text-xs divide-y divide-slate-200">
                <div className="grid grid-cols-4 p-2 bg-slate-50">
                  <div className="font-semibold text-slate-600">Requerente:</div>
                  <div className="col-span-3 font-bold text-slate-900">
                    {authorization.expand?.requester?.name || 'Não informado'}
                    {authorization.expand?.requester?.document &&
                      ` (Doc: ${authorization.expand.requester.document})`}
                  </div>
                </div>
                <div className="grid grid-cols-4 p-2">
                  <div className="font-semibold text-slate-600">Endereço do Local:</div>
                  <div className="col-span-3 text-slate-800">
                    {authorization.address}
                    {authorization.neighborhood && ` - Bairro: ${authorization.neighborhood}`}
                  </div>
                </div>
                <div className="grid grid-cols-4 p-2 bg-slate-50">
                  <div className="font-semibold text-slate-600">Intervenção / Quantidade:</div>
                  <div className="col-span-3 font-semibold text-slate-900">
                    {authorization.tree_quantity} exemplar(es) de árvore
                    {authorization.tree_species && ` (${authorization.tree_species})`}
                  </div>
                </div>
                <div className="grid grid-cols-4 p-2">
                  <div className="font-semibold text-slate-600">Motivo / Risco:</div>
                  <div className="col-span-3 text-slate-800">
                    {authorization.risk_reason ||
                      'Risco de queda ou avarias em conformidade com vistoria'}
                  </div>
                </div>
                {authorization.compensatory_measures && (
                  <div className="grid grid-cols-4 p-2 bg-slate-50">
                    <div className="font-semibold text-slate-600">Compensação Ambiental:</div>
                    <div className="col-span-3 text-emerald-800 font-medium">
                      {authorization.compensatory_measures}
                    </div>
                  </div>
                )}
              </div>

              {/* Parecer Técnico */}
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1 mb-2">
                  Laudo e Relato Técnico Conclusivo
                </h4>
                <div
                  className="bg-slate-50 border border-slate-200 rounded p-3 text-slate-800 text-xs leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: authorization.technical_report }}
                />
              </div>
            </div>

            {/* Assinatura */}
            <div>
              <div className="grid grid-cols-2 gap-8 text-center pt-8 mt-6">
                <div>
                  <div className="w-48 mx-auto border-t border-slate-700 mb-1" />
                  <div className="text-xs font-bold text-slate-900">
                    {authorization.authorized_by_name ||
                      authorization.expand?.authorized_by?.name ||
                      'Emissor Designado'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {authorization.authorized_by_role || 'Emissor Autorizado pela Defesa Civil'}
                  </div>
                </div>
                <div>
                  <div className="w-48 mx-auto border-t border-slate-700 mb-1" />
                  <div className="text-xs font-bold text-slate-900">
                    {authorization.expand?.requester?.name || 'Requerente / Proprietário'}
                  </div>
                  <div className="text-[10px] text-slate-500">Ciente da Execução e Validade</div>
                </div>
              </div>

              <div className="mt-8 pt-3 border-t border-slate-200 text-center text-[10px] text-slate-500">
                {municipality?.doc_footer ||
                  'Defesa Civil Municipal — Atendimento de Emergência 199'}
                <div className="text-slate-400 mt-0.5">
                  Autorização vinculada ao cadastro municipal de requerentes com trava de 90 dias de
                  vigência.
                </div>
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
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
          >
            <Printer className="w-4 h-4" /> Imprimir Autorização (PDF)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
