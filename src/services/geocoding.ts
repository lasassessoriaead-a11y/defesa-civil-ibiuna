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
): Promise<DirectGeocodeResult[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('Sem conexão de rede para geocodificação direta.')
  }

  const cleanQuery = query.trim()
  if (!cleanQuery) return []

  const finalQuery =
    preferredCity && !cleanQuery.toLowerCase().includes(preferredCity.toLowerCase())
      ? `${cleanQuery}, ${preferredCity}`
      : cleanQuery

  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
    finalQuery,
  )}&limit=3&countrycodes=br`

  const res = await fetch(url, {
    headers: {
      'Accept-Language': 'pt-BR,pt;q=0.9',
    },
    signal: AbortSignal.timeout(8000),
  })

  if (!res.ok) {
    throw new Error(`Serviço de busca no mapa indisponível (${res.status}).`)
  }

  const list = await res.json()
  if (!Array.isArray(list)) return []

  return list.map((item) => ({
    latitude: parseFloat(item.lat),
    longitude: parseFloat(item.lon),
    displayName: item.display_name,
  }))
}

/**
 * Captura GPS do dispositivo via API do navegador
 * Retorna coordenadas reais e precisão em metros
 */
export function getCurrentPositionWithAccuracy(): Promise<{
  latitude: number
  longitude: number
  accuracy: number
}> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocalização não suportada neste navegador ou dispositivo.'))
      return
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 5000,
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 0),
        })
      },
      (err) => {
        let msg = 'Erro ao obter localização do dispositivo.'
        switch (err.code) {
          case err.PERMISSION_DENIED:
            msg =
              'Permissão de localização negada pelo usuário. Ative a permissão de GPS no navegador/sistema.'
            break
          case err.POSITION_UNAVAILABLE:
            msg = 'Sinal de GPS/localização indisponível no momento.'
            break
          case err.TIMEOUT:
            msg = 'Tempo limite esgotado ao tentar obter o sinal de GPS.'
            break
        }
        reject(new Error(msg))
      },
      options,
    )
  })
}
