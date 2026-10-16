/**
 * gpkg-reader.ts
 * Utilitário de alto desempenho para leitura de arquivos GeoPackage (.gpkg SQLite)
 * e conversão de geometrias GPKG Binary Header + WKB para GeoJSON WGS84 (EPSG:4326).
 * Inclui leitor de KMZ/KML via JSZip e DOMParser.
 */
import { utm23sToWgs84, isWithinIbiunaBounds } from '@/lib/geo-utils'

declare global {
  interface Window {
    initSqlJs?: (config: { locateFile?: (file: string) => string }) => Promise<any>
    SQL?: any
    JSZip?: any
  }
}

let sqlJsPromise: Promise<any> | null = null

export async function loadSqlJs(): Promise<any> {
  if (window.SQL) return window.SQL
  if (sqlJsPromise) return sqlJsPromise

  sqlJsPromise = new Promise((resolve, reject) => {
    // 1. Carregar script wasm loader se necessário
    const existingScript = document.querySelector('script[src*="sql-wasm"]')
    const onScriptLoaded = () => {
      if (typeof window.initSqlJs === 'function') {
        window
          .initSqlJs({
            locateFile: (file: string) =>
              `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/${file}`,
          })
          .then((SQL: any) => {
            window.SQL = SQL
            resolve(SQL)
          })
          .catch(reject)
      } else {
        reject(new Error('initSqlJs não encontrado no escopo global.'))
      }
    }

    if (existingScript) {
      if (typeof window.initSqlJs === 'function') {
        onScriptLoaded()
      } else {
        existingScript.addEventListener('load', onScriptLoaded)
        existingScript.addEventListener('error', reject)
      }
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.js'
    script.async = true
    script.onload = onScriptLoaded
    script.onerror = () => reject(new Error('Falha ao carregar biblioteca sql-wasm.js do CDN'))
    document.head.appendChild(script)
  })

  return sqlJsPromise
}

export async function loadJsZip(): Promise<any> {
  if (window.JSZip) return window.JSZip

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="jszip"]')
    if (existing) {
      if (window.JSZip) return resolve(window.JSZip)
      existing.addEventListener('load', () => resolve(window.JSZip))
      existing.addEventListener('error', reject)
      return
    }

    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
    script.async = true
    script.onload = () => resolve(window.JSZip)
    script.onerror = () => reject(new Error('Falha ao carregar JSZip do CDN'))
    document.head.appendChild(script)
  })
}

// -------------------------------------------------------------
// GeoPackage Binary Header e Decodificação WKB
// -------------------------------------------------------------
export interface GpkgGeometry {
  type: string
  coordinates: any
  bbox?: [number, number, number, number] // [minLon, minLat, maxLon, maxLat]
  srsId: number
}

/**
 * Converte um buffer de geometria GeoPackage Standard em GeoJSON WGS84 (EPSG:4326)
 */
export function parseGpkgGeometry(bytes: Uint8Array): GpkgGeometry | null {
  if (!bytes || bytes.length < 8) return null

  // Header GPKG: magic bytes 0x47, 0x50 ('GP')
  if (bytes[0] !== 0x47 || bytes[1] !== 0x50) {
    // Pode ser WKB direto se não tiver header GPKG
    return parseWkb(bytes, 0, 4326)
  }

  const flags = bytes[3]
  const isLittleEndianHeader = (flags & 0x01) === 1
  const envelopeType = (flags & 0x0e) >> 1
  const isEmpty = (flags & 0x10) >> 4 === 1
  if (isEmpty) return null

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const srsId = view.getInt32(4, isLittleEndianHeader)

  // Calcular tamanho do envelope de acordo com envelopeType:
  // 0 = 0 bytes, 1 = 32 bytes (minx, maxx, miny, maxy), 2 = 48 bytes (+z), 3 = 48 bytes (+m), 4 = 64 bytes (+z +m)
  let headerSize = 8
  if (envelopeType === 1) headerSize += 32
  else if (envelopeType === 2 || envelopeType === 3) headerSize += 48
  else if (envelopeType === 4) headerSize += 64

  if (bytes.length <= headerSize) return null

  return parseWkb(bytes, headerSize, srsId)
}

function parseWkb(bytes: Uint8Array, offset: number, srsId: number): GpkgGeometry | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let pos = offset
  if (pos >= bytes.length) return null

  const isLittleEndian = bytes[pos] === 1
  pos += 1

  const rawGeomType = view.getUint32(pos, isLittleEndian)
  pos += 4

  // O tipo pode ter flag de Z/M ou ISO/OGC (ex: 1000 = Z, 2000 = M, 3000 = ZM)
  const baseGeomType = rawGeomType % 1000
  const hasZ = Math.floor(rawGeomType / 1000) === 1 || Math.floor(rawGeomType / 1000) === 3

  function convertCoord(x: number, y: number): [number, number] {
    // Se srsId for 31983 (UTM 23S) ou coordenadas estiverem em metros (> 100000)
    if (srsId === 31983 || Math.abs(x) > 180 || Math.abs(y) > 90) {
      const wgs = utm23sToWgs84(x, y)
      return [wgs.lon, wgs.lat]
    }
    // Já é EPSG:4326 ou similar
    return [Number(x.toFixed(6)), Number(y.toFixed(6))]
  }

  function readPoint(): [number, number] {
    const x = view.getFloat64(pos, isLittleEndian)
    pos += 8
    const y = view.getFloat64(pos, isLittleEndian)
    pos += 8
    if (hasZ) pos += 8
    return convertCoord(x, y)
  }

  function readLinearRing(): [number, number][] {
    const numPoints = view.getUint32(pos, isLittleEndian)
    pos += 4
    const ring: [number, number][] = []
    for (let i = 0; i < numPoints; i++) {
      ring.push(readPoint())
    }
    return ring
  }

  try {
    switch (baseGeomType) {
      case 1: {
        // Point
        const pt = readPoint()
        return {
          type: 'Point',
          coordinates: pt,
          srsId,
        }
      }
      case 2: {
        // LineString
        const numPoints = view.getUint32(pos, isLittleEndian)
        pos += 4
        const coords: [number, number][] = []
        for (let i = 0; i < numPoints; i++) {
          coords.push(readPoint())
        }
        return {
          type: 'LineString',
          coordinates: coords,
          srsId,
        }
      }
      case 3: {
        // Polygon
        const numRings = view.getUint32(pos, isLittleEndian)
        pos += 4
        const rings: [number, number][][] = []
        for (let i = 0; i < numRings; i++) {
          rings.push(readLinearRing())
        }
        return {
          type: 'Polygon',
          coordinates: rings,
          srsId,
        }
      }
      case 4: {
        // MultiPoint
        const numGeoms = view.getUint32(pos, isLittleEndian)
        pos += 4
        const pts: [number, number][] = []
        for (let i = 0; i < numGeoms; i++) {
          // sub-geometria com byte order e type
          pos += 1 + 4
          pts.push(readPoint())
        }
        return {
          type: 'MultiPoint',
          coordinates: pts,
          srsId,
        }
      }
      case 5: {
        // MultiLineString
        const numGeoms = view.getUint32(pos, isLittleEndian)
        pos += 4
        const lines: [number, number][][] = []
        for (let i = 0; i < numGeoms; i++) {
          pos += 1 + 4
          const numPts = view.getUint32(pos, isLittleEndian)
          pos += 4
          const l: [number, number][] = []
          for (let j = 0; j < numPts; j++) {
            l.push(readPoint())
          }
          lines.push(l)
        }
        return {
          type: 'MultiLineString',
          coordinates: lines,
          srsId,
        }
      }
      case 6: {
        // MultiPolygon
        const numPolys = view.getUint32(pos, isLittleEndian)
        pos += 4
        const polys: [number, number][][][] = []
        for (let i = 0; i < numPolys; i++) {
          pos += 1 + 4
          const numRings = view.getUint32(pos, isLittleEndian)
          pos += 4
          const rings: [number, number][][] = []
          for (let r = 0; r < numRings; r++) {
            rings.push(readLinearRing())
          }
          polys.push(rings)
        }
        return {
          type: 'MultiPolygon',
          coordinates: polys,
          srsId,
        }
      }
      default:
        return null
    }
  } catch (err) {
    console.warn('Erro ao decodificar WKB:', err)
    return null
  }
}

// -------------------------------------------------------------
// Inventário e Extração de Feições de um GPKG
// -------------------------------------------------------------
export interface GpkgFeature {
  fid: string | number
  geometry: GpkgGeometry | null
  properties: Record<string, any>
}

export interface GpkgLayerInfo {
  tableName: string
  dataType: string
  identifier: string
  geomColumn: string
  geomType: string
  srsId: number
  featureCount: number
}

export interface GpkgInventory {
  filename: string
  layers: GpkgLayerInfo[]
}

export async function inspectGpkg(
  buffer: ArrayBuffer | Uint8Array,
  filename: string,
): Promise<{ inventory: GpkgInventory; db: any }> {
  const SQL = await loadSqlJs()
  const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  const db = new SQL.Database(u8)

  const layers: GpkgLayerInfo[] = []

  try {
    // gpkg_contents
    const resContents = db.exec(`
      SELECT c.table_name, c.data_type, c.identifier, g.column_name, g.geometry_type_name, g.srs_id
      FROM gpkg_contents c
      LEFT JOIN gpkg_geometry_columns g ON c.table_name = g.table_name
      WHERE c.data_type = 'features'
    `)

    if (resContents.length > 0) {
      const rows = resContents[0].values
      for (const row of rows) {
        const tableName = String(row[0])
        const dataType = String(row[1])
        const identifier = String(row[2] || tableName)
        const geomColumn = String(row[3] || 'geom')
        const geomType = String(row[4] || 'GEOMETRY')
        const srsId = Number(row[5] || 31983)

        // Contagem real
        let count = 0
        try {
          const cntRes = db.exec(`SELECT COUNT(*) FROM "${tableName}"`)
          if (cntRes.length > 0 && cntRes[0].values.length > 0) {
            count = Number(cntRes[0].values[0][0])
          }
        } catch {
          /* intentionally ignored */
        }

        layers.push({
          tableName,
          dataType,
          identifier,
          geomColumn,
          geomType,
          srsId,
          featureCount: count,
        })
      }
    }
  } catch (err) {
    console.error('Falha ao inspecionar GPKG:', err)
  }

  return {
    inventory: {
      filename,
      layers,
    },
    db,
  }
}

/**
 * Extrai feições de uma tabela GPKG com conversão e bounding box
 */
export function extractFeaturesFromTable(
  db: any,
  tableName: string,
  geomColumn = 'geom',
): GpkgFeature[] {
  const features: GpkgFeature[] = []

  const query = `SELECT * FROM "${tableName}"`
  const stmt = db.prepare(query)

  while (stmt.step()) {
    const row = stmt.getAsObject()
    const fid =
      row.fid ?? row.FID ?? row.id ?? row.OBJECTID ?? Math.random().toString(36).substring(7)
    const geomBytes = row[geomColumn]

    let geom: GpkgGeometry | null = null
    if (geomBytes && geomBytes instanceof Uint8Array) {
      geom = parseGpkgGeometry(geomBytes)
    }

    const properties: Record<string, any> = {}
    for (const key of Object.keys(row)) {
      if (key !== geomColumn) {
        properties[key] = row[key]
      }
    }

    features.push({
      fid,
      geometry: geom,
      properties,
    })
  }
  stmt.free()

  return features
}

// -------------------------------------------------------------
// Leitura de KMZ / KML
// -------------------------------------------------------------
export async function extractFeaturesFromKmz(
  buffer: ArrayBuffer,
  filename: string,
): Promise<GpkgFeature[]> {
  const JSZip = await loadJsZip()
  const zip = await JSZip.loadAsync(buffer)

  // Encontrar arquivo .kml
  let kmlText = ''
  for (const relativePath of Object.keys(zip.files)) {
    if (relativePath.toLowerCase().endsWith('.kml')) {
      kmlText = await zip.files[relativePath].async('text')
      break
    }
  }

  if (!kmlText) {
    throw new Error('Nenhum arquivo .kml encontrado dentro do KMZ ' + filename)
  }

  const parser = new DOMParser()
  const xml = parser.parseFromString(kmlText, 'text/xml')
  const placemarks = xml.getElementsByTagName('Placemark')

  const features: GpkgFeature[] = []

  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i]
    const fid = pm.getAttribute('id') || `kml_${i + 1}`

    const nameEl = pm.getElementsByTagName('name')[0]
    const descEl = pm.getElementsByTagName('description')[0]
    const name = nameEl?.textContent || ''
    const description = descEl?.textContent || ''

    const properties: Record<string, any> = {
      name,
      description,
    }

    // ExtendedData
    const simpleData = pm.getElementsByTagName('SimpleData')
    for (let s = 0; s < simpleData.length; s++) {
      const field = simpleData[s].getAttribute('name')
      if (field) {
        properties[field] = simpleData[s].textContent || ''
      }
    }

    // Geometria (Point, LineString, Polygon)
    let geometry: GpkgGeometry | null = null

    const pointEl = pm.getElementsByTagName('Point')[0]
    const lineEl = pm.getElementsByTagName('LineString')[0]
    const polyEl = pm.getElementsByTagName('Polygon')[0]

    if (pointEl) {
      const coordsText = pointEl.getElementsByTagName('coordinates')[0]?.textContent?.trim() || ''
      const parts = coordsText.split(',').map((p) => parseFloat(p))
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        geometry = {
          type: 'Point',
          coordinates: [parts[0], parts[1]],
          srsId: 4326,
        }
      }
    } else if (lineEl) {
      const coordsText = lineEl.getElementsByTagName('coordinates')[0]?.textContent?.trim() || ''
      const pairs = coordsText.split(/\s+/).filter(Boolean)
      const coords: [number, number][] = []
      for (const pair of pairs) {
        const parts = pair.split(',').map((p) => parseFloat(p))
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          coords.push([parts[0], parts[1]])
        }
      }
      if (coords.length > 0) {
        geometry = {
          type: 'LineString',
          coordinates: coords,
          srsId: 4326,
        }
      }
    } else if (polyEl) {
      const coordsText = polyEl.getElementsByTagName('coordinates')[0]?.textContent?.trim() || ''
      const pairs = coordsText.split(/\s+/).filter(Boolean)
      const ring: [number, number][] = []
      for (const pair of pairs) {
        const parts = pair.split(',').map((p) => parseFloat(p))
        if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
          ring.push([parts[0], parts[1]])
        }
      }
      if (ring.length > 0) {
        geometry = {
          type: 'Polygon',
          coordinates: [ring],
          srsId: 4326,
        }
      }
    }

    features.push({
      fid,
      geometry,
      properties,
    })
  }

  return features
}

/**
 * Calcula o Bounding Box [minLat, maxLat, minLon, maxLon] de uma geometria GeoJSON
 */
export function computeBoundingBox(geom: GpkgGeometry): {
  minLat: number
  maxLat: number
  minLon: number
  maxLon: number
} | null {
  if (!geom || !geom.coordinates) return null

  let minLat = Infinity
  let maxLat = -Infinity
  let minLon = Infinity
  let maxLon = -Infinity

  function crawl(coord: any) {
    if (typeof coord[0] === 'number' && typeof coord[1] === 'number') {
      const lon = coord[0]
      const lat = coord[1]
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
    } else if (Array.isArray(coord)) {
      for (const sub of coord) crawl(sub)
    }
  }

  crawl(geom.coordinates)

  if (minLat === Infinity) return null

  return {
    minLat: Number(minLat.toFixed(6)),
    maxLat: Number(maxLat.toFixed(6)),
    minLon: Number(minLon.toFixed(6)),
    maxLon: Number(maxLon.toFixed(6)),
  }
}
