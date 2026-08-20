import React, { useEffect, useState } from 'react'
import {
  Building2,
  Plus,
  Search,
  Phone,
  MapPin,
  Users,
  Edit2,
  Trash2,
  PlusCircle,
  MinusCircle,
  AlertOctagon,
  CheckCircle2,
  ArrowUpDown,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
import { ShelterStatusBadge, SHELTER_STATUS_LABELS } from '@/components/defesa-civil/StatusBadges'
import { sheltersService, getErrorMessage } from '@/services/defesa-civil'
import type { Shelter, ShelterStatus } from '@/types/defesa-civil'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export const SheltersPage: React.FC = () => {
  const { toast } = useToast()
  const [shelters, setShelters] = useState<Shelter[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedShelter, setSelectedShelter] = useState<Shelter | null>(null)

  // Form State
  const [formData, setFormData] = useState<Partial<Shelter>>({
    name: '',
    address: '',
    capacity: 100,
    occupancy: 0,
    status: 'ativo',
    contact: '',
    latitude: -23.5505,
    longitude: -46.6333,
  })
  const [isGeocoding, setIsGeocoding] = useState(false)

  const loadShelters = async () => {
    try {
      const data = await sheltersService.list()
      setShelters(data)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadShelters()
  }, [])

  useRealtime<Shelter>('shelters', () => loadShelters())

  const openCreate = () => {
    setSelectedShelter(null)
    setFormData({
      name: '',
      address: '',
      capacity: 150,
      occupancy: 0,
      status: 'ativo',
      contact: '',
      latitude: -23.5505,
      longitude: -46.6333,
    })
    setIsFormOpen(true)
  }

  const openEdit = (s: Shelter) => {
    setSelectedShelter(s)
    setFormData({ ...s })
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
        setFormData((prev) => ({ ...prev, latitude: lat, longitude: lon }))
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
      toast({ variant: 'destructive', title: 'Nome do abrigo é obrigatório' })
      return
    }

    try {
      // Auto adjust status if full
      const occ = formData.occupancy || 0
      const cap = formData.capacity || 1
      let st = formData.status || 'ativo'
      if (occ >= cap) {
        st = 'cheio'
      } else if (st === 'cheio' && occ < cap) {
        st = 'ativo'
      }

      const payload = { ...formData, status: st }

      if (selectedShelter) {
        await sheltersService.update(selectedShelter.id, payload)
        toast({ title: 'Abrigo atualizado com sucesso' })
      } else {
        await sheltersService.create(payload)
        toast({ title: 'Abrigo cadastrado com sucesso' })
      }
      setIsFormOpen(false)
      loadShelters()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar abrigo',
        description: getErrorMessage(err),
      })
    }
  }

  const handleDelete = async () => {
    if (!selectedShelter) return
    try {
      await sheltersService.delete(selectedShelter.id)
      toast({ title: 'Abrigo removido com sucesso' })
      setIsDeleteOpen(false)
      loadShelters()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover',
        description: getErrorMessage(err),
      })
    }
  }

  // Quick adjust occupancy stepper (+ / -)
  const adjustOccupancy = async (shelter: Shelter, delta: number) => {
    const current = shelter.occupancy || 0
    const newOccupancy = Math.max(0, current + delta)
    let newStatus = shelter.status
    if (newOccupancy >= shelter.capacity) {
      newStatus = 'cheio'
    } else if (shelter.status === 'cheio' && newOccupancy < shelter.capacity) {
      newStatus = 'ativo'
    }

    try {
      await sheltersService.update(shelter.id, {
        occupancy: newOccupancy,
        status: newStatus,
      })
      loadShelters()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao ajustar ocupação',
        description: getErrorMessage(err),
      })
    }
  }

  const filteredShelters = shelters.filter((s) => {
    const matchText =
      !searchText ||
      s.name.toLowerCase().includes(searchText.toLowerCase()) ||
      s.address?.toLowerCase().includes(searchText.toLowerCase()) ||
      s.contact?.toLowerCase().includes(searchText.toLowerCase())
    const matchStatus = statusFilter === 'all' || s.status === statusFilter
    return matchText && matchStatus
  })

  // Aggregate stats
  const totalCap = shelters.reduce((acc, s) => acc + (s.capacity || 0), 0)
  const totalOcc = shelters.reduce((acc, s) => acc + (s.occupancy || 0), 0)
  const totalFree = Math.max(0, totalCap - totalOcc)

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Gestão de Abrigos Municipais e Acolhimento
          </h2>
          <p className="text-xs text-slate-500">
            Controle de capacidade, check-in/check-out de desalojados e prontidão dos alojamentos.
          </p>
        </div>

        <Button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-10 px-4 rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Cadastrar Novo Abrigo
        </Button>
      </div>

      {/* Aggregate Overview Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Capacidade Total</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{totalCap} vagas</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
        </Card>

        <Card className="border-slate-200 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">
              Total Desalojados Acolhidos
            </p>
            <p className="text-2xl font-extrabold text-slate-900 mt-0.5">{totalOcc} pessoas</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </Card>

        <Card className="border-slate-200 bg-white p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase">Vagas Disponíveis</p>
            <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">{totalFree} livres</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por nome do abrigo, bairro ou responsável..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9 h-9 text-xs rounded-lg bg-white"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48 h-9 text-xs bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="cheio">Lotado (Cheio)</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Shelters Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredShelters.map((shelter) => {
          const cap = shelter.capacity || 1
          const occ = shelter.occupancy || 0
          const rate = Math.round((occ / cap) * 100)
          const isCritical = rate >= 90 || shelter.status === 'cheio'

          return (
            <Card
              key={shelter.id}
              className={`border transition-all duration-200 hover:shadow-md bg-white flex flex-col justify-between ${
                isCritical ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200'
              }`}
            >
              <CardHeader className="pb-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        isCritical ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900 leading-tight">
                        {shelter.name}
                      </CardTitle>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[200px]">
                          {shelter.address || 'Endereço não cadastrado'}
                        </span>
                      </p>
                    </div>
                  </div>
                  <ShelterStatusBadge status={shelter.status} />
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                {/* Occupancy Progress Bar */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-1.5">
                  <div className="flex items-baseline justify-between text-xs font-semibold">
                    <span className="text-slate-600">Taxa de Ocupação:</span>
                    <span className={isCritical ? 'text-red-700 font-bold' : 'text-slate-900'}>
                      {occ} / {cap} ({rate}%)
                    </span>
                  </div>

                  <Progress
                    value={Math.min(rate, 100)}
                    className={`h-2.5 ${
                      rate >= 90
                        ? '[&>div]:bg-red-600'
                        : rate >= 75
                          ? '[&>div]:bg-amber-500'
                          : '[&>div]:bg-blue-600'
                    }`}
                  />

                  {rate >= 90 && (
                    <p className="text-[10px] text-red-600 font-bold flex items-center gap-1 mt-1">
                      <AlertOctagon className="w-3 h-3" />
                      Lotação crítica (≥ 90%) — Direcionar acolhidos para outros pontos.
                    </p>
                  )}
                </div>

                {/* Contact info */}
                {shelter.contact && (
                  <p className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{shelter.contact}</span>
                  </p>
                )}

                {/* Quick Occupancy Stepper (+ / -) */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <span className="text-xs font-medium text-slate-600">Ajuste rápido (+/-):</span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => adjustOccupancy(shelter, -5)}
                      className="h-7 px-2 text-[11px] font-bold text-slate-700"
                      title="-5 pessoas"
                    >
                      -5
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => adjustOccupancy(shelter, -1)}
                      className="h-7 px-2 text-[11px] font-bold text-slate-700"
                      title="-1 pessoa"
                    >
                      -1
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => adjustOccupancy(shelter, 1)}
                      className="h-7 px-2 text-[11px] font-bold text-blue-700 bg-blue-50 border-blue-200"
                      title="+1 pessoa"
                    >
                      +1
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => adjustOccupancy(shelter, 5)}
                      className="h-7 px-2 text-[11px] font-bold text-blue-700 bg-blue-50 border-blue-200"
                      title="+5 pessoas"
                    >
                      +5
                    </Button>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-2 pb-3 px-4 border-t border-slate-100 flex items-center justify-between">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEdit(shelter)}
                  className="text-xs text-blue-600 hover:text-blue-800 p-0 h-auto font-semibold"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedShelter(shelter)
                    setIsDeleteOpen(true)
                  }}
                  className="text-xs text-red-600 hover:text-red-800 p-0 h-auto"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" /> Excluir
                </Button>
              </CardFooter>
            </Card>
          )
        })}
      </div>

      {filteredShelters.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">
            Nenhum abrigo cadastrado ou compatível com a busca.
          </p>
        </div>
      )}

      {/* Form Modal (Create / Edit) */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {selectedShelter ? 'Editar Abrigo' : 'Cadastrar Novo Abrigo Municipal'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Informe a capacidade máxima, contato do responsável e marque o local no mapa.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Nome do Abrigo / Instituição *
              </Label>
              <Input
                required
                placeholder="Ex: Ginásio Municipal de Esportes"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Capacidade Máxima (Vagas) *
                </Label>
                <Input
                  type="number"
                  required
                  min={1}
                  value={formData.capacity ?? ''}
                  onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Ocupação Atual</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.occupancy ?? ''}
                  onChange={(e) => setFormData({ ...formData, occupancy: Number(e.target.value) })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Status Operacional</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as ShelterStatus })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="cheio">Lotado (Cheio)</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Contato / Responsável</Label>
              <Input
                placeholder="(11) 98888-0000 - Coord. Silva"
                value={formData.contact || ''}
                onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            {/* Endereço com geocodificação via Nominatim (OpenStreetMap) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Endereço / Referência</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Rua dos Esportes, 100 - Bairro Centro"
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
                  setFormData({ ...formData, latitude: lat, longitude: lng })
                }}
                center={[formData.latitude || -23.5505, formData.longitude || -46.6333]}
                zoom={14}
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
                {selectedShelter ? 'Salvar Alterações' : 'Cadastrar Abrigo'}
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
              Remover Cadastro do Abrigo
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Confirma a exclusão de {selectedShelter?.name}? Todos os registros vinculados a este
              local serão desativados.
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
