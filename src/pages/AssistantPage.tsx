import React, { useState, useEffect, useRef } from 'react'
import {
  Bot,
  Send,
  Plus,
  ShieldAlert,
  Sparkles,
  BookOpen,
  HelpCircle,
  Radio,
  FileText,
  Building2,
  Users,
  Package,
  Layers,
  ChevronRight,
  RefreshCw,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useAuth } from '@/contexts/AuthContext'
import { streamAgentChat } from '@/lib/skipAi'
import { useToast } from '@/hooks/use-toast'
import pb from '@/lib/pocketbase/client'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  created?: string
}

export const AssistantPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Olá, Operador! Sou o **Assistente Inteligente da Defesa Civil**. Estou conectado ao banco de dados em tempo real (ocorrências, abrigos, equipes, suprimentos e alertas) e carregado com protocolos operacionais do El Niño (inundações, deslizamentos, secas e vendavais).\n\nComo posso apoiar a operação hoje?',
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isStreaming])

  // Start a new conversation
  const handleNewChat = () => {
    setConversationId(null)
    setMessages([
      {
        id: 'welcome-' + Date.now(),
        role: 'assistant',
        content:
          'Nova sessão operacional iniciada. Como posso ajudar com os protocolos ou alocação de recursos?',
      },
    ])
  }

  // Quick preset questions
  const handlePresetQuestion = (q: string) => {
    setInputValue(q)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isStreaming) return

    const userText = inputValue.trim()
    setInputValue('')

    const userMsgId = 'user-' + Date.now()
    const assistantMsgId = 'assistant-' + (Date.now() + 1)

    // Append user message
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: 'user', content: userText },
      { id: assistantMsgId, role: 'assistant', content: '' },
    ])

    setIsStreaming(true)

    try {
      let accumulatedText = ''

      const res = await fetch(pb.buildUrl('/backend/v1/ask-stream'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: pb.authStore.token ? `Bearer ${pb.authStore.token}` : '',
        },
        body: JSON.stringify({
          message: userText,
          conversation_id: conversationId || undefined,
        }),
      })

      if (!res.ok) {
        throw new Error(`Erro na comunicação com agente (HTTP ${res.status})`)
      }

      if (res.body) {
        const streamResult = await streamAgentChat(res.body, {
          onDelta: (delta) => {
            accumulatedText += delta
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, content: accumulatedText } : msg
              )
            )
          },
        })

        if (streamResult.conversation_id) {
          setConversationId(streamResult.conversation_id)
        }
      }    } catch (err: any) {
      console.error('Erro no streaming do agente:', err)
      toast({
        variant: 'destructive',
        title: 'Erro na resposta da IA',
        description: err.message || 'Falha de comunicação com o assistente.',
      })
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? {
                ...msg,
                content:
                  msg.content ||
                  'Desculpe, ocorreu uma instabilidade momentânea na conexão com o Assistente da Defesa Civil. Por favor, tente novamente.',
              }
            : msg,
        ),
      )
    } finally {
      setIsStreaming(false)
    }
  }

  return (
    <div className="h-[calc(100vh-8.5rem)] flex flex-col lg:flex-row gap-4 animate-fade-in">
      {/* Left / Main Chat Area */}
      <Card className="flex-1 flex flex-col bg-white border-slate-200 shadow-sm overflow-hidden">
        {/* Chat Header */}
        <CardHeader className="py-3 px-5 border-b border-slate-200 bg-slate-50/90 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-800 text-white flex items-center justify-center shadow-md ring-2 ring-blue-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-bold text-slate-900">
                  Assistente da Defesa Civil
                </CardTitle>
                <Badge className="bg-blue-600 text-[10px] text-white">IA Fast Agent</Badge>
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Consultando dados e protocolos em tempo real</span>
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleNewChat}
            className="text-xs h-8 bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Novo Chat
          </Button>
        </CardHeader>

        {/* Message List */}
        <CardContent className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-gradient-to-b from-slate-50/40 to-white">
          {messages.map((msg) => {
            const isUser = msg.role === 'user'

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${
                  isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
                }`}
              >
                {/* Avatar */}
                <Avatar className="w-8 h-8 shrink-0 mt-0.5 ring-1 ring-slate-200">
                  {isUser ? (
                    <AvatarFallback className="bg-slate-800 text-white text-xs font-bold">
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  ) : (
                    <AvatarFallback className="bg-gradient-to-tr from-blue-700 to-indigo-800 text-white text-xs font-bold">
                      <Bot className="w-4 h-4" />
                    </AvatarFallback>
                  )}
                </Avatar>

                {/* Message Bubble */}
                <div
                  className={`rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-xs transition-all ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                  }`}
                >
                  <div className="whitespace-pre-wrap font-sans">
                    {msg.content || (
                      <span className="flex items-center gap-1.5 text-slate-400 py-1">
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce" />
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]" />
                        <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          <div ref={messagesEndRef} />
        </CardContent>

        {/* Preset quick actions row */}
        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50/60 overflow-x-auto flex gap-2 no-scrollbar">
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              handlePresetQuestion(
                'Quais são os protocolos para evacuação imediata em encostas com risco de deslizamento?',
              )
            }
            className="h-7 text-[11px] bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700 shrink-0 rounded-full"
          >
            Protocolo Deslizamentos
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              handlePresetQuestion(
                'Qual o checklist de suprimentos essenciais por pessoa para novos abrigos abertos?',
              )
            }
            className="h-7 text-[11px] bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700 shrink-0 rounded-full"
          >
            Checklist de Abrigo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              handlePresetQuestion(
                'Como redigir um alerta urgente de enchente no canal SMS da Defesa Civil?',
              )
            }
            className="h-7 text-[11px] bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700 shrink-0 rounded-full"
          >
            Redação de Alerta SMS
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              handlePresetQuestion(
                'Consulte as ocorrências críticas ativas no sistema e me dê um resumo tático.',
              )
            }
            className="h-7 text-[11px] bg-white border border-slate-200 text-slate-700 hover:bg-blue-50 hover:text-blue-700 shrink-0 rounded-full"
          >
            Resumo de Ocorrências
          </Button>
        </div>

        {/* Input Bar */}
        <form
          onSubmit={handleSubmit}
          className="p-3 sm:p-4 border-t border-slate-200 bg-white flex items-center gap-2"
        >
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isStreaming}
            placeholder="Pergunte sobre protocolos El Niño, ocorrências ou solicite redação..."
            className="flex-1 h-10 text-xs rounded-xl bg-slate-50 focus:bg-white border-slate-200"
          />
          <Button
            type="submit"
            disabled={isStreaming || !inputValue.trim()}
            className="h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </Card>

      {/* Right Knowledge / Protocol Sidebar */}
      <Card className="hidden lg:flex flex-col w-80 bg-white border-slate-200 shadow-sm overflow-hidden shrink-0">
        <CardHeader className="py-3 px-4 border-b border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <CardTitle className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Fontes de Protocolo & Memória
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4 text-xs overflow-y-auto flex-1">
          {/* Box 1: Enchentes */}
          <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 space-y-1">
            <h5 className="font-bold text-blue-900 flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-blue-600" /> Protocolo de Inundações
            </h5>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Critérios de acionamento de sirenes telemétricas (&gt; 30mm/h) e evacuação prioritária
              de idosos e crianças.
            </p>
          </div>

          {/* Box 2: Deslizamentos */}
          <div className="p-3 bg-amber-50/60 rounded-lg border border-amber-100 space-y-1">
            <h5 className="font-bold text-amber-900 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-600" /> Protocolo de Encostas
            </h5>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Limiar de 100mm/72h para interdição e sinais de trincas estruturais em moradias.
            </p>
          </div>

          {/* Box 3: Abrigos */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <h5 className="font-bold text-slate-800 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-slate-600" /> Checklist de Alojamento
            </h5>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Espaço mínimo de 3,5m²/pessoa, 3L de água potável por dia e triagem sanitária nominal.
            </p>
          </div>

          {/* FAQ quick links */}
          <div className="pt-2 border-t border-slate-100 space-y-2">
            <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wide">
              Perguntas Frequentes
            </span>
            <button
              onClick={() =>
                handlePresetQuestion('Quando deve ser ordenada a evacuação preventiva de uma área?')
              }
              className="text-left text-[11px] text-blue-600 hover:text-blue-800 hover:underline block leading-tight"
            >
              • Quando evacuar preventivamente?
            </button>
            <button
              onClick={() =>
                handlePresetQuestion('O que fazer quando a ocupação do abrigo ultrapassa 90%?')
              }
              className="text-left text-[11px] text-blue-600 hover:text-blue-800 hover:underline block leading-tight"
            >
              • O que fazer se o abrigo atingir 90%?
            </button>
            <button
              onClick={() =>
                handlePresetQuestion('Quais são os telefones de emergência padrão do sistema?')
              }
              className="text-left text-[11px] text-blue-600 hover:text-blue-800 hover:underline block leading-tight"
            >
              • Telefones oficiais de resgate
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
