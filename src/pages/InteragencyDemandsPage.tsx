import React, { useState, useEffect } from 'react'
import {
  Package,
  Plus,
  Search,
  Filter,
  Send,
  CheckCircle2,
  Clock,
  Archive,
  AlertTriangle,
  Building2,
  FileText,
  MapPin,
  RefreshCw,
  Eye,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  externalDemandsService,
  occurrencesService,
  strategicInfrastructuresService,
} from '@/services/defesa-civil'
import type { ExternalDemand, Occurrence, StrategicInfrastructure } from '@/types/defesa-civil'

const SECRETARY_LABELS: Record<string, string> = {
  obras: 'Obras e Serviços Públicos',
  servicos_municipais: 'Serviços Municipais / Limpeza Urbana',
  meio_ambiente: 'Meio Ambiente e Recursos Hídricos',
  assistencia_social: 'Promoção / Assistência Social',
  saude: 'Saúde / Vigilância Epidemiológica',
  planejamento: 'Planejamento Urbano e Habitação',
  transito: 'Trânsito e Mobilidade',
  outro: 'Outro Órgão / Concessionária',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; badgeClass: string }> = {
  identificada: {
    label: 'Identificada (Aberta)',
    color: 'yellow',
    badgeClass: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  },
  encaminhada: {
    label: 'Encaminhada ao Órgão',
    color: 'blue',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  em_acompanhamento: {
    label: 'Em Acompanhamento',
    color: 'purple',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  respondida: {
    label: 'Respondida / Concluída',
    color: 'emerald',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  arquivada: {
    label: 'Arquivada',
    color: 'slate',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
  },
}

export const InteragencyDemandsPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [demands, setDemands] = useState<ExternalDemand[]>([])
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [infrastructures, setInfrastructures] = useState<StrategicInfrastructure[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [search, setSearch] = useState('')
  const [filterSecretary, setFilterSecretary] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  // Modal Novo / Edição
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [formProblem, setFormProblem] = useState('')
  const [formLocation, setFormLocation] = useState('')
  const [formSecretary, setFormSecretary] = useState('obras')
  const [formDesc, setFormDesc] = useState('')
  const [formPriority, setFormPriority] = useState<'baixa' | 'media' | 'alta' | 'critica'>('media')
  const [formStatus, setFormStatus] = useState<
    'identificada' | 'encaminhada' | 'em_acompanhamento' | 'respondida' | 'arquivada'
  >('identificada')
  const [formOfficialDoc, setFormOfficialDoc] = useState('')
  const [formLinkedOcc, setFormLinkedOcc] = useState('')
  const [formLinkedInfra, setFormLinkedInfra] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Modal Detalhes / Acompanhamento
  const [selectedDemand, setSelectedDemand] = useState<ExternalDemand | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [followupNote, setFollowupNote] = useState('')

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [dems, occs, infras] = await Promise.all([
        externalDemandsService.list(undefined, '-created'),
        occurrencesService.list(undefined, '-created'),
        strategicInfrastructuresService.list(undefined, 'original_code'),
      ])
      setDemands(dems)
      setOccurrences(occs)
      setInfrastructures(infras)
    } catch (e: any) {
      console.error(e)
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar demandas',
        description: e.message || 'Verifique a conexão.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleCreateDemand = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formProblem.trim()) {
      toast({
        variant: 'destructive',
        title: 'Campo obrigatório',
        description: 'Informe o problema ou serviço necessário.',
      })
      return
    }

    setIsSubmitting(true)
    try {
      await externalDemandsService.create({
        problem_identified: formProblem.trim(),
        location_text: formLocation.trim(),
        responsible_secretary: formSecretary,
        technical_description: formDesc.trim(),
        suggested_priority: formPriority,
        forwarding_status: formStatus,
        official_document_ref: formOfficialDoc.trim() || undefined,
        linked_occurrence: formLinkedOcc || undefined,
        linked_structure: formLinkedInfra || undefined,
        forwarded_at: formStatus === 'encaminhada' ? new Date().toISOString() : undefined,
        followup_notes: [
          {
            date: new Date().toISOString(),
            author: user?.name || user?.email || 'Agente',
            note: 'Demanda cadastrada no sistema de Inteligência Territorial.',
          },
        ],
      })

      toast({
        title: 'Demanda registrada com sucesso!',
        description: 'A demanda já pode ser acompanhada e vinculada a ofícios.',
      })

      setIsFormOpen(false)
      resetForm()
      loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar demanda',
        description: err.message || 'Falha ao salvar.',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormProblem('')
    setFormLocation('')
    setFormSecretary('obras')
    setFormDesc('')
    setFormPriority('media')
    setFormStatus('identificada')
    setFormOfficialDoc('')
    setFormLinkedOcc('')
    setFormLinkedInfra('')
  }

  const handleAddFollowup = async () => {
    if (!selectedDemand || !followupNote.trim()) return

    try {
      const existingNotes = Array.isArray(selectedDemand.followup_notes)
        ? selectedDemand.followup_notes
        : []
      const updatedNotes = [
        ...existingNotes,
        {
          date: new Date().toISOString(),
          author: user?.name || user?.email || 'Agente',
          note: followupNote.trim(),
        },
      ]

      await externalDemandsService.update(selectedDemand.id, {
        followup_notes: updatedNotes,
      })

      toast({
        title: 'Acompanhamento registrado',
        description: 'Histórico atualizado.',
      })

      setFollowupNote('')
      setSelectedDemand({ ...selectedDemand, followup_notes: updatedNotes })
      loadData()
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: e.message,
      })
    }
  }

  const handleUpdateStatus = async (
    newStatus: 'identificada' | 'encaminhada' | 'em_acompanhamento' | 'respondida' | 'arquivada',
  ) => {
    if (!selectedDemand) return
    try {
      await externalDemandsService.update(selectedDemand.id, {
        forwarding_status: newStatus,
        resolved_at: newStatus === 'respondida' ? new Date().toISOString() : undefined,
      })
      toast({
        title: 'Status atualizado',
        description: `Demanda alterada para ${STATUS_CONFIG[newStatus]?.label}.`,
      })
      setSelectedDemand({ ...selectedDemand, forwarding_status: newStatus })
      loadData()
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: e.message,
      })
    }
  }

  // Filtragem
  const filtered = demands.filter((d) => {
    const q = search.toLowerCase()
    const matchSearch =
      search === '' ||
      d.problem_identified.toLowerCase().includes(q) ||
      (d.location_text && d.location_text.toLowerCase().includes(q)) ||
      (d.official_document_ref && d.official_document_ref.toLowerCase().includes(q))

    const matchSecretary = filterSecretary === 'all' || d.responsible_secretary === filterSecretary
    const matchStatus = filterStatus === 'all' || d.forwarding_status === filterStatus

    return matchSearch && matchSecretary && matchStatus
  })

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-700 rounded-xl shadow-xs">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Demandas para Outras Secretarias
            </h1>
            <p className="text-xs text-slate-500">
              Encaminhamentos intersetoriais de desobstrução, drenagem, obras em pontes e serviços
              públicos
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
            onClick={() => {
              resetForm()
              setIsFormOpen(true)
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-9 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nova Demanda
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500">Total Demandas</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{demands.length}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Cadastradas</p>
          </CardContent>
        </Card>

        <Card className="border-yellow-200 bg-yellow-50/40">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-yellow-700">Identificadas (Abertas)</p>
            <p className="text-2xl font-bold text-yellow-900 mt-1">
              {demands.filter((d) => d.forwarding_status === 'identificada').length}
            </p>
            <p className="text-[10px] text-yellow-600 mt-0.5">Aguardando ofício</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/40">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-blue-700">Encaminhadas</p>
            <p className="text-2xl font-bold text-blue-900 mt-1">
              {demands.filter((d) => d.forwarding_status === 'encaminhada').length}
            </p>
            <p className="text-[10px] text-blue-600 mt-0.5">Com ofício oficial</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/40">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-purple-700">Em Acompanhamento</p>
            <p className="text-2xl font-bold text-purple-900 mt-1">
              {demands.filter((d) => d.forwarding_status === 'em_acompanhamento').length}
            </p>
            <p className="text-[10px] text-purple-600 mt-0.5">Fiscalização em curso</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-emerald-700">Respondidas / Concluídas</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">
              {demands.filter((d) => d.forwarding_status === 'respondida').length}
            </p>
            <p className="text-[10px] text-emerald-600 mt-0.5">Solução confirmada</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por descrição do problema, localização ou nº de ofício..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            <div className="flex gap-2">
              <Select value={filterSecretary} onValueChange={setFilterSecretary}>
                <SelectTrigger className="w-48 h-9 text-xs">
                  <SelectValue placeholder="Secretaria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Secretarias</SelectItem>
                  {Object.entries(SECRETARY_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40 h-9 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Demandas */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="text-[11px]">
                  <TableHead>Problema Identificado</TableHead>
                  <TableHead>Secretaria Responsável</TableHead>
                  <TableHead>Localização / Bairro</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ofício / Vínculo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      Carregando demandas...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      Nenhuma demanda encontrada. Clique em "Nova Demanda" para registrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((d) => {
                    const st = STATUS_CONFIG[d.forwarding_status] || STATUS_CONFIG.identificada
                    return (
                      <TableRow key={d.id} className="hover:bg-slate-50/80">
                        <TableCell
                          className="font-semibold text-slate-900 max-w-[250px] truncate"
                          title={d.problem_identified}
                        >
                          {d.problem_identified}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-slate-50 text-slate-700">
                            {SECRETARY_LABELS[d.responsible_secretary] || d.responsible_secretary}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-600 max-w-[180px] truncate">
                          {d.location_text || '-'}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                              d.suggested_priority === 'critica'
                                ? 'bg-red-600 text-white'
                                : d.suggested_priority === 'alta'
                                  ? 'bg-orange-500 text-white'
                                  : d.suggested_priority === 'media'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {d.suggested_priority}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={st.badgeClass}>
                            {st.label}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {d.official_document_ref ? (
                            <span className="font-mono text-xs font-semibold text-blue-700">
                              {d.official_document_ref}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Sem ofício</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setSelectedDemand(d)
                              setIsDetailOpen(true)
                            }}
                            className="h-8 text-xs text-blue-600 hover:text-blue-800"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            Acompanhar
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Nova Demanda */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              Nova Demanda Intersetorial
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registre a demanda para encaminhamento à secretaria competente com histórico de
              auditoria.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDemand} className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Problema ou Intervenção Necessária *
              </label>
              <Input
                placeholder="Ex: Desobstrução de calha de aduela com acúmulo de galhadas"
                value={formProblem}
                onChange={(e) => setFormProblem(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Secretaria Responsável *
                </label>
                <Select value={formSecretary} onValueChange={setFormSecretary}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SECRETARY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Prioridade Sugerida
                </label>
                <Select value={formPriority} onValueChange={(v: any) => setFormPriority(v)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="baixa">Baixa</SelectItem>
                    <SelectItem value="media">Média</SelectItem>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="critica">Crítica (Risco Iminente)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Localização / Referência
              </label>
              <Input
                placeholder="Ex: Estrada dos Pintos, km 4, próximo à ponte P189"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Descrição Técnica / Justificativa
              </label>
              <Textarea
                placeholder="Descreva a situação observada pela Defesa Civil, risco associado e necessidade de intervenção..."
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Status Inicial</label>
                <Select value={formStatus} onValueChange={(v: any) => setFormStatus(v)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="identificada">Identificada (Defesa Civil)</SelectItem>
                    <SelectItem value="encaminhada">Encaminhada ao Órgão</SelectItem>
                    <SelectItem value="em_acompanhamento">Em Acompanhamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Número do Ofício (se houver)
                </label>
                <Input
                  placeholder="Ex: OF-2026-00012"
                  value={formOfficialDoc}
                  onChange={(e) => setFormOfficialDoc(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Vincular Ocorrência (Opcional)
                </label>
                <Select value={formLinkedOcc} onValueChange={setFormLinkedOcc}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Nenhuma ocorrência" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {occurrences.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.code} - {o.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Vincular Ponte/Aduela (Opcional)
                </label>
                <Select value={formLinkedInfra} onValueChange={setFormLinkedInfra}>
                  <SelectTrigger className="text-xs">
                    <SelectValue placeholder="Nenhuma infraestrutura" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {infrastructures.map((inf) => (
                      <SelectItem key={inf.id} value={inf.id}>
                        {inf.original_code} - {inf.neighborhood || 'Sem bairro'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmitting ? 'Salvando...' : 'Salvar Demanda'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Acompanhamento & Histórico */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedDemand && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-base font-bold">
                    Demanda: {selectedDemand.problem_identified}
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className={STATUS_CONFIG[selectedDemand.forwarding_status]?.badgeClass}
                  >
                    {STATUS_CONFIG[selectedDemand.forwarding_status]?.label}
                  </Badge>
                </div>
                <DialogDescription className="text-xs">
                  Órgão responsável:{' '}
                  {SECRETARY_LABELS[selectedDemand.responsible_secretary] ||
                    selectedDemand.responsible_secretary}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Status Updater */}
                <div className="p-3 bg-slate-50 rounded-lg border space-y-2">
                  <p className="font-bold text-slate-800">Alterar Status da Demanda:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(STATUS_CONFIG).map(([stKey, stVal]) => (
                      <Button
                        key={stKey}
                        size="sm"
                        variant={selectedDemand.forwarding_status === stKey ? 'default' : 'outline'}
                        onClick={() => handleUpdateStatus(stKey as any)}
                        className="text-xs h-8"
                      >
                        {stVal.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Dados da Demanda */}
                <div className="grid grid-cols-2 gap-3 p-3 bg-white rounded-lg border">
                  <div>
                    <span className="text-slate-500 block">Localização:</span>
                    <strong className="text-slate-800">
                      {selectedDemand.location_text || '-'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Ofício Relacionado:</span>
                    <strong className="text-blue-700">
                      {selectedDemand.official_document_ref || 'Não emitido'}
                    </strong>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Descrição Técnica:</span>
                    <p className="text-slate-700 mt-0.5">
                      {selectedDemand.technical_description || 'Sem descrição.'}
                    </p>
                  </div>
                </div>

                {/* Histórico de Acompanhamento */}
                <div className="space-y-2">
                  <p className="font-bold text-slate-800">Histórico de Acompanhamento:</p>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {Array.isArray(selectedDemand.followup_notes) &&
                    selectedDemand.followup_notes.length > 0 ? (
                      selectedDemand.followup_notes.map((fn: any, idx: number) => (
                        <div key={idx} className="p-2.5 bg-slate-50 rounded border text-slate-700">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                            <span>{fn.author || 'Usuário'}</span>
                            <span>{new Date(fn.date).toLocaleString('pt-BR')}</span>
                          </div>
                          <p>{fn.note}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 italic">Nenhum despacho ou nota registrado.</p>
                    )}
                  </div>

                  {/* Campo Nova Nota */}
                  <div className="pt-2 flex gap-2">
                    <Input
                      placeholder="Adicionar nota de acompanhamento / resposta do órgão..."
                      value={followupNote}
                      onChange={(e) => setFollowupNote(e.target.value)}
                      className="text-xs h-9"
                    />
                    <Button size="sm" onClick={handleAddFollowup} className="h-9 text-xs">
                      Adicionar
                    </Button>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
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
export default InteragencyDemandsPage
