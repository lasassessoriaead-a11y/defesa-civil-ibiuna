import React, { useState, useEffect } from 'react'
import {
  FileText,
  Plus,
  Search,
  Filter,
  Printer,
  Sparkles,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Copy,
  Building,
  Calendar,
  AlertCircle,
  Check,
  X,
  FileCheck,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  officialDocumentsService,
  docTemplatesService,
  municipalitiesService,
  usersService,
} from '@/services/defesa-civil'
import type {
  OfficialDocument,
  DocTemplate,
  Municipality,
  User,
  DocumentReviewAiResult,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RichEditor } from '@/components/defesa-civil/RichEditor'
import { OfficialDocumentPrintView } from '@/components/defesa-civil/OfficialDocumentPrintView'
import { DocumentStatusBadge } from '@/components/defesa-civil/StatusBadges'

export const OfficialDocumentsPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [documents, setDocuments] = useState<OfficialDocument[]>([])
  const [templates, setTemplates] = useState<DocTemplate[]>([])
  const [usersList, setUsersList] = useState<User[]>([])
  const [currentMunicipality, setCurrentMunicipality] = useState<Municipality | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Filtros
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Modais de Criação/Edição
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState<OfficialDocument | null>(null)

  // Formulário do Documento
  const [formData, setFormData] = useState({
    recipient_name: '',
    recipient_role: '',
    recipient_institution: '',
    recipient_address: '',
    subject: '',
    content: '',
    signatory_user: '',
    signatory_name: '',
    signatory_role: '',
    template: '',
  })
  const [isSaving, setIsSaving] = useState(false)

  // Visualização e Impressão
  const [viewingDoc, setViewingDoc] = useState<OfficialDocument | null>(null)
  const [isPrintOpen, setIsPrintOpen] = useState(false)

  // Modal de Revisão por IA
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<DocumentReviewAiResult | null>(null)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)

  // Templates Modal
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [templateForm, setTemplateForm] = useState({
    title: '',
    category: 'oficio' as const,
    subject: '',
    content: '',
    is_default: false,
  })

  // Carregar dados iniciais
  const loadData = async () => {
    setIsLoading(true)
    try {
      const [docsData, tplsData, usersData] = await Promise.all([
        officialDocumentsService.list(),
        docTemplatesService.list(),
        usersService.list(),
      ])
      setDocuments(docsData)
      setTemplates(tplsData)
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
        title: 'Erro ao carregar documentos',
        description: 'Não foi possível carregar a lista de ofícios.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user?.municipality])

  // Abrir criação de novo documento
  const handleOpenNew = () => {
    setEditingDoc(null)
    setFormData({
      recipient_name: '',
      recipient_role: '',
      recipient_institution: '',
      recipient_address: '',
      subject: '',
      content: '<p>Cumprimentando-o cordialmente, venho por meio deste...</p>',
      signatory_user: user?.id || '',
      signatory_name: user?.name || '',
      signatory_role: 'Coordenadoria Municipal de Defesa Civil',
      template: '',
    })
    setIsEditorOpen(true)
  }

  // Abrir edição
  const handleOpenEdit = (doc: OfficialDocument) => {
    setEditingDoc(doc)
    setFormData({
      recipient_name: doc.recipient_name || '',
      recipient_role: doc.recipient_role || '',
      recipient_institution: doc.recipient_institution || '',
      recipient_address: doc.recipient_address || '',
      subject: doc.subject || '',
      content: doc.content || '',
      signatory_user: doc.signatory_user || '',
      signatory_name: doc.signatory_name || '',
      signatory_role: doc.signatory_role || '',
      template: doc.template || '',
    })
    setIsEditorOpen(true)
  }

  // Aplicar modelo pré-configurado
  const handleApplyTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId)
    if (tpl) {
      setFormData((prev) => ({
        ...prev,
        template: tpl.id,
        subject: tpl.subject || prev.subject,
        content: tpl.content || prev.content,
      }))
      toast({
        title: 'Modelo aplicado',
        description: `O modelo "${tpl.title}" foi carregado no formulário.`,
      })
    }
  }

  // Salvar como rascunho ou emitir
  const handleSave = async (asIssued = false) => {
    if (!formData.recipient_name.trim() || !formData.subject.trim() || !formData.content.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o destinatário, assunto e o texto do ofício.',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const payload: Partial<OfficialDocument> = {
        municipality: user?.municipality,
        recipient_name: formData.recipient_name,
        recipient_role: formData.recipient_role,
        recipient_institution: formData.recipient_institution,
        recipient_address: formData.recipient_address,
        subject: formData.subject,
        content: formData.content,
        signatory_user: formData.signatory_user || user?.id,
        signatory_name: formData.signatory_name || user?.name,
        signatory_role: formData.signatory_role,
        template: formData.template || undefined,
        status: asIssued ? 'emitido' : editingDoc ? editingDoc.status : 'rascunho',
      }

      let saved: OfficialDocument
      if (editingDoc) {
        saved = await officialDocumentsService.update(editingDoc.id, payload)
        toast({
          title: asIssued ? 'Ofício Emitido com Sucesso!' : 'Rascunho Atualizado',
          description: asIssued
            ? `Ofício gerado sob o número oficial: ${saved.number}`
            : 'As alterações do ofício foram salvas.',
        })
      } else {
        saved = await officialDocumentsService.create(payload)
        toast({
          title: asIssued ? 'Ofício Emitido com Sucesso!' : 'Rascunho Salvo',
          description: asIssued
            ? `Ofício gerado sob o número oficial: ${saved.number}`
            : 'Novo ofício criado como rascunho.',
        })
      }

      setIsEditorOpen(false)
      loadData()

      if (asIssued) {
        // Abrir automaticamente visualização/impressão para conveniência
        setViewingDoc(saved)
        setIsPrintOpen(true)
      }
    } catch (err: unknown) {
      console.error('[OfficialDocuments] Erro ao salvar:', err)
      const errorMsg =
        (err as any)?.data?.message ||
        (err as any)?.response?.message ||
        (err instanceof Error
          ? err.message
          : 'Falha ao gravar no servidor. Verifique a conexão e permissões.')
      toast({
        title: 'Erro ao salvar ofício',
        description: `${errorMsg}. Seus dados digitados foram preservados para nova tentativa.`,
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Cancelar ofício
  const handleCancelDocument = async (doc: OfficialDocument) => {
    if (!confirm(`Deseja realmente cancelar o ofício ${doc.number || 'selecionado'}?`)) return
    try {
      await officialDocumentsService.update(doc.id, { status: 'cancelado' })
      toast({
        title: 'Ofício cancelado',
        description: `O ofício ${doc.number} foi cancelado no sistema.`,
      })
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao cancelar',
        description: err instanceof Error ? err.message : 'Não foi possível cancelar.',
        variant: 'destructive',
      })
    }
  }

  // Solicitar revisão por IA
  const handleAiReview = async (mode: 'revisao' | 'formal' | 'aprimoramento' = 'revisao') => {
    if (!formData.content || formData.content.trim().length < 15) {
      toast({
        title: 'Texto insuficiente',
        description: 'Digite um texto mais completo para a IA poder revisar.',
      })
      return
    }

    setIsAiLoading(true)
    try {
      const result = await officialDocumentsService.reviewWithAi(formData.content, mode)
      setAiSuggestion(result)
      setIsAiModalOpen(true)
    } catch (err: unknown) {
      toast({
        title: 'Falha na assistência de IA',
        description:
          err instanceof Error ? err.message : 'Não foi possível obter a sugestão da IA.',
        variant: 'destructive',
      })
    } finally {
      setIsAiLoading(false)
    }
  }

  // Aplicar sugestão da IA após confirmação explícita
  const handleApplyAiSuggestion = () => {
    if (aiSuggestion?.improved_text) {
      setFormData((prev) => ({
        ...prev,
        content: aiSuggestion.improved_text,
      }))
      setIsAiModalOpen(false)
      setAiSuggestion(null)
      toast({
        title: 'Sugestão da IA aplicada!',
        description: 'O texto do ofício foi atualizado com a redação aprimorada.',
      })
    }
  }

  // Criar novo modelo reutilizável
  const handleCreateTemplate = async () => {
    if (!templateForm.title.trim() || !templateForm.content.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe o título e o conteúdo padrão do modelo.',
        variant: 'destructive',
      })
      return
    }

    try {
      await docTemplatesService.create({
        municipality: user?.municipality,
        title: templateForm.title,
        category: templateForm.category,
        subject: templateForm.subject,
        content: templateForm.content,
        is_default: templateForm.is_default,
        created_by: user?.id,
      })
      toast({
        title: 'Modelo salvo com sucesso!',
        description: `O modelo "${templateForm.title}" está disponível para todos os operadores.`,
      })
      setIsTemplateModalOpen(false)
      setTemplateForm({
        title: '',
        category: 'oficio',
        subject: '',
        content: '',
        is_default: false,
      })
      loadData()
    } catch (err: unknown) {
      toast({
        title: 'Erro ao salvar modelo',
        description: err instanceof Error ? err.message : 'Falha na criação do modelo.',
        variant: 'destructive',
      })
    }
  }

  // Filtro de busca
  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch =
      (doc.number && doc.number.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.subject && doc.subject.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.recipient_name && doc.recipient_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.recipient_institution &&
        doc.recipient_institution.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter
    return matchesSearch && matchesStatus
  })

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-lg border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestão de Ofícios</h1>
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
              Oficial
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Emissão de ofícios institucionais com numeração atômica por município/ano, modelos
            oficiais e assistência de IA.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsTemplateModalOpen(true)}
            className="text-slate-700 border-slate-300 hover:bg-slate-50 gap-2"
          >
            <Copy className="w-4 h-4" /> Gerenciar Modelos
          </Button>
          <Button
            onClick={handleOpenNew}
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 shadow-xs"
          >
            <Plus className="w-4 h-4" /> Novo Ofício
          </Button>
        </div>
      </div>

      {/* Barra de Pesquisa e Filtros */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-lg border shadow-xs">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por número, assunto ou destinatário..."
            className="pl-9 bg-slate-50 border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Label className="text-xs text-slate-500 whitespace-nowrap">Status:</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 bg-slate-50 border-slate-200 text-xs">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="emitido">Emitidos</SelectItem>
              <SelectItem value="rascunho">Rascunhos</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de Documentos */}
      <Card className="border shadow-xs">
        <CardHeader className="p-4 border-b bg-slate-50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-800">
              Histórico de Documentos Oficiais ({filteredDocuments.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Numeração gerada sequencialmente pelo servidor (OF-ANO-XXXXX)
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-slate-400 text-sm">Carregando ofícios...</div>
          ) : filteredDocuments.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">Nenhum ofício encontrado</p>
              <p className="text-xs text-slate-400 mt-1">
                Crie um novo ofício ou altere os filtros de busca.
              </p>
              <Button onClick={handleOpenNew} size="sm" variant="outline" className="mt-4 gap-2">
                <Plus className="w-3.5 h-3.5" /> Criar Primeiro Ofício
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 font-mono text-sm">
                        {doc.number || '[RASCUNHO NÃO EMITIDO]'}
                      </span>
                      <DocumentStatusBadge status={doc.status} />
                      {doc.issue_date && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(doc.issue_date).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>

                    <p className="text-sm font-semibold text-slate-800 truncate">{doc.subject}</p>

                    <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                      <span>
                        <strong>Para:</strong> {doc.recipient_name}
                        {doc.recipient_institution ? ` (${doc.recipient_institution})` : ''}
                      </span>
                      <span>•</span>
                      <span>
                        <strong>Signatário:</strong> {doc.signatory_name || 'Não definido'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setViewingDoc(doc)
                        setIsPrintOpen(true)
                      }}
                      className="h-8 text-xs gap-1.5 text-slate-700 hover:text-blue-700 hover:bg-blue-50 border-slate-200"
                    >
                      <Printer className="w-3.5 h-3.5" /> Imprimir / PDF
                    </Button>

                    {doc.status === 'rascunho' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(doc)}
                        className="h-8 text-xs gap-1.5 text-slate-700 hover:bg-slate-100"
                      >
                        <Edit className="w-3.5 h-3.5" /> Editar
                      </Button>
                    )}

                    {doc.status === 'emitido' &&
                      (user?.role === 'administrador' || user?.role === 'coordenador') && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCancelDocument(doc)}
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

      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE OFÍCIO */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-slate-50">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  {editingDoc
                    ? `Editar Ofício (${editingDoc.number || 'Rascunho'})`
                    : 'Novo Ofício Oficial'}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500">
                  Preencha os dados institucionais. Ao emitir, o número atômico oficial será gerado
                  no servidor.
                </DialogDescription>
              </div>
              {templates.length > 0 && !editingDoc && (
                <div className="w-56">
                  <Select onValueChange={handleApplyTemplate}>
                    <SelectTrigger className="h-8 text-xs bg-white">
                      <SelectValue placeholder="Carregar Modelo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((tpl) => (
                        <SelectItem key={tpl.id} value={tpl.id}>
                          {tpl.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Bloco de Destinatário */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Nome do Destinatário *
                </Label>
                <Input
                  placeholder="Ex.: Exmo. Sr. Secretário de Obras"
                  value={formData.recipient_name}
                  onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                  className="bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Cargo / Função</Label>
                <Input
                  placeholder="Ex.: Secretário Municipal"
                  value={formData.recipient_role}
                  onChange={(e) => setFormData({ ...formData, recipient_role: e.target.value })}
                  className="bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Órgão / Instituição</Label>
                <Input
                  placeholder="Ex.: Secretaria de Obras e Serviços Públicos"
                  value={formData.recipient_institution}
                  onChange={(e) =>
                    setFormData({ ...formData, recipient_institution: e.target.value })
                  }
                  className="bg-white"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Endereço / Localidade
                </Label>
                <Input
                  placeholder="Ex.: Rua Coronel Silva, 100 - Centro"
                  value={formData.recipient_address}
                  onChange={(e) => setFormData({ ...formData, recipient_address: e.target.value })}
                  className="bg-white"
                />
              </div>
            </div>

            {/* Assunto e Signatário */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs font-semibold text-slate-700">Assunto do Ofício *</Label>
                <Input
                  placeholder="Ex.: Solicitação de maquinário pesado para desobstrução de via pública"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Signatário / Responsável
                </Label>
                <Input
                  placeholder="Nome do emissor"
                  value={formData.signatory_name}
                  onChange={(e) => setFormData({ ...formData, signatory_name: e.target.value })}
                />
              </div>
            </div>

            {/* Editor de Texto Rico */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">
                  Corpo do Ofício (Texto Oficial) *
                </Label>
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAiReview('formal')}
                    disabled={isAiLoading}
                    className="h-7 text-xs text-purple-700 hover:bg-purple-50"
                  >
                    Tom Institucional
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAiReview('aprimoramento')}
                    disabled={isAiLoading}
                    className="h-7 text-xs text-purple-700 hover:bg-purple-50"
                  >
                    Argumentação Técnica
                  </Button>
                </div>
              </div>

              <RichEditor
                value={formData.content}
                onChange={(val) => setFormData({ ...formData, content: val })}
                onAiReviewRequest={() => handleAiReview('revisao')}
                isAiLoading={isAiLoading}
                placeholder="Escreva os parágrafos do documento oficial..."
              />
              <p className="text-[11px] text-slate-500">
                A assistência de IA sugere melhorias ortográficas e de clareza textual, exigindo sua
                aprovação antes de substituir qualquer conteúdo.
              </p>
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
                Salvar como Rascunho
              </Button>
              <Button
                onClick={() => handleSave(true)}
                disabled={isSaving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-semibold shadow-xs"
              >
                <FileCheck className="w-4 h-4" /> Emitir Oficialmente
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO DA REVISÃO POR IA */}
      <Dialog open={isAiModalOpen} onOpenChange={setIsAiModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-800">
              <Sparkles className="w-5 h-5 text-purple-600" />
              Sugestão de Revisão da IA
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Revise as alterações sugeridas pela IA. O texto original só será alterado se você
              clicar em "Aceitar e Aplicar".
            </DialogDescription>
          </DialogHeader>

          {aiSuggestion && (
            <div className="space-y-4 py-2">
              <div className="bg-purple-50 border border-purple-200 rounded p-3 text-xs text-purple-900">
                <strong>Resumo das Alterações:</strong> {aiSuggestion.summary_of_changes}
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 mb-1 block">
                  Prévia do Texto Sugerido:
                </Label>
                <div
                  className="bg-slate-50 border rounded p-4 text-xs max-h-64 overflow-y-auto leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: aiSuggestion.improved_text }}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsAiModalOpen(false)}>
              Rejeitar Sugestão
            </Button>
            <Button
              onClick={handleApplyAiSuggestion}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
            >
              <Check className="w-4 h-4" /> Aceitar e Aplicar no Ofício
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DE GERENCIAMENTO DE MODELOS */}
      <Dialog open={isTemplateModalOpen} onOpenChange={setIsTemplateModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Modelos de Documentos Oficiais</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Modelos reutilizáveis configurados para o município.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list">Modelos Existentes ({templates.length})</TabsTrigger>
              <TabsTrigger value="new">Cadastrar Novo Modelo</TabsTrigger>
            </TabsList>

            <TabsContent value="list" className="py-4 space-y-3 max-h-[60vh] overflow-y-auto">
              {templates.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">Nenhum modelo cadastrado.</p>
              ) : (
                templates.map((tpl) => (
                  <div key={tpl.id} className="p-3 border rounded-lg bg-slate-50 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-slate-900">{tpl.title}</span>
                      <Badge variant="outline" className="text-[10px] uppercase">
                        {tpl.category}
                      </Badge>
                    </div>
                    {tpl.subject && (
                      <p className="text-xs text-slate-600">
                        <strong>Assunto Padrão:</strong> {tpl.subject}
                      </p>
                    )}
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="new" className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Título do Modelo *</Label>
                  <Input
                    placeholder="Ex.: Solicitação de Apoio Operacional"
                    value={templateForm.title}
                    onChange={(e) => setTemplateForm({ ...templateForm, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Categoria</Label>
                  <Select
                    value={templateForm.category}
                    onValueChange={(val: any) =>
                      setTemplateForm({ ...templateForm, category: val })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="oficio">Ofício Geral</SelectItem>
                      <SelectItem value="solicitacao">Solicitação</SelectItem>
                      <SelectItem value="notificacao">Notificação</SelectItem>
                      <SelectItem value="laudo">Laudo</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Assunto Padrão</Label>
                <Input
                  placeholder="Assunto sugerido no cabeçalho"
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold">Conteúdo Padrão do Modelo *</Label>
                <RichEditor
                  value={templateForm.content}
                  onChange={(val) => setTemplateForm({ ...templateForm, content: val })}
                  placeholder="Escreva a minuta padrão do modelo..."
                />
              </div>

              <Button
                onClick={handleCreateTemplate}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Salvar Novo Modelo
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* COMPONENTE DE IMPRESSÃO / PDF */}
      <OfficialDocumentPrintView
        document={viewingDoc}
        municipality={currentMunicipality}
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
      />
    </div>
  )
}
