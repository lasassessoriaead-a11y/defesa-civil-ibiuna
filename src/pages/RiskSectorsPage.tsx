import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ShieldAlert,
  Search,
  Filter,
  Eye,
  Layers,
  Building,
  MapPin,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  HelpCircle,
  FileText,
  Home,
  Users,
  Compass,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  riskSectorsService,
  dangerStretchesService,
  occurrencesService,
} from '@/services/defesa-civil'
import type { RiskSector, DangerStretch, Occurrence } from '@/types/defesa-civil'

type UnifiedRiskItem = {
  id: string
  kind: 'sector' | 'stretch'
  code: string
  sectorOrStretchNum?: string
  zone?: string
  areaNumber?: string
  areaName?: string
  plateNumber?: string
  location?: string
  processType?: string
  dangerGrade?: string
  vulnerabilityGrade?: string
  riskGrade?: string
  riskLevel: 'R1' | 'R2' | 'R3' | 'R4' | 'indefinido'
  affectedBuildings?: number
  affectedDwellings?: number
  affectedResidents?: number
  affectedRoadsLength?: number
  disasterHistory?: string
  regionalRiskInfo?: string
  expectedProcesses?: string
  description?: string
  recommendations?: string
  validationStatus: string
  geometryStatus: string
  importSource?: string
  importBatchId?: string
  rawAttributes?: Record<string, any>
  created: string
}

export const RiskSectorsPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [sectors, setSectors] = useState<RiskSector[]>([])
  const [stretches, setStretches] = useState<DangerStretch[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [filterKind, setFilterKind] = useState<'all' | 'sector' | 'stretch'>('all')
  const [filterRiskLevel, setFilterRiskLevel] = useState<string>('all')
  const [filterProcess, setFilterProcess] = useState<string>('all')
  const [filterValidation, setFilterValidation] = useState<string>('all')

  // Detalhe Modal
  const [selectedItem, setSelectedItem] = useState<UnifiedRiskItem | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [relatedOccurrences, setRelatedOccurrences] = useState<Occurrence[]>([])
  const [isLoadingOccs, setIsLoadingOccs] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [secs, strs] = await Promise.all([
        riskSectorsService.list(undefined, 'code', 600),
        dangerStretchesService.list(undefined, 'code', 600),
      ])
      setSectors(secs)
      setStretches(strs)
    } catch (e: any) {
      console.error(e)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar setores',
        description: e.message || 'Verifique a conexão.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Unifica para tabela fluida
  const unifiedList: UnifiedRiskItem[] = [
    ...sectors.map((s) => ({
      id: s.id,
      kind: 'sector' as const,
      code: s.code,
      sectorOrStretchNum: s.sector_number,
      zone: s.zone,
      areaNumber: s.area_number,
      areaName: s.area_name,
      plateNumber: s.plate_number,
      location: s.location,
      processType: s.process_type,
      dangerGrade: s.danger_grade,
      vulnerabilityGrade: s.vulnerability_grade,
      riskGrade: s.risk_grade,
      riskLevel: s.risk_level || 'indefinido',
      affectedBuildings: s.affected_buildings,
      affectedDwellings: s.affected_dwellings,
      affectedResidents: s.affected_residents,
      affectedRoadsLength: s.affected_roads_length,
      disasterHistory: s.disaster_history,
      regionalRiskInfo: s.regional_risk_info,
      expectedProcesses: s.expected_processes,
      description: s.description,
      recommendations: s.recommendations,
      validationStatus: s.validation_status,
      geometryStatus: s.geometry_status,
      importSource: s.import_source,
      importBatchId: s.import_batch_id,
      rawAttributes: s.raw_attributes,
      created: s.created,
    })),
    ...stretches.map((t) => ({
      id: t.id,
      kind: 'stretch' as const,
      code: t.code,
      sectorOrStretchNum: t.stretch_number,
      zone: t.zone,
      areaNumber: t.area_number,
      areaName: t.area_name,
      location: t.location,
      processType: t.process_type,
      dangerGrade: t.danger_grade,
      vulnerabilityGrade: t.vulnerability_grade,
      riskGrade: t.risk_grade,
      riskLevel: t.risk_level || 'indefinido',
      affectedBuildings: undefined,
      affectedDwellings: t.affected_dwellings,
      affectedResidents: t.affected_residents,
      affectedRoadsLength: t.affected_roads_length,
      disasterHistory: t.disaster_history,
      regionalRiskInfo: undefined,
      expectedProcesses: undefined,
      description: t.description,
      recommendations: t.recommendations,
      validationStatus: t.validation_status,
      geometryStatus: t.geometry_status,
      importSource: t.import_source,
      importBatchId: t.import_batch_id,
      rawAttributes: t.raw_attributes,
      created: t.created,
    })),
  ]

  const openDetails = async (item: UnifiedRiskItem) => {
    setSelectedItem(item)
    setIsDetailOpen(true)
    setIsLoadingOccs(true)
    try {
      const field = item.kind === 'sector' ? 'risk_sector' : 'danger_stretch'
      const occs = await occurrencesService.list(`${field} = "${item.id}"`)
      setRelatedOccurrences(occs)
    } catch {
      setRelatedOccurrences([])
    } finally {
      setIsLoadingOccs(false)
    }
  }

  // Filtragem
  const filtered = unifiedList.filter((item) => {
    const q = search.toLowerCase()
    const matchSearch =
      search === '' ||
      item.code.toLowerCase().includes(q) ||
      (item.location && item.location.toLowerCase().includes(q)) ||
      (item.areaName && item.areaName.toLowerCase().includes(q)) ||
      (item.sectorOrStretchNum && item.sectorOrStretchNum.toLowerCase().includes(q))

    const matchKind = filterKind === 'all' || item.kind === filterKind
    const matchRisk = filterRiskLevel === 'all' || item.riskLevel === filterRiskLevel
    const matchValidation = filterValidation === 'all' || item.validationStatus === filterValidation
    const matchProcess =
      filterProcess === 'all' ||
      (item.processType && item.processType.toLowerCase().includes(filterProcess.toLowerCase()))

    return matchSearch && matchKind && matchRisk && matchValidation && matchProcess
  })

  // Contagens
  const countR4 = unifiedList.filter((i) => i.riskLevel === 'R4').length
  const countR3 = unifiedList.filter((i) => i.riskLevel === 'R3').length
  const countR2 = unifiedList.filter((i) => i.riskLevel === 'R2').length
  const countR1 = unifiedList.filter((i) => i.riskLevel === 'R1').length

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl shadow-xs">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Setores de Risco & Trechos de Perigo
            </h1>
            <p className="text-xs text-slate-500">
              Cadastro técnico territorial oficial de Ibiúna/SP (Levantamento de Campo 2024)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="text-xs h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Link to="/importacao-dados">
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9 shadow-sm">
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
              Importar Planilha XLSX
            </Button>
          </Link>
        </div>
      </div>

      {/* Quick KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500">Total Setores</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">{sectors.length}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Cadastrados no banco</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500">Total Trechos</p>
            <p className="text-2xl font-bold text-amber-900 mt-1">{stretches.length}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Vias monitoradas</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-red-700">Risco Muito Alto (R4)</p>
            <p className="text-2xl font-bold text-red-900 mt-1">{countR4}</p>
            <p className="text-[10px] text-red-600 mt-0.5">Prioridade máxima</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50/40">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-orange-700">Risco Alto (R3)</p>
            <p className="text-2xl font-bold text-orange-900 mt-1">{countR3}</p>
            <p className="text-[10px] text-orange-600 mt-0.5">Monitoramento ativo</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-amber-700">Risco Médio (R2)</p>
            <p className="text-2xl font-bold text-amber-900 mt-1">{countR2}</p>
            <p className="text-[10px] text-amber-600 mt-0.5">Vulnerabilidade média</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-emerald-700">Risco Baixo (R1)</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">{countR1}</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">Suscetibilidade leve</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por código (IBI-01...), logradouro, bairro ou prancha..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Select value={filterKind} onValueChange={(v: any) => setFilterKind(v)}>
                <SelectTrigger className="w-32 h-9 text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Setores e Trechos</SelectItem>
                  <SelectItem value="sector">Só Setores</SelectItem>
                  <SelectItem value="stretch">Só Trechos</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterRiskLevel} onValueChange={setFilterRiskLevel}>
                <SelectTrigger className="w-32 h-9 text-xs">
                  <SelectValue placeholder="Grau R1-R4" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Níveis</SelectItem>
                  <SelectItem value="R4">R4 - Muito Alto</SelectItem>
                  <SelectItem value="R3">R3 - Alto</SelectItem>
                  <SelectItem value="R2">R2 - Médio</SelectItem>
                  <SelectItem value="R1">R1 - Baixo</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterProcess} onValueChange={setFilterProcess}>
                <SelectTrigger className="w-36 h-9 text-xs">
                  <SelectValue placeholder="Processo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Processos</SelectItem>
                  <SelectItem value="ALA">Alagamento (ALA)</SelectItem>
                  <SelectItem value="ESC">Escorregamento (ESC)</SelectItem>
                  <SelectItem value="INU">Inundação (INU)</SelectItem>
                  <SelectItem value="ENX">Enxurrada (ENX)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterValidation} onValueChange={setFilterValidation}>
                <SelectTrigger className="w-36 h-9 text-xs">
                  <SelectValue placeholder="Status Validação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="pendente_conferencia">Pendente</SelectItem>
                  <SelectItem value="incompleto">Incompleto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="text-[11px]">
                  <TableHead className="w-16">Tipo</TableHead>
                  <TableHead>Código Oficial</TableHead>
                  <TableHead>Área / Prancha</TableHead>
                  <TableHead>Localização / Endereço</TableHead>
                  <TableHead>Processo Perigoso</TableHead>
                  <TableHead>Grau Risco</TableHead>
                  <TableHead>Edificações / Extensão</TableHead>
                  <TableHead>Geometria</TableHead>
                  <TableHead>Validação</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-slate-500">
                      Carregando cadastro técnico de setores e trechos...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-slate-500 space-y-2">
                      <p className="font-semibold text-slate-700">Nenhum registro encontrado.</p>
                      <p className="text-xs text-slate-500">
                        {unifiedList.length === 0
                          ? 'Nenhum dado importado ainda. Suba o arquivo Sintese 2024 na aba de Importação.'
                          : 'Ajuste os filtros de busca acima.'}
                      </p>
                      {unifiedList.length === 0 && (
                        <Link to="/importacao-dados">
                          <Button
                            size="sm"
                            className="mt-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                          >
                            Ir para Importação de Dados
                          </Button>
                        </Link>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.slice(0, 100).map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/80">
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            item.kind === 'sector'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }
                        >
                          {item.kind === 'sector' ? 'Setor' : 'Trecho'}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-slate-900">
                        {item.code}
                      </TableCell>
                      <TableCell className="max-w-[150px] truncate" title={item.areaName}>
                        {item.areaName || item.areaNumber || '-'}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={item.location}>
                        {item.location || '-'}
                      </TableCell>
                      <TableCell>{item.processType || '-'}</TableCell>
                      <TableCell>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                            item.riskLevel === 'R4'
                              ? 'bg-red-600 text-white'
                              : item.riskLevel === 'R3'
                                ? 'bg-orange-500 text-white'
                                : item.riskLevel === 'R2'
                                  ? 'bg-amber-400 text-slate-900'
                                  : 'bg-emerald-500 text-white'
                          }`}
                        >
                          {item.riskGrade || item.riskLevel}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.affectedBuildings !== undefined
                          ? `${item.affectedBuildings} edif.`
                          : item.affectedRoadsLength !== undefined
                            ? `${item.affectedRoadsLength} m`
                            : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]"
                        >
                          Sem Geometria
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            item.validationStatus === 'aprovado'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : item.validationStatus === 'incompleto'
                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                : 'bg-slate-100 text-slate-600'
                          }
                        >
                          {item.validationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDetails(item)}
                          className="h-8 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 100 && (
            <div className="p-3 bg-slate-50 border-t text-center text-xs text-slate-500">
              Exibindo 100 de {filtered.length} registros para manter fluidez visual. Use os filtros
              para refinamento.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Completo de Ficha Técnica */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedItem && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-base font-bold flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-blue-600" />
                    Ficha Técnica: {selectedItem.code}
                  </DialogTitle>
                  <Badge variant="outline" className="capitalize">
                    {selectedItem.kind === 'sector' ? 'Setor de Risco' : 'Trecho de Perigo'}
                  </Badge>
                </div>
                <DialogDescription className="text-xs">
                  Origem do cadastro:{' '}
                  {selectedItem.importSource || 'Sintese_Setores_Risco_Trechos_Perigo_2024.xlsx'}
                  {selectedItem.importBatchId && ` (Lote: ${selectedItem.importBatchId})`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Cabeçalho Técnico */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-slate-50 rounded-lg border">
                  <div>
                    <span className="text-slate-500 block">Área / Localização:</span>
                    <strong className="text-slate-800">
                      {selectedItem.areaName || selectedItem.areaNumber || '-'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Processo Perigoso:</span>
                    <strong className="text-slate-800">{selectedItem.processType || '-'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Classificação de Risco:</span>
                    <span className="font-bold text-red-700">
                      {selectedItem.riskGrade || selectedItem.riskLevel}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Prancha / Identificador:</span>
                    <strong className="text-slate-800">
                      {selectedItem.plateNumber || selectedItem.sectorOrStretchNum || '-'}
                    </strong>
                  </div>
                </div>

                {/* Localização Detalhada */}
                <div className="p-3 bg-white rounded-lg border space-y-1">
                  <p className="font-bold text-slate-800">Localização e Endereço de Referência:</p>
                  <p className="text-slate-700">{selectedItem.location || 'Não especificado.'}</p>
                </div>

                {/* Histórico de Desastres */}
                {selectedItem.disasterHistory && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-1">
                    <p className="font-bold text-amber-900">
                      Histórico de Ocorrência de Desastres:
                    </p>
                    <p className="text-amber-800 leading-relaxed">{selectedItem.disasterHistory}</p>
                  </div>
                )}

                {/* Descrição do Risco Local e Processos Esperados */}
                {(selectedItem.description || selectedItem.expectedProcesses) && (
                  <div className="p-3 bg-slate-50 rounded-lg border space-y-2">
                    {selectedItem.expectedProcesses && (
                      <div>
                        <p className="font-bold text-slate-800">Tipos de Processos Esperados:</p>
                        <p className="text-slate-700">{selectedItem.expectedProcesses}</p>
                      </div>
                    )}
                    {selectedItem.description && (
                      <div>
                        <p className="font-bold text-slate-800">Descrição do Risco Local:</p>
                        <p className="text-slate-700 leading-relaxed">{selectedItem.description}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Recomendações Técnicas */}
                {selectedItem.recommendations && (
                  <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200 space-y-1">
                    <p className="font-bold text-blue-900">Recomendações e Medidas Mitigadoras:</p>
                    <p className="text-blue-800 whitespace-pre-line leading-relaxed">
                      {selectedItem.recommendations}
                    </p>
                  </div>
                )}

                {/* Ocorrências Vinculadas */}
                <div className="p-3 bg-white rounded-lg border space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-800">
                      Ocorrências Registradas Vinculadas ({relatedOccurrences.length})
                    </p>
                    <span className="text-[10px] text-slate-500">
                      Informação geográfica de apoio
                    </span>
                  </div>

                  {isLoadingOccs ? (
                    <p className="text-slate-400 italic">Buscando ocorrências vinculadas...</p>
                  ) : relatedOccurrences.length === 0 ? (
                    <p className="text-slate-500 italic text-[11px]">
                      Nenhuma ocorrência do 199/campo vinculada a este setor/trecho até o momento.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {relatedOccurrences.map((occ) => (
                        <div
                          key={occ.id}
                          className="p-2 bg-slate-50 rounded border flex items-center justify-between"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">{occ.title}</span>
                            <span className="text-slate-500 ml-2">({occ.code})</span>
                          </div>
                          <Badge variant="outline">{occ.severity}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default RiskSectorsPage
