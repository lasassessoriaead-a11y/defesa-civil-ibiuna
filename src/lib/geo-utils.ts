/**
 * geo-utils.ts
 * Utilitários para conversão de coordenadas DMS (Graus, Minutos e Segundos)
 * para Graus Decimais (WGS84 EPSG:4326), validação de projeções (ex.: EPSG:31983 SIRGAS 2000 UTM 23S)
 * e conferência de limites geográficos do município de Ibiúna - SP.
 */

// Bounding box expandida e segura do município de Ibiúna - SP (latitude ~ -24.0 a -23.4, longitude ~ -47.4 a -46.9)
export const IBIUNA_BOUNDS = {
  minLat: -24.2,
  maxLat: -23.3,
  minLon: -47.5,
  maxLon: -46.8,
}

export function isWithinIbiunaBounds(lat: number, lon: number): boolean {
  return (
    lat >= IBIUNA_BOUNDS.minLat &&
    lat <= IBIUNA_BOUNDS.maxLat &&
    lon >= IBIUNA_BOUNDS.minLon &&
    lon <= IBIUNA_BOUNDS.maxLon
  )
}

/**
 * Converte string DMS (Graus, Minutos, Segundos) para Graus Decimais.
 * Suporta formatos:
 * - 23°43'22.77"S
 * - 47°10'2.68"O ou 47°10'2.68"W
 * - 23 43 22.77 S
 * - -23.72299 (já decimal)
 */
export function dmsToDecimal(dmsStr: string | null | undefined): {
  decimal: number | null
  status: 'valida' | 'duvidosa' | 'ilegivel' | 'ausente'
  original: string
  error?: string
} {
  if (!dmsStr || !dmsStr.trim()) {
    return { decimal: null, status: 'ausente', original: '' }
  }

  const raw = dmsStr.trim()

  // Se já for decimal puro (ex: -23.55 ou 23.55S)
  const numericDirect = parseFloat(raw.replace(/[°'"]/g, '').replace(/[SOW]/i, ''))
  if (!isNaN(numericDirect) && raw.includes('.') && !raw.includes("'")) {
    const isSouthOrWest = /[sSwWoO]/i.test(raw) || raw.startsWith('-')
    const val = isSouthOrWest ? -Math.abs(numericDirect) : Math.abs(numericDirect)
    return { decimal: Number(val.toFixed(6)), status: 'valida', original: raw }
  }

  // Regex flexível para capturar Graus, Minutos, Segundos e Hemisfério
  // Ex: 23°43'22.77"S ou 23° 43' 22.77" S ou 23º43'22,77"S
  const clean = raw.replace(/,/g, '.').replace(/[º°]/g, '°')
  const match = clean.match(
    /(\d{1,3})\s*°\s*(\d{1,2})\s*['′]\s*([\d.]+)\s*["″]?\s*([NSOEWnsloew]?)/i,
  )

  if (!match) {
    // Tenta formato simplificado sem símbolos: ex "23 43 22.77 S"
    const parts = clean.split(/[\s°'"]+/).filter(Boolean)
    if (parts.length >= 3) {
      const deg = parseFloat(parts[0])
      const min = parseFloat(parts[1])
      const sec = parseFloat(parts[2])
      const hemi = (parts[3] || '').toUpperCase()

      if (!isNaN(deg) && !isNaN(min) && !isNaN(sec)) {
        let dec = deg + min / 60 + sec / 3600
        if (hemi === 'S' || hemi === 'O' || hemi === 'W' || raw.includes('-')) {
          dec = -dec
        }
        return {
          decimal: Number(dec.toFixed(6)),
          status: 'valida',
          original: raw,
        }
      }
    }
    return {
      decimal: null,
      status: 'ilegivel',
      original: raw,
      error: 'Formato não reconhecido',
    }
  }

  const deg = parseFloat(match[1])
  const min = parseFloat(match[2])
  const sec = parseFloat(match[3])
  const hemi = (match[4] || '').toUpperCase()

  if (isNaN(deg) || isNaN(min) || isNaN(sec)) {
    return {
      decimal: null,
      status: 'ilegivel',
      original: raw,
      error: 'Valores numéricos inválidos',
    }
  }

  // Validação básica de limites DMS
  if (min >= 60 || sec >= 60) {
    return {
      decimal: null,
      status: 'duvidosa',
      original: raw,
      error: 'Minutos ou segundos fora da faixa (>= 60)',
    }
  }

  let dec = deg + min / 60 + sec / 3600

  // No Brasil (Ibiúna): Latitude é Sul (-), Longitude é Oeste (-)
  if (hemi === 'S' || hemi === 'O' || hemi === 'W' || hemi === 'L') {
    dec = -Math.abs(dec)
  } else if (!hemi) {
    // Padrão Brasil caso omitido
    dec = -Math.abs(dec)
  }

  const rounded = Number(dec.toFixed(6))

  return {
    decimal: rounded,
    status: 'valida',
    original: raw,
  }
}

/**
 * Conversão de coordenadas SIRGAS 2000 / UTM Zona 23S (EPSG:31983) para WGS84 Graus Decimais (EPSG:4326)
 * Utilizada quando arquivos Shapefile/GeoJSON vêm projetados em metros UTM.
 */
export function utm23sToWgs84(easting: number, northing: number): { lat: number; lon: number } {
  // Constantes GRS80 / WGS84
  const a = 6378137.0
  const f = 1 / 298.257222101
  const k0 = 0.9996
  const e = Math.sqrt(2 * f - f * f)
  const ePrimeSq = (e * e) / (1 - e * e)

  const x = easting - 500000.0 // remover false easting
  const y = northing - 10000000.0 // remover false northing para hemisfério sul

  const M = y / k0
  const mu =
    M / (a * (1 - (e * e) / 4 - (3 * e * e * e * e) / 64 - (5 * e * e * e * e * e * e) / 256))

  const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e))
  const J1 = (3 * e1) / 2 - (27 * Math.pow(e1, 3)) / 32
  const J2 = (21 * Math.pow(e1, 2)) / 16 - (55 * Math.pow(e1, 4)) / 32
  const J3 = (151 * Math.pow(e1, 3)) / 96
  const J4 = (1097 * Math.pow(e1, 4)) / 512

  const fp =
    mu +
    J1 * Math.sin(2 * mu) +
    J2 * Math.sin(4 * mu) +
    J3 * Math.sin(6 * mu) +
    J4 * Math.sin(8 * mu)

  const C1 = ePrimeSq * Math.pow(Math.cos(fp), 2)
  const T1 = Math.pow(Math.tan(fp), 2)
  const R1 = (a * (1 - e * e)) / Math.pow(1 - e * e * Math.pow(Math.sin(fp), 2), 1.5)
  const N1 = a / Math.sqrt(1 - e * e * Math.pow(Math.sin(fp), 2))
  const D = x / (N1 * k0)

  // Latitude
  const fact1 = (N1 * Math.tan(fp)) / R1
  const fact2 = (D * D) / 2
  const fact3 = ((5 + 3 * T1 + 10 * C1 - 4 * C1 * C1 - 9 * ePrimeSq) * Math.pow(D, 4)) / 24
  const fact4 =
    ((61 + 90 * T1 + 298 * C1 + 45 * T1 * T1 - 252 * ePrimeSq - 3 * C1 * C1) * Math.pow(D, 6)) / 720
  const latRad = fp - fact1 * (fact2 - fact3 + fact4)

  // Longitude (Meridiano Central UTM 23 = -45°)
  const lonOrigin = -45.0
  const fact5 = D
  const fact6 = ((1 + 2 * T1 + C1) * Math.pow(D, 3)) / 6
  const fact7 =
    ((5 - 2 * C1 + 28 * T1 - 3 * C1 * C1 + 8 * ePrimeSq + 24 * T1 * T1) * Math.pow(D, 5)) / 120
  const lonRad = (fact5 - fact6 + fact7) / Math.cos(fp)

  const lat = (latRad * 180) / Math.PI
  const lon = lonOrigin + (lonRad * 180) / Math.PI

  return {
    lat: Number(lat.toFixed(6)),
    lon: Number(lon.toFixed(6)),
  }
}

/**
 * Algoritmo Point-in-Polygon (Ray casting) para detectar se uma coordenada (lat, lon)
 * está dentro de um polígono GeoJSON ou array de anéis [[lat, lon], ...].
 */
export function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [lat, lon] = point
  let inside = false

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0]
    const yi = polygon[i][1]
    const xj = polygon[j][0]
    const yj = polygon[j][1]

    const intersect = yi > lon !== yj > lon && lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }

  return inside
}

/**
 * Procura se uma coordenada pertence a algum setor de risco que contenha geometria preenchida.
 * Retorna o setor correspondente ou null se nenhum contiver a coordenada (ou se as geometrias ainda não existirem).
 */
export function findContainingSector(
  lat: number,
  lon: number,
  sectors: Array<{ id: string; code: string; geometry?: any }>,
): { id: string; code: string } | null {
  for (const sec of sectors) {
    if (!sec.geometry) continue

    try {
      let ring: [number, number][] | null = null

      if (typeof sec.geometry === 'string') {
        const parsed = JSON.parse(sec.geometry)
        if (parsed.type === 'Polygon' && Array.isArray(parsed.coordinates?.[0])) {
          ring = parsed.coordinates[0].map((coord: number[]) => [coord[1], coord[0]])
        } else if (Array.isArray(parsed)) {
          ring = parsed
        }
      } else if (sec.geometry.type === 'Polygon' && Array.isArray(sec.geometry.coordinates?.[0])) {
        ring = sec.geometry.coordinates[0].map((coord: number[]) => [coord[1], coord[0]])
      }

      if (ring && isPointInPolygon([lat, lon], ring)) {
        return { id: sec.id, code: sec.code }
      }
    } catch (_) {
      // Ignora geometrias mal formatadas
    }
  }

  return null
}
