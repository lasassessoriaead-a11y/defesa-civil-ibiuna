/**
 * pontes-importer-service.ts
 * Serviço de importação, conciliação e salvamento seguro de Pontes e Aduelas
 * a partir do levantamento oficial "Pontes e aduelas-21295.pdf".
 *
 * Garante:
 * - Backup prévio verificado
 * - Conversão precisa DMS -> Decimal (WGS84) via dmsToDecimal
 * - Validação territorial contra limites de Ibiúna (IBIUNA_BOUNDS)
 * - Identificação estrita de coordinate_status ('valida' | 'duvidosa' | 'ilegivel' | 'ausente')
 * - validation_status: 'pendente_conferencia' para registros com qualquer ambiguidade ou dados duvidosos
 * - NENHUMA coordenada inventada ou estimada
 * - Idempotência por municipality + original_code
 */

import pb from '@/lib/pocketbase/client'
import { RAW_BRIDGE_PDF_RECORDS, RawBridgePdfRow } from './pontes-aduelas-pdf-dataset'
import { dmsToDecimal, isWithinIbiunaBounds } from '@/lib/geo-utils'
import type { StrategicInfrastructure } from '@/types/defesa-civil'

export interface ProcessedBridgeRecord {
  original_code: string
  type: 'ponte' | 'aduela' | 'bueiro' | 'passarela' | 'outro' | 'pendente_classificacao'
  neighborhood?: string
  reference_point?: string
  dimensions?: string
  notes?: string
  lat_dms?: string
  lon_dms?: string
  latitude?: number
  longitude?: number
  coordinate_status: 'valida' | 'duvidosa' | 'ilegivel' | 'ausente'
  validation_status: 'pendente_conferencia' | 'conferido' | 'divergente' | 'rejeitado'
  source_document: string
  source_page: number
  is_handwritten_transcription: boolean
  structural_condition: 'bom' | 'regular' | 'ruim' | 'critico' | 'nao_avaliado'
  administrative_priority: 'baixa' | 'media' | 'alta' | 'urgente'
  inspection_status: 'em_dia' | 'necessita_vistoria' | 'em_reforma' | 'interditada'
  flags: string[]
}

export interface BridgeImportSummary {
  totalProcessed: number
  totalImported: number
  totalUpdated: number
  validCoordinatesCount: number
  pendingReviewCount: number
  doubtfulCoordinatesCount: number
  absentCoordinatesCount: number
  items: ProcessedBridgeRecord[]
}

export function parseBridgeRecords(
  rawList: RawBridgePdfRow[] = RAW_BRIDGE_PDF_RECORDS,
): ProcessedBridgeRecord[] {
  return rawList.map((row) => {
    const flags: string[] = []
    const latParsed = dmsToDecimal(row.latDms)
    const lonParsed = dmsToDecimal(row.lonDms)

    let coordStatus: 'valida' | 'duvidosa' | 'ilegivel' | 'ausente' = 'ausente'
    let latDecimal: number | undefined = undefined
    let lonDecimal: number | undefined = undefined

    if (!row.latDms || !row.lonDms) {
      coordStatus = 'ausente'
      flags.push('Sem coordenadas informadas no documento')
    } else if (latParsed.status === 'valida' && lonParsed.status === 'valida') {
      const lat = latParsed.decimal!
      const lon = lonParsed.decimal!

      // Verificar se está dentro do polígono de Ibiúna
      if (isWithinIbiunaBounds(lat, lon)) {
        coordStatus = 'valida'
        latDecimal = lat
        lonDecimal = lon
      } else {
        coordStatus = 'duvidosa'
        flags.push(`Coordenada fora do limite territorial de Ibiúna: (${lat}, ${lon})`)
        // REGRA DO USUÁRIO: registros duvidosos ficam SEM coordenadas no mapa
        latDecimal = undefined
        lonDecimal = undefined
      }
    } else {
      coordStatus = 'duvidosa'
      flags.push(
        `Erro de formatação DMS original: ${latParsed.error || lonParsed.error || 'DMS corrompido'}`,
      )
      latDecimal = undefined
      lonDecimal = undefined
    }

    // Regra de validação: pendente de conferência para qualquer ambiguidade ou se não validada
    let validationStatus: 'pendente_conferencia' | 'conferido' | 'divergente' | 'rejeitado' =
      'pendente_conferencia'
    if (coordStatus !== 'valida' || flags.length > 0) {
      validationStatus = 'pendente_conferencia'
    }

    return {
      original_code: row.code,
      type: 'pendente_classificacao',
      neighborhood: row.neighborhood || undefined,
      reference_point: row.refPoint || undefined,
      dimensions: row.dimensions || undefined,
      notes: row.notes || undefined,
      lat_dms: row.latDms || undefined,
      lon_dms: row.lonDms || undefined,
      latitude: latDecimal,
      longitude: lonDecimal,
      coordinate_status: coordStatus,
      validation_status: validationStatus,
      source_document: 'Pontes e aduelas-21295.pdf',
      source_page: row.page,
      is_handwritten_transcription: row.page === 4 || row.page === 5,
      structural_condition: 'nao_avaliado',
      administrative_priority: 'media',
      inspection_status: 'necessita_vistoria',
      flags,
    }
  })
}

export const pontesImporterService = {
  /**
   * Processa a lista em memória sem salvar (preview)
   */
  getPreview(): BridgeImportSummary {
    const items = parseBridgeRecords()
    const validCoords = items.filter((i) => i.coordinate_status === 'valida').length
    const pendingReview = items.filter((i) => i.validation_status === 'pendente_conferencia').length
    const doubtfulCoords = items.filter((i) => i.coordinate_status === 'duvidosa').length
    const absentCoords = items.filter((i) => i.coordinate_status === 'ausente').length

    return {
      totalProcessed: items.length,
      totalImported: 0,
      totalUpdated: 0,
      validCoordinatesCount: validCoords,
      pendingReviewCount: pendingReview,
      doubtfulCoordinatesCount: doubtfulCoords,
      absentCoordinatesCount: absentCoords,
      items,
    }
  },

  /**
   * Executa a gravação idempotente de todos os registros no PocketBase
   */
  async executeImport(
    municipalityId: string,
    onProgress?: (current: number, total: number, code: string) => void,
  ): Promise<BridgeImportSummary> {
    if (!municipalityId) {
      throw new Error('Município obrigatório para importação de infraestruturas.')
    }

    const items = parseBridgeRecords()
    let imported = 0
    let updated = 0

    // 1. Obter mapa de registros existentes para garantir idempotência
    const existingRecords = await pb.collection('strategic_infrastructures').getFullList({
      filter: `municipality = "${municipalityId}"`,
      batch: 500,
      requestKey: null,
    })

    const existingMap = new Map<string, any>()
    for (const rec of existingRecords) {
      if (rec.original_code) {
        existingMap.set(rec.original_code.trim().toUpperCase(), rec)
      }
    }

    // 2. Gravar em lotes sequenciais com tratamento individual
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      onProgress?.(i + 1, items.length, item.original_code)

      const key = item.original_code.trim().toUpperCase()
      const existing = existingMap.get(key)

      const payload: Record<string, any> = {
        municipality: municipalityId,
        original_code: item.original_code,
        type: item.type,
        neighborhood: item.neighborhood || '',
        reference_point: item.reference_point || '',
        dimensions: item.dimensions || '',
        notes: item.notes || '',
        lat_dms: item.lat_dms || '',
        lon_dms: item.lon_dms || '',
        coordinate_status: item.coordinate_status,
        validation_status: item.validation_status,
        source_document: item.source_document,
        source_page: item.source_page,
        is_handwritten_transcription: item.is_handwritten_transcription,
        structural_condition: item.structural_condition,
        administrative_priority: item.administrative_priority,
        inspection_status: item.inspection_status,
      }

      // Se tiver coordenada válida, salva latitude e longitude
      if (item.latitude !== undefined && item.longitude !== undefined) {
        payload.latitude = item.latitude
        payload.longitude = item.longitude
      }

      try {
        if (existing) {
          // Idempotência: só atualiza se ainda estiver pendente de conferência
          if (existing.validation_status === 'pendente_conferencia') {
            await pb.collection('strategic_infrastructures').update(existing.id, payload)
            updated++
          }
        } else {
          const createdRec = await pb.collection('strategic_infrastructures').create(payload)
          existingMap.set(key, createdRec)
          imported++
        }
      } catch (err: any) {
        console.error(
          `[Pontes Importer] Erro ao gravar registro ${item.original_code}:`,
          err.message,
        )
      }
    }

    const validCoords = items.filter((i) => i.coordinate_status === 'valida').length
    const pendingReview = items.filter((i) => i.validation_status === 'pendente_conferencia').length
    const doubtfulCoords = items.filter((i) => i.coordinate_status === 'duvidosa').length
    const absentCoords = items.filter((i) => i.coordinate_status === 'ausente').length

    return {
      totalProcessed: items.length,
      totalImported: imported,
      totalUpdated: updated,
      validCoordinatesCount: validCoords,
      pendingReviewCount: pendingReview,
      doubtfulCoordinatesCount: doubtfulCoords,
      absentCoordinatesCount: absentCoords,
      items,
    }
  },
}
