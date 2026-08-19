import React, { useEffect, useState } from 'react'
import {
  Users,
  Plus,
  Search,
  Radio,
  UserCheck,
  Shield,
  Activity,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Edit2,
  Trash2,
  Phone,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { TeamStatusBadge, TEAM_STATUS_LABELS } from '@/components/defesa-civil/StatusBadges'
import { teamsService, occurrencesService, getErrorMessage } from '@/services/defesa-civil'
import type { Team, TeamType, TeamStatus, Occurrence } from '@/types/defesa-civil'
import { useRealtime } from '@/hooks/use-realtime'
import { useToast } from '@/hooks/use-toast'

export const TeamsPage: React.FC = () => {
  const { toast } = useToast()
  const [teams, setTeams] = useState<Team[]>([])
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchText, setSearchText] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isMobilizeOpen, setIsMobilizeOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [mobilizeOccurrenceId, setMobilizeOccurrenceId] = useState('')

  // Form state
  const [formData, setFormData] = useState<Partial<Team>>({
    name: '',
    type: 'resgate',
    leader_name: '',
    member_count: 4,
    status: 'disponivel',
    latitude: -23.5505,
    longitude: -46.6333,
  })

  const loadData = async () => {
    try {
      const [teamData, occData] = await Promise.all([
        teamsService.list(),
        occurrencesService.list(),
      ])
      setTeams(teamData)
      setOccurrences(occData)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useRealtime<Team>('teams', () => loadData())
  useRealtime<Occurrence>('occurrences', () => loadData())

  const openCreate = () => {
    setSelectedTeam(null)
    setFormData({
      name: '',
      type: 'resgate',
      leader_name: '',
      member_count: 4,
      status: 'disponivel',
      latitude: -23.5505,
      longitude: -46.6333,
    })
    setIsFormOpen(true)
  }

  const openEdit = (t: Team) => {
    setSelectedTeam(t)
    setFormData({ ...t })
    setIsFormOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name?.trim()) {
      toast({ variant: 'destructive', title: 'Nome da equipe é obrigatório' })
      return
    }

    try {
      if (selectedTeam) {
        await teamsService.update(selectedTeam.id, formData)
        toast({ title: 'Equipe atualizada com sucesso' })
      } else {
        await teamsService.create(formData)
        toast({ title: 'Equipe cadastrada com sucesso' })
      }
      setIsFormOpen(false)
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar equipe',
        description: getErrorMessage(err),
      })
    }
  }

  const handleDelete = async () => {
    if (!selectedTeam) return
    try {
      await teamsService.delete(selectedTeam.id)
      toast({ title: 'Equipe removida com sucesso' })
      setIsDeleteOpen(false)
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao remover',
        description: getErrorMessage(err),
      })
    }
  }

  // Mobilize team to occurrence
  const handleMobilize = async () => {
    if (!selectedTeam) return
    try {
      await teamsService.update(selectedTeam.id, {
        status: 'em_operacao',
        current_occurrence: mobilizeOccurrenceId || null,
      })
      toast({
        title: 'Equipe Mobilizada com Sucesso',
        description: `${selectedTeam.name} foi despachada para a operação.`,
      })
      setIsMobilizeOpen(false)
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao mobilizar equipe',
        description: getErrorMessage(err),
      })
    }
  }

  // Demobilize team
  const handleDemobilize = async (team: Team) => {
    try {
      await teamsService.update(team.id, {
        status: 'disponivel',
        current_occurrence: null,
      })
      toast({
        title: 'Operação Encerrada',
        description: `${team.name} está agora disponível na base.`,
      })
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao encerrar operação',
        description: getErrorMessage(err),
      })
    }
  }

  const filteredTeams = teams.filter((t) => {
    const matchText =
      !searchText ||
      t.name.toLowerCase().includes(searchText.toLowerCase()) ||
      t.leader_name?.toLowerCase().includes(searchText.toLowerCase())
    const matchType = typeFilter === 'all' || t.type === typeFilter
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    return matchText && matchType && matchStatus
  })

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Gestão de Equipes Operacionais e Resgate
          </h2>
          <p className="text-xs text-slate-500">
            Mobilização de bombeiros, brigadas de saúde, voluntários e engenheiros de risco em
            campo.
          </p>
        </div>

        <Button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-10 px-4 rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Cadastrar Nova Equipe
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Buscar por nome da equipe ou líder..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="pl-9 h-9 text-xs rounded-lg bg-white"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 text-xs bg-white">
            <SelectValue placeholder="Especialidade da Equipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as Especialidades</SelectItem>
            <SelectItem value="resgate">Resgate e Salvamento</SelectItem>
            <SelectItem value="saude">Saúde e Primeiros Socorros</SelectItem>
            <SelectItem value="logistica">Logística e Suprimentos</SelectItem>
            <SelectItem value="comunicacao">Comunicação e Rádio</SelectItem>
            <SelectItem value="voluntarios">Voluntários Civis</SelectItem>
            <SelectItem value="engenharia">Engenharia e Laudos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 text-xs bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="disponivel">Disponível na Base</SelectItem>
            <SelectItem value="em_operacao">Em Operação de Campo</SelectItem>
            <SelectItem value="descanso">Em Descanso / Turno</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Teams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTeams.map((team) => {
          const linkedOcc = occurrences.find((o) => o.id === team.current_occurrence)

          return (
            <Card
              key={team.id}
              className={`border transition-all duration-200 hover:shadow-md bg-white flex flex-col justify-between ${
                team.status === 'em_operacao'
                  ? 'border-purple-300 ring-1 ring-purple-200'
                  : 'border-slate-200'
              }`}
            >
              <CardHeader className="pb-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${
                        team.status === 'em_operacao'
                          ? 'bg-purple-600 animate-pulse'
                          : 'bg-slate-700'
                      }`}
                    >
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900 leading-tight">
                        {team.name}
                      </CardTitle>
                      <span className="text-[11px] font-semibold text-purple-700 capitalize">
                        {team.type} ({team.member_count} membros)
                      </span>
                    </div>
                  </div>
                  <TeamStatusBadge status={team.status} />
                </div>
              </CardHeader>

              <CardContent className="space-y-3 pt-0">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs space-y-1.5">
                  <div className="flex justify-between text-slate-700">
                    <span className="font-semibold text-slate-500">Líder / Comandante:</span>
                    <span className="font-medium">{team.leader_name || 'Não atribuído'}</span>
                  </div>

                  {team.status === 'em_operacao' && linkedOcc && (
                    <div className="pt-2 border-t border-slate-200">
                      <span className="font-semibold text-purple-900 block mb-0.5">
                        Operação em Andamento:
                      </span>
                      <p className="text-[11px] font-bold text-slate-800 line-clamp-1">
                        {linkedOcc.title}
                      </p>
                      <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">
                          {linkedOcc.address || 'Localidade informada'}
                        </span>
                      </p>
                    </div>
                  )}
                </div>

                {/* Mobilization Controls */}
                <div className="pt-1">
                  {team.status === 'em_operacao' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDemobilize(team)}
                      className="w-full h-8 text-xs font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Encerrar Operação (Disponibilizar)
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedTeam(team)
                        setMobilizeOccurrenceId('')
                        setIsMobilizeOpen(true)
                      }}
                      className="w-full h-8 text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
                    >
                      <Radio className="w-3.5 h-3.5 mr-1" />
                      Mobilizar para Ocorrência
                    </Button>
                  )}
                </div>
              </CardContent>

              <CardFooter className="pt-2 pb-3 px-4 border-t border-slate-100 flex items-center justify-between">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openEdit(team)}
                  className="text-xs text-blue-600 hover:text-blue-800 p-0 h-auto font-semibold"
                >
                  <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedTeam(team)
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

      {filteredTeams.length === 0 && !isLoading && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">Nenhuma equipe encontrada para os filtros.</p>
        </div>
      )}

      {/* Mobilize Team Modal */}
      <Dialog open={isMobilizeOpen} onOpenChange={setIsMobilizeOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Mobilizar Equipe: {selectedTeam?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Selecione a ocorrência ativa para despachar a equipe de resposta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Vincular a Ocorrência</Label>
              <Select value={mobilizeOccurrenceId} onValueChange={setMobilizeOccurrenceId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione uma ocorrência ativa..." />
                </SelectTrigger>
                <SelectContent>
                  {occurrences
                    .filter((o) => o.status !== 'concluida' && o.status !== 'cancelada')
                    .map((occ) => (
                      <SelectItem key={occ.id} value={occ.id}>
                        [{occ.type.toUpperCase()}] {occ.title} ({occ.address || 'Localidade'})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsMobilizeOpen(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleMobilize}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              Confirmar Mobilização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create / Edit Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {selectedTeam ? 'Editar Equipe' : 'Cadastrar Nova Equipe'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cadastre equipes operacionais com membros, líder e especialidade tática.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-3 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Nome da Equipe / Pelotão *
              </Label>
              <Input
                required
                placeholder="Ex: Corpo de Bombeiros - Pelotão Alpha"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Especialidade / Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as TeamType })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resgate">Resgate e Salvamento</SelectItem>
                    <SelectItem value="saude">Saúde e Enfermagem</SelectItem>
                    <SelectItem value="logistica">Logística e Suprimentos</SelectItem>
                    <SelectItem value="comunicacao">Comunicação e Rádio</SelectItem>
                    <SelectItem value="voluntarios">Voluntários Civis</SelectItem>
                    <SelectItem value="engenharia">Engenharia de Risco</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Quantidade de Membros
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.member_count ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, member_count: Number(e.target.value) })
                  }
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">
                  Nome do Líder / Oficial
                </Label>
                <Input
                  placeholder="Ex: Capitão Roberto Mendes"
                  value={formData.leader_name || ''}
                  onChange={(e) => setFormData({ ...formData, leader_name: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Status Inicial</Label>
                <Select
                  value={formData.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as TeamStatus })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disponivel">Disponível</SelectItem>
                    <SelectItem value="em_operacao">Em Operação</SelectItem>
                    <SelectItem value="descanso">Descanso</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
                {selectedTeam ? 'Salvar Alterações' : 'Cadastrar Equipe'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Remover Equipe Operacional
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Deseja remover o cadastro da equipe {selectedTeam?.name}?
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
