import { isWithinIbiunaBounds } from '@/lib/geo-utils'
import { dangerStretchesService, geoImportsService, riskSectorsService } from './defesa-civil'
import type { DangerStretch, RiskSector } from '@/types/defesa-civil'

export interface IptFeatureProperties {
  id?: string
  name?: string
  kind?: 'setor' | 'trecho' | string
  process?: string
  level?: string
  grade?: string
  locality?: string
  source?: string
  layer?: string
  export_origin?: string
  validation_status?: string
  [key: string]: any
}

export interface IptGeoJsonFeature {
  type: 'Feature'
  id?: string
  properties: IptFeatureProperties
  geometry: {
    type: string
    coordinates: any
  }
}

export interface IptGeoJsonCollection {
  type: 'FeatureCollection'
  name?: string
  bbox?: number[]
  metadata?: {
    export_date?: string
    coordinates?: string
    epsg?: number
    source?: string
    [key: string]: any
  }
  features: IptGeoJsonFeature[]
}

export type MatchCategory =
  | 'match_sector' // Correspondência inequívoca com setor cadastrado no banco
  | 'match_stretch' // Correspondência inequívoca com trecho cadastrado no banco
  | 'divergence' // Código ambíguo ou dados conflitantes (vai p/ conferência humana)
  | 'unmatched_new' // Feição sem cadastro correspondente no banco
  | 'invalid_geometry' // Fora do bbox ou geometria corrompida

export interface IptAnalyzedFeature {
  featureId: string
  code: string // código extraído, ex: "IBI-01/A05/T12/ENX"
  kind: 'setor' | 'trecho' | 'outro'
  originalKindProp?: string
  geometryType: string
  locality?: string
  process?: string
  level?: string
  grade?: string
  source: string
  isValidBounds: boolean
  category: MatchCategory
  categoryReason: string
  // Dados do registro existente no banco
  matchedRecordId?: string
  matchedRecordCode?: string
  matchedRecordKind?: 'setor' | 'trecho'
  matchedRecordHasGeometry?: boolean
  // Divergências pontuais detectadas entre os dados existentes e o GeoJSON
  divergences?: string[]
  // Geometria crua
  geometry: {
    type: string
    coordinates: any
  }
  rawProperties: IptFeatureProperties
}

export interface IptPreImportSummary {
  exportDate?: string
  sourceMetadata?: string
  totalFeatures: number
  sectorsInFile: number
  stretchesInFile: number
  matchedSectors: number
  matchedStretches: number
  alreadyHaveGeometry: number
  willLinkGeometry: number
  divergencesCount: number
  unmatchedCount: number
  outOfBoundsCount: number
  features: IptAnalyzedFeature[]
}

export interface IptCommitResult {
  batchId: string
  sectorsUpdated: number
  stretchesUpdated: number
  skippedAlreadyLinked: number
  divergencesLogged: number
  errors: { code: string; error: string }[]
}

/**
 * Normaliza códigos técnicos para comparação resiliente.
 * Remove prefixos "IPT-", "IPT_", "SETOR-", espaços extras e converte barras/traços padronizados.
 */
export function normalizeIptCode(raw?: string): string {
  if (!raw) return ''
  let cleaned = String(raw).trim()
  cleaned = cleaned.replace(/^IPT[-_]/i, '')
  cleaned = cleaned.replace(/^SETOR[-_\s]*/i, '')
  cleaned = cleaned.replace(/^TRECHO[-_\s]*/i, '')
  return cleaned.toUpperCase().trim()
}

/**
 * Extrai o código técnico de uma feição GeoJSON do IPT.
 */
export function extractFeatureCode(f: IptGeoJsonFeature): string {
  const p = f.properties || {}
  const raw = p.name || p.id || f.id || ''
  return normalizeIptCode(raw)
}

/**
 * Valida se as coordenadas de uma feição caem dentro do limite oficial de Ibiúna.
 */
export function validateFeatureBounds(geometry: { type: string; coordinates: any }): boolean {
  if (!geometry || !geometry.coordinates) return false

  const checkCoord = (c: any): boolean => {
    if (Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number') {
      const lon = c[0]
      const lat = c[1]
      return isWithinIbiunaBounds(lat, lon)
    }
    return true
  }

  const recurse = (coords: any): boolean => {
    if (!Array.isArray(coords)) return false
    if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      return checkCoord(coords)
    }
    for (const child of coords) {
      if (!recurse(child)) return false
    }
    return true
  }

  try {
    return recurse(geometry.coordinates)
  } catch {
    return false
  }
}

/**
 * Analisa a coleção GeoJSON comparando com os registros existentes no banco de dados.
 * NÃO grava nada no banco. Gera estritamente a prévia.
 */
export async function analyzeIptGeoJson(
  geoJson: IptGeoJsonCollection,
  existingSectors: RiskSector[],
  existingStretches: DangerStretch[],
): Promise<IptPreImportSummary> {
  const metadata = geoJson.metadata || {}
  const exportDate = metadata.export_date
  const sourceMetadata = metadata.source || 'IPT · Trechos_perigo.gpkg + síntese 29/11/2024'

  const features = geoJson.features || []

  // Mapeamentos para busca rápida por código normalizado
  const sectorByNormCode = new Map<string, RiskSector>()
  for (const s of existingSectors) {
    sectorByNormCode.set(normalizeIptCode(s.code), s)
  }

  const stretchByNormCode = new Map<string, DangerStretch>()
  for (const st of existingStretches) {
    stretchByNormCode.set(normalizeIptCode(st.code), st)
  }

  let sectorsInFile = 0
  let stretchesInFile = 0
  let matchedSectors = 0
  let matchedStretches = 0
  let alreadyHaveGeometry = 0
  let willLinkGeometry = 0
  let divergencesCount = 0
  let unmatchedCount = 0
  let outOfBoundsCount = 0

  const analyzedList: IptAnalyzedFeature[] = []

  for (const feat of features) {
    const props = feat.properties || {}
    const code = extractFeatureCode(feat)
    const rawKind = (props.kind || '').toLowerCase()
    const geomType = feat.geometry?.type || 'Unknown'
    const isPoly = geomType.includes('Polygon')
    const isLine = geomType.includes('LineString')

    let kind: 'setor' | 'trecho' | 'outro' = 'outro'
    if (rawKind === 'setor' || isPoly) {
      kind = 'setor'
      sectorsInFile++
    } else if (rawKind === 'trecho' || isLine) {
      kind = 'trecho'
      stretchesInFile++
    }

    const isValidBounds = validateFeatureBounds(feat.geometry)
    if (!isValidBounds) {
      outOfBoundsCount++
    }

    const source = props.source || sourceMetadata
    const locality = props.locality
    const process = props.process
    const level = props.level
    const grade = props.grade

    let category: MatchCategory = 'unmatched_new'
    let categoryReason = ''
    let matchedRecordId: string | undefined
    let matchedRecordCode: string | undefined
    let matchedRecordKind: 'setor' | 'trecho' | undefined
    let matchedRecordHasGeometry = false
    const divergences: string[] = []

    if (!isValidBounds) {
      category = 'invalid_geometry'
      categoryReason = 'Coordenadas ultrapassam o limite territorial oficial de Ibiúna/SP'
    } else if (kind === 'setor') {
      const match = sectorByNormCode.get(code)
      if (match) {
        matchedRecordId = match.id
        matchedRecordCode = match.code
        matchedRecordKind = 'setor'
        matchedRecordHasGeometry = Boolean(
          match.geometry_geojson &&
          (match.geometry_status === 'validada' || match.geometry_status === 'vinculada'),
        )

        // Verifica divergências entre dados existentes e atributos do GeoJSON
        if (level && match.risk_level && level !== match.risk_level) {
          divergences.push(
            `Grau de risco divergente: no banco está "${match.risk_level}", no GeoJSON está "${level}"`,
          )
        }
        if (
          process &&
          match.process_type &&
          !match.process_type.toLowerCase().includes(process.toLowerCase())
        ) {
          divergences.push(
            `Processo divergente: no banco está "${match.process_type}", no GeoJSON está "${process}"`,
          )
        }

        if (divergences.length > 0) {
          category = 'divergence'
          categoryReason = `Correspondência localizada (${match.code}), porém existem divergências técnicas nos atributos`
          divergencesCount++
        } else {
          category = 'match_sector'
          matchedSectors++
          if (matchedRecordHasGeometry) {
            alreadyHaveGeometry++
            categoryReason = 'Cadastro existente com geometria já gravada'
          } else {
            willLinkGeometry++
            categoryReason = 'Cadastro existente sem geometria; pronta para vínculo'
          }
        }
      } else {
        // Tenta ver se por acaso existe no de trechos (erro de tipologia)
        const stretchCrossMatch = stretchByNormCode.get(code)
        if (stretchCrossMatch) {
          category = 'divergence'
          categoryReason = `Divergência de tipo: feição tem geometria de polígono mas código ${code} está cadastrado como trecho`
          divergencesCount++
          matchedRecordId = stretchCrossMatch.id
          matchedRecordCode = stretchCrossMatch.code
          matchedRecordKind = 'trecho'
        } else {
          category = 'unmatched_new'
          categoryReason = 'Código não encontrado nos 290 setores cadastrados no banco'
          unmatchedCount++
        }
      }
    } else if (kind === 'trecho') {
      const match = stretchByNormCode.get(code)
      if (match) {
        matchedRecordId = match.id
        matchedRecordCode = match.code
        matchedRecordKind = 'trecho'
        matchedRecordHasGeometry = Boolean(
          match.geometry_geojson &&
          (match.geometry_status === 'validada' || match.geometry_status === 'vinculada'),
        )

        // Verifica divergências
        if (level && match.risk_level && level !== match.risk_level) {
          divergences.push(
            `Grau de risco divergente: no banco está "${match.risk_level}", no GeoJSON está "${level}"`,
          )
        }
        if (
          process &&
          match.process_type &&
          !match.process_type.toLowerCase().includes(process.toLowerCase())
        ) {
          divergences.push(
            `Processo divergente: no banco está "${match.process_type}", no GeoJSON está "${process}"`,
          )
        }

        if (divergences.length > 0) {
          category = 'divergence'
          categoryReason = `Correspondência localizada (${match.code}), porém existem divergências técnicas nos atributos`
          divergencesCount++
        } else {
          category = 'match_stretch'
          matchedStretches++
          if (matchedRecordHasGeometry) {
            alreadyHaveGeometry++
            categoryReason = 'Cadastro existente com geometria já gravada'
          } else {
            willLinkGeometry++
            categoryReason = 'Cadastro existente sem geometria; pronta para vínculo'
          }
        }
      } else {
        const sectorCrossMatch = sectorByNormCode.get(code)
        if (sectorCrossMatch) {
          category = 'divergence'
          categoryReason = `Divergência de tipo: feição tem geometria de linha mas código ${code} está cadastrado como setor`
          divergencesCount++
          matchedRecordId = sectorCrossMatch.id
          matchedRecordCode = sectorCrossMatch.code
          matchedRecordKind = 'setor'
        } else {
          category = 'unmatched_new'
          categoryReason = 'Código não encontrado nos trechos cadastrados no banco'
          unmatchedCount++
        }
      }
    } else {
      category = 'unmatched_new'
      categoryReason = 'Tipo de feição e geometria não identificáveis'
      unmatchedCount++
    }

    analyzedList.push({
      featureId: feat.id || props.id || code,
      code,
      kind,
      originalKindProp: rawKind,
      geometryType: geomType,
      locality,
      process,
      level,
      grade,
      source,
      isValidBounds,
      category,
      categoryReason,
      matchedRecordId,
      matchedRecordCode,
      matchedRecordKind,
      matchedRecordHasGeometry,
      divergences,
      geometry: feat.geometry,
      rawProperties: props,
    })
  }

  return {
    exportDate,
    sourceMetadata,
    totalFeatures: features.length,
    sectorsInFile,
    stretchesInFile,
    matchedSectors,
    matchedStretches,
    alreadyHaveGeometry,
    willLinkGeometry,
    divergencesCount,
    unmatchedCount,
    outOfBoundsCount,
    features: analyzedList,
  }
}

/**
 * Executa a vinculação idempotente dos registros confirmados pelo usuário.
 * Preserva os atributos originais do banco e adiciona/atualiza geometry_geojson e geometry_status = 'vinculada'.
 * Registra o lote de importação em geo_imports para auditoria.
 */
export async function commitIptGeoJsonLinking(
  analysis: IptPreImportSummary,
  municipalityId: string,
  userId?: string,
  filename = 'Ibiuna_IPT_Setores_e_Trechos_GeoJSON-bad52.json',
  onProgress?: (current: number, total: number, label: string) => void,
): Promise<IptCommitResult> {
  const candidateFeatures = analysis.features.filter(
    (f) =>
      (f.category === 'match_sector' || f.category === 'match_stretch') &&
      f.matchedRecordId &&
      f.isValidBounds,
  )

  const total = candidateFeatures.length
  let sectorsUpdated = 0
  let stretchesUpdated = 0
  let skippedAlreadyLinked = 0
  const errors: { code: string; error: string }[] = []

  // Cria registro do lote em geo_imports
  let batchId = `IPT-${Date.now()}`
  try {
    const batch = await geoImportsService.create({
      municipality: municipalityId,
      filename,
      file_type: 'geojson_ipt',
      imported_by: userId,
      total_records: analysis.totalFeatures,
      valid_records: total,
      duplicate_records: analysis.alreadyHaveGeometry,
      incomplete_records: analysis.divergencesCount,
      rejected_records: analysis.unmatchedCount + analysis.outOfBoundsCount,
      summary: `Vínculo de geometrias IPT 2024: ${analysis.matchedSectors} setores e ${analysis.matchedStretches} trechos identificados.`,
    })
    batchId = batch.id
  } catch (err: any) {
    console.warn('Erro ao criar registro do lote geo_imports:', err.message)
  }

  const batchSize = 25
  for (let i = 0; i < candidateFeatures.length; i += batchSize) {
    const chunk = candidateFeatures.slice(i, i + batchSize)

    await Promise.all(
      chunk.map(async (item) => {
        try {
          const geojsonStr = JSON.stringify(item.geometry)

          if (item.category === 'match_sector' && item.matchedRecordId) {
            await riskSectorsService.update(item.matchedRecordId, {
              geometry_geojson: geojsonStr,
              geometry_status: 'vinculada',
              import_source: item.source || 'IPT · Síntese 29/11/2024',
              import_batch_id: batchId,
            })
            sectorsUpdated++
          } else if (item.category === 'match_stretch' && item.matchedRecordId) {
            await dangerStretchesService.update(item.matchedRecordId, {
              geometry_geojson: geojsonStr,
              geometry_status: 'vinculada',
              import_source: item.source || 'IPT · Síntese 29/11/2024',
              import_batch_id: batchId,
            })
            stretchesUpdated++
          }
        } catch (err: any) {
          errors.push({
            code: item.code,
            error: err.message || 'Falha ao atualizar registro',
          })
        }
      }),
    )

    if (onProgress) {
      const current = Math.min(i + chunk.length, total)
      onProgress(current, total, `Vinculando geometrias (${current}/${total})...`)
    }
  }

  return {
    batchId,
    sectorsUpdated,
    stretchesUpdated,
    skippedAlreadyLinked,
    divergencesLogged: analysis.divergencesCount,
    errors,
  }
}
