import React, { useState, useEffect, useMemo } from 'react'
import {
  FileText,
  Plus,
  Search,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Shield,
  Layers,
  HeartPulse,
  Building2,
  Users,
  Copy,
  Download,
  ExternalLink,
  ChevronRight,
  Eye,
  Edit,
  Save,
  X,
  History,
  FileCheck,
  Globe,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  contingencyPlansService,
  officialReferencesService,
  auditLogService,
} from '@/services/defesa-civil'
import type {
  ContingencyPlan,
  ContingencyPlanType,
  ContingencyPlanStatus,
  OfficialReferenceLibraryItem,
} from '@/types/defesa-civil'
import { RecordAttachmentsTab } from '@/components/defesa-civil/RecordAttachmentsTab'

export const ContingencyPlansPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [plans, setPlans] = useState<ContingencyPlan[]>([])
  const [references, setReferences] = useState<OfficialReferenceLibraryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Visualização e Edição de Plano
  const [selectedPlan, setSelectedPlan] = useState<ContingencyPlan | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)

  // Campos do Formulário / Editor
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState<ContingencyPlanType>('plano_municipal_defesa_civil')
  const [formVersion, setFormVersion] = useState('1.0')
  const [formStatus, setFormStatus] = useState<ContingencyPlanStatus>('rascunho')

  const [formScope, setFormScope] = useState('')
  const [formScenarios, setFormScenarios] = useState('')
  const [formTriggers, setFormTriggers] = useState('')
  const [formRoles, setFormRoles] = useState('')
  const [formContacts, setFormContacts] = useState('')
  const [formCommunities, setFormCommunities] = useState('')
  const [formRoutes, setFormRoutes] = useState('')
  const [formTransport, setFormTransport] = useState('')
  const [formShelters, setFormShelters] = useState('')
  const [formResponse, setFormResponse] = useState('')
  const [formDrills, setFormDrills] = useState('')
  const [formSorocaba, setFormSorocaba] = useState('')
  const [formSources, setFormSources] = useState('')
  const [approverName, setApproverName] = useState('')
  const [approvalDoc, setApprovalDoc] = useState('')

  // Modal de Referência Oficial (Biblioteca Estadual)
  const [isRefModalOpen, setIsRefModalOpen] = useState(false)
  const [refTitle, setRefTitle] = useState('')
  const [refAgency, setRefAgency] = useState('Defesa Civil do Estado de São Paulo (CEDEC-SP)')
  const [refScope, setRefScope] = useState<any>('estadual')
  const [refCategory, setRefCategory] = useState<any>('plano_estadual')
  const [refSource, setRefSource] = useState(
    'Diário Oficial / Portal de Proteção e Defesa Civil SP',
  )
  const [refScenarios, setRefScenarios] = useState('Inundações, Escorregamentos e Fortes Chuvas')
  const [refLink, setRefLink] = useState('')
  const [refSummary, setRefSummary] = useState('')

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [plns, refs] = await Promise.all([
        contingencyPlansService.list(undefined, '-created'),
        officialReferencesService.list(undefined, 'title'),
      ])
      setPlans(plns)
      setReferences(refs)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar planos',
        description: err.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openNewPlan = () => {
    setSelectedPlan(null)
    setFormTitle('Plano de Contingência — Defesa Civil Ibiúna')
    setFormType('plano_municipal_defesa_civil')
    setFormVersion('1.0-rascunho')
    setFormStatus('rascunho')
    setFormScope(
      'Definir diretrizes estratégicas e operacionais de preparação e socorro no município de Ibiúna.',
    )
    setFormScenarios(
      'Escorregamentos nas encostas (IPT 2024), enxurradas e isolamento de comunidades por pontes e aduelas.',
    )
    setFormTriggers(
      'Acionamento por acumulado de chuva > 80mm/72h ou alerta de risco meteorológico muito alto.',
    )
    setFormRoles(
      'Defesa Civil: coordenação geral; Obras: desobstrução e maquinário; Saúde: remoção de acamados; Educação: acolhimento escolar; Social: atendimento a famílias.',
    )
    setFormContacts('Plantão COMPDEC: 199 / Obras: canal direto / SAMU: 192 / Bombeiros: 193.')
    setFormCommunities(
      'Comunidades abrangidas pelos 290 setores IPT e áreas com travessias críticas (P1 a P215).',
    )
    setFormRoutes(
      'Rotas principais de desvio mapeadas e pontos de encontro com saída segura de áreas de inundação.',
    )
    setFormTransport(
      'Protocolo de veículos acessíveis para evacuação de cadeirantes e pessoas acamadas.',
    )
    setFormShelters(
      'Escolas municipais e ginásios homologados como abrigos aprovados para o cenário.',
    )
    setFormResponse(
      'Ações imediatas de busca, resgate, salvamento e desmobilização progressiva com laudo técnico.',
    )
    setFormDrills(
      'Simulados de evacuação com sirene e exercícios periódicos de preparação comunitária.',
    )
    setFormSorocaba(
      'Compromissos e fluxos da Oficina Multirrisco da Região de Saúde de Sorocaba aplicáveis.',
    )
    setFormSources(
      'Relatório Síntese IPT 2024, Base de Pontes e Aduelas da Defesa Civil Municipal.',
    )
    setApproverName('')
    setApprovalDoc('')
    setIsEditorOpen(true)
  }

  const handleEditPlan = (plan: ContingencyPlan) => {
    setSelectedPlan(plan)
    // Se o plano já estiver aprovado/vigente, a edição DEVE gerar nova versão em rascunho
    if (plan.status === 'aprovado_vigente') {
      const parts = plan.version_number.split('.')
      const nextMajor = parts[0] ? `${Number(parts[0]) + 1}.0-rascunho` : '2.0-rascunho'
      setFormVersion(nextMajor)
      setFormStatus('rascunho')
      toast({
        title: 'Nova Versão Gerada',
        description:
          'Planos aprovados geram automaticamente uma nova versão em rascunho para revisão.',
      })
    } else {
      setFormVersion(plan.version_number)
      setFormStatus(plan.status)
    }

    setFormTitle(plan.title)
    setFormType(plan.plan_type)
    setFormScope(plan.scope_and_objectives || '')
    setFormScenarios(plan.risk_scenarios || '')
    setFormTriggers(plan.monitoring_and_triggers || '')
    setFormRoles(plan.responsibilities_and_roles || '')
    setFormContacts(plan.operational_contacts || '')
    setFormCommunities(plan.affected_communities_and_population || '')
    setFormRoutes(plan.evacuation_routes_and_meeting_points || '')
    setFormTransport(plan.accessible_transport_and_care || '')
    setFormShelters(plan.shelters_and_logistics || '')
    setFormResponse(plan.response_and_recovery_actions || '')
    setFormDrills(plan.drills_and_lessons_learned || '')
    setFormSorocaba(plan.sorocaba_workshop_commitments || '')
    setFormSources(plan.information_sources || '')
    setApproverName(plan.approver_name || '')
    setApprovalDoc(plan.approval_document_ref || '')
    setIsEditorOpen(true)
  }

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formTitle.trim()) {
      toast({ variant: 'destructive', title: 'O título do plano é obrigatório.' })
      return
    }

    // Regra: Não apresentar preenchimento de modelo como aprovado sem ato legal
    if (formStatus === 'aprovado_vigente' && !approvalDoc.trim()) {
      toast({
        variant: 'destructive',
        title: 'Aprovação exige documento oficial',
        description:
          'Informe o número do Decreto, Portaria ou Documento de Homologação para status aprovado.',
      })
      return
    }

    try {
      const payload: Partial<ContingencyPlan> = {
        municipality: user?.municipality || 'cw9b6e2pqv89i3p',
        title: formTitle.trim(),
        plan_type: formType,
        version_number: formVersion.trim(),
        status: formStatus,
        scope_and_objectives: formScope,
        risk_scenarios: formScenarios,
        monitoring_and_triggers: formTriggers,
        responsibilities_and_roles: formRoles,
        operational_contacts: formContacts,
        affected_communities_and_population: formCommunities,
        evacuation_routes_and_meeting_points: formRoutes,
        accessible_transport_and_care: formTransport,
        shelters_and_logistics: formShelters,
        response_and_recovery_actions: formResponse,
        drills_and_lessons_learned: formDrills,
        sorocaba_workshop_commitments: formSorocaba,
        information_sources: formSources,
        approver_name: approverName.trim() || undefined,
        approval_document_ref: approvalDoc.trim() || undefined,
        approval_date:
          formStatus === 'aprovado_vigente' ? new Date().toISOString().slice(0, 10) : undefined,
        parent_plan_id:
          selectedPlan && selectedPlan.status === 'aprovado_vigente' ? selectedPlan.id : undefined,
        created_by: user?.id,
      }

      if (selectedPlan && selectedPlan.status !== 'aprovado_vigente') {
        await contingencyPlansService.update(selectedPlan.id, payload)
        await auditLogService.create({
          action: 'editar_plano_contingencia',
          collection: 'contingency_plans',
          record_id: selectedPlan.id,
          details: `Plano ${formTitle} atualizado versão ${formVersion} por ${user?.name}`,
        })
      } else {
        await contingencyPlansService.create(payload)
        await auditLogService.create({
          action: 'criar_plano_contingencia',
          collection: 'contingency_plans',
          details: `Novo plano/versão ${formTitle} (${formVersion}) criado por ${user?.name}`,
        })
      }

      toast({
        title: 'Plano Salvo com Sucesso',
        description: `Versão ${formVersion} gravada no histórico de planejamento.`,
      })

      setIsEditorOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar plano',
        description: err.message,
      })
    }
  }

  // Cadastrar Referência Oficial na Biblioteca
  const handleSaveReference = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!refTitle.trim() || !refSource.trim()) {
      toast({ variant: 'destructive', title: 'Título e fonte oficial são obrigatórios.' })
      return
    }

    try {
      await officialReferencesService.create({
        municipality: user?.municipality || 'cw9b6e2pqv89i3p',
        title: refTitle.trim(),
        issuing_agency: refAgency.trim(),
        scope: refScope,
        category: refCategory,
        official_source: refSource.trim(),
        document_date: new Date().toISOString().slice(0, 10),
        pertinent_scenarios: refScenarios.trim(),
        external_link: refLink.trim() || undefined,
        availability_status: 'disponivel',
        summary: refSummary.trim() || undefined,
        created_by: user?.id,
      })

      toast({
        title: 'Documento Homologado na Biblioteca',
        description: 'Referência oficial catalogada com fonte autêntica.',
      })

      setIsRefModalOpen(false)
      setRefTitle('')
      setRefLink('')
      setRefSummary('')
      loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao catalogar referência',
        description: err.message,
      })
    }
  }

  const filtered = plans.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch =
      search === '' ||
      p.title.toLowerCase().includes(q) ||
      p.version_number.toLowerCase().includes(q) ||
      (p.approver_name && p.approver_name.toLowerCase().includes(q))

    const matchType = typeFilter === 'all' || p.plan_type === typeFilter
    const matchStatus = statusFilter === 'all' || p.status === statusFilter

    return matchSearch && matchType && matchStatus
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-600 to-blue-700 text-white rounded-xl shadow-md">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Planos de Contingência e Preparação
              </h1>
              <Badge
                variant="outline"
                className="text-xs bg-indigo-50 text-indigo-800 border-indigo-200"
              >
                Gestão Integrada
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Plano Municipal de Defesa Civil, planos comunitários por cenário, planos setoriais das
              secretarias e El Niño Sorocaba.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsRefModalOpen(true)}
            className="text-xs h-9 border-slate-300"
          >
            <Globe className="w-3.5 h-3.5 mr-1.5 text-blue-600" />
            Adicionar Referência Oficial
          </Button>

          <Button
            size="sm"
            onClick={openNewPlan}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-9 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Novo Plano / Cenário
          </Button>
        </div>
      </div>

      {/* Regra de Versionamento e Aprovação Oficial */}
      <div className="p-4 bg-indigo-50/50 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-start gap-3">
        <Shield className="w-5 h-5 text-indigo-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-indigo-900">
            Diretriz de Versionamento e Validade Legal dos Planos:
          </p>
          <p className="text-slate-700 leading-relaxed">
            O preenchimento de um modelo no sistema{' '}
            <strong>NÃO configura plano oficialmente aprovado</strong> sem a publicação de Decreto
            Municipal ou ato formal de homologação. Quando um plano aprovado é editado, o sistema
            gera automaticamente uma <strong>nova versão em rascunho</strong>, preservando
            integralmente o histórico da versão vigente anterior.
          </p>
        </div>
      </div>

      {/* Tabs Principais: Planos Municipais/Setoriais vs. Biblioteca Estadual */}
      <Tabs defaultValue="planos" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-10 max-w-md mb-4">
          <TabsTrigger value="planos" className="text-xs font-semibold">
            Planos de Contingência ({plans.length})
          </TabsTrigger>
          <TabsTrigger value="biblioteca" className="text-xs font-semibold">
            Biblioteca de Referências Oficiais ({references.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="planos" className="space-y-4">
          {/* Filtros */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    placeholder="Buscar por título, versão ou autoridade aprobatória..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 text-xs h-9"
                  />
                </div>

                <div className="w-full md:w-64">
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Tipo de Plano" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Tipos</SelectItem>
                      <SelectItem value="plano_municipal_defesa_civil">
                        Plano Municipal de Defesa Civil
                      </SelectItem>
                      <SelectItem value="plano_comunitario_cenario">
                        Plano por Comunidade / Cenário
                      </SelectItem>
                      <SelectItem value="plano_setorial_saude_el_nino">
                        Plano de Saúde - Fenômeno El Niño
                      </SelectItem>
                      <SelectItem value="plano_setorial_educacao">
                        Plano Setorial - Educação
                      </SelectItem>
                      <SelectItem value="plano_setorial_obras">Plano Setorial - Obras</SelectItem>
                      <SelectItem value="plano_setorial_assistencia">
                        Plano Setorial - Assistência Social
                      </SelectItem>
                      <SelectItem value="plano_setorial_desenvolvimento_urbano">
                        Plano Setorial - Desenvolvimento Urbano
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full md:w-48">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue placeholder="Situação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Situações</SelectItem>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="em_revisao">Em Revisão</SelectItem>
                      <SelectItem value="aguardando_aprovacao">Aguardando Aprovação</SelectItem>
                      <SelectItem value="aprovado_vigente">Aprovado e Vigente</SelectItem>
                      <SelectItem value="substituido_arquivado">Substituído / Arquivado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grid de Planos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                Nenhum plano de contingência localizado com os filtros atuais.
              </div>
            ) : (
              filtered.map((plan) => {
                const isApproved = plan.status === 'aprovado_vigente'
                return (
                  <Card
                    key={plan.id}
                    className={`border transition-all shadow-xs hover:shadow-sm bg-white flex flex-col justify-between ${
                      isApproved ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-slate-200'
                    }`}
                  >
                    <CardHeader className="p-4 pb-2 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] uppercase tracking-wider font-semibold ${
                            isApproved
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : plan.status === 'rascunho'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {plan.status.replace(/_/g, ' ')}
                        </Badge>
                        <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          v{plan.version_number}
                        </span>
                      </div>

                      <CardTitle className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                        {plan.title}
                      </CardTitle>
                      <CardDescription className="text-[11px] text-slate-500 line-clamp-1">
                        Tipo: {plan.plan_type.replace(/_/g, ' ')}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 space-y-2 text-xs text-slate-600">
                      {plan.risk_scenarios && (
                        <p className="line-clamp-2 text-slate-700 text-[11px]">
                          <strong>Cenários:</strong> {plan.risk_scenarios}
                        </p>
                      )}

                      {plan.approver_name && (
                        <p className="text-[10px] text-emerald-800 bg-emerald-50/60 p-1.5 rounded border border-emerald-200/60">
                          <strong>Aprovado por:</strong> {plan.approver_name} (
                          {plan.approval_document_ref || 'Ato Oficial'})
                        </p>
                      )}

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedPlan(plan)
                            setIsViewOpen(true)
                          }}
                          className="text-xs h-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Consultar Detalhes
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditPlan(plan)}
                          className="text-xs h-8 text-slate-700"
                        >
                          <Edit className="w-3.5 h-3.5 mr-1" />
                          Editar / Revisar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>

        {/* Tab Biblioteca Estadual de Referências */}
        <TabsContent value="biblioteca" className="space-y-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-950 flex items-start gap-3">
            <Globe className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-blue-900">
                Biblioteca Oficial de Referências Técnicas e Protocolos:
              </p>
              <p className="text-slate-700 mt-0.5">
                Acervo de diretrizes, planos estaduais e orientações normativas de órgãos oficiais
                (CEDEC-SP, IPT, DAEE, CEMADEN). Não invente links nem arquivos inexistentes. Se o
                documento estiver pendente de obtenção, o sistema sinaliza formalmente a pendência.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {references.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                Nenhum documento estadual cadastrado ainda. Use "Adicionar Referência Oficial".
              </div>
            ) : (
              references.map((ref) => (
                <Card
                  key={ref.id}
                  className="border-slate-200 bg-white flex flex-col justify-between"
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-700">
                        {ref.scope}
                      </Badge>
                      <Badge
                        className={`text-[9px] ${
                          ref.availability_status === 'disponivel'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}
                      >
                        {ref.availability_status === 'disponivel'
                          ? 'Disponível'
                          : 'Pendente Obtenção'}
                      </Badge>
                    </div>
                    <CardTitle className="text-sm font-bold text-slate-900 line-clamp-2">
                      {ref.title}
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-500">
                      Órgão: {ref.issuing_agency}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="p-4 pt-1 space-y-2 text-xs text-slate-600">
                    <p className="text-[11px] line-clamp-2 text-slate-700">
                      <strong>Cenários Pertinentes:</strong>{' '}
                      {ref.pertinent_scenarios || 'Multirrisco'}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Fonte Oficial: {ref.official_source}
                    </p>

                    {ref.external_link && (
                      <div className="pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="w-full text-xs h-8 text-blue-600 hover:text-blue-800"
                        >
                          <a href={ref.external_link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                            Acessar Fonte Oficial
                          </a>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal Editor de Plano */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl bg-white max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {selectedPlan
                ? `Editar / Revisar Plano: ${selectedPlan.title}`
                : 'Novo Plano de Contingência Integrado'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Preenchimento estruturado por seções operacionais. Planos aprovados geram
              automaticamente nova versão em rascunho.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSavePlan} className="space-y-4 text-xs pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <Label className="text-xs font-semibold text-slate-700">Título do Plano *</Label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="mt-1 text-xs"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Versão</Label>
                <Input
                  value={formVersion}
                  onChange={(e) => setFormVersion(e.target.value)}
                  className="mt-1 text-xs font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Tipo de Plano *</Label>
                <Select value={formType} onValueChange={(v: any) => setFormType(v)}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plano_municipal_defesa_civil">
                      Plano Municipal de Defesa Civil (Geral)
                    </SelectItem>
                    <SelectItem value="plano_comunitario_cenario">
                      Plano por Comunidade ou Cenário Específico
                    </SelectItem>
                    <SelectItem value="plano_setorial_saude_el_nino">
                      Plano de Saúde - Fenômeno El Niño (Sorocaba)
                    </SelectItem>
                    <SelectItem value="plano_setorial_educacao">
                      Plano Setorial - Educação e Escolas
                    </SelectItem>
                    <SelectItem value="plano_setorial_obras">
                      Plano Setorial - Obras e Travessias
                    </SelectItem>
                    <SelectItem value="plano_setorial_assistencia">
                      Plano Setorial - Assistência Social
                    </SelectItem>
                    <SelectItem value="plano_setorial_desenvolvimento_urbano">
                      Plano Setorial - Desenvolvimento Urbano
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Situação do Plano *</Label>
                <Select value={formStatus} onValueChange={(v: any) => setFormStatus(v)}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rascunho">Rascunho (Em elaboração)</SelectItem>
                    <SelectItem value="em_revisao">Em Revisão Técnica Intersetorial</SelectItem>
                    <SelectItem value="aguardando_aprovacao">
                      Aguardando Homologação / Decreto
                    </SelectItem>
                    <SelectItem value="aprovado_vigente">Aprovado e Vigente (Oficial)</SelectItem>
                    <SelectItem value="substituido_arquivado">Substituído / Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Seções Estruturadas do Plano */}
            <Tabs defaultValue="escopo" className="w-full pt-2">
              <TabsList className="grid grid-cols-4 sm:grid-cols-6 h-auto text-[11px] gap-1 p-1 bg-slate-100">
                <TabsTrigger value="escopo" className="text-[11px] py-1">
                  Escopo & Riscos
                </TabsTrigger>
                <TabsTrigger value="acionamento" className="text-[11px] py-1">
                  Critérios
                </TabsTrigger>
                <TabsTrigger value="atribuicoes" className="text-[11px] py-1">
                  Secretarias
                </TabsTrigger>
                <TabsTrigger value="rotas" className="text-[11px] py-1">
                  Rotas & Abrigos
                </TabsTrigger>
                <TabsTrigger value="sorocaba" className="text-[11px] py-1">
                  Oficina Sorocaba
                </TabsTrigger>
                <TabsTrigger value="aprovacao" className="text-[11px] py-1">
                  Homologação
                </TabsTrigger>
              </TabsList>

              <TabsContent value="escopo" className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Objetivos e Escopo do Plano
                  </Label>
                  <Textarea
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value)}
                    className="mt-1 text-xs min-h-[70px]"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Cenários de Risco Contemplados
                  </Label>
                  <Textarea
                    value={formScenarios}
                    onChange={(e) => setFormScenarios(e.target.value)}
                    className="mt-1 text-xs min-h-[70px]"
                  />
                </div>
              </TabsContent>

              <TabsContent value="acionamento" className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Critérios de Monitoramento e Gatilhos de Acionamento
                  </Label>
                  <Textarea
                    value={formTriggers}
                    onChange={(e) => setFormTriggers(e.target.value)}
                    className="mt-1 text-xs min-h-[70px]"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Contatos Operacionais e Cadeia de Comunicação
                  </Label>
                  <Textarea
                    value={formContacts}
                    onChange={(e) => setFormContacts(e.target.value)}
                    className="mt-1 text-xs min-h-[70px]"
                  />
                </div>
              </TabsContent>

              <TabsContent value="atribuicoes" className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Coordenação e Atribuições das Secretarias Municipais
                  </Label>
                  <Textarea
                    value={formRoles}
                    onChange={(e) => setFormRoles(e.target.value)}
                    className="mt-1 text-xs min-h-[80px]"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Comunidades e População Abrangida
                  </Label>
                  <Textarea
                    value={formCommunities}
                    onChange={(e) => setFormCommunities(e.target.value)}
                    className="mt-1 text-xs min-h-[60px]"
                  />
                </div>
              </TabsContent>

              <TabsContent value="rotas" className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Rotas de Saída e Pontos de Encontro
                  </Label>
                  <Textarea
                    value={formRoutes}
                    onChange={(e) => setFormRoutes(e.target.value)}
                    className="mt-1 text-xs min-h-[70px]"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Transporte Acessível e Logística de Abrigos
                  </Label>
                  <Textarea
                    value={formTransport}
                    onChange={(e) => setFormTransport(e.target.value)}
                    className="mt-1 text-xs min-h-[70px]"
                  />
                </div>
              </TabsContent>

              <TabsContent value="sorocaba" className="space-y-3 pt-2">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 text-[11px]">
                  Encaminhamentos da Oficina Multirrisco da Região de Saúde de Sorocaba — Fenômeno
                  El Niño.
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Encaminhamentos e Fluxos Regionais
                  </Label>
                  <Textarea
                    value={formSorocaba}
                    onChange={(e) => setFormSorocaba(e.target.value)}
                    className="mt-1 text-xs min-h-[100px]"
                    placeholder="Registre os fluxos regionais de saúde, prioridades pactuadas e encaminhamentos acordados..."
                  />
                </div>
              </TabsContent>

              <TabsContent value="aprovacao" className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Autoridade Aprovadora
                    </Label>
                    <Input
                      placeholder="Ex: Prefeito Municipal / Coordenador da COMPDEC"
                      value={approverName}
                      onChange={(e) => setApproverName(e.target.value)}
                      className="mt-1 text-xs"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">
                      Ato Oficial de Homologação
                    </Label>
                    <Input
                      placeholder="Ex: Decreto Municipal nº 1234/2026"
                      value={approvalDoc}
                      onChange={(e) => setApprovalDoc(e.target.value)}
                      className="mt-1 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Fontes Oficiais das Informações
                  </Label>
                  <Input
                    placeholder="Ex: Síntese IPT 2024, Base de Pontes 2024, Censo 2022"
                    value={formSources}
                    onChange={(e) => setFormSources(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditorOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              >
                Salvar Versão do Plano
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Consulta de Detalhes do Plano */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-3xl bg-white max-h-[90vh] overflow-y-auto">
          {selectedPlan && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-base font-bold text-slate-900">
                      {selectedPlan.title}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                      Versão: {selectedPlan.version_number} | Tipo:{' '}
                      {selectedPlan.plan_type.replace(/_/g, ' ')}
                    </DialogDescription>
                  </div>
                  <Badge className="capitalize">{selectedPlan.status.replace(/_/g, ' ')}</Badge>
                </div>
              </DialogHeader>

              <div className="space-y-3 text-xs py-2">
                {selectedPlan.scope_and_objectives && (
                  <div>
                    <h4 className="font-bold text-slate-800">Escopo e Objetivos</h4>
                    <p className="text-slate-700 mt-1 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
                      {selectedPlan.scope_and_objectives}
                    </p>
                  </div>
                )}

                {selectedPlan.risk_scenarios && (
                  <div>
                    <h4 className="font-bold text-slate-800">Cenários de Risco</h4>
                    <p className="text-slate-700 mt-1 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
                      {selectedPlan.risk_scenarios}
                    </p>
                  </div>
                )}

                {selectedPlan.responsibilities_and_roles && (
                  <div>
                    <h4 className="font-bold text-slate-800">Atribuições das Secretarias</h4>
                    <p className="text-slate-700 mt-1 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-200">
                      {selectedPlan.responsibilities_and_roles}
                    </p>
                  </div>
                )}

                {selectedPlan.sorocaba_workshop_commitments && (
                  <div>
                    <h4 className="font-bold text-emerald-900">
                      Encaminhamentos Oficina de Sorocaba
                    </h4>
                    <p className="text-emerald-800 mt-1 leading-relaxed bg-emerald-50 p-2.5 rounded border border-emerald-200">
                      {selectedPlan.sorocaba_workshop_commitments}
                    </p>
                  </div>
                )}

                <div className="pt-2">
                  <h4 className="font-bold text-slate-800 mb-2">
                    Anexos, Decretos e Mapas do Plano
                  </h4>
                  <RecordAttachmentsTab
                    targetCollection="contingency_plans"
                    targetId={selectedPlan.id}
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsViewOpen(false)}
                  className="text-xs"
                >
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar Referência Oficial */}
      <Dialog open={isRefModalOpen} onOpenChange={setIsRefModalOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Catalogar Referência Oficial
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Biblioteca de planos estaduais, diretrizes e protocolos oficiais com fonte autêntica.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveReference} className="space-y-3.5 text-xs py-1">
            <div>
              <Label className="text-xs font-semibold text-slate-700">Título do Documento *</Label>
              <Input
                placeholder="Ex: Plano Preventivo de Defesa Civil (PPDC) - SP"
                value={refTitle}
                onChange={(e) => setRefTitle(e.target.value)}
                className="mt-1 text-xs"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Órgão Emissor *</Label>
              <Input
                value={refAgency}
                onChange={(e) => setRefAgency(e.target.value)}
                className="mt-1 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Abrangência</Label>
                <Select value={refScope} onValueChange={setRefScope}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="estadual">Estadual (SP)</SelectItem>
                    <SelectItem value="regional_sorocaba">Regional Sorocaba</SelectItem>
                    <SelectItem value="federal">Federal</SelectItem>
                    <SelectItem value="municipal">Municipal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Categoria</Label>
                <Select value={refCategory} onValueChange={setRefCategory}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="plano_estadual">Plano Estadual</SelectItem>
                    <SelectItem value="protocolo_operacional">Protocolo Operacional</SelectItem>
                    <SelectItem value="diretriz_tecnica">Diretriz Técnica</SelectItem>
                    <SelectItem value="legislacao">Legislação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Fonte Oficial Autêntica *
              </Label>
              <Input
                value={refSource}
                onChange={(e) => setRefSource(e.target.value)}
                className="mt-1 text-xs"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Link Oficial (URL)</Label>
              <Input
                placeholder="https://defesacivil.sp.gov.br/..."
                value={refLink}
                onChange={(e) => setRefLink(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsRefModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                Catalogar Documento
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default ContingencyPlansPage
