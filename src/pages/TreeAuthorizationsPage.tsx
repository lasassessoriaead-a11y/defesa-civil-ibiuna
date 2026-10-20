import React, { useState, useEffect } from 'react'
import {
  TreeDeciduous,
  Plus,
  Search,
  Filter,
  Printer,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  User as UserIcon,
  MapPin,
  Building,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  treeAuthorizationsService,
  requestersService,
  municipalitiesService,
  usersService,
} from '@/services/defesa-civil'
import type {
  TreeAuthorization,
  TreeAuthType,
  Requester,
  Municipality,
  User,
} from '@/types/defesa-civil'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RichEditor } from '@/components/defesa-civil/RichEditor'
import { TreeAuthorizationPrintView } from '@/components/defesa-civil/TreeAuthorizationPrintView'
import { DocumentStatusBadge } from '@/components/defesa-civil/StatusBadges'

export const TreeAuthorizationsPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [authorizations, setAuthorizations] = useState<TreeAuthorization[]>([])
  const [requesters, setRequesters] = useState<Requester[]>([])
  const [currentMunicipality, setCurrentMunicipality] = useState<Municipality | null>(null)
  const [usersList, setUsersList] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Modais
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingAuth, setEditingAuth] = useState<TreeAuthorization | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Formulário
  const [formData, setFormData] = useState({
    type: 'poda' as TreeAuthType,
    requester: '',
    tree_quantity: 1,
    tree_species: '',
    address: '',
    neighborhood: '',
    risk_reason: 'Risco de queda de galhos sobre fiação e via pública',
    technical_report:
      '<p>Vistoria técnica realizada pela equipe da Defesa Civil constatou a necessidade de intervenção preventiva no espécime arbóreo indicado, em razão de avarias estruturais e proximidade à rede de serviços essenciais.</p><p>Recomenda-se a execução técnica com isolamento da área e uso obrigatório de EPIs.</p>',
    compensatory_measures: 'Plantio de 02 (duas) mudas de espécies nativas no perímetro urbano.',
  })

  // Impressão / PDF
  const [viewingAuth, setViewingAuth] = useState<TreeAuthorization | null>(null)
  const [isPrintOpen, setIsPrintOpen] = useState(false)

  // Verificação de emissor autorizado
  // (O usuário é o emissor designado da prefeitura OU coordenador/admin se nenhum designado tiver sido definido)
  const isUserDesignatedIssuer = () => {
    if (!user || !currentMunicipality) return false
    if (currentMunicipality.authorized_issuer) {
      return currentMunicipality.authorized_issuer === user.id
    }
    // Se ainda não houver nenhum designado explicitamente configurado na prefeitura:
    return user.role === 'administrador' || user.role === 'coordenador'
  }

  // Carregar dados
  const loadData = async () => {
    setIsLoading(true)
    try {
      const [authsData, reqsData, usersData] = await Promise.all([
        treeAuthorizationsService.list(),
        requestersService.list(),
        usersService.list(),
      ])
      setAuthorizations(authsData)
      setRequesters(reqsData)
      setUsersList(usersData)

      if (user?.municipality) {
        try {
          const mun = await municipalitiesService.get(user.municipality)
          setCurrentMunicipality(mun)
        } catch {
          /* intentionally ignored */
        }
      }
    } catch (err) {
      toast({
        title: 'Erro ao carregar autorizações',
        description: 'Não foi possível carregar os registros de poda e corte.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.municipality])

  // Abrir modal de criação
  const handleOpenNew = () => {
    setEditingAuth(null)
    setFormData({
      type: 'poda',
      requester: requesters[0]?.id || '',
      tree_quantity: 1,
      tree_species: '',
      address: '',
      neighborhood: '',
      risk_reason: 'Risco iminente de galhos na rede elétrica e pedestres',
      technical_report:
        '<p>Vistoria técnica realizada constatou a necessidade de intervenção preventiva imediata. Parecer favorável à execução com isolamento do local.</p>',
      compensatory_measures: 'Plantio compensatório de 2 mudas nativas em área apropriada.',
    })
    setIsEditorOpen(true)
  }

  // Abrir modal de edição
  const handleOpenEdit = (auth: TreeAuthorization) => {
    setEditingAuth(auth)
    setFormData({
      type: auth.type,
      requester: auth.requester || '',
      tree_quantity: auth.tree_quantity || 1,
      tree_species: auth.tree_species || '',
      address: auth.address || '',
      neighborhood: auth.neighborhood || '',
      risk_reason: auth.risk_reason || '',
      technical_report: auth.technical_report || '',
      compensatory_measures: auth.compensatory_measures || '',
    })
    setIsEditorOpen(true)
  }

  // Ao selecionar requerente, preencher endereço automaticamente se ele tiver
  const handleRequesterChange = (reqId: string) => {
    setFormData((prev) => {
      const selReq = requesters.find((r) => r.id === reqId)
      return {
        ...prev,
        requester: reqId,
        address: selReq?.address && !prev.address ? selReq.address : prev.address,
      }
    })
  }

  // Salvar autorização (online ou offline)
  const handleSave = async (asIssued = false) => {
    if (!formData.requester) {
      toast({
        title: 'Requerente obrigatório',
        description: 'Selecione um requerente cadastrado para vincular a autorização.',
        variant: 'destructive',
      })
      return
    }
    if (!formData.address.trim() || !formData.technical_report.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o endereço da árvore e o laudo/relato técnico.',
        variant: 'destructive',
      })
      return
    }

    // Validação frontend de usuário designado
    if (asIssued && !isUserDesignatedIssuer()) {
      toast({
        title: 'Permissão Negada',
        description:
          'Apenas o usuário designado pela Coordenadoria tem permissão para emitir autorizações oficiais.',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const payload: Partial<TreeAuthorization> = {
        municipality: user?.municipality,
        type: formData.type,
        requester: formData.requester,
        tree_quantity: Number(formData.tree_quantity) || 1,
        tree_species: formData.tree_species,
        address: formData.address,
        neighborhood: formData.neighborhood,
        risk_reason: formData.risk_reason,
        technical_report: formData.technical_report,
        compensatory_measures: formData.compensatory_measures,
        status: asIssued ? 'emitida' : editingAuth ? editingAuth.status : 'rascunho',
      }

      let saved: TreeAuthorization
      const agentName = user?.name || 'Agente'

      if (editingAuth) {
        saved = await treeAuthorizationsService.update(editingAuth.id, payload)
        toast({
          title: asIssued ? 'Autorização Emitida com Sucesso!' : 'Rascunho Atualizado',
          description: asIssued
            ? `Autorização oficial registrada: ${saved.number} (Validade: 90 dias)`
            : 'As alterações foram salvas com sucesso.',
        })
      } else {
        saved = await treeAuthorizationsService.create(payload, agentName)
        const isOffline = saved.id.startsWith('temp_') || saved.number?.startsWith('OFF-')

        toast({
          title: isOffline
            ? 'Autorização salva em fila offline!'
            : asIssued
              ? 'Autorização Emitida com Sucesso!'
              : 'Rascunho Salvo',
          description: isOffline
            ? `Identificação provisória: ${saved.number}. O servidor revalidará suas permissões na reconexão antes de emitir a numeração oficial atômica.`
            : asIssued
              ? `Autorização oficial registrada: ${saved.number} (Validade: 90 dias)`
              : 'Novo rascunho de autorização criado.',
        })
      }

      setIsEditorOpen(false)
      loadData()

      if (asIssued && saved.number && !saved.number.startsWith('OFF-')) {
        setViewingAuth(saved)
        setIsPrintOpen(true)
      }
    } catch (err: unknown) {
      console.error('[TreeAuthorizations] Erro ao salvar:', err)
      const errorMsg =
        (err as any)?.data?.message ||
        (err as any)?.response?.message ||
        (err instanceof Error ? err.message : 'Falha ao salvar no servidor.')
      toast({
        title: 'Erro ao processar autorização',
        description: `${errorMsg}. Seus dados digitados foram preservados para nova tentativa.`,
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Cancelar autorização
  const handleCancelAuth = async (auth: TreeAuthorization) => {
    if (!confirm(`Deseja realmente cancelar a autorização ${auth.number || 'selecionada'}?`)) return
    try {
      await treeAuthorizationsService.update(auth.id, { status: 'cancelada' })
      toast({
        title: 'Autorização cancelada',
        description: `A autorização ${auth.number} foi marcada como cancelada.`,
      })
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao cancelar',
        description: err instanceof Error ? err.message : 'Falha ao cancelar autorização.',
        variant: 'destructive',
      })
    }
  }

  // Filtragem
  const filteredAuthorizations = authorizations.filter((auth) => {
    const reqName = auth.expand?.requester?.name || ''
    const matchesSearch =
      (auth.number && auth.number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (auth.address && auth.address.toLowerCase().includes(searchTerm.toLowerCase())) ||
      reqName.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || auth.status === statusFilter
    const matchesType = typeFilter === 'all' || auth.type === typeFilter

    return matchesSearch && matchesStatus && matchesType
  })

  // Nome do emissor designado no município
  const designatedUserName = () => {
    if (!currentMunicipality?.authorized_issuer) {
      return 'Coordenador / Administrador Municipal (Geral)'
    }
    const issuer = usersList.find((u) => u.id === currentMunicipality.authorized_issuer)
    return issuer?.name || issuer?.email || 'Usuário Designado'
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-lg border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Autorizações de Corte e Poda
            </h1>
            <Badge
              variant="outline"
              className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
            >
              Manejo Arbóreo
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Emissão controlada de autorizações com validade estrita de 90 dias, numeração sequencial
            atômica (AUT-ANO-XXXXX) e laudo técnico regulamentar.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleOpenNew}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-xs"
          >
            <Plus className="w-4 h-4" /> Nova Autorização
          </Button>
        </div>
      </div>

      {/* Banner de Controle e Emissor Designado */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-emerald-950">
              Emissor Oficial Designado: {designatedUserName()}
            </h3>
            <p className="text-xs text-emerald-800 mt-0.5">
              {isUserDesignatedIssuer()
                ? '✓ Você possui autorização ativa para emissão oficial de cortes e podas.'
                : '⚠ Apenas o usuário designado pela coordenação municipal pode assinar a emissão oficial (backend validado). Você pode elaborar rascunhos.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-900 bg-white px-3 py-1.5 rounded border border-emerald-200">
          <Clock className="w-4 h-4 text-emerald-600" />
          <span>Validade legal: 90 dias corridos</span>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-lg border shadow-xs">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por número, requerente ou endereço..."
            className="pl-9 bg-slate-50 border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-500 whitespace-nowrap">Tipo:</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32 bg-slate-50 border-slate-200 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="poda">Poda</SelectItem>
                <SelectItem value="corte">Corte</SelectItem>
                <SelectItem value="corte_e_poda">Corte e Poda</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs text-slate-500 whitespace-nowrap">Status:</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32 bg-slate-50 border-slate-200 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="emitida">Emitidas</SelectItem>
                <SelectItem value="rascunho">Rascunhos</SelectItem>
                <SelectItem value="cancelada">Canceladas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Listagem de Autorizações */}
      <Card className="border shadow-xs">
        <CardHeader className="p-4 border-b bg-slate-50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-800">
              Histórico de Autorizações Arbóreas ({filteredAuthorizations.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Numeração sequencial gerada pelo servidor (AUT-ANO-XXXXX)
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              Carregando autorizações...
            </div>
          ) : filteredAuthorizations.length === 0 ? (
            <div className="p-12 text-center">
              <TreeDeciduous className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Nenhuma autorização cadastrada</p>
              <p className="text-xs text-slate-400 mt-1">
                Cadastre solicitações de poda ou corte a partir dos requerentes municipais.
              </p>
              <Button onClick={handleOpenNew} size="sm" variant="outline" className="mt-4 gap-2">
                <Plus className="w-3.5 h-3.5" /> Criar Autorização
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredAuthorizations.map((auth) => (
                <div
                  key={auth.id}
                  className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 font-mono text-sm">
                        {auth.number || '[RASCUNHO NÃO EMITIDO]'}
                      </span>
                      <DocumentStatusBadge status={auth.status} />
                      <Badge
                        variant="outline"
                        className="text-xs bg-slate-50 uppercase font-semibold"
                      >
                        {auth.type === 'corte_e_poda' ? 'Corte & Poda' : auth.type}
                      </Badge>
                      {auth.expiration_date && (
                        <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1 font-medium">
                          <Calendar className="w-3 h-3" />
                          Válido até: {new Date(auth.expiration_date).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-slate-400" />
                      <span>{auth.expand?.requester?.name || 'Requerente não identificado'}</span>
                      {auth.expand?.requester?.document && (
                        <span className="text-xs font-normal text-slate-500">
                          (Doc: {auth.expand.requester.document})
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {auth.address}
                        {auth.neighborhood ? `, ${auth.neighborhood}` : ''}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Qtd:</strong> {auth.tree_quantity} árvore(s)
                      </span>
                      {auth.authorized_by_name && (
                        <>
                          <span>•</span>
                          <span>
                            <strong>Emissor:</strong> {auth.authorized_by_name}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setViewingAuth(auth)
                        setIsPrintOpen(true)
                      }}
                      className="h-8 text-xs gap-1.5 text-slate-700 hover:text-emerald-700 hover:bg-emerald-50 border-slate-200"
                    >
                      <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
                    </Button>

                    {auth.status === 'rascunho' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(auth)}
                        className="h-8 text-xs gap-1.5 text-slate-700 hover:bg-slate-100"
                      >
                        Editar
                      </Button>
                    )}

                    {auth.status === 'emitida' &&
                      (user?.role === 'administrador' || user?.role === 'coordenador') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelAuth(auth)}
                          className="h-8 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          Cancelar
                        </Button>
                      )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL DE CRIAÇÃO / EDIÇÃO */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-slate-50">
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <TreeDeciduous className="w-5 h-5 text-emerald-600" />
              {editingAuth
                ? `Editar Autorização (${editingAuth.number || 'Rascunho'})`
                : 'Nova Autorização de Corte e Poda'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Vincule a um requerente cadastrado na prefeitura. A validade de 90 dias é calculada
              automaticamente na emissão oficial.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Requerente e Tipo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Requerente Cadastrado *
                </Label>
                {requesters.length === 0 ? (
                  <p className="text-xs text-red-600 py-2">
                    Nenhum requerente cadastrado. Cadastre um requerente antes de emitir a
                    autorização.
                  </p>
                ) : (
                  <Select value={formData.requester} onValueChange={handleRequesterChange}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Selecione o requerente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {requesters.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name} ({r.document})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Tipo de Intervenção *
                </Label>
                <Select
                  value={formData.type}
                  onValueChange={(val: TreeAuthType) => setFormData({ ...formData, type: val })}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="poda">Poda Drástica / Preventiva</SelectItem>
                    <SelectItem value="corte">Corte (Supressão Arbórea)</SelectItem>
                    <SelectItem value="corte_e_poda">Corte e Poda Conjuntos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Endereço e Detalhes da Árvore */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs font-semibold text-slate-700">
                  Endereço da Intervenção *
                </Label>
                <Input
                  placeholder="Ex.: Rua das Flores, 250 (em frente ao imóvel)"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Bairro</Label>
                <Input
                  placeholder="Ex.: Jardim América"
                  value={formData.neighborhood}
                  onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Quantidade de Árvores *
                </Label>
                <Input
                  type="number"
                  min="1"
                  value={formData.tree_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, tree_quantity: parseInt(e.target.value) || 1 })
                  }
                />
              </div>

              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs font-semibold text-slate-700">
                  Espécie(s) / Descrição Arbórea
                </Label>
                <Input
                  placeholder="Ex.: Eucalipto de grande porte / Sibipiruna"
                  value={formData.tree_species}
                  onChange={(e) => setFormData({ ...formData, tree_species: e.target.value })}
                />
              </div>
            </div>

            {/* Motivo do Risco */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Motivo / Avaliação do Risco
              </Label>
              <Input
                placeholder="Ex.: Risco de queda iminente sobre residência e fiação elétrica de alta tensão"
                value={formData.risk_reason}
                onChange={(e) => setFormData({ ...formData, risk_reason: e.target.value })}
              />
            </div>

            {/* Parecer Técnico Conclusivo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Laudo e Relato Técnico Conclusivo (Padronizado) *
              </Label>
              <RichEditor
                value={formData.technical_report}
                onChange={(val) => setFormData({ ...formData, technical_report: val })}
                placeholder="Descreva o laudo pericial da vistoria..."
              />
            </div>

            {/* Medidas Compensatórias */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Medidas Compensatórias Ambientais
              </Label>
              <Input
                placeholder="Ex.: Plantio compensatório de 2 mudas nativas no perímetro urbano no prazo de 60 dias"
                value={formData.compensatory_measures}
                onChange={(e) =>
                  setFormData({ ...formData, compensatory_measures: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter className="p-4 border-t bg-slate-50 flex items-center justify-between sm:justify-between">
            <Button variant="ghost" onClick={() => setIsEditorOpen(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="border-slate-300"
              >
                Salvar Rascunho
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={isSaving || !isUserDesignatedIssuer()}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-xs"
                title={
                  !isUserDesignatedIssuer()
                    ? 'Somente o emissor designado pelo município pode emitir'
                    : 'Emitir autorização oficial'
                }
              >
                <CheckCircle2 className="w-4 h-4" /> Emitir Oficialmente (90 Dias)
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COMPONENTE DE IMPRESSÃO / PDF */}
      <TreeAuthorizationPrintView
        authorization={viewingAuth}
        municipality={currentMunicipality}
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
      />
    </div>
  )
}
