import React, { useState, useEffect } from 'react'
import {
  Users,
  Shield,
  Search,
  Building,
  UserCheck,
  Edit2,
  Loader2,
  CheckCircle2,
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { usersService, municipalitiesService, getErrorMessage } from '@/services/defesa-civil'
import type { User, UserRole, Municipality } from '@/types/defesa-civil'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

export const UsersManagementPage: React.FC = () => {
  const { user: currentUser, refreshUser } = useAuth()
  const { toast } = useToast()

  const [users, setUsers] = useState<User[]>([])
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [currentMunicipality, setCurrentMunicipality] = useState<Municipality | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdatingIssuer, setIsUpdatingIssuer] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState<{ role: UserRole; name: string }>({
    role: 'agente',
    name: '',
  })

  const isAdmin = currentUser?.role === 'administrador'

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [usersList, munsList] = await Promise.all([
        usersService.list(),
        municipalitiesService.list(),
      ])
      setUsers(usersList)
      setMunicipalities(munsList)
      if (currentUser?.municipality) {
        const currentMun = munsList.find((m) => m.id === currentUser.municipality)
        if (currentMun) setCurrentMunicipality(currentMun)
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar usuários',
        description: getErrorMessage(err),
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenEdit = (u: User) => {
    setEditingUser(u)
    setFormData({
      role: u.role || 'agente',
      name: u.name || '',
    })
    setIsEditModalOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    try {
      setIsSaving(true)
      await usersService.update(editingUser.id, {
        name: formData.name,
        role: formData.role,
      })
      toast({ title: 'Perfil do usuário atualizado com sucesso' })
      setIsEditModalOpen(false)
      loadData()
      if (editingUser.id === currentUser?.id) {
        refreshUser()
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar perfil',
        description: getErrorMessage(err),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const getRoleBadge = (role?: UserRole) => {
    switch (role) {
      case 'administrador':
        return <Badge className="bg-purple-700 text-white font-medium">Administrador</Badge>
      case 'coordenador':
        return <Badge className="bg-blue-600 text-white font-medium">Coordenador</Badge>
      case 'agente':
      default:
        return <Badge className="bg-slate-600 text-white font-medium">Agente</Badge>
    }
  }

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase()
    return (
      !searchTerm ||
      (u.name && u.name.toLowerCase().includes(term)) ||
      u.email.toLowerCase().includes(term) ||
      (u.role && u.role.toLowerCase().includes(term))
    )
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Users className="w-5 h-5 text-indigo-600" />
          Gestão de Usuários e Perfis de Acesso
        </h2>
        <p className="text-xs text-slate-500">
          Controle de acesso por função (Administrador, Coordenador e Agente) e isolamento por
          município.
        </p>
      </div>

      {/* Bloco de Designação de Emissor de Autorizações (Corte e Poda) */}
      {(currentUser?.role === 'administrador' || currentUser?.role === 'coordenador') &&
        currentMunicipality && (
          <Card className="border-emerald-200 bg-emerald-50/60 shadow-xs">
            <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-sm font-bold text-emerald-950">
                    Emissor Oficial de Autorizações de Corte e Poda
                  </h3>
                </div>
                <p className="text-xs text-emerald-800 mt-1 max-w-xl">
                  Apenas 1 usuário por município pode ser formalmente designado para assinar e
                  emitir autorizações de intervenção arbórea. Essa trava é fiscalizada pelo backend.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <Select
                  value={currentMunicipality.authorized_issuer || 'none'}
                  onValueChange={async (val) => {
                    try {
                      setIsUpdatingIssuer(true)
                      const newIssuerId = val === 'none' ? '' : val
                      const updated = await municipalitiesService.update(currentMunicipality.id, {
                        authorized_issuer: newIssuerId,
                      })
                      setCurrentMunicipality(updated)
                      toast({
                        title: 'Emissor designado atualizado!',
                        description:
                          'A designação oficial foi salva e já está em vigor no backend.',
                      })
                    } catch (err) {
                      toast({
                        variant: 'destructive',
                        title: 'Erro ao atualizar emissor',
                        description: getErrorMessage(err),
                      })
                    } finally {
                      setIsUpdatingIssuer(false)
                    }
                  }}
                  disabled={isUpdatingIssuer}
                >
                  <SelectTrigger className="w-full md:w-64 bg-white border-emerald-300 text-xs">
                    <SelectValue placeholder="Selecione o emissor..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum designado (Padrão Admin/Coord)</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Filter Bar */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Buscar usuário por nome, e-mail ou perfil..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs rounded-lg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <p className="text-xs">Carregando usuários...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Users className="w-8 h-8 stroke-1 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Nenhum usuário encontrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-200">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-700">Usuário</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">E-mail</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">
                  Perfil / Função
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">Município</TableHead>
                {isAdmin && (
                  <TableHead className="text-xs font-semibold text-slate-700 text-right">
                    Ações
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => {
                const mun = municipalities.find((m) => m.id === u.municipality)
                const isSelf = u.id === currentUser?.id

                return (
                  <TableRow key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="w-8 h-8 ring-1 ring-slate-200 bg-slate-100">
                          <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-bold">
                            {u.name ? u.name.slice(0, 2).toUpperCase() : 'DC'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-xs text-slate-900 flex items-center gap-1.5">
                            {u.name || 'Sem nome'}
                            {isSelf && (
                              <Badge
                                variant="outline"
                                className="text-[10px] py-0 px-1 border-blue-400 text-blue-600"
                              >
                                Você
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400">ID: {u.id}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">{u.email}</TableCell>
                    <TableCell>{getRoleBadge(u.role)}</TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {mun ? `${mun.name} (${mun.city}/${mun.state})` : 'Não definido'}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenEdit(u)}
                          className="text-indigo-600 hover:text-indigo-700 text-xs h-8"
                        >
                          <Edit2 className="w-3.5 h-3.5 mr-1" />
                          Editar Perfil
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Edit User Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <form onSubmit={handleSave} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                Alterar Perfil de Acesso
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Defina o nível de privilégio do usuário no sistema de Defesa Civil.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Nome do Usuário</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Função / Perfil *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(val: UserRole) => setFormData({ ...formData, role: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agente">
                      Agente (Operacional padrão: registro e edição)
                    </SelectItem>
                    <SelectItem value="coordenador">
                      Coordenador (Operacional + reabertura de ocorrências + auditoria)
                    </SelectItem>
                    <SelectItem value="administrador">
                      Administrador (Acesso irrestrito + gestão de usuários)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                <p className="font-semibold text-slate-700">Permissões Efetivas:</p>
                <ul className="list-disc pl-4 text-[11px] text-slate-600 space-y-0.5">
                  <li>
                    <strong>Agente:</strong> cria, visualiza e atualiza ocorrências operacionais.
                  </li>
                  <li>
                    <strong>Coordenador:</strong> reabre ocorrências concluídas e consulta a
                    auditoria.
                  </li>
                  <li>
                    <strong>Administrador:</strong> gerencia usuários, configurações e auditoria
                    municipal.
                  </li>
                </ul>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
