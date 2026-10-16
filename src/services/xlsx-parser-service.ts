/**
 * xlsx-parser-service.ts
 * Parser client-side para o arquivo Excel fornecido pelo usuário:
 * Sintese_Setores_Risco_Trechos_Perigo_...xlsx
 *
 * RESTRIÇÃO CRÍTICA: As linhas do XLSX NUNCA são embutidas no código fonte.
 * A leitura ocorre em tempo de execução via ArrayBuffer do arquivo enviado pelo usuário no navegador.
 */

export interface ParsedRiskRow {
  kind: 'sector' | 'stretch' | 'totalizer' | 'ignored'
  code: string
  sectorNumber?: string
  zone?: string
  areaNumber?: string
  areaName?: string
  plateNumber?: string
  location?: string
  processType?: string
  dangerGrade?: string
  vulnerabilityGrade?: string
  riskGrade?: string
  riskLevel: 'R1' | 'R2' | 'R3' | 'R4' | 'indefinido'
  affectedBuildings?: number
  affectedDwellings?: number
  affectedResidents?: number
  affectedRoadsLength?: number
  disasterHistory?: string
  regionalRiskInfo?: string
  expectedProcesses?: string
  description?: string
  recommendations?: string
  rawRow: Record<string, any>
  rejectionReason?: string
  isValid: boolean
  isIncomplete: boolean
  sourceLineNumber: number
}

export interface ParseResultSummary {
  fileName: string
  totalRawRows: number
  totalDataRecords: number
  totalRiskSectors: number
  totalDangerStretches: number
  totalTotalizers: number
  totalIgnored: number
  validRecords: ParsedRiskRow[]
  totalizers: ParsedRiskRow[]
  rejectedRecords: { line: number; reason: string; raw: any }[]
  duplicatesFound: number
  incompleteCount: number
}

// Carregador dinâmico do SheetJS via CDN seguro (evita inchar bundle inicial)
let xlsxPromise: Promise<any> | null = null

export function loadSheetJs(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('SheetJS só pode ser carregado no navegador.'))
  }

  if ((window as any).XLSX) {
    return Promise.resolve((window as any).XLSX)
  }

  if (xlsxPromise) return xlsxPromise

  xlsxPromise = new Promise((resolve, reject) => {
    // Tenta primeiro via CDN do unpkg
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js'
    script.async = true
    script.onload = () => {
      if ((window as any).XLSX) {
        resolve((window as any).XLSX)
      } else {
        reject(new Error('Biblioteca XLSX não inicializou corretamente.'))
      }
    }
    script.onerror = () => {
      // Fallback para cdnjs
      const fallbackScript = document.createElement('script')
      fallbackScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
      fallbackScript.async = true
      fallbackScript.onload = () => {
        if ((window as any).XLSX) {
          resolve((window as any).XLSX)
        } else {
          reject(new Error('Falha ao carregar fallback da biblioteca XLSX.'))
        }
      }
      fallbackScript.onerror = () => reject(new Error('Falha na rede ao carregar XLSX.'))
      document.head.appendChild(fallbackScript)
    }
    document.head.appendChild(script)
  })

  return xlsxPromise
}

/**
 * Normaliza o valor de risco para R1, R2, R3, R4 ou indefinido
 */
function normalizeRiskLevel(val: string): 'R1' | 'R2' | 'R3' | 'R4' | 'indefinido' {
  if (!val) return 'indefinido'
  const upper = val.toUpperCase().trim()
  if (upper.includes('R4')) return 'R4'
  if (upper.includes('R3')) return 'R3'
  if (upper.includes('R2')) return 'R2'
  if (upper.includes('R1')) return 'R1'
  return 'indefinido'
}

/**
 * Converte valor de célula para número limpo
 */
function parseNumberClean(val: any): number | undefined {
  if (val === null || val === undefined) return undefined
  if (typeof val === 'number') return isNaN(val) ? undefined : val
  const str = String(val)
    .replace(/,/g, '.')
    .replace(/[^0-9.]/g, '')
    .trim()
  if (!str) return undefined
  const num = parseFloat(str)
  return isNaN(num) ? undefined : num
}

/**
 * Faz o parsing completo de um arquivo Excel de Setores de Risco e Trechos de Perigo
 */
export async function parseRiskExcelFile(file: File): Promise<ParseResultSummary> {
  const XLSX = await loadSheetJs()
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  // Seleciona a primeira aba ou a aba 'Sheet 0_Sintese_Setores_risco_2024_09'
  const sheetName =
    workbook.SheetNames.find(
      (s: string) => s.toLowerCase().includes('sintese') || s.toLowerCase().includes('setor'),
    ) || workbook.SheetNames[0]

  const worksheet = workbook.Sheets[sheetName]
  if (!worksheet) {
    throw new Error('Planilha vazia ou aba não encontrada.')
  }

  // Converte a aba para matriz de objetos ou matriz crua (header: 1)
  const rawRows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })

  if (rawRows.length < 2) {
    throw new Error('Planilha não contém linhas suficientes de dados.')
  }

  // Localizar a linha de cabeçalho
  // Cabeçalhos conhecidos: Zona, Nº Área, Nome da Área, Nº Setor ou Nº Trecho, Processo Perigoso, etc.
  let headerIndex = -1
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const rowStr = rawRows[i].map((c) => String(c).toLowerCase()).join(' ')
    if (
      (rowStr.includes('setor') || rowStr.includes('trecho')) &&
      (rowStr.includes('processo') || rowStr.includes('perigo') || rowStr.includes('grau'))
    ) {
      headerIndex = i
      break
    }
  }

  if (headerIndex === -1) {
    // Fallback: assume linha 0 como cabeçalho
    headerIndex = 0
  }

  const rawHeaders = rawRows[headerIndex].map((h) => String(h).trim())

  // Mapeamento flexível de índices de colunas
  const findCol = (terms: string[]) =>
    rawHeaders.findIndex((h) => {
      const lower = h.toLowerCase()
      return terms.some((t) => lower.includes(t))
    })

  const colZona = findCol(['zona'])
  const colNumArea = findCol(['nº área', 'no area', 'n° area', 'área'])
  const colNomeArea = findCol(['nome da área', 'nome da area', 'localização', 'prancha'])
  const colNumSetorTrecho = findCol(['nº setor', 'n° setor', 'trecho de via', 'setor ou'])
  const colLocalizacao = findCol([
    'localização dos setores',
    'localizacao dos setores',
    'localização',
  ])
  const colProcesso = findCol(['processo perigoso', 'processo'])
  const colGrauPerigo = findCol(['grau de perigo', 'perigo'])
  const colGrauVuln = findCol(['grau de vulnerabilidade', 'vulnerabilidade'])
  const colGrauRisco = findCol(['grau de risco', 'risco'])
  const colNomeSetorTrecho = findCol([
    'nome setor risco',
    'nome setor',
    'trecho perigo',
    'código',
    'codigo',
  ])
  const colEdificacoes = findCol(['edificações', 'edificacoes', 'comprimento de via'])
  const colDesastres = findCol(['desastres', 'ocorrência'])
  const colRiscoReg = findCol(['regional', 'suscetibilidade'])
  const colProcEsp = findCol(['processos esperados', 'tipos de processos'])
  const colDescricao = findCol(['descrição', 'descricao'])
  const colRecomend = findCol(['recomendações', 'recomendacoes'])
  const colMoradias = findCol(['moradias', 'número total aproximado de moradias'])
  const colMoradores = findCol(['moradores', 'número total aproximado de moradores'])
  const colViasMetros = findCol(['vias afetadas', 'comprimento total aproximado'])

  const validRecords: ParsedRiskRow[] = []
  const totalizers: ParsedRiskRow[] = []
  const rejectedRecords: { line: number; reason: string; raw: any }[] = []
  const seenCodes = new Set<string>()
  let duplicatesFound = 0

  let currentZone = ''
  let currentAreaNum = ''
  let currentAreaName = ''
  let currentPlateNum = ''

  for (let r = headerIndex + 1; r < rawRows.length; r++) {
    const row = rawRows[r]
    if (!row || row.length === 0 || row.every((c) => String(c).trim() === '')) {
      continue // Linha vazia ignorada
    }

    const rowObj: Record<string, any> = {}
    rawHeaders.forEach((h, idx) => {
      rowObj[h || `col_${idx}`] = row[idx]
    })

    const rawZona = colZona >= 0 ? String(row[colZona] || '').trim() : ''
    const rawNumArea = colNumArea >= 0 ? String(row[colNumArea] || '').trim() : ''
    const rawNomeArea = colNomeArea >= 0 ? String(row[colNomeArea] || '').trim() : ''
    const rawNumSetor = colNumSetorTrecho >= 0 ? String(row[colNumSetorTrecho] || '').trim() : ''
    const rawLoc = colLocalizacao >= 0 ? String(row[colLocalizacao] || '').trim() : ''
    const rawProcesso = colProcesso >= 0 ? String(row[colProcesso] || '').trim() : ''
    const rawPerigo = colGrauPerigo >= 0 ? String(row[colGrauPerigo] || '').trim() : ''
    const rawVuln = colGrauVuln >= 0 ? String(row[colGrauVuln] || '').trim() : ''
    const rawRisco = colGrauRisco >= 0 ? String(row[colGrauRisco] || '').trim() : ''
    const rawCode = colNomeSetorTrecho >= 0 ? String(row[colNomeSetorTrecho] || '').trim() : ''

    // Propagar agrupamento de Área se preenchido na linha
    if (rawZona) currentZone = rawZona
    if (rawNumArea) currentAreaNum = rawNumArea
    if (rawNomeArea) {
      currentAreaName = rawNomeArea
      // Extrair prancha se houver ex: "(PRANCHA 053)"
      const pranchaMatch = rawNomeArea.match(/PRANCHA\s*([0-9A-Za-z_-]+)/i)
      if (pranchaMatch) currentPlateNum = pranchaMatch[1]
    }

    // Verificar se é linha de TOTALIZAÇÃO (ex.: "TOTAL", "Total Aproximado", "Soma")
    const combinedStr = row.map((c) => String(c).toLowerCase()).join(' ')
    const isTotalizer =
      combinedStr.includes('total de moradias') ||
      combinedStr.includes('total aproximado') ||
      combinedStr.includes('totalizadores') ||
      (rawNumSetor.toLowerCase().includes('total') && !rawCode)

    if (isTotalizer) {
      totalizers.push({
        kind: 'totalizer',
        code: rawCode || `TOTAL_L${r + 1}`,
        zone: currentZone,
        areaName: currentAreaName,
        rawRow: rowObj,
        isValid: true,
        isIncomplete: false,
        riskLevel: 'indefinido',
        sourceLineNumber: r + 1,
      })
      continue
    }

    // Se não tiver código técnico (ex: IBI-01...) nem número de setor/trecho, é linha de comentário ou cabeçalho intermediário
    if (!rawCode && !rawNumSetor) {
      rejectedRecords.push({
        line: r + 1,
        reason: 'Linha sem código técnico nem identificação de setor/trecho',
        raw: rowObj,
      })
      continue
    }

    // Identificar se é Setor de Risco ou Trecho de Perigo
    const isStretch =
      rawCode.toUpperCase().includes('/T') ||
      rawNumSetor.toLowerCase().includes('trecho') ||
      rawNumSetor.toLowerCase().includes('via')

    const kind: 'sector' | 'stretch' = isStretch ? 'stretch' : 'sector'

    // Deduplicação idempotente por código
    const finalCode = rawCode || `${currentAreaNum || 'IBI'}-${rawNumSetor}`
    if (seenCodes.has(finalCode)) {
      duplicatesFound++
    }
    seenCodes.add(finalCode)

    const edificacoes = colEdificacoes >= 0 ? parseNumberClean(row[colEdificacoes]) : undefined
    const moradias = colMoradias >= 0 ? parseNumberClean(row[colMoradias]) : undefined
    const moradores = colMoradores >= 0 ? parseNumberClean(row[colMoradores]) : undefined
    const vias = colViasMetros >= 0 ? parseNumberClean(row[colViasMetros]) : undefined

    const isIncomplete = !rawProcesso || !rawRisco || !rawLoc

    validRecords.push({
      kind,
      code: finalCode,
      sectorNumber: rawNumSetor,
      zone: currentZone,
      areaNumber: currentAreaNum,
      areaName: currentAreaName,
      plateNumber: currentPlateNum,
      location: rawLoc,
      processType: rawProcesso,
      dangerGrade: rawPerigo,
      vulnerabilityGrade: rawVuln,
      riskGrade: rawRisco,
      riskLevel: normalizeRiskLevel(rawRisco),
      affectedBuildings: edificacoes,
      affectedDwellings: moradias,
      affectedResidents: moradores,
      affectedRoadsLength: vias || (isStretch ? edificacoes : undefined),
      disasterHistory: colDesastres >= 0 ? String(row[colDesastres] || '').trim() : undefined,
      regionalRiskInfo: colRiscoReg >= 0 ? String(row[colRiscoReg] || '').trim() : undefined,
      expectedProcesses: colProcEsp >= 0 ? String(row[colProcEsp] || '').trim() : undefined,
      description: colDescricao >= 0 ? String(row[colDescricao] || '').trim() : undefined,
      recommendations: colRecomend >= 0 ? String(row[colRecomend] || '').trim() : undefined,
      rawRow: rowObj,
      isValid: true,
      isIncomplete,
      sourceLineNumber: r + 1,
    })
  }

  const sectorsCount = validRecords.filter((v) => v.kind === 'sector').length
  const stretchesCount = validRecords.filter((v) => v.kind === 'stretch').length
  const incompleteCount = validRecords.filter((v) => v.isIncomplete).length

  return {
    fileName: file.name,
    totalRawRows: rawRows.length,
    totalDataRecords: validRecords.length,
    totalRiskSectors: sectorsCount,
    totalDangerStretches: stretchesCount,
    totalTotalizers: totalizers.length,
    totalIgnored: rejectedRecords.length,
    validRecords,
    totalizers,
    rejectedRecords,
    duplicatesFound,
    incompleteCount,
  }
}
