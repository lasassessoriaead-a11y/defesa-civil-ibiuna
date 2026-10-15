import React, { useState, useEffect } from 'react'
import {
  Users,
  Search,
  Plus,
  Building,
  UserCheck,
  Shield,
  Phone,
  Mail,
  MapPin,
  FileText,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { requestersService, getErrorMessage } from '@/services/defesa-civil'
import type { Requester } from '@/types/defesa-civil'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

export const RequestersPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [requesters, setRequesters] = useState<Requester[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<'all' | 'pf' | 'pj'>('all')

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingRequester, setEditingRequester] = useState<Requester | null>(null)

  const [formData, setFormData] = useState<Partial<Requester>>({
    name: '',
    type: 'pf',
    document: '',
    rg: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  })

  const loadRequesters = async () => {
    try {
      setIsLoading(true)
      const data = await requestersService.list()
      setRequesters(data)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar requerentes',
        description: getErrorMessage(err),
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadRequesters()
  }, [])

  const handleOpenCreate = () => {
    setEditingRequester(null)
    setFormData({
      name: '',
      type: 'pf',
      document: '',
      rg: '',
      phone: '',
      email: '',
      address: '',
      notes: '',
      municipality: user?.municipality,
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (req: Requester) => {
    setEditingRequester(req)
    setFormData({
      name: req.name,
      type: req.type,
      document: req.document,
      rg: req.rg,
      phone: req.phone,
      email: req.email,
      address: req.address,
      notes: req.notes,
      municipality: req.municipality,
    })
    setIsModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name?.trim() || !formData.document?.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Informe o nome e o CPF/CNPJ do requerente.',
      })
      return
    }

    try {
      setIsSaving(true)
      const payload: Partial<Requester> = {
        ...formData,
        municipality: user?.municipality,
      }

      if (editingRequester) {
        await requestersService.update(editingRequester.id, payload)
        toast({ title: 'Requerente atualizado com sucesso' })
      } else {
        await requestersService.create(payload)
        toast({ title: 'Requerente cadastrado com sucesso' })
      }
      setIsModalOpen(false)
      loadRequesters()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar requerente',
        description: getErrorMessage(err),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const filteredRequesters = requesters.filter((req) => {
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      !searchTerm ||
      req.name.toLowerCase().includes(term) ||
      req.document.toLowerCase().includes(term) ||
      req.phone?.toLowerCase().includes(term) ||
      req.email?.toLowerCase().includes(term)

    const matchesType = selectedType === 'all' || req.type === selectedType

    return matchesSearch && matchesType
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Cadastro de Requerentes e Vítimas
          </h2>
          <p className="text-xs text-slate-500">
            Registro unificado de cidadãos (PF) e empresas/instituições (PJ) atendidos pela Defesa
            Civil.
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-10 px-4 rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Novo Requerente
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por nome, CPF/CNPJ, telefone ou e-mail..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs rounded-lg"
              />
            </div>

            <Select
              value={selectedType}
              onValueChange={(val) => setSelectedType(val as 'all' | 'pf' | 'pj')}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Pessoa Física e Jurídica</SelectItem>
                <SelectItem value="pf">Pessoa Física (PF)</SelectItem>
                <SelectItem value="pj">Pessoa Jurídica (PJ)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-xs">Carregando requerentes...</p>
          </div>
        ) : filteredRequesters.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Users className="w-8 h-8 stroke-1 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Nenhum requerente encontrado</p>
            <p className="text-xs text-slate-400">Clique em "Novo Requerente" para cadastrar.</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-200">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-700">Tipo</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">
                  Nome / Razão Social
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">CPF / CNPJ</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">Contato</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">Endereço</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequesters.map((req) => (
                <TableRow key={req.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        req.type === 'pj'
                          ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                          : 'border-blue-300 bg-blue-50 text-blue-700'
                      }
                    >
                      {req.type === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-xs text-slate-900">{req.name}</div>
                    {req.rg && <div className="text-[10px] text-slate-400">RG: {req.rg}</div>}
                  </TableCell>
                  <TableCell className="text-xs font-mono text-slate-700">{req.document}</TableCell>
                  <TableCell>
                    <div className="text-xs text-slate-600">{req.phone || '—'}</div>
                    {req.email && <div className="text-[10px] text-slate-400">{req.email}</div>}
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 max-w-[200px] truncate">
                    {req.address || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleOpenEdit(req)}
                      className="text-blue-600 hover:text-blue-700 text-xs h-8"
                    >
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal de Cadastro / Edição */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" />
                {editingRequester ? 'Editar Requerente' : 'Cadastrar Novo Requerente'}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Preencha os dados do cidadão ou pessoa jurídica. O CPF/CNPJ é único por município.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Tipo *</Label>
                  <Select
                    value={formData.type || 'pf'}
                    onValueChange={(val: 'pf' | 'pj') => setFormData({ ...formData, type: val })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pf">Pessoa Física (PF)</SelectItem>
                      <SelectItem value="pj">Pessoa Jurídica (PJ)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">
                    {formData.type === 'pj' ? 'CNPJ *' : 'CPF *'}
                  </Label>
                  <Input
                    required
                    placeholder={formData.type === 'pj' ? '00.000.000/0000-00' : '000.000.000-00'}
                    value={formData.document || ''}
                    onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">
                  {formData.type === 'pj' ? 'Razão Social / Nome Fantasia *' : 'Nome Completo *'}
                </Label>
                <Input
                  required
                  placeholder="Nome do requerente"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Telefone / WhatsApp</Label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={formData.phone || ''}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">E-mail</Label>
                  <Input
                    type="email"
                    placeholder="exemplo@email.com"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              {formData.type === 'pf' && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">RG (opcional)</Label>
                  <Input
                    placeholder="Número do documento de identidade"
                    value={formData.rg || ''}
                    onChange={(e) => setFormData({ ...formData, rg: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Endereço Residencial / Comercial</Label>
                <Input
                  placeholder="Rua, número, bairro, cidade"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Observações Internas</Label>
                <Input
                  placeholder="Informações adicionais relevantes"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
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
                disabled={isSaving}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Salvar Requerente
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
