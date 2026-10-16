import React, { useState } from 'react'
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom'
import {
  ShieldAlert,
  LayoutDashboard,
  AlertTriangle,
  Building2,
  Users,
  Package,
  Bell,
  MessageSquare,
  Map,
  Bot,
  Search,
  LogOut,
  Menu,
  X,
  Wifi,
  WifiOff,
  AlertOctagon,
  ChevronRight,
  Shield,
  PhoneCall,
  UserCheck,
  FileText,
  TreeDeciduous,
  FileSpreadsheet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/contexts/AuthContext'
import { useRealtime } from '@/hooks/use-realtime'
import { occurrencesService, suppliesService } from '@/services/defesa-civil'
import { ConnectionStatusBadge } from '@/components/defesa-civil/ConnectionStatusBadge'
import type { Occurrence, Supply } from '@/types/defesa-civil'

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { title: 'Painel de Monitoramento', href: '/painel', icon: LayoutDashboard },
  { title: 'Ocorrências', href: '/ocorrencias', icon: AlertTriangle },
  { title: 'Setores de Risco', href: '/setores-risco', icon: ShieldAlert },
  { title: 'Infraestruturas', href: '/infraestruturas', icon: Building2 },
  { title: 'Demandas Intersetoriais', href: '/demandas-secretarias', icon: Package },
  { title: 'Importação Técnica', href: '/importacao-dados', icon: FileSpreadsheet },
  { title: 'Ofícios', href: '/oficios', icon: FileText },
  { title: 'Autorizações (Poda/Corte)', href: '/autorizacoes', icon: TreeDeciduous },
  { title: 'Relatórios & PDF', href: '/relatorios', icon: FileText },
  { title: 'Abrigos', href: '/abrigos', icon: Building2 },
  { title: 'Equipes', href: '/equipes', icon: Users },
  { title: 'Suprimentos', href: '/suprimentos', icon: Package },
  { title: 'Alertas', href: '/alertas', icon: Bell },
  { title: 'WhatsApp', href: '/whatsapp', icon: MessageSquare },
  { title: 'Áreas Afetadas', href: '/areas-afetadas', icon: Map },
  { title: 'Requerentes', href: '/requerentes', icon: Users },
  { title: 'Agentes & EPIs', href: '/agentes-epi', icon: ShieldAlert },
  { title: 'Auditoria', href: '/auditoria', icon: Shield },
  { title: 'Usuários', href: '/usuarios', icon: UserCheck },
  { title: 'Assistente IA', href: '/assistente', icon: Bot },
]

export const Layout: React.FC = () => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [criticalOccurrencesCount, setCriticalOccurrencesCount] = useState(0)
  const [criticalSuppliesCount, setCriticalSuppliesCount] = useState(0)

  // Listen to online status
  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Load badge counts
  const loadBadgeCounts = async () => {
    try {
      const occs = await occurrencesService.list(
        'severity = "critica" && status != "concluida" && status != "cancelada"',
      )
      setCriticalOccurrencesCount(occs.length)

      const sups = await suppliesService.list('status = "critico" || status = "esgotado"')
      setCriticalSuppliesCount(sups.length)
    } catch {
      /* intentionally ignored */
    }
  }

  React.useEffect(() => {
    loadBadgeCounts()
  }, [])

  // Real-time updates for badges
  useRealtime<Occurrence>('occurrences', () => loadBadgeCounts())
  useRealtime<Supply>('supplies', () => loadBadgeCounts())

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (globalSearch.trim()) {
      navigate(`/ocorrencias?search=${encodeURIComponent(globalSearch.trim())}`)
      setGlobalSearch('')
      setIsMobileMenuOpen(false)
    }
  }

  // Get current page title
  const currentNav = navItems.find((item) =>
    item.href === '/' ? location.pathname === '/' : location.pathname.startsWith(item.href),
  )
  const pageTitle = currentNav ? currentNav.title : 'Defesa Civil Municipal'

  return (
    <div className="min-h-screen bg-[#f1f5f9] flex flex-col md:flex-row text-slate-900 font-sans antialiased">
      {/* Desktop Navy Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#0f172a] text-slate-200 border-r border-slate-800 shadow-xl shrink-0 z-30">
        {/* Brand Header */}
        <div className="h-16 flex items-center px-5 gap-3 border-b border-slate-800 bg-[#0b1120]">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20 ring-2 ring-blue-400/20">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight text-white leading-tight">
              DEFESA CIVIL
            </h1>
            <p className="text-[11px] text-blue-400 font-medium truncate max-w-[130px]">
              {user?.role ? user.role.toUpperCase() : 'MUNICIPAL'}
            </p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              item.href === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group relative ${
                  isActive
                    ? 'bg-blue-600/20 text-white font-semibold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                {/* Active left indicator bar */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-blue-500 rounded-r-full shadow-sm shadow-blue-400" />
                )}
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                    isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                <span className="truncate">{item.title}</span>

                {/* Badge for Alerts/Assistente */}
                {item.title === 'Ocorrências' && criticalOccurrencesCount > 0 && (
                  <span className="ml-auto bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                    {criticalOccurrencesCount}
                  </span>
                )}
                {item.title === 'Suprimentos' && criticalSuppliesCount > 0 && (
                  <span className="ml-auto bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {criticalSuppliesCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Emergency Action & User Profile Footer */}
        <div className="p-3 border-t border-slate-800 space-y-3 bg-[#0b1120]/70">
          {/* Emergency SOS Pulse Button */}
          <Button
            onClick={() => setIsEmergencyModalOpen(true)}
            className="w-full bg-gradient-to-r from-red-600 via-red-500 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white font-bold text-xs uppercase tracking-wider py-2.5 shadow-lg shadow-red-900/40 border border-red-400/40 transition-all flex items-center justify-center gap-2 animate-pulse"
          >
            <AlertOctagon className="w-4 h-4" />
            Protocolo de Emergência
          </Button>

          {/* User profile with logout */}
          <div className="flex items-center justify-between pt-1 px-1">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <Avatar className="w-8 h-8 ring-1 ring-blue-400/40 bg-blue-900">
                <AvatarFallback className="bg-blue-800 text-blue-200 text-xs font-bold">
                  {user?.name ? user.name.slice(0, 2).toUpperCase() : 'DC'}
                </AvatarFallback>
              </Avatar>
              <div className="truncate">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-white truncate leading-tight">
                    {user?.name || 'Operador Civil'}
                  </p>
                  <span className="text-[9px] uppercase px-1 rounded bg-slate-700 text-slate-200">
                    {user?.role || 'agente'}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={logout}
              className="w-8 h-8 text-slate-400 hover:text-red-400 hover:bg-slate-800/80 rounded-lg shrink-0"
              title="Sair do Sistema"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main App Container */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* Sticky Topbar */}
        <header className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shadow-sm">
          {/* Left Title & Mobile Hamburger */}
          <div className="flex items-center gap-3 min-w-0">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden text-slate-700 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </Button>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight truncate flex items-center gap-2">
              <span>{pageTitle}</span>
            </h2>
          </div>

          {/* Center Search Bar */}
          <form onSubmit={handleSearchSubmit} className="hidden sm:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar ocorrências, alertas ou locais..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="pl-9 bg-slate-50/80 border-slate-200 focus:bg-white text-xs h-9 rounded-lg transition-all"
              />
            </div>
          </form>

          {/* Right Status Indicators & Notifications */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Realtime / Offline Connectivity indicator discretely integrated */}
            <ConnectionStatusBadge />

            {/* Notification Badges Group */}
            <Link
              to="/ocorrencias"
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Ocorrências Críticas Ativas"
            >
              <AlertOctagon className="w-5 h-5 text-red-600" />
              {criticalOccurrencesCount > 0 && (
                <span className="absolute top-1 right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
                  {criticalOccurrencesCount}
                </span>
              )}
            </Link>

            <Link
              to="/suprimentos"
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Suprimentos em Nível Crítico"
            >
              <Package className="w-5 h-5 text-amber-600" />
              {criticalSuppliesCount > 0 && (
                <span className="absolute top-1 right-1 bg-amber-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center ring-2 ring-white">
                  {criticalSuppliesCount}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Dynamic Page Content with Fade-in */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto animate-fade-in">
          <Outlet />
        </main>
      </div>

      {/* Mobile Drawer (Slide-in) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Overlay backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Drawer Sidebar */}
          <div className="relative w-72 max-w-[80vw] bg-[#0f172a] text-white flex flex-col h-full z-10 shadow-2xl animate-slide-up">
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-[#0b1120]">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-6 h-6 text-blue-500" />
                <span className="font-bold text-sm">Defesa Civil Municipal</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = location.pathname.startsWith(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      isActive ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-5 h-5 text-blue-400" />
                    <span>{item.title}</span>
                  </Link>
                )
              })}
            </nav>

            <div className="p-4 border-t border-slate-800 bg-[#0b1120]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-white">{user?.name}</p>
                  <p className="text-[10px] text-slate-400">{user?.email}</p>
                </div>
                <Button size="sm" variant="destructive" onClick={logout}>
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (5 main items) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 flex items-center justify-around px-2 shadow-lg">
        <Link
          to="/painel"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium py-1 px-2 ${
            location.pathname === '/painel' ? 'text-blue-600 font-bold' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          Painel
        </Link>
        <Link
          to="/ocorrencias"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium py-1 px-2 ${
            location.pathname.startsWith('/ocorrencias')
              ? 'text-blue-600 font-bold'
              : 'text-slate-500'
          }`}
        >
          <AlertTriangle className="w-5 h-5" />
          Ocorrências
        </Link>
        <Link
          to="/alertas"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium py-1 px-2 ${
            location.pathname.startsWith('/alertas') ? 'text-blue-600 font-bold' : 'text-slate-500'
          }`}
        >
          <Bell className="w-5 h-5" />
          Alertas
        </Link>
        <Link
          to="/assistente"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium py-1 px-2 ${
            location.pathname.startsWith('/assistente')
              ? 'text-blue-600 font-bold'
              : 'text-slate-500'
          }`}
        >
          <Bot className="w-5 h-5" />
          Assistente
        </Link>
        <button
          onClick={() => setIsEmergencyModalOpen(true)}
          className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-red-600 py-1 px-2"
        >
          <div className="w-6 h-6 rounded-full bg-red-600 text-white flex items-center justify-center shadow-sm">
            <PhoneCall className="w-3.5 h-3.5" />
          </div>
          Emergência
        </button>
      </div>

      {/* Emergency Protocol Modal */}
      <Dialog open={isEmergencyModalOpen} onOpenChange={setIsEmergencyModalOpen}>
        <DialogContent className="max-w-md bg-white border-red-300">
          <DialogHeader>
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-2 ring-8 ring-red-50">
              <AlertOctagon className="w-7 h-7" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-slate-900">
              Protocolo de Acionamento de Emergência
            </DialogTitle>
            <DialogDescription className="text-center text-slate-600 text-xs">
              Disparo de prontidão máxima para eventos climáticos extremos (inundações severas e
              deslizamentos em massa).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <h5 className="font-bold text-red-800 mb-1 flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5" /> Telefones Centrais de Resgate
              </h5>
              <div className="grid grid-cols-2 gap-2 text-slate-700 font-medium pt-1">
                <div>
                  Defesa Civil: <span className="font-bold text-red-700">199</span>
                </div>
                <div>
                  Bombeiros: <span className="font-bold text-red-700">193</span>
                </div>
                <div>
                  SAMU: <span className="font-bold text-red-700">192</span>
                </div>
                <div>
                  Polícia Militar: <span className="font-bold text-red-700">190</span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-700 space-y-1">
              <p className="font-semibold text-slate-800">Passos imediatos de contingência:</p>
              <ul className="list-disc pl-4 space-y-0.5 text-slate-600">
                <li>Acionar sirenes comunitárias em áreas de risco crítico.</li>
                <li>Deslocar equipes de resgate para pontos de enchente e deslizamento.</li>
                <li>Abrir abrigos municipais de prontidão imediata.</li>
                <li>Emitir Alerta em massa (SMS/WhatsApp/Redes).</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEmergencyModalOpen(false)}
              className="w-full sm:w-auto"
            >
              Fechar
            </Button>
            <Button
              className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                setIsEmergencyModalOpen(false)
                navigate('/alertas')
              }}
            >
              Emitir Alerta à População
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
