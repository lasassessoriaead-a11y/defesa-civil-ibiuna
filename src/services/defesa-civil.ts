import pb from '@/lib/pocketbase/client'
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
}

// Occurrences
export const occurrencesService = {
  async list(filter?: string, sort = '-created') {
    return pb.collection('occurrences').getFullList<Occurrence>({
      filter,
      sort,
      expand: 'reported_by,requester,municipality',
      requestKey: null,
    })
  },
  async get(id: string) {
    return pb.collection('occurrences').getOne<Occurrence>(id, {
      expand: 'reported_by,requester,municipality',
      requestKey: null,
    })
  },
  async create(data: Partial<Occurrence>) {
    return pb.collection('occurrences').create<Occurrence>(data)
  },
  async update(id: string, data: Partial<Occurrence>) {
    return pb.collection('occurrences').update<Occurrence>(id, data)
  },
  async delete(id: string) {
    return pb.collection('occurrences').delete(id)
  },
}

// Requesters (Requerentes)
export const requestersService = {
  async list(filter?: string, sort = 'name') {
    return pb.collection('requesters').getFullList<Requester>({
      filter,
      sort,
      requestKey: null,
    })
  },
  async get(id: string) {
    return pb.collection('requesters').getOne<Requester>(id, {
      requestKey: null,
    })
  },
  async create(data: Partial<Requester>) {
    return pb.collection('requesters').create<Requester>(data)
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
