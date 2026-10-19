import React, { useState, useEffect, useRef } from 'react'
import {
  FileText,
  Image as ImageIcon,
  Video,
  UploadCloud,
  Trash2,
  Download,
  Eye,
  Calendar,
  User as UserIcon,
  Filter,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
  File,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { recordAttachmentsService, auditLogService } from '@/services/defesa-civil'
import type {
  RecordAttachment,
  AttachmentCategory,
  AttachmentMediaType,
} from '@/types/defesa-civil'

const CATEGORY_LABELS: Record<AttachmentCategory, string> = {
  vistoria: 'Vistoria Técnica',
  situacao_inicial: 'Situação Inicial',
  antes_intervencao: 'Antes da Intervenção',
  durante_obra: 'Durante a Obra',
  depois_conclusao: 'Depois da Conclusão',
  outros: 'Outros Documentos',
}

interface RecordAttachmentsTabProps {
  targetCollection: string
  targetId: string
  recordTitle?: string
  canEdit?: boolean
}

export const RecordAttachmentsTab: React.FC<RecordAttachmentsTabProps> = ({
  targetCollection,
  targetId,
  recordTitle = '',
  canEdit = true,
}) => {
  const { user, municipality } = useAuth()
  const { toast } = useToast()

  const [attachments, setAttachments] = useState<RecordAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedMediaType, setSelectedMediaType] = useState<string>('all')

  // Upload dialog state
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadCategory, setUploadCategory] = useState<AttachmentCategory>('vistoria')
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')
  const [uploadCaptureDate, setUploadCaptureDate] = useState(new Date().toISOString().split('T')[0])
  const [uploadAuthorName, setUploadAuthorName] = useState(user?.name || '')
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Preview dialog state
  const [previewAttachment, setPreviewAttachment] = useState<RecordAttachment | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadAttachments = async () => {
    try {
      setLoading(true)
      const data = await recordAttachmentsService.listForRecord(targetCollection, targetId)
      setAttachments(data)
    } catch (err: any) {
      console.warn('Falha ao carregar anexos:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (targetCollection && targetId) {
      loadAttachments()
    }
  }, [targetCollection, targetId])

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    // Validação de tamanho no cliente (100MB max)
    const validFiles: File[] = []
    for (const f of files) {
      if (f.size > 100 * 1024 * 1024) {
        toast({
          title: 'Arquivo muito grande',
          description: `O arquivo ${f.name} excede o limite máximo de 100MB.`,
          variant: 'destructive',
        })
      } else {
        validFiles.push(f)
      }
    }
    setSelectedFiles(validFiles)
  }

  const handleStartUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedFiles.length === 0) {
      toast({
        title: 'Selecione pelo menos um arquivo',
        variant: 'destructive',
      })
      return
    }

    if (!municipality?.id) {
      toast({
        title: 'Município não identificado',
        description: 'Sua sessão não possui município vinculado.',
        variant: 'destructive',
      })
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    let successCount = 0
    let failCount = 0

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      let mediaType: AttachmentMediaType = 'outro'
      if (file.type.startsWith('image/')) mediaType = 'foto'
      else if (file.type.startsWith('video/')) mediaType = 'video'
      else if (file.type === 'application/pdf') mediaType = 'documento'

      const formData = new FormData()
      formData.append('municipality', municipality.id)
      formData.append('target_collection', targetCollection)
      formData.append('target_id', targetId)
      formData.append('file', file)
      formData.append('title', uploadTitle || file.name)
      formData.append('description', uploadDescription)
      formData.append('category', uploadCategory)
      formData.append('media_type', mediaType)
      formData.append('file_size', file.size.toString())
      if (uploadCaptureDate) {
        formData.append('capture_date', new Date(uploadCaptureDate).toISOString())
      }
      if (uploadAuthorName) {
        formData.append('author_name', uploadAuthorName)
      }
      if (user?.id) {
        formData.append('uploaded_by', user.id)
      }

      try {
        await recordAttachmentsService.upload(formData)
        successCount++
      } catch (err) {
        console.error('Erro ao enviar arquivo:', file.name, err)
        failCount++
      }
      setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100))
    }

    // Auditoria
    try {
      await auditLogService.create({
        action: 'create',
        resource: 'record_attachments',
        details: `Envio de ${successCount} anexo(s) para ${targetCollection}:${targetId} (${recordTitle})`,
      })
    } catch {
      /* intentionally ignored */
    }

    setIsUploading(false)
    setIsUploadOpen(false)
    setSelectedFiles([])
    setUploadTitle('')
    setUploadDescription('')

    if (failCount > 0) {
      toast({
        title: 'Envio concluído com avisos',
        description: `${successCount} arquivo(s) enviados com sucesso, ${failCount} falharam.`,
        variant: 'destructive',
      })
    } else {
      toast({
        title: 'Arquivos anexados com sucesso',
        description: `${successCount} arquivo(s) foram vinculados ao registro.`,
      })
    }
    loadAttachments()
  }

  const handleDeleteAttachment = async (att: RecordAttachment) => {
    if (!window.confirm(`Tem certeza de que deseja remover o anexo "${att.title || att.file}"?`)) {
      return
    }

    try {
      await recordAttachmentsService.delete(att.id)
      await auditLogService.create({
        action: 'delete',
        resource: 'record_attachments',
        record_id: att.id,
        details: `Remoção do anexo ${att.title || att.file} de ${targetCollection}:${targetId}`,
      })
      toast({
        title: 'Anexo removido com sucesso',
      })
      loadAttachments()
    } catch (err: any) {
      toast({
        title: 'Erro ao remover anexo',
        description: err.message || 'Sem permissão para excluir este anexo.',
        variant: 'destructive',
      })
    }
  }

  const filteredAttachments = attachments.filter((att) => {
    if (selectedCategory !== 'all' && att.category !== selectedCategory) return false
    if (selectedMediaType !== 'all' && att.media_type !== selectedMediaType) return false
    return true
  })

  return (
    <div className="space-y-4">
      {/* Top action bar: Filtros e Botão de Envio */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border rounded-lg">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span>Categoria:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800"
            >
              <option value="all">Todas as categorias</option>
              {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
            <span>Tipo:</span>
            <select
              value={selectedMediaType}
              onChange={(e) => setSelectedMediaType(e.target.value)}
              className="text-xs bg-white border border-slate-300 rounded px-2 py-1 text-slate-800"
            >
              <option value="all">Todos os tipos</option>
              <option value="foto">Fotos (JPG, PNG, WebP)</option>
              <option value="video">Vídeos (MP4, MOV)</option>
              <option value="documento">Documentos (PDF)</option>
            </select>
          </div>
        </div>

        {canEdit && (
          <Button
            size="sm"
            onClick={() => setIsUploadOpen(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 text-xs"
          >
            <UploadCloud className="w-4 h-4" />
            Anexar Arquivos
          </Button>
        )}
      </div>

      {/* Lista / Galeria de Anexos */}
      {loading ? (
        <div className="flex items-center justify-center p-8 text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Carregando anexos...
        </div>
      ) : filteredAttachments.length === 0 ? (
        <div className="text-center p-8 bg-slate-50 border border-dashed rounded-lg text-slate-500 text-xs">
          <File className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-60" />
          Nenhum anexo encontrado para os filtros selecionados.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredAttachments.map((att) => {
            const fileUrl = recordAttachmentsService.getFileUrl(att)
            const isImage = att.media_type === 'foto'
            const isVideo = att.media_type === 'video'
            const isPdf = att.media_type === 'documento'

            return (
              <div
                key={att.id}
                className="group border border-slate-200 rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow flex flex-col"
              >
                {/* Thumb / Preview Box */}
                <div
                  className="relative aspect-video bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer"
                  onClick={() => setPreviewAttachment(att)}
                >
                  {isImage ? (
                    <img
                      src={fileUrl}
                      alt={att.title || att.file}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  ) : isVideo ? (
                    <div className="flex flex-col items-center text-slate-600">
                      <Video className="w-10 h-10 text-indigo-600 mb-1" />
                      <span className="text-[10px] font-semibold bg-black/60 text-white px-2 py-0.5 rounded">
                        Vídeo (Clique para reproduzir)
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center text-slate-600">
                      <FileText className="w-10 h-10 text-red-600 mb-1" />
                      <span className="text-[10px] font-semibold text-slate-700">
                        Documento PDF
                      </span>
                    </div>
                  )}

                  {/* Badge categoria */}
                  <div className="absolute top-1.5 left-1.5">
                    <span className="bg-slate-900/80 backdrop-blur-xs text-white text-[9px] px-1.5 py-0.5 rounded font-medium">
                      {CATEGORY_LABELS[att.category] || att.category}
                    </span>
                  </div>
                </div>

                {/* Details */}
                <div className="p-2.5 flex-1 flex flex-col justify-between text-xs space-y-1.5">
                  <div>
                    <h4
                      className="font-semibold text-slate-900 line-clamp-1"
                      title={att.title || att.file}
                    >
                      {att.title || att.file}
                    </h4>
                    {att.description && (
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                        {att.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 space-y-0.5">
                    {att.capture_date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>
                          Captura: {new Date(att.capture_date).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    )}
                    {att.author_name && (
                      <div className="flex items-center gap-1">
                        <UserIcon className="w-3 h-3 text-slate-400" />
                        <span>Autor: {att.author_name}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>
                        {att.file_size
                          ? `${(att.file_size / (1024 * 1024)).toFixed(2)} MB`
                          : 'Tamanho padrão'}
                      </span>
                      <span>{new Date(att.created).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPreviewAttachment(att)}
                      className="h-6 px-1.5 text-[11px] text-blue-600 hover:text-blue-700"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Visualizar
                    </Button>

                    <div className="flex items-center gap-1">
                      <a
                        href={fileUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100"
                        title="Baixar arquivo"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(att)}
                          className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50"
                          title="Remover anexo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de Upload com Metadados Oficiais */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
              <UploadCloud className="w-5 h-5 text-indigo-600" />
              Anexar Arquivos ao Registro
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleStartUpload} className="space-y-3.5 text-xs">
            <div className="p-2 bg-slate-50 border rounded text-[11px] text-slate-600 space-y-1">
              <p>
                <strong>Formatos suportados:</strong> Imagens (JPG, PNG, WebP), Vídeos (MP4, MOV) e
                Documentos (PDF).
              </p>
              <p>
                <strong>Limite por arquivo:</strong> Até 100MB. Os arquivos são armazenados com
                isolamento municipal.
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold">Selecionar Arquivos (múltiplos)</Label>
              <Input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={handleFileSelection}
                accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf"
                className="mt-1"
                required
              />
              {selectedFiles.length > 0 && (
                <div className="mt-1 text-[11px] text-indigo-700 font-medium">
                  {selectedFiles.length} arquivo(s) selecionado(s) (
                  {(selectedFiles.reduce((acc, f) => acc + f.size, 0) / (1024 * 1024)).toFixed(2)}{' '}
                  MB total)
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Categoria</Label>
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as any)}
                  className="w-full mt-1 border rounded px-2 py-1.5 text-xs bg-white text-slate-800"
                >
                  {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Data da Captura / Registro</Label>
                <Input
                  type="date"
                  value={uploadCaptureDate}
                  onChange={(e) => setUploadCaptureDate(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs font-semibold">Título ou Identificação</Label>
                <Input
                  placeholder="Ex: Foto do pilar esquerdo"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold">Autor do Registro</Label>
                <Input
                  placeholder="Ex: Eng. Responsável / Agente"
                  value={uploadAuthorName}
                  onChange={(e) => setUploadAuthorName(e.target.value)}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold">Descrição / Observações Técnicas</Label>
              <Textarea
                placeholder="Detalhes adicionais sobre a vistoria, anomalias ou condições observadas..."
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                rows={2}
                className="mt-1 text-xs"
              />
            </div>

            {isUploading && (
              <div className="space-y-1 pt-1">
                <div className="flex justify-between text-[11px] text-slate-600 font-medium">
                  <span>Enviando arquivos para o servidor...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full transition-all duration-200"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsUploadOpen(false)}
                disabled={isUploading}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={isUploading || selectedFiles.length === 0}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                    Enviando...
                  </>
                ) : (
                  'Confirmar Envio'
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal de Visualização Ampliada (Foto, Player de Vídeo e Leitor PDF) */}
      <Dialog
        open={Boolean(previewAttachment)}
        onOpenChange={(open) => !open && setPreviewAttachment(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {previewAttachment && (
            <div className="space-y-3">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between text-sm">
                  <span>{previewAttachment.title || previewAttachment.file}</span>
                  <Badge variant="outline">
                    {CATEGORY_LABELS[previewAttachment.category] || previewAttachment.category}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              {/* Player / Viewer */}
              <div className="bg-black/95 rounded-lg overflow-hidden flex items-center justify-center min-h-[300px]">
                {previewAttachment.media_type === 'foto' ? (
                  <img
                    src={recordAttachmentsService.getFileUrl(previewAttachment)}
                    alt={previewAttachment.title || previewAttachment.file}
                    className="max-h-[60vh] max-w-full object-contain"
                  />
                ) : previewAttachment.media_type === 'video' ? (
                  <video
                    src={recordAttachmentsService.getFileUrl(previewAttachment)}
                    controls
                    className="max-h-[60vh] max-w-full"
                    autoPlay
                  >
                    Seu navegador não suporta reprodução direta de vídeo. Use o botão de download
                    abaixo.
                  </video>
                ) : previewAttachment.media_type === 'documento' ? (
                  <iframe
                    src={recordAttachmentsService.getFileUrl(previewAttachment)}
                    title={previewAttachment.title || 'Documento PDF'}
                    className="w-full h-[60vh] border-0 bg-white"
                  />
                ) : (
                  <div className="p-8 text-center text-white text-xs">
                    <File className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                    Formato não suportado para visualização em linha. Faça o download abaixo.
                  </div>
                )}
              </div>

              {/* Metadados detalhados */}
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 text-slate-700">
                {previewAttachment.description && (
                  <p>
                    <strong>Descrição:</strong> {previewAttachment.description}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200">
                  <div>
                    <strong>Data da Captura:</strong>{' '}
                    {previewAttachment.capture_date
                      ? new Date(previewAttachment.capture_date).toLocaleDateString('pt-BR')
                      : 'Não informada'}
                  </div>
                  <div>
                    <strong>Autor do Registro:</strong>{' '}
                    {previewAttachment.author_name || 'Não informado'}
                  </div>
                  <div>
                    <strong>Data do Envio:</strong>{' '}
                    {new Date(previewAttachment.created).toLocaleString('pt-BR')}
                  </div>
                  <div>
                    <strong>Tamanho do Arquivo:</strong>{' '}
                    {previewAttachment.file_size
                      ? `${(previewAttachment.file_size / (1024 * 1024)).toFixed(2)} MB`
                      : 'Padrão'}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <a
                  href={recordAttachmentsService.getFileUrl(previewAttachment)}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  Baixar Arquivo Original
                </a>
                <Button size="sm" variant="outline" onClick={() => setPreviewAttachment(null)}>
                  Fechar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
