import React, { useState, useEffect, useMemo } from 'react'
import {
  Users,
  Search,
  Plus,
  MapPin,
  Phone,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  HeartHandshake,
  Activity,
  Zap,
  Accessibility,
  Bus,
  RefreshCw,
  Home,
  ShieldAlert,
  ChevronRight,
  Filter,
  Save,
  X,
  FileText,
  Lock,
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
  surveyedFamiliesService,
  socialFamilyActionsService,
  healthOperationalNeedsService,
  riskSectorsService,
  dangerStretchesService,
  strategicInfrastructuresService,
  auditLogService,
} from '@/services/defesa-civil'
import type {
  SurveyedFamily,
  SurveyStatus,
  DuplicateReviewStatus,
  SocialFamilyAction,
  HealthOperationalNeed,
  RiskSector,
  DangerStretch,
  StrategicInfrastructure,
} from '@/types/defesa-civil'
import { RecordAttachmentsTab } from '@/components/defesa-civil/RecordAttachmentsTab'

export const FamiliesSurveyPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [families, setFamilies] = useState<SurveyedFamily[]>([])
  const [riskSectors, setRiskSectors] = useState<RiskSector[]>([])
  const [dangerStretches, setDangerStretches] = useState<DangerStretch[]>([])
  const [infrastructures, setInfrastructures] = useState<StrategicInfrastructure[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [vulnerabilityFilter, setVulnerabilityFilter] = useState<string>('all')

  // Modal Novo / Edição de Família
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Campos da Ficha Mobile-Friendly
  const [familyCode, setFamilyCode] = useState('')
  const [responsibleName, setResponsibleName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [address, setAddress] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [latitude, setLatitude] = useState<string>('')
  const [longitude, setLongitude] = useState<string>('')

  // Demografia
  const [membersCount, setMembersCount] = useState<number>(1)
  const [childrenCount, setChildrenCount] = useState<number>(0)
  const [elderlyCount, setElderlyCount] = useState<number>(0)
  const [disabledCount, setDisabledCount] = useState<number>(0)

  // Acessibilidade e Transporte
  const [hasMobilityLimitation, setHasMobilityLimitation] = useState<boolean>(false)
  const [needsAccessibleTransport, setNeedsAccessibleTransport] = useState<boolean>(false)
  const [specialSupportNeeds, setSpecialSupportNeeds] = useState<string>('')
  const [commPreferences, setCommPreferences] = useState<string>('')

  // Vínculos Territoriais Confirmados
  const [riskSectorCode, setRiskSectorCode] = useState<string>('')
  const [dangerStretchCode, setDangerStretchCode] = useState<string>('')
  const [crossingCodes, setCrossingCodes] = useState<string>('')

  // Metadados do Levantamento
  const [visitDate, setVisitDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [surveyTeam, setSurveyTeam] = useState<string>(user?.name || '')
  const [informationSource, setInformationSource] = useState<string>('Visita Domiciliar em Campo')
  const [surveyStatus, setSurveyStatus] = useState<SurveyStatus>('observada')
  const [updateNeeded, setUpdateNeeded] = useState<boolean>(false)
  const [duplicateReviewStatus, setDuplicateReviewStatus] = useState<DuplicateReviewStatus>('ok')
  const [notes, setNotes] = useState<string>('')

  // Detalhe Completo e Ações Setoriais
  const [selectedFamily, setSelectedFamily] = useState<SurveyedFamily | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [socialActions, setSocialActions] = useState<SocialFamilyAction[]>([])
  const [healthNeeds, setHealthNeeds] = useState<HealthOperationalNeed[]>([])

  // Formulário de Ação Social
  const [newSocialType, setNewSocialType] = useState<any>('atendimento_cras_creas')
  const [newSocialDesc, setNewSocialDesc] = useState('')
  const [newSocialWorker, setNewSocialWorker] = useState(user?.name || '')

  // Formulário de Apoio em Saúde Operacional (Não Clínico)
  const [mobilityType, setMobilityType] = useState<any>('nenhum')
  const [requiresPower, setRequiresPower] = useState(false)
  const [powerNotes, setPowerNotes] = useState('')
  const [healthPriority, setHealthPriority] = useState<any>('normal')
  const [healthUbsRef, setHealthUbsRef] = useState('')

  const isSocialAuthorized = useMemo(() => {
    if (!user) return false
    return (
      user.role === 'administrador' ||
      user.role === 'coordenador' ||
      user.department === 'assistencia_social' ||
      user.department === 'defesa_civil'
    )
  }, [user])

  const isHealthAuthorized = useMemo(() => {
    if (!user) return false
    return (
      user.role === 'administrador' ||
      user.role === 'coordenador' ||
      user.department === 'saude' ||
      user.department === 'defesa_civil'
    )
  }, [user])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [fams, secs, strs, infras] = await Promise.all([
        surveyedFamiliesService.list(undefined, 'family_internal_code'),
        riskSectorsService.list(undefined, 'code', 400),
        dangerStretchesService.list(undefined, 'code', 300),
        strategicInfrastructuresService.list(undefined, 'original_code', 300),
      ])
      setFamilies(fams)
      setRiskSectors(secs)
      setDangerStretches(strs)
      setInfrastructures(infras)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar levantamentos',
        description: err.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openNewFamilyModal = () => {
    setEditingId(null)
    const nextCode = `FAM-${new Date().getFullYear()}-${String(families.length + 1).padStart(4, '0')}`
    setFamilyCode(nextCode)
    setResponsibleName('')
    setContactPhone('')
    setAddress('')
    setNeighborhood('')
    setLatitude('')
    setLongitude('')
    setMembersCount(1)
    setChildrenCount(0)
    setElderlyCount(0)
    setDisabledCount(0)
    setHasMobilityLimitation(false)
    setNeedsAccessibleTransport(false)
    setSpecialSupportNeeds('')
    setCommPreferences('')
    setRiskSectorCode('')
    setDangerStretchCode('')
    setCrossingCodes('')
    setVisitDate(new Date().toISOString().slice(0, 10))
    setSurveyTeam(user?.name || '')
    setInformationSource('Visita Domiciliar em Campo')
    setSurveyStatus('observada')
    setUpdateNeeded(false)
    setDuplicateReviewStatus('ok')
    setNotes('')
    setIsModalOpen(true)
  }

  const handleSaveFamily = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!familyCode.trim() || !responsibleName.trim() || !address.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campos obrigatórios',
        description: 'Informe o código, o nome do responsável e o endereço.',
      })
      return
    }

    // Prevenção de duplicidade: não criar duas famílias com mesmo código ou mesmo endereço sem conferência
    const existing = families.find(
      (f) =>
        f.id !== editingId &&
        (f.family_internal_code.toLowerCase() === familyCode.trim().toLowerCase() ||
          (f.address.toLowerCase() === address.trim().toLowerCase() &&
            f.responsible_name.toLowerCase() === responsibleName.trim().toLowerCase())),
    )

    let dupStatus: DuplicateReviewStatus = duplicateReviewStatus
    if (existing && duplicateReviewStatus === 'ok') {
      dupStatus = 'possivel_duplicidade'
      toast({
        title: 'Aviso de Possível Duplicidade',
        description: 'Identificado registro semelhante. Marcado para revisão sem fusão automática.',
      })
    }

    try {
      const payload: Partial<SurveyedFamily> = {
        municipality: user?.municipality || 'cw9b6e2pqv89i3p',
        family_internal_code: familyCode.trim(),
        responsible_name: responsibleName.trim(),
        contact_phone: contactPhone.trim() || undefined,
        address: address.trim(),
        neighborhood: neighborhood.trim() || undefined,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        members_count: Number(membersCount) || 1,
        children_count: Number(childrenCount) || 0,
        elderly_count: Number(elderlyCount) || 0,
        disabled_count: Number(disabledCount) || 0,
        has_mobility_limitation: hasMobilityLimitation,
        needs_accessible_transport: needsAccessibleTransport,
        special_support_needs: specialSupportNeeds.trim() || undefined,
        communication_preferences: commPreferences.trim() || undefined,
        risk_sector_code: riskSectorCode.trim() || undefined,
        danger_stretch_code: dangerStretchCode.trim() || undefined,
        crossing_infrastructure_codes: crossingCodes.trim() || undefined,
        visit_date: visitDate || undefined,
        survey_team: surveyTeam.trim() || undefined,
        information_source: informationSource.trim() || undefined,
        survey_status: surveyStatus,
        update_needed: updateNeeded,
        duplicate_review_status: dupStatus,
        notes: notes.trim() || undefined,
        created_by: user?.id,
      }

      if (editingId) {
        await surveyedFamiliesService.update(editingId, payload)
        await auditLogService.create({
          action: 'editar_familia_levantamento',
          collection: 'surveyed_families',
          record_id: editingId,
          details: `Ficha da família ${familyCode} editada por ${user?.name}`,
        })
      } else {
        await surveyedFamiliesService.create(payload)
        await auditLogService.create({
          action: 'cadastrar_familia_levantamento',
          collection: 'surveyed_families',
          details: `Nova família ${familyCode} cadastrada no território por ${user?.name}`,
        })
      }

      toast({
        title: 'Ficha Gravada com Sucesso',
        description: `Família ${familyCode} salva no cadastro territorial.`,
      })

      setIsModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar ficha',
        description: err.message,
      })
    }
  }

  // Abrir Ficha Detalhada
  const handleOpenDetail = async (fam: SurveyedFamily) => {
    setSelectedFamily(fam)
    setIsDetailOpen(true)
    try {
      const [soc, hlt] = await Promise.all([
        socialFamilyActionsService.listForFamily(fam.id).catch(() => []),
        healthOperationalNeedsService.listForFamily(fam.id).catch(() => []),
      ])
      setSocialActions(soc)
      setHealthNeeds(hlt)
    } catch {
      setSocialActions([])
      setHealthNeeds([])
    }
  }

  // Adicionar Atendimento Social
  const handleAddSocialAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFamily || !newSocialDesc.trim()) return
    try {
      await socialFamilyActionsService.create({
        municipality: user?.municipality || 'cw9b6e2pqv89i3p',
        family: selectedFamily.id,
        action_type: newSocialType,
        description: newSocialDesc.trim(),
        responsible_worker: newSocialWorker.trim() || user?.name,
        action_date: new Date().toISOString().slice(0, 10),
        status: 'aberto',
        created_by: user?.id,
      })

      toast({
        title: 'Atendimento Social Registrado',
        description: 'Ação vinculada à família.',
      })

      setNewSocialDesc('')
      const updated = await socialFamilyActionsService.listForFamily(selectedFamily.id)
      setSocialActions(updated)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar ação social',
        description: err.message,
      })
    }
  }

  // Adicionar Necessidade Operacional de Saúde
  const handleAddHealthNeed = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFamily) return
    try {
      await healthOperationalNeedsService.create({
        municipality: user?.municipality || 'cw9b6e2pqv89i3p',
        family: selectedFamily.id,
        mobility_support_type: mobilityType,
        requires_power_equipment: requiresPower,
        power_equipment_notes: powerNotes.trim() || undefined,
        priority_level: healthPriority,
        health_unit_reference: healthUbsRef.trim() || undefined,
        verified_by_nurse_or_agent: user?.name,
        status: 'pendente',
        created_by: user?.id,
      })

      toast({
        title: 'Necessidade Operacional de Saúde Salva',
        description: 'Informações operacionais atualizadas sem exposição clínica.',
      })

      setPowerNotes('')
      const updated = await healthOperationalNeedsService.listForFamily(selectedFamily.id)
      setHealthNeeds(updated)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar necessidade de saúde',
        description: err.message,
      })
    }
  }

  // Filtros
  const filtered = families.filter((f) => {
    const q = search.toLowerCase()
    const matchSearch =
      search === '' ||
      f.family_internal_code.toLowerCase().includes(q) ||
      f.responsible_name.toLowerCase().includes(q) ||
      f.address.toLowerCase().includes(q) ||
      (f.neighborhood && f.neighborhood.toLowerCase().includes(q)) ||
      (f.risk_sector_code && f.risk_sector_code.toLowerCase().includes(q))

    const matchStatus = statusFilter === 'all' || f.survey_status === statusFilter

    let matchVuln = true
    if (vulnerabilityFilter === 'children_elderly') {
      matchVuln = (f.children_count || 0) > 0 || (f.elderly_count || 0) > 0
    } else if (vulnerabilityFilter === 'disabled_mobility') {
      matchVuln = !!f.has_mobility_limitation || (f.disabled_count || 0) > 0
    } else if (vulnerabilityFilter === 'transport_needed') {
      matchVuln = !!f.needs_accessible_transport
    }

    return matchSearch && matchStatus && matchVuln
  })

  // Agregações não duplicadas
  const totalPersons = useMemo(() => {
    return families.reduce((acc, f) => acc + (f.members_count || 1), 0)
  }, [families])

  const totalChildren = useMemo(() => {
    return families.reduce((acc, f) => acc + (f.children_count || 0), 0)
  }, [families])

  const totalElderly = useMemo(() => {
    return families.reduce((acc, f) => acc + (f.elderly_count || 0), 0)
  }, [families])

  const totalMobility = useMemo(() => {
    return families.filter((f) => f.has_mobility_limitation || f.needs_accessible_transport).length
  }, [families])

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-rose-600 to-pink-700 text-white rounded-xl shadow-md">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Levantamento de Famílias e População Exposta
              </h1>
              <Badge variant="outline" className="text-xs bg-rose-50 text-rose-800 border-rose-200">
                Ficha em Campo
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Cadastro domiciliar por unidade de moradia, necessidades de transporte, apoio e
              proteção de dados sociais e de saúde.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoading}
            className="text-xs h-9"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          <Button
            size="sm"
            onClick={openNewFamilyModal}
            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-9 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nova Ficha de Família
          </Button>
        </div>
      </div>

      {/* Regra de Contagem Única e Proteção */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 flex items-start gap-3">
        <Home className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-900">
            Princípio de Contagem Única e Revisão Sem Fusão Automática:
          </p>
          <p className="leading-relaxed">
            Uma família relacionada a múltiplos riscos (ex: setor IPT de escorregamento e travessia
            com risco de isolamento) é contabilizada <strong>apenas uma vez</strong> nos totais
            agregados. Em caso de cadastros com nomes ou endereços semelhantes, o sistema sinaliza
            duplicidade para conferência manual, sem apagar ou fundir dados automaticamente.
          </p>
        </div>
      </div>

      {/* Indicadores Agregados */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500">Famílias Levantadas</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{families.length}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">{totalPersons} moradores no total</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/20">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-amber-800">Crianças e Idosos</p>
            <p className="text-2xl font-bold text-amber-900 mt-1">{totalChildren + totalElderly}</p>
            <p className="text-[10px] text-amber-700 mt-0.5">
              {totalChildren} crianças / {totalElderly} idosos
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/20">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-purple-800">Apoio de Mobilidade</p>
            <p className="text-2xl font-bold text-purple-900 mt-1">{totalMobility}</p>
            <p className="text-[10px] text-purple-700 mt-0.5">Exigem transporte acessível</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/20">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-blue-800">Situação do Levantamento</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">
              {families.filter((f) => f.survey_status === 'conferida').length}
            </p>
            <p className="text-[10px] text-blue-700 mt-0.5">Fichas conferidas em campo</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por código, responsável, endereço ou setor IPT..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            <div className="w-full md:w-56">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Situação da Informação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Situações</SelectItem>
                  <SelectItem value="conferida">Conferida</SelectItem>
                  <SelectItem value="observada">Observada</SelectItem>
                  <SelectItem value="declarada">Declarada</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full md:w-64">
              <Select value={vulnerabilityFilter} onValueChange={setVulnerabilityFilter}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Vulnerabilidade / Apoio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as Famílias</SelectItem>
                  <SelectItem value="children_elderly">Com Crianças ou Idosos</SelectItem>
                  <SelectItem value="disabled_mobility">Com Limitação de Mobilidade</SelectItem>
                  <SelectItem value="transport_needed">Necessita Transporte Acessível</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Famílias */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-full py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
            Nenhuma ficha de família encontrada com os critérios informados.
          </div>
        ) : (
          filtered.map((fam) => {
            const hasChildrenOrElderly =
              (fam.children_count || 0) > 0 || (fam.elderly_count || 0) > 0
            const hasMobility = fam.has_mobility_limitation || fam.needs_accessible_transport

            return (
              <Card
                key={fam.id}
                className="border-slate-200 hover:border-slate-300 transition-shadow shadow-xs hover:shadow-sm bg-white flex flex-col justify-between"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {fam.family_internal_code}
                      </span>
                      <h3 className="text-sm font-bold text-slate-900 mt-1 line-clamp-1">
                        {fam.responsible_name}
                      </h3>
                    </div>

                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize ${
                        fam.survey_status === 'conferida'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : fam.survey_status === 'observada'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : fam.survey_status === 'declarada'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {fam.survey_status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="p-4 pt-1 space-y-2 text-xs text-slate-600">
                  <div className="flex items-start gap-1.5 text-slate-700">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <p className="line-clamp-2">
                      {fam.address}
                      {fam.neighborhood && ` - ${fam.neighborhood}`}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-medium">
                      {fam.members_count || 1} pessoas
                    </span>

                    {hasChildrenOrElderly && (
                      <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded text-[10px] font-medium">
                        {(fam.children_count || 0) > 0 ? `${fam.children_count} crianças ` : ''}
                        {(fam.elderly_count || 0) > 0 ? `${fam.elderly_count} idosos` : ''}
                      </span>
                    )}

                    {hasMobility && (
                      <span className="px-2 py-0.5 bg-purple-50 text-purple-800 border border-purple-200 rounded text-[10px] font-medium flex items-center gap-1">
                        <Accessibility className="w-3 h-3" />
                        Mobilidade Reduzida
                      </span>
                    )}

                    {fam.duplicate_review_status === 'possivel_duplicidade' && (
                      <span className="px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded text-[10px] font-bold">
                        Verificar Duplicidade
                      </span>
                    )}
                  </div>

                  {/* Vínculo Territorial */}
                  {(fam.risk_sector_code || fam.crossing_infrastructure_codes) && (
                    <div className="p-2 bg-slate-50 rounded border border-slate-200/80 text-[10px] text-slate-600 space-y-0.5">
                      {fam.risk_sector_code && (
                        <p>
                          <span className="font-semibold text-slate-800">Setor IPT:</span>{' '}
                          {fam.risk_sector_code}
                        </p>
                      )}
                      {fam.crossing_infrastructure_codes && (
                        <p>
                          <span className="font-semibold text-slate-800">Travessia:</span>{' '}
                          {fam.crossing_infrastructure_codes}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenDetail(fam)}
                      className="text-xs h-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Ficha Completa & Atendimentos
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(fam.id)
                        setFamilyCode(fam.family_internal_code)
                        setResponsibleName(fam.responsible_name)
                        setContactPhone(fam.contact_phone || '')
                        setAddress(fam.address)
                        setNeighborhood(fam.neighborhood || '')
                        setLatitude(fam.latitude ? String(fam.latitude) : '')
                        setLongitude(fam.longitude ? String(fam.longitude) : '')
                        setMembersCount(fam.members_count || 1)
                        setChildrenCount(fam.children_count || 0)
                        setElderlyCount(fam.elderly_count || 0)
                        setDisabledCount(fam.disabled_count || 0)
                        setHasMobilityLimitation(!!fam.has_mobility_limitation)
                        setNeedsAccessibleTransport(!!fam.needs_accessible_transport)
                        setSpecialSupportNeeds(fam.special_support_needs || '')
                        setCommPreferences(fam.communication_preferences || '')
                        setRiskSectorCode(fam.risk_sector_code || '')
                        setDangerStretchCode(fam.danger_stretch_code || '')
                        setCrossingCodes(fam.crossing_infrastructure_codes || '')
                        setVisitDate(fam.visit_date ? fam.visit_date.slice(0, 10) : '')
                        setSurveyTeam(fam.survey_team || '')
                        setInformationSource(fam.information_source || '')
                        setSurveyStatus(fam.survey_status)
                        setUpdateNeeded(!!fam.update_needed)
                        setDuplicateReviewStatus(fam.duplicate_review_status || 'ok')
                        setNotes(fam.notes || '')
                        setIsModalOpen(true)
                      }}
                      className="text-xs h-8 text-slate-700"
                    >
                      Editar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Modal Ficha Completa / Mobile-Friendly Form */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl bg-white max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {editingId
                ? `Editar Levantamento — ${familyCode}`
                : 'Nova Ficha de Levantamento de Campo'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Ficha adequada a dispositivos móveis para cadastro da residência, moradores e
              necessidades operacionais.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveFamily} className="space-y-4 text-xs pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Código Interno da Família *
                </Label>
                <Input
                  value={familyCode}
                  onChange={(e) => setFamilyCode(e.target.value)}
                  className="mt-1 text-xs font-mono"
                  required
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Responsável Familiar *
                </Label>
                <Input
                  placeholder="Nome completo do responsável"
                  value={responsibleName}
                  onChange={(e) => setResponsibleName(e.target.value)}
                  className="mt-1 text-xs"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Telefone / WhatsApp de Contato
                </Label>
                <Input
                  placeholder="(15) 99999-9999"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Situação da Informação *
                </Label>
                <Select value={surveyStatus} onValueChange={(v: any) => setSurveyStatus(v)}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="declarada">
                      Declarada (informada por morador/vizinho)
                    </SelectItem>
                    <SelectItem value="observada">
                      Observada (constatada in loco pela equipe)
                    </SelectItem>
                    <SelectItem value="conferida">Conferida (documentada e validada)</SelectItem>
                    <SelectItem value="pendente">Pendente de Confirmação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Endereço da Residência *
              </Label>
              <Input
                placeholder="Rua, Estrada, Número, Ponto de Referência"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 text-xs"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Bairro / Comunidade</Label>
                <Input
                  placeholder="Ex: Paruru, Verava"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Latitude (WGS84)</Label>
                <Input
                  placeholder="-23.655100"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Longitude (WGS84)</Label>
                <Input
                  placeholder="-47.221500"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            {/* Composição Familiar */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <h4 className="text-xs font-bold text-slate-800">
                Composição Familiar e Vulnerabilidades
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-[11px] font-medium text-slate-600">
                    Total Moradores *
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={membersCount}
                    onChange={(e) => setMembersCount(Number(e.target.value))}
                    className="mt-1 text-xs h-8"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium text-slate-600">
                    Crianças (0-12 anos)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={childrenCount}
                    onChange={(e) => setChildrenCount(Number(e.target.value))}
                    className="mt-1 text-xs h-8"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium text-slate-600">
                    Idosos (60+ anos)
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={elderlyCount}
                    onChange={(e) => setElderlyCount(Number(e.target.value))}
                    className="mt-1 text-xs h-8"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-medium text-slate-600">
                    PCD / Mobilidade Reduzida
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    value={disabledCount}
                    onChange={(e) => setDisabledCount(Number(e.target.value))}
                    className="mt-1 text-xs h-8"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={hasMobilityLimitation}
                    onChange={(e) => setHasMobilityLimitation(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Há limitação grave de locomoção</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={needsAccessibleTransport}
                    onChange={(e) => setNeedsAccessibleTransport(e.target.checked)}
                    className="rounded text-rose-600"
                  />
                  <span>Necessita transporte adaptado para evacuação</span>
                </label>
              </div>

              <div>
                <Label className="text-[11px] font-medium text-slate-600">
                  Necessidades Especiais de Apoio / Comunicação
                </Label>
                <Input
                  placeholder="Ex: Não alfabetizado, pessoa acamada, animal de estimação de porte"
                  value={specialSupportNeeds}
                  onChange={(e) => setSpecialSupportNeeds(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            {/* Vínculo com Riscos e Pontes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Setor IPT Relacionado
                </Label>
                <Select value={riskSectorCode} onValueChange={setRiskSectorCode}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue placeholder="Selecione o setor" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="none">Nenhum setor confirmado</SelectItem>
                    {riskSectors.slice(0, 150).map((s) => (
                      <SelectItem key={s.id} value={s.code}>
                        {s.code} - {s.area_name || s.location || 'Setor'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Trecho de Perigo IPT</Label>
                <Select value={dangerStretchCode} onValueChange={setDangerStretchCode}>
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue placeholder="Selecione o trecho" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    <SelectItem value="none">Nenhum trecho confirmado</SelectItem>
                    {dangerStretches.slice(0, 100).map((t) => (
                      <SelectItem key={t.id} value={t.code}>
                        {t.code} - {t.area_name || t.location || 'Trecho'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Travessia / Ponte Utilizada
                </Label>
                <Input
                  placeholder="Ex: P1, P2 ou Aduela P15"
                  value={crossingCodes}
                  onChange={(e) => setCrossingCodes(e.target.value)}
                  className="mt-1 text-xs font-mono"
                />
              </div>
            </div>

            {/* Metadados da Visita */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Data da Visita</Label>
                <Input
                  type="date"
                  value={visitDate}
                  onChange={(e) => setVisitDate(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Equipe / Agente</Label>
                <Input
                  value={surveyTeam}
                  onChange={(e) => setSurveyTeam(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  Revisão de Duplicidade
                </Label>
                <Select
                  value={duplicateReviewStatus}
                  onValueChange={(v: any) => setDuplicateReviewStatus(v)}
                >
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ok">OK (Única)</SelectItem>
                    <SelectItem value="possivel_duplicidade">Possível Duplicidade</SelectItem>
                    <SelectItem value="revisado_sem_fusao">Revisado Sem Fusão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
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
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs"
              >
                {editingId ? 'Salvar Alterações' : 'Cadastrar Família'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Detalhe da Família com Atendimentos Sociais e Saúde */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl bg-white max-h-[92vh] overflow-y-auto">
          {selectedFamily && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-base font-bold text-slate-900">
                      Ficha Territorial: {selectedFamily.family_internal_code}
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                      Responsável: {selectedFamily.responsible_name} | Moradores:{' '}
                      {selectedFamily.members_count}
                    </DialogDescription>
                  </div>
                  <Badge className="capitalize">Status: {selectedFamily.survey_status}</Badge>
                </div>
              </DialogHeader>

              <Tabs defaultValue="geral" className="w-full text-xs">
                <TabsList className="grid grid-cols-4 mb-4">
                  <TabsTrigger value="geral">Dados Gerais</TabsTrigger>
                  <TabsTrigger value="social">Assistência Social</TabsTrigger>
                  <TabsTrigger value="saude">Saúde Operacional</TabsTrigger>
                  <TabsTrigger value="anexos">Anexos & Fotos</TabsTrigger>
                </TabsList>

                {/* Tab Geral */}
                <TabsContent value="geral" className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <span className="text-slate-500 block">Endereço:</span>
                      <span className="font-semibold text-slate-800">{selectedFamily.address}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Bairro:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedFamily.neighborhood || 'Não informado'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Setor IPT Relacionado:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedFamily.risk_sector_code || 'Nenhum'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Travessia Crítica Utilizada:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedFamily.crossing_infrastructure_codes || 'Não informada'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Data da Visita / Equipe:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedFamily.visit_date
                          ? new Date(selectedFamily.visit_date).toLocaleDateString('pt-BR')
                          : 'N/D'}
                        {selectedFamily.survey_team ? ` (${selectedFamily.survey_team})` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Fonte da Informação:</span>
                      <span className="font-semibold text-slate-800">
                        {selectedFamily.information_source || 'Campo'}
                      </span>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab Assistência Social */}
                <TabsContent value="social" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900">
                        Atendimentos e Encaminhamentos Sociais
                      </h4>
                      <p className="text-slate-500 text-[11px]">
                        CRAS/CREAS, benefícios e acolhimento planejado.
                      </p>
                    </div>
                  </div>

                  {isSocialAuthorized ? (
                    <form
                      onSubmit={handleAddSocialAction}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2"
                    >
                      <p className="font-semibold text-slate-800">
                        Registrar Novo Atendimento Social
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Select value={newSocialType} onValueChange={setNewSocialType}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="atendimento_cras_creas">
                              Atendimento CRAS / CREAS
                            </SelectItem>
                            <SelectItem value="encaminhamento_beneficio">
                              Encaminhamento de Benefício Eventual
                            </SelectItem>
                            <SelectItem value="acompanhamento_continuo">
                              Acompanhamento Contínuo
                            </SelectItem>
                            <SelectItem value="necessidade_acolhimento">
                              Avaliação para Acolhimento
                            </SelectItem>
                            <SelectItem value="reassentamento_preventivo">
                              Reassentamento Preventivo
                            </SelectItem>
                            <SelectItem value="aluguel_social">Aluguel Social</SelectItem>
                            <SelectItem value="outro">Outro Encaminhamento</SelectItem>
                          </SelectContent>
                        </Select>

                        <Input
                          placeholder="Assistente / Técnico Responsável"
                          value={newSocialWorker}
                          onChange={(e) => setNewSocialWorker(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <Textarea
                        placeholder="Descreva a ação social realizada..."
                        value={newSocialDesc}
                        onChange={(e) => setNewSocialDesc(e.target.value)}
                        className="text-xs min-h-[50px]"
                        required
                      />
                      <Button
                        type="submit"
                        size="sm"
                        className="bg-rose-600 hover:bg-rose-700 text-white text-xs h-7"
                      >
                        Salvar Ação Social
                      </Button>
                    </form>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-800 text-[11px]">
                      Apenas operadores de Assistência Social e Defesa Civil podem registrar ações.
                    </div>
                  )}

                  <div className="space-y-2">
                    {socialActions.length === 0 ? (
                      <p className="text-slate-400 italic">
                        Nenhum atendimento social registrado para esta família.
                      </p>
                    ) : (
                      socialActions.map((act) => (
                        <div
                          key={act.id}
                          className="p-2.5 bg-white border border-slate-200 rounded text-[11px]"
                        >
                          <div className="flex justify-between items-center font-bold text-slate-800">
                            <span className="capitalize">{act.action_type.replace(/_/g, ' ')}</span>
                            <span className="text-slate-500 font-normal">
                              {act.action_date
                                ? new Date(act.action_date).toLocaleDateString('pt-BR')
                                : ''}
                            </span>
                          </div>
                          <p className="text-slate-700 mt-1">{act.description}</p>
                          {act.responsible_worker && (
                            <p className="text-slate-500 text-[10px] mt-0.5">
                              Responsável: {act.responsible_worker}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* Tab Saúde Operacional */}
                <TabsContent value="saude" className="space-y-4">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-950 text-[11px] flex items-start gap-2">
                    <Activity className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Diretriz de Saúde Não Clínica:</p>
                      <p>
                        Coleta restrita a logística operacional (transporte, ambulância,
                        oxigênio/energia). Não registre diagnósticos nem prontuário clínico neste
                        sistema.
                      </p>
                    </div>
                  </div>

                  {isHealthAuthorized ? (
                    <form
                      onSubmit={handleAddHealthNeed}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2"
                    >
                      <p className="font-semibold text-slate-800">
                        Registrar Necessidade de Evacuação / Cuidados
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-[10px] text-slate-600">
                            Suporte de Mobilidade / Transporte
                          </Label>
                          <Select value={mobilityType} onValueChange={setMobilityType}>
                            <SelectTrigger className="h-8 text-xs mt-0.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="nenhum">Nenhum suporte especial</SelectItem>
                              <SelectItem value="cadeira_rodas">Cadeira de Rodas</SelectItem>
                              <SelectItem value="maca">Transporte em Maca</SelectItem>
                              <SelectItem value="ambulancia_simples">Ambulância Simples</SelectItem>
                              <SelectItem value="ambulancia_uti">Ambulância UTI Móvel</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-[10px] text-slate-600">
                            Prioridade de Atendimento
                          </Label>
                          <Select value={healthPriority} onValueChange={setHealthPriority}>
                            <SelectTrigger className="h-8 text-xs mt-0.5">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="alta">Alta</SelectItem>
                              <SelectItem value="imediata_evacuacao">Imediata Evacuação</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="pt-1">
                        <label className="flex items-center gap-2 cursor-pointer text-slate-800 font-medium">
                          <input
                            type="checkbox"
                            checked={requiresPower}
                            onChange={(e) => setRequiresPower(e.target.checked)}
                            className="rounded text-red-600"
                          />
                          <span className="flex items-center gap-1">
                            <Zap className="w-3.5 h-3.5 text-red-600" />
                            Depende de Equipamento Elétrico Vital (Concentrador de O2, Diálise,
                            CPAP)
                          </span>
                        </label>
                      </div>

                      {requiresPower && (
                        <Input
                          placeholder="Detalhes operacionais (ex: paciente acamado com oxigênio contínuo)"
                          value={powerNotes}
                          onChange={(e) => setPowerNotes(e.target.value)}
                          className="h-8 text-xs"
                        />
                      )}

                      <Input
                        placeholder="UBS / Unidade de Saúde de Referência"
                        value={healthUbsRef}
                        onChange={(e) => setHealthUbsRef(e.target.value)}
                        className="h-8 text-xs"
                      />

                      <Button
                        type="submit"
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-7"
                      >
                        Salvar Necessidade de Saúde
                      </Button>
                    </form>
                  ) : (
                    <div className="p-3 bg-slate-100 border border-slate-200 rounded text-slate-600 text-[11px]">
                      Apenas profissionais de Saúde e Defesa Civil podem editar dados operacionais
                      de saúde.
                    </div>
                  )}

                  <div className="space-y-2">
                    {healthNeeds.length === 0 ? (
                      <p className="text-slate-400 italic">
                        Nenhuma necessidade de saúde registrada.
                      </p>
                    ) : (
                      healthNeeds.map((need) => (
                        <div
                          key={need.id}
                          className="p-2.5 bg-white border border-slate-200 rounded text-[11px]"
                        >
                          <div className="flex justify-between items-center font-bold text-slate-800">
                            <span>Suporte: {need.mobility_support_type}</span>
                            <Badge variant="outline" className="text-[10px]">
                              Prioridade: {need.priority_level}
                            </Badge>
                          </div>
                          {need.requires_power_equipment && (
                            <p className="text-red-700 font-semibold mt-0.5">
                              Dependente de Energia Elétrica: {need.power_equipment_notes || 'Sim'}
                            </p>
                          )}
                          {need.health_unit_reference && (
                            <p className="text-slate-600 mt-0.5">
                              UBS: {need.health_unit_reference}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* Tab Anexos */}
                <TabsContent value="anexos">
                  <RecordAttachmentsTab
                    targetCollection="surveyed_families"
                    targetId={selectedFamily.id}
                  />
                </TabsContent>
              </Tabs>

              <DialogFooter className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDetailOpen(false)}
                  className="text-xs"
                >
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default FamiliesSurveyPage
