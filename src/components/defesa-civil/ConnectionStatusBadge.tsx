import React, { useEffect, useState } from 'react'
import { RefreshCw, Wifi, WifiOff, AlertCircle, CheckCircle } from 'lucide-react'
import { offlineSyncManager } from '@/services/offline-sync'
import type { NetworkSyncStatus } from '@/types/defesa-civil'
import { Button } from '@/components/ui/button'

export const ConnectionStatusBadge: React.FC = () => {
  const [status, setStatus] = useState<NetworkSyncStatus>('online_synced')
  const [pendingCount, setPendingCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastError, setLastError] = useState<string | undefined>()

  useEffect(() => {
    const unsubscribe = offlineSyncManager.subscribe((info) => {
      setStatus(info.syncStatus)
      setPendingCount(info.pendingCount)
      setIsSyncing(info.isSyncing)
      setLastError(info.lastError)
    })
    offlineSyncManager.refreshPendingCount()
    return () => unsubscribe()
  }, [])

  const handleManualSync = () => {
    offlineSyncManager.triggerSync()
  }

  // 7. INDICADOR DE CONEXÃO (discreto, sem alterar o layout geral)
  // 🟢 Online — sincronizado | 🟠 Offline — registros pendentes | 🔄 Sincronizando | 🔴 Erro de sincronização.
  if (status === 'syncing' || isSyncing) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border bg-blue-50 text-blue-700 border-blue-200 transition-all cursor-pointer"
        title="Sincronizando registros locais com o servidor central..."
        onClick={handleManualSync}
      >
        <RefreshCw className="w-3 h-3 text-blue-600 animate-spin" />
        <span className="hidden sm:inline">🔄 Sincronizando</span>
        {pendingCount > 0 && <span className="font-bold">({pendingCount})</span>}
      </div>
    )
  }

  if (status === 'sync_error') {
    return (
      <button
        type="button"
        onClick={handleManualSync}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 transition-all cursor-pointer"
        title={`Erro de sincronização: ${lastError || 'Falha de comunicação'}. Clique para tentar novamente.`}
      >
        <AlertCircle className="w-3 h-3 text-rose-600 shrink-0" />
        <span className="hidden sm:inline">🔴 Erro</span>
        {pendingCount > 0 && <span className="font-bold">({pendingCount} pendentes)</span>}
      </button>
    )
  }

  if (status === 'offline_pending' || !navigator.onLine || pendingCount > 0) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border bg-amber-50 text-amber-800 border-amber-200 transition-all cursor-pointer"
        title={
          pendingCount > 0
            ? `Offline — ${pendingCount} registro(s) pendente(s) na fila local aguardando reconexão.`
            : 'Modo Offline — Dados locais disponíveis conforme permissões'
        }
        onClick={handleManualSync}
      >
        <WifiOff className="w-3 h-3 text-amber-600" />
        <span className="hidden sm:inline">
          {pendingCount > 0 ? `🟠 Offline (${pendingCount})` : '🟠 Offline'}
        </span>
      </div>
    )
  }

  // 🟢 Online — sincronizado
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200 transition-all"
      title="Online — Todos os dados estão sincronizados com o servidor."
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="hidden sm:inline">🟢 Online</span>
    </div>
  )
}
