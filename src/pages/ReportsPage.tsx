import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Filter,
  BarChart3,
  TrendingUp,
  Download,
  AlertTriangle,
  Building,
  User as UserIcon,
  TreeDeciduous,
  FileText,
  Clock,
  Layers,
  CheckCircle2,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  occurrencesService,
  officialDocumentsService,
  treeAuthorizationsService,
  municipalitiesService,
  usersService,
} from '@/services/defesa-civil'
import type {
  Occurrence,
  OfficialDocument,
  TreeAuthorization,
  Municipality,
  User,
  OccurrenceType,
  OccurrenceSeverity,
  OccurrenceStatus,
} from '@/types/defesa-civil'
import {
  TYPE_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  ORIGIN_LABELS,
} from '@/components/defesa-civil/StatusBadges'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const ReportsPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState<'occurrences' | 'documents' | 'tree_auth'>(
    'occurrences',
  )

  // Dados reais do banco de dados
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [documents, setDocuments] = useState<OfficialDocument[]>([])
  const [authorizations, setAuthorizations] = useState<TreeAuthorization[]>([])
  const [usersList, setUsersList] = useState<User[]>([])
  const [municipality, setMunicipality] = useState<Municipality | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Filtros Globais / Por Data
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')

  // Filtros de Ocorrências
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [agentFilter, setAgentFilter] = useState<string>('all')

  // Filtros de Documentos
  const [docStatusFilter, setDocStatusFilter] = useState<string>('all')

  // Filtros de Autorizações
  const [authTypeFilter, setAuthTypeFilter] = useState<string>('all')
  const [authStatusFilter, setAuthStatusFilter] = useState<string>('all')

  // Carregar dados
  useEffect(() => {
    const loadReportData = async () => {
      setIsLoading(true)
      try {
        const [occs, docs, auths, users] = await Promise.all([
          occurrencesService.list(),
          officialDocumentsService.list(),
          treeAuthorizationsService.list(),
          usersService.list(),
        ])
        setOccurrences(occs)
        setDocuments(docs)
        setAuthorizations(auths)
        setUsersList(users)

        if (user?.municipality) {
          const mun = await municipalitiesService.get(user.municipality)
          setMunicipality(mun)
        }
      } catch (err) {
        toast({
          title: 'Erro ao gerar relatórios',
          description: 'Falha ao buscar indicadores do servidor.',
          variant: 'destructive',
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadReportData()
  }, [user?.municipality])

  // Filtragem de Ocorrências
  const filteredOccurrences = useMemo(() => {
    return occurrences.filter((occ) => {
      // Período
      if (startDate) {
        const occDate = new Date(occ.created).toISOString().split('T')[0]
        if (occDate < startDate) return false
      }
      if (endDate) {
        const occDate = new Date(occ.created).toISOString().split('T')[0]
        if (occDate > endDate) return false
      }
      // Tipo
      if (typeFilter !== 'all' && occ.type !== typeFilter) return false
      // Severidade
      if (severityFilter !== 'all' && occ.severity !== severityFilter) return false
      // Status
      if (statusFilter !== 'all' && occ.status !== statusFilter) return false
      // Agente
      if (agentFilter !== 'all' && occ.reported_by !== agentFilter) return false

      return true
    })
  }, [occurrences, startDate, endDate, typeFilter, severityFilter, statusFilter, agentFilter])

  // Filtragem de Documentos
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      if (startDate) {
        const docDate = new Date(doc.created).toISOString().split('T')[0]
        if (docDate < startDate) return false
      }
      if (endDate) {
        const docDate = new Date(doc.created).toISOString().split('T')[0]
        if (docDate > endDate) return false
      }
      if (docStatusFilter !== 'all' && doc.status !== docStatusFilter) return false
      return true
    })
  }, [documents, startDate, endDate, docStatusFilter])

  // Filtragem de Autorizações
  const filteredAuthorizations = useMemo(() => {
    return authorizations.filter((auth) => {
      if (startDate) {
        const authDate = new Date(auth.created).toISOString().split('T')[0]
        if (authDate < startDate) return false
      }
      if (endDate) {
        const authDate = new Date(auth.created).toISOString().split('T')[0]
        if (authDate > endDate) return false
      }
      if (authTypeFilter !== 'all' && auth.type !== authTypeFilter) return false
      if (authStatusFilter !== 'all' && auth.status !== authStatusFilter) return false
      return true
    })
  }, [authorizations, startDate, endDate, authTypeFilter, authStatusFilter])

  // Indicadores reais
  const metrics = useMemo(() => {
    const totalOccs = filteredOccurrences.length
    const concluidas = filteredOccurrences.filter((o) => o.status === 'concluida').length
    const emAndamento = filteredOccurrences.filter((o) => o.status === 'em_andamento').length
    const reportadas = filteredOccurrences.filter((o) => o.status === 'reportada').length

    const totalDocs = filteredDocuments.length
    const docsEmitidos = filteredDocuments.filter((d) => d.status === 'emitido').length

    const totalAuths = filteredAuthorizations.length
    const authsEmitidas = filteredAuthorizations.filter((a) => a.status === 'emitida').length
    const totalArvores = filteredAuthorizations.reduce((acc, a) => acc + (a.tree_quantity || 0), 0)

    return {
      totalOccs,
      concluidas,
      emAndamento,
      reportadas,
      totalDocs,
      docsEmitidos,
      totalAuths,
      authsEmitidas,
      totalArvores,
    }
  }, [filteredOccurrences, filteredDocuments, filteredAuthorizations])

  // Impressão do Relatório / Exportação PDF
  const handlePrintReport = () => {
    const printWindow = window.open('', '_blank', 'width=1000,height=900')
    if (!printWindow) {
      window.print()
      return
    }

    const logoHtml = municipality?.logo
      ? `<img src="${municipalitiesService.getLogoUrl(municipality)}" alt="Brasão" style="height: 55px; margin-bottom: 6px;" />`
      : ''

    const periodStr =
      startDate || endDate
        ? `Período: ${startDate ? new Date(startDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Início'} até ${
            endDate ? new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR') : 'Atual'
          }`
        : 'Período: Geral (Todos os registros)'

    let tableHtml = ''

    if (activeTab === 'occurrences') {
      tableHtml = `
        <h3 style="margin-top: 20px;">Relatório Analítico de Ocorrências (${filteredOccurrences.length} registros)</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 10px;">
          <thead>
            <tr style="background: #f3f4f6; border-bottom: 2px solid #333;">
              <th style="padding: 6px; text-align: left;">Código</th>
              <th style="padding: 6px; text-align: left;">Título / Tipo</th>
              <th style="padding: 6px; text-align: left;">Severidade</th>
              <th style="padding: 6px; text-align: left;">Status</th>
              <th style="padding: 6px; text-align: left;">Origem</th>
              <th style="padding: 6px; text-align: left;">Endereço</th>
              <th style="padding: 6px; text-align: left;">Data</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredOccurrences.length === 0
                ? '<tr><td colspan="7" style="text-align: center; padding: 20px;">Nenhuma ocorrência encontrada.</td></tr>'
                : filteredOccurrences
                    .map(
                      (o) => `
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 6px; font-weight: bold; font-family: monospace;">${o.code || o.id}</td>
                  <td style="padding: 6px;"><strong>${o.title}</strong><br/><span style="color: #666;">${TYPE_LABELS[o.type] || o.type}</span></td>
                  <td style="padding: 6px;">${SEVERITY_LABELS[o.severity] || o.severity}</td>
                  <td style="padding: 6px;">${STATUS_LABELS[o.status] || o.status}</td>
                  <td style="padding: 6px;">${ORIGIN_LABELS[o.origin || '199'] || o.origin}</td>
                  <td style="padding: 6px;">${o.address || '-'}</td>
                  <td style="padding: 6px;">${new Date(o.created).toLocaleDateString('pt-BR')}</td>
                </tr>
              `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      `
    } else if (activeTab === 'documents') {
      tableHtml = `
        <h3 style="margin-top: 20px;">Relatório Oficial de Ofícios Expedidos (${filteredDocuments.length} registros)</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 10px;">
          <thead>
            <tr style="background: #f3f4f6; border-bottom: 2px solid #333;">
              <th style="padding: 6px; text-align: left;">Número Oficial</th>
              <th style="padding: 6px; text-align: left;">Destinatário</th>
              <th style="padding: 6px; text-align: left;">Assunto</th>
              <th style="padding: 6px; text-align: left;">Status</th>
              <th style="padding: 6px; text-align: left;">Data Emissão</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredDocuments.length === 0
                ? '<tr><td colspan="5" style="text-align: center; padding: 20px;">Nenhum ofício encontrado.</td></tr>'
                : filteredDocuments
                    .map(
                      (d) => `
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 6px; font-weight: bold; font-family: monospace;">${d.number || '[Rascunho]'}</td>
                  <td style="padding: 6px;">${d.recipient_name} ${d.recipient_institution ? `(${d.recipient_institution})` : ''}</td>
                  <td style="padding: 6px;">${d.subject}</td>
                  <td style="padding: 6px;">${d.status.toUpperCase()}</td>
                  <td style="padding: 6px;">${d.issue_date ? new Date(d.issue_date).toLocaleDateString('pt-BR') : '-'}</td>
                </tr>
              `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      `
    } else {
      tableHtml = `
        <h3 style="margin-top: 20px;">Relatório de Autorizações de Manejo Arbóreo (Corte e Poda) (${filteredAuthorizations.length} registros)</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 9.5pt; margin-top: 10px;">
          <thead>
            <tr style="background: #f3f4f6; border-bottom: 2px solid #333;">
              <th style="padding: 6px; text-align: left;">Número</th>
              <th style="padding: 6px; text-align: left;">Tipo</th>
              <th style="padding: 6px; text-align: left;">Requerente</th>
              <th style="padding: 6px; text-align: left;">Qtd Árvores</th>
              <th style="padding: 6px; text-align: left;">Endereço</th>
              <th style="padding: 6px; text-align: left;">Status</th>
              <th style="padding: 6px; text-align: left;">Vencimento (90d)</th>
            </tr>
          </thead>
          <tbody>
            ${
              filteredAuthorizations.length === 0
                ? '<tr><td colspan="7" style="text-align: center; padding: 20px;">Nenhuma autorização encontrada.</td></tr>'
                : filteredAuthorizations
                    .map(
                      (a) => `
                <tr style="border-bottom: 1px solid #ddd;">
                  <td style="padding: 6px; font-weight: bold; font-family: monospace;">${a.number || '[Rascunho]'}</td>
                  <td style="padding: 6px;">${a.type.toUpperCase()}</td>
                  <td style="padding: 6px;">${a.expand?.requester?.name || 'Requerente'}</td>
                  <td style="padding: 6px; text-align: center;">${a.tree_quantity}</td>
                  <td style="padding: 6px;">${a.address}</td>
                  <td style="padding: 6px;">${a.status.toUpperCase()}</td>
                  <td style="padding: 6px;">${a.expiration_date ? new Date(a.expiration_date).toLocaleDateString('pt-BR') : '-'}</td>
                </tr>
              `,
                    )
                    .join('')
            }
          </tbody>
        </table>
      `
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório Oficial - Defesa Civil Municipal</title>
          <style>
            @page {
              size: A4 landscape;
              margin: 15mm;
            }
            body {
              font-family: Arial, sans-serif;
              color: #111;
              font-size: 10pt;
              margin: 0;
              padding: 0;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #222;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .header h2 {
              font-size: 13pt;
              margin: 0;
              text-transform: uppercase;
            }
            .header p {
              margin: 2px 0 0 0;
              font-size: 9pt;
              color: #444;
            }
            .meta-bar {
              display: flex;
              justify-content: space-between;
              font-size: 9pt;
              color: #555;
              margin-bottom: 16px;
            }
            .kpi-container {
              display: flex;
              gap: 12px;
              margin-bottom: 16px;
            }
            .kpi-card {
              flex: 1;
              background: #f9fafb;
              border: 1px solid #e5e7eb;
              padding: 8px;
              text-align: center;
              border-radius: 4px;
            }
            .kpi-val {
              font-size: 14pt;
              font-weight: bold;
              color: #1e3a8a;
            }
            .kpi-lbl {
              font-size: 8pt;
              color: #6b7280;
              text-transform: uppercase;
            }
            .footer {
              margin-top: 30px;
              border-top: 1px solid #ccc;
              padding-top: 8px;
              text-align: center;
              font-size: 8pt;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoHtml}
            <h2>${municipality?.doc_header || 'PREFEITURA MUNICIPAL — COORDENADORIA DE DEFESA CIVIL'}</h2>
            <p>${municipality?.name || 'MUNICÍPIO'} • ${municipality?.city || ''}/${municipality?.state || ''} — SISTEMA OFICIAL DE GESTÃO</p>
          </div>

          <div class="meta-bar">
            <span><strong>${periodStr}</strong></span>
            <span>Gerado em: ${new Date().toLocaleString('pt-BR')} por ${user?.name || user?.email}</span>
          </div>

          <div class="kpi-container">
            <div class="kpi-card">
              <div class="kpi-val">${metrics.totalOccs}</div>
              <div class="kpi-lbl">Total Ocorrências</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val">${metrics.concluidas}</div>
              <div class="kpi-lbl">Concluídas</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val">${metrics.totalDocs}</div>
              <div class="kpi-lbl">Ofícios Gerados</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val">${metrics.authsEmitidas}</div>
              <div class="kpi-lbl">Autorizações Poda/Corte</div>
            </div>
          </div>

          ${tableHtml}

          <div class="footer">
            ${municipality?.doc_footer || 'Defesa Civil Municipal — Atendimento de Emergência 199'}
            <div>Relatório emitido exclusivamente com base em dados auditados da base municipal.</div>
          </div>
        </body>
      </html>
    `)

    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 400)
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-lg border shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Relatórios e Estatísticas Oficiais
            </h1>
            <Badge
              variant="outline"
              className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200"
            >
              Auditado
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Extração de relatórios consolidados de ocorrências, ofícios e autorizações de corte/poda
            com isolamento estrito por prefeitura.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handlePrintReport}
            className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-xs"
          >
            <Printer className="w-4 h-4" /> Exportar / Imprimir PDF
          </Button>
        </div>
      </div>

      {/* Cartões de Indicadores Gerais Reais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Ocorrências Filtradas</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.totalOccs}</p>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                {metrics.concluidas} finalizadas
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Ofícios Emitidos</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.docsEmitidos}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {metrics.totalDocs} total elaborados
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
              <FileText className="w-5 h-5 text-indigo-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Autorizações Corte/Poda</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{metrics.authsEmitidas}</p>
              <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                {metrics.totalArvores} árvores avaliadas
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <TreeDeciduous className="w-5 h-5 text-emerald-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500 font-medium">Município Ativo</p>
              <p className="text-sm font-bold text-slate-900 mt-1 truncate max-w-[140px]">
                {municipality?.name || 'Carregando...'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {municipality?.city}/{municipality?.state}
              </p>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
              <Building className="w-5 h-5 text-slate-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Filtros de Período e Critérios */}
      <Card className="border shadow-xs">
        <CardHeader className="p-4 border-b bg-slate-50">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <CardTitle className="text-sm font-semibold text-slate-800">
              Filtros Avançados
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Data Inicial:</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Data Final:</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 text-xs"
              />
            </div>

            {activeTab === 'occurrences' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Tipo de Evento:</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="bg-slate-50 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Tipos</SelectItem>
                      {Object.entries(TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Severidade:</Label>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="bg-slate-50 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Severidades</SelectItem>
                      {Object.entries(SEVERITY_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Situação:</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="bg-slate-50 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Situações</SelectItem>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Agente Responsável:</Label>
                  <Select value={agentFilter} onValueChange={setAgentFilter}>
                    <SelectTrigger className="bg-slate-50 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Agentes</SelectItem>
                      {usersList.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {activeTab === 'documents' && (
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Status do Ofício:</Label>
                <Select value={docStatusFilter} onValueChange={setDocStatusFilter}>
                  <SelectTrigger className="bg-slate-50 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="emitido">Emitidos</SelectItem>
                    <SelectItem value="rascunho">Rascunhos</SelectItem>
                    <SelectItem value="cancelado">Cancelados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeTab === 'tree_auth' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Tipo de Intervenção:</Label>
                  <Select value={authTypeFilter} onValueChange={setAuthTypeFilter}>
                    <SelectTrigger className="bg-slate-50 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="poda">Poda</SelectItem>
                      <SelectItem value="corte">Corte</SelectItem>
                      <SelectItem value="corte_e_poda">Corte e Poda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs text-slate-600">Status:</Label>
                  <Select value={authStatusFilter} onValueChange={setAuthStatusFilter}>
                    <SelectTrigger className="bg-slate-50 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="emitida">Emitidas</SelectItem>
                      <SelectItem value="rascunho">Rascunhos</SelectItem>
                      <SelectItem value="cancelada">Canceladas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Abas e Tabelas de Relatórios */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)}>
        <TabsList className="bg-slate-100 p-1">
          <TabsTrigger value="occurrences" className="gap-2">
            <AlertTriangle className="w-4 h-4" /> Relatório de Ocorrências (
            {filteredOccurrences.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="gap-2">
            <FileText className="w-4 h-4" /> Relatório de Ofícios ({filteredDocuments.length})
          </TabsTrigger>
          <TabsTrigger value="tree_auth" className="gap-2">
            <TreeDeciduous className="w-4 h-4" /> Relatório de Autorizações (
            {filteredAuthorizations.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: OCORRÊNCIAS */}
        <TabsContent value="occurrences" className="mt-4">
          <Card className="border shadow-xs">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b text-slate-600 font-semibold">
                  <tr>
                    <th className="p-3">Código</th>
                    <th className="p-3">Título / Tipo</th>
                    <th className="p-3">Severidade</th>
                    <th className="p-3">Situação</th>
                    <th className="p-3">Origem</th>
                    <th className="p-3">Endereço</th>
                    <th className="p-3">Registrado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Carregando registros...
                      </td>
                    </tr>
                  ) : filteredOccurrences.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Nenhum registro encontrado para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredOccurrences.map((occ) => (
                      <tr key={occ.id} className="hover:bg-slate-50/70">
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {occ.code || occ.id}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{occ.title}</div>
                          <div className="text-slate-500 text-[11px]">{TYPE_LABELS[occ.type]}</div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                            {SEVERITY_LABELS[occ.severity]}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {STATUS_LABELS[occ.status]}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-600">
                          {ORIGIN_LABELS[occ.origin || '199'] || occ.origin}
                        </td>
                        <td className="p-3 text-slate-600 max-w-xs truncate">
                          {occ.address || '-'}
                        </td>
                        <td className="p-3 text-slate-500">
                          {new Date(occ.created).toLocaleDateString('pt-BR')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: OFÍCIOS */}
        <TabsContent value="documents" className="mt-4">
          <Card className="border shadow-xs">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b text-slate-600 font-semibold">
                  <tr>
                    <th className="p-3">Número Oficial</th>
                    <th className="p-3">Destinatário</th>
                    <th className="p-3">Assunto</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Signatário</th>
                    <th className="p-3">Data Emissão</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDocuments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        Nenhum documento encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredDocuments.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/70">
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {doc.number || '[Rascunho]'}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900">{doc.recipient_name}</div>
                          {doc.recipient_institution && (
                            <div className="text-slate-500 text-[11px]">
                              {doc.recipient_institution}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-slate-800 max-w-sm truncate">{doc.subject}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                            {doc.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-600">{doc.signatory_name || '-'}</td>
                        <td className="p-3 text-slate-500">
                          {doc.issue_date
                            ? new Date(doc.issue_date).toLocaleDateString('pt-BR')
                            : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: AUTORIZAÇÕES */}
        <TabsContent value="tree_auth" className="mt-4">
          <Card className="border shadow-xs">
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b text-slate-600 font-semibold">
                  <tr>
                    <th className="p-3">Número Oficial</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Requerente</th>
                    <th className="p-3">Árvores</th>
                    <th className="p-3">Endereço</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Validade (90d)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAuthorizations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        Nenhuma autorização de corte/poda encontrada.
                      </td>
                    </tr>
                  ) : (
                    filteredAuthorizations.map((auth) => (
                      <tr key={auth.id} className="hover:bg-slate-50/70">
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {auth.number || '[Rascunho]'}
                        </td>
                        <td className="p-3 uppercase font-semibold text-slate-700">{auth.type}</td>
                        <td className="p-3 font-semibold text-slate-900">
                          {auth.expand?.requester?.name || 'Requerente'}
                        </td>
                        <td className="p-3 text-center font-bold text-slate-800">
                          {auth.tree_quantity}
                        </td>
                        <td className="p-3 text-slate-600 max-w-xs truncate">{auth.address}</td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                            {auth.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-500">
                          {auth.expiration_date
                            ? new Date(auth.expiration_date).toLocaleDateString('pt-BR')
                            : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
