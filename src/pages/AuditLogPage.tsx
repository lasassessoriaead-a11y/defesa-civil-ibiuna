import React, { useState, useEffect } from 'react'
import {
  ShieldCheck,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  Activity,
  FileText,
  AlertCircle,
  Eye,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { auditLogService, getErrorMessage } from '@/services/defesa-civil'
import type { AuditLogEntry } from '@/types/defesa-civil'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

export const AuditLogPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedAction, setSelectedAction] = useState<string>('all')
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const isAuthorized = user?.role === 'administrador' || user?.role === 'coordenador'

  const loadLogs = async () => {
    if (!isAuthorized) {
      setIsLoading(false)
      return
    }
    try {
      setIsLoading(true)
      const res = await auditLogService.list()
      setLogs(res.items)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar auditoria',
        description: getErrorMessage(err),
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [user?.role])

  if (!isAuthorized) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center gap-3">
        <ShieldCheck className="w-12 h-12 text-slate-400 stroke-1" />
        <h3 className="text-base font-bold text-slate-800">Acesso Restrito</h3>
        <p className="text-xs text-slate-500 max-w-md">
          A trilha de auditoria é restrita a Coordenadores e Administradores do município.
        </p>
      </div>
    )
  }

  const filteredLogs = logs.filter((log) => {
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      !searchTerm ||
      log.action.toLowerCase().includes(term) ||
      (log.user_name && log.user_name.toLowerCase().includes(term)) ||
      (log.details && log.details.toLowerCase().includes(term)) ||
      log.record_id.toLowerCase().includes(term)

    const matchesAction = selectedAction === 'all' || log.action === selectedAction

    return matchesSearch && matchesAction
  })

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'create':
        return <Badge className="bg-emerald-600 text-white">Criação</Badge>
      case 'update':
        return <Badge className="bg-blue-600 text-white">Atualização</Badge>
      case 'conclude':
        return <Badge className="bg-indigo-600 text-white">Conclusão</Badge>
      case 'reopen':
        return <Badge className="bg-amber-500 text-white font-bold">Reabertura</Badge>
      case 'delete':
        return <Badge className="bg-red-600 text-white">Exclusão</Badge>
      default:
        return <Badge variant="outline">{action}</Badge>
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-600" />
          Trilha de Auditoria e Conformidade
        </h2>
        <p className="text-xs text-slate-500">
          Registro imutável de ações operacionais (criação, edição, conclusão, reabertura de
          ocorrências). Dados pessoais sensíveis são mascarados pelo servidor.
        </p>
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por usuário, ação, ID de registro ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs rounded-lg"
              />
            </div>

            <Select value={selectedAction} onValueChange={setSelectedAction}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Filtrar Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Ações</SelectItem>
                <SelectItem value="create">Criação (create)</SelectItem>
                <SelectItem value="update">Edição (update)</SelectItem>
                <SelectItem value="conclude">Conclusão (conclude)</SelectItem>
                <SelectItem value="reopen">Reabertura (reopen)</SelectItem>
                <SelectItem value="delete">Exclusão (delete)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
            <p className="text-xs">Carregando logs de auditoria...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center gap-2 text-slate-400">
            <ShieldCheck className="w-8 h-8 stroke-1 text-slate-300" />
            <p className="text-sm font-medium text-slate-600">Nenhum evento registrado</p>
            <p className="text-xs text-slate-400">
              As operações realizadas na plataforma aparecerão aqui automaticamente.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-200">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-700">Data / Hora</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">Ação</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">Operador</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">
                  Coleção / Registro
                </TableHead>
                <TableHead className="text-xs font-semibold text-slate-700">Detalhes</TableHead>
                <TableHead className="text-xs font-semibold text-slate-700 text-right">
                  Dados
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                    {new Date(log.created).toLocaleString('pt-BR')}
                  </TableCell>
                  <TableCell>{getActionBadge(log.action)}</TableCell>
                  <TableCell>
                    <div className="font-semibold text-xs text-slate-900">
                      {log.user_name || 'Sistema'}
                    </div>
                    {log.user_email && (
                      <div className="text-[10px] text-slate-400">{log.user_email}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-slate-700 font-mono">
                    <span className="text-slate-500">{log.collection}/</span>
                    <span className="font-semibold">{log.record_id}</span>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600 max-w-[300px] truncate">
                    {log.details || '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedLog(log)
                        setIsDetailOpen(true)
                      }}
                      className="text-emerald-700 hover:text-emerald-800 text-xs h-8"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1" />
                      Ver Diff
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Modal Diff */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Detalhes da Auditoria — {selectedLog?.action.toUpperCase()}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registro realizado em{' '}
              {selectedLog ? new Date(selectedLog.created).toLocaleString('pt-BR') : ''} por{' '}
              {selectedLog?.user_name || 'Sistema'}
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-4 pt-2">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1">
                <p>
                  <span className="font-semibold">Resumo:</span> {selectedLog.details}
                </p>
                <p>
                  <span className="font-semibold">Registro:</span> {selectedLog.collection} (
                  {selectedLog.record_id})
                </p>
                <p>
                  <span className="font-semibold">Origem:</span> {selectedLog.origin || 'online'}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <h4 className="font-semibold text-slate-700 mb-1">
                    Estado Anterior (data_before):
                  </h4>
                  <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] overflow-x-auto max-h-[250px]">
                    {selectedLog.data_before
                      ? JSON.stringify(JSON.parse(selectedLog.data_before), null, 2)
                      : 'Nenhum dado anterior (criação)'}
                  </pre>
                </div>
                <div>
                  <h4 className="font-semibold text-slate-700 mb-1">
                    Estado Posterior (data_after):
                  </h4>
                  <pre className="p-3 bg-slate-900 text-emerald-300 rounded-lg text-[11px] overflow-x-auto max-h-[250px]">
                    {selectedLog.data_after
                      ? JSON.stringify(JSON.parse(selectedLog.data_after), null, 2)
                      : 'Registro excluído'}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
