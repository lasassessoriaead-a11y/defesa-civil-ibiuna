import pb from '@/lib/pocketbase/client'
import { offlineDb } from './offline-db'
import { offlineSyncManager } from './offline-sync'
import type {
  Occurrence,
  Shelter,
  Team,
  Supply,
  Alert,
  AffectedArea,
  WhatsAppMessage,
  AppSetting,
  WhatsAppConfigInfo,
  Municipality,
  Requester,
  OccurrenceFile,
  AuditLogEntry,
  User,
  UserRole,
  DocTemplate,
  OfficialDocument,
  TreeAuthorization,
  DocumentReviewAiResult,
} from '@/types/defesa-civil'

// Helper to normalize PB errors
export function getErrorMessage(err: unknown, fallback: string = 'Ocorreu um erro'): string {
  if (!err) return fallback
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return fallback
}

// Municipalities Service
export const municipalitiesService = {
  async list() {
    return pb.collection('municipalities').getFullList<Municipality>({
      sort: 'name',
      requestKey: null,
    })
  },
  async get(id: string) {
    return pb.collection('municipalities').getOne<Municipality>(id, {
      requestKey: null,
    })
  },
  async update(id: string, data: Partial<Municipality>) {
    return pb.collection('municipalities').update<Municipality>(id, data)
  },
  getLogoUrl(record: Municipality, filename?: string) {
    if (!filename && record.logo) filename = record.logo
    if (!filename) return ''
    return pb.files.getURL(record, filename)
  },
}

// Templates de Documentos Oficiais
export const docTemplatesService = {
  async list(filter?: string, sort = 'title') {
    return pb.collection('doc_templates').getFullList<DocTemplate>({
      filter,
      sort,
      expand: 'created_by',
      requestKey: null,
    })
  },
  async get(id: string) {
    return pb.collection('doc_templates').getOne<DocTemplate>(id, {
      expand: 'created_by',
      requestKey: null,
    })
  },
  async create(data: Partial<DocTemplate>) {
    return pb.collection('doc_templates').create<DocTemplate>(data)
  },
  async update(id: string, data: Partial<DocTemplate>) {
    return pb.collection('doc_templates').update<DocTemplate>(id, data)
  },
  async delete(id: string) {
    return pb.collection('doc_templates').delete(id)
  },
}

// Official Documents (Ofícios)
export const officialDocumentsService = {
  async list(filter?: string, sort = '-created') {
    return pb.collection('official_documents').getFullList<OfficialDocument>({
      filter,
      sort,
      expand: 'municipality,template,signatory_user,created_by',
      requestKey: null,
    })
  },
  async get(id: string) {
    return pb.collection('official_documents').getOne<OfficialDocument>(id, {
      expand: 'municipality,template,signatory_user,created_by',
      requestKey: null,
    })
  },
  async create(data: Partial<OfficialDocument>) {
    return pb.collection('official_documents').create<OfficialDocument>(data)
  },
  async update(id: string, data: Partial<OfficialDocument>) {
    return pb.collection('official_documents').update<OfficialDocument>(id, data)
  },
  async delete(id: string) {
    return pb.collection('official_documents').delete(id)
  },
  async reviewWithAi(
    text: string,
    mode: 'revisao' | 'formal' | 'aprimoramento' = 'revisao',
  ): Promise<DocumentReviewAiResult> {
    const res = await pb.send('/backend/v1/documents/review-ai', {
      method: 'POST',
      body: JSON.stringify({ text, mode }),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return res as DocumentReviewAiResult
  },
}

// Tree Authorizations (Autorizações de Corte e Poda) com cache e offline
export const treeAuthorizationsService = {
  async list(filter?: string, sort = '-created') {
    const authUser = pb.authStore.record
    const scope = authUser
      ? { userId: authUser.id, municipalityId: authUser.municipality || 'default' }
      : null

    if (typeof navigator !== 'undefined' && !navigator.onLine && scope) {
      return offlineDb.getCachedEntities<TreeAuthorization>(scope, 'tree_authorizations')
    }

    try {
      const records = await pb.collection('tree_authorizations').getFullList<TreeAuthorization>({
        filter,
        sort,
        expand: 'municipality,requester,authorized_by,created_by',
        requestKey: null,
      })
      if (scope) {
        offlineDb.cacheEntities(scope, 'tree_authorizations', records).catch(() => {})
      }
      return records
    } catch (err) {
      if (scope) {
        const cached = await offlineDb.getCachedEntities<TreeAuthorization>(
          scope,
          'tree_authorizations',
        )
        if (cached.length > 0) return cached
      }
      throw err
    }
  },
  async get(id: string) {
    return pb.collection('tree_authorizations').getOne<TreeAuthorization>(id, {
      expand: 'municipality,requester,authorized_by,created_by',
      requestKey: null,
    })
  },
  async create(data: Partial<TreeAuthorization>, agentName = 'Agente') {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const { tempRecord } = await offlineSyncManager.saveTreeAuthorizationOffline(data, agentName)
      return tempRecord
    }
    const clientUuid = `aut_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const record = await pb.collection('tree_authorizations').create<TreeAuthorization>({
      ...data,
      client_uuid: clientUuid,
    })
    const authUser = pb.authStore.record
    if (authUser) {
      offlineDb
        .putSingleCachedEntity(
          { userId: authUser.id, municipalityId: authUser.municipality || 'default' },
          'tree_authorizations',
          record,
        )
        .catch(() => {})
    }
    return record
  },
  async update(id: string, data: Partial<TreeAuthorization>) {
    return pb.collection('tree_authorizations').update<TreeAuthorization>(id, data)
  },
  async delete(id: string) {
    return pb.collection('tree_authorizations').delete(id)
  },
}

// Users Service
export const usersService = {
  async list(filter?: string) {
    return pb.collection('users').getFullList<User>({
      filter,
      sort: 'name',
      requestKey: null,
    })
  },
  async get(id: string) {
    return pb.collection('users').getOne<User>(id, {
      requestKey: null,
    })
  },
  async update(id: string, data: Partial<User>) {
    return pb.collection('users').update<User>(id, data)
  },
  // Operações Administrativas isoladas por Prefeitura (Backend Hooks autenticados)
  async adminCreate(params: {
    name: string
    email: string
    password: string
    role: UserRole
    department?: string
  }): Promise<{ success: boolean; user: User }> {
    const res = await pb.send('/backend/v1/users/admin-create', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return res as { success: boolean; user: User }
  },
  async adminUpdate(params: {
    id: string
    name?: string
    role?: UserRole
    department?: string
    is_active?: boolean
  }): Promise<{ success: boolean; user: User }> {
    const res = await pb.send('/backend/v1/users/admin-update', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return res as { success: boolean; user: User }
  },
  async adminResetPassword(params: {
    id: string
    password: string
  }): Promise<{ success: boolean; message: string }> {
    const res = await pb.send('/backend/v1/users/admin-reset-password', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return res as { success: boolean; message: string }
  },
}

// Occurrences com suporte a cache de leitura e offline
export const occurrencesService = {
  async list(filter?: string, sort = '-created') {
    const authUser = pb.authStore.record
    const scope = authUser
      ? { userId: authUser.id, municipalityId: authUser.municipality || 'default' }
      : null

    if (typeof navigator !== 'undefined' && !navigator.onLine && scope) {
      // Offline: Ler do cache IndexedDB
      const cached = await offlineDb.getCachedEntities<Occurrence>(scope, 'occurrences')
      return cached
    }

    try {
      const records = await pb.collection('occurrences').getFullList<Occurrence>({
        filter,
        sort,
        expand: 'reported_by,requester,municipality',
        requestKey: null,
      })

      // Atualiza cache de leitura local com dados frescos
      if (scope) {
        offlineDb.cacheEntities(scope, 'occurrences', records).catch(() => {})
      }
      return records
    } catch (netErr) {
      if (scope) {
        const cached = await offlineDb.getCachedEntities<Occurrence>(scope, 'occurrences')
        if (cached.length > 0) return cached
      }
      throw netErr
    }
  },
  async get(id: string) {
    return pb.collection('occurrences').getOne<Occurrence>(id, {
      expand: 'reported_by,requester,municipality',
      requestKey: null,
    })
  },
  async create(data: Partial<Occurrence>, agentName = 'Agente') {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      // Criação offline
      const { tempRecord } = await offlineSyncManager.saveOccurrenceOffline(data, agentName)
      return tempRecord
    }

    try {
      const clientUuid = `occ_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
      const payload = {
        ...data,
        client_uuid: clientUuid,
      }
      const record = await pb.collection('occurrences').create<Occurrence>(payload)
      const authUser = pb.authStore.record
      if (authUser) {
        offlineDb
          .putSingleCachedEntity(
            { userId: authUser.id, municipalityId: authUser.municipality || 'default' },
            'occurrences',
            record,
          )
          .catch(() => {})
      }
      return record
    } catch (err) {
      // Se falhar a rede no envio, enfileira offline
      if (
        typeof navigator !== 'undefined' &&
        (!navigator.onLine ||
          String(err).includes('Failed to fetch') ||
          String(err).includes('NetworkError'))
      ) {
        const { tempRecord } = await offlineSyncManager.saveOccurrenceOffline(data, agentName)
        return tempRecord
      }
      throw err
    }
  },
  async update(id: string, data: Partial<Occurrence>) {
    return pb.collection('occurrences').update<Occurrence>(id, data)
  },
  async delete(id: string) {
    return pb.collection('occurrences').delete(id)
  },
}

// Requesters (Requerentes) com suporte a cache e offline
export const requestersService = {
  async list(filter?: string, sort = 'name') {
    const authUser = pb.authStore.record
    const scope = authUser
      ? { userId: authUser.id, municipalityId: authUser.municipality || 'default' }
      : null

    if (typeof navigator !== 'undefined' && !navigator.onLine && scope) {
      return offlineDb.getCachedEntities<Requester>(scope, 'requesters')
    }

    try {
      const records = await pb.collection('requesters').getFullList<Requester>({
        filter,
        sort,
        requestKey: null,
      })
      if (scope) {
        offlineDb.cacheEntities(scope, 'requesters', records).catch(() => {})
      }
      return records
    } catch (err) {
      if (scope) {
        const cached = await offlineDb.getCachedEntities<Requester>(scope, 'requesters')
        if (cached.length > 0) return cached
      }
      throw err
    }
  },
  async get(id: string) {
    return pb.collection('requesters').getOne<Requester>(id, {
      requestKey: null,
    })
  },
  async create(data: Partial<Requester>) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const { tempRecord } = await offlineSyncManager.saveRequesterOffline(data)
      return tempRecord
    }
    const clientUuid = `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const record = await pb.collection('requesters').create<Requester>({
      ...data,
      client_uuid: clientUuid,
    })
    const authUser = pb.authStore.record
    if (authUser) {
      offlineDb
        .putSingleCachedEntity(
          { userId: authUser.id, municipalityId: authUser.municipality || 'default' },
          'requesters',
          record,
        )
        .catch(() => {})
    }
    return record
  },
  async update(id: string, data: Partial<Requester>) {
    return pb.collection('requesters').update<Requester>(id, data)
  },
  async delete(id: string) {
    return pb.collection('requesters').delete(id)
  },
}

// Occurrence Files (Anexos)
export const occurrenceFilesService = {
  async listForOccurrence(occurrenceId: string) {
    return pb.collection('occurrence_files').getFullList<OccurrenceFile>({
      filter: `occurrence = "${occurrenceId}"`,
      sort: '-created',
      expand: 'uploaded_by',
      requestKey: null,
    })
  },
  async upload(formData: FormData) {
    return pb.collection('occurrence_files').create<OccurrenceFile>(formData)
  },
  async delete(id: string) {
    return pb.collection('occurrence_files').delete(id)
  },
  getFileUrl(record: OccurrenceFile, filename: string) {
    return pb.files.getURL(record, filename)
  },
}

// Audit Log (Trilha de Auditoria)
export const auditLogService = {
  async list(filter?: string, sort = '-created', limit = 100) {
    return pb.collection('audit_log').getList<AuditLogEntry>(1, limit, {
      filter,
      sort,
      requestKey: null,
    })
  },
  async create(data: Partial<AuditLogEntry> & { resource?: string }) {
    const payload: Record<string, any> = { ...data }
    // Normalizar resource -> collection para aderência ao schema de audit_log
    if (payload.resource && !payload.collection) {
      payload.collection = payload.resource
      delete payload.resource
    }
    // Preencher municipality se omitido a partir do usuário autenticado
    if (!payload.municipality && pb.authStore.record?.municipality) {
      payload.municipality = pb.authStore.record.municipality
    }
    // Preencher identificação do usuário autenticado se omitida
    if (!payload.user && pb.authStore.record?.id) {
      payload.user = pb.authStore.record.id
    }
    if (!payload.user_name && (pb.authStore.record?.name || pb.authStore.record?.email)) {
      payload.user_name = pb.authStore.record.name || pb.authStore.record.email
    }
    if (!payload.user_email && pb.authStore.record?.email) {
      payload.user_email = pb.authStore.record.email
    }
    if (!payload.origin) {
      payload.origin = 'online'
    }

    try {
      return await pb.collection('audit_log').create<AuditLogEntry>(payload)
    } catch (err) {
      console.warn('[auditLogService.create] Erro ao gravar auditoria:', err)
      // Não propagar falha de auditoria para não quebrar fluxos operacionais essenciais do usuário
      return null as any
    }
  },
}

// Shelters
export const sheltersService = {
  async list(filter?: string, sort = 'name') {
    return pb.collection('shelters').getFullList<Shelter>({
      filter,
      sort,
      requestKey: null,
    })
  },
  async create(data: Partial<Shelter>) {
    return pb.collection('shelters').create<Shelter>(data)
  },
  async update(id: string, data: Partial<Shelter>) {
    return pb.collection('shelters').update<Shelter>(id, data)
  },
  async delete(id: string) {
    return pb.collection('shelters').delete(id)
  },
}

// Teams
export const teamsService = {
  async list(filter?: string, sort = 'name') {
    return pb.collection('teams').getFullList<Team>({
      filter,
      sort,
      expand: 'current_occurrence',
      requestKey: null,
    })
  },
  async create(data: Partial<Team>) {
    return pb.collection('teams').create<Team>(data)
  },
  async update(id: string, data: Partial<Team>) {
    return pb.collection('teams').update<Team>(id, data)
  },
  async delete(id: string) {
    return pb.collection('teams').delete(id)
  },
}

// Supplies
export const suppliesService = {
  async list(filter?: string, sort = 'category,name') {
    return pb.collection('supplies').getFullList<Supply>({
      filter,
      sort,
      requestKey: null,
    })
  },
  async create(data: Partial<Supply>) {
    return pb.collection('supplies').create<Supply>(data)
  },
  async update(id: string, data: Partial<Supply>) {
    return pb.collection('supplies').update<Supply>(id, data)
  },
  async delete(id: string) {
    return pb.collection('supplies').delete(id)
  },
}

// Alerts
export const alertsService = {
  async list(filter?: string, sort = '-created') {
    return pb.collection('alerts').getFullList<Alert>({
      filter,
      sort,
      expand: 'sent_by,related_occurrence',
      requestKey: null,
    })
  },
  async create(data: Partial<Alert>) {
    return pb.collection('alerts').create<Alert>(data)
  },
  async update(id: string, data: Partial<Alert>) {
    return pb.collection('alerts').update<Alert>(id, data)
  },
  async delete(id: string) {
    return pb.collection('alerts').delete(id)
  },
  async generateDraft(params: {
    type: string
    severity: string
    target_area?: string
    title?: string
  }): Promise<{ message: string }> {
    const res = await pb.send('/backend/v1/alerts/draft', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return res as { message: string }
  },
}

// Affected Areas
export const affectedAreasService = {
  async list(filter?: string, sort = 'name') {
    return pb.collection('affected_areas').getFullList<AffectedArea>({
      filter,
      sort,
      requestKey: null,
    })
  },
  async create(data: Partial<AffectedArea>) {
    return pb.collection('affected_areas').create<AffectedArea>(data)
  },
  async update(id: string, data: Partial<AffectedArea>) {
    return pb.collection('affected_areas').update<AffectedArea>(id, data)
  },
  async delete(id: string) {
    return pb.collection('affected_areas').delete(id)
  },
}

// WhatsApp Service
export const whatsappService = {
  async listMessages(filter?: string, sort = '-created') {
    return pb.collection('whatsapp_messages').getFullList<WhatsAppMessage>({
      filter,
      sort,
      expand: 'occurrence',
      requestKey: null,
    })
  },
  async getMessagesForNumber(phoneNumber: string) {
    const clean = phoneNumber.replace(/\D/g, '')
    return pb.collection('whatsapp_messages').getFullList<WhatsAppMessage>({
      filter: `from_number ~ "${clean}" || to_number ~ "${clean}"`,
      sort: 'created',
      expand: 'occurrence',
      requestKey: null,
    })
  },
  async sendMessage(params: { to: string; message: string; occurrence_id?: string }) {
    const res = await pb.send('/backend/v1/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify(params),
      headers: {
        'Content-Type': 'application/json',
      },
    })
    return res as {
      success: boolean
      sid?: string
      warning?: string
      error?: string
      record?: WhatsAppMessage
    }
  },
  async getConfig(): Promise<WhatsAppConfigInfo> {
    const res = await pb.send('/backend/v1/whatsapp/config', {
      method: 'GET',
    })
    return res as WhatsAppConfigInfo
  },
}

// App Settings Service
export const appSettingsService = {
  async get(key: string, defaultValue = ''): Promise<string> {
    try {
      const records = await pb.collection('app_settings').getList<AppSetting>(1, 1, {
        filter: `key = "${key}"`,
        requestKey: null,
      })
      if (records.items.length > 0) {
        return records.items[0].value
      }
      return defaultValue
    } catch {
      return defaultValue
    }
  },
  async set(key: string, value: string, description?: string): Promise<AppSetting> {
    const records = await pb.collection('app_settings').getList<AppSetting>(1, 1, {
      filter: `key = "${key}"`,
      requestKey: null,
    })
    if (records.items.length > 0) {
      return pb.collection('app_settings').update<AppSetting>(records.items[0].id, {
        value,
        description: description || records.items[0].description,
      })
    }
    return pb.collection('app_settings').create<AppSetting>({
      key,
      value,
      description,
    })
  },
}

// ----------------------------------------------------------------------
// Risk Sectors Service (Setores de Risco — cadastro técnico municipal)
// ----------------------------------------------------------------------
export const riskSectorsService = {
  async list(filter?: string, sort = 'code', limit = 500) {
    return pb.collection('risk_sectors').getFullList<import('@/types/defesa-civil').RiskSector>({
      filter,
      sort,
      batch: limit,
      requestKey: null,
    })
  },
  async get(id: string) {
    return pb.collection('risk_sectors').getOne<import('@/types/defesa-civil').RiskSector>(id, {
      requestKey: null,
    })
  },
  async findByCode(code: string) {
    try {
      const records = await pb
        .collection('risk_sectors')
        .getList<import('@/types/defesa-civil').RiskSector>(1, 1, {
          filter: `code = "${code}"`,
          requestKey: null,
        })
      return records.items[0] || null
    } catch {
      return null
    }
  },
  async create(data: Partial<import('@/types/defesa-civil').RiskSector>) {
    return pb.collection('risk_sectors').create<import('@/types/defesa-civil').RiskSector>(data)
  },
  async update(id: string, data: Partial<import('@/types/defesa-civil').RiskSector>) {
    return pb.collection('risk_sectors').update<import('@/types/defesa-civil').RiskSector>(id, data)
  },
  async upsertByCode(
    data: Partial<import('@/types/defesa-civil').RiskSector> & {
      code: string
      municipality: string
    },
  ) {
    const existing = await this.findByCode(data.code)
    if (existing) {
      return pb
        .collection('risk_sectors')
        .update<import('@/types/defesa-civil').RiskSector>(existing.id, data)
    }
    return pb.collection('risk_sectors').create<import('@/types/defesa-civil').RiskSector>(data)
  },
  async delete(id: string) {
    return pb.collection('risk_sectors').delete(id)
  },
}

// ----------------------------------------------------------------------
// Danger Stretches Service (Trechos de Perigo)
// ----------------------------------------------------------------------
export const dangerStretchesService = {
  async list(filter?: string, sort = 'code', limit = 500) {
    return pb
      .collection('danger_stretches')
      .getFullList<import('@/types/defesa-civil').DangerStretch>({
        filter,
        sort,
        batch: limit,
        requestKey: null,
      })
  },
  async get(id: string) {
    return pb
      .collection('danger_stretches')
      .getOne<import('@/types/defesa-civil').DangerStretch>(id, {
        requestKey: null,
      })
  },
  async findByCode(code: string) {
    try {
      const records = await pb
        .collection('danger_stretches')
        .getList<import('@/types/defesa-civil').DangerStretch>(1, 1, {
          filter: `code = "${code}"`,
          requestKey: null,
        })
      return records.items[0] || null
    } catch {
      return null
    }
  },
  async create(data: Partial<import('@/types/defesa-civil').DangerStretch>) {
    return pb
      .collection('danger_stretches')
      .create<import('@/types/defesa-civil').DangerStretch>(data)
  },
  async update(id: string, data: Partial<import('@/types/defesa-civil').DangerStretch>) {
    return pb
      .collection('danger_stretches')
      .update<import('@/types/defesa-civil').DangerStretch>(id, data)
  },
  async upsertByCode(
    data: Partial<import('@/types/defesa-civil').DangerStretch> & {
      code: string
      municipality: string
    },
  ) {
    const existing = await this.findByCode(data.code)
    if (existing) {
      return pb
        .collection('danger_stretches')
        .update<import('@/types/defesa-civil').DangerStretch>(existing.id, data)
    }
    return pb
      .collection('danger_stretches')
      .create<import('@/types/defesa-civil').DangerStretch>(data)
  },
  async delete(id: string) {
    return pb.collection('danger_stretches').delete(id)
  },
}

// ----------------------------------------------------------------------
// Strategic Infrastructures Service (Pontes, Aduelas e Drenagem)
// ----------------------------------------------------------------------
export const strategicInfrastructuresService = {
  async list(filter?: string, sort = 'original_code', limit = 500) {
    return pb
      .collection('strategic_infrastructures')
      .getFullList<import('@/types/defesa-civil').StrategicInfrastructure>({
        filter,
        sort,
        batch: limit,
        expand: 'verified_by',
        requestKey: null,
      })
  },
  async get(id: string) {
    return pb
      .collection('strategic_infrastructures')
      .getOne<import('@/types/defesa-civil').StrategicInfrastructure>(id, {
        expand: 'verified_by',
        requestKey: null,
      })
  },
  async create(data: Partial<import('@/types/defesa-civil').StrategicInfrastructure>) {
    return pb
      .collection('strategic_infrastructures')
      .create<import('@/types/defesa-civil').StrategicInfrastructure>(data)
  },
  async update(id: string, data: Partial<import('@/types/defesa-civil').StrategicInfrastructure>) {
    return pb
      .collection('strategic_infrastructures')
      .update<import('@/types/defesa-civil').StrategicInfrastructure>(id, data)
  },
  async delete(id: string) {
    return pb.collection('strategic_infrastructures').delete(id)
  },
  async findByCode(code: string) {
    try {
      const records = await pb
        .collection('strategic_infrastructures')
        .getList<import('@/types/defesa-civil').StrategicInfrastructure>(1, 1, {
          filter: `original_code = "${code}"`,
          requestKey: null,
        })
      return records.items[0] || null
    } catch {
      return null
    }
  },
}

// ----------------------------------------------------------------------
// Bridge Inspections Service (Inspeções Técnicas)
// ----------------------------------------------------------------------
export const bridgeInspectionsService = {
  async listForInfrastructure(infraId: string) {
    return pb
      .collection('bridge_inspections')
      .getFullList<import('@/types/defesa-civil').BridgeInspection>({
        filter: `infrastructure = "${infraId}"`,
        sort: '-inspection_date',
        expand: 'inspector',
        requestKey: null,
      })
  },
  async create(data: Partial<import('@/types/defesa-civil').BridgeInspection>) {
    return pb
      .collection('bridge_inspections')
      .create<import('@/types/defesa-civil').BridgeInspection>(data)
  },
}

// ----------------------------------------------------------------------
// External Demands Service (Demandas para outras Secretarias)
// ----------------------------------------------------------------------
export const externalDemandsService = {
  async list(filter?: string, sort = '-created') {
    return pb
      .collection('external_demands')
      .getFullList<import('@/types/defesa-civil').ExternalDemand>({
        filter,
        sort,
        expand: 'related_occurrence,related_infrastructure,created_by',
        requestKey: null,
      })
  },
  async get(id: string) {
    return pb
      .collection('external_demands')
      .getOne<import('@/types/defesa-civil').ExternalDemand>(id, {
        expand: 'related_occurrence,related_infrastructure,created_by',
        requestKey: null,
      })
  },
  async create(data: Partial<import('@/types/defesa-civil').ExternalDemand>) {
    return pb
      .collection('external_demands')
      .create<import('@/types/defesa-civil').ExternalDemand>(data)
  },
  async update(id: string, data: Partial<import('@/types/defesa-civil').ExternalDemand>) {
    return pb
      .collection('external_demands')
      .update<import('@/types/defesa-civil').ExternalDemand>(id, data)
  },
  async delete(id: string) {
    return pb.collection('external_demands').delete(id)
  },
}

// ----------------------------------------------------------------------
// Geo Imports Batch Service (Auditoria e Lotes)
// ----------------------------------------------------------------------
export const geoImportsService = {
  async list(filter?: string, sort = '-created') {
    return pb.collection('geo_imports').getFullList<import('@/types/defesa-civil').GeoImportBatch>({
      filter,
      sort,
      expand: 'imported_by',
      requestKey: null,
    })
  },
  async create(data: Partial<import('@/types/defesa-civil').GeoImportBatch>) {
    return pb.collection('geo_imports').create<import('@/types/defesa-civil').GeoImportBatch>(data)
  },
}

// ----------------------------------------------------------------------
// Agent Profiles Service (Ficha Funcional, Medidas e Uniformes)
// ----------------------------------------------------------------------
export const agentProfilesService = {
  async list(filter?: string, sort = 'full_name') {
    return pb
      .collection('agent_profiles')
      .getFullList<import('@/types/defesa-civil').AgentProfile>({
        filter,
        sort,
        expand: 'user,municipality',
        requestKey: null,
      })
  },
  async getByUserId(userId: string) {
    try {
      const records = await pb
        .collection('agent_profiles')
        .getList<import('@/types/defesa-civil').AgentProfile>(1, 1, {
          filter: `user = "${userId}"`,
          expand: 'user,municipality',
          requestKey: null,
        })
      return records.items[0] || null
    } catch {
      return null
    }
  },
  async get(id: string) {
    return pb.collection('agent_profiles').getOne<import('@/types/defesa-civil').AgentProfile>(id, {
      expand: 'user,municipality',
      requestKey: null,
    })
  },
  async create(data: Partial<import('@/types/defesa-civil').AgentProfile>) {
    return pb.collection('agent_profiles').create<import('@/types/defesa-civil').AgentProfile>(data)
  },
  async update(id: string, data: Partial<import('@/types/defesa-civil').AgentProfile>) {
    return pb
      .collection('agent_profiles')
      .update<import('@/types/defesa-civil').AgentProfile>(id, data)
  },
  async delete(id: string) {
    return pb.collection('agent_profiles').delete(id)
  },
}

// ----------------------------------------------------------------------
// EPI Items Service (Catálogo e Estoque de EPIs)
// ----------------------------------------------------------------------
export const epiItemsService = {
  async list(filter?: string, sort = 'name') {
    return pb.collection('epi_items').getFullList<import('@/types/defesa-civil').EpiItem>({
      filter,
      sort,
      requestKey: null,
    })
  },
  async get(id: string) {
    return pb.collection('epi_items').getOne<import('@/types/defesa-civil').EpiItem>(id, {
      requestKey: null,
    })
  },
  async create(data: Partial<import('@/types/defesa-civil').EpiItem>) {
    return pb.collection('epi_items').create<import('@/types/defesa-civil').EpiItem>(data)
  },
  async update(id: string, data: Partial<import('@/types/defesa-civil').EpiItem>) {
    return pb.collection('epi_items').update<import('@/types/defesa-civil').EpiItem>(id, data)
  },
  async delete(id: string) {
    return pb.collection('epi_items').delete(id)
  },
}

// ----------------------------------------------------------------------
// EPI Deliveries Service (Entregas, Histórico de Substituições e Baixas)
// ----------------------------------------------------------------------
export const epiDeliveriesService = {
  async list(filter?: string, sort = '-delivery_date') {
    return pb.collection('epi_deliveries').getFullList<import('@/types/defesa-civil').EpiDelivery>({
      filter,
      sort,
      expand: 'agent,item,delivered_by',
      requestKey: null,
    })
  },
  async listForAgent(agentId: string) {
    return pb.collection('epi_deliveries').getFullList<import('@/types/defesa-civil').EpiDelivery>({
      filter: `agent = "${agentId}"`,
      sort: '-delivery_date',
      expand: 'agent,item,delivered_by',
      requestKey: null,
    })
  },
  async get(id: string) {
    return pb.collection('epi_deliveries').getOne<import('@/types/defesa-civil').EpiDelivery>(id, {
      expand: 'agent,item,delivered_by',
      requestKey: null,
    })
  },
  async create(data: Partial<import('@/types/defesa-civil').EpiDelivery>) {
    return pb.collection('epi_deliveries').create<import('@/types/defesa-civil').EpiDelivery>(data)
  },
  async update(id: string, data: Partial<import('@/types/defesa-civil').EpiDelivery>) {
    return pb
      .collection('epi_deliveries')
      .update<import('@/types/defesa-civil').EpiDelivery>(id, data)
  },
  async delete(id: string) {
    return pb.collection('epi_deliveries').delete(id)
  },
}

// ----------------------------------------------------------------------
// Geo Layers Service (Camadas Espaciais Oficiais de Ibiúna)
// ----------------------------------------------------------------------
export const geoLayersService = {
  async list(filter?: string, sort = 'name', limit = 1000) {
    return pb.collection('geo_layers').getFullList({
      filter,
      sort,
      batch: limit,
      requestKey: null,
    })
  },
  async get(id: string) {
    return pb.collection('geo_layers').getOne(id, { requestKey: null })
  },
  async listByType(municipalityId: string, layerType: string) {
    return pb.collection('geo_layers').getFullList({
      filter: `municipality = "${municipalityId}" && layer_type = "${layerType}"`,
      batch: 1000,
      requestKey: null,
    })
  },
  async create(data: any) {
    return pb.collection('geo_layers').create(data)
  },
  async update(id: string, data: any) {
    return pb.collection('geo_layers').update(id, data)
  },
  async delete(id: string) {
    return pb.collection('geo_layers').delete(id)
  },
}

// ----------------------------------------------------------------------
// Record Attachments Service (Universal para todas as fichas técnicas)
// ----------------------------------------------------------------------
export const recordAttachmentsService = {
  async listForRecord(targetCollection: string, targetId: string, category?: string) {
    let filter = `target_collection = "${targetCollection}" && target_id = "${targetId}"`
    if (category && category !== 'all') {
      filter += ` && category = "${category}"`
    }
    return pb
      .collection('record_attachments')
      .getFullList<import('@/types/defesa-civil').RecordAttachment>({
        filter,
        sort: '-created',
        expand: 'uploaded_by',
        requestKey: null,
      })
  },
  async get(id: string) {
    return pb
      .collection('record_attachments')
      .getOne<import('@/types/defesa-civil').RecordAttachment>(id, {
        expand: 'uploaded_by',
        requestKey: null,
      })
  },
  async create(data: FormData | Partial<import('@/types/defesa-civil').RecordAttachment>) {
    return pb
      .collection('record_attachments')
      .create<import('@/types/defesa-civil').RecordAttachment>(data as any)
  },
  async upload(formData: FormData) {
    return pb
      .collection('record_attachments')
      .create<import('@/types/defesa-civil').RecordAttachment>(formData)
  },
  async update(id: string, data: Partial<import('@/types/defesa-civil').RecordAttachment>) {
    return pb
      .collection('record_attachments')
      .update<import('@/types/defesa-civil').RecordAttachment>(id, data)
  },
  async delete(id: string) {
    return pb.collection('record_attachments').delete(id)
  },
  getFileUrl(record: { id: string; file: string }, filename?: string) {
    if (!record || !record.file) return ''
    return pb.files.getURL(record as any, filename || record.file)
  },
}

// ----------------------------------------------------------------------
// Municipal Geo Adjustments Service (Ajustes municipais com histórico e preservação)
// ----------------------------------------------------------------------
export const municipalGeoAdjustmentsService = {
  async listForRecord(targetCollection: string, targetId: string) {
    return pb
      .collection('municipal_geo_adjustments')
      .getFullList<import('@/types/defesa-civil').MunicipalGeoAdjustment>({
        filter: `target_collection = "${targetCollection}" && target_id = "${targetId}"`,
        sort: '-created',
        expand: 'author',
        requestKey: null,
      })
  },
  async create(data: Partial<import('@/types/defesa-civil').MunicipalGeoAdjustment>) {
    return pb
      .collection('municipal_geo_adjustments')
      .create<import('@/types/defesa-civil').MunicipalGeoAdjustment>(data)
  },
}

// ----------------------------------------------------------------------
// Urban Consultations Service (Desenvolvimento Urbano & Parcelamento de Solo)
// ----------------------------------------------------------------------
export const urbanConsultationsService = {
  async list(filter?: string, sort = '-created') {
    return pb
      .collection('urban_consultations')
      .getFullList<import('@/types/defesa-civil').UrbanConsultation>({
        filter,
        sort,
        expand: 'created_by,municipality',
        requestKey: null,
      })
  },
  async get(id: string) {
    return pb
      .collection('urban_consultations')
      .getOne<import('@/types/defesa-civil').UrbanConsultation>(id, {
        expand: 'created_by,municipality',
        requestKey: null,
      })
  },
  async create(data: Partial<import('@/types/defesa-civil').UrbanConsultation>) {
    return pb
      .collection('urban_consultations')
      .create<import('@/types/defesa-civil').UrbanConsultation>(data)
  },
  async update(id: string, data: Partial<import('@/types/defesa-civil').UrbanConsultation>) {
    return pb
      .collection('urban_consultations')
      .update<import('@/types/defesa-civil').UrbanConsultation>(id, data)
  },
  async delete(id: string) {
    return pb.collection('urban_consultations').delete(id)
  },
}

// ----------------------------------------------------------------------
// Surveyed Families Service (Levantamento de Famílias e População Exposta)
// ----------------------------------------------------------------------
export const surveyedFamiliesService = {
  async list(filter?: string, sort = 'family_internal_code') {
    return pb
      .collection('surveyed_families')
      .getFullList<import('@/types/defesa-civil').SurveyedFamily>({
        filter,
        sort,
        expand: 'created_by,municipality',
        requestKey: null,
      })
  },
  async get(id: string) {
    return pb
      .collection('surveyed_families')
      .getOne<import('@/types/defesa-civil').SurveyedFamily>(id, {
        expand: 'created_by,municipality',
        requestKey: null,
      })
  },
  async create(data: Partial<import('@/types/defesa-civil').SurveyedFamily>) {
    return pb
      .collection('surveyed_families')
      .create<import('@/types/defesa-civil').SurveyedFamily>(data)
  },
  async update(id: string, data: Partial<import('@/types/defesa-civil').SurveyedFamily>) {
    return pb
      .collection('surveyed_families')
      .update<import('@/types/defesa-civil').SurveyedFamily>(id, data)
  },
  async delete(id: string) {
    return pb.collection('surveyed_families').delete(id)
  },
}

// ----------------------------------------------------------------------
// Social Family Actions Service (Assistência Social)
// ----------------------------------------------------------------------
export const socialFamilyActionsService = {
  async listForFamily(familyId: string) {
    return pb
      .collection('social_family_actions')
      .getFullList<import('@/types/defesa-civil').SocialFamilyAction>({
        filter: `family = "${familyId}"`,
        sort: '-action_date',
        expand: 'created_by',
        requestKey: null,
      })
  },
  async list(filter?: string, sort = '-action_date') {
    return pb
      .collection('social_family_actions')
      .getFullList<import('@/types/defesa-civil').SocialFamilyAction>({
        filter,
        sort,
        expand: 'family,created_by',
        requestKey: null,
      })
  },
  async create(data: Partial<import('@/types/defesa-civil').SocialFamilyAction>) {
    return pb
      .collection('social_family_actions')
      .create<import('@/types/defesa-civil').SocialFamilyAction>(data)
  },
  async update(id: string, data: Partial<import('@/types/defesa-civil').SocialFamilyAction>) {
    return pb
      .collection('social_family_actions')
      .update<import('@/types/defesa-civil').SocialFamilyAction>(id, data)
  },
  async delete(id: string) {
    return pb.collection('social_family_actions').delete(id)
  },
}

// ----------------------------------------------------------------------
// Health Operational Needs Service (Saúde - Necessidades de Apoio / Energia)
// ----------------------------------------------------------------------
export const healthOperationalNeedsService = {
  async listForFamily(familyId: string) {
    return pb
      .collection('health_operational_needs')
      .getFullList<import('@/types/defesa-civil').HealthOperationalNeed>({
        filter: `family = "${familyId}"`,
        sort: '-created',
        expand: 'created_by',
        requestKey: null,
      })
  },
  async list(filter?: string, sort = '-created') {
    return pb
      .collection('health_operational_needs')
      .getFullList<import('@/types/defesa-civil').HealthOperationalNeed>({
        filter,
        sort,
        expand: 'family,created_by',
        requestKey: null,
      })
  },
  async create(data: Partial<import('@/types/defesa-civil').HealthOperationalNeed>) {
    return pb
      .collection('health_operational_needs')
      .create<import('@/types/defesa-civil').HealthOperationalNeed>(data)
  },
  async update(id: string, data: Partial<import('@/types/defesa-civil').HealthOperationalNeed>) {
    return pb
      .collection('health_operational_needs')
      .update<import('@/types/defesa-civil').HealthOperationalNeed>(id, data)
  },
  async delete(id: string) {
    return pb.collection('health_operational_needs').delete(id)
  },
}

// ----------------------------------------------------------------------
// Contingency Plans Service (Planos Municipais, Setoriais e por Cenário)
// ----------------------------------------------------------------------
export const contingencyPlansService = {
  async list(filter?: string, sort = '-created') {
    return pb
      .collection('contingency_plans')
      .getFullList<import('@/types/defesa-civil').ContingencyPlan>({
        filter,
        sort,
        expand: 'created_by,municipality',
        requestKey: null,
      })
  },
  async get(id: string) {
    return pb
      .collection('contingency_plans')
      .getOne<import('@/types/defesa-civil').ContingencyPlan>(id, {
        expand: 'created_by,municipality',
        requestKey: null,
      })
  },
  async create(data: Partial<import('@/types/defesa-civil').ContingencyPlan>) {
    return pb
      .collection('contingency_plans')
      .create<import('@/types/defesa-civil').ContingencyPlan>(data)
  },
  async update(id: string, data: Partial<import('@/types/defesa-civil').ContingencyPlan>) {
    return pb
      .collection('contingency_plans')
      .update<import('@/types/defesa-civil').ContingencyPlan>(id, data)
  },
  async delete(id: string) {
    return pb.collection('contingency_plans').delete(id)
  },
}

// ----------------------------------------------------------------------
// Official References Library Service (Biblioteca Estadual / Federal)
// ----------------------------------------------------------------------
export const officialReferencesService = {
  async list(filter?: string, sort = 'title') {
    return pb
      .collection('official_references_library')
      .getFullList<import('@/types/defesa-civil').OfficialReferenceLibraryItem>({
        filter,
        sort,
        expand: 'created_by',
        requestKey: null,
      })
  },
  async get(id: string) {
    return pb
      .collection('official_references_library')
      .getOne<import('@/types/defesa-civil').OfficialReferenceLibraryItem>(id, {
        expand: 'created_by',
        requestKey: null,
      })
  },
  async create(
    data: FormData | Partial<import('@/types/defesa-civil').OfficialReferenceLibraryItem>,
  ) {
    return pb
      .collection('official_references_library')
      .create<import('@/types/defesa-civil').OfficialReferenceLibraryItem>(data as any)
  },
  async update(
    id: string,
    data: Partial<import('@/types/defesa-civil').OfficialReferenceLibraryItem>,
  ) {
    return pb
      .collection('official_references_library')
      .update<import('@/types/defesa-civil').OfficialReferenceLibraryItem>(id, data)
  },
  async delete(id: string) {
    return pb.collection('official_references_library').delete(id)
  },
  getFileUrl(record: { id: string; document_file?: string }, filename?: string) {
    if (!record || !record.document_file) return ''
    return pb.files.getURL(record as any, filename || record.document_file)
  },
}

// ----------------------------------------------------------------------
// Sector Workspace Config Service (Configurações complementares por Secretaria)
// ----------------------------------------------------------------------
export const sectorWorkspaceConfigService = {
  async list(filter?: string) {
    return pb
      .collection('sector_workspaces_config')
      .getFullList<import('@/types/defesa-civil').SectorWorkspaceConfig>({
        filter,
        sort: 'department_title',
        requestKey: null,
      })
  },
  async getByDepartment(deptKey: string) {
    try {
      const records = await pb
        .collection('sector_workspaces_config')
        .getList<import('@/types/defesa-civil').SectorWorkspaceConfig>(1, 1, {
          filter: `department_key = "${deptKey}"`,
          requestKey: null,
        })
      return records.items[0] || null
    } catch {
      return null
    }
  },
  async saveConfig(
    data: Partial<import('@/types/defesa-civil').SectorWorkspaceConfig> & {
      department_key: string
      municipality: string
    },
  ) {
    const existing = await this.getByDepartment(data.department_key)
    if (existing) {
      return pb
        .collection('sector_workspaces_config')
        .update<import('@/types/defesa-civil').SectorWorkspaceConfig>(existing.id, data)
    }
    return pb
      .collection('sector_workspaces_config')
      .create<import('@/types/defesa-civil').SectorWorkspaceConfig>(data)
  },
}
