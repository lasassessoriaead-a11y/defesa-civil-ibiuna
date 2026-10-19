import React, { useState } from 'react'
import {
  ShieldAlert,
  Layers,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
  Database,
  RefreshCw,
  Search,
  Eye,
  Info,
  MapPin,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  analyzeIptGeoJson,
  commitIptGeoJsonLinking,
  type IptPreImportSummary,
  type IptCommitResult,
  type IptAnalyzedFeature,
} from '@/services/ipt-geojson-importer-service'
import { riskSectorsService, dangerStretchesService } from '@/services/defesa-civil'
import { useToast } from '@/hooks/use-toast'
import defaultGeoJsonData from '@/assets/ibiunaiptsetoresetrechosgeojson-bad52.json'

interface IptGeoJsonPanelProps {
  municipalityId: string
  userId?: string
  onImportComplete?: () => void
}

export const IptGeoJsonPanel: React.FC<IptGeoJsonPanelProps> = ({
  municipalityId,
  userId,
  onImportComplete,
}) => {
  const { toast } = useToast()

  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<IptPreImportSummary | null>(null)
  const [isCommitting, setIsCommitting] = useState(false)
  const [commitProgress, setCommitProgress] = useState(0)
  const [commitStatusText, setCommitStatusText] = useState('')
  const [commitResult, setCommitResult] = useState<IptCommitResult | null>(null)

  // Filtros da prévia
  const [filterTab, setFilterTab] = useState<
    'all' | 'ready' | 'already' | 'divergences' | 'unmatched'
  >('all')
  const [search, setSearch] = useState('')
  const [selectedFeature, setSelectedFeature] = useState<IptAnalyzedFeature | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  // Carrega e analisa o GeoJSON em anexo (ou arquivo customizado se fornecido)
  const handleAnalyzeAttachedGeoJson = async (
    customJson?: any,
    filename = 'Ibiuna_IPT_Setores_e_Trechos_GeoJSON-bad52.json',
  ) => {
    setIsAnalyzing(true)
    setCommitResult(null)
    try {
      const geoData = customJson || (defaultGeoJsonData as any)

      // Carrega registros existentes no banco para checagem inequívoca
      const [sectors, stretches] = await Promise.all([
        riskSectorsService.list(
          municipalityId ? `municipality = "${municipalityId}"` : undefined,
          'code',
          500,
        ),
        dangerStretchesService.list(
          municipalityId ? `municipality = "${municipalityId}"` : undefined,
          'code',
          500,
        ),
      ])

      const summary = await analyzeIptGeoJson(geoData, sectors, stretches)
      setAnalysis(summary)

      toast({
        title: 'Prévia IPT Gerada com Sucesso',
        description: `${summary.totalFeatures} feições analisadas. Vínculos prontos: ${summary.willLinkGeometry} (Setores: ${summary.matchedSectors}, Trechos: ${summary.matchedStretches}).`,
      })
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao analisar GeoJSON do IPT',
        description: err.message || 'Verifique o formato do arquivo GeoJSON.',
      })
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Upload opcional de outro arquivo GeoJSON
  const handleCustomFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string)
        handleAnalyzeAttachedGeoJson(parsed, file.name)
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Arquivo JSON inválido',
          description: err.message,
        })
      }
    }
    reader.readAsText(file)
  }

  // Gravação manual com confirmação na tela
  const handleConfirmAndCommit = async () => {
    if (!analysis || !municipalityId) {
      toast({
        variant: 'destructive',
        title: 'Operação não permitida',
        description: 'É necessário ter a prévia analisada e município identificado.',
      })
      return
    }

    setIsCommitting(true)
    setCommitProgress(0)
    setCommitStatusText('Iniciando vinculação idempotente...')

    try {
      const result = await commitIptGeoJsonLinking(
        analysis,
        municipalityId,
        userId,
        'Ibiuna_IPT_Setores_e_Trechos_GeoJSON-bad52.json',
        (curr, total, label) => {
          const pct = Math.round((curr / total) * 100)
          setCommitProgress(pct)
          setCommitStatusText(label)
        },
      )

      setCommitResult(result)
      toast({
        title: 'Vinculação Geográfica Concluída',
        description: `${result.sectorsUpdated} setores e ${result.stretchesUpdated} trechos vinculados com sucesso!`,
      })

      if (onImportComplete) {
        onImportComplete()
      }

      // Re-analisa para atualizar o estado dos cadastros no painel
      await handleAnalyzeAttachedGeoJson()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Falha durante a gravação',
        description: err.message || 'Erro ao gravar geometrias.',
      })
    } finally {
      setIsCommitting(false)
    }
  }

  const filteredFeatures = () => {
    if (!analysis) return []
    return analysis.features.filter((f) => {
      const matchSearch =
        search === '' ||
        f.code.toLowerCase().includes(search.toLowerCase()) ||
        (f.locality && f.locality.toLowerCase().includes(search.toLowerCase())) ||
        (f.process && f.process.toLowerCase().includes(search.toLowerCase()))

      if (!matchSearch) return false

      if (filterTab === 'ready') {
        return (
          (f.category === 'match_sector' || f.category === 'match_stretch') &&
          !f.matchedRecordHasGeometry
        )
      }
      if (filterTab === 'already') {
        return (
          (f.category === 'match_sector' || f.category === 'match_stretch') &&
          f.matchedRecordHasGeometry
        )
      }
      if (filterTab === 'divergences') {
        return f.category === 'divergence' || !f.isValidBounds
      }
      if (filterTab === 'unmatched') {
        return f.category === 'unmatched_new'
      }
      return true
    })
  }

  return (
    <div className="space-y-6">
      {/* Card Principal de Carregamento e Metadados */}
      <Card className="border-emerald-200 bg-gradient-to-b from-emerald-50/50 to-white shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2 text-emerald-950 font-bold">
                <ShieldAlert className="w-5 h-5 text-emerald-600" />
                Vínculo Geográfico IPT (Setores & Trechos de Enxurrada)
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 mt-1">
                Integração do mapeamento vetorial oficial BDG/SIG aos cadastros técnicos existentes.
                Detecção inequívoca por código sem duplicação e sem sobrescrita silenciosa.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".json,.geojson"
                  onChange={handleCustomFileUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700 text-xs"
                >
                  <span>
                    <FileCode2 className="w-3.5 h-3.5 mr-1" />
                    Carregar Outro GeoJSON
                  </span>
                </Button>
              </label>

              <Button
                size="sm"
                onClick={() => handleAnalyzeAttachedGeoJson()}
                disabled={isAnalyzing || isCommitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                    Analisando Geometrias...
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5 mr-1" />
                    Gerar Prévia do Arquivo Anexo
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="p-3 bg-white border border-slate-200 rounded-lg text-xs space-y-1">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-slate-700">
              <div>
                <span className="text-slate-500 font-medium">Arquivo Fonte:</span>{' '}
                <code className="text-emerald-800 font-mono">
                  Ibiuna_IPT_Setores_e_Trechos_GeoJSON-bad52.json
                </code>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Projeção:</span>{' '}
                <span className="font-semibold text-slate-800">EPSG:4326 (WGS84 Lon/Lat)</span>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Origem do Levantamento:</span>{' '}
                <span className="text-slate-800">
                  IPT · Trechos_perigo.gpkg + síntese 29/11/2024
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exibição dos KPIs da Prévia */}
      {analysis && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Card className="border-slate-200 bg-white">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-500">Feições no Arquivo</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{analysis.totalFeatures}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {analysis.sectorsInFile} setores • {analysis.stretchesInFile} trechos
                </p>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/40">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-blue-700">Prontos p/ Vínculo</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{analysis.willLinkGeometry}</p>
                <p className="text-[10px] text-blue-600 mt-0.5">Cadastros sem geometria</p>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50/40">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-emerald-700">Já Vinculados</p>
                <p className="text-2xl font-bold text-emerald-900 mt-1">
                  {analysis.alreadyHaveGeometry}
                </p>
                <p className="text-[10px] text-emerald-600 mt-0.5">Idempotente (sem duplicar)</p>
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-amber-700">Divergências Técnicas</p>
                <p className="text-2xl font-bold text-amber-900 mt-1">
                  {analysis.divergencesCount}
                </p>
                <p className="text-[10px] text-amber-600 mt-0.5">Conferência humana</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 bg-slate-50/60">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-600">Sem Cadastro</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">{analysis.unmatchedCount}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Não encontrados no banco</p>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/40">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-red-700">Fora dos Limites</p>
                <p className="text-2xl font-bold text-red-900 mt-1">{analysis.outOfBoundsCount}</p>
                <p className="text-[10px] text-red-600 mt-0.5">Fora de Ibiúna/SP</p>
              </CardContent>
            </Card>
          </div>

          {/* Barra de Ação com Confirmação e Regra de Não-Sobrescrita */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-slate-900 text-white rounded-xl gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="flex items-center gap-2 justify-center sm:justify-start">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="font-bold text-sm">
                  Prévia Verificada: {analysis.matchedSectors} setores e {analysis.matchedStretches}{' '}
                  trechos reconhecidos
                </span>
              </div>
              <p className="text-xs text-slate-300">
                A gravação só ocorre ao confirmar abaixo. A operação é 100% idempotente: vincula as
                geometrias nos cadastros existentes preservando seus atributos oficiais do XLSX.
              </p>
            </div>

            <Button
              onClick={handleConfirmAndCommit}
              disabled={isCommitting || analysis.willLinkGeometry === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold w-full sm:w-auto shadow-md"
            >
              {isCommitting ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Gravando Vínculos...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4 mr-2" />
                  Confirmar e Gravar Vínculo ({analysis.willLinkGeometry} Feições)
                </>
              )}
            </Button>
          </div>

          {/* Progresso durante a gravação */}
          {isCommitting && (
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 space-y-2">
              <div className="flex justify-between text-xs font-semibold text-emerald-900">
                <span>{commitStatusText}</span>
                <span>{commitProgress}%</span>
              </div>
              <Progress value={commitProgress} className="h-2 bg-emerald-200" />
            </div>
          )}

          {/* Resultado da gravação */}
          {commitResult && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-xs space-y-2">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                Gravação Concluída com Sucesso! (Lote: {commitResult.batchId})
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-slate-700 pt-1">
                <div>
                  <strong>Setores Atualizados:</strong> {commitResult.sectorsUpdated}
                </div>
                <div>
                  <strong>Trechos Atualizados:</strong> {commitResult.stretchesUpdated}
                </div>
                <div>
                  <strong>Divergências Preservadas:</strong> {commitResult.divergencesLogged}
                </div>
                <div>
                  <strong>Erros:</strong> {commitResult.errors.length}
                </div>
              </div>
            </div>
          )}

          {/* Tabela Detalhada com Abas e Busca */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Filtrar por código (IBI-01...), localidade ou processo..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 text-xs h-8"
                  />
                </div>

                <Tabs value={filterTab} onValueChange={(v: any) => setFilterTab(v)}>
                  <TabsList className="h-8">
                    <TabsTrigger value="all" className="text-xs">
                      Todos ({analysis.totalFeatures})
                    </TabsTrigger>
                    <TabsTrigger value="ready" className="text-xs text-blue-700">
                      Prontos p/ Vínculo ({analysis.willLinkGeometry})
                    </TabsTrigger>
                    <TabsTrigger value="already" className="text-xs text-emerald-700">
                      Já Gravados ({analysis.alreadyHaveGeometry})
                    </TabsTrigger>
                    {analysis.divergencesCount > 0 && (
                      <TabsTrigger value="divergences" className="text-xs text-amber-700">
                        Divergências ({analysis.divergencesCount})
                      </TabsTrigger>
                    )}
                    {analysis.unmatchedCount > 0 && (
                      <TabsTrigger value="unmatched" className="text-xs text-slate-600">
                        Sem Cadastro ({analysis.unmatchedCount})
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
                      <TableHead className="w-20">Tipo</TableHead>
                      <TableHead>Código Técnico</TableHead>
                      <TableHead>Localidade / Logradouro</TableHead>
                      <TableHead>Processo</TableHead>
                      <TableHead>Grau</TableHead>
                      <TableHead>Geometria</TableHead>
                      <TableHead>Status de Correspondência</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="text-xs">
                    {filteredFeatures().length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6 text-slate-500">
                          Nenhum registro encontrado para o filtro selecionado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredFeatures()
                        .slice(0, 100)
                        .map((f, idx) => (
                          <TableRow key={`feat-${idx}`} className="hover:bg-slate-50">
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  f.kind === 'setor'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }
                              >
                                {f.kind === 'setor' ? 'Setor (Polígono)' : 'Trecho (Linha)'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono font-bold text-slate-900">
                              {f.code}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate" title={f.locality}>
                              {f.locality || '-'}
                            </TableCell>
                            <TableCell>{f.process || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {f.grade || f.level || '-'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-[11px] text-slate-600">
                              {f.geometryType}
                            </TableCell>
                            <TableCell>
                              {f.category === 'match_sector' || f.category === 'match_stretch' ? (
                                f.matchedRecordHasGeometry ? (
                                  <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                                    Já Vinculado
                                  </Badge>
                                ) : (
                                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-[10px]">
                                    Pronto p/ Vínculo
                                  </Badge>
                                )
                              ) : f.category === 'divergence' ? (
                                <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px]">
                                  Divergência
                                </Badge>
                              ) : f.category === 'invalid_geometry' ? (
                                <Badge variant="destructive" className="text-[10px]">
                                  Fora do Limite
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-slate-500 text-[10px]">
                                  Sem Cadastro
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedFeature(f)
                                  setIsDetailOpen(true)
                                }}
                                className="h-7 text-xs text-blue-600"
                              >
                                Ver Detalhes
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="p-2 px-4 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 flex justify-between">
                <span>Exibindo 100 de {filteredFeatures().length} registros listados.</span>
                <span>Projeção conferida: WGS84 (EPSG:4326)</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de Detalhes da Feição */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
          {selectedFeature && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base font-bold flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-blue-600" />
                  Feição IPT: {selectedFeature.code}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedFeature.categoryReason}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border">
                  <div>
                    <span className="text-slate-500 block">Tipo de Feição:</span>
                    <strong className="text-slate-800 capitalize">{selectedFeature.kind}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Geometria:</span>
                    <strong className="text-slate-800">{selectedFeature.geometryType}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Processo Perigoso:</span>
                    <strong className="text-slate-800">{selectedFeature.process || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Grau de Risco:</span>
                    <strong className="text-slate-800">
                      {selectedFeature.grade || selectedFeature.level || '-'}
                    </strong>
                  </div>
                </div>

                <div className="p-3 bg-white rounded-lg border space-y-1">
                  <span className="text-slate-500 block font-medium">Localidade Declarada:</span>
                  <p className="text-slate-800">{selectedFeature.locality || 'Não especificada'}</p>
                </div>

                <div className="p-3 bg-white rounded-lg border space-y-1">
                  <span className="text-slate-500 block font-medium">Origem do Dado:</span>
                  <p className="text-slate-800">{selectedFeature.source}</p>
                </div>

                {selectedFeature.divergences && selectedFeature.divergences.length > 0 && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-1 text-amber-900">
                    <span className="block font-bold">Divergências Detectadas com o Banco:</span>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {selectedFeature.divergences.map((div, i) => (
                        <li key={i}>{div}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-3 bg-slate-50 rounded-lg border space-y-1 font-mono text-[11px] text-slate-700">
                  <span className="font-bold block font-sans text-xs">
                    Propriedades Brutas (GeoJSON):
                  </span>
                  <pre className="max-h-32 overflow-auto bg-white p-2 rounded border">
                    {JSON.stringify(selectedFeature.rawProperties, null, 2)}
                  </pre>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default IptGeoJsonPanel
