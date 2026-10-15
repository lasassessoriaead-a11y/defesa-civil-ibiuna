import React, { useRef } from 'react'
import { Printer, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { OfficialDocument, Municipality } from '@/types/defesa-civil'
import { municipalitiesService } from '@/services/defesa-civil'

interface OfficialDocumentPrintViewProps {
  document: OfficialDocument | null
  municipality: Municipality | null
  isOpen: boolean
  onClose: () => void
}

export const OfficialDocumentPrintView: React.FC<OfficialDocumentPrintViewProps> = ({
  document,
  municipality,
  isOpen,
  onClose,
}) => {
  const printContentRef = useRef<HTMLDivElement>(null)

  if (!document) return null

  const handlePrint = () => {
    const printContent = printContentRef.current
    if (!printContent) return

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
          <title>${document.number || 'Ofício'} - Defesa Civil Municipal</title>
          <style>
            @page {
              size: A4;
              margin: 20mm 20mm 20mm 20mm;
            }
            body {
              font-family: 'Times New Roman', Times, serif;
              color: #111;
              line-height: 1.6;
              font-size: 13pt;
              margin: 0;
              padding: 0;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #222;
              padding-bottom: 12px;
              margin-bottom: 24px;
            }
            .header h2 {
              font-size: 13pt;
              margin: 0;
              font-weight: bold;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .header h3 {
              font-size: 11pt;
              margin: 3px 0 0 0;
              font-weight: bold;
              text-transform: uppercase;
              color: #333;
            }
            .header p {
              font-size: 9.5pt;
              margin: 2px 0 0 0;
              color: #555;
            }
            .doc-number {
              font-size: 13pt;
              font-weight: bold;
              margin: 20px 0;
            }
            .meta-section {
              margin-bottom: 24px;
            }
            .meta-section p {
              margin: 4px 0;
            }
            .recipient-block {
              margin: 20px 0 24px 0;
              line-height: 1.4;
            }
            .subject-block {
              font-weight: bold;
              margin: 20px 0;
            }
            .body-content {
              text-align: justify;
              text-indent: 2.5cm;
              margin-bottom: 30px;
            }
            .body-content p {
              margin-bottom: 14px;
            }
            .body-content ul, .body-content ol {
              text-indent: 0;
              margin-left: 2cm;
            }
            .signature-block {
              margin-top: 50px;
              text-align: center;
              page-break-inside: avoid;
            }
            .signature-line {
              display: inline-block;
              width: 300px;
              border-top: 1px solid #111;
              margin-bottom: 6px;
            }
            .footer {
              margin-top: 40px;
              border-top: 1px solid #ccc;
              padding-top: 8px;
              text-align: center;
              font-size: 9pt;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoHtml}
            <h2>${municipality?.doc_header || 'PREFEITURA MUNICIPAL — COORDENADORIA DE DEFESA CIVIL'}</h2>
            <h3>${municipality?.name || 'MUNICÍPIO'} • ${municipality?.city || ''}/${municipality?.state || ''}</h3>
            <p>Sistema Oficial de Gestão da Defesa Civil Municipal</p>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: baseline;">
            <div class="doc-number">OFÍCIO Nº ${document.number || '[NÃO EMITIDO / RASCUNHO]'}</div>
            <div style="font-size: 11pt; color: #333;">
              ${municipality?.city || 'Localidade'}, ${
                document.issue_date
                  ? new Date(document.issue_date).toLocaleDateString('pt-BR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : new Date().toLocaleDateString('pt-BR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
              }
            </div>
          </div>

          <div class="recipient-block">
            <div><strong>A Sua Senhoria / Ilustríssimo(a) Sr.(a):</strong></div>
            <div style="font-size: 13pt; font-weight: bold;">${document.recipient_name}</div>
            ${document.recipient_role ? `<div>${document.recipient_role}</div>` : ''}
            ${document.recipient_institution ? `<div>${document.recipient_institution}</div>` : ''}
            ${document.recipient_address ? `<div>${document.recipient_address}</div>` : ''}
          </div>

          <div class="subject-block">
            <strong>Assunto:</strong> ${document.subject}
          </div>

          <div class="body-content">
            ${document.content}
          </div>

          <div class="signature-block">
            <div class="signature-line"></div>
            <div style="font-weight: bold; font-size: 12pt;">
              ${document.signatory_name || document.expand?.signatory_user?.name || 'Responsável Técnico / Coordenador'}
            </div>
            <div style="font-size: 10.5pt; color: #444;">
              ${document.signatory_role || 'Coordenadoria Municipal de Defesa Civil'}
            </div>
          </div>

          <div class="footer">
            ${municipality?.doc_footer || 'Defesa Civil Municipal — Atendimento de Emergência 199'}
            <div>Documento autêntico gerado eletronicamente em conformidade com as diretrizes do Sistema Municipal.</div>
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
            <DialogTitle className="text-lg font-bold text-slate-800">
              Visualização e Impressão de Ofício
            </DialogTitle>
            <p className="text-xs text-slate-500">
              Layout institucional formatado para papel A4 e exportação em PDF
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
            >
              <Printer className="w-4 h-4" /> Imprimir / Salvar PDF
            </Button>
          </div>
        </DialogHeader>

        {/* Visualização de Papel A4 */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100 flex justify-center">
          <div
            ref={printContentRef}
            className="w-full max-w-[750px] bg-white shadow-md border rounded p-10 font-serif text-slate-900 leading-relaxed text-base min-h-[900px] flex flex-col justify-between"
          >
            <div>
              {/* Cabeçalho */}
              <div className="text-center border-b-2 border-slate-900 pb-3 mb-6">
                {logoUrl && (
                  <div className="flex justify-center mb-2">
                    <img src={logoUrl} alt="Brasão" className="h-16 object-contain" />
                  </div>
                )}
                <h2 className="text-base font-bold uppercase tracking-wider text-slate-950 font-sans">
                  {municipality?.doc_header ||
                    'PREFEITURA MUNICIPAL — COORDENADORIA DE DEFESA CIVIL'}
                </h2>
                <h3 className="text-sm font-semibold uppercase text-slate-700 font-sans mt-0.5">
                  {municipality?.name || 'MUNICÍPIO'} • {municipality?.city || ''}/
                  {municipality?.state || ''}
                </h3>
                <p className="text-xs text-slate-500 font-sans mt-0.5">
                  Sistema Oficial de Gestão da Defesa Civil Municipal
                </p>
              </div>

              {/* Número e Data */}
              <div className="flex justify-between items-baseline mb-6 font-sans">
                <span className="text-base font-bold text-slate-900">
                  OFÍCIO Nº {document.number || '[RASCUNHO - NÃO EMITIDO]'}
                </span>
                <span className="text-sm text-slate-600">
                  {municipality?.city || 'Localidade'},{' '}
                  {document.issue_date
                    ? new Date(document.issue_date).toLocaleDateString('pt-BR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })
                    : new Date().toLocaleDateString('pt-BR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                </span>
              </div>

              {/* Destinatário */}
              <div className="mb-6 space-y-0.5 text-sm bg-slate-50 p-3 rounded border border-slate-200">
                <div className="text-xs uppercase text-slate-500 font-sans font-semibold">
                  Destinatário:
                </div>
                <div className="text-base font-bold text-slate-900">{document.recipient_name}</div>
                {document.recipient_role && (
                  <div className="text-slate-700">{document.recipient_role}</div>
                )}
                {document.recipient_institution && (
                  <div className="text-slate-700 font-medium">{document.recipient_institution}</div>
                )}
                {document.recipient_address && (
                  <div className="text-slate-600 text-xs">{document.recipient_address}</div>
                )}
              </div>

              {/* Assunto */}
              <div className="mb-6 text-base font-sans font-medium text-slate-900 border-l-4 border-blue-600 pl-3">
                <span className="font-bold">Assunto:</span> {document.subject}
              </div>

              {/* Conteúdo HTML do ofício */}
              <div
                className="text-justify leading-relaxed mb-8 prose prose-slate max-w-none"
                dangerouslySetInnerHTML={{ __html: document.content }}
              />
            </div>

            {/* Bloco de Assinatura e Rodapé */}
            <div>
              <div className="mt-12 text-center">
                <div className="w-64 mx-auto border-t border-slate-800 mb-2" />
                <div className="font-sans font-bold text-sm text-slate-900">
                  {document.signatory_name ||
                    document.expand?.signatory_user?.name ||
                    'Coordenador / Responsável Municipal'}
                </div>
                <div className="font-sans text-xs text-slate-600">
                  {document.signatory_role || 'Coordenadoria Municipal de Defesa Civil'}
                </div>
              </div>

              <div className="mt-10 pt-4 border-t border-slate-200 text-center font-sans text-xs text-slate-500">
                {municipality?.doc_footer ||
                  'Defesa Civil Municipal — Atendimento de Emergência 199'}
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Documento gerado através do Sistema de Gestão da Defesa Civil Municipal
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
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
          >
            <Printer className="w-4 h-4" /> Imprimir Documento (PDF)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
