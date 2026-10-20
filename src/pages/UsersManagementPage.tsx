import React, { useState, useEffect } from 'react'
import {
  Users,
  Shield,
  Search,
  UserPlus,
  KeyRound,
  Edit3,
  CheckCircle2,
  XCircle,
  Building2,
  AlertCircle,
  Loader2,
  Lock,
  Mail,
  User as UserIcon,
  Filter,
  RefreshCw,
  ShieldAlert,
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
import {
  usersService,
  municipalitiesService,
  sectorWorkspaceConfigService,
  getErrorMessage,
} from '@/services/defesa-civil'
import type { User, UserRole, Municipality, DepartmentKey } from '@/types/defesa-civil'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

// Secretarias padrão do sistema de Defesa Civil e Gestão Integrada
const STANDARD_SECRETARIAS: Array<{ key: DepartmentKey; label: string }> = [
  { key: 'defesa_civil', label: 'Defesa Civil (COMPDEC)' },
  { key: 'desenvolvimento_urbano', label: 'Desenvolvimento Urbano e Habitação' },
  { key: 'assistencia_social', label: 'Assistência Social (CRAS/CREAS)' },
  { key: 'saude', label: 'Saúde e Vigilância em Saúde' },
  { key: 'educacao', label: 'Educação e Cultura' },
  { key: 'obras', label: 'Obras e Infraestrutura' },
  { key: 'meio_ambiente', label: 'Meio Ambiente' },
  { key: 'servicos_municipais', label: 'Serviços Municipais' },
  { key: 'administracao', label: 'Administração Municipal' },
  { key: 'outras', label: 'Outras Secretarias / Setores' },
]

export const UsersManagementPage: React.FC = () => {
  const { user: currentUser, refreshUser } = useAuth()
  const { toast } = useToast()

  const [users, setUsers] = useState<User[]>([])
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [currentMunicipality, setCurrentMunicipality] = useState<Municipality | null>(null)
  const [configurableCategories, setConfigurableCategories] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativos' | 'inativos'>('todos')
  const [secretariaFilter, setSecretariaFilter] = useState<string>('todas')

  // Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isResetPasswordModalOpen, setIsResetPasswordModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUpdatingIssuer, setIsUpdatingIssuer] = useState(false)

  // Formulário de Criação
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    role: 'agente' as UserRole,
    department: 'defesa_civil' as DepartmentKey,
  })

  // Formulário de Edição
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'agente' as UserRole,
    department: 'defesa_civil' as DepartmentKey,
    isActive: true,
  })

  // Formulário de Redefinição de Senha
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null)
  const [resetPasswordForm, setResetPasswordForm] = useState({
    password: '',
    passwordConfirm: '',
  })

  const isAdmin = currentUser?.role === 'administrador'

  const loadData = async () => {
    try {
      setIsLoading(true)
      const [usersList, munsList, sectorConfigs] = await Promise.all([
        usersService.list(),
        municipalitiesService.list().catch(() => []),
        sectorWorkspaceConfigService.list().catch(() => []),
      ])

      // Extrair categorias configuráveis já cadastradas nas secretarias
      const customCats: string[] = []
      sectorConfigs.forEach((sc) => {
        if (Array.isArray(sc.custom_categories)) {
          sc.custom_categories.forEach((cat) => {
            if (cat && !customCats.includes(cat)) {
              customCats.push(cat)
            }
          })
        }
      })
      setConfigurableCategories(customCats)

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

  // Abertura de modal de Criação
  const handleOpenCreate = () => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Acesso Restrito',
        description: 'Apenas administradores municipais podem cadastrar novas contas.',
      })
      return
    }
    setCreateForm({
      name: '',
      email: '',
      password: '',
      passwordConfirm: '',
      role: 'agente',
      department: 'defesa_civil',
    })
    setIsCreateModalOpen(true)
  }

  // Submissão de Criação de Usuário
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Acesso Restrito',
        description: 'Apenas administradores podem cadastrar usuários.',
      })
      return
    }

    if (!createForm.name.trim()) {
      toast({ variant: 'destructive', title: 'Nome obrigatório' })
      return
    }
    if (!createForm.email.trim()) {
      toast({ variant: 'destructive', title: 'E-mail obrigatório' })
      return
    }
    if (!createForm.password || createForm.password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Senha muito curta',
        description: 'A senha inicial deve ter no mínimo 8 caracteres.',
      })
      return
    }
    if (createForm.password !== createForm.passwordConfirm) {
      toast({
        variant: 'destructive',
        title: 'Senhas divergentes',
        description: 'A confirmação de senha não confere.',
      })
      return
    }

    try {
      setIsSubmitting(true)
      const res = await usersService.adminCreate({
        name: createForm.name.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        role: createForm.role,
        department: createForm.department,
      })

      toast({
        title: 'Usuário cadastrado com sucesso!',
        description: `A conta para ${res.user.name || res.user.email} foi criada na prefeitura.`,
      })

      setIsCreateModalOpen(false)
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar usuário',
        description: getErrorMessage(err),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Abertura de modal de Edição
  const handleOpenEdit = (u: User) => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Acesso Restrito',
        description: 'Apenas administradores podem editar perfis de usuários.',
      })
      return
    }
    setEditingUser(u)
    setEditForm({
      name: u.name || '',
      role: u.role || 'agente',
      department: (u.department as DepartmentKey) || 'defesa_civil',
      isActive: u.is_active !== false,
    })
    setIsEditModalOpen(true)
  }

  // Submissão de Edição
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Acesso Restrito',
        description: 'Apenas administradores podem atualizar usuários.',
      })
      return
    }

    try {
      setIsSubmitting(true)
      await usersService.adminUpdate({
        id: editingUser.id,
        name: editForm.name.trim(),
        role: editForm.role,
        department: editForm.department,
        is_active: editForm.isActive,
      })

      toast({
        title: 'Usuário atualizado com sucesso',
        description: `As alterações para ${editForm.name || editingUser.email} foram salvas.`,
      })
      setIsEditModalOpen(false)
      loadData()
      if (editingUser.id === currentUser?.id) {
        refreshUser()
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar usuário',
        description: getErrorMessage(err),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Abertura de modal de Redefinição de Senha
  const handleOpenResetPassword = (u: User) => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Acesso Restrito',
        description: 'Apenas administradores podem redefinir senhas.',
      })
      return
    }
    setResetTargetUser(u)
    setResetPasswordForm({
      password: '',
      passwordConfirm: '',
    })
    setIsResetPasswordModalOpen(true)
  }

  // Submissão de Redefinição de Senha
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetTargetUser) return

    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Acesso Restrito',
        description: 'Apenas administradores podem redefinir senhas.',
      })
      return
    }

    if (!resetPasswordForm.password || resetPasswordForm.password.length < 8) {
      toast({
        variant: 'destructive',
        title: 'Senha inválida',
        description: 'A nova senha deve ter no mínimo 8 caracteres.',
      })
      return
    }
    if (resetPasswordForm.password !== resetPasswordForm.passwordConfirm) {
      toast({
        variant: 'destructive',
        title: 'Senhas não coincidem',
        description: 'A confirmação de senha é diferente da nova senha informada.',
      })
      return
    }

    try {
      setIsSubmitting(true)
      const res = await usersService.adminResetPassword({
        id: resetTargetUser.id,
        password: resetPasswordForm.password,
      })

      toast({
        title: 'Senha redefinida com sucesso!',
        description:
          res.message ||
          `A nova senha de ${resetTargetUser.name || resetTargetUser.email} já está em vigor.`,
      })
      setIsResetPasswordModalOpen(false)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao redefinir senha',
        description: getErrorMessage(err),
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Alternar rapidamente ativação / desativação
  const handleToggleActiveQuick = async (u: User) => {
    if (!isAdmin) {
      toast({
        variant: 'destructive',
        title: 'Acesso Restrito',
        description: 'Apenas administradores podem ativar ou desativar contas.',
      })
      return
    }
    if (u.id === currentUser?.id) {
      toast({
        variant: 'destructive',
        title: 'Operação não permitida',
        description: 'Você não pode desativar a sua própria conta de administrador.',
      })
      return
    }

    const newStatus = u.is_active === false ? true : false
    try {
      await usersService.adminUpdate({
        id: u.id,
        is_active: newStatus,
      })
      toast({
        title: newStatus ? 'Conta ativada com sucesso' : 'Conta desativada',
        description: newStatus
          ? `O usuário ${u.name || u.email} agora pode acessar o sistema.`
          : `O acesso do usuário ${u.name || u.email} foi bloqueado no servidor.`,
      })
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao alterar situação',
        description: getErrorMessage(err),
      })
    }
  }

  const getRoleBadge = (role?: UserRole) => {
    switch (role) {
      case 'administrador':
        return (
          <Badge className="bg-purple-700 text-white font-medium hover:bg-purple-800">
            Administrador
          </Badge>
        )
      case 'coordenador':
        return (
          <Badge className="bg-blue-600 text-white font-medium hover:bg-blue-700">
            Coordenador
          </Badge>
        )
      case 'agente':
      default:
        return (
          <Badge className="bg-slate-600 text-white font-medium hover:bg-slate-700">Agente</Badge>
        )
    }
  }

  const getDepartmentLabel = (dept?: string) => {
    if (!dept) return 'Defesa Civil (Padrão)'
    const std = STANDARD_SECRETARIAS.find((s) => s.key === dept)
    if (std) return std.label
    return dept
  }

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      !searchTerm ||
      (u.name && u.name.toLowerCase().includes(term)) ||
      u.email.toLowerCase().includes(term) ||
      (u.role && u.role.toLowerCase().includes(term)) ||
      (u.department && u.department.toLowerCase().includes(term))

    const matchesStatus =
      statusFilter === 'todos' ||
      (statusFilter === 'ativos' && u.is_active !== false) ||
      (statusFilter === 'inativos' && u.is_active === false)

    const matchesSecretaria =
      secretariaFilter === 'todas' ||
      (secretariaFilter === 'defesa_civil' && (!u.department || u.department === 'defesa_civil')) ||
      u.department === secretariaFilter

    return matchesSearch && matchesStatus && matchesSecretaria
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header com Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Gestão de Usuários e Perfis
            </h1>
            <Badge
              variant="outline"
              className="text-xs border-indigo-200 text-indigo-700 bg-indigo-50/50"
            >
              Administração Municipal
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Controle de contas, secretarias de atuação, perfis de privilégio e redefinição de senhas
            com isolamento por prefeitura.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="text-xs h-9 text-slate-700 border-slate-300"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          {isAdmin ? (
            <Button
              size="sm"
              onClick={handleOpenCreate}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-9 shadow-sm"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              Novo Usuário
            </Button>
          ) : (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Modo consulta (apenas administradores podem criar ou alterar contas)</span>
            </div>
          )}
        </div>
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

      {/* Barra de Filtros */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Campo de Busca */}
            <div className="relative md:col-span-6">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar usuário por nome, e-mail, perfil ou secretaria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs rounded-lg border-slate-200"
              />
            </div>

            {/* Filtro por Situação */}
            <div className="md:col-span-3">
              <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
                <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                  <SelectValue placeholder="Situação da Conta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as Situações</SelectItem>
                  <SelectItem value="ativos">Somente Ativos</SelectItem>
                  <SelectItem value="inativos">Somente Inativos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filtro por Secretaria */}
            <div className="md:col-span-3">
              <Select value={secretariaFilter} onValueChange={(val) => setSecretariaFilter(val)}>
                <SelectTrigger className="h-9 text-xs bg-white border-slate-200">
                  <SelectValue placeholder="Secretaria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Secretarias</SelectItem>
                  {STANDARD_SECRETARIAS.map((sec) => (
                    <SelectItem key={sec.key} value={sec.key}>
                      {sec.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Usuários */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            <p className="text-xs">Carregando usuários da prefeitura...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Users className="w-8 h-8 stroke-1 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Nenhum usuário encontrado</p>
            <p className="text-xs text-slate-400">
              Tente ajustar os filtros ou cadastrar um novo usuário.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50/80 border-b border-slate-200">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-700">Usuário</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">
                  E-mail Institucional
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">
                  Secretaria / Setor
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">
                  Perfil de Acesso
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">Situação</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-right">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => {
                const isSelf = u.id === currentUser?.id
                const isActive = u.is_active !== false

                return (
                  <TableRow key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Nome e Avatar */}
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="w-8 h-8 ring-1 ring-slate-200 bg-slate-100 shrink-0">
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
                                className="text-[10px] py-0 px-1 border-indigo-300 text-indigo-700 bg-indigo-50/50"
                              >
                                Você
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">ID: {u.id}</div>
                        </div>
                      </div>
                    </TableCell>

                    {/* Email */}
                    <TableCell className="text-xs font-mono text-slate-700">{u.email}</TableCell>

                    {/* Secretaria */}
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-xs text-slate-800 font-medium">
                          {getDepartmentLabel(u.department)}
                        </span>
                      </div>
                    </TableCell>

                    {/* Perfil */}
                    <TableCell>{getRoleBadge(u.role)}</TableCell>

                    {/* Situação */}
                    <TableCell>
                      {isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 text-[11px] font-medium flex items-center gap-1 w-fit">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Ativo
                        </Badge>
                      ) : (
                        <Badge className="bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 text-[11px] font-medium flex items-center gap-1 w-fit">
                          <XCircle className="w-3 h-3 text-rose-600" />
                          Inativo
                        </Badge>
                      )}
                    </TableCell>

                    {/* Ações */}
                    <TableCell className="text-right">
                      {isAdmin ? (
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Editar Secretaria / Perfil */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(u)}
                            className="h-8 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-2"
                            title="Editar secretaria, perfil e dados"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1" />
                            Editar
                          </Button>

                          {/* Redefinir Senha */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenResetPassword(u)}
                            className="h-8 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 px-2"
                            title="Redefinir senha de acesso"
                          >
                            <KeyRound className="w-3.5 h-3.5 mr-1" />
                            Senha
                          </Button>

                          {/* Ativar / Desativar */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleActiveQuick(u)}
                            disabled={isSelf}
                            className={`h-8 text-xs px-2 ${
                              isActive
                                ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                                : 'text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50'
                            }`}
                            title={
                              isSelf
                                ? 'Você não pode desativar seu próprio usuário'
                                : isActive
                                  ? 'Desativar acesso'
                                  : 'Reativar acesso'
                            }
                          >
                            {isActive ? (
                              <>
                                <XCircle className="w-3.5 h-3.5 mr-1" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                Ativar
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Somente consulta</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: CRIAR NOVO USUÁRIO                              */}
      {/* ======================================================== */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                Criar Nova Conta Municipal
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                A conta nasce automaticamente vinculada à prefeitura e sob gestão administrativa
                local.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3.5 py-1">
              {/* Nome */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Nome Completo *</Label>
                <div className="relative">
                  <UserIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    required
                    placeholder="Ex: Carlos Eduardo Mendes"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="h-9 pl-9 text-xs"
                  />
                </div>
              </div>

              {/* E-mail */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  E-mail Institucional *
                </Label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    required
                    placeholder="ex: usuario@defesacivil.gov.br"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    className="h-9 pl-9 text-xs"
                  />
                </div>
              </div>

              {/* Secretaria */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Secretaria / Órgão Municipal *
                </Label>
                <Select
                  value={createForm.department}
                  onValueChange={(val: DepartmentKey) =>
                    setCreateForm({ ...createForm, department: val })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STANDARD_SECRETARIAS.map((sec) => (
                      <SelectItem key={sec.key} value={sec.key}>
                        {sec.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {configurableCategories.length > 0 && (
                  <p className="text-[11px] text-slate-400">
                    Categorias configuráveis ativas: {configurableCategories.slice(0, 4).join(', ')}
                  </p>
                )}
              </div>

              {/* Perfil de Acesso */}
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Perfil de Privilégio *
                </Label>
                <Select
                  value={createForm.role}
                  onValueChange={(val: UserRole) => setCreateForm({ ...createForm, role: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agente">
                      Agente (Operador padrão: registro de ocorrências, vistorias e atendimento)
                    </SelectItem>
                    <SelectItem value="coordenador">
                      Coordenador (Operacional + reabertura de ocorrências + emissão e auditoria)
                    </SelectItem>
                    <SelectItem value="administrador">
                      Administrador (Gestão total municipal: usuários, secretarias e auditoria)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Senha Inicial e Confirmação */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Senha Inicial *</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="password"
                      required
                      placeholder="Mínimo 8 caracteres"
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                      className="h-9 pl-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Confirmar Senha *</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="password"
                      required
                      placeholder="Repita a senha"
                      value={createForm.passwordConfirm}
                      onChange={(e) =>
                        setCreateForm({ ...createForm, passwordConfirm: e.target.value })
                      }
                      className="h-9 pl-9 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Box de Segurança */}
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <ShieldAlert className="w-3.5 h-3.5 text-indigo-600" />
                  Segurança Governamental:
                </div>
                <p>
                  A conta é criada diretamente no servidor via operação administrativa autenticada.
                  A senha não é registrada em texto claro em nenhum log.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-1.5" />
                )}
                Cadastrar Usuário
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* MODAL 2: EDITAR USUÁRIO (SECRETARIA / PERFIL / SITUAÇÃO)  */}
      {/* ======================================================== */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                Editar Perfil e Secretaria
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Altere a secretaria de lotação, o perfil de acesso e o estado de ativação da conta.
              </DialogDescription>
            </DialogHeader>

            {editingUser && (
              <div className="space-y-3.5 py-1">
                {/* Identificação do Usuário */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="text-xs font-semibold text-slate-900">
                    {editingUser.name || 'Sem nome'}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">{editingUser.email}</div>
                </div>

                {/* Nome */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Nome de Exibição *</Label>
                  <Input
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="h-9 text-xs"
                  />
                </div>

                {/* Secretaria */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Secretaria / Órgão Municipal *
                  </Label>
                  <Select
                    value={editForm.department}
                    onValueChange={(val: DepartmentKey) =>
                      setEditForm({ ...editForm, department: val })
                    }
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STANDARD_SECRETARIAS.map((sec) => (
                        <SelectItem key={sec.key} value={sec.key}>
                          {sec.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Perfil */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Perfil de Privilégio *
                  </Label>
                  <Select
                    value={editForm.role}
                    onValueChange={(val: UserRole) => setEditForm({ ...editForm, role: val })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="agente">Agente (Operacional padrão)</SelectItem>
                      <SelectItem value="coordenador">
                        Coordenador (Operacional + reabertura + emissão)
                      </SelectItem>
                      <SelectItem value="administrador">
                        Administrador (Gestão irrestrita municipal)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Situação da Conta (Ativação / Desativação) */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Situação de Acesso da Conta
                  </Label>
                  <Select
                    value={editForm.isActive ? 'ativo' : 'inativo'}
                    onValueChange={(val) => setEditForm({ ...editForm, isActive: val === 'ativo' })}
                    disabled={editingUser.id === currentUser?.id}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">
                        Conta Ativa (Acesso liberado ao sistema)
                      </SelectItem>
                      <SelectItem value="inativo">
                        Conta Inativa (Acesso bloqueado no servidor)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {editingUser.id === currentUser?.id && (
                    <p className="text-[11px] text-slate-400">
                      Você não pode desativar seu próprio usuário de administrador.
                    </p>
                  )}
                </div>
              </div>
            )}

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
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================================================== */}
      {/* MODAL 3: REDEFINIR SENHA                                 */}
      {/* ======================================================== */}
      <Dialog open={isResetPasswordModalOpen} onOpenChange={setIsResetPasswordModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                Redefinir Senha do Usuário
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Defina uma nova senha para o operador. A alteração entra em vigor imediatamente no
                servidor.
              </DialogDescription>
            </DialogHeader>

            {resetTargetUser && (
              <div className="space-y-3.5 py-1">
                <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-200 text-xs">
                  <div className="font-semibold text-amber-950">
                    {resetTargetUser.name || 'Sem nome'}
                  </div>
                  <div className="font-mono text-amber-800 text-[11px]">
                    {resetTargetUser.email}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Nova Senha *</Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="password"
                      required
                      placeholder="Mínimo 8 caracteres"
                      value={resetPasswordForm.password}
                      onChange={(e) =>
                        setResetPasswordForm({ ...resetPasswordForm, password: e.target.value })
                      }
                      className="h-9 pl-9 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">
                    Confirmar Nova Senha *
                  </Label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="password"
                      required
                      placeholder="Repita a nova senha"
                      value={resetPasswordForm.passwordConfirm}
                      onChange={(e) =>
                        setResetPasswordForm({
                          ...resetPasswordForm,
                          passwordConfirm: e.target.value,
                        })
                      }
                      className="h-9 pl-9 text-xs"
                    />
                  </div>
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-600">
                  A redefinição será registrada no diário de auditoria com autor, data e ação (a
                  nova senha nunca é gravada em texto claro).
                </div>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsResetPasswordModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-amber-600 hover:bg-amber-700 text-white text-xs"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                ) : (
                  <KeyRound className="w-4 h-4 mr-1.5" />
                )}
                Confirmar Redefinição
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default UsersManagementPage
