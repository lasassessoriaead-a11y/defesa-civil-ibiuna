import React, { useEffect, useState } from 'react'
import {
  Map,
  Plus,
  Search,
  Layers,
  AlertTriangle,
  Users,
  Edit2,
  Trash2,
  CheckCircle2,
  Sparkles,
  MousePointerClick,
  Info,
  MapPin,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { InteractiveMap } from '@/components/defesa-civil/InteractiveMap'
import {
  SeverityBadge,
  AreaStatusBadge,
  getHazardIcon,
  RISK_LEVEL_LABELS,
  AREA_STATUS_LABELS,
} from '@/components/defesa-civil/StatusBadges'
import { affectedAreasService, occurrencesService, getErrorMessage } from '@/services/defesa-civil'
import type {
  AffectedArea,
  AreaHazardType,
  AreaRiskLevel,
  AreaStatus,
  Occurrence,
} from '@/types/defesa-civil'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export const AffectedAreasPage: React.FC = () => {
  const { toast } = useToast()
  const [areas, setAreas] = useState<AffectedArea[]>([])
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedArea, setSelectedArea] = useState<AffectedArea | null>(null)

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  // Form State with polygon coordinates
  const [formData, setFormData] = useState<
    Partial<AffectedArea> & { address?: string; latitude?: number; longitude?: number }
  >({
    name: '',
    hazard_type: 'enchente',
    risk_level: 'critico',
    status: 'monitorado',
    affected_population: 1000,
    notes: '',
    coordinates: '-23.5505,-46.6333',
    address: '',
    latitude: -23.5505,
    longitude: -46.6333,
  })
  const [isGeocoding, setIsGeocoding] = useState(false)

  const [polygonDraft, setPolygonDraft] = useState<[number, number][]>([])

  const loadData = async () => {
    try {
      const [areaData, occData] = await Promise.all([
        affectedAreasService.list(),
        occurrencesService.list(),
      ])
      setAreas(areaData)
      setOccurrences(occData)
      if (areaData.length > 0 && !selectedArea) {
        setSelectedArea(areaData[0])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime<AffectedArea>('affected_areas', () => loadData())

  const openCreate = () => {
    setSelectedArea(null)
    const initialPoly: [number, number][] = [
      [-23.546, -46.638],
      [-23.548, -46.629],
      [-23.555, -46.631],
      [-23.554, -46.639],
    ]
    setPolygonDraft(initialPoly)
    setFormData({
      name: '',
      hazard_type: 'enchente',
      risk_level: 'critico',
      status: 'monitorado',
      affected_population: 500,
      notes: '',
      coordinates: '-23.5505,-46.6333',
      address: '',
      latitude: -23.5505,
      longitude: -46.6333,
    })
    setIsFormOpen(true)
  }

  const openEdit = (area: AffectedArea) => {
    setSelectedArea(area)
    let poly: [number, number][] = []
    try {
      if (area.area_polygon) {
        poly = JSON.parse(area.area_polygon)
      }
    } catch {
      /* intentionally ignored */
    }
    setPolygonDraft(poly)

    let lat = -23.5505
    let lng = -46.6333
    if (area.coordinates && area.coordinates.includes(',')) {
      const parts = area.coordinates.split(',')
      const pLat = parseFloat(parts[0])
      const pLng = parseFloat(parts[1])
      if (!isNaN(pLat) && !isNaN(pLng)) {
        lat = pLat
        lng = pLng
      }
    } else if (poly.length > 0) {
      lat = poly[0][0]
      lng = poly[0][1]
    }

    setFormData({
      ...area,
      address: '',
      latitude: lat,
      longitude: lng,
    })
    setIsFormOpen(true)
  }

  const handleGeocode = async () => {
    const address = formData.address?.trim()
    if (!address) {
      toast({ variant: 'destructive', title: 'Informe um endereço primeiro' })
      return
    }
    setIsGeocoding(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      )
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        const lat = parseFloat(data[0].lat)
        const lon = parseFloat(data[0].lon)
        setFormData((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lon,
          coordinates: `${lat},${lon}`,
        }))
        toast({
          title: 'Coordenadas encontradas',
          description: `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
        })
      } else {
        toast({ variant: 'destructive', title: 'Endereço não encontrado' })
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar endereço',
        description: getErrorMessage(err),
      })
    } finally {
      setIsGeocoding(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name?.trim()) {
      toast({ variant: 'destructive', title: 'Nome da área é obrigatório' })
      return
    }

    const { address, latitude, longitude, ...restFormData } = formData

    const coordinates =
      latitude !== undefined && longitude !== undefined
        ? `${latitude},${longitude}`
        : polygonDraft.length > 0
          ? `${polygonDraft[0][0]},${polygonDraft[0][1]}`
          : '-23.5505,-46.6333'

    const payload: Partial<AffectedArea> = {
      ...restFormData,
      area_polygon: JSON.stringify(polygonDraft),
      coordinates,
    }

    try {
      if (selectedArea && isFormOpen) {
        await affectedAreasService.update(selectedArea.id, payload)
        toast({ title: 'Área de risco atualizada com sucesso' })
      } else {
        await affectedAreasService.create(payload)
        toast({ title: 'Área de risco mapeada com sucesso' })
      }
      setIsFormOpen(false)
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar área afetada',
        description: getErrorMessage(err),
      })
    }
  }

  const handleDelete = async () => {
    if (!selectedArea) return
    try {
      await affectedAreasService.delete(selectedArea.id)
      toast({ title: 'Área removida do mapa' })
      setIsDeleteOpen(false)
      setSelectedArea(null)
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: getErrorMessage(err),
      })
    }
  }

  // Quick change status (monitorado -> evacuado -> interditado -> liberado)
  const handleStatusChange = async (area: AffectedArea, newStatus: AreaStatus) => {
    try {
      await affectedAreasService.update(area.id, { status: newStatus })
      toast({
        title: 'Status Operacional Atualizado',
        description: `${area.name} agora está marcado como ${AREA_STATUS_LABELS[newStatus]}.`,
      })
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
        description: getErrorMessage(err),
      })
    }
  }

  const filteredAreas = areas.filter((a) => {
    const matchText =
      !searchText ||
      a.name.toLowerCase().includes(searchText.toLowerCase()) ||
      a.notes?.toLowerCase().includes(searchText.toLowerCase())
    const matchRisk = riskFilter === 'all' || a.risk_level === riskFilter
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    return matchText && matchRisk && matchStatus
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Map className="w-5 h-5 text-amber-600" />
            Mapeamento de Áreas Afetadas e Polígonos de Risco
          </h2>
          <p className="text-xs text-slate-500">
            Delimitação vetorial de bacias, encostas saturadas, zonas de seca e evacuação
            preventiva.
          </p>
        </div>

        <Button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-10 px-4 rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Mapear Nova Área de Risco
        </Button>
      </div>

      {/* Large Interactive Map with Polygons */}
      <Card className="border-slate-200 bg-white overflow-hidden shadow-sm">
        <CardHeader className="py-3 px-4 bg-slate-50/80 border-b border-slate-200 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-600" />
            <CardTitle className="text-sm font-bold text-slate-800">
              Visualizador Espacial de Perigo Climático
            </CardTitle>
          </div>
          <span className="text-xs text-slate-500">
            Polígonos coloridos por nível de risco (Vermelho = Crítico, Laranja = Alto, Âmbar =
            Médio)
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <InteractiveMap
            height="440px"
            areas={filteredAreas}
            occurrences={occurrences}
            onSelectItem={(type, item) => {
              if (type === 'area') setSelectedArea(item)
            }}
          />
        </CardContent>
      </Card>

      {/* Filter and Content Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Areas List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por nome da área ou notas..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9 h-9 text-xs rounded-lg bg-white"
              />
            </div>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-full sm:w-44 h-9 text-xs bg-white">
                <SelectValue placeholder="Nível de Risco" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Riscos</SelectItem>
                <SelectItem value="critico">Risco Crítico</SelectItem>
                <SelectItem value="alto">Alto Risco</SelectItem>
                <SelectItem value="medio">Médio Risco</SelectItem>
                <SelectItem value="baixo">Baixo Risco</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44 h-9 text-xs bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="monitorado">Monitorado</SelectItem>
                <SelectItem value="evacuado">Evacuado</SelectItem>
                <SelectItem value="interditado">Interditado</SelectItem>
                <SelectItem value="liberado">Liberado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cards List */}
          <div className="space-y-3">
            {filteredAreas.map((area) => {
              const isSelected = selectedArea?.id === area.id

              return (
                <div
                  key={area.id}
                  onClick={() => setSelectedArea(area)}
                  className={`p-4 rounded-xl border bg-white transition-all cursor-pointer shadow-xs ${
                    isSelected
                      ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-slate-100 shrink-0 mt-0.5">
                        {getHazardIcon(area.hazard_type, 'w-5 h-5')}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">{area.name}</h4>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                          {area.notes || 'Sem observações operacionais registradas.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <SeverityBadge severity={area.risk_level} />
                      <AreaStatusBadge status={area.status} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs text-slate-600">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      População vulnerável:{' '}
                      <strong className="text-slate-800">
                        {area.affected_population?.toLocaleString('pt-BR') || 0} hab.
                      </strong>
                    </span>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openEdit(area)}
                        className="h-7 text-xs text-blue-600 hover:text-blue-800"
                      >
                        <Edit2 className="w-3 h-3 mr-1" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedArea(area)
                          setIsDeleteOpen(true)
                        }}
                        className="h-7 text-xs text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Excluir
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right 1 Col: Selected Area Detail Sidebar */}
        <div>
          {selectedArea ? (
            <Card className="border-slate-200 bg-white shadow-sm sticky top-20">
              <CardHeader className="pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-amber-50 text-amber-600">
                    {getHazardIcon(selectedArea.hazard_type, 'w-4 h-4')}
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-900">
                      {selectedArea.name}
                    </CardTitle>
                    <span className="text-[11px] text-slate-500 capitalize">
                      Tipo: {selectedArea.hazard_type}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-4 text-xs">
                <div>
                  <span className="font-semibold text-slate-600 block mb-1">
                    Status Operacional Atual:
                  </span>
                  <Select
                    value={selectedArea.status}
                    onValueChange={(v) => handleStatusChange(selectedArea, v as AreaStatus)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monitorado">Monitorado (Preventivo)</SelectItem>
                      <SelectItem value="evacuado">Evacuado (População Removida)</SelectItem>
                      <SelectItem value="interditado">Interditado (Acesso Bloqueado)</SelectItem>
                      <SelectItem value="liberado">Liberado (Seguro)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nível de Risco:</span>
                    <SeverityBadge severity={selectedArea.risk_level} />
                  </div>
                  <div className="flex justify-between pt-1">
                    <span className="text-slate-500">Habitantes em Risco:</span>
                    <span className="font-bold text-slate-900">
                      {selectedArea.affected_population?.toLocaleString('pt-BR')} pessoas
                    </span>
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-slate-600 block mb-1">
                    Relatório e Diretrizes de Contingência:
                  </span>
                  <p className="p-3 bg-slate-50 rounded-lg text-slate-700 leading-relaxed border border-slate-200">
                    {selectedArea.notes || 'Sem observações adicionais.'}
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => openEdit(selectedArea)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs h-9"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1.5" />
                  Editar Delimitação do Polígono
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
              Selecione uma área na lista para visualizar detalhes táticos.
            </div>
          )}
        </div>
      </div>

      {/* Form Modal (Create / Edit) with Polygon Drawer */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {selectedArea && selectedArea.id
                ? 'Editar Área Afetada'
                : 'Mapear Nova Área de Risco'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Desenhe o polígono no mapa clicando nos vértices perimetrais.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Nome da Área / Bairro / Bacia *
              </Label>
              <Input
                required
                placeholder="Ex: Bacia do Rio de la Plata ou Encosta Norte"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            {/* Endereço com geocodificação via Nominatim (OpenStreetMap) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Endereço / Referência</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Av. Beira Rio, 450 - Centro"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="h-9 text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleGeocode}
                  disabled={isGeocoding || !formData.address?.trim()}
                  className="h-9 shrink-0 text-xs whitespace-nowrap"
                >
                  {isGeocoding ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <MapPin className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  Buscar coordenadas
                </Button>
              </div>
            </div>

            {/* Latitude / Longitude (numéricos, lado a lado) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Latitude</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="ex: -23.5505"
                  value={formData.latitude ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      latitude: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Longitude</Label>
                <Input
                  type="number"
                  step="any"
                  placeholder="ex: -46.6333"
                  value={formData.longitude ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      longitude: e.target.value === '' ? undefined : Number(e.target.value),
                    })
                  }
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Mini Interactive Map to pick Pin */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">
                  Posicionar Marcador no Mapa (Clique no mapa real para selecionar)
                </Label>
                <span className="text-[11px] font-mono text-slate-500">
                  Lat: {formData.latitude?.toFixed(4)}, Lng: {formData.longitude?.toFixed(4)}
                </span>
              </div>
              <InteractiveMap
                height="240px"
                interactivePick={true}
                showLayerToggles={false}
                pickedCoordinate={{
                  lat: formData.latitude || -23.5505,
                  lng: formData.longitude || -46.6333,
                }}
                onPickCoordinate={(lat, lng) => {
                  setFormData({
                    ...formData,
                    latitude: lat,
                    longitude: lng,
                    coordinates: `${lat},${lng}`,
                  })
                }}
                center={[formData.latitude || -23.5505, formData.longitude || -46.6333]}
                zoom={14}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Tipo de Ameaça</Label>
                <Select
                  value={formData.hazard_type}
                  onValueChange={(v) =>
                    setFormData({ ...formData, hazard_type: v as AreaHazardType })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enchente">Enchente</SelectItem>
                    <SelectItem value="deslizamento">Deslizamento</SelectItem>
                    <SelectItem value="seca">Seca</SelectItem>
                    <SelectItem value="tempestade">Tempestade</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Grau de Risco</Label>
                <Select
                  value={formData.risk_level}
                  onValueChange={(v) =>
                    setFormData({ ...formData, risk_level: v as AreaRiskLevel })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critico">Crítico (Vermelho)</SelectItem>
                    <SelectItem value="alto">Alto (Laranja)</SelectItem>
                    <SelectItem value="medio">Médio (Âmbar)</SelectItem>
                    <SelectItem value="baixo">Baixo (Verde)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Status Operacional</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as AreaStatus })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monitorado">Monitorado</SelectItem>
                    <SelectItem value="evacuado">Evacuado</SelectItem>
                    <SelectItem value="interditado">Interditado</SelectItem>
                    <SelectItem value="liberado">Liberado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                População sob Risco Estimada
              </Label>
              <Input
                type="number"
                min={0}
                value={formData.affected_population ?? ''}
                onChange={(e) =>
                  setFormData({ ...formData, affected_population: Number(e.target.value) })
                }
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Observações e Protocolo de Evacuação
              </Label>
              <Textarea
                rows={2}
                placeholder="Indique rotas de fuga, sirenes telemétricas e laudos geológicos..."
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="text-xs"
              />
            </div>

            {/* Interactive Polygon Drawer */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <MousePointerClick className="w-3.5 h-3.5 text-blue-600" />
                  Clique no mapa para adicionar vértices ao polígono ({polygonDraft.length} pontos)
                </Label>
                <div className="flex items-center gap-1.5">
                  {polygonDraft.length > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setPolygonDraft((prev) => prev.slice(0, -1))}
                      className="h-6 text-[10px] text-slate-600"
                    >
                      Desfazer último
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPolygonDraft([])}
                    className="h-6 text-[10px] text-red-600"
                  >
                    Limpar Pontos
                  </Button>
                </div>
              </div>

              <InteractiveMap
                height="260px"
                allowDrawingPolygon={true}
                polygonPoints={polygonDraft}
                onPolygonChange={setPolygonDraft}
                center={polygonDraft.length > 0 ? polygonDraft[0] : [-23.5505, -46.6333]}
                showLayerToggles={false}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                {selectedArea && selectedArea.id ? 'Salvar Área' : 'Cadastrar Área'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Remover Área de Risco
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Confirma a exclusão de {selectedArea?.name}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Confirmar Exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
