import React, { useState, useEffect } from 'react'
import {
  Users,
  Shield,
  Plus,
  Search,
  Shirt,
  HardHat,
  PackageCheck,
  FileCheck2,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Printer,
  Edit2,
  Trash2,
  ArrowRightLeft,
  ChevronRight,
  UserCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  agentProfilesService,
  epiItemsService,
  epiDeliveriesService,
  usersService,
  municipalitiesService,
} from '@/services/defesa-civil'
import type {
  AgentProfile,
  EpiItem,
  EpiDelivery,
  User,
  EpiCategory,
  EpiDeliveryAction,
  EmploymentType,
  AgentStatus,
  Municipality,
} from '@/types/defesa-civil'

const EPI_CATEGORY_LABELS: Record<EpiCategory, string> = {
  epi_cabeca: 'Proteção da Cabeça / Capacete',
  epi_respiratorio: 'Proteção Respiratória / Máscara',
  epi_maos: 'Proteção das Mãos / Luvas',
  epi_pes: 'Proteção dos Pés / Botas',
  uniforme: 'Uniforme / Vestuário Operacional',
  altura_resgate: 'Trabalho em Altura / Resgate',
  aquatico: 'Salvamento Aquático / Colete Salva-Vidas',
  outro: 'Outro Equipamento / Acessório',
}

const ACTION_TYPE_LABELS: Record<EpiDeliveryAction, string> = {
  entrega_inicial: 'Entrega Inicial (Cautela)',
  substituicao_desgaste: 'Substituição por Desgaste Natural',
  substituicao_dano: 'Substituição por Dano em Operação',
  devolucao_baixa: 'Devolução / Baixa de Acervo',
  emprestimo_temporario: 'Cautela Temporária',
}

export const AgentProfilesPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'agents' | 'catalog' | 'deliveries'>('agents')
  const [agents, setAgents] = useState<AgentProfile[]>([])
  const [epiItems, setEpiItems] = useState<EpiItem[]>([])
  const [deliveries, setDeliveries] = useState<EpiDelivery[]>([])
  const [systemUsers, setSystemUsers] = useState<User[]>([])
  const [currentMun, setCurrentMun] = useState<Municipality | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Modais de Criação/Edição
  const [isAgentModalOpen, setIsAgentModalOpen] = useState(false)
  const [isEpiModalOpen, setIsEpiModalOpen] = useState(false)
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)

  // Item selecionado para edição ou visualização do recibo
  const [selectedAgent, setSelectedAgent] = useState<AgentProfile | null>(null)
  const [selectedDelivery, setSelectedDelivery] = useState<EpiDelivery | null>(null)

  // Filtros
  const [searchAgent, setSearchAgent] = useState('')
  const [searchEpi, setSearchEpi] = useState('')
  const [filterDeliveryAgent, setFilterDeliveryAgent] = useState('all')

  // Forms states
  const [agentForm, setAgentForm] = useState<Partial<AgentProfile>>({
    full_name: '',
    registration_number: '',
    cpf: '',
    rg: '',
    blood_type: 'O+',
    emergency_contact: '',
    emergency_phone: '',
    employment_type: 'concursado',
    operational_role: 'Agente de Campo',
    status: 'ativo',
    tshirt_size: 'M',
    shirt_size: 'M',
    pants_size: '42',
    jacket_size: 'M',
    boot_size: '41',
    additional_measurements: '',
    notes: '',
  })

  const [epiForm, setEpiForm] = useState<Partial<EpiItem>>({
    name: '',
    category: 'uniforme',
    ca_number: '',
    specification: '',
    size: 'Único',
    stock_quantity: 0,
    min_stock_alert: 2,
    unit: 'un',
    required_for_roles: 'Todos os Agentes Operacionais',
    is_active: true,
  })

  const [deliveryForm, setDeliveryForm] = useState<Partial<EpiDelivery>>({
    agent: '',
    item: '',
    action_type: 'entrega_inicial',
    quantity: 1,
    delivery_date: new Date().toISOString().split('T')[0],
    item_size: '',
    item_specification: '',
    reason: 'Fornecimento regulamentar de uniforme e proteção individual',
    receipt_signed: true,
    receipt_document_number: `TERMO-EPI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    notes: '',
  })

  // Permissões
  const canManage = user?.role === 'administrador' || user?.role === 'coordenador'

  const loadAllData = async () => {
    setIsLoading(true)
    try {
      const [agentsData, episData, delivsData, usersData] = await Promise.all([
        agentProfilesService.list(),
        epiItemsService.list(),
        epiDeliveriesService.list(),
        usersService.list(),
      ])
      setAgents(agentsData)
      setEpiItems(episData)
      setDeliveries(delivsData)
      setSystemUsers(usersData)

      if (user?.municipality) {
        const mun = await municipalitiesService.get(user.municipality)
        setCurrentMun(mun)
      }
    } catch (err: any) {
      console.error('Erro ao carregar dados de Agentes e EPIs:', err)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados',
        description: err.message || 'Falha ao buscar registros do banco de dados.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAllData()
  }, [user])

  // ====================== HANDLERS ======================

  const handleOpenNewAgent = () => {
    setSelectedAgent(null)
    setAgentForm({
      user: '',
      full_name: '',
      registration_number: '',
      cpf: '',
      rg: '',
      blood_type: 'O+',
      emergency_contact: '',
      emergency_phone: '',
      employment_type: 'concursado',
      operational_role: 'Agente de Defesa Civil',
      status: 'ativo',
      tshirt_size: 'M',
      shirt_size: 'M',
      pants_size: '42',
      jacket_size: 'M',
      boot_size: '41',
      additional_measurements: '',
      notes: '',
    })
    setIsAgentModalOpen(true)
  }

  const handleEditAgent = (ag: AgentProfile) => {
    setSelectedAgent(ag)
    setAgentForm({
      user: ag.user,
      full_name: ag.full_name,
      registration_number: ag.registration_number || '',
      cpf: ag.cpf || '',
      rg: ag.rg || '',
      blood_type: ag.blood_type || 'O+',
      emergency_contact: ag.emergency_contact || '',
      emergency_phone: ag.emergency_phone || '',
      employment_type: ag.employment_type || 'concursado',
      operational_role: ag.operational_role || '',
      status: ag.status || 'ativo',
      tshirt_size: ag.tshirt_size || '',
      shirt_size: ag.shirt_size || '',
      pants_size: ag.pants_size || '',
      jacket_size: ag.jacket_size || '',
      boot_size: ag.boot_size || '',
      additional_measurements: ag.additional_measurements || '',
      notes: ag.notes || '',
    })
    setIsAgentModalOpen(true)
  }

  const handleSaveAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!agentForm.full_name?.trim() || !agentForm.user) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Vincule a um usuário do sistema e informe o nome completo.',
      })
      return
    }

    try {
      if (selectedAgent) {
        await agentProfilesService.update(selectedAgent.id, agentForm)
        toast({ title: 'Ficha funcional do agente atualizada com sucesso!' })
      } else {
        await agentProfilesService.create({
          ...agentForm,
          municipality: user?.municipality || '',
        })
        toast({ title: 'Ficha funcional e cadastro de medidas criado!' })
      }
      setIsAgentModalOpen(false)
      loadAllData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar agente',
        description: err.message || 'Verifique se este usuário já possui ficha cadastrada.',
      })
    }
  }

  const handleSaveEpiItem = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!epiForm.name?.trim()) {
      toast({ variant: 'destructive', title: 'Nome do EPI/Item é obrigatório' })
      return
    }

    try {
      await epiItemsService.create({
        ...epiForm,
        municipality: user?.municipality || '',
        stock_quantity: Number(epiForm.stock_quantity) || 0,
        min_stock_alert: Number(epiForm.min_stock_alert) || 0,
      })
      toast({ title: 'Item de EPI/Uniforme cadastrado no estoque!' })
      setIsEpiModalOpen(false)
      loadAllData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar EPI',
        description: err.message,
      })
    }
  }

  const handleOpenDelivery = (preselectedAgentId?: string) => {
    setDeliveryForm({
      agent: preselectedAgentId || '',
      item: epiItems[0]?.id || '',
      action_type: 'entrega_inicial',
      quantity: 1,
      delivery_date: new Date().toISOString().split('T')[0],
      item_size: '',
      item_specification: '',
      reason: 'Entrega regulamentar com termo de cautela',
      receipt_signed: true,
      receipt_document_number: `TERMO-EPI-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      delivered_by: user?.id,
      delivered_by_name: user?.name || 'Coordenação',
      notes: '',
    })
    setIsDeliveryModalOpen(true)
  }

  const handleSaveDelivery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deliveryForm.agent || !deliveryForm.item) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Selecione o agente destinatário e o item a ser entregue.',
      })
      return
    }

    try {
      const selectedItem = epiItems.find((i) => i.id === deliveryForm.item)
      const qty = Number(deliveryForm.quantity) || 1

      await epiDeliveriesService.create({
        ...deliveryForm,
        municipality: user?.municipality || '',
        quantity: qty,
        item_specification: deliveryForm.item_specification || selectedItem?.specification || '',
        item_size: deliveryForm.item_size || selectedItem?.size || '',
        delivered_by: user?.id,
        delivered_by_name: user?.name || 'Coordenação',
        receipt_signature_date: deliveryForm.receipt_signed
          ? new Date().toISOString().split('T')[0]
          : undefined,
      })

      // Se for entrega/empréstimo, abater do estoque se houver quantidade disponível
      if (
        selectedItem &&
        (deliveryForm.action_type === 'entrega_inicial' ||
          deliveryForm.action_type === 'substituicao_desgaste' ||
          deliveryForm.action_type === 'substituicao_dano')
      ) {
        const newStock = Math.max(0, (selectedItem.stock_quantity || 0) - qty)
        await epiItemsService.update(selectedItem.id, { stock_quantity: newStock })
      } else if (selectedItem && deliveryForm.action_type === 'devolucao_baixa') {
        const newStock = (selectedItem.stock_quantity || 0) + qty
        await epiItemsService.update(selectedItem.id, { stock_quantity: newStock })
      }

      toast({ title: 'Registro de entrega/movimentação gravado com sucesso!' })
      setIsDeliveryModalOpen(false)
      loadAllData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar entrega',
        description: err.message,
      })
    }
  }

  const handleViewReceipt = (deliv: EpiDelivery) => {
    setSelectedDelivery(deliv)
    setIsReceiptModalOpen(true)
  }

  const handlePrintReceipt = () => {
    window.print()
  }

  // Filtragens
  const filteredAgents = agents.filter(
    (ag) =>
      ag.full_name.toLowerCase().includes(searchAgent.toLowerCase()) ||
      (ag.registration_number &&
        ag.registration_number.toLowerCase().includes(searchAgent.toLowerCase())) ||
      (ag.operational_role &&
        ag.operational_role.toLowerCase().includes(searchAgent.toLowerCase())),
  )

  const filteredEpiItems = epiItems.filter(
    (i) =>
      i.name.toLowerCase().includes(searchEpi.toLowerCase()) ||
      (i.ca_number && i.ca_number.includes(searchEpi)) ||
      (i.specification && i.specification.toLowerCase().includes(searchEpi.toLowerCase())),
  )

  const filteredDeliveries = deliveries.filter((d) => {
    if (filterDeliveryAgent === 'all') return true
    return d.agent === filterDeliveryAgent
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            Cadastro de Agentes, Uniformes e Controle de EPI
          </h2>
          <p className="text-xs text-slate-500">
            Ficha funcional individual, medidas antropométricas, catálogo de proteção individual,
            histórico de cautelas e termos de entrega.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <Button
                onClick={handleOpenNewAgent}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Nova Ficha de Agente
              </Button>
              <Button
                onClick={() => setIsEpiModalOpen(true)}
                variant="outline"
                className="text-slate-700 text-xs h-9"
              >
                <HardHat className="w-4 h-4 mr-1.5 text-amber-600" />
                Cadastrar Item de EPI
              </Button>
              <Button
                onClick={() => handleOpenDelivery()}
                variant="outline"
                className="text-slate-700 text-xs h-9 bg-slate-50"
              >
                <PackageCheck className="w-4 h-4 mr-1.5 text-emerald-600" />
                Registrar Entrega / Cautela
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs Principais */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger value="agents" className="text-xs font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            Fichas Funcionais & Medidas ({agents.length})
          </TabsTrigger>
          <TabsTrigger value="catalog" className="text-xs font-semibold flex items-center gap-2">
            <Shirt className="w-4 h-4 text-amber-600" />
            Estoque & Catálogo de EPIs ({epiItems.length})
          </TabsTrigger>
          <TabsTrigger value="deliveries" className="text-xs font-semibold flex items-center gap-2">
            <PackageCheck className="w-4 h-4 text-emerald-600" />
            Histórico de Entregas & Comprovantes ({deliveries.length})
          </TabsTrigger>
        </TabsList>

        {/* ==================== TAB 1: AGENTES & MEDIDAS ==================== */}
        <TabsContent value="agents" className="space-y-4">
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Buscar por nome, matrícula ou função..."
                    value={searchAgent}
                    onChange={(e) => setSearchAgent(e.target.value)}
                    className="pl-9 h-9 text-xs rounded-lg"
                  />
                </div>
                <div className="text-xs text-slate-500">
                  {filteredAgents.length} agente(s) com ficha funcional registrada
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredAgents.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Users className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    Nenhuma ficha funcional cadastrada
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Conforme especificação oficial, os dados partem vazios para preenchimento
                    administrativo. Clique em "Nova Ficha de Agente" para vincular um usuário e
                    registrar tamanhos e dados operacionais.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow>
                        <TableHead className="text-xs font-bold text-slate-700">
                          Matrícula / Agente
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700">
                          Atribuição / Vínculo
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700">Status</TableHead>
                        <TableHead className="text-xs font-bold text-slate-700">
                          Medidas de Uniforme
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700">Calçado</TableHead>
                        <TableHead className="text-xs font-bold text-slate-700 text-right">
                          Ações
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100">
                      {filteredAgents.map((ag) => (
                        <TableRow key={ag.id} className="hover:bg-slate-50/80">
                          <TableCell className="py-3">
                            <div className="font-semibold text-slate-900 text-xs">
                              {ag.full_name}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500">
                              Mat: {ag.registration_number || 'Sem matrícula'} • Sangue:{' '}
                              {ag.blood_type || '—'}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-700">
                            <div>{ag.operational_role || 'Agente'}</div>
                            <span className="text-[10px] text-slate-500 capitalize">
                              {ag.employment_type || 'Concursado'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={`text-[10px] uppercase font-bold ${
                                ag.status === 'ativo'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {ag.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="flex flex-wrap gap-1">
                              <span
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]"
                                title="Camiseta / Camisa"
                              >
                                Camisa: {ag.shirt_size || ag.tshirt_size || '—'}
                              </span>
                              <span
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]"
                                title="Calça Tática"
                              >
                                Calça: {ag.pants_size || '—'}
                              </span>
                              <span
                                className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]"
                                title="Jaqueta / Capa"
                              >
                                Jaq: {ag.jacket_size || '—'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-800">
                            {ag.boot_size ? `Nº ${ag.boot_size}` : '—'}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDelivery(ag.user)}
                              className="text-blue-600 hover:text-blue-800 text-xs h-8"
                              title="Emitir entrega de EPI para este agente"
                            >
                              <PackageCheck className="w-3.5 h-3.5 mr-1" />
                              Cautela
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEditAgent(ag)}
                              className="text-slate-600 hover:text-slate-900 text-xs h-8"
                              title="Editar Ficha"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB 2: CATÁLOGO & ESTOQUE DE EPI ==================== */}
        <TabsContent value="catalog" className="space-y-4">
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Buscar EPI por nome, CA ou norma..."
                    value={searchEpi}
                    onChange={(e) => setSearchEpi(e.target.value)}
                    className="pl-9 h-9 text-xs rounded-lg"
                  />
                </div>
                <div className="text-xs text-slate-500">
                  {filteredEpiItems.length} item(ns) catalogados no almoxarifado
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredEpiItems.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-3">
                    <HardHat className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    Almoxarifado de EPIs e Uniformes vazio
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Cadastre capacetes, botas táticas, capas de chuva, coletes e vestimentas
                    oficiais com o número do Certificado de Aprovação (CA) para controle de saldo e
                    histórico.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow>
                        <TableHead className="text-xs font-bold text-slate-700">
                          Equipamento / Uniforme
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700">
                          Categoria
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700">
                          Certificado (CA)
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700">
                          Estoque Atual
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700">
                          Exigência por Função
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700 text-right">
                          Ação
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100">
                      {filteredEpiItems.map((item) => (
                        <TableRow key={item.id} className="hover:bg-slate-50/80">
                          <TableCell className="py-3">
                            <div className="font-semibold text-slate-900 text-xs">{item.name}</div>
                            <div className="text-[11px] text-slate-500 truncate max-w-xs">
                              {item.specification || 'Sem especificação'} • Tam:{' '}
                              {item.size || 'Único'}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-700">
                            {EPI_CATEGORY_LABELS[item.category] || item.category}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-700">
                            {item.ca_number ? `CA ${item.ca_number}` : 'N/A ou Isento'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 font-semibold text-xs">
                              <span
                                className={`px-2 py-0.5 rounded-full font-mono text-xs ${
                                  item.stock_quantity <= (item.min_stock_alert || 0)
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {item.stock_quantity} {item.unit || 'un'}
                              </span>
                              {item.stock_quantity <= (item.min_stock_alert || 0) && (
                                <span className="text-[10px] text-red-600 font-bold">
                                  Estoque Baixo
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 truncate max-w-xs">
                            {item.required_for_roles || 'Operacional em Geral'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDeliveryForm((prev) => ({ ...prev, item: item.id }))
                                setIsDeliveryModalOpen(true)
                              }}
                              className="text-emerald-700 text-xs h-8"
                            >
                              <PackageCheck className="w-3.5 h-3.5 mr-1" />
                              Entregar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ==================== TAB 3: ENTREGAS & COMPROVANTES ==================== */}
        <TabsContent value="deliveries" className="space-y-4">
          <Card className="border-slate-200 bg-white shadow-xs">
            <CardHeader className="p-4 pb-2">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="w-full sm:w-80">
                  <Select value={filterDeliveryAgent} onValueChange={setFilterDeliveryAgent}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Filtrar por agente destinatário" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Agentes</SelectItem>
                      {systemUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="text-xs text-slate-500">
                  {filteredDeliveries.length} termo(s) e movimentações registradas
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {filteredDeliveries.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                    <FileCheck2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    Nenhum comprovante de entrega emitido
                  </h4>
                  <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                    Cada entrega de bota, uniforme, capa ou equipamento gera um termo numerado com
                    comprovante de ciência e cautela.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-50/80">
                      <TableRow>
                        <TableHead className="text-xs font-bold text-slate-700">
                          Nº Termo / Data
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700">
                          Agente Receptor
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700">
                          Item Entregue / Categoria
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700">
                          Tipo de Ação
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700">
                          Qtd / Tam
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700">
                          Assinado?
                        </TableHead>
                        <TableHead className="text-xs font-bold text-slate-700 text-right">
                          Comprovante
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-slate-100">
                      {filteredDeliveries.map((deliv) => {
                        const agUser = systemUsers.find((u) => u.id === deliv.agent)
                        const itemObj = epiItems.find((i) => i.id === deliv.item)

                        return (
                          <TableRow key={deliv.id} className="hover:bg-slate-50/80">
                            <TableCell className="py-3">
                              <div className="font-mono font-bold text-blue-700 text-xs">
                                {deliv.receipt_document_number || 'Sem código'}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {deliv.delivery_date
                                  ? new Date(deliv.delivery_date).toLocaleDateString('pt-BR')
                                  : '—'}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-slate-900">
                              {agUser?.name || 'Agente'}
                            </TableCell>
                            <TableCell className="text-xs text-slate-800">
                              <div>{itemObj?.name || 'Item de EPI'}</div>
                              <span className="text-[10px] text-slate-500">
                                {deliv.item_specification || itemObj?.specification || ''}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge variant="outline" className="text-[10px] bg-slate-50">
                                {ACTION_TYPE_LABELS[deliv.action_type] || deliv.action_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {deliv.quantity} un{' '}
                              {deliv.item_size ? `(Tam: ${deliv.item_size})` : ''}
                            </TableCell>
                            <TableCell>
                              {deliv.receipt_signed ? (
                                <span className="inline-flex items-center text-[11px] text-emerald-700 font-bold gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Assinado
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[11px] text-amber-700 font-bold gap-1">
                                  <Clock className="w-3.5 h-3.5" /> Pendente
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewReceipt(deliv)}
                                className="text-xs h-8 text-blue-700 border-blue-200 hover:bg-blue-50"
                              >
                                <Printer className="w-3.5 h-3.5 mr-1" />
                                Termo A4
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ==================== MODAL: CADASTRO / EDIÇÃO DE AGENTE ==================== */}
      <Dialog open={isAgentModalOpen} onOpenChange={setIsAgentModalOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              {selectedAgent
                ? 'Editar Ficha Funcional do Agente'
                : 'Cadastrar Ficha e Medidas do Agente'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Preencha os dados institucionais e os tamanhos individuais para fornecimento
              regulamentar de uniforme e botas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveAgent} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Usuário de Sistema *</Label>
                <Select
                  value={agentForm.user}
                  onValueChange={(val) => {
                    const u = systemUsers.find((x) => x.id === val)
                    setAgentForm((prev) => ({
                      ...prev,
                      user: val,
                      full_name: prev.full_name || u?.name || '',
                    }))
                  }}
                  disabled={!!selectedAgent}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione o operador" />
                  </SelectTrigger>
                  <SelectContent>
                    {systemUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Nome Completo *</Label>
                <Input
                  value={agentForm.full_name}
                  onChange={(e) => setAgentForm((prev) => ({ ...prev, full_name: e.target.value }))}
                  className="h-9 text-xs"
                  placeholder="Nome do agente"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Matrícula Funcional</Label>
                <Input
                  value={agentForm.registration_number || ''}
                  onChange={(e) =>
                    setAgentForm((prev) => ({ ...prev, registration_number: e.target.value }))
                  }
                  className="h-9 text-xs"
                  placeholder="Ex: DC-2026-042"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Atribuição / Cargo</Label>
                <Input
                  value={agentForm.operational_role || ''}
                  onChange={(e) =>
                    setAgentForm((prev) => ({ ...prev, operational_role: e.target.value }))
                  }
                  className="h-9 text-xs"
                  placeholder="Ex: Agente de Campo, Piloto de Bote, Vistoriador"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tipo de Vínculo</Label>
                <Select
                  value={agentForm.employment_type}
                  onValueChange={(val) =>
                    setAgentForm((prev) => ({ ...prev, employment_type: val as EmploymentType }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="concursado">Efetivo / Concursado</SelectItem>
                    <SelectItem value="comissionado">Comissionado</SelectItem>
                    <SelectItem value="temporario">Temporário</SelectItem>
                    <SelectItem value="voluntario">Voluntário</SelectItem>
                    <SelectItem value="outro">Outro Vínculo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Status Operacional</Label>
                <Select
                  value={agentForm.status}
                  onValueChange={(val) =>
                    setAgentForm((prev) => ({ ...prev, status: val as AgentStatus }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="afastado">Afastado / Licença</SelectItem>
                    <SelectItem value="ferias">Férias</SelectItem>
                    <SelectItem value="desligado">Desligado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Tipo Sanguíneo / Fator RH</Label>
                <Input
                  value={agentForm.blood_type || ''}
                  onChange={(e) =>
                    setAgentForm((prev) => ({ ...prev, blood_type: e.target.value }))
                  }
                  className="h-9 text-xs"
                  placeholder="Ex: O+, A-, B+"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Contato de Emergência</Label>
                <Input
                  value={agentForm.emergency_contact || ''}
                  onChange={(e) =>
                    setAgentForm((prev) => ({ ...prev, emergency_contact: e.target.value }))
                  }
                  className="h-9 text-xs"
                  placeholder="Nome do parente / Telefone"
                />
              </div>
            </div>

            {/* Seção Específica: Medidas de Uniforme e Calçado */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <h5 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Shirt className="w-4 h-4 text-blue-600" />
                Medidas e Tamanhos de Uniforme / EPI
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                <div>
                  <Label className="text-[11px] text-slate-600">Camiseta</Label>
                  <Input
                    value={agentForm.tshirt_size || ''}
                    onChange={(e) =>
                      setAgentForm((prev) => ({ ...prev, tshirt_size: e.target.value }))
                    }
                    className="h-8 text-xs font-mono"
                    placeholder="P, M, G..."
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-600">Gandola / Camisa</Label>
                  <Input
                    value={agentForm.shirt_size || ''}
                    onChange={(e) =>
                      setAgentForm((prev) => ({ ...prev, shirt_size: e.target.value }))
                    }
                    className="h-8 text-xs font-mono"
                    placeholder="P, M, G..."
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-600">Calça Tática</Label>
                  <Input
                    value={agentForm.pants_size || ''}
                    onChange={(e) =>
                      setAgentForm((prev) => ({ ...prev, pants_size: e.target.value }))
                    }
                    className="h-8 text-xs font-mono"
                    placeholder="38, 40, 42..."
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-600">Jaqueta / Colete</Label>
                  <Input
                    value={agentForm.jacket_size || ''}
                    onChange={(e) =>
                      setAgentForm((prev) => ({ ...prev, jacket_size: e.target.value }))
                    }
                    className="h-8 text-xs font-mono"
                    placeholder="P, M, G..."
                  />
                </div>
                <div>
                  <Label className="text-[11px] text-slate-600">Botas (Calçado)</Label>
                  <Input
                    value={agentForm.boot_size || ''}
                    onChange={(e) =>
                      setAgentForm((prev) => ({ ...prev, boot_size: e.target.value }))
                    }
                    className="h-8 text-xs font-mono"
                    placeholder="39, 40, 41..."
                  />
                </div>
              </div>

              <div>
                <Label className="text-[11px] text-slate-600">
                  Medidas complementares / Observações
                </Label>
                <Input
                  value={agentForm.additional_measurements || ''}
                  onChange={(e) =>
                    setAgentForm((prev) => ({ ...prev, additional_measurements: e.target.value }))
                  }
                  className="h-8 text-xs"
                  placeholder="Ex: Luva tamanho 9, Capacete 58cm, restrições alérgicas a materiais"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAgentModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
                Salvar Ficha Funcional
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================== MODAL: CADASTRO DE ITEM DE EPI ==================== */}
      <Dialog open={isEpiModalOpen} onOpenChange={setIsEpiModalOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <HardHat className="w-5 h-5 text-amber-600" />
              Cadastrar Item de EPI / Uniforme no Almoxarifado
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cadastre o item com Certificado de Aprovação (CA) e estoque inicial regulamentar.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEpiItem} className="space-y-3 py-2">
            <div>
              <Label className="text-xs font-semibold">Nome do Equipamento / Uniforme *</Label>
              <Input
                value={epiForm.name}
                onChange={(e) => setEpiForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Ex: Bota de Combate Impermeável com Biqueira"
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Categoria de Proteção</Label>
                <Select
                  value={epiForm.category}
                  onValueChange={(val) =>
                    setEpiForm((prev) => ({ ...prev, category: val as EpiCategory }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EPI_CATEGORY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Nº do CA (Ministério Trabalho)</Label>
                <Input
                  value={epiForm.ca_number || ''}
                  onChange={(e) => setEpiForm((prev) => ({ ...prev, ca_number: e.target.value }))}
                  placeholder="Ex: 41.238"
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Estoque Inicial</Label>
                <Input
                  type="number"
                  min="0"
                  value={epiForm.stock_quantity || 0}
                  onChange={(e) =>
                    setEpiForm((prev) => ({ ...prev, stock_quantity: Number(e.target.value) }))
                  }
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Alerta Mínimo</Label>
                <Input
                  type="number"
                  min="0"
                  value={epiForm.min_stock_alert || 2}
                  onChange={(e) =>
                    setEpiForm((prev) => ({ ...prev, min_stock_alert: Number(e.target.value) }))
                  }
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold">Unidade</Label>
                <Input
                  value={epiForm.unit || 'un'}
                  onChange={(e) => setEpiForm((prev) => ({ ...prev, unit: e.target.value }))}
                  className="h-9 text-xs"
                  placeholder="un, par, kit"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Especificação Técnica / Norma</Label>
              <Textarea
                value={epiForm.specification || ''}
                onChange={(e) => setEpiForm((prev) => ({ ...prev, specification: e.target.value }))}
                className="text-xs min-h-[60px]"
                placeholder="Ex: Norma NBR ISO 20345, solado antiderrapante, couro hidrofugado..."
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Exigido para quais funções?</Label>
              <Input
                value={epiForm.required_for_roles || ''}
                onChange={(e) =>
                  setEpiForm((prev) => ({ ...prev, required_for_roles: e.target.value }))
                }
                className="h-9 text-xs"
                placeholder="Ex: Todos os Agentes de Campo, Equipe de Salvamento"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEpiModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white">
                Cadastrar Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================== MODAL: REGISTRO DE ENTREGA / CAUTELA ==================== */}
      <Dialog open={isDeliveryModalOpen} onOpenChange={setIsDeliveryModalOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-emerald-600" />
              Termo de Cautela e Entrega de EPI / Uniforme
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registra a entrega, substituição ou devolução de equipamento com número de protocolo
              rastreável.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveDelivery} className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Agente Destinatário *</Label>
                <Select
                  value={deliveryForm.agent}
                  onValueChange={(val) => setDeliveryForm((prev) => ({ ...prev, agent: val }))}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione o agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {systemUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name || u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Item a Entregar *</Label>
                <Select
                  value={deliveryForm.item}
                  onValueChange={(val) => {
                    const it = epiItems.find((x) => x.id === val)
                    setDeliveryForm((prev) => ({
                      ...prev,
                      item: val,
                      item_size: it?.size || prev.item_size,
                      item_specification: it?.specification || prev.item_specification,
                    }))
                  }}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione o item" />
                  </SelectTrigger>
                  <SelectContent>
                    {epiItems.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} (Disp: {i.stock_quantity} {i.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">Tipo de Ação</Label>
                <Select
                  value={deliveryForm.action_type}
                  onValueChange={(val) =>
                    setDeliveryForm((prev) => ({ ...prev, action_type: val as EpiDeliveryAction }))
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTION_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  value={deliveryForm.quantity || 1}
                  onChange={(e) =>
                    setDeliveryForm((prev) => ({ ...prev, quantity: Number(e.target.value) }))
                  }
                  className="h-9 text-xs font-mono"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Data da Entrega</Label>
                <Input
                  type="date"
                  value={deliveryForm.delivery_date}
                  onChange={(e) =>
                    setDeliveryForm((prev) => ({ ...prev, delivery_date: e.target.value }))
                  }
                  className="h-9 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold">Tamanho Entregue</Label>
                <Input
                  value={deliveryForm.item_size || ''}
                  onChange={(e) =>
                    setDeliveryForm((prev) => ({ ...prev, item_size: e.target.value }))
                  }
                  className="h-9 text-xs"
                  placeholder="Ex: 41, G, Único"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Nº do Termo de Cautela</Label>
                <Input
                  value={deliveryForm.receipt_document_number || ''}
                  onChange={(e) =>
                    setDeliveryForm((prev) => ({
                      ...prev,
                      receipt_document_number: e.target.value,
                    }))
                  }
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Justificativa / Motivo</Label>
              <Input
                value={deliveryForm.reason || ''}
                onChange={(e) => setDeliveryForm((prev) => ({ ...prev, reason: e.target.value }))}
                className="h-9 text-xs"
                placeholder="Ex: Substituição regulamentar anual por desgaste de sola"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDeliveryModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Confirmar Entrega e Gerar Cautela
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ==================== MODAL: TERMO DE CAUTELA IMPRESSO (A4) ==================== */}
      <Dialog open={isReceiptModalOpen} onOpenChange={setIsReceiptModalOpen}>
        <DialogContent className="max-w-3xl bg-white max-h-[95vh] overflow-y-auto">
          <DialogHeader className="print:hidden">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-blue-600" />
                Comprovante de Entrega e Cautela Individual (A4)
              </DialogTitle>
              <Button
                onClick={handlePrintReceipt}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                <Printer className="w-4 h-4 mr-1.5" />
                Imprimir Documento
              </Button>
            </div>
          </DialogHeader>

          {selectedDelivery && (
            <div className="p-8 border border-slate-300 rounded-lg bg-white text-slate-900 font-sans space-y-6 print:border-none print:p-0">
              {/* Cabeçalho Institucional */}
              <div className="text-center border-b pb-4 space-y-1">
                <h3 className="font-bold text-sm tracking-wide uppercase text-slate-900">
                  {currentMun?.doc_header || 'PREFEITURA MUNICIPAL — COORDENADORIA DE DEFESA CIVIL'}
                </h3>
                <h4 className="font-semibold text-xs text-slate-700">
                  {currentMun?.city || 'Ibiúna'} — Estado de {currentMun?.state || 'SP'}
                </h4>
                <p className="text-[11px] font-mono text-slate-500 pt-1">
                  TERMO DE CAUTELA E RECEBIMENTO DE EQUIPAMENTO DE PROTEÇÃO INDIVIDUAL (EPI)
                </p>
                <p className="font-mono text-xs font-bold text-blue-800">
                  {selectedDelivery.receipt_document_number || `TERMO-EPI-${selectedDelivery.id}`}
                </p>
              </div>

              {/* Dados do Agente e da Cautela */}
              <div className="grid grid-cols-2 gap-4 text-xs border p-3 rounded bg-slate-50/60">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    Agente Destinatário:
                  </span>
                  <span className="font-bold text-slate-900">
                    {systemUsers.find((u) => u.id === selectedDelivery.agent)?.name ||
                      'Agente de Defesa Civil'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    Data da Cautela:
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {selectedDelivery.delivery_date
                      ? new Date(selectedDelivery.delivery_date).toLocaleDateString('pt-BR')
                      : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    Tipo de Operação:
                  </span>
                  <span className="font-semibold text-slate-800">
                    {ACTION_TYPE_LABELS[selectedDelivery.action_type] ||
                      selectedDelivery.action_type}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold">
                    Responsável pela Entrega:
                  </span>
                  <span className="font-semibold text-slate-800">
                    {selectedDelivery.delivered_by_name || 'Coordenação Municipal'}
                  </span>
                </div>
              </div>

              {/* Tabela de Itens Entregues */}
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
                  Especificação do Equipamento Fornecido
                </h5>
                <Table className="border text-xs">
                  <TableHeader className="bg-slate-100">
                    <TableRow>
                      <TableHead className="font-bold">Item / Equipamento</TableHead>
                      <TableHead className="font-bold">Certificado (CA)</TableHead>
                      <TableHead className="font-bold">Tamanho</TableHead>
                      <TableHead className="font-bold text-right">Quantidade</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-semibold">
                        {epiItems.find((i) => i.id === selectedDelivery.item)?.name ||
                          'Item de Proteção'}
                        <p className="text-[10px] text-slate-500 font-normal">
                          {selectedDelivery.item_specification ||
                            epiItems.find((i) => i.id === selectedDelivery.item)?.specification ||
                            'Norma regulamentar aplicável'}
                        </p>
                      </TableCell>
                      <TableCell className="font-mono">
                        {epiItems.find((i) => i.id === selectedDelivery.item)?.ca_number ||
                          'Conforme Norma'}
                      </TableCell>
                      <TableCell className="font-mono">
                        {selectedDelivery.item_size || 'Único'}
                      </TableCell>
                      <TableCell className="text-right font-bold font-mono">
                        {selectedDelivery.quantity} un
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Termo de Responsabilidade Legal (Norma Regulamentadora NR-06) */}
              <div className="text-[11px] text-slate-600 border p-3 rounded bg-slate-50 space-y-1.5 leading-relaxed">
                <p className="font-bold text-slate-800 uppercase text-[10px]">
                  Declaração de Recebimento e Cautela (NR-06 / Portaria MTb 3.214):
                </p>
                <p>
                  Declaro ter recebido os equipamentos de proteção e uniforme acima relacionados em
                  perfeito estado de conservação e funcionamento, comprometendo-me a:
                </p>
                <ol className="list-decimal pl-4 space-y-0.5 text-[10px]">
                  <li>
                    Usá-los exclusivamente no desempenho de minhas atribuições oficiais de Defesa
                    Civil;
                  </li>
                  <li>
                    Responsabilizar-me pela guarda, higienização e conservação adequada dos mesmos;
                  </li>
                  <li>
                    Comunicar imediatamente à Coordenadoria qualquer alteração, desgaste excessivo
                    ou dano que o torne impróprio para uso;
                  </li>
                  <li>
                    Devolver o equipamento ao órgão quando for solicitada a sua substituição ou na
                    hipótese de rescisão/desligamento funcional.
                  </li>
                </ol>
              </div>

              {/* Assinaturas */}
              <div className="pt-8 grid grid-cols-2 gap-8 text-center text-xs">
                <div>
                  <div className="border-t border-slate-400 pt-2 font-bold text-slate-800">
                    {systemUsers.find((u) => u.id === selectedDelivery.agent)?.name ||
                      'Assinatura do Agente'}
                  </div>
                  <p className="text-[10px] text-slate-500">Agente Receptor / Matrícula</p>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-2 font-bold text-slate-800">
                    {selectedDelivery.delivered_by_name || 'Coordenador da Defesa Civil'}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Responsável pelo Almoxarifado / Entrega
                  </p>
                </div>
              </div>

              {/* Rodapé */}
              <div className="text-center border-t pt-4 text-[10px] text-slate-400">
                {currentMun?.doc_footer || 'Defesa Civil Municipal — Atendimento de Emergência 199'}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default AgentProfilesPage
