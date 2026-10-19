import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
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
  Map as MapIcon,
  ExternalLink,
  History,
  Save,
  Camera,
} from 'lucide-react'
import { RecordAttachmentsTab } from '@/components/defesa-civil/RecordAttachmentsTab'
import { municipalGeoAdjustmentsService, auditLogService } from '@/services/defesa-civil'
import type { MunicipalGeoAdjustment } from '@/types/defesa-civil'
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

  const [searchParams, setSearchParams] = useSearchParams()
  const urlParamId = searchParams.get('id')

  // Detalhe Modal
  const [selectedItem, setSelectedItem] = useState<UnifiedRiskItem | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [itemNotFound, setItemNotFound] = useState(false)
  const [relatedOccurrences, setRelatedOccurrences] = useState<Occurrence[]>([])
  const [isLoadingOccs, setIsLoadingOccs] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const munFilter = user?.municipality ? `municipality = "${user.municipality}"` : undefined
      const [secs, strs] = await Promise.all([
        riskSectorsService.list(munFilter, 'code', 600),
        dangerStretchesService.list(munFilter, 'code', 600),
      ])
      setSectors(secs)
      setStretches(strs)
      return { secs, strs }
    } catch (e: any) {
      console.error(e)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar setores',
        description: e.message || 'Verifique a conexão.',
      })
      return { secs: [], strs: [] }
    } finally {
      setIsLoading(false)
    }
  }

  const handleReturnToMap = () => {
    setIsDetailOpen(false)
    setSearchParams({}, { replace: true })
    navigate('/painel', { replace: false })
  }

  const handleCloseDetailDialog = (open: boolean) => {
    setIsDetailOpen(open)
    if (!open) {
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('id')
      setSearchParams(nextParams, { replace: true })
      setItemNotFound(false)
    }
  }

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
    setItemNotFound(false)
    setIsEditingMunicipal(false)
    setAdjustedRiskLevel(item.riskLevel || 'R2')
    setAdjustmentJustification('')
    setIsDetailOpen(true)
    setIsLoadingOccs(true)
    try {
      const munFilter = user?.municipality ? ` && municipality = "${user.municipality}"` : ''
      const field = item.kind === 'sector' ? 'risk_sector' : 'danger_stretch'
      const occs = await occurrencesService.list(`${field} = "${item.id}"${munFilter}`)
      setRelatedOccurrences(occs)
    } catch {
      setRelatedOccurrences([])
    } finally {
      setIsLoadingOccs(false)
    }
    loadAdjustmentsForRecord(item.kind, item.id)
  }

  // Observa ?id=... da URL para abrir a ficha do setor ou trecho pelo identificador único
  useEffect(() => {
    const initFromUrl = async () => {
      const { secs, strs } = await loadData()
      if (urlParamId) {
        const foundSector = secs.find((s) => s.id === urlParamId)
        if (foundSector) {
          openDetails({
            id: foundSector.id,
            kind: 'sector',
            code: foundSector.code,
            sectorOrStretchNum: foundSector.sector_number,
            zone: foundSector.zone,
            areaNumber: foundSector.area_number,
            areaName: foundSector.area_name,
            plateNumber: foundSector.plate_number,
            location: foundSector.location,
            processType: foundSector.process_type,
            dangerGrade: foundSector.danger_grade,
            vulnerabilityGrade: foundSector.vulnerability_grade,
            riskGrade: foundSector.risk_grade,
            riskLevel: foundSector.risk_level || 'indefinido',
            affectedBuildings: foundSector.affected_buildings,
            affectedDwellings: foundSector.affected_dwellings,
            affectedResidents: foundSector.affected_residents,
            affectedRoadsLength: foundSector.affected_roads_length,
            disasterHistory: foundSector.disaster_history,
            regionalRiskInfo: foundSector.regional_risk_info,
            expectedProcesses: foundSector.expected_processes,
            description: foundSector.description,
            recommendations: foundSector.recommendations,
            validationStatus: foundSector.validation_status,
            geometryStatus: foundSector.geometry_status,
            importSource: foundSector.import_source,
            importBatchId: foundSector.import_batch_id,
            rawAttributes: foundSector.raw_attributes,
            created: foundSector.created,
          })
          return
        }

        const foundStretch = strs.find((t) => t.id === urlParamId)
        if (foundStretch) {
          openDetails({
            id: foundStretch.id,
            kind: 'stretch',
            code: foundStretch.code,
            sectorOrStretchNum: foundStretch.stretch_number,
            zone: foundStretch.zone,
            areaNumber: foundStretch.area_number,
            areaName: foundStretch.area_name,
            location: foundStretch.location,
            processType: foundStretch.process_type,
            dangerGrade: foundStretch.danger_grade,
            vulnerabilityGrade: foundStretch.vulnerability_grade,
            riskGrade: foundStretch.risk_grade,
            riskLevel: foundStretch.risk_level || 'indefinido',
            affectedBuildings: undefined,
            affectedDwellings: foundStretch.affected_dwellings,
            affectedResidents: foundStretch.affected_residents,
            affectedRoadsLength: foundStretch.affected_roads_length,
            disasterHistory: foundStretch.disaster_history,
            regionalRiskInfo: undefined,
            expectedProcesses: undefined,
            description: foundStretch.description,
            recommendations: foundStretch.recommendations,
            validationStatus: foundStretch.validation_status,
            geometryStatus: foundStretch.geometry_status,
            importSource: foundStretch.import_source,
            importBatchId: foundStretch.import_batch_id,
            rawAttributes: foundStretch.raw_attributes,
            created: foundStretch.created,
          })
          return
        }

        // Se não encontrou nem em setor nem em trecho, tenta buscar via API
        try {
          const s = await riskSectorsService.get(urlParamId)
          if (
            s &&
            (!user?.municipality || !s.municipality || s.municipality === user.municipality)
          ) {
            openDetails({
              id: s.id,
              kind: 'sector',
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
            })
            return
          }
        } catch (_) {
          try {
            const t = await dangerStretchesService.get(urlParamId)
            if (
              t &&
              (!user?.municipality || !t.municipality || t.municipality === user.municipality)
            ) {
              openDetails({
                id: t.id,
                kind: 'stretch',
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
              })
              return
            }
          } catch (__) {
            // Nem setor nem trecho encontrado
          }
        }

        // Registro não encontrado — NUNCA abrir outro registro
        setSelectedItem(null)
        setItemNotFound(true)
        setIsDetailOpen(true)
      }
    }
    initFromUrl()
  }, [urlParamId, user?.municipality])

  // Histórico de Ajustes Municipais e Edição Técnica de Risco/Geometria
  const [adjustments, setAdjustments] = useState<MunicipalGeoAdjustment[]>([])
  const [isLoadingAdjustments, setIsLoadingAdjustments] = useState(false)
  const [isEditingMunicipal, setIsEditingMunicipal] = useState(false)
  const [adjustedRiskLevel, setAdjustedRiskLevel] = useState('')
  const [adjustmentJustification, setAdjustmentJustification] = useState('')
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false)

  const loadAdjustmentsForRecord = async (kind: 'sector' | 'stretch', id: string) => {
    try {
      setIsLoadingAdjustments(true)
      const targetCol = kind === 'sector' ? 'risk_sectors' : 'danger_stretches'
      const data = await municipalGeoAdjustmentsService.listForRecord(targetCol, id)
      setAdjustments(data)
    } catch (e) {
      console.warn('Erro ao carregar ajustes municipais:', e)
    } finally {
      setIsLoadingAdjustments(false)
    }
  }

  const handleSaveMunicipalAdjustment = async () => {
    if (!selectedItem) return
    if (!adjustmentJustification.trim()) {
      toast({
        variant: 'destructive',
        title: 'Justificativa técnica obrigatória',
        description: 'Informe o motivo do ajuste municipal com base em vistoria ou obra recente.',
      })
      return
    }

    setIsSavingAdjustment(true)
    try {
      const targetCol = selectedItem.kind === 'sector' ? 'risk_sectors' : 'danger_stretches'
      await municipalGeoAdjustmentsService.create({
        municipality: user?.municipality || '',
        target_collection: targetCol,
        target_id: selectedItem.id,
        code: selectedItem.code,
        version_type: 'ajuste_municipal',
        original_risk_level: selectedItem.riskLevel,
        adjusted_risk_level: adjustedRiskLevel || selectedItem.riskLevel,
        justification: adjustmentJustification.trim(),
        author: user?.id,
        author_name: user?.name || 'Técnico Municipal',
      })

      // Registrar auditoria
      await auditLogService.create({
        action: 'update',
        resource: targetCol,
        record_id: selectedItem.id,
        details: `Ajuste municipal registrado para ${selectedItem.code}: de ${selectedItem.riskLevel} para ${adjustedRiskLevel || selectedItem.riskLevel}. Justificativa: ${adjustmentJustification}`,
      })

      toast({
        title: 'Ajuste municipal gravado em versão separada',
        description: 'O estudo original do IPT permanece preservado intacto no banco de dados.',
      })

      setIsEditingMunicipal(false)
      setAdjustmentJustification('')
      loadAdjustmentsForRecord(selectedItem.kind, selectedItem.id)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gravar ajuste municipal',
        description: err.message || 'Sem autorização para alterar parâmetros técnicos.',
      })
    } finally {
      setIsSavingAdjustment(false)
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
      <Dialog open={isDetailOpen} onOpenChange={handleCloseDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {itemNotFound ? (
            <div className="p-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
                <XCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900">
                  Setor ou Trecho de Risco Não Encontrado
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  O registro solicitado (ID: {urlParamId || 'não informado'}) não existe no cadastro
                  deste município ou pode ter sido removido. Nenhuma outra ficha foi aberta para
                  evitar confusão técnica.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => handleCloseDetailDialog(false)}>
                  Ver Lista Geral
                </Button>
                <Button
                  size="sm"
                  onClick={handleReturnToMap}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <MapIcon className="w-3.5 h-3.5 mr-1.5" />
                  Voltar ao mapa
                </Button>
              </div>
            </div>
          ) : selectedItem ? (
            <>
              <DialogHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <DialogTitle className="text-base font-bold flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-blue-600" />
                      Ficha Técnica: {selectedItem.code}
                      <Badge variant="outline" className="capitalize text-[11px]">
                        {selectedItem.kind === 'sector' ? 'Setor de Risco' : 'Trecho de Perigo'}
                      </Badge>
                    </DialogTitle>
                    <DialogDescription className="text-xs mt-0.5">
                      Origem oficial:{' '}
                      <strong className="text-slate-700">
                        {selectedItem.importSource?.includes('IPT') ||
                        selectedItem.importSource?.includes('Síntese')
                          ? selectedItem.importSource
                          : 'IPT · Trechos_perigo.gpkg + síntese 29/11/2024'}
                      </strong>
                      {selectedItem.importBatchId && ` (Lote: ${selectedItem.importBatchId})`}
                    </DialogDescription>
                  </div>

                  {/* Botão de retorno direto preservando estado do mapa */}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleReturnToMap}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 shadow-sm"
                  >
                    <MapIcon className="w-3.5 h-3.5 mr-1.5" />
                    Voltar ao mapa
                  </Button>
                </div>
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

                {/* Alerta de Caso Especial T01 (Desdobramento P2 / P4) */}
                {selectedItem.code?.includes('T01') && (
                  <div className="p-3 bg-amber-50 border-2 border-amber-300 rounded-lg text-amber-950 space-y-1">
                    <p className="font-bold flex items-center gap-1.5 text-xs">
                      <AlertTriangle className="w-4 h-4 text-amber-600" />
                      Aviso Técnico Oficial — Trecho T01 (Várzea do Rio Una / Área 01)
                    </p>
                    <p className="text-xs font-semibold text-amber-900">
                      "Classificações distintas por segmento — P2 a montante / P4 a jusante.
                      Pendente de conferência técnica."
                    </p>
                    <p className="text-[11px] text-amber-800">
                      A geometria contínua do IPT abrange simultaneamente o registro montante (grau
                      P2) e o registro jusante (grau P4). Ambos foram preservados no cadastro sem
                      divisões arbitrárias ou perda de informação.
                    </p>
                  </div>
                )}

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

                {/* Preservação do Estudo IPT x Ajustes Municipais */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                        <History className="w-4 h-4 text-indigo-600" />
                        Preservação IPT & Histórico de Ajustes Municipais
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        O estudo original do IPT é intocável. Ajustes municipais de reclassificação
                        pós-obra são registrados em camada separada com autor e data.
                      </p>
                    </div>

                    {!isEditingMunicipal ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingMunicipal(true)}
                        className="text-xs h-7"
                      >
                        Registrar Ajuste Municipal
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditingMunicipal(false)}
                        className="text-xs h-7 text-slate-600"
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>

                  {/* Formulário de Ajuste Municipal */}
                  {isEditingMunicipal && (
                    <div className="p-3 bg-white border border-indigo-200 rounded-lg space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="font-semibold text-slate-700 block text-[11px]">
                            Grau de Risco Ajustado
                          </label>
                          <select
                            value={adjustedRiskLevel}
                            onChange={(e) => setAdjustedRiskLevel(e.target.value)}
                            className="w-full text-xs bg-slate-50 border rounded px-2 py-1 mt-1"
                          >
                            <option value="R1">R1 - Baixo</option>
                            <option value="R2">R2 - Médio</option>
                            <option value="R3">R3 - Alto</option>
                            <option value="R4">R4 - Muito Alto</option>
                          </select>
                        </div>

                        <div>
                          <label className="font-semibold text-slate-700 block text-[11px]">
                            Referência Original IPT
                          </label>
                          <div className="mt-1 text-xs px-2 py-1 bg-slate-100 rounded text-slate-700 font-bold">
                            {selectedItem.riskLevel} (Original IPT Intacto)
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="font-semibold text-slate-700 block text-[11px]">
                          Justificativa Técnica da Alteração (Obrigatória)
                        </label>
                        <textarea
                          placeholder="Informe obra de contenção executada, nova vistoria ou canalização..."
                          value={adjustmentJustification}
                          onChange={(e) => setAdjustmentJustification(e.target.value)}
                          className="w-full text-xs p-2 border rounded mt-1 bg-slate-50"
                          rows={2}
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-1 border-t">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setIsEditingMunicipal(false)}
                          disabled={isSavingAdjustment}
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveMunicipalAdjustment}
                          disabled={isSavingAdjustment}
                          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {isSavingAdjustment ? 'Gravando...' : 'Gravar Ajuste Municipal'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Lista de Ajustes Anteriores */}
                  {isLoadingAdjustments ? (
                    <p className="text-slate-400 italic text-[11px]">Carregando histórico...</p>
                  ) : adjustments.length === 0 ? (
                    <div className="p-2 bg-white rounded border text-[11px] text-slate-500">
                      Nenhum ajuste municipal gravado. Vigora a classificação original do IPT (100%
                      oficial).
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {adjustments.map((adj) => (
                        <div
                          key={adj.id}
                          className="p-2 bg-white border border-slate-200 rounded text-[11px] space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-indigo-900">
                              Ajuste: {adj.original_risk_level} ➔ {adj.adjusted_risk_level}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(adj.created).toLocaleDateString('pt-BR')} por{' '}
                              {adj.author_name || 'Técnico'}
                            </span>
                          </div>
                          <p className="text-slate-600">{adj.justification}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Aba de Fotos, Vídeos e Documentos Técnicos da Área de Risco */}
                <div className="p-3 bg-white rounded-lg border space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-indigo-600" />
                      Fotos, Vídeos e Documentos Técnicos da Área
                    </p>
                    <span className="text-[10px] text-slate-500">
                      Armazenamento isolado por setor/trecho
                    </span>
                  </div>

                  <RecordAttachmentsTab
                    targetCollection={
                      selectedItem.kind === 'sector' ? 'risk_sectors' : 'danger_stretches'
                    }
                    targetId={selectedItem.id}
                    recordTitle={`${selectedItem.code} (${selectedItem.location || selectedItem.areaName || ''})`}
                    canEdit={true}
                  />
                </div>
              </div>

              <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <Button
                  size="sm"
                  onClick={handleReturnToMap}
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
                >
                  <MapIcon className="w-3.5 h-3.5 mr-1.5" />
                  Voltar ao mapa
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCloseDetailDialog(false)}
                  className="w-full sm:w-auto"
                >
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default RiskSectorsPage
