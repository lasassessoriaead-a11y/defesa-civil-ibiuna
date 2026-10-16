import React, { useState, useEffect } from 'react'
import {
  FileText,
  Search,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Eye,
  Edit3,
  MapPin,
  Save,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Layers,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  X,
  FileCheck2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { strategicInfrastructuresService } from '@/services/defesa-civil'
import { dmsToDecimal, isWithinIbiunaBounds } from '@/lib/geo-utils'
import type { StrategicInfrastructure } from '@/types/defesa-civil'

// Páginas fotografadas do levantamento de campo do PDF Pontes e aduelas.pdf
// Para visualização direta lado a lado na conferência humana
const PDF_PAGES_ASSETS = [
  { page: 1, title: 'Página 1 (P Gabri, P1 a P46 - Setor 1 / Paruru / Veleiros / Ressaca)' },
  {
    page: 2,
    title: 'Página 2 (P47 a P95 - Ressaca / Rod. B Nakao / Campo Verde - baixa visibilidade)',
  },
  {
    page: 3,
    title:
      'Página 3 (P96 a P144 - Cupim / Feital / Tavares / Paes / Rosarial / Centro / Cachoeira)',
  },
  {
    page: 4,
    title:
      'Página 4 (P145 a P191 - Curral / Gemima / Paiol P. / Bº Pintos / anotações manuscritas)',
  },
  { page: 5, title: 'Página 5 (P191 a P224 - Rod. B Nakao / Est. Verava / P224)' },
]

export const BridgeConferencePage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [infrastructures, setInfrastructures] = useState<StrategicInfrastructure[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedInfra, setSelectedInfra] = useState<StrategicInfrastructure | null>(null)
  const [selectedPage, setSelectedPage] = useState<number>(1)
  const [zoomLevel, setZoomLevel] = useState<number>(100)
  const [searchCode, setSearchCode] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [isEditing, setIsEditing] = useState(false)

  // Form states de edição / conferência humana
  const [editCode, setEditCode] = useState('')
  const [editType, setEditType] = useState<string>('ponte')
  const [editLatDms, setEditLatDms] = useState('')
  const [editLonDms, setEditLonDms] = useState('')
  const [editNeighborhood, setEditNeighborhood] = useState('')
  const [editRefPoint, setEditRefPoint] = useState('')
  const [editDimensions, setEditDimensions] = useState('')
  const [editProblems, setEditProblems] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editValidationStatus, setEditValidationStatus] = useState<string>('pendente_conferencia')
  const [editCondition, setEditCondition] = useState<string>('nao_avaliado')
  const [editPriority, setEditPriority] = useState<string>('media')
  const [editInspectionStatus, setEditInspectionStatus] = useState<string>('em_dia')
  const [isSaving, setIsSaving] = useState(false)

  const municipalityId = user?.municipality || ''

  // Carregar lista de pontes e aduelas cadastradas
  const loadInfrastructures = async () => {
    setIsLoading(true)
    try {
      const records = await strategicInfrastructuresService.list(undefined, 'original_code')
      setInfrastructures(records)
      if (records.length > 0 && !selectedInfra) {
        selectRecord(records[0])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadInfrastructures()
  }, [])

  const selectRecord = (rec: StrategicInfrastructure) => {
    setSelectedInfra(rec)
    setEditCode(rec.original_code || '')
    setEditType(rec.type || 'pendente_classificacao')
    setEditLatDms(rec.lat_dms || '')
    setEditLonDms(rec.lon_dms || '')
    setEditNeighborhood(rec.neighborhood || '')
    setEditRefPoint(rec.reference_point || '')
    setEditDimensions(rec.dimensions || '')
    setEditProblems(rec.observed_problems || '')
    setEditNotes(rec.notes || '')
    setEditValidationStatus(rec.validation_status || 'pendente_conferencia')
    setEditCondition(rec.structural_condition || 'nao_avaliado')
    setEditPriority(rec.administrative_priority || 'media')
    setEditInspectionStatus(rec.inspection_status || 'em_dia')

    if (rec.source_page) {
      setSelectedPage(rec.source_page)
    }
  }

  // Conversão em tempo real de DMS para Decimal
  const parsedLat = dmsToDecimal(editLatDms)
  const parsedLon = dmsToDecimal(editLonDms)

  const isCoordsValid =
    parsedLat.status === 'valida' &&
    parsedLon.status === 'valida' &&
    parsedLat.decimal !== null &&
    parsedLon.decimal !== null

  const isInsideIbiuna =
    isCoordsValid && isWithinIbiunaBounds(parsedLat.decimal!, parsedLon.decimal!)

  // Salvar conferência
  const handleSaveConference = async () => {
    if (!selectedInfra) return
    setIsSaving(true)

    try {
      const payload: Partial<StrategicInfrastructure> = {
        original_code: editCode.trim(),
        type: editType as any,
        lat_dms: editLatDms.trim(),
        lon_dms: editLonDms.trim(),
        latitude: isCoordsValid ? parsedLat.decimal! : undefined,
        longitude: isCoordsValid ? parsedLon.decimal! : undefined,
        coordinate_status: isCoordsValid ? 'valida' : editLatDms ? 'duvidosa' : 'ausente',
        neighborhood: editNeighborhood.trim(),
        reference_point: editRefPoint.trim(),
        dimensions: editDimensions.trim(),
        observed_problems: editProblems.trim(),
        notes: editNotes.trim(),
        validation_status: editValidationStatus as any,
        structural_condition: editCondition as any,
        administrative_priority: editPriority as any,
        inspection_status: editInspectionStatus as any,
        source_page: selectedPage,
        verified_by: user?.id,
        verified_at: new Date().toISOString(),
      }

      await strategicInfrastructuresService.update(selectedInfra.id, payload)
      toast({
        title: 'Estrutura atualizada com sucesso',
        description: `Registro ${editCode} validado pelo operador técnico.`,
      })
      await loadInfrastructures()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar validação',
        description: err.message || 'Falha ao atualizar registro.',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Filtrar registros
  const filtered = infrastructures.filter((i) => {
    const matchSearch =
      searchCode === '' ||
      i.original_code.toLowerCase().includes(searchCode.toLowerCase()) ||
      (i.neighborhood && i.neighborhood.toLowerCase().includes(searchCode.toLowerCase())) ||
      (i.reference_point && i.reference_point.toLowerCase().includes(searchCode.toLowerCase()))

    const matchStatus =
      filterStatus === 'all' ||
      i.validation_status === filterStatus ||
      (filterStatus === 'duvidosa' && i.coordinate_status === 'duvidosa')

    return matchSearch && matchStatus
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Digitalização Assistida & Conferência de Pontes e Aduelas
            </h1>
            <p className="text-xs text-slate-500">
              Conferência humana lado a lado contra o documento original `Pontes e aduelas.pdf` (P1
              a P224). Sem coordenadas ou classificações inventadas.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 py-1">
            Total Cadastrado: {infrastructures.length} estruturas
          </Badge>
          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-200 py-1">
            Pendentes:{' '}
            {infrastructures.filter((i) => i.validation_status === 'pendente_conferencia').length}
          </Badge>
        </div>
      </div>

      {/* Main Split Layout: Document Viewer on Left (or Top on Mobile), Data Verification on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visualizador do Documento Original do Levantamento */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  Documento Original de Campo (PDF)
                </CardTitle>
                <CardDescription className="text-xs">
                  Página {selectedPage} de 5 — Verificação visual de tabelas
                  manuscritas/fotografadas
                </CardDescription>
              </div>

              {/* Controles de Zoom e Navegação de Páginas */}
              <div className="flex items-center gap-1.5">
                <Button
                  size="icon"
                  variant="outline"
                  className="w-7 h-7"
                  disabled={selectedPage <= 1}
                  onClick={() => setSelectedPage((p) => Math.max(1, p - 1))}
                  title="Página Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-xs font-semibold px-1">{selectedPage}/5</span>
                <Button
                  size="icon"
                  variant="outline"
                  className="w-7 h-7"
                  disabled={selectedPage >= 5}
                  onClick={() => setSelectedPage((p) => Math.min(5, p + 1))}
                  title="Próxima Página"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>

                <div className="h-4 w-[1px] bg-slate-300 mx-1" />

                <Button
                  size="icon"
                  variant="ghost"
                  className="w-7 h-7"
                  onClick={() => setZoomLevel((z) => Math.max(70, z - 15))}
                  title="Reduzir Zoom"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>
                <span className="text-[10px] font-mono">{zoomLevel}%</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="w-7 h-7"
                  onClick={() => setZoomLevel((z) => Math.min(200, z + 15))}
                  title="Aumentar Zoom"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-4">
              {/* Seletor Rápido de Página */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {PDF_PAGES_ASSETS.map((p) => (
                  <Button
                    key={p.page}
                    size="sm"
                    variant={selectedPage === p.page ? 'default' : 'outline'}
                    className={`h-7 text-xs ${
                      selectedPage === p.page ? 'bg-indigo-600 text-white' : 'text-slate-600'
                    }`}
                    onClick={() => setSelectedPage(p.page)}
                  >
                    Pág. {p.page}
                  </Button>
                ))}
              </div>

              {/* Caixa de visualização da folha original */}
              <div className="relative border border-slate-300 rounded-lg overflow-auto bg-slate-800 h-[560px] flex items-center justify-center">
                <div
                  className="transition-all duration-150 origin-top flex flex-col items-center"
                  style={{ width: `${zoomLevel}%` }}
                >
                  {/* Incorpora visualizador do PDF da página correspondente ou frame interativo */}
                  <div className="bg-white p-4 shadow-2xl rounded text-slate-800 w-full min-h-[700px] flex flex-col">
                    <div className="border-b pb-2 mb-3 flex items-center justify-between text-xs font-bold text-slate-700">
                      <span>LEVANTAMENTO DE PONTES — PÁGINA {selectedPage}</span>
                      <Badge variant="outline" className="text-[10px]">
                        Fonte: Pontes e aduelas.pdf
                      </Badge>
                    </div>

                    <div className="flex-1 bg-slate-50 border rounded p-3 flex flex-col items-center justify-center text-center space-y-3">
                      <FileText className="w-16 h-16 text-indigo-400" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-800">
                          {PDF_PAGES_ASSETS[selectedPage - 1]?.title}
                        </p>
                        <p className="text-xs text-slate-500 max-w-sm">
                          Página original do levantamento. Registros fotografados contêm coordenadas
                          DMS manuscritas e observações de calha e mureta.
                        </p>
                      </div>

                      <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 text-left space-y-1 max-w-md">
                        <p className="font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                          Regra de Conferência:
                        </p>
                        <p>
                          Como parte da folha está fotocopiada, borrada ou manuscrita (ex.: Página 2
                          possui baixa visibilidade, e Página 4 anotações de vão livre), não aceite
                          valores duvidosos sem inspeção humana. Registros ilegíveis permanecem fora
                          do mapa até aprovação.
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          window.open('/src/assets/pontes-e-aduelas-be600.pdf', '_blank')
                        }}
                      >
                        <Maximize2 className="w-3.5 h-3.5 mr-1" />
                        Abrir PDF Integral em Nova Aba
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Painel de Conferência & Edição Técnica */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 pb-2 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-emerald-600" />
                  Conferência Assistida do Registro Selecionado
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative w-36">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Buscar cód/bairro..."
                      value={searchCode}
                      onChange={(e) => setSearchCode(e.target.value)}
                      className="h-7 pl-7 text-xs"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-7 text-xs w-32">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="pendente_conferencia">Pendente</SelectItem>
                      <SelectItem value="conferido">Conferido</SelectItem>
                      <SelectItem value="duvidosa">Duvidosa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-4">
              {/* Lista compacta de seleção de pontes */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
                {filtered.map((item) => (
                  <Button
                    key={item.id}
                    size="sm"
                    variant={selectedInfra?.id === item.id ? 'default' : 'outline'}
                    onClick={() => selectRecord(item)}
                    className={`h-7 px-2.5 text-xs font-mono shrink-0 ${
                      selectedInfra?.id === item.id
                        ? 'bg-indigo-600 text-white'
                        : item.validation_status === 'conferido'
                          ? 'border-emerald-300 text-emerald-800 bg-emerald-50/50'
                          : item.coordinate_status === 'duvidosa' ||
                              item.coordinate_status === 'ilegivel'
                            ? 'border-amber-300 text-amber-800 bg-amber-50/50'
                            : 'text-slate-700'
                    }`}
                  >
                    {item.original_code}
                    {item.validation_status === 'conferido' && (
                      <Check className="w-3 h-3 ml-1 text-emerald-600" />
                    )}
                  </Button>
                ))}
              </div>

              {selectedInfra ? (
                <div className="space-y-4 text-xs">
                  {/* Grid de Campos Técnicos */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Identificador Original</label>
                      <Input
                        value={editCode}
                        onChange={(e) => setEditCode(e.target.value)}
                        placeholder="Ex: P1, P224, P Gabri"
                        className="h-8 font-mono text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Tipo Confirmado</label>
                      <Select value={editType} onValueChange={setEditType}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ponte">Ponte</SelectItem>
                          <SelectItem value="aduela">Aduela</SelectItem>
                          <SelectItem value="bueiro">Bueiro</SelectItem>
                          <SelectItem value="passarela">Passarela</SelectItem>
                          <SelectItem value="outro">Outro</SelectItem>
                          <SelectItem value="pendente_classificacao">
                            Pendente Classificação (Não Distinguível)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Coordenadas Geográficas DMS & Decimais */}
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        Coordenadas Geográficas do Levantamento
                      </span>
                      <Badge
                        variant="outline"
                        className={
                          isCoordsValid && isInsideIbiuna
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : isCoordsValid
                              ? 'bg-amber-50 text-amber-700 border-amber-300'
                              : 'bg-red-50 text-red-700 border-red-300'
                        }
                      >
                        {isCoordsValid && isInsideIbiuna
                          ? 'Válida (Dentro de Ibiúna)'
                          : isCoordsValid
                            ? 'Atenção: Fora dos limites de Ibiúna'
                            : 'Coordenada Inválida / Ilegível'}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-slate-600 font-medium">Latitude DMS Original</label>
                        <Input
                          value={editLatDms}
                          onChange={(e) => setEditLatDms(e.target.value)}
                          placeholder={`Ex: 23°43'22.77"S`}
                          className="h-8 font-mono text-xs"
                        />
                        <p className="text-[10px] text-slate-500 font-mono">
                          Decimal: {parsedLat.decimal !== null ? parsedLat.decimal : '---'}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-slate-600 font-medium">Longitude DMS Original</label>
                        <Input
                          value={editLonDms}
                          onChange={(e) => setEditLonDms(e.target.value)}
                          placeholder={`Ex: 47°10'2.68"O`}
                          className="h-8 font-mono text-xs"
                        />
                        <p className="text-[10px] text-slate-500 font-mono">
                          Decimal: {parsedLon.decimal !== null ? parsedLon.decimal : '---'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Localização / Bairro / Referência */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Bairro / Localidade</label>
                      <Input
                        value={editNeighborhood}
                        onChange={(e) => setEditNeighborhood(e.target.value)}
                        placeholder="Ex: Paruru, Feital, Tavares..."
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Ponto de Referência</label>
                      <Input
                        value={editRefPoint}
                        onChange={(e) => setEditRefPoint(e.target.value)}
                        placeholder="Ex: Rod. B Nakao, Próx. Igreja..."
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Dimensões & Problemas Observados */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Dimensões / Calha</label>
                      <Input
                        value={editDimensions}
                        onChange={(e) => setEditDimensions(e.target.value)}
                        placeholder="Ex: L. Calha 4.0m, Vão 16.0m..."
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">
                        Problemas Identificados
                      </label>
                      <Input
                        value={editProblems}
                        onChange={(e) => setEditProblems(e.target.value)}
                        placeholder="Ex: Mureta quebrada, assoreamento..."
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>

                  {/* Observações e Transcrição Manuscrita */}
                  <div className="space-y-1">
                    <label className="font-semibold text-slate-700">
                      Observações Manuscritas Transcritas
                    </label>
                    <Textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Transcreva com fidelidade o que for legível no documento fotocopiado..."
                      className="text-xs h-16"
                    />
                  </div>

                  {/* Status de Validação e Prioridades */}
                  <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Validação Humana</label>
                      <Select value={editValidationStatus} onValueChange={setEditValidationStatus}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="conferido">Conferido & Aprovado</SelectItem>
                          <SelectItem value="pendente_conferencia">
                            Pendente de Conferência
                          </SelectItem>
                          <SelectItem value="divergente">Divergente / Duvidoso</SelectItem>
                          <SelectItem value="rejeitado">Rejeitado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Condição Estrutural</label>
                      <Select value={editCondition} onValueChange={setEditCondition}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bom">Bom</SelectItem>
                          <SelectItem value="regular">Regular</SelectItem>
                          <SelectItem value="ruim">Ruim</SelectItem>
                          <SelectItem value="critico">Crítico</SelectItem>
                          <SelectItem value="nao_avaliado">
                            Não Avaliado (Requer Vistoria)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-slate-700">Prioridade Operacional</label>
                      <Select value={editPriority} onValueChange={setEditPriority}>
                        <SelectTrigger className="h-8 text-xs">
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

                  {/* Rodapé de Ações */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="text-[11px] text-slate-500">
                      Operador: <strong>{user?.name || 'Defesa Civil'}</strong>
                    </div>

                    <Button
                      onClick={handleSaveConference}
                      disabled={isSaving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 text-xs"
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      {isSaving ? 'Salvando...' : 'Salvar Conferência Técnica'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <p>Selecione uma estrutura acima para conferir seus dados.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
export default BridgeConferencePage
