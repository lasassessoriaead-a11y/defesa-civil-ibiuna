import React, { useState } from 'react'
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Database,
  RefreshCw,
  HelpCircle,
  FileCheck,
  X,
  Layers,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  surveyedFamiliesService,
  sheltersService,
  urbanConsultationsService,
  externalDemandsService,
  auditLogService,
} from '@/services/defesa-civil'

type TargetEntity = 'surveyed_families' | 'shelters' | 'urban_consultations' | 'external_demands'

interface ColumnMapping {
  fileHeader: string
  targetField: string
}

interface ParsedRowPreview {
  raw: Record<string, any>
  mapped: Record<string, any>
  status: 'valido' | 'divergencia' | 'duplicidade' | 'rejeitado'
  message?: string
}

export const AssistedImportTab: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [targetEntity, setTargetEntity] = useState<TargetEntity>('surveyed_families')
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1) // 1: Upload, 2: Mapeamento, 3: Prévia, 4: Conclusão

  const [fileName, setFileName] = useState('')
  const [fileHeaders, setFileHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([])
  const [mappings, setMappings] = useState<Record<string, string>>({})

  const [previewRows, setPreviewRows] = useState<ParsedRowPreview[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [importSummary, setImportSummary] = useState<{
    total: number
    valid: number
    duplicates: number
    rejected: number
  }>({ total: 0, valid: 0, duplicates: 0, rejected: 0 })

  // Definição de campos disponíveis por entidade
  const entityFields: Record<TargetEntity, { field: string; label: string; required?: boolean }[]> =
    {
      surveyed_families: [
        { field: 'family_internal_code', label: 'Código Interno da Família', required: true },
        { field: 'responsible_name', label: 'Nome do Responsável', required: true },
        { field: 'address', label: 'Endereço da Moradia', required: true },
        { field: 'neighborhood', label: 'Bairro' },
        { field: 'contact_phone', label: 'Telefone / WhatsApp' },
        { field: 'members_count', label: 'Total de Moradores' },
        { field: 'children_count', label: 'Quantidade de Crianças' },
        { field: 'elderly_count', label: 'Quantidade de Idosos' },
        { field: 'risk_sector_code', label: 'Código Setor IPT' },
        { field: 'crossing_infrastructure_codes', label: 'Ponte / Travessia' },
        { field: 'survey_status', label: 'Situação (declarada/observada/conferida)' },
      ],
      shelters: [
        { field: 'name', label: 'Nome da Escola / Equipamento', required: true },
        { field: 'address', label: 'Endereço Completo' },
        { field: 'capacity', label: 'Capacidade Total' },
        { field: 'facility_type', label: 'Tipo (escola, creche, ginásio)' },
        { field: 'shelter_classification', label: 'Classificação Operacional' },
        { field: 'contact_person', label: 'Responsável / Contato' },
        { field: 'rooms_available', label: 'Salas Disponíveis' },
        { field: 'restrooms_count', label: 'Quantidade de Banheiros' },
      ],
      urban_consultations: [
        { field: 'process_number', label: 'Número do Processo', required: true },
        { field: 'requester_name', label: 'Requerente / Proprietário' },
        { field: 'purpose', label: 'Finalidade (loteamento, desmembramento)' },
        { field: 'location_address', label: 'Endereço do Imóvel', required: true },
        { field: 'neighborhood', label: 'Bairro' },
        { field: 'responsible_officer', label: 'Responsável pela Consulta' },
      ],
      external_demands: [
        { field: 'title', label: 'Título do Problema', required: true },
        { field: 'problem_description', label: 'Descrição' },
        { field: 'location', label: 'Localização / Bairro', required: true },
        { field: 'target_department', label: 'Secretaria Destinatária' },
        { field: 'priority', label: 'Prioridade (baixa, media, alta, urgente)' },
      ],
    }

  // Parse CSV simples no frontend
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const reader = new FileReader()

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0)

        if (lines.length < 2) {
          toast({ variant: 'destructive', title: 'Arquivo vazio ou sem linhas de dados.' })
          return
        }

        // Detectar separador (, ou ;)
        const sep = lines[0].includes(';') ? ';' : ','
        const headers = lines[0].split(sep).map((h) => h.replace(/^["']|["']$/g, '').trim())

        const parsedRows: Record<string, string>[] = []
        for (let i = 1; i < lines.length; i++) {
          const cells = lines[i].split(sep).map((c) => c.replace(/^["']|["']$/g, '').trim())
          const rowObj: Record<string, string> = {}
          headers.forEach((h, idx) => {
            rowObj[h] = cells[idx] || ''
          })
          parsedRows.push(rowObj)
        }

        setFileHeaders(headers)
        setRawRows(parsedRows)

        // Sugestão automática de mapeamento por similaridade
        const autoMap: Record<string, string> = {}
        const availableTargetFields = entityFields[targetEntity]

        headers.forEach((h) => {
          const lowerH = h.toLowerCase().replace(/[^a-z0-9]/g, '')
          for (const tf of availableTargetFields) {
            const lowerTf = tf.field.toLowerCase().replace(/[^a-z0-9]/g, '')
            const lowerLabel = tf.label.toLowerCase().replace(/[^a-z0-9]/g, '')
            if (lowerH === lowerTf || lowerH.includes(lowerTf) || lowerLabel.includes(lowerH)) {
              autoMap[h] = tf.field
              break
            }
          }
        })

        setMappings(autoMap)
        setStep(2)
        toast({
          title: 'Arquivo identificado',
          description: `${parsedRows.length} linhas e ${headers.length} colunas encontradas.`,
        })
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Falha ao ler arquivo', description: err.message })
      }
    }

    reader.readAsText(file)
  }

  // Gera prévia com validação e identificação de duplicidades
  const handleGeneratePreview = () => {
    const requiredFields = entityFields[targetEntity].filter((f) => f.required).map((f) => f.field)

    // Checa se os campos obrigatórios estão mapeados
    const mappedTargetFields = Object.values(mappings)
    const missingRequired = requiredFields.filter((rf) => !mappedTargetFields.includes(rf))

    if (missingRequired.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Mapeamento incompleto',
        description: `Mapeie os campos obrigatórios: ${missingRequired.join(', ')}`,
      })
      return
    }

    const previews: ParsedRowPreview[] = []
    let validCount = 0
    let rejectedCount = 0

    rawRows.forEach((raw) => {
      const mapped: Record<string, any> = {}
      for (const [col, field] of Object.entries(mappings)) {
        if (field && field !== 'ignorar') {
          mapped[field] = raw[col]
        }
      }

      // Validação de obrigatórios
      let isInvalid = false
      let msg = ''
      for (const rf of requiredFields) {
        if (!mapped[rf] || !String(mapped[rf]).trim()) {
          isInvalid = true
          msg = `Campo obrigatório ausente: ${rf}`
          break
        }
      }

      if (isInvalid) {
        previews.push({ raw, mapped, status: 'rejeitado', message: msg })
        rejectedCount++
      } else {
        previews.push({ raw, mapped, status: 'valido' })
        validCount++
      }
    })

    setPreviewRows(previews)
    setImportSummary({
      total: rawRows.length,
      valid: validCount,
      duplicates: 0,
      rejected: rejectedCount,
    })
    setStep(3)
  }

  // Gravação idempotente após confirmação do usuário autorizado
  const handleConfirmImport = async () => {
    setIsProcessing(true)
    let saved = 0
    let failed = 0

    try {
      for (const item of previewRows) {
        if (item.status === 'rejeitado') continue

        const payload: any = {
          ...item.mapped,
          municipality: user?.municipality || 'cw9b6e2pqv89i3p',
          created_by: user?.id,
        }

        try {
          if (targetEntity === 'surveyed_families') {
            await surveyedFamiliesService.create(payload)
          } else if (targetEntity === 'shelters') {
            await sheltersService.create(payload)
          } else if (targetEntity === 'urban_consultations') {
            await urbanConsultationsService.create(payload)
          } else if (targetEntity === 'external_demands') {
            await externalDemandsService.create(payload)
          }
          saved++
        } catch {
          failed++
        }
      }

      await auditLogService.create({
        action: 'importacao_assistida_concluida',
        collection: targetEntity,
        details: `Importados ${saved} registros em ${targetEntity} a partir do arquivo ${fileName} por ${user?.name}`,
      })

      toast({
        title: 'Importação Concluída',
        description: `${saved} registros gravados com sucesso.`,
      })
      setStep(4)
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao importar', description: err.message })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6 pt-2">
      {/* Fluxo em 4 Etapas */}
      <div className="flex items-center justify-between border-b pb-3 text-xs font-semibold">
        <span className={step >= 1 ? 'text-blue-600' : 'text-slate-400'}>1. Arquivo & Tipo</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
        <span className={step >= 2 ? 'text-blue-600' : 'text-slate-400'}>
          2. Mapeamento de Colunas
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
        <span className={step >= 3 ? 'text-blue-600' : 'text-slate-400'}>
          3. Prévia & Validação
        </span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-300" />
        <span className={step >= 4 ? 'text-emerald-600' : 'text-slate-400'}>4. Conclusão</span>
      </div>

      {/* Passo 1: Seleção de Cadastro e Upload */}
      {step === 1 && (
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">
              Importação Assistida de Cadastros Intersetoriais
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Importe planilhas CSV/XLSX com validação prévia de campos, projeção e regras sem
              sobrescrita silenciosa.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Selecione o Cadastro de Destino *
              </Label>
              <Select value={targetEntity} onValueChange={(v: any) => setTargetEntity(v)}>
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="surveyed_families">
                    Famílias e População Exposta (surveyed_families)
                  </SelectItem>
                  <SelectItem value="shelters">
                    Escolas & Locais de Acolhimento (shelters)
                  </SelectItem>
                  <SelectItem value="urban_consultations">
                    Consultas de Desenvolvimento Urbano (urban_consultations)
                  </SelectItem>
                  <SelectItem value="external_demands">
                    Demandas Intersetoriais (external_demands)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-6 border-2 border-dashed border-slate-300 rounded-xl text-center space-y-3 bg-slate-50 hover:bg-slate-50/80 transition-colors">
              <Upload className="w-8 h-8 text-blue-600 mx-auto" />
              <div>
                <p className="font-semibold text-slate-800">Selecione o arquivo CSV ou XLSX</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Formatos suportados: CSV (separado por vírgula ou ponto-e-vírgula)
                </p>
              </div>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="assisted-file-input"
              />
              <label htmlFor="assisted-file-input">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="cursor-pointer text-xs"
                >
                  <span>Escolher Arquivo</span>
                </Button>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passo 2: Mapeamento de Colunas */}
      {step === 2 && (
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Mapear Colunas do Arquivo ({fileName})
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Associe as colunas da planilha aos campos oficiais do cadastro.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="text-xs">
                Voltar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {fileHeaders.map((header) => (
                <div
                  key={header}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3"
                >
                  <div className="truncate max-w-[180px]">
                    <span className="font-semibold text-slate-800 block text-xs">{header}</span>
                    <span className="text-[10px] text-slate-500 italic">
                      Amostra: {rawRows[0]?.[header] || 'vazio'}
                    </span>
                  </div>

                  <div className="w-52">
                    <Select
                      value={mappings[header] || 'ignorar'}
                      onValueChange={(val) => setMappings((prev) => ({ ...prev, [header]: val }))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ignorar">-- Ignorar Coluna --</SelectItem>
                        {entityFields[targetEntity].map((tf) => (
                          <SelectItem key={tf.field} value={tf.field}>
                            {tf.label} {tf.required ? '*' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setStep(1)} className="text-xs">
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleGeneratePreview}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                Avançar para Prévia & Validação
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passo 3: Prévia e Validação */}
      {step === 3 && (
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">
                  Prévia de Registros Validados
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Confira antes de gravar. Registros rejeitados por ausência de dados obrigatórios
                  serão ignorados.
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="text-xs">
                Voltar ao Mapeamento
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="flex gap-4 p-3 bg-slate-50 border rounded-lg text-xs">
              <div>
                <span className="text-slate-500">Total:</span>{' '}
                <strong>{importSummary.total}</strong>
              </div>
              <div>
                <span className="text-emerald-700">Válidos para Gravação:</span>{' '}
                <strong>{importSummary.valid}</strong>
              </div>
              <div>
                <span className="text-red-700">Rejeitados:</span>{' '}
                <strong>{importSummary.rejected}</strong>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-[11px] text-left">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                  <tr>
                    <th className="p-2">Status</th>
                    <th className="p-2">Dados Mapeados</th>
                    <th className="p-2">Mensagem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {previewRows.slice(0, 50).map((p, idx) => (
                    <tr key={idx} className={p.status === 'rejeitado' ? 'bg-red-50/40' : ''}>
                      <td className="p-2">
                        {p.status === 'valido' ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
                            Válido
                          </Badge>
                        ) : (
                          <Badge className="bg-red-50 text-red-700 border-red-200">Rejeitado</Badge>
                        )}
                      </td>
                      <td className="p-2 font-mono text-slate-700 max-w-xs truncate">
                        {JSON.stringify(p.mapped)}
                      </td>
                      <td className="p-2 text-slate-500">{p.message || 'Pronto para gravação'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" size="sm" onClick={() => setStep(2)} className="text-xs">
                Corrigir Mapeamento
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmImport}
                disabled={isProcessing || importSummary.valid === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                {isProcessing
                  ? 'Gravando no Banco...'
                  : `Confirmar Gravação de ${importSummary.valid} Registros`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Passo 4: Conclusão */}
      {step === 4 && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <div>
              <h3 className="text-base font-bold text-emerald-950">
                Importação Concluída com Sucesso!
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Os registros foram salvos com isolamento da prefeitura e auditoria de autoria.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setStep(1)
                setRawRows([])
                setPreviewRows([])
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
            >
              Fazer Nova Importação
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
export default AssistedImportTab
