import pb from '@/lib/pocketbase/client'
import type { Occurrence, Shelter, Team, Supply, Alert, AffectedArea } from '@/types/defesa-civil'

// Helper to normalize PB errors
export function getErrorMessage(err: unknown, fallback: string = 'Ocorreu um erro'): string {
  if (!err) return fallback
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String((err as { message: unknown }).message)
  }
  return fallback
}

// Occurrences
export const occurrencesService = {
  async list(filter?: string, sort = '-created') {
    return pb.collection('occurrences').getFullList<Occurrence>({
      filter,
      sort,
      expand: 'reported_by',
      requestKey: null,
    })
  },
  async get(id: string) {
    return pb.collection('occurrences').getOne<Occurrence>(id, {
      expand: 'reported_by',
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
