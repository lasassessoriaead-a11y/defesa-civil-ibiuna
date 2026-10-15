import React, { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  Filter,
  AlertTriangle,
  MapPin,
  Users,
  CheckCircle2,
  Radio,
  Clock,
  Calendar,
  Layers,
  Edit2,
  Trash2,
  Bell,
  UserCheck,
  ChevronRight,
  Sparkles,
  Loader2,
  Camera,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Building,
  Phone,
  Hash,
  Download,
  Printer,
  Crosshair,
  Compass,
  CheckCircle,
  HelpCircle,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InteractiveMap } from '@/components/defesa-civil/InteractiveMap'
import {
  SeverityBadge,
  StatusBadge,
  getHazardIcon,
  TYPE_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  ORIGIN_LABELS,
} from '@/components/defesa-civil/StatusBadges'
import {
  occurrencesService,
  teamsService,
  alertsService,
  requestersService,
  occurrenceFilesService,
  municipalitiesService,
  getErrorMessage,
} from '@/services/defesa-civil'
import {
  reverseGeocode,
  fetchViaCep,
  forwardGeocode,
  getCurrentPositionWithAccuracy,
} from '@/services/geocoding'
import { OccurrencePrintView } from '@/components/defesa-civil/OccurrencePrintView'
import type {
  Occurrence,
  OccurrenceType,
  OccurrenceSeverity,
  OccurrenceStatus,
  OccurrenceOrigin,
  Team,
  Alert,
  Requester,
  OccurrenceFile,
  Municipality,
  LocationOrigin,
} from '@/types/defesa-civil'
import { LOCATION_ORIGIN_LABELS } from '@/components/defesa-civil/StatusBadges'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

export const OccurrencesPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [requesters, setRequesters] = useState<Requester[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [searchText, setSearchText] = useState(searchParams.get('search') || '')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [selectedOrigin, setSelectedOrigin] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Modals & Selected details
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedOccurrence, setSelectedOccurrence] = useState<Occurrence | null>(null)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [currentMunicipality, setCurrentMunicipality] = useState<Municipality | null>(null)

  // Files of selected occurrence
  const [currentFiles, setCurrentFiles] = useState<OccurrenceFile[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [isUploadingFile, setIsUploadingFile] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const cameraInputRef = useRef<HTMLInputElement | null>(null)

  // Form State: INICIA COMPLETAMENTE VAZIO para localização e endereço (sem fixos -23.5505, -46.6333)
  const [formData, setFormData] = useState<Partial<Occurrence>>({
    title: '',
    description: '',
    type: 'enchente',
    severity: 'media',
    status: 'reportada',
    origin: '199',
    requester: '',
    latitude: undefined,
    longitude: undefined,
    address: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    postal_code: '',
    complement: '',
    reference_point: '',
    location_origin: undefined,
    location_accuracy: undefined,
    address_confirmed: false,
    affectable_population: 0,
  })
  const [cepInput, setCepInput] = useState('')
  const [isSearchingCep, setIsSearchingCep] = useState(false)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [isCapturingGps, setIsCapturingGps] = useState(false)
  const [gpsWarning, setGpsWarning] = useState<string | null>(null)

  // Centro visual inicial padrão para o mapa interativo (NÃO preenche campos nem banco)
  const [mapCenter, setMapCenter] = useState<[number, number]>([-23.6572, -47.2214]) // Sede Ibiúna / SP como padrão visual

  // Quick Requester Create inside Form
  const [isQuickRequesterOpen, setIsQuickRequesterOpen] = useState(false)
  const [quickReqData, setQuickReqData] = useState<Partial<Requester>>({
    name: '',
    type: 'pf',
    document: '',
    phone: '',
    address: '',
  })

  // Load Data
  const loadData = async () => {
    try {
      const [occData, teamData, alertData, reqData, munList] = await Promise.all([
        occurrencesService.list(),
        teamsService.list(),
        alertsService.list(),
        requestersService.list(),
        municipalitiesService.list().catch(() => []),
      ])
      setOccurrences(occData)
      setTeams(teamData)
      setAlerts(alertData)
      setRequesters(reqData)

      if (user?.municipality && munList.length > 0) {
        const foundMun = munList.find((m) => m.id === user.municipality)
        if (foundMun) {
          setCurrentMunicipality(foundMun)
          if (foundMun.latitude && foundMun.longitude) {
            setMapCenter([foundMun.latitude, foundMun.longitude])
          }
        }
      } else if (munList.length > 0) {
        setCurrentMunicipality(munList[0])
        if (munList[0].latitude && munList[0].longitude) {
          setMapCenter([munList[0].latitude, munList[0].longitude])
        }
      }

      // Handle deep-link
      const idParam = searchParams.get('id')
      if (idParam) {
        const found = occData.find((o) => o.id === idParam)
        if (found) {
          openDetailModal(found)
        }
      }

      if (searchParams.get('new') === 'true') {
        openCreateForm()
      }
    } catch (err) {
      console.error('Erro ao carregar ocorrências:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Real-time subscriptions
  useRealtime<Occurrence>('occurrences', () => loadData())
  useRealtime<Team>('teams', () => loadData())
  useRealtime<Alert>('alerts', () => loadData())
  useRealtime<Requester>('requesters', () => loadData())

  const loadOccurrenceFiles = async (occId: string) => {
    try {
      setIsLoadingFiles(true)
      const files = await occurrenceFilesService.listForOccurrence(occId)
      setCurrentFiles(files)
    } catch {
      // Ignora erro
    } finally {
      setIsLoadingFiles(false)
    }
  }

  const openDetailModal = (occ: Occurrence) => {
    setSelectedOccurrence(occ)
    setIsDetailOpen(true)
    loadOccurrenceFiles(occ.id)
  }

  const DRAFT_STORAGE_KEY = `defesa_civil_draft_occurrence_${user?.id || 'anon'}`

  const openCreateForm = () => {
    // Tenta carregar rascunho anterior salvo pelo usuário
    let draftData: Partial<Occurrence> | null = null
    try {
      const saved = localStorage.getItem(DRAFT_STORAGE_KEY)
      if (saved) {
        draftData = JSON.parse(saved)
      }
    } catch {
      /* intentionally ignored */
    }

    if (
      draftData &&
      (draftData.title || draftData.description || draftData.latitude || draftData.address)
    ) {
      setFormData({
        ...draftData,
        reported_by: user?.id,
        municipality: user?.municipality,
      })
      if (draftData.postal_code) {
        setCepInput(draftData.postal_code)
      }
      toast({
        title: 'Rascunho restaurado',
        description: 'Dados da ocorrência em edição foram recuperados automaticamente.',
      })
    } else {
      // 100% VAZIO: Nenhum valor de latitude/longitude nem endereço fictício!
      setFormData({
        title: '',
        description: '',
        type: 'enchente',
        severity: 'alta',
        status: 'reportada',
        origin: '199',
        requester: '',
        latitude: undefined,
        longitude: undefined,
        address: '',
        street: '',
        number: '',
        neighborhood: '',
        city: '',
        state: '',
        postal_code: '',
        complement: '',
        reference_point: '',
        location_origin: undefined,
        location_accuracy: undefined,
        address_confirmed: false,
        affectable_population: 0,
        reported_by: user?.id,
        municipality: user?.municipality,
      })
      setCepInput('')
    }
    setGpsWarning(null)
    setSelectedOccurrence(null)
    setIsFormOpen(true)
  }

  const openEditForm = (occ: Occurrence) => {
    setSelectedOccurrence(occ)
    setFormData({
      ...occ,
    })
    setCepInput(occ.postal_code || '')
    setGpsWarning(null)
    setIsFormOpen(true)
  }

  // Salvar rascunho no localStorage
  const saveDraft = (data: Partial<Occurrence>) => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(data))
    } catch {
      /* intentionally ignored */
    }
  }

  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY)
    } catch {
      /* intentionally ignored */
    }
  }

  // 1) BOTÃO "USAR MINHA LOCALIZAÇÃO ATUAL" (GPS real com accuracy e reverse geocode)
  const handleUseCurrentLocation = async () => {
    setIsCapturingGps(true)
    setGpsWarning(null)
    try {
      const pos = await getCurrentPositionWithAccuracy()
      const lat = pos.latitude
      const lng = pos.longitude
      const accuracy = pos.accuracy

      let warning: string | null = null
      if (accuracy > 100) {
        warning = `Atenção: A precisão estimada do GPS é aproximada (±${accuracy}m). Recomenda-se confirmar o ponto no mapa interativo.`
      }
      setGpsWarning(warning)

      let updatedData: Partial<Occurrence> = {
        ...formData,
        latitude: lat,
        longitude: lng,
        location_origin: 'gps',
        location_accuracy: accuracy,
      }

      toast({
        title: 'Localização GPS obtida!',
        description: `Coordenadas: ${lat.toFixed(6)}, ${lng.toFixed(6)} (Precisão: ±${accuracy}m). Identificando endereço...`,
      })

      // Tenta geocodificação reversa se houver internet
      if (navigator.onLine) {
        try {
          const rev = await reverseGeocode(lat, lng)
          if (rev) {
            // Só preenche se o usuário ainda não confirmou manualmente outro endereço
            const hasManualAddress =
              formData.address_confirmed && (formData.street?.trim() || formData.address?.trim())

            if (!hasManualAddress) {
              updatedData = {
                ...updatedData,
                address: rev.formattedAddress,
                street: rev.street || updatedData.street || '',
                number: rev.number || updatedData.number || '',
                neighborhood: rev.neighborhood || updatedData.neighborhood || '',
                city: rev.city || updatedData.city || '',
                state: rev.state || updatedData.state || '',
                postal_code: rev.postal_code || updatedData.postal_code || '',
              }
              if (rev.postal_code) {
                setCepInput(rev.postal_code)
              }
              toast({
                title: 'Endereço sugerido a partir do GPS',
                description: `${rev.formattedAddress}. Revise e confirme os campos.`,
              })
            }
          } else {
            toast({
              title: 'Coordenadas salvas',
              description:
                'Não foi possível identificar o endereço textual correspondente. Preencha manualmente.',
            })
          }
        } catch {
          // Erro silencioso em geocode não impede captura do GPS
        }
      }

      setFormData(updatedData)
      saveDraft(updatedData)
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao obter GPS',
        description:
          err.message ||
          'Não foi possível acessar a localização do dispositivo. Verifique a permissão do navegador ou selecione no mapa.',
      })
    } finally {
      setIsCapturingGps(false)
    }
  }

  // 2) SELEÇÃO MANUAL NO MAPA (Clique ou arraste)
  const handleMapPick = async (lat: number, lng: number) => {
    let updatedData: Partial<Occurrence> = {
      ...formData,
      latitude: lat,
      longitude: lng,
      location_origin: 'mapa',
      location_accuracy: undefined,
    }

    setFormData(updatedData)
    saveDraft(updatedData)

    toast({
      title: 'Ponto selecionado no mapa',
      description: `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}. Consultando endereço...`,
    })

    if (navigator.onLine) {
      try {
        const rev = await reverseGeocode(lat, lng)
        if (rev) {
          const hasManualAddress =
            formData.address_confirmed && (formData.street?.trim() || formData.address?.trim())
          if (!hasManualAddress) {
            updatedData = {
              ...updatedData,
              address: rev.formattedAddress,
              street: rev.street || updatedData.street || '',
              number: rev.number || updatedData.number || '',
              neighborhood: rev.neighborhood || updatedData.neighborhood || '',
              city: rev.city || updatedData.city || '',
              state: rev.state || updatedData.state || '',
              postal_code: rev.postal_code || updatedData.postal_code || '',
            }
            if (rev.postal_code) {
              setCepInput(rev.postal_code)
            }
            setFormData(updatedData)
            saveDraft(updatedData)
            toast({
              title: 'Endereço sugerido',
              description: rev.formattedAddress,
            })
          }
        }
      } catch {
        /* intentionally ignored */
      }
    }
  }

  // 3) CONSULTA POR CEP (ViaCEP)
  const handleSearchCep = async () => {
    const cleanCep = cepInput.replace(/\D/g, '')
    if (cleanCep.length !== 8) {
      toast({
        variant: 'destructive',
        title: 'CEP Inválido',
        description: 'Informe um CEP válido com 8 dígitos numéricos.',
      })
      return
    }

    setIsSearchingCep(true)
    try {
      const data = await fetchViaCep(cleanCep)
      if (!data) {
        toast({ variant: 'destructive', title: 'CEP não encontrado no ViaCEP' })
        return
      }

      const fullAddr = [
        data.logradouro ? data.logradouro : '',
        data.bairro ? `Bairro: ${data.bairro}` : '',
        `${data.localidade} - ${data.uf}`,
        `CEP: ${data.cep}`,
      ]
        .filter(Boolean)
        .join(', ')

      const updatedData: Partial<Occurrence> = {
        ...formData,
        address: fullAddr,
        street: data.logradouro || formData.street || '',
        neighborhood: data.bairro || formData.neighborhood || '',
        city: data.localidade || formData.city || '',
        state: data.uf || formData.state || '',
        postal_code: data.cep || formData.postal_code || '',
        location_origin: formData.latitude ? formData.location_origin : 'cep',
      }

      setFormData(updatedData)
      saveDraft(updatedData)
      toast({
        title: 'Endereço localizado via CEP!',
        description: `${data.logradouro || 'Logradouro'}, ${data.bairro || ''} - ${data.localidade}/${data.uf}`,
      })

      // Geocodificação direta opcional a partir do CEP + Logradouro se ainda não houver coordenadas
      if (!formData.latitude && navigator.onLine) {
        try {
          const direct = await forwardGeocode(
            `${data.logradouro || ''}, ${data.localidade}, ${data.uf}`,
            data.localidade,
          )
          if (direct.length > 0) {
            const best = direct[0]
            const withCoords = {
              ...updatedData,
              latitude: best.latitude,
              longitude: best.longitude,
              location_origin: 'cep' as LocationOrigin,
            }
            setFormData(withCoords)
            saveDraft(withCoords)
            toast({
              title: 'Coordenadas aproximadas localizadas via CEP',
              description: `${best.latitude.toFixed(5)}, ${best.longitude.toFixed(5)}`,
            })
          }
        } catch {
          /* intentionally ignored */
        }
      }
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Falha na busca de CEP',
        description: getErrorMessage(err),
      })
    } finally {
      setIsSearchingCep(false)
    }
  }

  // 4) GEOCODIFICAÇÃO DIRETA (Endereço manual digitado -> Coordenadas)
  const handleGeocode = async () => {
    const query =
      formData.address?.trim() ||
      [formData.street, formData.number, formData.neighborhood, formData.city, formData.state]
        .filter(Boolean)
        .join(', ')

    if (!query) {
      toast({
        variant: 'destructive',
        title: 'Endereço incompleto',
        description: 'Informe um endereço, rua ou CEP primeiro.',
      })
      return
    }

    setIsGeocoding(true)
    try {
      const results = await forwardGeocode(query, formData.city || currentMunicipality?.city)
      if (results.length > 0) {
        const best = results[0]
        const updated = {
          ...formData,
          latitude: best.latitude,
          longitude: best.longitude,
          location_origin: 'geocoding' as LocationOrigin,
        }
        setFormData(updated)
        saveDraft(updated)
        toast({
          title: 'Coordenadas encontradas no mapa!',
          description: `Lat: ${best.latitude.toFixed(6)}, Lng: ${best.longitude.toFixed(6)}`,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'Endereço não localizado no mapa',
          description:
            'Tente informar a cidade ou clique diretamente no mapa para posicionar o marcador.',
        })
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao buscar coordenadas',
        description: getErrorMessage(err),
      })
    } finally {
      setIsGeocoding(false)
    }
  }

  // Limpar localização do formulário
  const handleClearLocation = () => {
    const updated = {
      ...formData,
      latitude: undefined,
      longitude: undefined,
      location_origin: undefined,
      location_accuracy: undefined,
    }
    setFormData(updated)
    saveDraft(updated)
    setGpsWarning(null)
    toast({ title: 'Coordenadas removidas do formulário' })
  }

  // Save Occurrence
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title?.trim()) {
      toast({ variant: 'destructive', title: 'Título é obrigatório' })
      return
    }

    try {
      // Montar endereço composto se o usuário preencheu campos separados
      let fullAddr = formData.address?.trim()
      if (!fullAddr && (formData.street || formData.neighborhood || formData.city)) {
        const parts = [
          formData.street
            ? `${formData.street}${formData.number ? ', ' + formData.number : ''}`
            : '',
          formData.neighborhood ? `Bairro: ${formData.neighborhood}` : '',
          formData.city ? `${formData.city}${formData.state ? ' - ' + formData.state : ''}` : '',
          formData.postal_code ? `CEP: ${formData.postal_code}` : '',
        ].filter(Boolean)
        fullAddr = parts.join(', ')
      }

      const payload = {
        ...formData,
        address: fullAddr || formData.address || '',
        location_origin: formData.latitude
          ? formData.location_origin || 'manual'
          : formData.location_origin || 'manual',
      }

      if (selectedOccurrence) {
        // Update
        if (payload.status === 'concluida' && !payload.resolved_at) {
          payload.resolved_at = new Date().toISOString()
        }
        await occurrencesService.update(selectedOccurrence.id, payload)
        clearDraft()
        toast({ title: 'Ocorrência atualizada com sucesso' })
      } else {
        // Create (online ou offline)
        const agentName = user?.name || 'Agente'
        const created = await occurrencesService.create(
          {
            ...payload,
            reported_by: user?.id,
            municipality: user?.municipality,
          },
          agentName,
        )

        clearDraft()
        const isOfflineCreated = created.id.startsWith('temp_') || created.code?.startsWith('OFF-')
        toast({
          title: isOfflineCreated
            ? 'Ocorrência salva offline com sucesso!'
            : 'Ocorrência registrada com sucesso',
          description: isOfflineCreated
            ? `Código provisório: ${created.code}. Será sincronizada e receberá numeração oficial atômica automaticamente ao reconectar.`
            : `Código oficial gerado: ${created.code || created.id}`,
        })

        // Prompt alert creation if critical
        if (formData.severity === 'critica') {
          toast({
            title: 'Ocorrência Crítica Registrada',
            description: 'Deseja gerar um alerta emergencial para a população?',
            action: (
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() =>
                  navigate(
                    `/alertas?new=true&type=${formData.type}&severity=perigo_extremo&target=${encodeURIComponent(
                      formData.address || '',
                    )}&title=${encodeURIComponent(formData.title || '')}&related=${created.id}`,
                  )
                }
              >
                Criar Alerta
              </Button>
            ),
          })
        }
      }
      setIsFormOpen(false)
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar ocorrência',
        description: getErrorMessage(err),
      })
    }
  }

  // Delete
  const handleDelete = async () => {
    if (!selectedOccurrence) return
    try {
      await occurrencesService.delete(selectedOccurrence.id)
      toast({ title: 'Ocorrência excluída com sucesso' })
      setIsDeleteModalOpen(false)
      setIsDetailOpen(false)
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: getErrorMessage(err),
      })
    }
  }

  // Status Change with Role Permission Check
  const handleStatusChange = async (occ: Occurrence, newStatus: OccurrenceStatus) => {
    // Regra: Agente não pode reabrir
    const isReopening =
      (occ.status === 'concluida' || occ.status === 'cancelada') &&
      (newStatus === 'reportada' || newStatus === 'em_andamento')

    if (isReopening && user?.role === 'agente') {
      toast({
        variant: 'destructive',
        title: 'Ação não permitida',
        description:
          'Apenas Coordenadores ou Administradores podem reabrir ocorrências finalizadas.',
      })
      return
    }

    try {
      const payload: Partial<Occurrence> = { status: newStatus }
      if (newStatus === 'concluida') {
        payload.resolved_at = new Date().toISOString()
      }
      await occurrencesService.update(occ.id, payload)
      toast({ title: `Status alterado para ${STATUS_LABELS[newStatus]}` })
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
        description: getErrorMessage(err),
      })
    }
  }

  // File Upload Handlers (Gallery/File and Camera PWA) com fila offline segura
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !selectedOccurrence) return

    try {
      setIsUploadingFile(true)
      const isOnline = navigator.onLine

      if (!isOnline || selectedOccurrence.id.startsWith('temp_')) {
        // Requisito 4: Anexos offline ficam em fila local.
        // Após reconexão: (1) confirmar registro principal; (2) enviar arquivos; (3) vincular; (4) confirmar; (5) remover da fila
        const { offlineSyncManager } = await import('@/services/offline-sync')
        await offlineSyncManager.saveOccurrenceFileOffline({
          occurrenceIdOrClientUuid: selectedOccurrence.id,
          fileBlob: file,
          fileName: file.name,
          fileType: file.type.startsWith('image/') ? 'foto' : 'documento',
          caption: file.name,
        })
        toast({
          title: 'Foto/Arquivo armazenado localmente!',
          description:
            'O arquivo está em fila segura no dispositivo e será enviado assim que a conexão for reestabelecida.',
        })
      } else {
        const form = new FormData()
        form.append('file', file)
        form.append('occurrence', selectedOccurrence.id)
        form.append('municipality', selectedOccurrence.municipality || user?.municipality || '')
        form.append('uploaded_by', user?.id || '')

        const isImage = file.type.startsWith('image/')
        form.append('file_type', isImage ? 'foto' : 'documento')
        form.append('caption', file.name)

        await occurrenceFilesService.upload(form)
        toast({ title: 'Anexo adicionado com sucesso!' })
        loadOccurrenceFiles(selectedOccurrence.id)
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar anexo',
        description: getErrorMessage(err),
      })
    } finally {
      setIsUploadingFile(false)
      if (e.target) e.target.value = ''
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    try {
      await occurrenceFilesService.delete(fileId)
      toast({ title: 'Anexo excluído' })
      if (selectedOccurrence) {
        loadOccurrenceFiles(selectedOccurrence.id)
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir anexo',
        description: getErrorMessage(err),
      })
    }
  }

  // Quick Requester Submit
  const handleQuickRequesterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickReqData.name || !quickReqData.document) {
      toast({ variant: 'destructive', title: 'Nome e CPF/CNPJ são obrigatórios' })
      return
    }

    try {
      const created = await requestersService.create({
        ...quickReqData,
        municipality: user?.municipality,
      })
      setRequesters((prev) => [created, ...prev])
      setFormData((prev) => ({ ...prev, requester: created.id }))
      setIsQuickRequesterOpen(false)
      toast({ title: 'Requerente cadastrado e selecionado!' })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao cadastrar requerente',
        description: getErrorMessage(err),
      })
    }
  }

  // Identificação não destrutiva de ocorrências possivelmente com coordenadas demo (-23.5505, -46.6333)
  const suspiciousDemoOccurrences = occurrences.filter((occ) => {
    if (occ.latitude === undefined || occ.longitude === undefined) return false
    const dLat = Math.abs(occ.latitude - -23.5505)
    const dLng = Math.abs(occ.longitude - -46.6333)
    return dLat < 0.0005 && dLng < 0.0005
  })

  // Filter list
  const filteredOccurrences = occurrences.filter((occ) => {
    const matchText =
      !searchText ||
      occ.title.toLowerCase().includes(searchText.toLowerCase()) ||
      occ.description?.toLowerCase().includes(searchText.toLowerCase()) ||
      occ.address?.toLowerCase().includes(searchText.toLowerCase()) ||
      (occ.code && occ.code.toLowerCase().includes(searchText.toLowerCase()))

    const matchType = selectedType === 'all' || occ.type === selectedType
    const matchSeverity = selectedSeverity === 'all' || occ.severity === selectedSeverity
    const matchStatus = selectedStatus === 'all' || occ.status === selectedStatus
    const matchOrigin = selectedOrigin === 'all' || occ.origin === selectedOrigin

    return matchText && matchType && matchSeverity && matchStatus && matchOrigin
  })

  // Pagination calculation
  const totalPages = Math.ceil(filteredOccurrences.length / itemsPerPage) || 1
  const paginatedOccurrences = filteredOccurrences.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  )

  const linkedTeams = selectedOccurrence
    ? teams.filter((t) => t.current_occurrence === selectedOccurrence.id)
    : []
  const linkedAlerts = selectedOccurrence
    ? alerts.filter((a) => a.related_occurrence === selectedOccurrence.id)
    : []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Title and Create Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Gestão de Ocorrências e Incidentes
          </h2>
          <p className="text-xs text-slate-500">
            Registro com numeração oficial automática, georreferenciamento auditável, triagem e
            despacho de campo.
          </p>
        </div>

        <Button
          onClick={openCreateForm}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-10 px-4 rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Registrar Nova Ocorrência
        </Button>
      </div>

      {/* Alerta Não Destrutivo de Ocorrências com Coordenadas Padrão de Demonstração (-23.5505, -46.6333) */}
      {suspiciousDemoOccurrences.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-2.5">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900">
                Auditoria de Coordenadas: {suspiciousDemoOccurrences.length} registro(s) com
                coordenadas padrão de demonstração (-23.5505, -46.6333)
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">
                Ocorrências cadastradas em versões anteriores podem ter herdado coordenadas fixas de
                São Paulo. Seus registros estão preservados. Você pode clicar para conferir e
                retificar no mapa quando desejar.
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {suspiciousDemoOccurrences.slice(0, 5).map((occ) => (
                  <button
                    key={occ.id}
                    onClick={() => openDetailModal(occ)}
                    className="font-mono text-[10px] font-bold bg-white text-amber-900 border border-amber-300 px-2 py-0.5 rounded hover:bg-amber-100"
                  >
                    {occ.code || occ.id}: {occ.title.slice(0, 20)}...
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar código OC-..., título..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9 h-9 text-xs rounded-lg"
              />
            </div>

            {/* Type Filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Tipo de Desastre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {Object.keys(TYPE_LABELS).map((key) => (
                  <SelectItem key={key} value={key}>
                    {TYPE_LABELS[key as OccurrenceType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Severity Filter */}
            <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Severidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Severidades</SelectItem>
                <SelectItem value="critica">Crítica (Extremo)</SelectItem>
                <SelectItem value="alta">Alta (Perigo)</SelectItem>
                <SelectItem value="media">Média (Alerta)</SelectItem>
                <SelectItem value="baixa">Baixa (Informativo)</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="reportada">Reportada</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>

            {/* Origin Filter */}
            <Select value={selectedOrigin} onValueChange={setSelectedOrigin}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Origens</SelectItem>
                {Object.keys(ORIGIN_LABELS).map((key) => (
                  <SelectItem key={key} value={key}>
                    {ORIGIN_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Table View */}
      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="text-xs font-bold text-slate-700">Código</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">
                  Tipo & Ocorrência
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Origem</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Localização</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Severidade</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Status</TableHead>
                <TableHead className="text-xs font-bold text-slate-700 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {paginatedOccurrences.map((occ) => (
                <TableRow
                  key={occ.id}
                  onClick={() => openDetailModal(occ)}
                  className="cursor-pointer hover:bg-slate-50/90 transition-colors"
                >
                  <TableCell className="py-3.5 font-mono text-xs font-bold text-blue-700 whitespace-nowrap">
                    {occ.code || '—'}
                  </TableCell>

                  <TableCell className="py-3.5">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-slate-100 shrink-0 mt-0.5">
                        {getHazardIcon(occ.type, 'w-4 h-4')}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 line-clamp-1">{occ.title}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          {occ.description || 'Sem descrição.'}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                    <Badge variant="outline" className="text-[10px] bg-slate-50">
                      {ORIGIN_LABELS[occ.origin || '199'] || occ.origin || '199'}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-xs text-slate-600 font-medium">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span
                        className="truncate max-w-[180px]"
                        title={occ.address || 'Sem localização'}
                      >
                        {occ.address
                          ? occ.address
                          : occ.latitude && occ.longitude
                            ? `${occ.latitude.toFixed(4)}, ${occ.longitude.toFixed(4)}`
                            : 'Localização não informada'}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <SeverityBadge severity={occ.severity} />
                  </TableCell>

                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={occ.status}
                      onValueChange={(val) => handleStatusChange(occ, val as OccurrenceStatus)}
                    >
                      <SelectTrigger className="h-7 text-xs w-36 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reportada">Reportada</SelectItem>
                        <SelectItem value="em_andamento">Em Andamento</SelectItem>
                        <SelectItem value="concluida">Concluída</SelectItem>
                        <SelectItem value="cancelada">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setSelectedOccurrence(occ)
                          setIsPrintModalOpen(true)
                        }}
                        className="w-8 h-8 text-slate-600 hover:text-indigo-600"
                        title="Imprimir Relatório Oficial / PDF"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditForm(occ)}
                        className="w-8 h-8 text-slate-600 hover:text-blue-600"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setSelectedOccurrence(occ)
                          setIsDeleteModalOpen(true)
                        }}
                        className="w-8 h-8 text-slate-600 hover:text-red-600"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {filteredOccurrences.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    Nenhuma ocorrência encontrada para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {filteredOccurrences.length > itemsPerPage && (
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs">
            <span className="text-slate-500">
              Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, filteredOccurrences.length)}{' '}
              a {Math.min(currentPage * itemsPerPage, filteredOccurrences.length)} de{' '}
              {filteredOccurrences.length} ocorrências
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 text-xs bg-white"
              >
                Anterior
              </Button>
              <span className="px-2 font-semibold text-slate-700">
                Pág {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 text-xs bg-white"
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail Modal with Code, Photos/Docs, and Reopening Actions */}
      {isDetailOpen && selectedOccurrence && (
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 mt-0.5">
                    {getHazardIcon(selectedOccurrence.type, 'w-5 h-5')}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                        {selectedOccurrence.code || 'SEM CÓDIGO'}
                      </span>
                      <DialogTitle className="text-base font-bold text-slate-900 leading-tight">
                        {selectedOccurrence.title}
                      </DialogTitle>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Registrado em {new Date(selectedOccurrence.created).toLocaleString('pt-BR')} •
                      Origem:{' '}
                      <strong className="text-slate-700">
                        {ORIGIN_LABELS[selectedOccurrence.origin || '199'] ||
                          selectedOccurrence.origin}
                      </strong>
                    </p>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 text-xs py-2">
              {/* Badges strip */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700">Severidade:</span>
                  <SeverityBadge severity={selectedOccurrence.severity} />
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="font-semibold text-slate-700">Status:</span>
                  <StatusBadge status={selectedOccurrence.status} />
                </div>
              </div>

              {/* Requerente Info if present */}
              {selectedOccurrence.expand?.requester && (
                <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-200 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-700" />
                    <div>
                      <p className="font-bold text-blue-900">
                        Requerente: {selectedOccurrence.expand.requester.name}
                      </p>
                      <p className="text-[11px] text-blue-700">
                        Doc: {selectedOccurrence.expand.requester.document} • Contato:{' '}
                        {selectedOccurrence.expand.requester.phone || '—'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-blue-300 text-blue-800 bg-white">
                    {selectedOccurrence.expand.requester.type === 'pj' ? 'PJ' : 'PF'}
                  </Badge>
                </div>
              )}

              {/* Description */}
              <div>
                <Label className="text-xs font-bold text-slate-700">Descrição do Ocorrido</Label>
                <p className="mt-1 p-3 bg-slate-50 rounded-lg text-slate-700 leading-relaxed border border-slate-200">
                  {selectedOccurrence.description || 'Nenhum detalhe adicional informado.'}
                </p>
              </div>

              {/* Anexos: Fotos e Documentos (Upload + Visualização) */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    Anexos e Fotos de Campo ({currentFiles.length})
                  </Label>

                  <div className="flex items-center gap-2">
                    {/* Botão Câmera Celular (PWA) */}
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      ref={cameraInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isUploadingFile}
                      onClick={() => cameraInputRef.current?.click()}
                      className="text-[11px] h-7 bg-white text-slate-700"
                      title="Tirar foto na câmera"
                    >
                      <Camera className="w-3.5 h-3.5 mr-1 text-blue-600" />
                      Câmera
                    </Button>

                    {/* Botão Galeria / Arquivo */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isUploadingFile}
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] h-7 bg-white text-slate-700"
                      title="Enviar arquivo ou foto do dispositivo"
                    >
                      <Paperclip className="w-3.5 h-3.5 mr-1 text-slate-600" />
                      Anexar Arquivo
                    </Button>
                  </div>
                </div>

                {isLoadingFiles ? (
                  <div className="py-4 text-center text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  </div>
                ) : currentFiles.length === 0 ? (
                  <p className="text-[11px] text-slate-500 py-2">
                    Nenhuma foto ou documento anexado a esta ocorrência ainda.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                    {currentFiles.map((fileRec) => {
                      const fileUrl = occurrenceFilesService.getFileUrl(fileRec, fileRec.file)
                      const isImg =
                        fileRec.file_type === 'foto' ||
                        /\.(jpg|jpeg|png|webp|gif)$/i.test(fileRec.file)

                      return (
                        <div
                          key={fileRec.id}
                          className="group relative bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col"
                        >
                          {isImg ? (
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="block h-24 overflow-hidden bg-slate-100"
                            >
                              <img
                                src={fileUrl}
                                alt={fileRec.caption || 'Foto'}
                                className="w-full h-full object-cover transition-transform group-hover:scale-105"
                              />
                            </a>
                          ) : (
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="h-24 flex flex-col items-center justify-center p-2 text-slate-600 bg-slate-50 hover:bg-slate-100"
                            >
                              <FileText className="w-8 h-8 text-slate-400 mb-1" />
                              <span className="text-[10px] font-medium text-center line-clamp-1">
                                {fileRec.caption || fileRec.file}
                              </span>
                            </a>
                          )}

                          <div className="p-1.5 flex items-center justify-between bg-white text-[10px] border-t border-slate-100">
                            <span className="text-slate-500 truncate max-w-[80px]">
                              {fileRec.caption || 'Anexo'}
                            </span>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteFile(fileRec.id)}
                              className="w-5 h-5 text-slate-400 hover:text-red-600"
                              title="Remover anexo"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Seção Clara: Localização da Ocorrência */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-red-600" />
                    Localização da Ocorrência
                  </Label>
                  {selectedOccurrence.location_origin && (
                    <Badge variant="outline" className="text-[10px] bg-white">
                      Origem:{' '}
                      {LOCATION_ORIGIN_LABELS[selectedOccurrence.location_origin] ||
                        selectedOccurrence.location_origin}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                      Endereço
                    </span>
                    <span className="text-slate-800 font-medium">
                      {selectedOccurrence.address || 'Endereço não informado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                      Ponto de Referência
                    </span>
                    <span className="text-slate-800">
                      {selectedOccurrence.reference_point || 'Não informado'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs pt-1 border-t border-slate-200/60">
                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                      Logradouro / Número
                    </span>
                    <span className="text-slate-800">
                      {selectedOccurrence.street
                        ? `${selectedOccurrence.street}${selectedOccurrence.number ? ', ' + selectedOccurrence.number : ''}`
                        : 'Não informado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                      Bairro
                    </span>
                    <span className="text-slate-800">
                      {selectedOccurrence.neighborhood || 'Não informado'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                      Município / CEP
                    </span>
                    <span className="text-slate-800">
                      {selectedOccurrence.city || '—'}{' '}
                      {selectedOccurrence.postal_code ? `(${selectedOccurrence.postal_code})` : ''}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200/60 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px] uppercase">
                      Coordenadas Geográficas
                    </span>
                    {selectedOccurrence.latitude !== undefined &&
                    selectedOccurrence.longitude !== undefined ? (
                      <span className="font-mono font-bold text-slate-900">
                        {selectedOccurrence.latitude.toFixed(6)},{' '}
                        {selectedOccurrence.longitude.toFixed(6)}
                        {selectedOccurrence.location_accuracy && (
                          <span className="text-[11px] text-slate-500 font-normal ml-1">
                            (Precisão: ±{selectedOccurrence.location_accuracy}m)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Coordenadas não informadas</span>
                    )}
                  </div>
                </div>

                {/* Mapa Leaflet se houver coordenadas */}
                {selectedOccurrence.latitude !== undefined &&
                selectedOccurrence.longitude !== undefined ? (
                  <div className="mt-2 rounded-lg overflow-hidden border border-slate-200">
                    <InteractiveMap
                      height="180px"
                      occurrences={[selectedOccurrence]}
                      center={[selectedOccurrence.latitude, selectedOccurrence.longitude]}
                      zoom={15}
                    />
                  </div>
                ) : (
                  <div className="p-3 bg-slate-100 rounded text-center text-slate-500 text-xs">
                    Nenhuma coordenada geográfica vinculada a esta ocorrência.
                  </div>
                )}
              </div>

              {/* Linked Teams & Alerts Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Linked Teams */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-purple-600" />
                    Equipes Mobilizadas ({linkedTeams.length})
                  </h4>
                  {linkedTeams.length > 0 ? (
                    <div className="space-y-1">
                      {linkedTeams.map((t) => (
                        <div key={t.id} className="text-[11px] text-slate-700 flex justify-between">
                          <span>{t.name}</span>
                          <span className="capitalize font-semibold text-purple-700">{t.type}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Nenhuma equipe vinculada a esta ocorrência.
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/equipes')}
                    className="w-full mt-2 text-[11px] h-7"
                  >
                    Atribuir Equipe
                  </Button>
                </div>

                {/* Linked Alerts */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-amber-600" />
                    Alertas Emitidos ({linkedAlerts.length})
                  </h4>
                  {linkedAlerts.length > 0 ? (
                    <div className="space-y-1">
                      {linkedAlerts.map((a) => (
                        <div key={a.id} className="text-[11px] text-slate-700 flex justify-between">
                          <span className="truncate max-w-[140px]">{a.title}</span>
                          <Badge variant="outline" className="text-[9px] capitalize">
                            {a.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Nenhum alerta disparado para este evento.
                    </p>
                  )}
                  <Button
                    size="sm"
                    className="w-full mt-2 text-[11px] h-7 bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() =>
                      navigate(
                        `/alertas?new=true&type=${selectedOccurrence.type}&severity=${
                          selectedOccurrence.severity === 'critica' ? 'perigo_extremo' : 'alerta'
                        }&target=${encodeURIComponent(
                          selectedOccurrence.address || '',
                        )}&title=${encodeURIComponent(
                          selectedOccurrence.title,
                        )}&related=${selectedOccurrence.id}`,
                      )
                    }
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Gerar Alerta com IA
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row justify-between gap-2 border-t pt-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteModalOpen(true)}
                className="w-full sm:w-auto"
              >
                Excluir
              </Button>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="w-full sm:w-auto gap-1 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir / Relatório PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDetailOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Fechar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setIsDetailOpen(false)
                    openEditForm(selectedOccurrence)
                  }}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Editar Ocorrência
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create / Edit Form Modal with CEP & Requerente */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {selectedOccurrence ? 'Editar Ocorrência' : 'Registrar Nova Ocorrência'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Numeração sequencial gerada automaticamente pelo servidor (ex. OC-2026-NNNNN).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            {/* Título & Código Existente */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label className="text-xs font-semibold text-slate-700">Título do Evento *</Label>
                {formData.code && (
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                    Código: {formData.code}
                  </span>
                )}
              </div>
              <Input
                required
                placeholder="Ex: Alagamento crítico na Bacia Central"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            {/* Origem do Atendimento & Requerente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Origem do Atendimento *
                </Label>
                <Select
                  value={formData.origin || '199'}
                  onValueChange={(val: OccurrenceOrigin) =>
                    setFormData({ ...formData, origin: val })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(ORIGIN_LABELS).map((key) => (
                      <SelectItem key={key} value={key}>
                        {ORIGIN_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs font-semibold text-slate-700">
                    Requerente / Vítima
                  </Label>
                  <button
                    type="button"
                    onClick={() => setIsQuickRequesterOpen(true)}
                    className="text-[11px] text-blue-600 hover:underline font-medium"
                  >
                    + Novo Requerente
                  </button>
                </div>
                <Select
                  value={formData.requester || 'none'}
                  onValueChange={(val) =>
                    setFormData({ ...formData, requester: val === 'none' ? undefined : val })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Selecione um requerente cadastrado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum / Não informado</SelectItem>
                    {requesters.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} ({r.document})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Tipo de Evento</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) => setFormData({ ...formData, type: val as OccurrenceType })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(TYPE_LABELS).map((key) => (
                      <SelectItem key={key} value={key}>
                        {TYPE_LABELS[key as OccurrenceType]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Severidade / Risco</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(val) =>
                    setFormData({ ...formData, severity: val as OccurrenceSeverity })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critica">Crítica (Extremo)</SelectItem>
                    <SelectItem value="alta">Alta (Perigo)</SelectItem>
                    <SelectItem value="media">Média (Alerta)</SelectItem>
                    <SelectItem value="baixa">Baixa (Informativo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Status Workflow</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) =>
                    setFormData({ ...formData, status: val as OccurrenceStatus })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reportada">Reportada</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* BLOCO DE LOCALIZAÇÃO AUDITÁVEL & GPS */}
            <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-1.5">
                    <Crosshair className="w-4 h-4 text-blue-600" />
                    <Label className="text-xs font-bold text-slate-800">
                      Localização Geográfica & Endereço da Ocorrência
                    </Label>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    O formulário inicia sem coordenadas fictícias. Use o GPS do aparelho, consulte
                    CEP ou clique no mapa.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleUseCurrentLocation}
                    disabled={isCapturingGps}
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs font-medium gap-1.5"
                  >
                    {isCapturingGps ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Compass className="w-3.5 h-3.5" />
                    )}
                    Usar Minha Localização Atual
                  </Button>

                  {(formData.latitude !== undefined || formData.longitude !== undefined) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearLocation}
                      className="h-8 text-xs text-red-600 hover:bg-red-50"
                    >
                      Limpar Coords
                    </Button>
                  )}
                </div>
              </div>

              {/* Aviso de precisão aproximada se houver */}
              {gpsWarning && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded text-amber-800 text-[11px] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>{gpsWarning}</span>
                </div>
              )}

              {/* CEP (ViaCEP) + Geocodificação Direta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">
                    Consulta de CEP (ViaCEP)
                  </Label>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="00000-000"
                      value={cepInput}
                      onChange={(e) => setCepInput(e.target.value)}
                      className="h-8 text-xs bg-white"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleSearchCep}
                      disabled={isSearchingCep}
                      className="h-8 text-xs bg-white shrink-0"
                    >
                      {isSearchingCep ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        'Buscar CEP'
                      )}
                    </Button>
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">
                    Endereço Completo / Formatado
                  </Label>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="Rua, número, bairro, cidade (ou gerado via GPS/mapa)"
                      value={formData.address || ''}
                      onChange={(e) => {
                        setFormData({
                          ...formData,
                          address: e.target.value,
                          address_confirmed: true,
                        })
                        saveDraft({ ...formData, address: e.target.value, address_confirmed: true })
                      }}
                      className="h-8 text-xs bg-white"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGeocode}
                      disabled={
                        isGeocoding || (!formData.address?.trim() && !formData.street?.trim())
                      }
                      className="h-8 shrink-0 text-xs whitespace-nowrap bg-white"
                      title="Localizar coordenadas a partir do endereço digitado"
                    >
                      {isGeocoding ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <MapPin className="w-3.5 h-3.5 mr-1" />
                      )}
                      Geocodificar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Campos Estruturados de Endereço (Não inventa dados) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-200/60">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-[11px] font-semibold text-slate-700">
                    Logradouro / Rua
                  </Label>
                  <Input
                    placeholder="Nome da via"
                    value={formData.street || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, street: e.target.value, address_confirmed: true })
                      saveDraft({ ...formData, street: e.target.value, address_confirmed: true })
                    }}
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Número</Label>
                  <Input
                    placeholder="S/N ou número"
                    value={formData.number || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, number: e.target.value, address_confirmed: true })
                      saveDraft({ ...formData, number: e.target.value, address_confirmed: true })
                    }}
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Bairro</Label>
                  <Input
                    placeholder="Bairro identificado ou digitado"
                    value={formData.neighborhood || ''}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        neighborhood: e.target.value,
                        address_confirmed: true,
                      })
                      saveDraft({
                        ...formData,
                        neighborhood: e.target.value,
                        address_confirmed: true,
                      })
                    }}
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Município</Label>
                  <Input
                    placeholder="Cidade"
                    value={formData.city || currentMunicipality?.city || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, city: e.target.value, address_confirmed: true })
                      saveDraft({ ...formData, city: e.target.value, address_confirmed: true })
                    }}
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Estado / UF</Label>
                  <Input
                    placeholder="UF (ex: SP)"
                    maxLength={2}
                    value={formData.state || currentMunicipality?.state || ''}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        state: e.target.value.toUpperCase(),
                        address_confirmed: true,
                      })
                      saveDraft({
                        ...formData,
                        state: e.target.value.toUpperCase(),
                        address_confirmed: true,
                      })
                    }}
                    className="h-8 text-xs bg-white uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Complemento</Label>
                  <Input
                    placeholder="Apto, Bloco, Km de rodovia..."
                    value={formData.complement || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, complement: e.target.value })
                      saveDraft({ ...formData, complement: e.target.value })
                    }}
                    className="h-8 text-xs bg-white"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">
                    Ponto de Referência
                  </Label>
                  <Input
                    placeholder="Próximo à ponte, em frente à igreja..."
                    value={formData.reference_point || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, reference_point: e.target.value })
                      saveDraft({ ...formData, reference_point: e.target.value })
                    }}
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>

              {/* Status da Origem e Conferência */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white rounded border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-semibold text-[11px]">Origem:</span>
                  <Badge variant="outline" className="text-[10px] bg-slate-50">
                    {formData.location_origin
                      ? LOCATION_ORIGIN_LABELS[formData.location_origin] || formData.location_origin
                      : 'Não informada'}
                  </Badge>
                  {formData.location_accuracy && (
                    <span className="text-[11px] text-slate-500">
                      (Precisão: ±{formData.location_accuracy}m)
                    </span>
                  )}
                </div>

                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-700 font-medium">
                  <input
                    type="checkbox"
                    checked={!!formData.address_confirmed}
                    onChange={(e) => {
                      setFormData({ ...formData, address_confirmed: e.target.checked })
                      saveDraft({ ...formData, address_confirmed: e.target.checked })
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Endereço verificado e conferido pelo agente</span>
                </label>
              </div>

              {/* Coordenadas e População */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Sem coordenada"
                    value={formData.latitude ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : Number(e.target.value)
                      const updated = {
                        ...formData,
                        latitude: val,
                        location_origin:
                          val !== undefined ? formData.location_origin || 'manual' : undefined,
                      }
                      setFormData(updated)
                      saveDraft(updated)
                    }}
                    className="h-8 text-xs bg-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="Sem coordenada"
                    value={formData.longitude ?? ''}
                    onChange={(e) => {
                      const val = e.target.value === '' ? undefined : Number(e.target.value)
                      const updated = {
                        ...formData,
                        longitude: val,
                        location_origin:
                          val !== undefined ? formData.location_origin || 'manual' : undefined,
                      }
                      setFormData(updated)
                      saveDraft(updated)
                    }}
                    className="h-8 text-xs bg-white font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-[11px] font-semibold text-slate-700">
                    População Estimada Afetada
                  </Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData.affectable_population ?? ''}
                    onChange={(e) => {
                      setFormData({ ...formData, affectable_population: Number(e.target.value) })
                      saveDraft({ ...formData, affectable_population: Number(e.target.value) })
                    }}
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>

              {/* Mini Mapa Leaflet para Seleção / Correção Manual */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    Posicionar Marcador no Mapa (Clique para selecionar ou ajustar)
                  </Label>
                  <span className="text-[11px] font-mono text-slate-500">
                    {formData.latitude !== undefined && formData.longitude !== undefined
                      ? `Lat: ${formData.latitude.toFixed(5)}, Lng: ${formData.longitude.toFixed(5)}`
                      : 'Nenhum ponto marcado'}
                  </span>
                </div>

                <div className="rounded-lg overflow-hidden border border-slate-200">
                  <InteractiveMap
                    height="220px"
                    interactivePick={true}
                    showLayerToggles={false}
                    pickedCoordinate={
                      formData.latitude !== undefined && formData.longitude !== undefined
                        ? { lat: formData.latitude, lng: formData.longitude }
                        : null
                    }
                    onPickCoordinate={handleMapPick}
                    center={
                      formData.latitude !== undefined && formData.longitude !== undefined
                        ? [formData.latitude, formData.longitude]
                        : mapCenter
                    }
                    zoom={formData.latitude !== undefined ? 15 : 13}
                  />
                </div>
                <p className="text-[10px] text-slate-400 italic">
                  * A centralização visual do mapa não grava coordenadas na ocorrência até que você
                  clique no mapa, use o GPS ou informe o endereço.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Descrição e Relatório de Campo
              </Label>
              <Textarea
                rows={3}
                placeholder="Descreva a situação observada, danos materiais, vítimas e riscos iminentes..."
                value={formData.description || ''}
                onChange={(e) => {
                  setFormData({ ...formData, description: e.target.value })
                  saveDraft({ ...formData, description: e.target.value })
                }}
                className="text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                {selectedOccurrence ? 'Salvar Alterações' : 'Cadastrar Ocorrência'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Requester Modal */}
      <Dialog open={isQuickRequesterOpen} onOpenChange={setIsQuickRequesterOpen}>
        <DialogContent className="max-w-md bg-white">
          <form onSubmit={handleQuickRequesterSubmit} className="space-y-3">
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-slate-900">
                Cadastro Rápido de Requerente
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Cadastre o cidadão ou entidade para vincular a esta ocorrência.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px]">Tipo *</Label>
                <Select
                  value={quickReqData.type || 'pf'}
                  onValueChange={(val: 'pf' | 'pj') =>
                    setQuickReqData({ ...quickReqData, type: val })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pf">Pessoa Física (PF)</SelectItem>
                    <SelectItem value="pj">Pessoa Jurídica (PJ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px]">CPF / CNPJ *</Label>
                <Input
                  required
                  placeholder="Documento"
                  value={quickReqData.document || ''}
                  onChange={(e) => setQuickReqData({ ...quickReqData, document: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">Nome / Razão Social *</Label>
              <Input
                required
                placeholder="Nome do requerente"
                value={quickReqData.name || ''}
                onChange={(e) => setQuickReqData({ ...quickReqData, name: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[11px]">Telefone de Contato</Label>
              <Input
                placeholder="(00) 00000-0000"
                value={quickReqData.phone || ''}
                onChange={(e) => setQuickReqData({ ...quickReqData, phone: e.target.value })}
                className="h-8 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsQuickRequesterOpen(false)}
                className="text-xs"
              >
                Voltar
              </Button>
              <Button type="submit" size="sm" className="bg-blue-600 text-white text-xs">
                Cadastrar e Selecionar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Confirmar Exclusão de Ocorrência
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir esta ocorrência ({selectedOccurrence?.title})? Esta
              ação ficará gravada na trilha de auditoria municipal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Excluir Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Impressão Oficial e Exportação PDF da Ocorrência */}
      <OccurrencePrintView
        occurrence={selectedOccurrence}
        municipality={currentMunicipality}
        files={currentFiles}
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
      />
    </div>
  )
}
