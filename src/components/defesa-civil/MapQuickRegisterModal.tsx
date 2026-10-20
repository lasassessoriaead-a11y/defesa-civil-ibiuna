import React, { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  Building2,
  Layers,
  Navigation,
  MapPin,
  CheckCircle2,
  Info,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import {
  occurrencesService,
  strategicInfrastructuresService,
  riskSectorsService,
  dangerStretchesService,
  auditLogService,
} from '@/services/defesa-civil'
import { calculateDistanceMeters, dmsToDecimal } from '@/lib/geo-utils'
import type {
  Occurrence,
  StrategicInfrastructure,
  RiskSector,
  DangerStretch,
} from '@/types/defesa-civil'

export type QuickRegisterMode = 'occurrence' | 'bridge' | 'risk_sector' | 'danger_stretch'

export interface MapQuickRegisterModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMode: QuickRegisterMode
  coordinate: { lat: number; lng: number }
  // Contexto de dados existentes no mapa para checagem rápida de duplicidade (raio de ~100m)
  existingOccurrences?: Occurrence[]
  existingInfrastructures?: StrategicInfrastructure[]
  existingRiskSectors?: RiskSector[]
  existingDangerStretches?: DangerStretch[]
  onSuccess?: (type: QuickRegisterMode, record: any) => void
}

export const MapQuickRegisterModal: React.FC<MapQuickRegisterModalProps> = ({
  open,
  onOpenChange,
  initialMode,
  coordinate,
  existingOccurrences = [],
  existingInfrastructures = [],
  existingRiskSectors = [],
  existingDangerStretches = [],
  onSuccess,
}) => {
  const { user } = useAuth()
  const [mode, setMode] = useState<QuickRegisterMode>(initialMode)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sincroniza modo inicial quando o modal abre
  useEffect(() => {
    if (open) {
      setMode(initialMode)
    }
  }, [open, initialMode])

  // --- Estados Ocorrência ---
  const [occTitle, setOccTitle] = useState('')
  const [occType, setOccType] = useState<string>('enchente')
  const [occSeverity, setOccSeverity] = useState<string>('media')
  const [occDescription, setOccDescription] = useState('')
  const [occAddress, setOccAddress] = useState('')

  // --- Estados Ponte/Aduela ---
  const [bridgeCode, setBridgeCode] = useState('')
  const [bridgeType, setBridgeType] = useState<'ponte' | 'aduela' | 'bueiro' | 'passarela'>('ponte')
  const [bridgeNeighborhood, setBridgeNeighborhood] = useState('')
  const [bridgeRefPoint, setBridgeRefPoint] = useState('')
  const [bridgeNotes, setBridgeNotes] = useState('')

  // Sugere próximo código PM-XXX
  useEffect(() => {
    if (open && mode === 'bridge') {
      const pmCodes = existingInfrastructures
        .map((i) => i.original_code || '')
        .filter((c) => /^PM-\d+$/i.test(c))
        .map((c) => parseInt(c.replace(/\D/g, ''), 10))
        .filter((n) => !isNaN(n))

      const maxNumber = pmCodes.length > 0 ? Math.max(...pmCodes) : 1
      const nextCode = `PM-${String(maxNumber + 1).padStart(3, '0')}`
      setBridgeCode((prev) => (prev ? prev : nextCode))
    }
  }, [open, mode, existingInfrastructures])

  // --- Estados Área de Risco Municipal ---
  const [sectorName, setSectorName] = useState('')
  const [sectorRiskLevel, setSectorRiskLevel] = useState<'R1' | 'R2' | 'R3' | 'R4'>('R2')
  const [sectorProcessType, setSectorProcessType] = useState('escorregamento-ESC')
  const [sectorDescription, setSectorDescription] = useState('')
  const [sectorRadiusMeters, setSectorRadiusMeters] = useState(50)
  const [sectorPolygonMode, setSectorPolygonMode] = useState<'radius' | 'custom'>('radius')
  const [customPolygonVertices, setCustomPolygonVertices] = useState<[number, number][]>([])

  // Gera polígono circular inicial em torno da coordenada clicada
  const generatedSectorPolygon = useMemo<[number, number][]>(() => {
    if (sectorPolygonMode === 'custom' && customPolygonVertices.length >= 3) {
      return customPolygonVertices
    }
    // Cria anel de 8 vértices a partir do raio em metros
    const points: [number, number][] = []
    const lat = coordinate.lat
    const lng = coordinate.lng
    const r = sectorRadiusMeters
    const earthRadius = 6371000
    const numPoints = 8
    for (let i = 0; i < numPoints; i++) {
      const angle = (i * 2 * Math.PI) / numPoints
      const dLat = (r * Math.cos(angle)) / earthRadius
      const dLng = (r * Math.sin(angle)) / (earthRadius * Math.cos((lat * Math.PI) / 180))
      points.push([
        Number((lat + (dLat * 180) / Math.PI).toFixed(6)),
        Number((lng + (dLng * 180) / Math.PI).toFixed(6)),
      ])
    }
    return points
  }, [coordinate, sectorRadiusMeters, sectorPolygonMode, customPolygonVertices])

  // --- Estados Trecho de Perigo Municipal ---
  const [stretchLocation, setStretchLocation] = useState('')
  const [stretchProcessType, setStretchProcessType] = useState('enxurrada-ENX')
  const [stretchRiskLevel, setStretchRiskLevel] = useState<
    'R1' | 'R2' | 'R3' | 'R4' | 'indefinido'
  >('indefinido')
  const [stretchLengthMeters, setStretchLengthMeters] = useState(100)
  const [stretchDirection, setStretchDirection] = useState<'north_south' | 'east_west'>(
    'north_south',
  )
  const [customLineVertices, setCustomLineVertices] = useState<[number, number][]>([])
  const [stretchLineMode, setStretchLineMode] = useState<'segment' | 'custom'>('segment')

  // Gera linha inicial a partir do ponto clicado
  const generatedStretchLine = useMemo<[number, number][]>(() => {
    if (stretchLineMode === 'custom' && customLineVertices.length >= 2) {
      return customLineVertices
    }
    const lat = coordinate.lat
    const lng = coordinate.lng
    const len = stretchLengthMeters
    const earthRadius = 6371000
    if (stretchDirection === 'north_south') {
      const dLat = (len / earthRadius) * (180 / Math.PI)
      return [
        [Number((lat - dLat / 2).toFixed(6)), lng],
        [Number((lat + dLat / 2).toFixed(6)), lng],
      ]
    } else {
      const dLng = ((len / earthRadius) * (180 / Math.PI)) / Math.cos((lat * Math.PI) / 180)
      return [
        [lat, Number((lng - dLng / 2).toFixed(6))],
        [lat, Number((lng + dLng / 2).toFixed(6))],
      ]
    }
  }, [coordinate, stretchLengthMeters, stretchDirection, stretchLineMode, customLineVertices])

  // --- Detecção de Registros Próximos (Raio 150m) para Alerta de Duplicidade ---
  const nearbyItems = useMemo(() => {
    const radius = 150
    const lat = coordinate.lat
    const lng = coordinate.lng

    const nearbyOccs = existingOccurrences
      .filter((o) => o.latitude !== undefined && o.longitude !== undefined)
      .map((o) => ({
        type: 'occurrence' as const,
        title: o.title || o.code || 'Ocorrência',
        code: o.code || '',
        distance: calculateDistanceMeters(lat, lng, o.latitude!, o.longitude!),
      }))
      .filter((o) => o.distance <= radius)

    const nearbyInfras = existingInfrastructures
      .filter((i) => i.latitude !== undefined && i.longitude !== undefined)
      .map((i) => ({
        type: 'bridge' as const,
        title: `${i.original_code || 'Infra'} (${i.type || 'Ponte'})`,
        code: i.original_code || '',
        distance: calculateDistanceMeters(lat, lng, i.latitude!, i.longitude!),
      }))
      .filter((i) => i.distance <= radius)

    return [...nearbyOccs, ...nearbyInfras].sort((a, b) => a.distance - b.distance)
  }, [coordinate, existingOccurrences, existingInfrastructures])

  // Submissão do formulário
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    const municipalityId = user?.municipality || 'cw9b6e2pqv89i3p'
    const authorName = user?.name || user?.email || 'Agente Municipal'

    try {
      if (mode === 'occurrence') {
        if (!occTitle.trim()) {
          toast({ variant: 'destructive', title: 'Título é obrigatório' })
          setIsSubmitting(false)
          return
        }

        const payload: Partial<Occurrence> = {
          title: occTitle.trim(),
          description: occDescription.trim(),
          type: occType as any,
          severity: occSeverity as any,
          status: 'reportada',
          origin: 'outro',
          latitude: coordinate.lat,
          longitude: coordinate.lng,
          address: occAddress.trim() || undefined,
          location_origin: 'mapa',
          address_confirmed: false,
          municipality: municipalityId,
          reported_by: user?.id,
        }

        const created = await occurrencesService.create(payload, authorName)

        await auditLogService.create({
          action: 'create',
          resource: 'occurrences',
          record_id: created.id,
          details: `Nova ocorrência "${created.title}" registrada via clique no mapa [${coordinate.lat}, ${coordinate.lng}]`,
        })

        toast({
          title: 'Ocorrência registrada no local!',
          description: `Gravada com coordenadas [${coordinate.lat.toFixed(5)}, ${coordinate.lng.toFixed(5)}].`,
        })

        onSuccess?.('occurrence', created)
        onOpenChange(false)
      } else if (mode === 'bridge') {
        if (!bridgeCode.trim()) {
          toast({ variant: 'destructive', title: 'Código de identificação é obrigatório' })
          setIsSubmitting(false)
          return
        }

        // Regra de qualidade: novas pontes manuais seguem padrão municipal, pendente_conferencia, condição "nao_avaliado"
        const payload: Partial<StrategicInfrastructure> = {
          original_code: bridgeCode.trim().toUpperCase(),
          type: bridgeType,
          neighborhood: bridgeNeighborhood.trim() || undefined,
          reference_point: bridgeRefPoint.trim() || undefined,
          notes:
            bridgeNotes.trim() ||
            `Cadastro municipal criado via clique no mapa em ${new Date().toLocaleDateString('pt-BR')} por ${authorName}.`,
          latitude: coordinate.lat,
          longitude: coordinate.lng,
          coordinate_status: 'valida',
          validation_status: 'pendente_conferencia',
          structural_condition: 'nao_avaliado',
          administrative_priority: 'media',
          inspection_status: 'necessita_vistoria',
          source_document: 'Levantamento Municipal — Cadastro Externo',
          source_page: 1,
          is_handwritten_transcription: false,
          municipality: municipalityId,
        }

        const created = await strategicInfrastructuresService.create(payload)

        await auditLogService.create({
          action: 'create',
          resource: 'strategic_infrastructures',
          record_id: created.id,
          details: `Nova infraestrutura municipal "${created.original_code}" criada via mapa em [${coordinate.lat}, ${coordinate.lng}]. Pendente de conferência.`,
        })

        toast({
          title: 'Infraestrutura cadastrada!',
          description: `${created.original_code} adicionada com coordenadas salvas. Situação: pendente_conferência / não avaliado.`,
        })

        onSuccess?.('bridge', created)
        onOpenChange(false)
      } else if (mode === 'risk_sector') {
        if (!sectorName.trim()) {
          toast({ variant: 'destructive', title: 'Nome da localidade da área é obrigatório' })
          setIsSubmitting(false)
          return
        }

        // Formata geometria GeoJSON Polygon com [lng, lat]
        const ring = generatedSectorPolygon.map(([lat, lng]) => [lng, lat])
        // Garante fechamento do polígono
        if (ring.length > 0) {
          const first = ring[0]
          const last = ring[ring.length - 1]
          if (first[0] !== last[0] || first[1] !== last[1]) {
            ring.push([first[0], first[1]])
          }
        }

        const geoJsonObj = {
          type: 'MultiPolygon',
          coordinates: [[ring]],
        }

        const sectorCode = `MUN-AR-${Date.now().toString(36).toUpperCase()}`

        // Regra de qualidade: fonte="registro manual no mapa", data, responsável, avaliação, NUNCA IPT
        const payload: Partial<RiskSector> = {
          code: sectorCode,
          sector_number: 'Municipal',
          area_name: sectorName.trim(),
          location: sectorName.trim(),
          process_type: sectorProcessType,
          risk_level: sectorRiskLevel,
          risk_grade: `${sectorRiskLevel}-Municipal`,
          validation_status: 'pendente_conferencia',
          geometry_status: 'vinculada',
          geometry_geojson: JSON.stringify(geoJsonObj),
          import_source: 'registro manual no mapa',
          notes: `Área de risco cadastrada pelo usuário municipal ${authorName} em ${new Date().toLocaleDateString('pt-BR')} a partir de clique no mapa. Avaliação preliminar pendente de vistoria técnica de campo. Não constitui mapeamento oficial IPT.`,
          description:
            sectorDescription.trim() ||
            'Área identificada via inserção manual no mapa operacional.',
          municipality: municipalityId,
        }

        const created = await riskSectorsService.create(payload)

        await auditLogService.create({
          action: 'create',
          resource: 'risk_sectors',
          record_id: created.id,
          details: `Nova área de risco municipal "${created.code}" (${created.area_name}) registrada no mapa por ${authorName}. Fonte: registro manual no mapa.`,
        })

        toast({
          title: 'Área de Risco Municipal registrada!',
          description: `Identificador ${created.code} gerado. Marcada como registro manual no mapa (não IPT).`,
        })

        onSuccess?.('risk_sector', created)
        onOpenChange(false)
      } else if (mode === 'danger_stretch') {
        if (!stretchLocation.trim()) {
          toast({ variant: 'destructive', title: 'Localização/Logradouro do trecho é obrigatório' })
          setIsSubmitting(false)
          return
        }

        // Formata geometria LineString GeoJSON [lng, lat]
        const line = generatedStretchLine.map(([lat, lng]) => [lng, lat])
        const geoJsonObj = {
          type: 'MultiLineString',
          coordinates: [line],
        }

        const stretchCode = `MUN-TP-${Date.now().toString(36).toUpperCase()}`

        // Regra de qualidade: fonte="registro manual no mapa", data, responsável, NUNCA IPT
        const payload: Partial<DangerStretch> = {
          code: stretchCode,
          stretch_number: 'Municipal',
          area_name: stretchLocation.trim(),
          location: stretchLocation.trim(),
          process_type: stretchProcessType,
          risk_level: stretchRiskLevel,
          validation_status: 'pendente_conferencia',
          geometry_status: 'vinculada',
          geometry_geojson: JSON.stringify(geoJsonObj),
          import_source: 'registro manual no mapa',
          notes: `Trecho de perigo cadastrado pelo usuário municipal ${authorName} em ${new Date().toLocaleDateString('pt-BR')} via clique no mapa. Linha aproximada (${stretchLengthMeters}m). Não constitui mapeamento oficial IPT.`,
          description: `Trecho de via com risco de ${stretchProcessType} registrado manualmente no mapa.`,
          municipality: municipalityId,
        }

        const created = await dangerStretchesService.create(payload)

        await auditLogService.create({
          action: 'create',
          resource: 'danger_stretches',
          record_id: created.id,
          details: `Novo trecho de perigo municipal "${created.code}" registrado no mapa por ${authorName}. Fonte: registro manual no mapa.`,
        })

        toast({
          title: 'Trecho de Perigo Municipal registrado!',
          description: `${created.code} criado com linha no mapa. Fonte: registro manual no mapa.`,
        })

        onSuccess?.('danger_stretch', created)
        onOpenChange(false)
      }
    } catch (err: any) {
      console.error('[MapQuickRegisterModal] Erro ao gravar registro:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar no local',
        description: err.message || 'Verifique os campos e sua conexão.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-100 text-blue-700">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900">
                Registrar Neste Local do Mapa
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-mono mt-0.5">
                Coordenadas WGS84: {coordinate.lat.toFixed(6)}, {coordinate.lng.toFixed(6)}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Abas dos 4 tipos de cadastro solicitados */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-lg text-xs">
          <button
            type="button"
            onClick={() => setMode('occurrence')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md font-semibold transition-all ${
              mode === 'occurrence'
                ? 'bg-white text-red-700 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
            <span className="truncate">Ocorrência</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('bridge')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md font-semibold transition-all ${
              mode === 'bridge'
                ? 'bg-white text-emerald-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">Ponte/Aduela</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('risk_sector')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md font-semibold transition-all ${
              mode === 'risk_sector'
                ? 'bg-white text-orange-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-orange-600 shrink-0" />
            <span className="truncate">Área Municipal</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('danger_stretch')}
            className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-md font-semibold transition-all ${
              mode === 'danger_stretch'
                ? 'bg-white text-blue-800 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Navigation className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="truncate">Trecho Perigo</span>
          </button>
        </div>

        {/* Alerta de Possível Duplicidade (Registros a menos de 150m) */}
        {nearbyItems.length > 0 && (
          <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-900">
              <Info className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Aviso de Proximidade / Possível Duplicidade</span>
            </div>
            <p className="text-[11px] text-amber-800">
              Existem {nearbyItems.length} registro(s) a menos de 150 metros deste ponto:
            </p>
            <div className="flex flex-wrap gap-1 pt-0.5">
              {nearbyItems.slice(0, 3).map((item, idx) => (
                <Badge
                  key={idx}
                  variant="outline"
                  className="bg-white text-amber-900 border-amber-300 text-[10px]"
                >
                  {item.title} ({item.distance}m)
                </Badge>
              ))}
              {nearbyItems.length > 3 && (
                <span className="text-[10px] text-amber-700 font-medium">
                  +{nearbyItems.length - 3} outros
                </span>
              )}
            </div>
          </div>
        )}

        {/* FORMULÁRIO DINÂMICO CONFORME O MODO */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* 1) MODO: NOVA OCORRÊNCIA */}
          {mode === 'occurrence' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold">
                    Título da Ocorrência <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Ex: Alagamento de via pública / Queda de barreira"
                    value={occTitle}
                    onChange={(e) => setOccTitle(e.target.value)}
                    required
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Tipo do Evento</Label>
                  <Select value={occType} onValueChange={setOccType}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enchente">Enchente / Alagamento</SelectItem>
                      <SelectItem value="deslizamento">Deslizamento / Escorregamento</SelectItem>
                      <SelectItem value="tempestade">Tempestade / Vendaval</SelectItem>
                      <SelectItem value="granizo">Granizo</SelectItem>
                      <SelectItem value="incendio_florestal">Incêndio Florestal</SelectItem>
                      <SelectItem value="seca">Estiagem / Seca</SelectItem>
                      <SelectItem value="outro">Outro Evento</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Gravidade Inicial</Label>
                  <Select value={occSeverity} onValueChange={setOccSeverity}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="baixa">Baixa</SelectItem>
                      <SelectItem value="media">Média</SelectItem>
                      <SelectItem value="alta">Alta</SelectItem>
                      <SelectItem value="critica">Crítica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold">
                    Endereço / Referência Textual (Opcional)
                  </Label>
                  <Input
                    placeholder="Ex: Estrada Municipal do Verava, próximo ao km 4"
                    value={occAddress}
                    onChange={(e) => setOccAddress(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold">Descrição / Observações</Label>
                  <Textarea
                    placeholder="Detalhes observados no local, impactos no trânsito ou moradores..."
                    value={occDescription}
                    onChange={(e) => setOccDescription(e.target.value)}
                    rows={2}
                    className="text-xs resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2) MODO: NOVA PONTE/ADUELA */}
          {mode === 'bridge' && (
            <div className="space-y-3">
              <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-md text-[11px] text-blue-900 leading-relaxed">
                <strong>Regra Municipal:</strong> Segue o padrão de código <code>PM-XXX</code>{' '}
                (conforme PM-001). Condição estrutural inicial: <em>não avaliado</em> e situação de
                vistoria: <em>necessita vistoria</em> até realização da vistoria técnica de campo.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    Código Municipal <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="PM-002"
                    value={bridgeCode}
                    onChange={(e) => setBridgeCode(e.target.value.toUpperCase())}
                    required
                    className="text-xs h-9 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Tipo de Estrutura</Label>
                  <Select value={bridgeType} onValueChange={(val: any) => setBridgeType(val)}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ponte">Ponte</SelectItem>
                      <SelectItem value="aduela">Aduela</SelectItem>
                      <SelectItem value="bueiro">Bueiro</SelectItem>
                      <SelectItem value="passarela">Passarela</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Bairro / Localidade</Label>
                  <Input
                    placeholder="Ex: Paruru, Feital, Verava"
                    value={bridgeNeighborhood}
                    onChange={(e) => setBridgeNeighborhood(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Ponto de Referência / Via</Label>
                  <Input
                    placeholder="Ex: Estrada Municipal Ciro Conceição"
                    value={bridgeRefPoint}
                    onChange={(e) => setBridgeRefPoint(e.target.value)}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold">Anotações Preliminares</Label>
                  <Textarea
                    placeholder="Observações de acesso, curso d'água cruzado..."
                    value={bridgeNotes}
                    onChange={(e) => setBridgeNotes(e.target.value)}
                    rows={2}
                    className="text-xs resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3) MODO: NOVA ÁREA DE RISCO MUNICIPAL */}
          {mode === 'risk_sector' && (
            <div className="space-y-3">
              <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-md text-[11px] text-orange-950 leading-relaxed">
                <strong>Salvaguarda Institucional:</strong> Este cadastro terá fonte expressa como{' '}
                <em>"registro manual no mapa"</em>, com data e usuário responsável. Nunca será
                apresentado como mapeamento oficial IPT.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold">
                    Nome / Localidade da Área <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Ex: Encosta Bairro Ressaca / Talude Rua das Palmeiras"
                    value={sectorName}
                    onChange={(e) => setSectorName(e.target.value)}
                    required
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Processo de Perigo</Label>
                  <Select value={sectorProcessType} onValueChange={setSectorProcessType}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="escorregamento-ESC">Escorregamento (ESC)</SelectItem>
                      <SelectItem value="inundação-INU">Inundação (INU)</SelectItem>
                      <SelectItem value="alagamento-ALA">Alagamento (ALA)</SelectItem>
                      <SelectItem value="rolamento_bloco-BLO">Rolamento de Bloco (BLO)</SelectItem>
                      <SelectItem value="solapamento-SOL">Solapamento de Margem (SOL)</SelectItem>
                      <SelectItem value="erosao-ERO">Erosão de Encosta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Grau de Risco Preliminar</Label>
                  <Select
                    value={sectorRiskLevel}
                    onValueChange={(val: any) => setSectorRiskLevel(val)}
                  >
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="R1">R1 - Baixo</SelectItem>
                      <SelectItem value="R2">R2 - Médio</SelectItem>
                      <SelectItem value="R3">R3 - Alto</SelectItem>
                      <SelectItem value="R4">R4 - Muito Alto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      Raio Aproximado da Área (Polígono Circular)
                    </Label>
                    <span className="text-xs font-bold text-orange-700">
                      {sectorRadiusMeters} metros
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={250}
                    step={10}
                    value={sectorRadiusMeters}
                    onChange={(e) => setSectorRadiusMeters(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-orange-600"
                  />
                  <p className="text-[10px] text-slate-500">
                    O polígono circular ({generatedSectorPolygon.length} vértices) é centrado no
                    ponto clicado.
                  </p>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold">Justificativa / Descrição</Label>
                  <Textarea
                    placeholder="Descrição da situação observada, trincas em moradias, declividade..."
                    value={sectorDescription}
                    onChange={(e) => setSectorDescription(e.target.value)}
                    rows={2}
                    className="text-xs resize-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 4) MODO: NOVO TRECHO DE PERIGO */}
          {mode === 'danger_stretch' && (
            <div className="space-y-3">
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-md text-[11px] text-blue-950 leading-relaxed">
                <strong>Salvaguarda Institucional:</strong> Trecho municipal registrado como{' '}
                <em>"registro manual no mapa"</em> com ponto inicial nas coordenadas clicadas.
                Identificação independente do inventário IPT.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold">
                    Logradouro / Trecho da Via <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="Ex: Rua das Flores, trecho entre cruzamento e córrego"
                    value={stretchLocation}
                    onChange={(e) => setStretchLocation(e.target.value)}
                    required
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Processo de Perigo</Label>
                  <Select value={stretchProcessType} onValueChange={setStretchProcessType}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enxurrada-ENX">Enxurrada (ENX)</SelectItem>
                      <SelectItem value="alagamento-ALA">Alagamento de Pista</SelectItem>
                      <SelectItem value="erosao_via">Erosão / Rompimento de Via</SelectItem>
                      <SelectItem value="queda_barreira">Queda de Barreira em Pista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Grau de Perigo Preliminar</Label>
                  <Select
                    value={stretchRiskLevel}
                    onValueChange={(val: any) => setStretchRiskLevel(val)}
                  >
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="indefinido">Pendente de Avaliação</SelectItem>
                      <SelectItem value="R1">P1 - Baixo</SelectItem>
                      <SelectItem value="R2">P2 - Médio</SelectItem>
                      <SelectItem value="R3">P3 - Alto</SelectItem>
                      <SelectItem value="R4">P4 - Muito Alto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Orientação da Linha</Label>
                  <Select
                    value={stretchDirection}
                    onValueChange={(val: any) => setStretchDirection(val)}
                  >
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="north_south">Norte — Sul</SelectItem>
                      <SelectItem value="east_west">Leste — Oeste</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Extensão Estimada</Label>
                    <span className="text-xs font-bold text-blue-700">{stretchLengthMeters}m</span>
                  </div>
                  <input
                    type="range"
                    min={30}
                    max={400}
                    step={10}
                    value={stretchLengthMeters}
                    onChange={(e) => setStretchLengthMeters(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mt-2"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Rodapé com Ações */}
          <DialogFooter className="pt-3 border-t flex flex-row items-center justify-between sm:justify-between">
            <span className="text-[11px] text-slate-500">
              Operador: <strong>{user?.name || user?.email || 'Agente'}</strong>
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className={
                  mode === 'occurrence'
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : mode === 'bridge'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : mode === 'risk_sector'
                        ? 'bg-orange-600 hover:bg-orange-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                }
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Gravar Registro
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
export default MapQuickRegisterModal
