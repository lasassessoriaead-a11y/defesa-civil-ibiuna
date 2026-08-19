import React, { useEffect, useState } from 'react'
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  AlertOctagon,
  Layers,
  MapPin,
  Edit2,
  Trash2,
  PlusCircle,
  MinusCircle,
  Droplet,
  Utensils,
  Pill,
  Shirt,
  Wrench,
  Sparkles,
  Archive,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
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
import { SupplyStatusBadge, SUPPLY_STATUS_LABELS } from '@/components/defesa-civil/StatusBadges'
import { suppliesService, getErrorMessage } from '@/services/defesa-civil'
import type { Supply, SupplyCategory, SupplyStatus, SupplyUnit } from '@/types/defesa-civil'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

const CATEGORY_LABELS: Record<SupplyCategory, { label: string; icon: React.ElementType }> = {
  agua: { label: 'Água Potável & Hidratação', icon: Droplet },
  alimentos: { label: 'Alimentos & Cestas', icon: Utensils },
  medicamentos: { label: 'Medicamentos & Primeiros Socorros', icon: Pill },
  roupas_cobertores: { label: 'Roupas & Cobertores', icon: Shirt },
  equipamentos: { label: 'Equipamentos & Ferramentas', icon: Wrench },
  higiene: { label: 'Kits de Higiene Familiar', icon: Sparkles },
  outros: { label: 'Outros Suprimentos', icon: Archive },
}

export const SuppliesPage: React.FC = () => {
  const { toast } = useToast()
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedSupply, setSelectedSupply] = useState<Supply | null>(null)

  // Form State
  const [formData, setFormData] = useState<Partial<Supply>>({
    name: '',
    category: 'agua',
    quantity: 100,
    unit: 'unidades',
    min_threshold: 50,
    location: 'Galpão Central',
  })

  const loadSupplies = async () => {
    try {
      const data = await suppliesService.list()
      setSupplies(data)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSupplies()
  }, [])

  useRealtime<Supply>('supplies', () => loadSupplies())

  // Compute status by threshold
  const computeStatus = (qty: number, threshold = 50): SupplyStatus => {
    if (qty <= 0) return 'esgotado'
    if (qty <= threshold) return 'critico'
    return 'disponivel'
  }

  const openCreate = () => {
    setSelectedSupply(null)
    setFormData({
      name: '',
      category: 'agua',
      quantity: 100,
      unit: 'unidades',
      min_threshold: 50,
      location: 'Galpão Central - Setor A',
    })
    setIsFormOpen(true)
  }

  const openEdit = (sup: Supply) => {
    setSelectedSupply(sup)
    setFormData({ ...sup })
    setIsFormOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name?.trim()) {
      toast({ variant: 'destructive', title: 'Nome do item é obrigatório' })
      return
    }

    const qty = formData.quantity || 0
    const thresh = formData.min_threshold || 10
    const computed = computeStatus(qty, thresh)

    const payload = {
      ...formData,
      status: computed,
    }

    try {
      if (selectedSupply) {
        await suppliesService.update(selectedSupply.id, payload)
        toast({ title: 'Suprimento atualizado com sucesso' })
      } else {
        await suppliesService.create(payload)
        toast({ title: 'Suprimento cadastrado com sucesso' })
      }
      setIsFormOpen(false)
      loadSupplies()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar suprimento',
        description: getErrorMessage(err),
      })
    }
  }

  const handleDelete = async () => {
    if (!selectedSupply) return
    try {
      await suppliesService.delete(selectedSupply.id)
      toast({ title: 'Item excluído do estoque' })
      setIsDeleteOpen(false)
      loadSupplies()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: getErrorMessage(err),
      })
    }
  }

  // Quick adjust quantity (+ / -)
  const adjustQuantity = async (supply: Supply, delta: number) => {
    const newQty = Math.max(0, supply.quantity + delta)
    const newStatus = computeStatus(newQty, supply.min_threshold)

    try {
      await suppliesService.update(supply.id, {
        quantity: newQty,
        status: newStatus,
      })
      loadSupplies()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao ajustar estoque',
        description: getErrorMessage(err),
      })
    }
  }

  // Critical and Out of stock items
  const criticalItems = supplies.filter((s) => s.status === 'critico' || s.status === 'esgotado')

  const filteredSupplies = supplies.filter((s) => {
    const matchText =
      !searchText ||
      s.name.toLowerCase().includes(searchText.toLowerCase()) ||
      s.location?.toLowerCase().includes(searchText.toLowerCase())
    const matchCat = categoryFilter === 'all' || s.category === categoryFilter
    return matchText && matchCat
  })

  // Group filtered by category
  const groupedSupplies = filteredSupplies.reduce(
    (acc, sup) => {
      acc[sup.category] = acc[sup.category] || []
      acc[sup.category].push(sup)
      return acc
    },
    {} as Record<SupplyCategory, Supply[]>,
  )

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-600" />
            Gestão de Suprimentos e Estoque de Emergência
          </h2>
          <p className="text-xs text-slate-500">
            Controle de depósitos, alertas de reposição emergencial e provisões humanitárias.
          </p>
        </div>

        <Button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-10 px-4 rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Cadastrar Novo Item
        </Button>
      </div>

      {/* Prominent "Reposição Necessária" Alert Strip */}
      {criticalItems.length > 0 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/15 via-red-500/15 to-orange-500/15 border border-amber-300 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 animate-pulse">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                Alerta de Reposição Crítica de Suprimentos ({criticalItems.length} itens)
              </h3>
              <p className="text-xs text-slate-600">
                Os seguintes itens estão em nível de risco ou esgotados no depósito:
                <span className="font-semibold text-amber-900 ml-1">
                  {criticalItems.map((c) => `${c.name} (${c.quantity} ${c.unit})`).join(', ')}
                </span>
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={openCreate}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shrink-0"
          >
            Solicitar Remessa
          </Button>
        </div>
      )}

      {/* Search and Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar suprimentos por nome ou armazém..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9 h-9 text-xs rounded-lg bg-white"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-60 h-9 text-xs bg-white">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Categorias</SelectItem>
            {Object.keys(CATEGORY_LABELS).map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat as SupplyCategory].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grouped Category Boards */}
      <div className="space-y-6">
        {Object.keys(CATEGORY_LABELS).map((catKey) => {
          const cat = catKey as SupplyCategory
          const items = groupedSupplies[cat] || []
          if (items.length === 0) return null

          const CatIcon = CATEGORY_LABELS[cat].icon

          return (
            <div key={cat} className="space-y-3">
              {/* Category Header Title */}
              <div className="flex items-center gap-2 pb-1 border-b border-slate-200">
                <CatIcon className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  {CATEGORY_LABELS[cat].label} ({items.length})
                </h3>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((sup) => {
                  const isOut = sup.status === 'esgotado'
                  const isLow = sup.status === 'critico'

                  return (
                    <Card
                      key={sup.id}
                      className={`border transition-all duration-200 hover:shadow-md bg-white flex flex-col justify-between ${
                        isOut
                          ? 'border-red-300 ring-1 ring-red-200 bg-red-50/20'
                          : isLow
                            ? 'border-amber-300 ring-1 ring-amber-200 bg-amber-50/20'
                            : 'border-slate-200'
                      }`}
                    >
                      <CardHeader className="pb-2 space-y-1">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-bold text-slate-900 leading-tight">
                            {sup.name}
                          </CardTitle>
                          <SupplyStatusBadge status={sup.status} />
                        </div>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{sup.location || 'Depósito Central'}</span>
                        </p>
                      </CardHeader>

                      <CardContent className="space-y-3 pt-0">
                        {/* Quantity Counter Box */}
                        <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-500 block">
                              Quantidade em Estoque
                            </span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                              <span
                                className={`text-2xl font-extrabold ${
                                  isOut
                                    ? 'text-red-700'
                                    : isLow
                                      ? 'text-amber-600'
                                      : 'text-slate-900'
                                }`}
                              >
                                {sup.quantity}
                              </span>
                              <span className="text-xs text-slate-500 font-medium">{sup.unit}</span>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[10px] text-slate-400 block">Mínimo seguro:</span>
                            <span className="text-xs font-semibold text-slate-600">
                              {sup.min_threshold || 10} {sup.unit}
                            </span>
                          </div>
                        </div>

                        {/* Quick +/- Stepper */}
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-medium text-slate-600">
                            Ajuste de Saldo:
                          </span>
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => adjustQuantity(sup, -10)}
                              className="h-7 px-2 text-[11px] font-bold text-slate-700"
                              title="-10"
                            >
                              -10
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => adjustQuantity(sup, -1)}
                              className="h-7 px-2 text-[11px] font-bold text-slate-700"
                              title="-1"
                            >
                              -1
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => adjustQuantity(sup, 1)}
                              className="h-7 px-2 text-[11px] font-bold text-blue-700 bg-blue-50 border-blue-200"
                              title="+1"
                            >
                              +1
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => adjustQuantity(sup, 10)}
                              className="h-7 px-2 text-[11px] font-bold text-blue-700 bg-blue-50 border-blue-200"
                              title="+10"
                            >
                              +10
                            </Button>
                          </div>
                        </div>
                      </CardContent>

                      <CardFooter className="pt-2 pb-3 px-4 border-t border-slate-100 flex items-center justify-between">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(sup)}
                          className="text-xs text-blue-600 hover:text-blue-800 p-0 h-auto font-semibold"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedSupply(sup)
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
            </div>
          )
        })}
      </div>

      {filteredSupplies.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Nenhum suprimento cadastrado com os critérios.</p>
        </div>
      )}

      {/* Form Modal (Create / Edit) */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {selectedSupply ? 'Editar Suprimento' : 'Cadastrar Novo Item de Suprimento'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Insira o item, categoria, quantidade disponível e limiar de estoque mínimo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Nome do Suprimento / Insumo *
              </Label>
              <Input
                required
                placeholder="Ex: Água Mineral 5L ou Cobertores Térmicos"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Categoria</Label>
                <Select
                  value={formData.category}
                  onValueChange={(v) => setFormData({ ...formData, category: v as SupplyCategory })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(CATEGORY_LABELS).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat as SupplyCategory].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Unidade de Medida</Label>
                <Select
                  value={formData.unit}
                  onValueChange={(v) => setFormData({ ...formData, unit: v as SupplyUnit })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unidades">Unidades (un)</SelectItem>
                    <SelectItem value="litros">Litros (L)</SelectItem>
                    <SelectItem value="quilos">Quilos (kg)</SelectItem>
                    <SelectItem value="caixas">Caixas (cx)</SelectItem>
                    <SelectItem value="kits">Kits Prontos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Quantidade Atual</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.quantity ?? ''}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Limiar Mínimo (Alerta)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.min_threshold ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, min_threshold: Number(e.target.value) })
                  }
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Armazém / Localização Física
              </Label>
              <Input
                placeholder="Ex: Galpão Central - Prateleira B3"
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="h-9 text-xs"
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
                {selectedSupply ? 'Salvar Item' : 'Cadastrar Item'}
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
              Remover Item de Suprimento
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Deseja remover {selectedSupply?.name} do controle de estoque?
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
