import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  MessageSquare,
  Send,
  Bot,
  Settings,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Search,
  ExternalLink,
  Info,
  Copy,
  Check,
  Phone,
  ShieldAlert,
  Flame,
  Waves,
  Mountain,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/hooks/use-toast'
import { useRealtime } from '@/hooks/use-realtime'
import { whatsappService, appSettingsService, occurrencesService } from '@/services/defesa-civil'
import type { WhatsAppMessage, WhatsAppConfigInfo, Occurrence } from '@/types/defesa-civil'

interface ConversationSummary {
  phoneNumber: string
  lastMessage: WhatsAppMessage
  unreadCount: number
  totalCount: number
}

export const WhatsAppPage: React.FC = () => {
  const { toast } = useToast()

  // State
  const [messages, setMessages] = useState<WhatsAppMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'conversas' | 'configuracoes'>('conversas')

  // Config State
  const [config, setConfig] = useState<WhatsAppConfigInfo | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(true)
  const [savingAiToggle, setSavingAiToggle] = useState(false)
  const [copiedWebhook, setCopiedWebhook] = useState(false)

  // Critical occurrences state to link manually if needed
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [selectedOccurrenceId, setSelectedOccurrenceId] = useState<string>('')

  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load WhatsApp messages
  const loadMessages = async () => {
    try {
      const msgs = await whatsappService.listMessages()
      setMessages(msgs)
    } catch (err) {
      console.error('Erro ao carregar mensagens do WhatsApp:', err)
    } finally {
      setLoading(false)
    }
  }

  // Load WhatsApp backend configuration
  const loadConfig = async () => {
    setLoadingConfig(true)
    try {
      const cfg = await whatsappService.getConfig()
      setConfig(cfg)
    } catch (err) {
      console.error('Erro ao buscar configuração Twilio:', err)
    } finally {
      setLoadingConfig(false)
    }
  }

  // Load AI auto reply toggle setting
  const loadAiSetting = async () => {
    try {
      const val = await appSettingsService.get('whatsapp_ai_auto_reply', 'true')
      setAiEnabled(val === 'true')
    } catch (err) {
      console.error('Erro ao carregar configuração de IA:', err)
    }
  }

  // Load active occurrences
  const loadOccurrences = async () => {
    try {
      const list = await occurrencesService.list('status != "concluida" && status != "cancelada"')
      setOccurrences(list)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadMessages()
    loadConfig()
    loadAiSetting()
    loadOccurrences()
  }, [])

  // Listen to realtime updates on whatsapp_messages
  useRealtime<WhatsAppMessage>('whatsapp_messages', () => {
    loadMessages()
  })

  // Auto-scroll chat window
  useEffect(() => {
    if (selectedNumber && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, selectedNumber])

  // Group messages by contact phone number
  const conversations = useMemo(() => {
    const map = new Map<string, WhatsAppMessage[]>()

    // Identify contact number: if incoming, contact is from_number; if outgoing, contact is to_number
    messages.forEach((msg) => {
      const contact = msg.direction === 'incoming' ? msg.from_number : msg.to_number
      if (!contact) return
      const existing = map.get(contact) || []
      existing.push(msg)
      map.set(contact, existing)
    })

    const summaries: ConversationSummary[] = []
    map.forEach((chatMsgs, contact) => {
      // sort chronologically descending to find latest
      chatMsgs.sort(
        (a, b) => new Date(b.created || '').getTime() - new Date(a.created || '').getTime(),
      )
      const last = chatMsgs[0]
      summaries.push({
        phoneNumber: contact,
        lastMessage: last,
        unreadCount: chatMsgs.filter((m) => m.direction === 'incoming' && m.status === 'received')
          .length,
        totalCount: chatMsgs.length,
      })
    })

    // Sort conversations by last message timestamp desc
    summaries.sort((a, b) => {
      const tA = new Date(a.lastMessage.created || '').getTime()
      const tB = new Date(b.lastMessage.created || '').getTime()
      return tB - tA
    })

    return summaries
  }, [messages])

  // Filter conversations by search
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations
    const q = searchQuery.toLowerCase().trim()
    return conversations.filter(
      (c) =>
        c.phoneNumber.toLowerCase().includes(q) ||
        (c.lastMessage.body && c.lastMessage.body.toLowerCase().includes(q)),
    )
  }, [conversations, searchQuery])

  // Current conversation messages (chronological order)
  const currentChatMessages = useMemo(() => {
    if (!selectedNumber) return []
    const cleanSelected = selectedNumber.replace(/\D/g, '')
    return messages
      .filter((m) => {
        const fromClean = m.from_number.replace(/\D/g, '')
        const toClean = m.to_number.replace(/\D/g, '')
        return fromClean === cleanSelected || toClean === cleanSelected
      })
      .sort((a, b) => new Date(a.created || '').getTime() - new Date(b.created || '').getTime())
  }, [messages, selectedNumber])

  // Set default selected conversation if none selected
  useEffect(() => {
    if (!selectedNumber && conversations.length > 0) {
      setSelectedNumber(conversations[0].phoneNumber)
    }
  }, [conversations, selectedNumber])

  // Handle manual reply send
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!selectedNumber || !replyText.trim() || sending) return

    setSending(true)
    try {
      const res = await whatsappService.sendMessage({
        to: selectedNumber,
        message: replyText.trim(),
        occurrence_id: selectedOccurrenceId || undefined,
      })

      if (res.success) {
        toast({
          title: 'Mensagem enviada com sucesso',
          description: `Disparada via Twilio para ${selectedNumber}.`,
        })
      } else if (res.warning) {
        toast({
          title: 'Registrado em rascunho',
          description: res.warning,
          variant: 'default',
        })
      } else {
        toast({
          title: 'Falha no envio',
          description: res.error || 'Não foi possível entregar a mensagem.',
          variant: 'destructive',
        })
      }

      setReplyText('')
      await loadMessages()
    } catch (err) {
      toast({
        title: 'Erro ao enviar mensagem',
        description: String(err),
        variant: 'destructive',
      })
    } finally {
      setSending(false)
    }
  }

  // Handle AI Auto-reply Toggle
  const handleToggleAi = async (checked: boolean) => {
    setSavingAiToggle(true)
    try {
      await appSettingsService.set(
        'whatsapp_ai_auto_reply',
        checked ? 'true' : 'false',
        'Atendimento automático por IA no WhatsApp',
      )
      setAiEnabled(checked)
      toast({
        title: checked ? 'Atendimento por IA ativado' : 'Atendimento por IA desativado',
        description: checked
          ? 'Mensagens entrantes receberão orientações da Defesa Civil automaticamente.'
          : 'Respostas automáticas suspensas. Atendimento apenas manual.',
      })
    } catch {
      toast({
        title: 'Erro ao salvar preferência',
        variant: 'destructive',
      })
    } finally {
      setSavingAiToggle(false)
    }
  }

  const handleCopyWebhook = () => {
    if (!config?.webhook_url) return
    navigator.clipboard.writeText(config.webhook_url)
    setCopiedWebhook(true)
    toast({
      title: 'URL copiada!',
      description: 'Cole esta URL no painel do Twilio Console na configuração do WhatsApp Sandbox.',
    })
    setTimeout(() => setCopiedWebhook(false), 3000)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/10 text-emerald-600 flex items-center justify-center font-bold">
              <MessageSquare className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Central de WhatsApp
              </h1>
              <p className="text-xs text-slate-500">
                Comunicação direta com a população integrada com Twilio e Atendimento Inteligente da
                Defesa Civil
              </p>
            </div>
          </div>
        </div>

        {/* Action / Tabs buttons */}
        <div className="flex items-center gap-3">
          {/* Twilio Status Badge */}
          {config?.configured ? (
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold flex items-center gap-1.5 px-3 py-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Twilio Conectado ({config.whatsapp_number})
            </Badge>
          ) : (
            <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-xs font-semibold flex items-center gap-1.5 px-3 py-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Twilio com credenciais pendentes
            </Badge>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadMessages()
              loadConfig()
            }}
            className="text-xs text-slate-600"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Tabs navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as 'conversas' | 'configuracoes')}
        className="w-full"
      >
        <TabsList className="bg-slate-200/80 p-1 mb-4">
          <TabsTrigger value="conversas" className="flex items-center gap-2 text-xs font-medium">
            <MessageSquare className="w-4 h-4" />
            Inbox de Conversas
            {conversations.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-blue-600 text-white font-bold">
                {conversations.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="configuracoes"
            className="flex items-center gap-2 text-xs font-medium"
          >
            <Settings className="w-4 h-4" />
            Configuração & Twilio
            {!config?.configured && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-1" />
            )}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Conversas Inbox */}
        <TabsContent value="conversas" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-270px)] min-h-[550px]">
            {/* Left Column: Conversations List */}
            <Card className="lg:col-span-4 flex flex-col border-slate-200 shadow-sm overflow-hidden">
              <CardHeader className="p-3 border-b border-slate-100 bg-slate-50/70 shrink-0">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Mensagens Recebidas ({conversations.length})
                  </span>
                  {/* AI Quick Indicator */}
                  <div
                    className={`flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      aiEnabled
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                    title={aiEnabled ? 'IA respondendo automaticamente' : 'Auto-resposta desligada'}
                  >
                    <Bot className="w-3 h-3 text-blue-600" />
                    <span>IA {aiEnabled ? 'Ativa' : 'Pausada'}</span>
                  </div>
                </div>

                {/* Search input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    type="text"
                    placeholder="Filtrar por número ou texto..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 text-xs h-8 bg-white border-slate-200"
                  />
                </div>
              </CardHeader>

              {/* List of contacts */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {loading ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2" />
                    Carregando mensagens...
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-600">Nenhuma conversa encontrada</p>
                    <p className="text-[11px] mt-1 text-slate-400">
                      As mensagens enviadas pela população para o WhatsApp configurado aparecerão
                      aqui em tempo real.
                    </p>
                  </div>
                ) : (
                  filteredConversations.map((c) => {
                    const isSelected = selectedNumber === c.phoneNumber
                    const lastMsg = c.lastMessage
                    const isIncoming = lastMsg.direction === 'incoming'
                    const dateStr = lastMsg.created
                      ? new Date(lastMsg.created).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''

                    // Check for emergency keywords in body to show emergency badge
                    const lower = (lastMsg.body || '').toLowerCase()
                    const hasEmergency =
                      lower.includes('socorro') ||
                      lower.includes('enchente') ||
                      lower.includes('deslizamento') ||
                      lower.includes('fogo') ||
                      lower.includes('emergencia') ||
                      lower.includes('emergência')

                    return (
                      <button
                        key={c.phoneNumber}
                        onClick={() => setSelectedNumber(c.phoneNumber)}
                        className={`w-full text-left p-3 transition-colors flex items-start gap-3 hover:bg-slate-50 ${
                          isSelected ? 'bg-blue-50/70 border-l-4 border-blue-600' : ''
                        }`}
                      >
                        <Avatar className="w-9 h-9 shrink-0 bg-slate-800 text-white font-bold text-xs mt-0.5">
                          <AvatarFallback className="bg-slate-800 text-slate-200">
                            <Phone className="w-4 h-4 text-emerald-400" />
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-semibold text-xs text-slate-800 truncate">
                              {c.phoneNumber}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                              {dateStr}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 truncate leading-snug">
                            {isIncoming ? '' : 'Você: '}
                            {lastMsg.body}
                          </p>

                          {/* Badges row */}
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {hasEmergency && (
                              <Badge className="bg-red-100 text-red-700 hover:bg-red-200 text-[9px] font-bold px-1.5 py-0 h-4 flex items-center gap-1">
                                <Flame className="w-2.5 h-2.5 text-red-600" />
                                Emergência
                              </Badge>
                            )}
                            {lastMsg.expand?.occurrence && (
                              <Badge className="bg-amber-100 text-amber-800 text-[9px] px-1.5 py-0 h-4">
                                Ocorrência #{lastMsg.expand.occurrence.id.slice(0, 5)}
                              </Badge>
                            )}
                            {lastMsg.status === 'failed' && (
                              <Badge className="bg-red-50 text-red-600 border border-red-200 text-[9px] px-1 py-0 h-4">
                                Falha no envio
                              </Badge>
                            )}
                            {lastMsg.status === 'draft' && (
                              <Badge className="bg-slate-100 text-slate-600 text-[9px] px-1 py-0 h-4">
                                Rascunho
                              </Badge>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </Card>

            {/* Right Column: Active Conversation Chat Window */}
            <Card className="lg:col-span-8 flex flex-col border-slate-200 shadow-sm overflow-hidden">
              {selectedNumber ? (
                <>
                  {/* Chat Header */}
                  <CardHeader className="p-3 border-b border-slate-200 bg-white shrink-0 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-9 h-9 bg-emerald-700 text-white">
                        <AvatarFallback className="bg-emerald-600 text-white font-bold text-xs">
                          WA
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-800 leading-tight">
                            {selectedNumber}
                          </h3>
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-slate-50 text-slate-600 py-0 h-4"
                          >
                            Cidadão
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Canal WhatsApp da Defesa Civil Municipal
                        </p>
                      </div>
                    </div>

                    {/* Link to Occurrence Selector */}
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedOccurrenceId}
                        onChange={(e) => setSelectedOccurrenceId(e.target.value)}
                        className="text-[11px] h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-slate-700 focus:bg-white focus:outline-none"
                      >
                        <option value="">Vincular a ocorrência (opcional)...</option>
                        {occurrences.map((occ) => (
                          <option key={occ.id} value={occ.id}>
                            #{occ.id.slice(0, 5)} - {occ.title} ({occ.severity})
                          </option>
                        ))}
                      </select>
                    </div>
                  </CardHeader>

                  {/* Chat Messages Body */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f8fafc]">
                    {currentChatMessages.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs">
                        <Clock className="w-8 h-8 text-slate-300 mb-2" />
                        <p>Nenhuma mensagem nesta conversa.</p>
                      </div>
                    ) : (
                      currentChatMessages.map((msg) => {
                        const isIncoming = msg.direction === 'incoming'
                        const isAi =
                          !isIncoming &&
                          (msg.body.includes('Defesa Civil') || msg.body.includes('199'))
                        const timeStr = msg.created
                          ? new Date(msg.created).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''

                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isIncoming ? 'items-start' : 'items-end'}`}
                          >
                            <div
                              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-sm relative ${
                                isIncoming
                                  ? 'bg-white text-slate-800 border border-slate-200 rounded-tl-sm'
                                  : 'bg-blue-600 text-white rounded-tr-sm shadow-blue-500/10'
                              }`}
                            >
                              {/* Header inside bubble */}
                              <div className="flex items-center justify-between gap-3 text-[10px] mb-1 opacity-75 font-medium">
                                <span className="flex items-center gap-1">
                                  {isIncoming ? (
                                    <>
                                      <span>Cidadão</span>
                                      <span className="text-slate-400">({msg.from_number})</span>
                                    </>
                                  ) : (
                                    <>
                                      <Bot className="w-3 h-3 text-blue-200" />
                                      <span>Operador / IA Defesa Civil</span>
                                    </>
                                  )}
                                </span>
                                <span>{timeStr}</span>
                              </div>

                              {/* Message text with breaks */}
                              <p className="whitespace-pre-wrap leading-relaxed font-normal">
                                {msg.body}
                              </p>

                              {/* Footer status for outgoing messages */}
                              {!isIncoming && (
                                <div className="flex items-center justify-end gap-1 mt-1 text-[10px] opacity-80">
                                  {msg.status === 'sent' && (
                                    <span className="flex items-center gap-0.5 text-emerald-200">
                                      <Check className="w-3 h-3" /> Enviada (Twilio)
                                    </span>
                                  )}
                                  {msg.status === 'failed' && (
                                    <span
                                      className="flex items-center gap-0.5 text-red-200"
                                      title={msg.error}
                                    >
                                      <XCircle className="w-3 h-3" /> Falha: {msg.error}
                                    </span>
                                  )}
                                  {msg.status === 'draft' && (
                                    <span
                                      className="flex items-center gap-0.5 text-amber-200"
                                      title={msg.error}
                                    >
                                      <Clock className="w-3 h-3" /> Rascunho (Sem credenciais)
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Occurrence badge if linked */}
                            {msg.expand?.occurrence && (
                              <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <ShieldAlert className="w-3 h-3" />
                                <span>Ocorrência vinculada: {msg.expand.occurrence.title}</span>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Reply Input Bar */}
                  <div className="p-3 border-t border-slate-200 bg-white shrink-0">
                    <form onSubmit={handleSendMessage} className="space-y-2">
                      <div className="flex gap-2">
                        <Textarea
                          placeholder={`Responder manualmente para ${selectedNumber}... (Pressione Enter para enviar)`}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleSendMessage()
                            }
                          }}
                          className="min-h-[60px] max-h-[120px] text-xs resize-none bg-slate-50 border-slate-200 focus:bg-white"
                        />
                        <Button
                          type="submit"
                          disabled={sending || !replyText.trim()}
                          className="self-end bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 h-10 shadow-sm"
                        >
                          {sending ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </Button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                        <span className="flex items-center gap-1 text-slate-400">
                          <Info className="w-3.5 h-3.5" />
                          Disparo pelo número da Defesa Civil (
                          {config?.whatsapp_number || '+14155238886'})
                        </span>
                        <span>{replyText.length} caracteres</span>
                      </div>
                    </form>
                  </div>
                </>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                  <MessageSquare className="w-12 h-12 text-slate-300 mb-3" />
                  <p className="font-semibold text-sm text-slate-700">
                    Nenhuma conversa selecionada
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    Selecione um número na coluna ao lado para visualizar o histórico de mensagens e
                    responder ao munícipe.
                  </p>
                </div>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Configuração e Twilio Setup */}
        <TabsContent value="configuracoes" className="mt-0 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Card: Status do Twilio */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-blue-600" />
                  Credenciais Twilio WhatsApp
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Estado atual da integração para envio e recebimento de mensagens no canal
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 text-xs">
                {/* Status Alert Banner */}
                {config?.configured ? (
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-800 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Twilio totalmente configurado</p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        As mensagens reais enviadas pelo painel e respostas automáticas da IA serão
                        entregues via WhatsApp.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-800 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Credenciais em modo Placeholder</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        O backend registrou os placeholders. O envio real ao WhatsApp requer
                        configurar as credenciais definitivas da sua conta Twilio.
                      </p>
                    </div>
                  </div>
                )}

                {/* Field Check Table */}
                <div className="space-y-2 border border-slate-100 rounded-lg p-3 bg-slate-50">
                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                    <span className="font-medium text-slate-600">TWILIO_ACCOUNT_SID:</span>
                    <span className="font-mono text-slate-800">
                      {config?.account_sid_configured ? (
                        <span className="text-emerald-700 font-semibold">
                          Configurado ({config.account_sid_masked})
                        </span>
                      ) : (
                        <span className="text-amber-600 font-semibold">Placeholder / Ausente</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                    <span className="font-medium text-slate-600">TWILIO_AUTH_TOKEN:</span>
                    <span className="font-mono text-slate-800">
                      {config?.auth_token_configured ? (
                        <span className="text-emerald-700 font-semibold">Configurado (***)</span>
                      ) : (
                        <span className="text-amber-600 font-semibold">Placeholder / Ausente</span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="font-medium text-slate-600">TWILIO_WHATSAPP_NUMBER:</span>
                    <span className="font-mono text-slate-800 font-semibold">
                      {config?.whatsapp_number || '+14155238886'}
                    </span>
                  </div>
                </div>

                {/* Instructions */}
                <div className="p-3 bg-slate-100 rounded-lg text-slate-700 space-y-1.5">
                  <p className="font-bold text-slate-800">
                    Como conectar o WhatsApp da sua cidade:
                  </p>
                  <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-600">
                    <li>
                      Acesse o console do{' '}
                      <a
                        href="https://console.twilio.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline font-semibold inline-flex items-center gap-0.5"
                      >
                        Twilio <ExternalLink className="w-2.5 h-2.5" />
                      </a>{' '}
                      e copie o <strong>Account SID</strong> e o <strong>Auth Token</strong>.
                    </li>
                    <li>
                      No Twilio Console, abra{' '}
                      <strong>Messaging → Try it out → Send a WhatsApp message</strong> (WhatsApp
                      Sandbox) ou solicite o número oficial do órgão.
                    </li>
                    <li>
                      Configure as variáveis de ambiente <code>TWILIO_ACCOUNT_SID</code>,{' '}
                      <code>TWILIO_AUTH_TOKEN</code> e <code>TWILIO_WHATSAPP_NUMBER</code>.
                    </li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            {/* Card: Webhook & AI Automation */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-emerald-600" />
                  Atendimento Automático por IA & Webhook
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  Regras de atendimento inteligente e URL de recebimento de mensagens
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-5 text-xs">
                {/* AI Toggle Switch */}
                <div className="flex items-center justify-between p-3.5 bg-blue-50/60 rounded-xl border border-blue-200">
                  <div className="space-y-0.5 pr-4">
                    <label
                      htmlFor="ai-toggle"
                      className="font-bold text-slate-900 text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Bot className="w-4 h-4 text-blue-600" />
                      Atendimento Automático por IA
                    </label>
                    <p className="text-[11px] text-slate-600 leading-normal">
                      Quando ativado, o agente da Defesa Civil responde ao munícipe no WhatsApp com
                      contexto de abrigos abertos, alertas recentes e instruções de segurança (máx.
                      800 caracteres).
                    </p>
                  </div>
                  <Switch
                    id="ai-toggle"
                    checked={aiEnabled}
                    disabled={savingAiToggle}
                    onCheckedChange={handleToggleAi}
                  />
                </div>

                {/* Webhook URL Section */}
                <div className="space-y-2">
                  <label className="font-bold text-slate-800 text-xs">
                    URL do Webhook (Cole no Console Twilio):
                  </label>
                  <p className="text-[11px] text-slate-500">
                    No Twilio Console em <em>WhatsApp Sandbox Settings</em> ou no seu número
                    aprovado, cole esta URL no campo <strong>WHEN A MESSAGE COMES IN</strong>{' '}
                    (Método HTTP POST):
                  </p>

                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={config?.webhook_url || '/wa/webhook'}
                      className="font-mono text-xs bg-slate-50 border-slate-300 text-slate-800"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCopyWebhook}
                      className="shrink-0 flex items-center gap-1 text-xs"
                    >
                      {copiedWebhook ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar URL
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Emergency Protocol Box */}
                <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-slate-800 space-y-1">
                  <h5 className="font-bold text-red-900 flex items-center gap-1.5 text-xs">
                    <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                    Detecção Automática de Emergências Críticas
                  </h5>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Mensagens com termos como{' '}
                    <em>socorro, enchente, deslizamento, incêndio, preso</em> disparam imediatamente
                    duas ações no sistema:
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-slate-600 pt-1">
                    <li>
                      Criação automática de uma <strong>Ocorrência Crítica</strong> no painel de
                      monitoramento da Defesa Civil.
                    </li>
                    <li>
                      Resposta de prioridade orientando o munícipe a ligar para o{' '}
                      <strong>193</strong> (Bombeiros) ou <strong>199</strong> (Defesa Civil) e
                      evacuar para área segura.
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
export default WhatsAppPage
