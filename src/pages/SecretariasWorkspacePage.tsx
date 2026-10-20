import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Building2,
  Users,
  HeartHandshake,
  GraduationCap,
  Hammer,
  ShieldAlert,
  Search,
  Filter,
  FileText,
  Clock,
  Plus,
  Save,
  X,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  Settings,
  ChevronRight,
  ExternalLink,
  Info,
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
  externalDemandsService,
  strategicInfrastructuresService,
  sheltersService,
  surveyedFamiliesService,
  contingencyPlansService,
  urbanConsultationsService,
  auditLogService,
  sectorWorkspaceConfigService,
} from '@/services/defesa-civil'
import type {
  DepartmentKey,
  ExternalDemand,
  StrategicInfrastructure,
  Shelter,
  SurveyedFamily,
  ContingencyPlan,
  UrbanConsultation,
  SectorWorkspaceConfig,
} from '@/types/defesa-civil'
import { RecordAttachmentsTab } from '@/components/defesa-civil/RecordAttachmentsTab'

export interface SecretaryItem {
  key: DepartmentKey
  name: string
  fullName: string
  icon: React.ElementType
  color: string
  badgeClass: string
  description: string
  focusAreas: string[]
}

export const SECRETARIES_CONFIG: SecretaryItem[] = [
  {
    key: 'defesa_civil',
    name: 'Defesa Civil',
    fullName: 'Coordenadoria Municipal de Proteção e Defesa Civil (COMPDEC)',
    icon: ShieldAlert,
    color: 'from-blue-600 to-indigo-700',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    description: 'Gestão integrada de contingência, monitoramento de riscos e articulação geral.',
    focusAreas: [
      'Setores IPT',
      'Trechos de Perigo',
      'Vistorias Técnicas',
      'Planos de Contingência',
    ],
  },
  {
    key: 'desenvolvimento_urbano',
    name: 'Desenvolvimento Urbano',
    fullName: 'Secretaria Municipal de Desenvolvimento Urbano e Habitação',
    icon: Building2,
    color: 'from-amber-600 to-orange-700',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    description:
      'Consultas territoriais para processos de loteamento, parcelamento de solo e regularização.',
    focusAreas: [
      'Consultas Territoriais',
      'Processos Municipais',
      'Cruzamento com IPT',
      'Zoneamento',
    ],
  },
  {
    key: 'assistencia_social',
    name: 'Assistência Social',
    fullName: 'Secretaria Municipal de Promoção e Assistência Social',
    icon: HeartHandshake,
    color: 'from-rose-600 to-pink-700',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    description:
      'Atendimento a famílias em risco, vulnerabilidade social, cadastro CRAS/CREAS e acolhimento.',
    focusAreas: [
      'Famílias Levantadas',
      'Atendimentos Sociais',
      'Necessidades de Acolhimento',
      'Aluguel Social',
    ],
  },
  {
    key: 'saude',
    name: 'Saúde',
    fullName: 'Secretaria Municipal de Saúde e Vigilância em Saúde',
    icon: Users,
    color: 'from-emerald-600 to-teal-700',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    description:
      'Necessidades operacionais de evacuação, acamados, suporte a oxigênio/energia e Plano El Niño Sorocaba.',
    focusAreas: [
      'Apoio de Mobilidade',
      'Oxigênio / Diálise',
      'UBS de Referência',
      'Oficina Sorocaba',
    ],
  },
  {
    key: 'educacao',
    name: 'Educação',
    fullName: 'Secretaria Municipal de Educação e Cultura',
    icon: GraduationCap,
    color: 'from-violet-600 to-purple-700',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-200',
    description:
      'Cadastros de escolas municipais, disponibilidade, acessibilidade e avaliação como locais de acolhimento.',
    focusAreas: [
      'Escolas Municipais',
      'Locais Candidatos a Abrigo',
      'Capacidade Avaliada',
      'Acessos Seguros',
    ],
  },
  {
    key: 'obras',
    name: 'Obras e Infraestrutura',
    fullName: 'Secretaria Municipal de Obras e Serviços Públicos',
    icon: Hammer,
    color: 'from-cyan-600 to-blue-700',
    badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    description: 'Manutenção de pontes, aduelas, drenagem pluvial, vias de escape e desobstruções.',
    focusAreas: [
      'Pontes & Aduelas',
      'Rotas Alternativas',
      'Demandas de Drenagem',
      'Intervenções em Vias',
    ],
  },
]

export const SecretariasWorkspacePage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<DepartmentKey>('defesa_civil')
  const [isLoading, setIsLoading] = useState(true)

  // Dados carregados
  const [demands, setDemands] = useState<ExternalDemand[]>([])
  const [infrastructures, setInfrastructures] = useState<StrategicInfrastructure[]>([])
  const [shelters, setShelters] = useState<Shelter[]>([])
  const [families, setFamilies] = useState<SurveyedFamily[]>([])
  const [plans, setPlans] = useState<ContingencyPlan[]>([])
  const [consultations, setConsultations] = useState<UrbanConsultation[]>([])
  const [sectorConfigs, setSectorConfigs] = useState<SectorWorkspaceConfig[]>([])

  // Modal de Nova Demanda Intersetorial da Secretaria
  const [isNewDemandOpen, setIsNewDemandOpen] = useState(false)
  const [demandTitle, setDemandTitle] = useState('')
  const [demandDesc, setDemandDesc] = useState('')
  const [demandLocation, setDemandLocation] = useState('')
  const [demandTargetDept, setDemandTargetDept] = useState('obras')
  const [demandPriority, setDemandPriority] = useState<'baixa' | 'media' | 'alta' | 'urgente'>(
    'media',
  )

  // Modal de Configurações da Secretaria (Campos complementares)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [leadPerson, setLeadPerson] = useState('')
  const [contactChannel, setContactChannel] = useState('')
  const [customCategoriesText, setCustomCategoriesText] = useState('')

  // Estado de Formulário e Proteção contra Perda de Dados
  // AVISO IMPORTANTE: Não bloqueia navegação se nada foi alterado (previne loop v0.0.31)
  const [isEditingCustomFields, setIsEditingCustomFields] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [dems, infras, shels, fams, plns, cons, cfgs] = await Promise.all([
        externalDemandsService.list(undefined, '-created').catch(() => []),
        strategicInfrastructuresService.list(undefined, 'original_code').catch(() => []),
        sheltersService.list(undefined, 'name').catch(() => []),
        surveyedFamiliesService.list(undefined, 'family_internal_code').catch(() => []),
        contingencyPlansService.list(undefined, '-created').catch(() => []),
        urbanConsultationsService.list(undefined, '-created').catch(() => []),
        sectorWorkspaceConfigService.list().catch(() => []),
      ])

      setDemands(dems || [])
      setInfrastructures(infras || [])
      setShelters(shels || [])
      setFamilies(fams || [])
      setPlans(plns || [])
      setConsultations(cons || [])
      setSectorConfigs(cfgs || [])
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar dados integrados',
        description: err.message || 'Verifique a conexão.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Secretaria atualmente selecionada
  const currentSecConfig = useMemo(() => {
    return SECRETARIES_CONFIG.find((s) => s.key === activeTab) || SECRETARIES_CONFIG[0]
  }, [activeTab])

  // Configuração personalizada salva para essa secretaria
  const currentCustomConfig = useMemo(() => {
    return sectorConfigs.find((c) => c.department_key === activeTab)
  }, [sectorConfigs, activeTab])

  // Verificar permissão do usuário para esta secretaria
  // Administradores e coordenadores podem editar tudo; operadores da própria secretaria também; outros podem consultar
  const canEditCurrentTab = useMemo(() => {
    if (!user) return false
    if (user.role === 'administrador' || user.role === 'coordenador') return true
    if (user.department === activeTab) return true
    // Usuários sem department definido (compatibilidade) pertencem à Defesa Civil operacional
    if (!user.department && activeTab === 'defesa_civil') return true
    return false
  }, [user, activeTab])

  // Abrir modal de config
  const handleOpenConfig = () => {
    if (currentCustomConfig) {
      setLeadPerson(currentCustomConfig.lead_person || '')
      setContactChannel(currentCustomConfig.contact_channel || '')
      setCustomCategoriesText(
        Array.isArray(currentCustomConfig.custom_categories)
          ? currentCustomConfig.custom_categories.join(', ')
          : '',
      )
    } else {
      setLeadPerson('')
      setContactChannel('')
      setCustomCategoriesText('')
    }
    setIsConfigOpen(true)
  }

  const handleSaveConfig = async () => {
    try {
      const cats = customCategoriesText
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)

      await sectorWorkspaceConfigService.saveConfig({
        department_key: activeTab,
        department_title: currentSecConfig.name,
        lead_person: leadPerson.trim(),
        contact_channel: contactChannel.trim(),
        custom_categories: cats,
        municipality: user?.municipality || 'cw9b6e2pqv89i3p',
        is_active: true,
      })

      await auditLogService.create({
        action: 'atualizar_config_secretaria',
        collection: 'sector_workspaces_config',
        details: `Configuração da secretaria ${currentSecConfig.name} atualizada por ${user?.name || user?.email}`,
      })

      toast({
        title: 'Configurações atualizadas',
        description: `Dados complementares de ${currentSecConfig.name} salvos com sucesso.`,
      })
      setIsConfigOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: err.message,
      })
    }
  }

  // Criar demanda rápida a partir da secretaria
  const handleCreateDemand = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!demandTitle.trim() || !demandLocation.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Preencha o título e o local da demanda.',
      })
      return
    }

    try {
      await externalDemandsService.create({
        title: demandTitle.trim(),
        problem_description: demandDesc.trim() || demandTitle.trim(),
        location: demandLocation.trim(),
        target_department: demandTargetDept as any,
        priority: demandPriority,
        status: 'identificada',
        forwarded_at: new Date().toISOString(),
        action_history: `Criada pela área de trabalho de ${currentSecConfig.name} por ${user?.name || user?.email}.`,
        municipality: user?.municipality || 'cw9b6e2pqv89i3p',
      })

      await auditLogService.create({
        action: 'criar_demanda_intersetorial',
        collection: 'external_demands',
        details: `Demanda criada para ${demandTargetDept} a partir de ${currentSecConfig.name}: ${demandTitle}`,
      })

      toast({
        title: 'Demanda Intersetorial Aberta',
        description: 'O setor responsável poderá consultar e dar andamento.',
      })

      setDemandTitle('')
      setDemandDesc('')
      setDemandLocation('')
      setIsNewDemandOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao abrir demanda',
        description: err.message,
      })
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl shadow-md">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Secretarias e Atuação Integrada
              </h1>
              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                Gestão Intersetorial
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Área de trabalho colaborativa de riscos e contingência com isolamento de dados,
              responsabilidade técnica e histórico de edições.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEditCurrentTab && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenConfig}
              className="text-xs h-9 border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <Settings className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
              Configurar Setor
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setIsNewDemandOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nova Demanda Intersetorial
          </Button>
        </div>
      </div>

      {/* Navegação entre Secretarias */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {SECRETARIES_CONFIG.map((sec) => {
          const Icon = sec.icon
          const isSelected = activeTab === sec.key
          return (
            <button
              key={sec.key}
              type="button"
              onClick={() => {
                // Alternância segura sem prender tela
                setActiveTab(sec.key)
                setHasUnsavedChanges(false)
              }}
              className={`p-3.5 rounded-xl text-left border transition-all relative flex flex-col justify-between ${
                isSelected
                  ? 'bg-white border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
                  : 'bg-white/80 border-slate-200 hover:bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-white bg-gradient-to-br ${sec.color} shadow-xs`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                {isSelected && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />}
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 leading-snug">{sec.name}</p>
                <p className="text-[10px] text-slate-500 line-clamp-1 mt-0.5">
                  {sec.focusAreas[0]}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {/* Área de Trabalho da Secretaria Selecionada */}
      <Card className="border-slate-200 shadow-sm bg-white">
        <CardHeader className="bg-slate-50/70 border-b border-slate-200 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br ${currentSecConfig.color} shadow-sm`}
              >
                {React.createElement(currentSecConfig.icon, { className: 'w-5 h-5' })}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold text-slate-900">
                    {currentSecConfig.fullName}
                  </CardTitle>
                  <Badge variant="outline" className={`text-[10px] ${currentSecConfig.badgeClass}`}>
                    Setor Ativo
                  </Badge>
                </div>
                <CardDescription className="text-xs text-slate-600 mt-0.5">
                  {currentSecConfig.description}
                </CardDescription>
              </div>
            </div>

            {/* Status de Permissão de Edição */}
            <div className="flex items-center gap-2 text-xs">
              {canEditCurrentTab ? (
                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-50 flex items-center gap-1 font-medium">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Permissão de Edição Concedida
                </Badge>
              ) : (
                <Badge className="bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100 flex items-center gap-1 font-medium">
                  <Info className="w-3 h-3 text-slate-500" />
                  Consulta Autorizada (Manutenção: {currentSecConfig.name})
                </Badge>
              )}
            </div>
          </div>

          {/* Responsável e Contato da Secretaria configurados */}
          {currentCustomConfig &&
            (currentCustomConfig.lead_person || currentCustomConfig.contact_channel) && (
              <div className="mt-3 pt-3 border-t border-slate-200/80 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                {currentCustomConfig.lead_person && (
                  <div>
                    <span className="font-semibold text-slate-700">Responsável Setorial: </span>
                    {currentCustomConfig.lead_person}
                  </div>
                )}
                {currentCustomConfig.contact_channel && (
                  <div>
                    <span className="font-semibold text-slate-700">Canal Operacional: </span>
                    {currentCustomConfig.contact_channel}
                  </div>
                )}
                {Array.isArray(currentCustomConfig.custom_categories) &&
                  currentCustomConfig.custom_categories.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-slate-700">Categorias: </span>
                      {currentCustomConfig.custom_categories.map((c, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.2 rounded bg-slate-200/70 text-[10px] font-mono"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
              </div>
            )}
        </CardHeader>

        <CardContent className="p-6">
          {/* Conteúdo Dinâmico por Secretaria */}
          {activeTab === 'defesa_civil' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <Card className="border-slate-200 bg-slate-50/50">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-slate-500">Planos de Contingência</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{plans.length}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Municipal e setoriais</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 bg-slate-50/50">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-slate-500">Travessias Monitoradas</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {infrastructures.length}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">Pontes e aduelas de Ibiúna</p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 bg-slate-50/50">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-slate-500">Famílias Levantadas</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{families.length}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      População exposta cadastrada
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-slate-200 bg-slate-50/50">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-slate-500">Demandas Intersetoriais</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{demands.length}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Encaminhadas a outros órgãos
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-blue-900">
                    Módulos Especializados da Defesa Civil
                  </h4>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    Acesse diretamente as ferramentas dedicadas de mapeamento e resposta operacional
                    integrada.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild className="text-xs h-8 bg-white">
                    <a href="/setores-risco">Setores IPT</a>
                  </Button>
                  <Button size="sm" variant="outline" asChild className="text-xs h-8 bg-white">
                    <a href="/infraestruturas">Fichas de Pontes</a>
                  </Button>
                  <Button size="sm" variant="outline" asChild className="text-xs h-8 bg-white">
                    <a href="/painel">Painel de Monitoramento</a>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'desenvolvimento_urbano' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Consultas Territoriais e Processos de Parcelamento
                  </h3>
                  <p className="text-xs text-slate-500">
                    Registro de processos, cruzamento territorial com setores IPT e encaminhamento
                    para análise técnica.
                  </p>
                </div>
                <Button
                  size="sm"
                  asChild
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8"
                >
                  <a href="/desenvolvimento-urbano">Acessar Consultas Urbanas</a>
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-slate-500">
                      Total de Consultas Registradas
                    </p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{consultations.length}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Processos protocolados</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200 bg-amber-50/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-amber-800">Interseções com Risco</p>
                    <p className="text-2xl font-bold text-amber-900 mt-1">
                      {
                        consultations.filter(
                          (c) => c.intersection_result === 'intersecao_encontrada',
                        ).length
                      }
                    </p>
                    <p className="text-[10px] text-amber-700 mt-0.5">Exigem parecer técnico</p>
                  </CardContent>
                </Card>
                <Card className="border-emerald-200 bg-emerald-50/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-emerald-800">
                      Consultas Inconclusivas / Sem Cruzamento
                    </p>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">
                      {
                        consultations.filter(
                          (c) => c.intersection_result !== 'intersecao_encontrada',
                        ).length
                      }
                    </p>
                    <p className="text-[10px] text-emerald-700 mt-0.5">Não dispensam vistoria</p>
                  </CardContent>
                </Card>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  Ressalva Técnica Obrigatória aos Processos Urbanísticos:
                </p>
                <p className="text-slate-700">
                  O cruzamento cartográfico indica apenas correlação com as bases cadastradas (IPT e
                  camadas municipais). Não declara "terreno sem risco", não substitui laudo de
                  sondagem, não aprova loteamento automaticamente e requer parecer formal da equipe
                  técnica.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'assistencia_social' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Acompanhamento de Famílias em Áreas de Risco
                  </h3>
                  <p className="text-xs text-slate-500">
                    Atendimentos CRAS/CREAS, vulnerabilidade familiar e acolhimento planejado.
                  </p>
                </div>
                <Button
                  size="sm"
                  asChild
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-8"
                >
                  <a href="/levantamento-familias">Ficha de Levantamento de Famílias</a>
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-slate-500">Famílias Cadastradas</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">{families.length}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Sem duplicidade confirmada</p>
                  </CardContent>
                </Card>
                <Card className="border-rose-200 bg-rose-50/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-rose-800">Crianças e Idosos</p>
                    <p className="text-2xl font-bold text-rose-900 mt-1">
                      {families.reduce(
                        (acc, f) => acc + (f.children_count || 0) + (f.elderly_count || 0),
                        0,
                      )}
                    </p>
                    <p className="text-[10px] text-rose-700 mt-0.5">
                      Pessoas com prioridade de evacuação
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-purple-200 bg-purple-50/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-purple-800">
                      Necessidade de Transporte Acessível
                    </p>
                    <p className="text-2xl font-bold text-purple-900 mt-1">
                      {families.filter((f) => f.needs_accessible_transport).length}
                    </p>
                    <p className="text-[10px] text-purple-700 mt-0.5">
                      Famílias com limitação de mobilidade
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                <span className="font-semibold text-slate-800">Proteção de Dados: </span>
                Nomes completos, telefones e endereços individuais são restritos a operadores
                sociais autorizados. Painéis agregados omitem dados pessoais para conformidade com a
                LGPD.
              </div>
            </div>
          )}

          {activeTab === 'saude' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Apoio Operacional em Saúde e Fenômeno El Niño
                  </h3>
                  <p className="text-xs text-slate-500">
                    Plano de preparação e resposta rápida em saúde com encaminhamentos da Oficina
                    Multirrisco da Região de Sorocaba.
                  </p>
                </div>
                <Button
                  size="sm"
                  asChild
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
                >
                  <a href="/planos-contingencia">Ver Plano Setorial de Saúde</a>
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-slate-500">
                      Famílias com Suporte de Mobilidade
                    </p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {families.filter((f) => f.has_mobility_limitation).length}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Necessitam maca ou ambulância
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-red-200 bg-red-50/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-red-800">
                      Dependência de Energia (Oxigênio/Diálise)
                    </p>
                    <p className="text-2xl font-bold text-red-900 mt-1">
                      {/* Necessidades com equipamento vital */}
                      {
                        families.filter(
                          (f) =>
                            f.special_support_needs?.toLowerCase().includes('energia') ||
                            f.special_support_needs?.toLowerCase().includes('oxigênio'),
                        ).length
                      }
                    </p>
                    <p className="text-[10px] text-red-700 mt-0.5">Prioridade máxima em blecaute</p>
                  </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-blue-800">
                      Oficina Multirrisco Sorocaba
                    </p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">Ativo</p>
                    <p className="text-[10px] text-blue-700 mt-0.5">
                      Diretrizes regionais integradas
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg text-xs text-emerald-900 space-y-1">
                <p className="font-bold">Diretriz Ética de Não-Exposição Clínica:</p>
                <p className="text-slate-700">
                  O módulo registra estritamente necessidades logísticas (tipo de transporte,
                  suporte respiratório dependente de rede elétrica e unidade de saúde de
                  referência). Não funciona como prontuário clínico e diagnósticos não são expostos
                  no mapa geográfico.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'educacao' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Escolas Municipais e Locais Candidatos a Abrigo
                  </h3>
                  <p className="text-xs text-slate-500">
                    Avaliação técnica de infraestrutura escolar: água, gerador, banheiros, acessos e
                    capacidade real.
                  </p>
                </div>
                <Button
                  size="sm"
                  asChild
                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8"
                >
                  <a href="/abrigos-escolas">Gerenciar Escolas & Locais de Acolhimento</a>
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-slate-500">Escolas Cadastradas</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {
                        shelters.filter((s) => s.facility_type === 'escola' || !s.facility_type)
                          .length
                      }
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Unidades escolares</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200 bg-amber-50/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-amber-800">
                      Candidatas - Avaliação Pendente
                    </p>
                    <p className="text-2xl font-bold text-amber-900 mt-1">
                      {
                        shelters.filter(
                          (s) => s.shelter_classification === 'candidato_avaliacao_pendente',
                        ).length
                      }
                    </p>
                    <p className="text-[10px] text-amber-700 mt-0.5">Em vistoria de segurança</p>
                  </CardContent>
                </Card>
                <Card className="border-emerald-200 bg-emerald-50/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-emerald-800">Abrigos Aprovados</p>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">
                      {
                        shelters.filter(
                          (s) =>
                            s.shelter_classification === 'abrigo_aprovado' || s.status === 'ativo',
                        ).length
                      }
                    </p>
                    <p className="text-[10px] text-emerald-700 mt-0.5">
                      Homologados p/ contingência
                    </p>
                  </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-blue-800">Abrigos Ativados</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      {shelters.filter((s) => s.shelter_classification === 'abrigo_ativado').length}
                    </p>
                    <p className="text-[10px] text-blue-700 mt-0.5">Em operação com desabrigados</p>
                  </CardContent>
                </Card>
              </div>

              <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-lg text-xs text-purple-900 space-y-1">
                <p className="font-bold">Regra de Segurança Operacional:</p>
                <p className="text-slate-700">
                  Uma escola próxima a um setor de enchente NÃO é transformada em abrigo
                  automaticamente por proximidade. A homologação exige vistoria dos acessos,
                  segurança contra desabamentos, água potável, banheiros e aprovação formal da
                  Defesa Civil e Educação.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'obras' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Travessias Críticas e Dependência de Pontes
                  </h3>
                  <p className="text-xs text-slate-500">
                    Monitoramento das 215 infraestruturas de Ibiúna, rotas alternativas e
                    identificação de risco de isolamento comunitário.
                  </p>
                </div>
                <Button
                  size="sm"
                  asChild
                  className="bg-cyan-600 hover:bg-cyan-700 text-white text-xs h-8"
                >
                  <a href="/infraestruturas">Fichas Técnicas das Pontes</a>
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="border-slate-200">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-slate-500">Pontes e Aduelas</p>
                    <p className="text-2xl font-bold text-slate-900 mt-1">
                      {infrastructures.length}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Cadastradas no município</p>
                  </CardContent>
                </Card>
                <Card className="border-amber-200 bg-amber-50/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-amber-800">Possível Isolamento</p>
                    <p className="text-2xl font-bold text-amber-900 mt-1">
                      {
                        infrastructures.filter(
                          (i) => i.has_alternative_access === 'possivel_isolamento',
                        ).length
                      }
                    </p>
                    <p className="text-[10px] text-amber-700 mt-0.5">Sem rota comprovada</p>
                  </CardContent>
                </Card>
                <Card className="border-emerald-200 bg-emerald-50/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-emerald-800">
                      Acesso Alternativo Confirmado
                    </p>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">
                      {
                        infrastructures.filter(
                          (i) => i.has_alternative_access === 'acesso_alternativo_confirmado',
                        ).length
                      }
                    </p>
                    <p className="text-[10px] text-emerald-700 mt-0.5">Desvio verificado</p>
                  </CardContent>
                </Card>
                <Card className="border-blue-200 bg-blue-50/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-blue-800">Demandas de Obras Abertas</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      {
                        demands.filter(
                          (d) => d.target_department === 'obras' && d.status !== 'concluida',
                        ).length
                      }
                    </p>
                    <p className="text-[10px] text-blue-700 mt-0.5">Desobstrução / reforma</p>
                  </CardContent>
                </Card>
              </div>

              <div className="p-3 bg-cyan-50/50 border border-cyan-200 rounded-lg text-xs text-cyan-900 space-y-1">
                <p className="font-bold">Critério Operacional de Risco de Isolamento:</p>
                <p className="text-slate-700">
                  Não é permitida conclusão de isolamento por mera distância euclidiana (linha
                  reta). O sistema exige cadastro do percurso real de desvio, tempo estimado e
                  confirmação da passagem de ambulâncias e transporte escolar.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Nova Demanda Intersetorial */}
      <Dialog open={isNewDemandOpen} onOpenChange={setIsNewDemandOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Nova Demanda Intersetorial — {currentSecConfig.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Encaminhe serviços, obras, intervenções em pontes ou ações sociais para outra
              secretaria municipal.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDemand} className="space-y-3.5 text-xs">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Título do Problema ou Intervenção *
              </Label>
              <Input
                placeholder="Ex: Desobstrução de canaleta e bueiro na Av. Principal"
                value={demandTitle}
                onChange={(e) => setDemandTitle(e.target.value)}
                className="mt-1 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Secretaria Destinatária *
                </Label>
                <Select value={demandTargetDept} onValueChange={setDemandTargetDept}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="obras">Obras e Serviços Públicos</SelectItem>
                    <SelectItem value="servicos_municipais">Serviços Municipais</SelectItem>
                    <SelectItem value="meio_ambiente">Meio Ambiente</SelectItem>
                    <SelectItem value="assistencia_social">Assistência Social</SelectItem>
                    <SelectItem value="saude">Saúde</SelectItem>
                    <SelectItem value="planejamento">Desenvolvimento Urbano</SelectItem>
                    <SelectItem value="transito">Trânsito</SelectItem>
                    <SelectItem value="outra">Outra</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Prioridade Sugerida *
                </Label>
                <Select value={demandPriority} onValueChange={(v: any) => setDemandPriority(v)}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="urgente">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Localização / Bairro / Referência *
              </Label>
              <Input
                placeholder="Ex: Bairro Paruru, próximo à Ponte P1"
                value={demandLocation}
                onChange={(e) => setDemandLocation(e.target.value)}
                className="mt-1 text-xs"
                required
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Descrição Técnica / Detalhes
              </Label>
              <Textarea
                placeholder="Descreva a situação encontrada, riscos associados e providências necessárias..."
                value={demandDesc}
                onChange={(e) => setDemandDesc(e.target.value)}
                className="mt-1 text-xs min-h-[80px]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsNewDemandOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                Encaminhar Demanda
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Configuração da Secretaria */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Configurações Setoriais — {currentSecConfig.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Defina contatos oficiais e categorias complementares para esta secretaria sem
              comprometer a integridade do banco.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 text-xs py-1">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Responsável Setorial Principal
              </Label>
              <Input
                placeholder="Nome do Secretário(a) ou Diretor(a)"
                value={leadPerson}
                onChange={(e) => setLeadPerson(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Canal Operacional / Telefone / E-mail
              </Label>
              <Input
                placeholder="Ex: plantao.obras@ibiuna.sp.gov.br / Ramal 123"
                value={contactChannel}
                onChange={(e) => setContactChannel(e.target.value)}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Categorias Complementares (separadas por vírgula)
              </Label>
              <Input
                placeholder="Ex: Drenagem Urbana, Pavimentação, Contenção de Encosta"
                value={customCategoriesText}
                onChange={(e) => setCustomCategoriesText(e.target.value)}
                className="mt-1 text-xs"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Essas categorias aparecem para filtros rápidos nas demandas desta secretaria.
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsConfigOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveConfig}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs"
            >
              Salvar Configurações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default SecretariasWorkspacePage
