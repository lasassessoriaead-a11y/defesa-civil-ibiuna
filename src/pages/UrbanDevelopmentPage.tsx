import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Building2,
  Search,
  Plus,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Clock,
  Layers,
  ArrowRight,
  ShieldAlert,
  Send,
  Eye,
  Download,
  Info,
  RefreshCw,
  X,
  UploadCloud,
  FileCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
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
  urbanConsultationsService,
  riskSectorsService,
  dangerStretchesService,
  geoLayersService,
  auditLogService,
} from '@/services/defesa-civil'
import type {
  UrbanConsultation,
  UrbanConsultationPurpose,
  UrbanAnalysisStatus,
  UrbanIntersectionResult,
  RiskSector,
  DangerStretch,
} from '@/types/defesa-civil'
import { checkPolygonIntersection, isPointInPolygon } from '@/lib/geo-utils'
import { InteractiveMap } from '@/components/defesa-civil/InteractiveMap'
import { RecordAttachmentsTab } from '@/components/defesa-civil/RecordAttachmentsTab'

export const UrbanDevelopmentPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [consultations, setConsultations] = useState<UrbanConsultation[]>([])
  const [riskSectors, setRiskSectors] = useState<RiskSector[]>([])
  const [dangerStretches, setDangerStretches] = useState<DangerStretch[]>([])
  const [geoLayers, setGeoLayers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [resultFilter, setResultFilter] = useState<string>('all')

  // Modal Novo / Análise
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [processNumber, setProcessNumber] = useState('')
  const [requesterName, setRequesterName] = useState('')
  const [purpose, setPurpose] = useState<UrbanConsultationPurpose>('loteamento')
  const [locationAddress, setLocationAddress] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [coordsInput, setCoordsInput] = useState('')
  const [perimeterGeoJsonText, setPerimeterGeoJsonText] = useState('')
  const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([])
  const [observations, setObservations] = useState('')
  const [responsibleOfficer, setResponsibleOfficer] = useState(user?.name || '')
  const [departmentSender, setDepartmentSender] = useState(
    'Secretaria de Obras e Planejamento Urbano',
  )

  // Estado de cruzamento em tempo real
  const [intersectionAnalysis, setIntersectionAnalysis] = useState<{
    result: UrbanIntersectionResult
    hits: Array<{
      layer: string
      name?: string
      code?: string
      risk_level?: string
      source: string
      date?: string
      notes?: string
    }>
    layersConsulted: string[]
  } | null>(null)

  // Ficha Selecionada para Detalhe / Encaminhamento
  const [selectedConsultation, setSelectedConsultation] = useState<UrbanConsultation | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<UrbanAnalysisStatus>('registrada')
  const [technicalNotes, setTechnicalNotes] = useState('')

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [cons, sectors, stretches, layers] = await Promise.all([
        urbanConsultationsService.list(undefined, '-created'),
        riskSectorsService.list(undefined, 'code', 600),
        dangerStretchesService.list(undefined, 'code', 600),
        geoLayersService.list(undefined, 'name', 1000).catch(() => []),
      ])
      setConsultations(cons)
      setRiskSectors(sectors)
      setDangerStretches(stretches)
      setGeoLayers(layers)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar consultas',
        description: err.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Função central de cruzamento territorial cartográfico
  const runSpatialCrossing = (polygonRings: [number, number][], pointCoords?: [number, number]) => {
    const hits: Array<{
      layer: string
      name?: string
      code?: string
      risk_level?: string
      source: string
      date?: string
      notes?: string
    }> = []

    const layersConsulted = [
      'IPT - Setores de Risco 2024 (290 setores)',
      'IPT - Trechos de Perigo 2024 (202 trechos)',
      'Camadas Espaciais Oficiais de Ibiúna (geo_layers)',
    ]

    // 1. Setores IPT com geometria
    let sectorsWithGeo = 0
    for (const s of riskSectors) {
      if (!s.geometry_geojson) continue
      sectorsWithGeo++
      try {
        const parsed = JSON.parse(s.geometry_geojson)
        let ring: [number, number][] = []
        if (parsed.type === 'Polygon' && Array.isArray(parsed.coordinates?.[0])) {
          ring = parsed.coordinates[0].map((c: number[]) => [c[1], c[0]])
        } else if (parsed.type === 'MultiPolygon' && Array.isArray(parsed.coordinates?.[0]?.[0])) {
          ring = parsed.coordinates[0][0].map((c: number[]) => [c[1], c[0]])
        }

        if (ring.length > 2) {
          if (polygonRings.length > 2 && checkPolygonIntersection(polygonRings, ring)) {
            hits.push({
              layer: 'Setor de Risco IPT',
              code: s.code,
              name: s.area_name || s.location || s.sector_number,
              risk_level: s.risk_level || 'indefinido',
              source: 'Relatório IPT 2024 — Síntese Oficial',
              date: '2024-11-29',
              notes: s.process_type || s.description || 'Setor mapeado pelo IPT',
            })
          } else if (pointCoords && isPointInPolygon(pointCoords, ring)) {
            hits.push({
              layer: 'Setor de Risco IPT (Coordenada Pontual Preliminar)',
              code: s.code,
              name: s.area_name || s.location || s.sector_number,
              risk_level: s.risk_level || 'indefinido',
              source: 'Relatório IPT 2024 — Síntese Oficial',
              date: '2024-11-29',
              notes: 'Ponto preliminar incide no interior do setor.',
            })
          }
        }
      } catch {
        /* intentionally ignored */
      }
    }

    // 2. Trechos de Perigo IPT com geometria
    for (const t of dangerStretches) {
      if (!t.geometry_geojson) continue
      try {
        const parsed = JSON.parse(t.geometry_geojson)
        let linePts: [number, number][] = []
        if (parsed.type === 'LineString' && Array.isArray(parsed.coordinates)) {
          linePts = parsed.coordinates.map((c: number[]) => [c[1], c[0]])
        }

        if (linePts.length >= 2 && polygonRings.length > 2) {
          if (checkPolygonIntersection(polygonRings, linePts)) {
            hits.push({
              layer: 'Trecho de Perigo IPT',
              code: t.code,
              name: t.area_name || t.location || t.stretch_number,
              risk_level: t.risk_level || 'indefinido',
              source: 'Relatório IPT 2024 — Trechos de Enxurrada',
              date: '2024-11-29',
              notes: t.process_type || t.description || 'Trecho de enxurrada mapeado pelo IPT',
            })
          }
        }
      } catch {
        /* intentionally ignored */
      }
    }

    // 3. Camadas Oficiais geo_layers (Inundação, Áreas de Avaliação de Risco, etc.)
    for (const l of geoLayers) {
      if (!l.geometry_geojson) continue
      try {
        const parsed = JSON.parse(l.geometry_geojson)
        let ring: [number, number][] = []
        if (parsed.type === 'Polygon' && Array.isArray(parsed.coordinates?.[0])) {
          ring = parsed.coordinates[0].map((c: number[]) => [c[1], c[0]])
        } else if (parsed.type === 'MultiPolygon' && Array.isArray(parsed.coordinates?.[0]?.[0])) {
          ring = parsed.coordinates[0][0].map((c: number[]) => [c[1], c[0]])
        }

        if (ring.length > 2 && polygonRings.length > 2) {
          if (checkPolygonIntersection(polygonRings, ring)) {
            hits.push({
              layer: `Camada Oficial: ${l.name || l.layer_type}`,
              code: l.code || l.feature_fid,
              name: l.name,
              risk_level: l.risk_level || 'indefinido',
              source: l.source_file || 'Base Geográfica Municipal Ibiúna',
              notes: l.properties ? JSON.stringify(l.properties).slice(0, 100) : '',
            })
          }
        }
      } catch {
        /* intentionally ignored */
      }
    }

    let result: UrbanIntersectionResult = 'nenhuma_intersecao_encontrada'

    // Se não há geometrias salvas no banco (492 ainda ausentes) ou se o polígono tem menos de 3 pontos
    if (sectorsWithGeo === 0 && (!pointCoords || !pointCoords[0])) {
      result = 'inconclusiva_informacao_insuficiente'
    } else if (hits.length > 0) {
      result = 'intersecao_encontrada'
    } else if (polygonRings.length < 3 && (!pointCoords || !pointCoords[0])) {
      result = 'inconclusiva_informacao_insuficiente'
    } else {
      result = 'nenhuma_intersecao_encontrada'
    }

    return {
      result,
      hits,
      layersConsulted,
    }
  }

  // Aciona análise ao desenhar polígono ou inserir GeoJSON
  const handlePerformAnalysis = () => {
    let poly: [number, number][] = [...drawnPoints]
    let pt: [number, number] | undefined = undefined

    // Se houver GeoJSON colado
    if (perimeterGeoJsonText.trim()) {
      try {
        const parsed = JSON.parse(perimeterGeoJsonText.trim())
        if (parsed.type === 'Polygon' && Array.isArray(parsed.coordinates?.[0])) {
          poly = parsed.coordinates[0].map((c: number[]) => [c[1], c[0]])
        } else if (parsed.type === 'Feature' && parsed.geometry?.coordinates?.[0]) {
          poly = parsed.geometry.coordinates[0].map((c: number[]) => [c[1], c[0]])
        }
      } catch {
        toast({
          variant: 'destructive',
          title: 'GeoJSON inválido',
          description: 'Não foi possível ler o polígono GeoJSON informado.',
        })
      }
    }

    // Se houver coordenadas pontuais preliminares
    if (coordsInput.trim()) {
      const parts = coordsInput.split(',').map((p) => parseFloat(p.trim()))
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        pt = [parts[0], parts[1]]
      }
    }

    const analysis = runSpatialCrossing(poly, pt)
    setIntersectionAnalysis(analysis)

    toast({
      title: 'Cruzamento Espacial Realizado',
      description: `Resultado: ${
        analysis.result === 'intersecao_encontrada'
          ? 'Interseção encontrada na base consultada'
          : analysis.result === 'nenhuma_intersecao_encontrada'
            ? 'Nenhuma interseção encontrada na base consultada'
            : 'Consulta inconclusiva — informação insuficiente ou incompatível'
      }`,
    })
  }

  // Salvar Consulta
  const handleSaveConsultation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!processNumber.trim() || !locationAddress.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Informe o número do processo e o endereço do terreno.',
      })
      return
    }

    let poly: [number, number][] = [...drawnPoints]
    let pt: [number, number] | undefined = undefined
    if (coordsInput.trim()) {
      const parts = coordsInput.split(',').map((p) => parseFloat(p.trim()))
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        pt = [parts[0], parts[1]]
      }
    }

    const analysis = intersectionAnalysis || runSpatialCrossing(poly, pt)

    const disclaimer =
      'AVISO TÉCNICO E LEGAL: A presente consulta baseia-se exclusivamente nas camadas espaciais registradas no sistema municipal de Ibiúna na data da emissão. NÃO declara terreno sem risco, NÃO substitui laudo pericial ou sondagem geotécnica, NÃO aprova loteamento automaticamente e requer parecer conclusivo da análise técnica municipal.'

    try {
      const payload: Partial<UrbanConsultation> = {
        municipality: user?.municipality || 'cw9b6e2pqv89i3p',
        process_number: processNumber.trim(),
        requester_name: requesterName.trim() || undefined,
        purpose,
        location_address: locationAddress.trim(),
        neighborhood: neighborhood.trim() || undefined,
        latitude: pt ? pt[0] : poly.length > 0 ? poly[0][0] : undefined,
        longitude: pt ? pt[1] : poly.length > 0 ? poly[0][1] : undefined,
        perimeter_geojson:
          poly.length >= 3
            ? JSON.stringify({
                type: 'Polygon',
                coordinates: [poly.map((p) => [p[1], p[0]])],
              })
            : perimeterGeoJsonText.trim() || undefined,
        perimeter_source:
          poly.length >= 3
            ? 'desenhado_mapa'
            : perimeterGeoJsonText.trim()
              ? 'importado_geojson'
              : 'ponto_preliminar',
        responsible_officer: responsibleOfficer.trim() || user?.name || 'Operador',
        department_sender: departmentSender.trim(),
        analysis_status: 'registrada',
        intersection_result: analysis.result,
        intersection_details: {
          intersections: analysis.hits,
          layers_consulted: analysis.layersConsulted,
          evaluation_date: new Date().toISOString(),
          technical_limitations:
            'A base IPT possui 290 setores e 202 trechos; geometrias ausentes dependem de conferência e upload de arquivo de polígonos.',
        },
        technical_disclaimer: disclaimer,
        observations: observations.trim() || undefined,
        created_by: user?.id,
      }

      await urbanConsultationsService.create(payload)

      await auditLogService.create({
        action: 'registrar_consulta_urbana',
        collection: 'urban_consultations',
        details: `Consulta do processo ${processNumber} registrada com resultado: ${analysis.result}`,
      })

      toast({
        title: 'Consulta Territorial Registrada',
        description: 'Processo cadastrado e cruzado com as bases municipais.',
      })

      setIsModalOpen(false)
      resetForm()
      loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar consulta',
        description: err.message,
      })
    }
  }

  const resetForm = () => {
    setProcessNumber('')
    setRequesterName('')
    setPurpose('loteamento')
    setLocationAddress('')
    setNeighborhood('')
    setCoordsInput('')
    setPerimeterGeoJsonText('')
    setDrawnPoints([])
    setObservations('')
    setIntersectionAnalysis(null)
  }

  // Encaminhar ou Atualizar Status
  const handleUpdateStatus = async () => {
    if (!selectedConsultation) return
    try {
      const updatedNotes = technicalNotes.trim()
        ? `${selectedConsultation.observations || ''}\n\n[${new Date().toLocaleDateString('pt-BR')} - ${user?.name}]: ${technicalNotes.trim()}`
        : selectedConsultation.observations

      await urbanConsultationsService.update(selectedConsultation.id, {
        analysis_status: newStatus,
        observations: updatedNotes,
      })

      await auditLogService.create({
        action: 'atualizar_status_consulta_urbana',
        collection: 'urban_consultations',
        record_id: selectedConsultation.id,
        details: `Processo ${selectedConsultation.process_number} alterado para ${newStatus} por ${user?.name}`,
      })

      toast({
        title: 'Status Atualizado',
        description: `Processo ${selectedConsultation.process_number} atualizado com sucesso.`,
      })

      setIsDetailOpen(false)
      setTechnicalNotes('')
      loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: err.message,
      })
    }
  }

  // Filtragem
  const filtered = consultations.filter((c) => {
    const q = search.toLowerCase()
    const matchSearch =
      search === '' ||
      c.process_number.toLowerCase().includes(q) ||
      (c.location_address && c.location_address.toLowerCase().includes(q)) ||
      (c.requester_name && c.requester_name.toLowerCase().includes(q))

    const matchStatus = statusFilter === 'all' || c.analysis_status === statusFilter
    const matchResult = resultFilter === 'all' || c.intersection_result === resultFilter

    return matchSearch && matchStatus && matchResult
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-amber-600 to-orange-700 text-white rounded-xl shadow-md">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Consulta Territorial — Desenvolvimento Urbano
              </h1>
              <Badge
                variant="outline"
                className="text-xs bg-amber-50 text-amber-800 border-amber-200"
              >
                Parcelamento de Solo & Riscos
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Cruzamento de perímetros de loteamentos e processos com setores IPT, trechos de perigo
              e camadas municipais.
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

          <Button
            size="sm"
            onClick={() => {
              resetForm()
              setIsModalOpen(true)
            }}
            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-9 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nova Consulta de Processo
          </Button>
        </div>
      </div>

      {/* Alerta de Ressalva Normativa Permanente */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-3 shadow-xs">
        <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-amber-900">
            Diretriz Técnica para Aprovação de Loteamentos e Parcelamentos:
          </p>
          <p className="text-slate-700 leading-relaxed">
            O resultado deste cruzamento reflete a base cartográfica existente.
            <strong>
              {' '}
              Em nenhuma hipótese o sistema emitirá atestado de "terreno sem risco" ou aprovação
              automática.
            </strong>
            Toda consulta gera registro auditável com camadas, fontes e limitações, e deve ser
            encaminhada à análise técnica municipal de campo.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500">Consultas Registradas</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{consultations.length}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Processos protocolados</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/30">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-red-800">Interseção Encontrada</p>
            <p className="text-2xl font-bold text-red-900 mt-1">
              {
                consultations.filter((c) => c.intersection_result === 'intersecao_encontrada')
                  .length
              }
            </p>
            <p className="text-[10px] text-red-700 mt-0.5">
              Cruzamento com setores/trechos de risco
            </p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-emerald-800">Nenhuma Interseção</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">
              {
                consultations.filter(
                  (c) => c.intersection_result === 'nenhuma_intersecao_encontrada',
                ).length
              }
            </p>
            <p className="text-[10px] text-emerald-700 mt-0.5">
              Na base consultada (requer vistoria)
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-amber-800">Inconclusiva / Insuficiente</p>
            <p className="text-2xl font-bold text-amber-900 mt-1">
              {
                consultations.filter(
                  (c) => c.intersection_result === 'inconclusiva_informacao_insuficiente',
                ).length
              }
            </p>
            <p className="text-[10px] text-amber-700 mt-0.5">
              Geometrias pendentes ou incompatíveis
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por nº do processo, requerente ou endereço do terreno..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            <div className="w-full md:w-56">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Situação da Análise" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Situações</SelectItem>
                  <SelectItem value="registrada">Registrada</SelectItem>
                  <SelectItem value="encaminhada_analise">Encaminhada à Análise</SelectItem>
                  <SelectItem value="em_analise_tecnica">Em Análise Técnica</SelectItem>
                  <SelectItem value="vistoria_solicitada">Vistoria Solicitada</SelectItem>
                  <SelectItem value="parecer_emitido">Parecer Emitido</SelectItem>
                  <SelectItem value="arquivada">Arquivada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:w-64">
              <Select value={resultFilter} onValueChange={setResultFilter}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Resultado do Cruzamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Resultados</SelectItem>
                  <SelectItem value="intersecao_encontrada">Interseção Encontrada</SelectItem>
                  <SelectItem value="nenhuma_intersecao_encontrada">Nenhuma Interseção</SelectItem>
                  <SelectItem value="inconclusiva_informacao_insuficiente">
                    Consulta Inconclusiva
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Consultas */}
      <Card className="border-slate-200 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-slate-700">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Processo</th>
                <th className="py-3 px-4">Finalidade</th>
                <th className="py-3 px-4">Localização</th>
                <th className="py-3 px-4">Perímetro</th>
                <th className="py-3 px-4">Resultado do Cruzamento</th>
                <th className="py-3 px-4">Situação</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Nenhuma consulta territorial encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {item.process_number}
                        {item.requester_name && (
                          <span className="block text-[10px] font-normal text-slate-500">
                            {item.requester_name}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 capitalize">
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {item.purpose || 'loteamento'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-medium text-slate-800 line-clamp-1">
                          {item.location_address}
                        </p>
                        {item.neighborhood && (
                          <p className="text-[10px] text-slate-500">{item.neighborhood}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-[10px]">
                        {item.perimeter_source === 'desenhado_mapa' && (
                          <span className="text-blue-700 font-medium">Polígono Desenhado</span>
                        )}
                        {item.perimeter_source === 'importado_geojson' && (
                          <span className="text-purple-700 font-medium">GeoJSON Importado</span>
                        )}
                        {item.perimeter_source === 'ponto_preliminar' && (
                          <span className="text-amber-700 font-medium">
                            Coordenada Pontual Preliminar
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {item.intersection_result === 'intersecao_encontrada' && (
                          <Badge className="bg-red-50 text-red-700 border-red-200 hover:bg-red-50 font-semibold">
                            Interseção Encontrada
                          </Badge>
                        )}
                        {item.intersection_result === 'nenhuma_intersecao_encontrada' && (
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 font-semibold">
                            Nenhuma Interseção
                          </Badge>
                        )}
                        {item.intersection_result === 'inconclusiva_informacao_insuficiente' && (
                          <Badge className="bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-50 font-semibold">
                            Consulta Inconclusiva
                          </Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-4 capitalize">
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {item.analysis_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedConsultation(item)
                            setNewStatus(item.analysis_status)
                            setIsDetailOpen(true)
                          }}
                          className="h-8 text-xs font-semibold text-slate-700 hover:text-blue-600"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Ver Ficha
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Nova Consulta */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Registrar Consulta Territorial de Processo
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cadastre o processo municipal e realize o cruzamento cartográfico com setores IPT e
              camadas oficiais.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveConsultation} className="space-y-4 text-xs pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Número do Processo Municipal *
                </Label>
                <Input
                  placeholder="Ex: PROC-2026/0149-LOT"
                  value={processNumber}
                  onChange={(e) => setProcessNumber(e.target.value)}
                  className="mt-1 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Finalidade da Consulta *
                </Label>
                <Select value={purpose} onValueChange={(v: any) => setPurpose(v)}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="loteamento">Loteamento / Gleba</SelectItem>
                    <SelectItem value="desmembramento">Desmembramento</SelectItem>
                    <SelectItem value="parcelamento">Parcelamento do Solo</SelectItem>
                    <SelectItem value="construcao">Alvará de Construção</SelectItem>
                    <SelectItem value="regularizacao">Regularização Fundiária (REURB)</SelectItem>
                    <SelectItem value="outro">Outro Processo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Requerente / Interessado
                </Label>
                <Input
                  placeholder="Nome do proprietário ou empreendedor"
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Responsável pela Consulta *
                </Label>
                <Input
                  value={responsibleOfficer}
                  onChange={(e) => setResponsibleOfficer(e.target.value)}
                  className="mt-1 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Localização / Endereço do Imóvel *
                </Label>
                <Input
                  placeholder="Rua, Estrada Municipal, Km, Referência"
                  value={locationAddress}
                  onChange={(e) => setLocationAddress(e.target.value)}
                  className="mt-1 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Bairro / Região</Label>
                <Input
                  placeholder="Ex: Paruru, Centro, Gabriel, Verava"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            {/* Delimitação do Terreno */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                Delimitação do Perímetro da Propriedade
              </h4>
              <p className="text-[11px] text-slate-500">
                Coordenadas pontuais representam localização preliminar, mas NÃO representam a
                propriedade inteira. Desenhe o perímetro no mapa ou cole o GeoJSON da matrícula.
              </p>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Coordenada Pontual Preliminar (Lat, Lon Decimais WGS84)
                </Label>
                <Input
                  placeholder="Ex: -23.655100, -47.221500"
                  value={coordsInput}
                  onChange={(e) => setCoordsInput(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Perímetro em Polígono GeoJSON (Opcional)
                </Label>
                <Textarea
                  placeholder='Ex: {"type":"Polygon","coordinates":[[[-47.22,-23.65],[-47.21,-23.65],[-47.21,-23.66],[-47.22,-23.65]]]}'
                  value={perimeterGeoJsonText}
                  onChange={(e) => setPerimeterGeoJsonText(e.target.value)}
                  className="mt-1 text-[11px] font-mono min-h-[60px]"
                />
              </div>

              <div className="pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handlePerformAnalysis}
                  className="text-xs font-semibold"
                >
                  <Layers className="w-3.5 h-3.5 mr-1 text-blue-600" />
                  Executar Cruzamento Espacial
                </Button>
              </div>

              {/* Resultado prévio do cruzamento */}
              {intersectionAnalysis && (
                <div
                  className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                    intersectionAnalysis.result === 'intersecao_encontrada'
                      ? 'bg-red-50 border-red-200 text-red-950'
                      : intersectionAnalysis.result === 'nenhuma_intersecao_encontrada'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : 'bg-amber-50 border-amber-200 text-amber-950'
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold">
                    {intersectionAnalysis.result === 'intersecao_encontrada' && (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    )}
                    {intersectionAnalysis.result === 'nenhuma_intersecao_encontrada' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                    {intersectionAnalysis.result === 'inconclusiva_informacao_insuficiente' && (
                      <Info className="w-4 h-4 text-amber-600" />
                    )}
                    <span>
                      {intersectionAnalysis.result === 'intersecao_encontrada'
                        ? 'Interseção encontrada na base consultada'
                        : intersectionAnalysis.result === 'nenhuma_intersecao_encontrada'
                          ? 'Nenhuma interseção encontrada na base consultada'
                          : 'Consulta inconclusiva — informação insuficiente ou incompatível'}
                    </span>
                  </div>

                  {intersectionAnalysis.hits.length > 0 && (
                    <div className="pt-1 space-y-1">
                      <p className="font-semibold">Registros Encontrados no Cruzamento:</p>
                      <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                        {intersectionAnalysis.hits.map((hit, idx) => (
                          <li key={idx}>
                            <strong>{hit.layer}:</strong> {hit.code} - {hit.name} (Risco:{' '}
                            {hit.risk_level})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-600 pt-1">
                    Bases consultadas: {intersectionAnalysis.layersConsulted.join('; ')}
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Observações Técnicas / Encaminhamento
              </Label>
              <Textarea
                placeholder="Indique despachos, anexos de plantas, certidões ou diretrizes específicas..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                className="mt-1 text-xs min-h-[70px]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
              >
                Registrar Consulta de Processo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Detalhes / Ficha do Processo */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          {selectedConsultation && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-base font-bold text-slate-900">
                      Processo: {selectedConsultation.process_number}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                      Finalidade: {selectedConsultation.purpose} | Requerente:{' '}
                      {selectedConsultation.requester_name || 'Não informado'}
                    </DialogDescription>
                  </div>
                  <Badge className="capitalize">
                    {selectedConsultation.analysis_status.replace(/_/g, ' ')}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-4 text-xs py-2">
                {/* Resultado do Cruzamento */}
                <div
                  className={`p-3.5 rounded-xl border space-y-1.5 ${
                    selectedConsultation.intersection_result === 'intersecao_encontrada'
                      ? 'bg-red-50 border-red-200 text-red-950'
                      : selectedConsultation.intersection_result === 'nenhuma_intersecao_encontrada'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : 'bg-amber-50 border-amber-200 text-amber-950'
                  }`}
                >
                  <p className="font-bold flex items-center gap-1.5 text-sm">
                    {selectedConsultation.intersection_result === 'intersecao_encontrada' && (
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                    )}
                    {selectedConsultation.intersection_result ===
                      'nenhuma_intersecao_encontrada' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    )}
                    {selectedConsultation.intersection_result ===
                      'inconclusiva_informacao_insuficiente' && (
                      <Info className="w-4 h-4 text-amber-600" />
                    )}
                    {selectedConsultation.intersection_result === 'intersecao_encontrada'
                      ? 'Interseção encontrada na base consultada'
                      : selectedConsultation.intersection_result === 'nenhuma_intersecao_encontrada'
                        ? 'Nenhuma interseção encontrada na base consultada'
                        : 'Consulta inconclusiva — informação insuficiente ou incompatível'}
                  </p>

                  {selectedConsultation.intersection_details?.intersections &&
                    selectedConsultation.intersection_details.intersections.length > 0 && (
                      <div className="pt-1.5 space-y-1">
                        <p className="font-semibold text-slate-900">
                          Camadas e Feições com Interseção:
                        </p>
                        <div className="space-y-1 pl-1">
                          {selectedConsultation.intersection_details.intersections.map((hit, i) => (
                            <div
                              key={i}
                              className="p-2 rounded bg-white/80 border border-slate-200 text-[11px]"
                            >
                              <p className="font-bold text-slate-800">
                                {hit.layer}: {hit.code} - {hit.name}
                              </p>
                              <p className="text-slate-600">
                                Risco: {hit.risk_level} | Fonte: {hit.source}
                              </p>
                              {hit.notes && (
                                <p className="text-slate-500 italic mt-0.5">{hit.notes}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </div>

                {/* Ressalva Técnica Obrigatória */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-600 text-[11px] space-y-1">
                  <p className="font-semibold text-slate-800">Ressalva Institucional:</p>
                  <p>{selectedConsultation.technical_disclaimer}</p>
                </div>

                {/* Dados Cadastrais */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-slate-500 block">Endereço do Imóvel:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedConsultation.location_address}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Bairro:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedConsultation.neighborhood || 'Não informado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Responsável pela Consulta:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedConsultation.responsible_officer}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Órgão Solicitante:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedConsultation.department_sender || 'Desenvolvimento Urbano'}
                    </span>
                  </div>
                </div>

                {/* Abas de Anexos do Processo (Plantas, Vistorias, Memoriais) */}
                <div className="pt-2">
                  <h4 className="font-bold text-slate-800 mb-2">Documentos e Plantas Anexas</h4>
                  <RecordAttachmentsTab
                    targetCollection="urban_consultations"
                    targetId={selectedConsultation.id}
                  />
                </div>

                {/* Atualização de Situação e Encaminhamento */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">
                    Encaminhar / Atualizar Situação
                  </Label>
                  <Select value={newStatus} onValueChange={(v: any) => setNewStatus(v)}>
                    <SelectTrigger className="text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="registrada">Registrada</SelectItem>
                      <SelectItem value="encaminhada_analise">
                        Encaminhada à Análise Técnica
                      </SelectItem>
                      <SelectItem value="em_analise_tecnica">Em Análise Técnica</SelectItem>
                      <SelectItem value="vistoria_solicitada">Vistoria Solicitada</SelectItem>
                      <SelectItem value="parecer_emitido">Parecer Técnico Emitido</SelectItem>
                      <SelectItem value="arquivada">Arquivada</SelectItem>
                    </SelectContent>
                  </Select>

                  <Textarea
                    placeholder="Adicionar despacho ou parecer técnico ao histórico..."
                    value={technicalNotes}
                    onChange={(e) => setTechnicalNotes(e.target.value)}
                    className="mt-1 text-xs min-h-[60px]"
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDetailOpen(false)}
                  className="text-xs"
                >
                  Fechar
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpdateStatus}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
                >
                  Salvar Andamento do Processo
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default UrbanDevelopmentPage
