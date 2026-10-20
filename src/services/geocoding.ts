/**
 * Serviços de Geocodificação e Geolocalização para Defesa Civil Municipal
 *
 * Cumpre os requisitos estritos:
 * 1. Não inventa números, bairros ou CEPs
 * 2. Diferencia reversa (coord -> end), CEP (cep -> end via ViaCEP) e direta (end -> coord)
 * 3. Trata offline graciosamente (não bloqueia operações nem sincronização)
 * 4. Obtém accuracy estimada do GPS e alerta se for aproximada
 */

export interface ReverseGeocodeResult {
  formattedAddress: string
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
  postal_code?: string
  raw?: any
}

export interface DirectGeocodeResult {
  latitude: number
  longitude: number
  displayName: string
  address?: {
    road?: string
    suburb?: string
    city?: string
    town?: string
    state?: string
    postcode?: string
  }
  isCoordinate?: boolean
  warning?: string
}

export interface ParsedCoordinateResult {
  latitude: number
  longitude: number
  isPlausibleBrazil: boolean
  isWithinIbiuna: boolean
  swappedOrder?: boolean
  formatted: string
  warning?: string
}

/**
 * Analisa e extrai coordenadas decimais a partir de texto colado ou digitado.
 * Suporta:
 * - "-23.78428, -47.22237"
 * - "-23.78428 -47.22237"
 * - "−23.78428, −47.22237" (com travessão unicode)
 * - "-23,78428; -47,22237" (vírgula como separador decimal)
 * - Detecção inteligente de ordem invertida (lng, lat) baseado em limites do Brasil/Ibiúna
 */
export function parseCoordinateInput(rawInput: string): ParsedCoordinateResult | null {
  if (!rawInput || !rawInput.trim()) return null

  // Normalizar travessões e hifens unicode (−, –, —) para hífen ASCII '-'
  const normalized = rawInput.trim().replace(/[\u2212\u2013\u2014]/g, '-')

  // Detecta se parece uma entrada de coordenadas antes de prosseguir
  // Precisa ter números e preferencialmente sinal ou separador
  if (!/[0-9]/.test(normalized)) return null

  // Substitui separadores comuns (vírgula entre coords, ponto e vírgula, barra, espaço)
  // Se contiver vírgula usada como decimal (ex: "-23,78428 -47,22237" ou "-23,78428, -47,22237"):
  // Casos:
  // 1) "-23.78428, -47.22237" -> dois números com ponto decimal
  // 2) "-23,78428; -47,22237" -> ponto e vírgula separa coords, vírgula é decimal
  // 3) "-23,78428 -47,22237" -> espaço separa coords, vírgula é decimal
  // 4) "-23.78428 -47.22237" -> espaço separa coords, ponto é decimal

  let num1: number | null = null
  let num2: number | null = null

  // Padrão A: ponto como decimal: "-23.78428, -47.22237" ou "-23.78428 -47.22237"
  const dotPattern = /^(-?\d+(?:\.\d+)?)[,\s;/|]+(-?\d+(?:\.\d+)?)$/
  const dotMatch = normalized.match(dotPattern)
  if (dotMatch) {
    num1 = parseFloat(dotMatch[1])
    num2 = parseFloat(dotMatch[2])
  } else {
    // Padrão B: vírgula como separador decimal com delimitador ;, /, espaço ou barra
    // Ex: "-23,78428; -47,22237" ou "-23,78428 / -47,22237" ou "-23,78428 -47,22237"
    const commaDecimalPattern = /^(-?\d+(?:,\d+)?)[;\s/|]+(-?\d+(?:,\d+)?)$/
    const commaMatch = normalized.match(commaDecimalPattern)
    if (commaMatch) {
      num1 = parseFloat(commaMatch[1].replace(',', '.'))
      num2 = parseFloat(commaMatch[2].replace(',', '.'))
    } else {
      // Padrão C: 4 grupos numéricos separados por vírgula pura: "-23,78428,-47,22237"
      const allCommaMatch = normalized.match(/^(-?\d+),(\d+),(-?\d+),(\d+)$/)
      if (allCommaMatch) {
        num1 = parseFloat(`${allCommaMatch[1]}.${allCommaMatch[2]}`)
        num2 = parseFloat(`${allCommaMatch[3]}.${allCommaMatch[4]}`)
      }
    }
  }

  if (num1 === null || num2 === null || isNaN(num1) || isNaN(num2)) {
    return null
  }

  // Verificar se um dos números é lat e o outro lng
  // Validar limites matemáticos globais básicos (lat -90..90, lng -180..180)
  let lat = num1
  let lng = num2
  let swapped = false

  // Se num1 estiver fora de -90..90 mas dentro de -180..180, e num2 estiver dentro de -90..90, está invertido (lng, lat)
  if (
    (Math.abs(num1) > 90 && Math.abs(num2) <= 90) ||
    // Heurística Brasil: Latitudes no Brasil variam de +5.3 a -33.8; Longitudes variam de -73.99 a -34.79
    // Se num1 estiver na faixa típica de longitude do Brasil (-74 a -34) e num2 na faixa de latitude (+6 a -35), quase certamente está invertido!
    (num1 < -34 && num1 > -75 && num2 > -35 && num2 < 6)
  ) {
    lat = num2
    lng = num1
    swapped = true
  }

  // Validação estrita de limites globais
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null
  }

  // Validação Brasil: latitude [-34, 6], longitude [-74, -34]
  const isPlausibleBrazil = lat >= -34 && lat <= 6 && lng >= -74 && lng <= -34
  // Ibiúna bounds aproximados: lat [-24.2, -23.3], lon [-47.5, -46.8]
  const isWithinIbiuna = lat >= -24.2 && lat <= -23.3 && lng >= -47.5 && lng <= -46.8

  let warning: string | undefined
  if (!isPlausibleBrazil) {
    warning = 'Coordenadas fora do território brasileiro.'
  } else if (!isWithinIbiuna) {
    warning = 'Coordenadas fora dos limites municipais de Ibiúna - SP.'
  }

  return {
    latitude: Number(lat.toFixed(6)),
    longitude: Number(lng.toFixed(6)),
    isPlausibleBrazil,
    isWithinIbiuna,
    swappedOrder: swapped,
    formatted: `${Number(lat.toFixed(5))}, ${Number(lng.toFixed(5))}`,
    warning,
  }
}

export interface ViaCepResult {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  ibge?: string
  erro?: boolean
}

/**
 * Consulta CEP via ViaCEP (Brasil)
 */
export async function fetchViaCep(cep: string): Promise<ViaCepResult | null> {
  const clean = cep.replace(/\D/g, '')
  if (clean.length !== 8) {
    throw new Error('CEP deve conter exatamente 8 dígitos numéricos.')
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Sem conexão com a internet para consultar CEP.')
  }

  const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`, {
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) {
    throw new Error(`Falha no serviço ViaCEP (HTTP ${res.status}).`)
  }

  const data = await res.json()
  if (data.erro) {
    return null
  }

  return data as ViaCepResult
}

/**
 * Geocodificação Reversa (Lat/Lng -> Endereço) via OpenStreetMap Nominatim
 * Não inventa números ou bairros inexistentes!
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return null
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) {
      return null
    }

    const data = await res.json()
    if (!data || !data.address) {
      return null
    }

    const addr = data.address

    // Extrair componentes reais retornados
    const street =
      addr.road ||
      addr.pedestrian ||
      addr.street ||
      addr.avenue ||
      addr.highway ||
      addr.path ||
      undefined

    // Número: apenas se confiável (house_number real)
    const houseNumber = addr.house_number ? String(addr.house_number).trim() : undefined

    const neighborhood =
      addr.suburb ||
      addr.neighbourhood ||
      addr.residential ||
      addr.quarter ||
      addr.city_district ||
      undefined

    const city =
      addr.city || addr.town || addr.municipality || addr.village || addr.hamlet || undefined

    const state = addr.state || addr['ISO3166-2-lvl4'] || undefined
    const postal_code = addr.postcode
      ? String(addr.postcode).replace(/\D/g, '').slice(0, 8)
      : undefined

    // Formatar endereço textual amigável sem inventar número
    const parts: string[] = []
    if (street) {
      parts.push(houseNumber ? `${street}, ${houseNumber}` : street)
    }
    if (neighborhood) {
      parts.push(neighborhood)
    }
    if (city) {
      parts.push(state ? `${city} - ${state}` : city)
    } else if (state) {
      parts.push(state)
    }
    if (postal_code && postal_code.length === 8) {
      parts.push(`CEP ${postal_code.slice(0, 5)}-${postal_code.slice(5)}`)
    }

    const formattedAddress = parts.length > 0 ? parts.join(', ') : data.display_name || ''

    return {
      formattedAddress,
      street,
      number: houseNumber,
      neighborhood,
      city,
      state,
      postal_code,
      raw: data,
    }
  } catch (err) {
    console.warn('[Geocoding] Falha silenciosa na geocodificação reversa:', err)
    return null
  }
}

/**
 * Geocodificação Direta (Endereço -> Coordenadas) via Nominatim
 */
export async function forwardGeocode(
  query: string,
  preferredCity?: string,
  limit: number = 5,
  signal?: AbortSignal,
): Promise<DirectGeocodeResult[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Sem conexão de internet para buscar endereços.')
  }

  const cleanQuery = query.trim()
  if (!cleanQuery) return []

  // Primeiro verifica se é coordenada decimal colada/digitada
  const parsedCoord = parseCoordinateInput(cleanQuery)
  if (parsedCoord) {
    return [
      {
        latitude: parsedCoord.latitude,
        longitude: parsedCoord.longitude,
        displayName: `Coordenadas: ${parsedCoord.latitude}, ${parsedCoord.longitude}`,
        isCoordinate: true,
        warning: parsedCoord.warning,
      },
    ]
  }

  // Se a consulta não mencionar Ibiúna nem o município preferencial, adiciona o município para dar relevância
  const citySuffix = preferredCity || 'Ibiúna'
  const hasCityMention =
    cleanQuery.toLowerCase().includes('ibiúna') ||
    cleanQuery.toLowerCase().includes('ibiuna') ||
    (preferredCity && cleanQuery.toLowerCase().includes(preferredCity.toLowerCase()))

  const finalQuery = hasCityMention ? cleanQuery : `${cleanQuery}, ${citySuffix}`

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
    finalQuery,
  )}&limit=${limit}&countrycodes=br&addressdetails=1`

  // Combina o signal recebido com um timeout de 8 segundos
  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), 8000)
  if (signal) {
    signal.addEventListener('abort', () => abortController.abort())
  }

  try {
    const res = await fetch(url, {
      headers: {
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
      signal: abortController.signal,
    })

    if (!res.ok) {
      throw new Error(`Serviço de busca de endereço indisponível (${res.status}).`)
    }

    const list = await res.json()
    if (!Array.isArray(list)) return []

    return list.map((item) => ({
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      displayName: item.display_name,
      address: item.address
        ? {
            road: item.address.road || item.address.street,
            suburb: item.address.suburb || item.address.neighbourhood,
            city: item.address.city || item.address.town || item.address.municipality,
            town: item.address.town,
            state: item.address.state,
            postcode: item.address.postcode,
          }
        : undefined,
    }))
  } finally {
    clearTimeout(timeoutId)
  }
}

/**
 * Captura GPS do dispositivo via API do navegador
 * Retorna coordenadas reais e precisão em metros
 */
export type GeolocationErrorKind =
  | 'PERMISSION_DENIED'
  | 'POSITION_UNAVAILABLE'
  | 'TIMEOUT'
  | 'NOT_SUPPORTED'
  | 'INSECURE_CONTEXT'
  | 'IFRAME_RESTRICTION'
  | 'UNKNOWN'

export class GeolocationServiceError extends Error {
  readonly kind: GeolocationErrorKind
  readonly isIframe: boolean
  readonly isStandalone: boolean
  readonly rawCode?: number

  constructor(
    message: string,
    kind: GeolocationErrorKind,
    options?: { isIframe?: boolean; isStandalone?: boolean; rawCode?: number },
  ) {
    super(message)
    this.name = 'GeolocationServiceError'
    this.kind = kind
    this.isIframe = options?.isIframe ?? false
    this.isStandalone = options?.isStandalone ?? false
    this.rawCode = options?.rawCode
  }
}

/**
 * Detecta se a página atual está renderizada dentro de um iframe
 */
export function isRunningInIframe(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.self !== window.top
  } catch {
    return true
  }
}

/**
 * Detecta se a aplicação está aberta em modo PWA standalone (instalado)
 */
export function isRunningStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const nav = window.navigator as any
  const isMatch = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
  const isIosStandalone = !!nav?.standalone
  return Boolean(isMatch || isIosStandalone)
}

/**
 * Consulta o status da permissão de geolocalização se o navegador suportar navigator.permissions
 */
export async function checkGeolocationPermission(): Promise<
  'granted' | 'prompt' | 'denied' | 'unsupported'
> {
  if (typeof navigator === 'undefined' || !navigator.permissions || !navigator.permissions.query) {
    return 'unsupported'
  }
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName })
    return status.state
  } catch {
    return 'unsupported'
  }
}

/**
 * Helper interno que tenta obter posição com estratégia de watchPosition ou getCurrentPosition
 */
function attemptPosition(options: PositionOptions): Promise<{
  latitude: number
  longitude: number
  accuracy: number
  altitude?: number | null
  speed?: number | null
  heading?: number | null
  timestamp: number
}> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('GEOLOCATION_UNSUPPORTED'))
      return
    }

    let isSettled = false
    let watchId: number | null = null

    // Timeout de segurança manual para browsers que não disparam erro em opções nativas
    const timeoutTimer = setTimeout(
      () => {
        if (isSettled) return
        isSettled = true
        if (watchId !== null) {
          try {
            navigator.geolocation.clearWatch(watchId)
          } catch {
            /* ignore */
          }
        }
        const timeoutErr: any = new Error('Tempo limite esgotado ao buscar posição GPS.')
        timeoutErr.code = 3 // TIMEOUT
        reject(timeoutErr)
      },
      (options.timeout || 12000) + 1500,
    )

    const handleSuccess = (pos: GeolocationPosition) => {
      if (isSettled) return
      isSettled = true
      clearTimeout(timeoutTimer)
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId)
        } catch {
          /* ignore */
        }
      }
      resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: Math.round(pos.coords.accuracy || 0),
        altitude: pos.coords.altitude,
        speed: pos.coords.speed,
        heading: pos.coords.heading,
        timestamp: pos.timestamp,
      })
    }

    const handleError = (err: GeolocationPositionError) => {
      if (isSettled) return
      isSettled = true
      clearTimeout(timeoutTimer)
      if (watchId !== null) {
        try {
          navigator.geolocation.clearWatch(watchId)
        } catch {
          /* ignore */
        }
      }
      reject(err)
    }

    // No Android Chrome móvel, watchPosition acorda o hardware do GPS com muito mais confiabilidade
    // do que getCurrentPosition estático quando a antena está adormecida.
    try {
      watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, options)
    } catch {
      // Fallback clássico caso watchPosition falhe de imediato por contexto restrito
      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options)
    }
  })
}

/**
 * Captura GPS do dispositivo via API do navegador com resiliência a mobile e redes de campo.
 * Estratégia de 3 estágios:
 * 1. Alta precisão (GPS real por satélite/hardware) - 10s
 * 2. Fallback de precisão balanceada (torres celulares/Wi-Fi/cache rápido) - 8s
 * 3. Fallback de cache recente (maximumAge: 60s) para ambientes com sinal intermitente
 * Retorna coordenadas reais e precisão em metros.
 */
export async function getCurrentPositionWithAccuracy(): Promise<{
  latitude: number
  longitude: number
  accuracy: number
  altitude?: number | null
  speed?: number | null
  heading?: number | null
  timestamp?: number
  isApproximate?: boolean
}> {
  const isIframe = isRunningInIframe()
  const isStandalone = isRunningStandalone()

  if (typeof window !== 'undefined' && !window.isSecureContext) {
    throw new GeolocationServiceError(
      'A geolocalização do navegador requer conexão segura (HTTPS). Acesse via HTTPS para utilizar o GPS.',
      'INSECURE_CONTEXT',
      { isIframe, isStandalone },
    )
  }

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    throw new GeolocationServiceError(
      'Geolocalização não suportada neste navegador ou dispositivo.',
      'NOT_SUPPORTED',
      { isIframe, isStandalone },
    )
  }

  // Estágio 1: Alta precisão (satélite GPS puro)
  try {
    const pos = await attemptPosition({
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
    })
    return { ...pos, isApproximate: pos.accuracy > 80 }
  } catch (firstErr: any) {
    // Se foi permissão negada, não adianta tentar outro estágio: o usuário/navegador barrou
    if (firstErr?.code === 1 || firstErr?.name === 'NotAllowedError') {
      const msg = isIframe
        ? 'Permissão de localização bloqueada no quadro (preview). Se estiver no preview, abra o sistema na URL direta ou autorize a localização.'
        : 'Permissão de localização negada. Toque no ícone de opções do navegador para autorizar o acesso ao GPS.'
      throw new GeolocationServiceError(
        msg,
        isIframe ? 'IFRAME_RESTRICTION' : 'PERMISSION_DENIED',
        {
          isIframe,
          isStandalone,
          rawCode: 1,
        },
      )
    }

    // Estágio 2: Fallback para precisão balanceada (torre de celular/rede, útil em áreas com obstrução de satélite)
    try {
      const pos2 = await attemptPosition({
        enableHighAccuracy: false,
        timeout: 9000,
        maximumAge: 20000,
      })
      return { ...pos2, isApproximate: true }
    } catch (secondErr: any) {
      if (secondErr?.code === 1 || secondErr?.name === 'NotAllowedError') {
        throw new GeolocationServiceError('Permissão de localização negada.', 'PERMISSION_DENIED', {
          isIframe,
          isStandalone,
          rawCode: 1,
        })
      }

      // Estágio 3: Última tentativa usando cache de localização do aparelho de até 2 minutos
      try {
        const pos3 = await attemptPosition({
          enableHighAccuracy: false,
          timeout: 4000,
          maximumAge: 120000,
        })
        return { ...pos3, isApproximate: true }
      } catch (finalErr: any) {
        const code = finalErr?.code || firstErr?.code
        let kind: GeolocationErrorKind = 'UNKNOWN'
        let msg = 'Erro ao obter localização do dispositivo.'

        if (code === 1 || finalErr?.name === 'NotAllowedError') {
          kind = 'PERMISSION_DENIED'
          msg = 'Permissão de localização negada pelo usuário.'
        } else if (code === 2) {
          kind = 'POSITION_UNAVAILABLE'
          msg =
            'Sinal de GPS indisponível no momento. Certifique-se de que a localização do celular está ligada no menu de configurações do aparelho.'
        } else if (code === 3) {
          kind = 'TIMEOUT'
          msg =
            'Tempo esgotado ao buscar sinal de satélite. Mova-se para um local com visão livre do céu ou utilize o mapa interativo.'
        }

        throw new GeolocationServiceError(msg, kind, {
          isIframe,
          isStandalone,
          rawCode: code,
        })
      }
    }
  }
}
