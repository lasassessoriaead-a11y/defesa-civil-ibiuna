import React, { useState, useEffect } from 'react'
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Layers,
  Database,
  ShieldAlert,
  ArrowRight,
  Eye,
  FileCheck,
  Building,
  Info,
  Globe2,
  Download,
} from 'lucide-react'
import {
  geoOfficialImporterService,
  OFFICIAL_GEO_FILES,
  type ImportProgress,
  type FileImportResult,
} from '@/services/geo-official-importer-service'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  parseRiskExcelFile,
  type ParseResultSummary,
  type ParsedRiskRow,
} from '@/services/xlsx-parser-service'
import { IptGeoJsonPanel } from '@/components/defesa-civil/IptGeoJsonPanel'
import { AssistedImportTab } from '@/components/defesa-civil/AssistedImportTab'
import {
  riskSectorsService,
  dangerStretchesService,
  geoImportsService,
} from '@/services/defesa-civil'
import type { GeoImportBatch } from '@/types/defesa-civil'

export const RiskImportPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [file, setFile] = useState<File | null>(null)
  const [isParsing, setIsParsing] = useState(false)
  const [parseResult, setParseResult] = useState<ParseResultSummary | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)
  const [importStatusText, setImportStatusText] = useState('')
  const [importCompleted, setImportCompleted] = useState(false)
  const [importBatches, setImportBatches] = useState<GeoImportBatch[]>([])
  const [isLoadingBatches, setIsLoadingBatches] = useState(false)
  const [activeImportSection, setActiveImportSection] = useState<
    'ipt_geojson' | 'xlsx' | 'official_gpkg' | 'assisted_multiformat'
  >('ipt_geojson')
  const [filterTab, setFilterTab] = useState<
    'all' | 'sectors' | 'stretches' | 'totalizers' | 'rejected'
  >('all')

  // Estado do painel de importação dos 14 Arquivos Oficiais GPKG/KMZ
  const [isOfficialGeoImporting, setIsOfficialGeoImporting] = useState(false)
  const [officialGeoProgressList, setOfficialGeoProgressList] = useState<
    Record<string, ImportProgress>
  >({})
  const [officialGeoResults, setOfficialGeoResults] = useState<FileImportResult[]>([])
  const [isPriorityOnly, setIsPriorityOnly] = useState(false)

  const municipalityId = user?.municipality || ''

  const handleImportOfficialGeoFiles = async (priorityOnly = false) => {
    if (!municipalityId) {
      toast({
        variant: 'destructive',
        title: 'Município não identificado',
        description: 'Faça login com um operador associado a Ibiúna para continuar.',
      })
      return
    }

    setIsOfficialGeoImporting(true)
    setIsPriorityOnly(priorityOnly)
    setOfficialGeoResults([])

    try {
      toast({
        title: 'Iniciando Importação dos Arquivos Geográficos',
        description: `Processando os arquivos oficiais de Ibiúna com conversão SIRGAS 2000 -> WGS84 e idempotência.`,
      })

      const results = await geoOfficialImporterService.importAllOfficialFiles(
        municipalityId,
        (progress) => {
          setOfficialGeoProgressList((prev) => ({
            ...prev,
            [progress.fileId]: progress,
          }))
        },
        priorityOnly,
      )

      setOfficialGeoResults(results)
      const successCount = results.filter((r) => r.status === 'sucesso').length
      toast({
        title: 'Processamento Geográfico Concluído',
        description: `${successCount} arquivo(s) importados com sucesso para o banco de dados e mapa.`,
      })
      loadBatches()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro na importação geográfica',
        description: err.message || 'Falha ao processar repositório.',
      })
    } finally {
      setIsOfficialGeoImporting(false)
    }
  }

  // Carregar histórico de auditoria de lotes de importação
  const loadBatches = async () => {
    setIsLoadingBatches(true)
    try {
      const batches = await geoImportsService.list('file_type = "xlsx"', '-created')
      setImportBatches(batches)
    } catch {
      // Ignora erro silencioso se tabela nova
    } finally {
      setIsLoadingBatches(false)
    }
  }

  useEffect(() => {
    loadBatches()
  }, [])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFile(selected)
    setParseResult(null)
    setImportCompleted(false)
    setIsParsing(true)

    try {
      const res = await parseRiskExcelFile(selected)
      setParseResult(res)
      toast({
        title: 'Planilha analisada com sucesso',
        description: `${res.totalDataRecords} registros técnicos identificados (${res.totalRiskSectors} setores e ${res.totalDangerStretches} trechos).`,
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao analisar arquivo',
        description: err.message || 'Verifique se o formato é XLSX válido.',
      })
    } finally {
      setIsParsing(false)
    }
  }

  const handleExecuteImport = async () => {
    if (!parseResult || !municipalityId) {
      toast({
        variant: 'destructive',
        title: 'Operação não permitida',
        description: 'Selecione um município válido e uma planilha pré-analisada.',
      })
      return
    }

    setIsImporting(true)
    setImportProgress(0)
    setImportStatusText('Iniciando gravação idempotente...')

    let savedSectors = 0
    let savedStretches = 0
    let duplicatesSkipped = 0
    let errorsCount = 0

    const total = parseResult.validRecords.length
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

    try {
      for (let i = 0; i < total; i++) {
        const item = parseResult.validRecords[i]

        const payload: any = {
          municipality: municipalityId,
          code: item.code.trim(),
          zone: item.zone || '',
          area_number: item.areaNumber || '',
          area_name: item.areaName || '',
          location: item.location || '',
          process_type: item.processType || '',
          danger_grade: item.dangerGrade || '',
          vulnerability_grade: item.vulnerabilityGrade || '',
          risk_grade: item.riskGrade || '',
          risk_level: item.riskLevel,
          affected_dwellings: item.affectedDwellings,
          affected_residents: item.affectedResidents,
          disaster_history: item.disasterHistory || '',
          description: item.description || '',
          recommendations: item.recommendations || '',
          validation_status: item.isIncomplete ? 'incompleto' : 'aprovado',
          geometry_status: 'ausente',
          import_source: parseResult.fileName,
          import_batch_id: batchId,
          raw_attributes: item.rawRow,
        }

        try {
          if (item.kind === 'sector') {
            payload.sector_number = item.sectorNumber || ''
            payload.plate_number = item.plateNumber || ''
            payload.affected_buildings = item.affectedBuildings
            payload.affected_roads_length = item.affectedRoadsLength
            payload.regional_risk_info = item.regionalRiskInfo || ''
            payload.expected_processes = item.expectedProcesses || ''

            await riskSectorsService.upsertByCode(payload)
            savedSectors++
          } else {
            payload.stretch_number = item.sectorNumber || ''
            payload.affected_roads_length = item.affectedRoadsLength

            await dangerStretchesService.upsertByCode(payload)
            savedStretches++
          }
        } catch (itemErr) {
          errorsCount++
        }

        if (i % 20 === 0 || i === total - 1) {
          const pct = Math.round(((i + 1) / total) * 100)
          setImportProgress(pct)
          setImportStatusText(`Gravando registro ${i + 1} de ${total}...`)
        }
      }

      // Salva lote na auditoria de importação
      await geoImportsService.create({
        municipality: municipalityId,
        filename: parseResult.fileName,
        file_type: 'xlsx',
        imported_by: user?.id,
        total_records: parseResult.totalDataRecords,
        valid_records: savedSectors + savedStretches,
        duplicate_records: parseResult.duplicatesFound,
        incomplete_records: parseResult.validRecords.filter((v) => v.isIncomplete).length,
        rejected_records: parseResult.rejectedRecords.length,
        summary: `Importados ${savedSectors} setores de risco e ${savedStretches} trechos de perigo. Totalizadores: ${parseResult.totalTotalizers}.`,
        rejection_reasons: parseResult.rejectedRecords,
      })

      setImportCompleted(true)
      toast({
        title: 'Importação Concluída com Sucesso',
        description: `${savedSectors} setores e ${savedStretches} trechos gravados com isolamento municipal Ibiúna.`,
      })
      loadBatches()
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Falha durante a importação',
        description: e.message || 'Erro inesperado na gravação.',
      })
    } finally {
      setIsImporting(false)
    }
  }

  const filteredRecords = () => {
    if (!parseResult) return []
    if (filterTab === 'sectors') return parseResult.validRecords.filter((r) => r.kind === 'sector')
    if (filterTab === 'stretches')
      return parseResult.validRecords.filter((r) => r.kind === 'stretch')
    if (filterTab === 'totalizers') return parseResult.totalizers
    return parseResult.validRecords
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Importação de Setores de Risco & Trechos de Perigo
              </h1>
              <p className="text-xs text-slate-500">
                Processamento técnico client-side do levantamento oficial de campo (Sintese 2024)
                com deduplicação idempotente
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="bg-emerald-50 text-emerald-800 border-emerald-200 py-1"
          >
            <Building className="w-3.5 h-3.5 mr-1" />
            Município: Ibiúna - SP
          </Badge>
        </div>
      </div>

      {/* Navegação entre Módulos de Carga Técnica */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveImportSection('ipt_geojson')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeImportSection === 'ipt_geojson'
              ? 'border-emerald-600 text-emerald-800 bg-emerald-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-emerald-600" />
          Vínculo Geográfico IPT (GeoJSON Oficial)
          <Badge className="bg-emerald-600 text-white text-[10px] ml-1">Anexo Bad52</Badge>
        </button>

        <button
          onClick={() => setActiveImportSection('xlsx')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeImportSection === 'xlsx'
              ? 'border-blue-600 text-blue-800 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-blue-600" />
          Planilha Síntese (.xlsx)
        </button>

        <button
          onClick={() => setActiveImportSection('official_gpkg')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeImportSection === 'official_gpkg'
              ? 'border-blue-600 text-blue-800 bg-blue-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Globe2 className="w-4 h-4 text-blue-600" />
          Repositório GPKG / KMZ (14 Arquivos)
        </button>

        <button
          onClick={() => setActiveImportSection('assisted_multiformat')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
            activeImportSection === 'assisted_multiformat'
              ? 'border-purple-600 text-purple-800 bg-purple-50/50'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4 text-purple-600" />
          Importação Assistida Multiformato
          <Badge className="bg-purple-600 text-white text-[10px] ml-1">Secretarias</Badge>
        </button>
      </div>

      {/* SEÇÃO IMPORTAÇÃO ASSISTIDA MULTIFORMATO */}
      {activeImportSection === 'assisted_multiformat' && (
        <React.Suspense
          fallback={
            <div className="p-8 text-center text-xs text-slate-500">
              Carregando módulo assistido...
            </div>
          }
        >
          <AssistedImportTab />
        </React.Suspense>
      )}

      {/* SEÇÃO IPT GEOJSON (FOCO DA TAREFA) */}
      {activeImportSection === 'ipt_geojson' && (
        <IptGeoJsonPanel
          municipalityId={municipalityId}
          userId={user?.id}
          onImportComplete={loadBatches}
        />
      )}

      {/* SEÇÃO GPKG OFICIAL */}
      {activeImportSection === 'official_gpkg' && (
        <Card className="border-blue-200 bg-gradient-to-b from-blue-50/50 to-white shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2 text-blue-950 font-bold">
                  <Globe2 className="w-5 h-5 text-blue-600" />
                  Arquivos Geográficos Oficiais de Ibiúna (14 Arquivos GPKG / KMZ)
                </CardTitle>
                <CardDescription className="text-xs text-slate-600 mt-1">
                  Importação em lote do repositório público oficial com conversão de EPSG:31983 para
                  EPSG:4326, armazenamento em{' '}
                  <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-800">geo_layers</code>
                  , conciliação e renderização no mapa.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleImportOfficialGeoFiles(true)}
                  disabled={isOfficialGeoImporting}
                  className="bg-white hover:bg-blue-50 border-blue-200 text-blue-700 text-xs font-semibold"
                >
                  <Layers className="w-3.5 h-3.5 mr-1" />
                  Importar 4 Camadas Prioritárias
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleImportOfficialGeoFiles(false)}
                  disabled={isOfficialGeoImporting}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm"
                >
                  {isOfficialGeoImporting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                      Processando...
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 mr-1" />
                      Importar Todos os 14 Arquivos
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-slate-50 text-[11px]">
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Finalidade / Descrição</TableHead>
                    <TableHead className="w-24">Tamanho</TableHead>
                    <TableHead className="w-28">Prioridade</TableHead>
                    <TableHead className="w-48">Status / Progresso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="text-xs">
                  {OFFICIAL_GEO_FILES.map((f) => {
                    const progress = officialGeoProgressList[f.id]
                    return (
                      <TableRow key={f.id} className="hover:bg-slate-50/70">
                        <TableCell className="font-semibold text-slate-900 font-mono text-[11px]">
                          {f.filename}
                        </TableCell>
                        <TableCell className="text-slate-600 text-xs">{f.description}</TableCell>
                        <TableCell className="text-slate-500 font-mono text-[11px]">
                          {f.sizeApprox}
                        </TableCell>
                        <TableCell>
                          {f.isPriority ? (
                            <Badge className="bg-amber-500 text-white text-[10px]">
                              Prioritária
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-slate-500 text-[10px]">
                              Contexto
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {!progress ? (
                            <span className="text-slate-400 text-[11px]">Pronto para carga</span>
                          ) : progress.status === 'completed' ? (
                            <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{progress.importedCount || 0} feições gravadas</span>
                            </div>
                          ) : progress.status === 'error' ? (
                            <div className="flex items-center gap-1 text-red-600 text-[11px]">
                              <XCircle className="w-3.5 h-3.5" />
                              <span className="truncate max-w-[140px]" title={progress.error}>
                                {progress.error}
                              </span>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-blue-600 text-[11px]">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span className="truncate max-w-[140px]">
                                  {progress.currentStep}
                                </span>
                              </div>
                              {progress.totalRecords && progress.importedCount ? (
                                <Progress
                                  value={Math.round(
                                    (progress.importedCount / progress.totalRecords) * 100,
                                  )}
                                  className="h-1.5 bg-blue-100"
                                />
                              ) : null}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Observação importante sobre pendências:</strong> O arquivo{' '}
                <code>UTB_Ibiuna_500m_final.gpkg</code> citado pelo usuário não existe no
                repositório GitHub oficial (foi utilizado o arquivo existente correspondente{' '}
                <code>UTB_geometria_corrigida_FINAL.gpkg</code>). As 956 ocorrências históricas
                continuam preservadas e não foram importadas, respeitando a autorização expressa do
                usuário.
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SEÇÃO PLANILHA XLSX */}
      {activeImportSection === 'xlsx' && (
        <>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Upload className="w-4 h-4 text-blue-600" />
                Selecione a Planilha Técnica Oficial (.xlsx)
              </CardTitle>
              <CardDescription className="text-xs">
                As linhas da planilha são processadas no seu navegador e gravadas com validação
                técnica e histórico bruto para auditoria. Nenhuma linha é pré-embutida ou inventada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 text-center bg-slate-50/50 hover:bg-blue-50/20 transition-all cursor-pointer relative">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  disabled={isParsing || isImporting}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                    {isParsing ? (
                      <RefreshCw className="w-6 h-6 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-6 h-6" />
                    )}
                  </div>
                  <div className="text-sm font-semibold text-slate-800">
                    {file ? file.name : 'Clique para selecionar o arquivo XLSX'}
                  </div>
                  <p className="text-xs text-slate-500 max-w-md">
                    Arquivo esperado:
                    `Sintese_Setores_Risco_Trechos_Perigo_2024_11_29_tabela_FINAL.xlsx` (esperado
                    ~290 setores e ~202 trechos).
                  </p>
                </div>
              </div>

              {/* Progress bar during import */}
              {isImporting && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-blue-900">
                    <span>{importStatusText}</span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="h-2 bg-blue-200" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Painel de Qualidade e Resultados da Análise */}
          {parseResult && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <Card className="border-slate-200 bg-white">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-slate-500">Linhas Brutas</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {parseResult.totalRawRows}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Aba principal</p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-blue-50/40 border-blue-200">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-blue-700">Setores de Risco</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      {parseResult.totalRiskSectors}
                    </p>
                    <p className="text-[10px] text-blue-600 mt-0.5">Esperado: ~290</p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-amber-50/40 border-amber-200">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-amber-700">Trechos Perigo</p>
                    <p className="text-2xl font-bold text-amber-900 mt-1">
                      {parseResult.totalDangerStretches}
                    </p>
                    <p className="text-[10px] text-amber-600 mt-0.5">Esperado: ~202</p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-purple-50/40 border-purple-200">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-purple-700">Totalizadores</p>
                    <p className="text-2xl font-bold text-purple-900 mt-1">
                      {parseResult.totalTotalizers}
                    </p>
                    <p className="text-[10px] text-purple-600 mt-0.5">Isolados</p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-yellow-50/40 border-yellow-200">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-yellow-700">Incompletos</p>
                    <p className="text-2xl font-bold text-yellow-900 mt-1">
                      {parseResult.incompleteCount}
                    </p>
                    <p className="text-[10px] text-yellow-600 mt-0.5">Sem rejeição cega</p>
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-emerald-50/40 border-emerald-200">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-emerald-700">Registros Técnicos</p>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">
                      {parseResult.totalDataRecords}
                    </p>
                    <p className="text-[10px] text-emerald-600 mt-0.5 font-semibold">
                      Esperado: ~492
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-900 text-white rounded-xl gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                    <span className="font-bold text-sm">
                      Pronto para Gravação no Banco de Dados
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    A gravação é idempotente (reexecutável a qualquer momento por código). Registros
                    receberão status Geometria: Ausente até envio de GeoJSON/Shapefile.
                  </p>
                </div>

                <Button
                  onClick={handleExecuteImport}
                  disabled={isImporting || importCompleted}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold w-full sm:w-auto shadow-md"
                >
                  {isImporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Importando...
                    </>
                  ) : importCompleted ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2 text-white" />
                      Dados Importados
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4 mr-2" />
                      Confirmar e Gravar {parseResult.totalDataRecords} Registros
                    </>
                  )}
                </Button>
              </div>

              {/* Tabular Preview */}
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-600" />
                      Prévia dos Registros Técnicos Reconhecidos
                    </CardTitle>
                    <Tabs value={filterTab} onValueChange={(v: any) => setFilterTab(v)}>
                      <TabsList className="h-8">
                        <TabsTrigger value="all" className="text-xs">
                          Todos ({parseResult.validRecords.length})
                        </TabsTrigger>
                        <TabsTrigger value="sectors" className="text-xs">
                          Setores ({parseResult.totalRiskSectors})
                        </TabsTrigger>
                        <TabsTrigger value="stretches" className="text-xs">
                          Trechos ({parseResult.totalDangerStretches})
                        </TabsTrigger>
                        <TabsTrigger value="totalizers" className="text-xs">
                          Totalizadores ({parseResult.totalTotalizers})
                        </TabsTrigger>
                        {parseResult.rejectedRecords.length > 0 && (
                          <TabsTrigger value="rejected" className="text-xs text-red-600">
                            Ignorados ({parseResult.rejectedRecords.length})
                          </TabsTrigger>
                        )}
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="max-h-96 overflow-auto border-t border-slate-100">
                    <Table>
                      <TableHeader className="bg-slate-50 sticky top-0">
                        <TableRow className="text-[11px]">
                          <TableHead className="w-12">Linha</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Código Oficial</TableHead>
                          <TableHead>Área / Prancha</TableHead>
                          <TableHead>Localização</TableHead>
                          <TableHead>Processo</TableHead>
                          <TableHead>Grau de Risco</TableHead>
                          <TableHead>Edificações / Vias</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {filterTab === 'rejected'
                          ? parseResult.rejectedRecords.map((rej, idx) => (
                              <TableRow key={`rej-${idx}`} className="bg-red-50/40">
                                <TableCell className="font-mono text-[11px]">{rej.line}</TableCell>
                                <TableCell colSpan={7} className="text-red-700">
                                  {rej.reason}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="destructive" className="text-[10px]">
                                    Rejeitado
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            ))
                          : filteredRecords()
                              .slice(0, 100)
                              .map((r, idx) => (
                                <TableRow key={`row-${idx}`} className="hover:bg-slate-50">
                                  <TableCell className="font-mono text-[11px] text-slate-500">
                                    {r.sourceLineNumber}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={
                                        r.kind === 'sector'
                                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                                          : r.kind === 'stretch'
                                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                                            : 'bg-purple-50 text-purple-700 border-purple-200'
                                      }
                                    >
                                      {r.kind === 'sector'
                                        ? 'Setor'
                                        : r.kind === 'stretch'
                                          ? 'Trecho'
                                          : 'Total'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-semibold text-slate-900 font-mono text-[11px]">
                                    {r.code}
                                  </TableCell>
                                  <TableCell className="max-w-[160px] truncate" title={r.areaName}>
                                    {r.areaName || '-'}
                                  </TableCell>
                                  <TableCell className="max-w-[180px] truncate" title={r.location}>
                                    {r.location || '-'}
                                  </TableCell>
                                  <TableCell>{r.processType || '-'}</TableCell>
                                  <TableCell>
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                        r.riskLevel === 'R4'
                                          ? 'bg-red-600 text-white'
                                          : r.riskLevel === 'R3'
                                            ? 'bg-orange-500 text-white'
                                            : r.riskLevel === 'R2'
                                              ? 'bg-amber-400 text-slate-900'
                                              : 'bg-emerald-500 text-white'
                                      }`}
                                    >
                                      {r.riskGrade || r.riskLevel}
                                    </span>
                                  </TableCell>
                                  <TableCell>
                                    {r.affectedBuildings !== undefined
                                      ? `${r.affectedBuildings} edif.`
                                      : r.affectedRoadsLength !== undefined
                                        ? `${r.affectedRoadsLength} m`
                                        : '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={
                                        r.isIncomplete
                                          ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      }
                                    >
                                      {r.isIncomplete ? 'Incompleto' : 'Válido'}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="p-2 px-4 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
                    <span>Exibindo os primeiros 100 registros para visualização rápida.</span>
                    <span>Total no arquivo: {parseResult.validRecords.length} válidos</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}

      {/* Histórico de Lotes Gravados */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            Histórico e Auditoria de Importações Realizadas
          </CardTitle>
          <CardDescription className="text-xs">
            Registro com carimbo de data, operador responsável e contagens para conformidade
            pública.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="text-[11px]">
                  <TableHead>Data / Hora</TableHead>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Total Registros</TableHead>
                  <TableHead>Válidos</TableHead>
                  <TableHead>Duplicados</TableHead>
                  <TableHead>Incompletos</TableHead>
                  <TableHead>Resumo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {importBatches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6 text-slate-500">
                      Nenhum lote importado ainda. Suba a planilha acima para gravar os primeiros
                      dados.
                    </TableCell>
                  </TableRow>
                ) : (
                  importBatches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-[11px] text-slate-600">
                        {new Date(b.created).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="font-semibold text-slate-800">{b.filename}</TableCell>
                      <TableCell>{b.total_records}</TableCell>
                      <TableCell className="text-emerald-700 font-semibold">
                        {b.valid_records}
                      </TableCell>
                      <TableCell>{b.duplicate_records}</TableCell>
                      <TableCell>{b.incomplete_records}</TableCell>
                      <TableCell className="text-slate-600 text-[11px]">
                        {b.summary || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
export default RiskImportPage
