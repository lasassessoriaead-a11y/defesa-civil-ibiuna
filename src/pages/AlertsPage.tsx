import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Bell,
  Plus,
  Search,
  Sparkles,
  Send,
  Calendar,
  Radio,
  Share2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Layers,
  Edit2,
  Trash2,
  Volume2,
  MessageSquare,
  Smartphone,
  Globe,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { SeverityBadge, getHazardIcon } from '@/components/defesa-civil/StatusBadges'
import { alertsService, occurrencesService, getErrorMessage } from '@/services/defesa-civil'
import type {
  Alert,
  AlertChannel,
  AlertSeverity,
  AlertStatus,
  AlertType,
  Occurrence,
} from '@/types/defesa-civil'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

const CHANNEL_LABELS: Record<AlertChannel, { label: string; icon: React.ElementType }> = {
  todos: { label: 'Todos os Canais (Multidifusão)', icon: Globe },
  sms: { label: 'SMS Emergencial (Celulares)', icon: Smartphone },
  whatsapp: { label: 'WhatsApp Oficial da Defesa Civil', icon: MessageSquare },
  sirene: { label: 'Sirenes Comunitárias Teleguiadas', icon: Volume2 },
  redes_sociais: { label: 'Redes Sociais & Portal Municipal', icon: Share2 },
}

export const AlertsPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isGeneratingAi, setIsGeneratingAi] = useState(false)

  // Filters
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')

  // Modals
  const [isComposerOpen, setIsComposerOpen] = useState(false)
  const [isConfirmSendOpen, setIsConfirmSendOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null)

  // Composer Form
  const [formData, setFormData] = useState<Partial<Alert>>({
    title: '',
    type: 'enchente',
    severity: 'perigo',
    target_area: '',
    channel: 'todos',
    status: 'rascunho',
    message: '',
    scheduled_at: '',
    related_occurrence: '',
  })

  const loadData = async () => {
    try {
      const [alertData, occData] = await Promise.all([
        alertsService.list(),
        occurrencesService.list(),
      ])
      setAlerts(alertData)
      setOccurrences(occData)

      // Handle prefill from query params (e.g. from Occurrence)
      if (searchParams.get('new') === 'true') {
        const type = (searchParams.get('type') as AlertType) || 'enchente'
        const severity = (searchParams.get('severity') as AlertSeverity) || 'alerta'
        const target = searchParams.get('target') || ''
        const title = searchParams.get('title') || ''
        const related = searchParams.get('related') || ''

        setFormData({
          title: title ? `Alerta: ${title}` : '',
          type,
          severity,
          target_area: target,
          channel: 'todos',
          status: 'rascunho',
          message: '',
          related_occurrence: related,
        })
        setIsComposerOpen(true)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime<Alert>('alerts', () => loadData())

  const openComposer = () => {
    setSelectedAlert(null)
    setFormData({
      title: '',
      type: 'enchente',
      severity: 'perigo',
      target_area: 'Bairro Centro e Adjacências',
      channel: 'todos',
      status: 'rascunho',
      message: '',
      scheduled_at: '',
      related_occurrence: '',
    })
    setIsComposerOpen(true)
  }

  const openEdit = (alt: Alert) => {
    setSelectedAlert(alt)
    setFormData({ ...alt })
    setIsComposerOpen(true)
  }

  // AI Draft Generator calling /backend/v1/alerts/draft
  const handleGenerateAiMessage = async () => {
    setIsGeneratingAi(true)
    try {
      const draftResult = await alertsService.generateDraft({
        type: formData.type || 'enchente',
        severity: formData.severity || 'perigo',
        target_area: formData.target_area || 'Município',
        title: formData.title || 'Alerta Meteorológico',
      })
      setFormData((prev) => ({
        ...prev,
        message: draftResult.message,
      }))
      toast({
        title: 'Mensagem Gerada com IA!',
        description: 'Texto profissional formulado de acordo com as normas da Defesa Civil.',
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao gerar mensagem com IA',
        description: getErrorMessage(err),
      })
    } finally {
      setIsGeneratingAi(false)
    }
  }

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title?.trim() || !formData.message?.trim()) {
      toast({ variant: 'destructive', title: 'Título e Mensagem são obrigatórios' })
      return
    }

    try {
      const payload: Partial<Alert> = {
        ...formData,
        sent_by: user?.id,
      }

      if (selectedAlert) {
        await alertsService.update(selectedAlert.id, payload)
        toast({ title: 'Alerta atualizado com sucesso' })
      } else {
        await alertsService.create(payload)
        toast({ title: 'Rascunho de alerta salvo com sucesso' })
      }
      setIsComposerOpen(false)
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar alerta',
        description: getErrorMessage(err),
      })
    }
  }

  // Trigger send immediately or schedule
  const handleConfirmSend = async () => {
    if (!formData.title?.trim() || !formData.message?.trim()) {
      toast({ variant: 'destructive', title: 'Preencha todos os dados antes de disparar' })
      return
    }

    try {
      const isScheduled = !!formData.scheduled_at
      const payload: Partial<Alert> = {
        ...formData,
        status: isScheduled ? 'agendado' : 'enviado',
        sent_by: user?.id,
      }

      if (selectedAlert) {
        await alertsService.update(selectedAlert.id, payload)
      } else {
        await alertsService.create(payload)
      }

      toast({
        title: isScheduled ? 'Alerta Agendado com Sucesso!' : 'Alerta Transmitido em Massa!',
        description: isScheduled
          ? `Disparo programado para ${new Date(formData.scheduled_at!).toLocaleString('pt-BR')}`
          : `Disparo concluído via canal ${formData.channel?.toUpperCase()}.`,
      })
      setIsConfirmSendOpen(false)
      setIsComposerOpen(false)
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro no disparo de alerta',
        description: getErrorMessage(err),
      })
    }
  }

  const handleDelete = async () => {
    if (!selectedAlert) return
    try {
      await alertsService.delete(selectedAlert.id)
      toast({ title: 'Alerta excluído com sucesso' })
      setIsDeleteOpen(false)
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: getErrorMessage(err),
      })
    }
  }

  const filteredAlerts = alerts.filter((alt) => {
    const matchText =
      !searchText ||
      alt.title.toLowerCase().includes(searchText.toLowerCase()) ||
      alt.message.toLowerCase().includes(searchText.toLowerCase()) ||
      alt.target_area?.toLowerCase().includes(searchText.toLowerCase())

    const matchStatus = statusFilter === 'all' || alt.status === statusFilter
    const matchSeverity = severityFilter === 'all' || alt.severity === severityFilter
    return matchText && matchStatus && matchSeverity
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-600" />
            Central de Comunicação e Emissão de Alertas
          </h2>
          <p className="text-xs text-slate-500">
            Transmissão de avisos à população por SMS, WhatsApp, Sirenes e Redes com redação
            auxiliada por IA.
          </p>
        </div>

        <Button
          onClick={openComposer}
          className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white font-semibold text-xs h-10 px-4 rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Compor Novo Alerta
        </Button>
      </div>

      {/* Search & Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar histórico de alertas por mensagem ou local..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9 h-9 text-xs rounded-lg bg-white"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 text-xs bg-white">
            <SelectValue placeholder="Status do Alerta" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="enviado">Transmitido (Enviado)</SelectItem>
            <SelectItem value="agendado">Agendado</SelectItem>
            <SelectItem value="rascunho">Rascunho</SelectItem>
          </SelectContent>
        </Select>

        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="h-9 text-xs bg-white">
            <SelectValue placeholder="Gravidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Gravidades</SelectItem>
            <SelectItem value="perigo_extremo">Perigo Extremo (Vermelho)</SelectItem>
            <SelectItem value="perigo">Perigo (Laranja)</SelectItem>
            <SelectItem value="alerta">Alerta (Âmbar)</SelectItem>
            <SelectItem value="informativo">Informativo (Verde)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAlerts.map((alt) => {
          const ChannelIcon = CHANNEL_LABELS[alt.channel]?.icon || Globe

          return (
            <Card
              key={alt.id}
              className={`border transition-all duration-200 hover:shadow-md bg-white flex flex-col justify-between ${
                alt.status === 'enviado'
                  ? 'border-emerald-200'
                  : alt.status === 'agendado'
                    ? 'border-blue-200'
                    : 'border-amber-200 bg-amber-50/10'
              }`}
            >
              <CardHeader className="pb-2 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700 shrink-0">
                      {getHazardIcon(alt.type, 'w-4 h-4')}
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900 leading-tight">
                        {alt.title}
                      </CardTitle>
                      <span className="text-[11px] text-slate-500 block">
                        Alvo: {alt.target_area || 'Geral'}
                      </span>
                    </div>
                  </div>
                  <SeverityBadge severity={alt.severity} />
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                {/* Alert message body */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 font-mono text-[11px] text-slate-800 leading-relaxed">
                  {alt.message}
                </div>

                {/* Channel & Status Bar */}
                <div className="flex items-center justify-between text-xs text-slate-600 pt-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <ChannelIcon className="w-3.5 h-3.5 text-blue-600" />
                    <span className="capitalize">{alt.channel}</span>
                  </div>

                  <Badge
                    variant={alt.status === 'enviado' ? 'default' : 'outline'}
                    className={`text-[10px] capitalize font-semibold ${
                      alt.status === 'enviado'
                        ? 'bg-emerald-600 text-white'
                        : alt.status === 'agendado'
                          ? 'bg-blue-600 text-white'
                          : 'border-amber-400 text-amber-700 bg-amber-50'
                    }`}
                  >
                    {alt.status}
                  </Badge>
                </div>

                {alt.status === 'agendado' && alt.scheduled_at && (
                  <p className="text-[10px] text-blue-600 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Programado para: {new Date(alt.scheduled_at).toLocaleString('pt-BR')}
                  </p>
                )}
              </CardContent>

              <CardFooter className="pt-2 pb-3 px-4 border-t border-slate-100 flex items-center justify-between">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEdit(alt)}
                  className="text-xs text-blue-600 hover:text-blue-800 p-0 h-auto font-semibold"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedAlert(alt)
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

      {filteredAlerts.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Bell className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Nenhum alerta cadastrado no histórico.</p>
        </div>
      )}

      {/* Composer Modal */}
      <Dialog open={isComposerOpen} onOpenChange={setIsComposerOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-600" />
              {selectedAlert ? 'Editar Alerta' : 'Compositor de Alerta Emergencial'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Formule a mensagem oficial de emergência e selecione os canais de difusão em massa.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveDraft} className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Título Interno do Alerta *
              </Label>
              <Input
                required
                placeholder="Ex: Alerta de Transbordamento — Bairro Centro"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Tipo de Evento</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as AlertType })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enchente">Enchente</SelectItem>
                    <SelectItem value="deslizamento">Deslizamento</SelectItem>
                    <SelectItem value="seca">Seca</SelectItem>
                    <SelectItem value="tempestade">Tempestade</SelectItem>
                    <SelectItem value="granizo">Granizo</SelectItem>
                    <SelectItem value="incendio_florestal">Incêndio Florestal</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Nível de Severidade</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(v) => setFormData({ ...formData, severity: v as AlertSeverity })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="perigo_extremo">Perigo Extremo (Vermelho)</SelectItem>
                    <SelectItem value="perigo">Perigo (Laranja)</SelectItem>
                    <SelectItem value="alerta">Alerta (Âmbar)</SelectItem>
                    <SelectItem value="informativo">Informativo (Verde)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Área Alvo / Bairros</Label>
                <Input
                  placeholder="Ex: Bacia Central e Morro Verde"
                  value={formData.target_area || ''}
                  onChange={(e) => setFormData({ ...formData, target_area: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Canal de Transmissão</Label>
                <Select
                  value={formData.channel}
                  onValueChange={(v) => setFormData({ ...formData, channel: v as AlertChannel })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Canais (Multidifusão)</SelectItem>
                    <SelectItem value="sms">SMS Emergencial</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp Oficial</SelectItem>
                    <SelectItem value="sirene">Sirenes Teleguiadas</SelectItem>
                    <SelectItem value="redes_sociais">Redes Sociais</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* AI Generator Action Button */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">
                  Mensagem Transmitida à População *
                </Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isGeneratingAi}
                  onClick={handleGenerateAiMessage}
                  className="h-7 text-xs bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 font-bold shadow-xs transition-all"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-indigo-600 animate-spin-slow" />
                  {isGeneratingAi ? 'Redigindo com IA...' : 'Gerar mensagem com IA'}
                </Button>
              </div>

              <Textarea
                required
                rows={4}
                placeholder="DEFESA CIVIL ALERTA: ..."
                value={formData.message || ''}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="text-xs font-mono"
              />
            </div>

            {/* Schedule Option */}
            <div className="space-y-1 pt-1">
              <Label className="text-xs font-semibold text-slate-700">
                Agendamento de Disparo (Opcional - deixe vazio para envio imediato)
              </Label>
              <Input
                type="datetime-local"
                value={formData.scheduled_at || ''}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2 flex flex-col sm:flex-row justify-between gap-2">
              <Button type="submit" variant="outline" size="sm" className="w-full sm:w-auto">
                Salvar como Rascunho
              </Button>

              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsComposerOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIsConfirmSendOpen(true)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {formData.scheduled_at ? 'Agendar Envio' : 'Enviar Agora'}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal Before Sending */}
      <Dialog open={isConfirmSendOpen} onOpenChange={setIsConfirmSendOpen}>
        <DialogContent className="max-w-md bg-white border-amber-300">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-2">
              <Send className="w-6 h-6" />
            </div>
            <DialogTitle className="text-center text-base font-bold text-slate-900">
              Confirmar Transmissão de Alerta
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-600">
              Você está prestes a disparar o alerta para o canal{' '}
              <strong className="text-slate-900 uppercase">{formData.channel}</strong> na área{' '}
              <strong className="text-slate-900">{formData.target_area || 'Geral'}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono text-slate-800">
            {formData.message}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsConfirmSendOpen(false)}>
              Revisar Texto
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmSend}
              className="bg-red-600 hover:bg-red-700 text-white font-bold"
            >
              Confirmar e Transmitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Modal */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Remover Registro de Alerta
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Deseja remover {selectedAlert?.title}?
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
