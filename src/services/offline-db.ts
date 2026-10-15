/**
 * offline-db.ts
 * Camada de persistência IndexedDB com isolamento estrito por Usuário e Município.
 * Sem dados misturados entre usuários ou municípios diferentes no mesmo navegador.
 */

import type { SyncQueueItem } from '@/types/defesa-civil'

const DB_VERSION = 1

interface StorageScope {
  userId: string
  municipalityId: string
}

function getDbName(scope: StorageScope): string {
  const safeUser = (scope.userId || 'anon').replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeMun = (scope.municipalityId || 'default').replace(/[^a-zA-Z0-9_-]/g, '_')
  return `defesa_civil_cache_${safeMun}_${safeUser}`
}

function openDatabase(scope: StorageScope): Promise<IDBDatabase> {
  const dbName = getDbName(scope)

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Store para cache de leitura das entidades
      if (!db.objectStoreNames.contains('entity_cache')) {
        const entityStore = db.createObjectStore('entity_cache', { keyPath: 'id' })
        entityStore.createIndex('by_entity', 'entityType', { unique: false })
      }

      // Store para a fila de sincronização offline
      if (!db.objectStoreNames.contains('sync_queue')) {
        const queueStore = db.createObjectStore('sync_queue', { keyPath: 'id' })
        queueStore.createIndex('by_client_uuid', 'client_uuid', { unique: true })
        queueStore.createIndex('by_status', 'status', { unique: false })
        queueStore.createIndex('by_created', 'createdAt', { unique: false })
      }

      // Store para blobs e fotos pendentes (evita perda após fechamento da aba)
      if (!db.objectStoreNames.contains('offline_files')) {
        db.createObjectStore('offline_files', { keyPath: 'client_uuid' })
      }

      // Store de metadados locais (ex: contadores provisórios, última sincronização)
      if (!db.objectStoreNames.contains('local_meta')) {
        db.createObjectStore('local_meta', { keyPath: 'key' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const offlineDb = {
  /**
   * Salva em cache leitura local registros recebidos da rede
   */
  async cacheEntities<T extends { id: string }>(
    scope: StorageScope,
    entityType: string,
    items: T[],
  ): Promise<void> {
    const db = await openDatabase(scope)
    return new Promise((resolve, reject) => {
      const tx = db.transaction('entity_cache', 'readwrite')
      const store = tx.objectStore('entity_cache')

      for (const item of items) {
        store.put({
          id: `${entityType}_${item.id}`,
          entityId: item.id,
          entityType,
          data: item,
          cachedAt: new Date().toISOString(),
        })
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },

  /**
   * Obtém registros em cache local de leitura
   */
  async getCachedEntities<T>(scope: StorageScope, entityType: string): Promise<T[]> {
    const db = await openDatabase(scope)
    return new Promise((resolve, reject) => {
      const tx = db.transaction('entity_cache', 'readonly')
      const store = tx.objectStore('entity_cache')
      const index = store.index('by_entity')
      const request = index.getAll(entityType)

      request.onsuccess = () => {
        const results = (request.result || []).map((entry: any) => entry.data as T)
        resolve(results)
      }
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * Atualiza ou insere um único item no cache de leitura (ex: logo após salvar offline)
   */
  async putSingleCachedEntity<T extends { id: string }>(
    scope: StorageScope,
    entityType: string,
    item: T,
  ): Promise<void> {
    const db = await openDatabase(scope)
    return new Promise((resolve, reject) => {
      const tx = db.transaction('entity_cache', 'readwrite')
      const store = tx.objectStore('entity_cache')
      store.put({
        id: `${entityType}_${item.id}`,
        entityId: item.id,
        entityType,
        data: item,
        cachedAt: new Date().toISOString(),
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },

  /**
   * Adiciona uma operação pendente à fila de sincronização
   */
  async enqueueSyncItem(scope: StorageScope, item: SyncQueueItem): Promise<void> {
    const db = await openDatabase(scope)
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite')
      const store = tx.objectStore('sync_queue')
      store.put(item)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },

  /**
   * Lista itens pendentes ou com falha na fila de sincronização
   */
  async getPendingQueue(scope: StorageScope): Promise<SyncQueueItem[]> {
    const db = await openDatabase(scope)
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readonly')
      const store = tx.objectStore('sync_queue')
      const request = store.getAll()

      request.onsuccess = () => {
        const all = (request.result || []) as SyncQueueItem[]
        // Retorna apenas os que ainda não foram marcados como synced
        const pending = all.filter((i) => i.status !== 'synced')
        // Ordena por data de criação
        pending.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        resolve(pending)
      }
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * Conta quantos itens estão pendentes na fila
   */
  async countPendingQueue(scope: StorageScope): Promise<number> {
    const items = await this.getPendingQueue(scope)
    return items.length
  },

  /**
   * Atualiza status de um item da fila
   */
  async updateQueueItem(scope: StorageScope, item: SyncQueueItem): Promise<void> {
    const db = await openDatabase(scope)
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite')
      const store = tx.objectStore('sync_queue')
      store.put(item)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },

  /**
   * Remove item da fila após confirmação do servidor
   */
  async removeQueueItem(scope: StorageScope, queueId: string): Promise<void> {
    const db = await openDatabase(scope)
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite')
      const store = tx.objectStore('sync_queue')
      store.delete(queueId)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },

  /**
   * Salva arquivo binário offline vinculado a um client_uuid
   */
  async saveOfflineFile(
    scope: StorageScope,
    clientUuid: string,
    fileBlob: Blob,
    fileName: string,
  ): Promise<void> {
    const db = await openDatabase(scope)
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_files', 'readwrite')
      const store = tx.objectStore('offline_files')
      store.put({
        client_uuid: clientUuid,
        blob: fileBlob,
        fileName,
        type: fileBlob.type,
        savedAt: new Date().toISOString(),
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },

  /**
   * Recupera arquivo binário offline
   */
  async getOfflineFile(
    scope: StorageScope,
    clientUuid: string,
  ): Promise<{ blob: Blob; fileName: string } | null> {
    const db = await openDatabase(scope)
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_files', 'readonly')
      const store = tx.objectStore('offline_files')
      const request = store.get(clientUuid)

      request.onsuccess = () => {
        if (request.result) {
          resolve({ blob: request.result.blob, fileName: request.result.fileName })
        } else {
          resolve(null)
        }
      }
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * Remove arquivo binário offline após upload concluído
   */
  async removeOfflineFile(scope: StorageScope, clientUuid: string): Promise<void> {
    const db = await openDatabase(scope)
    return new Promise((resolve, reject) => {
      const tx = db.transaction('offline_files', 'readwrite')
      const store = tx.objectStore('offline_files')
      store.delete(clientUuid)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  },

  /**
   * Gerenciador de contador sequencial provisório offline
   * Padrão exigido pelo Requisito 2: OFF-<nomedoagente>-<seq>
   */
  async getNextProvisionalSeq(scope: StorageScope, agentName: string): Promise<string> {
    const db = await openDatabase(scope)
    const cleanAgent = (agentName || 'AGENTE')
      .trim()
      .split(' ')[0]
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9]/g, '')

    return new Promise((resolve, reject) => {
      const tx = db.transaction('local_meta', 'readwrite')
      const store = tx.objectStore('local_meta')
      const key = `prov_seq_${cleanAgent}`
      const request = store.get(key)

      request.onsuccess = () => {
        let currentSeq = 0
        if (request.result && typeof request.result.value === 'number') {
          currentSeq = request.result.value
        }
        const nextSeq = currentSeq + 1
        store.put({ key, value: nextSeq, updatedAt: new Date().toISOString() })
        const padded = String(nextSeq).padStart(3, '0')
        resolve(`OFF-${cleanAgent}-${padded}`)
      }
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * Limpeza segura dos dados locais deste usuário/município
   */
  async clearLocalData(scope: StorageScope): Promise<void> {
    const dbName = getDbName(scope)
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  },
}
