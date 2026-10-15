/**
 * offline-sync.ts
 * Motor de sincronização automática e controle de fila offline.
 * Idempotência via client_uuid;
 * Ordenação estrita por dependência (requerente -> ocorrência -> foto/anexo);
 * Deduplicação segura e retenção de fila até confirmação do servidor.
 */

import pb from '@/lib/pocketbase/client'
import { offlineDb } from './offline-db'
import type {
  SyncQueueItem,
  NetworkSyncStatus,
  Occurrence,
  Requester,
  TreeAuthorization,
  OccurrenceFile,
} from '@/types/defesa-civil'

export interface SyncEventListener {
  (status: {
    syncStatus: NetworkSyncStatus
    pendingCount: number
    isSyncing: boolean
    lastSyncTime?: Date
    lastError?: string
  }): void
}

class OfflineSyncManager {
  private listeners: Set<SyncEventListener> = new Set()
  private isSyncing = false
  private pendingCount = 0
  private lastSyncTime?: Date
  private lastError?: string
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  private syncTimer: any = null

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true
        this.notify()
        this.triggerSync()
      })
      window.addEventListener('offline', () => {
        this.isOnline = false
        this.notify()
      })
    }
  }

  public subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener)
    listener(this.getStatus())
    return () => {
      this.listeners.delete(listener)
    }
  }

  public getStatus() {
    let syncStatus: NetworkSyncStatus = 'online_synced'
    if (!this.isOnline) {
      syncStatus = this.pendingCount > 0 ? 'offline_pending' : 'offline_pending'
    } else if (this.isSyncing) {
      syncStatus = 'syncing'
    } else if (this.lastError && this.pendingCount > 0) {
      syncStatus = 'sync_error'
    } else if (this.pendingCount > 0) {
      syncStatus = 'offline_pending'
    } else {
      syncStatus = 'online_synced'
    }

    return {
      syncStatus,
      pendingCount: this.pendingCount,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
    }
  }

  private notify() {
    const current = this.getStatus()
    this.listeners.forEach((l) => l(current))
  }

  /**
   * Atualiza a contagem de itens pendentes no DB local para o usuário atual
   */
  public async refreshPendingCount(): Promise<number> {
    const authUser = pb.authStore.record
    if (!authUser) {
      this.pendingCount = 0
      this.notify()
      return 0
    }

    const scope = {
      userId: authUser.id,
      municipalityId: authUser.municipality || 'default',
    }

    try {
      this.pendingCount = await offlineDb.countPendingQueue(scope)
    } catch {
      this.pendingCount = 0
    }
    this.notify()
    return this.pendingCount
  }

  /**
   * Registra uma ocorrência offline na fila e no cache local
   */
  public async saveOccurrenceOffline(
    data: Partial<Occurrence>,
    agentName: string,
  ): Promise<{ provCode: string; clientUuid: string; tempRecord: Occurrence }> {
    const authUser = pb.authStore.record
    if (!authUser) {
      throw new Error('Usuário autenticado não encontrado para registrar offline.')
    }

    const scope = {
      userId: authUser.id,
      municipalityId: authUser.municipality || data.municipality || 'default',
    }

    const clientUuid = `occ_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const provCode = await offlineDb.getNextProvisionalSeq(scope, agentName)

    const tempRecord: Occurrence = {
      id: `temp_${clientUuid}`,
      collectionId: 'occurrences',
      collectionName: 'occurrences',
      code: provCode,
      prov_code: provCode,
      client_uuid: clientUuid,
      title: data.title || '',
      description: data.description || '',
      type: data.type || 'outro',
      severity: data.severity || 'media',
      status: data.status || 'reportada',
      origin: data.origin || '199',
      municipality: authUser.municipality || data.municipality,
      requester: data.requester || '',
      latitude: data.latitude,
      longitude: data.longitude,
      address: data.address || '',
      affectable_population: data.affectable_population || 0,
      reported_by: authUser.id,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      sync_status: 'pending',
    }

    // Salva no cache local de ocorrências para visualização imediata offline
    await offlineDb.putSingleCachedEntity(scope, 'occurrences', tempRecord)

    // Adiciona na fila de sincronização
    const queueItem: SyncQueueItem = {
      id: `q_${clientUuid}`,
      client_uuid: clientUuid,
      municipality: tempRecord.municipality || 'default',
      userId: authUser.id,
      entityType: 'occurrence',
      action: 'create',
      prov_code: provCode,
      payload: {
        title: tempRecord.title,
        description: tempRecord.description,
        type: tempRecord.type,
        severity: tempRecord.severity,
        status: tempRecord.status,
        origin: tempRecord.origin,
        municipality: tempRecord.municipality,
        requester: tempRecord.requester,
        latitude: tempRecord.latitude,
        longitude: tempRecord.longitude,
        address: tempRecord.address,
        affectable_population: tempRecord.affectable_population,
        reported_by: tempRecord.reported_by,
        client_uuid: clientUuid,
        prov_code: provCode,
      },
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await offlineDb.enqueueSyncItem(scope, queueItem)
    await this.refreshPendingCount()

    // Se estiver online, tenta sincronizar imediatamente
    if (this.isOnline) {
      this.triggerSync()
    }

    return { provCode, clientUuid, tempRecord }
  }

  /**
   * Registra um anexo/foto offline na fila vinculado a uma ocorrência
   */
  public async saveOccurrenceFileOffline(params: {
    occurrenceIdOrClientUuid: string
    fileBlob: Blob
    fileName: string
    fileType: 'foto' | 'documento' | 'outro'
    caption?: string
  }): Promise<{ clientUuid: string }> {
    const authUser = pb.authStore.record
    if (!authUser) {
      throw new Error('Usuário autenticado não encontrado.')
    }

    const scope = {
      userId: authUser.id,
      municipalityId: authUser.municipality || 'default',
    }

    const clientUuid = `file_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Salva o binário no store offline_files para não perder
    await offlineDb.saveOfflineFile(scope, clientUuid, params.fileBlob, params.fileName)

    const isTempOcc =
      params.occurrenceIdOrClientUuid.startsWith('temp_') ||
      params.occurrenceIdOrClientUuid.startsWith('occ_')
    const actualOccClientUuid = isTempOcc
      ? params.occurrenceIdOrClientUuid.replace(/^temp_/, '')
      : undefined

    const queueItem: SyncQueueItem = {
      id: `q_${clientUuid}`,
      client_uuid: clientUuid,
      municipality: authUser.municipality || 'default',
      userId: authUser.id,
      entityType: 'occurrence_file',
      action: 'create',
      payload: {
        occurrence: isTempOcc ? '' : params.occurrenceIdOrClientUuid,
        file_type: params.fileType,
        caption: params.caption || params.fileName,
        municipality: authUser.municipality,
        uploaded_by: authUser.id,
        client_uuid: clientUuid,
      },
      fileBlob: params.fileBlob,
      fileName: params.fileName,
      fileFieldName: 'file',
      dependsOnClientUuid: actualOccClientUuid,
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await offlineDb.enqueueSyncItem(scope, queueItem)
    await this.refreshPendingCount()

    if (this.isOnline) {
      this.triggerSync()
    }

    return { clientUuid }
  }

  /**
   * Registra um Requerente offline na fila
   */
  public async saveRequesterOffline(
    data: Partial<Requester>,
  ): Promise<{ clientUuid: string; tempRecord: Requester }> {
    const authUser = pb.authStore.record
    if (!authUser) {
      throw new Error('Usuário autenticado não encontrado.')
    }

    const scope = {
      userId: authUser.id,
      municipalityId: authUser.municipality || 'default',
    }

    const clientUuid = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    const tempRecord: Requester = {
      id: `temp_${clientUuid}`,
      collectionId: 'requesters',
      collectionName: 'requesters',
      municipality: authUser.municipality || data.municipality || 'default',
      name: data.name || '',
      type: data.type || 'pf',
      document: data.document || '',
      rg: data.rg || '',
      phone: data.phone || '',
      email: data.email || '',
      address: data.address || '',
      notes: data.notes || '',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    }

    await offlineDb.putSingleCachedEntity(scope, 'requesters', tempRecord)

    const queueItem: SyncQueueItem = {
      id: `q_${clientUuid}`,
      client_uuid: clientUuid,
      municipality: tempRecord.municipality,
      userId: authUser.id,
      entityType: 'requester',
      action: 'create',
      payload: {
        ...data,
        municipality: tempRecord.municipality,
        client_uuid: clientUuid,
      },
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await offlineDb.enqueueSyncItem(scope, queueItem)
    await this.refreshPendingCount()

    if (this.isOnline) {
      this.triggerSync()
    }

    return { clientUuid, tempRecord }
  }

  /**
   * Registra uma autorização de poda/corte offline
   * Requisito 5: Se preenchida offline, fica pendente até envio ao servidor.
   * Se permissão foi revogada, servidor rejeita emissão automática e mantém pendente/rascunho.
   */
  public async saveTreeAuthorizationOffline(
    data: Partial<TreeAuthorization>,
    agentName: string,
  ): Promise<{ provCode: string; clientUuid: string; tempRecord: TreeAuthorization }> {
    const authUser = pb.authStore.record
    if (!authUser) {
      throw new Error('Usuário autenticado não encontrado.')
    }

    const scope = {
      userId: authUser.id,
      municipalityId: authUser.municipality || 'default',
    }

    const clientUuid = `aut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const provCode = await offlineDb.getNextProvisionalSeq(scope, agentName)

    const tempRecord: TreeAuthorization = {
      id: `temp_${clientUuid}`,
      collectionId: 'tree_authorizations',
      collectionName: 'tree_authorizations',
      municipality: authUser.municipality || data.municipality || 'default',
      number: provCode,
      prov_code: provCode,
      client_uuid: clientUuid,
      status: 'rascunho', // localmente fica como pendente de emissão pelo backend
      type: data.type || 'poda',
      requester: data.requester || '',
      tree_quantity: data.tree_quantity || 1,
      tree_species: data.tree_species || '',
      address: data.address || '',
      neighborhood: data.neighborhood || '',
      risk_reason: data.risk_reason || '',
      technical_report: data.technical_report || '',
      compensatory_measures: data.compensatory_measures || '',
      created_by: authUser.id,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
    }

    await offlineDb.putSingleCachedEntity(scope, 'tree_authorizations', tempRecord)

    const queueItem: SyncQueueItem = {
      id: `q_${clientUuid}`,
      client_uuid: clientUuid,
      municipality: tempRecord.municipality,
      userId: authUser.id,
      entityType: 'tree_authorization',
      action: 'create',
      prov_code: provCode,
      payload: {
        ...data,
        status: data.status || 'emitida', // intenção solicitada (servidor valida se emitirá ou deixará rascunho)
        municipality: tempRecord.municipality,
        client_uuid: clientUuid,
        prov_code: provCode,
      },
      status: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    await offlineDb.enqueueSyncItem(scope, queueItem)
    await this.refreshPendingCount()

    if (this.isOnline) {
      this.triggerSync()
    }

    return { provCode, clientUuid, tempRecord }
  }

  /**
   * Dispara o ciclo de sincronização com controle de dependências
   */
  public triggerSync() {
    if (this.syncTimer) clearTimeout(this.syncTimer)
    this.syncTimer = setTimeout(() => {
      this.executeSyncCycle().catch((err) => {
        console.warn('[Sync Engine] Ciclo finalizou com aviso:', err)
      })
    }, 300)
  }

  public async executeSyncCycle(): Promise<{ successCount: number; failedCount: number }> {
    if (this.isSyncing) return { successCount: 0, failedCount: 0 }
    if (!this.isOnline) {
      await this.refreshPendingCount()
      return { successCount: 0, failedCount: 0 }
    }

    const authUser = pb.authStore.record
    if (!authUser) {
      return { successCount: 0, failedCount: 0 }
    }

    const scope = {
      userId: authUser.id,
      municipalityId: authUser.municipality || 'default',
    }

    this.isSyncing = true
    this.lastError = undefined
    this.notify()

    let successCount = 0
    let failedCount = 0

    // Mapa de correspondência client_uuid -> servidor real id
    const resolvedIds = new Map<string, string>()

    try {
      const queue = await offlineDb.getPendingQueue(scope)

      // Ordenar por tipo de entidade para garantir respeito a dependências:
      // 1. requester
      // 2. occurrence / tree_authorization / official_document
      // 3. occurrence_file (anexos)
      const typePriority: Record<string, number> = {
        requester: 1,
        occurrence: 2,
        tree_authorization: 2,
        official_document: 2,
        occurrence_file: 3,
      }

      queue.sort((a, b) => {
        const pA = typePriority[a.entityType] || 10
        const pB = typePriority[b.entityType] || 10
        if (pA !== pB) return pA - pB
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      })

      for (const item of queue) {
        try {
          item.status = 'processing'
          await offlineDb.updateQueueItem(scope, item)

          let serverRecordId: string | null = null

          // Dependência: Se depende de outro item que acabou de ser criado (ex: ocorrência pai do anexo)
          if (item.dependsOnClientUuid && resolvedIds.has(item.dependsOnClientUuid)) {
            const realParentId = resolvedIds.get(item.dependsOnClientUuid)!
            if (item.entityType === 'occurrence_file') {
              item.payload.occurrence = realParentId
            }
          }

          // Se o requerente foi criado nesta rodada offline e é referenciado na ocorrência
          if (
            item.entityType === 'occurrence' &&
            item.payload.requester &&
            item.payload.requester.startsWith('temp_req_')
          ) {
            const reqClientUuid = item.payload.requester.replace(/^temp_/, '')
            if (resolvedIds.has(reqClientUuid)) {
              item.payload.requester = resolvedIds.get(reqClientUuid)!
            }
          }

          // Processamento conforme entidade
          if (item.entityType === 'occurrence') {
            serverRecordId = await this.syncOccurrenceItem(item)
          } else if (item.entityType === 'requester') {
            serverRecordId = await this.syncRequesterItem(item)
          } else if (item.entityType === 'tree_authorization') {
            serverRecordId = await this.syncTreeAuthItem(item)
          } else if (item.entityType === 'occurrence_file') {
            serverRecordId = await this.syncFileItem(scope, item)
          }

          if (serverRecordId) {
            resolvedIds.set(item.client_uuid, serverRecordId)
            // Confirmação do servidor recebida com sucesso: remove com segurança da fila
            await offlineDb.removeQueueItem(scope, item.id)
            successCount++
          }
        } catch (err: any) {
          failedCount++
          const errMsg = err?.message || String(err)
          item.retryCount = (item.retryCount || 0) + 1
          item.lastError = errMsg
          item.status = 'failed'
          item.updatedAt = new Date().toISOString()
          await offlineDb.updateQueueItem(scope, item)
          this.lastError = errMsg
          console.error(
            `[Sync Engine] Falha no item ${item.entityType} (${item.client_uuid}):`,
            errMsg,
          )
        }
      }

      this.lastSyncTime = new Date()
    } catch (cycleErr: any) {
      this.lastError = cycleErr?.message || String(cycleErr)
    } finally {
      this.isSyncing = false
      await this.refreshPendingCount()
      this.notify()
    }

    return { successCount, failedCount }
  }

  // --- Handlers específicos de cada entidade com Idempotência ---

  private async syncOccurrenceItem(item: SyncQueueItem): Promise<string> {
    const payload = { ...item.payload }

    // 1. Verificar idempotência no backend: se já existe registro com esse client_uuid
    try {
      const existing = await pb
        .collection('occurrences')
        .getFirstListItem<Occurrence>(`client_uuid = "${item.client_uuid}"`, { requestKey: null })
      if (existing) {
        // Já existe no servidor: não duplica
        return existing.id
      }
    } catch {
      // Registro não existe ainda, prossegue para criar
    }

    try {
      const created = await pb.collection('occurrences').create<Occurrence>(payload)
      return created.id
    } catch (createErr: any) {
      // Caso ocorra colisão detectada pelo hook do backend (DUPLICATE_CLIENT_UUID)
      if (createErr?.message && createErr.message.includes('DUPLICATE_CLIENT_UUID')) {
        const parts = createErr.message.split(':')
        if (parts[1]) return parts[1]
      }
      throw createErr
    }
  }

  private async syncRequesterItem(item: SyncQueueItem): Promise<string> {
    const payload = { ...item.payload }

    try {
      const existing = await pb
        .collection('requesters')
        .getFirstListItem<Requester>(`client_uuid = "${item.client_uuid}"`, { requestKey: null })
      if (existing) {
        return existing.id
      }
    } catch {
      // Prossegue
    }

    const created = await pb.collection('requesters').create<Requester>(payload)
    return created.id
  }

  private async syncTreeAuthItem(item: SyncQueueItem): Promise<string> {
    const payload = { ...item.payload }

    try {
      const existing = await pb
        .collection('tree_authorizations')
        .getFirstListItem<TreeAuthorization>(`client_uuid = "${item.client_uuid}"`, {
          requestKey: null,
        })
      if (existing) {
        return existing.id
      }
    } catch {
      // Prossegue
    }

    try {
      const created = await pb.collection('tree_authorizations').create<TreeAuthorization>(payload)
      return created.id
    } catch (authErr: any) {
      if (authErr?.message && authErr.message.includes('DUPLICATE_CLIENT_UUID')) {
        const parts = authErr.message.split(':')
        if (parts[1]) return parts[1]
      }
      throw authErr
    }
  }

  private async syncFileItem(scope: any, item: SyncQueueItem): Promise<string> {
    // 1. Checar idempotência
    try {
      const existing = await pb
        .collection('occurrence_files')
        .getFirstListItem<OccurrenceFile>(`client_uuid = "${item.client_uuid}"`, {
          requestKey: null,
        })
      if (existing) {
        await offlineDb.removeOfflineFile(scope, item.client_uuid)
        return existing.id
      }
    } catch {
      // Prossegue
    }

    // 2. Garantir que a ocorrência principal exista antes de anexar
    if (!item.payload.occurrence) {
      throw new Error('A ocorrência vinculada ao anexo ainda não foi confirmada no servidor.')
    }

    // 3. Recuperar o blob do armazenamento offline
    let blob = item.fileBlob
    let fileName = item.fileName || 'anexo.jpg'

    if (!blob) {
      const fileData = await offlineDb.getOfflineFile(scope, item.client_uuid)
      if (fileData) {
        blob = fileData.blob
        fileName = fileData.fileName
      }
    }

    if (!blob) {
      throw new Error('Arquivo binário não encontrado no cache offline local.')
    }

    const formData = new FormData()
    formData.append('file', blob, fileName)
    formData.append('occurrence', item.payload.occurrence)
    formData.append('municipality', item.payload.municipality || '')
    formData.append('uploaded_by', item.payload.uploaded_by || '')
    formData.append('file_type', item.payload.file_type || 'foto')
    formData.append('caption', item.payload.caption || fileName)
    formData.append('client_uuid', item.client_uuid)

    const created = await pb.collection('occurrence_files').create<OccurrenceFile>(formData)

    // Remove blob local após confirmação
    await offlineDb.removeOfflineFile(scope, item.client_uuid)
    return created.id
  }
}

export const offlineSyncManager = new OfflineSyncManager()
