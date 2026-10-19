/**
 * Utilitário de integração com Google Earth e exportação em KML para Defesa Civil de Ibiúna.
 *
 * Google Earth aceita links diretos de coordenadas no formato web:
 * https://earth.google.com/web/search/@lat,lng,elevated
 *
 * Exportação em KML padronizada (WGS84) sem dados pessoais ou privados,
 * separando setores (polígonos), trechos de perigo (linhas) e infraestruturas (pontos).
 */

export function getGoogleEarthUrl(lat: number, lng: number): string {
  return `https://earth.google.com/web/@${lat.toFixed(6)},${lng.toFixed(6)},900a,1000d,35y,0h,0t,0r`
}

export function escapeXml(str?: string): string {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export interface KmlExportData {
  infrastructures?: any[]
  riskSectors?: any[]
  dangerStretches?: any[]
  occurrences?: any[]
}

export function generateKmlDocument(data: KmlExportData): string {
  const { infrastructures = [], riskSectors = [], dangerStretches = [], occurrences = [] } = data

  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Defesa Civil Ibiuna - Levantamento Territorial</name>
    <description>Exportacao tecnica oficial. Geometrias em WGS84. Nota: A exportacao KML nao sincroniza automaticamente alteracoes com o sistema.</description>

    <Style id="infra_style">
      <IconStyle>
        <color>ff059669</color>
        <scale>1.1</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
      </IconStyle>
    </Style>

    <Style id="occ_style">
      <IconStyle>
        <color>ffdc2626</color>
        <scale>1.2</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/shapes/caution.png</href></Icon>
      </IconStyle>
    </Style>

    <Style id="sector_style">
      <LineStyle><color>ffea580c</color><width>2</width></LineStyle>
      <PolyStyle><color>7fea580c</color></PolyStyle>
    </Style>

    <Style id="stretch_style">
      <LineStyle><color>ff2563eb</color><width>4</width></LineStyle>
    </Style>

    <!-- Folder 1: Pontes e Aduelas - Levantamento Municipal -->
    <Folder>
      <name>Pontes e Aduelas (Levantamento Municipal)</name>
`

  for (const infra of infrastructures) {
    if (infra.latitude && infra.longitude && !isNaN(infra.latitude) && !isNaN(infra.longitude)) {
      const code = escapeXml(infra.original_code || infra.code || 'Infraestrutura')
      const type = escapeXml(infra.type || infra.structure_type || 'Estrutura')
      const neigh = escapeXml(infra.neighborhood || 'Não informado')
      const cond = escapeXml(infra.structural_condition || 'Nao avaliado')
      const source = escapeXml(infra.source_document || 'Pontes e aduelas-21295.pdf')

      kml += `      <Placemark>
        <name>${code} (${type})</name>
        <description><![CDATA[
          <b>Codigo Original:</b> ${code}<br/>
          <b>Tipo:</b> ${type}<br/>
          <b>Bairro:</b> ${neigh}<br/>
          <b>Condicao Estrutural:</b> ${cond}<br/>
          <b>Fonte Documental:</b> ${source}<br/>
        ]]></description>
        <styleUrl>#infra_style</styleUrl>
        <Point>
          <coordinates>${infra.longitude},${infra.latitude},0</coordinates>
        </Point>
      </Placemark>
`
    }
  }

  kml += `    </Folder>

    <!-- Folder 2: Ocorrencias Ativas (sem dados pessoais) -->
    <Folder>
      <name>Ocorrencias Publicas</name>
`

  for (const occ of occurrences) {
    if (occ.latitude && occ.longitude && !isNaN(occ.latitude) && !isNaN(occ.longitude)) {
      const title = escapeXml(occ.title || occ.code || 'Ocorrencia')
      const type = escapeXml(occ.type || 'outro')
      const sev = escapeXml(occ.severity || 'media')
      const status = escapeXml(occ.status || 'reportada')
      const address = escapeXml(occ.address || '')

      kml += `      <Placemark>
        <name>${title}</name>
        <description><![CDATA[
          <b>Tipo:</b> ${type}<br/>
          <b>Gravidade:</b> ${sev}<br/>
          <b>Status:</b> ${status}<br/>
          <b>Local:</b> ${address}<br/>
        ]]></description>
        <styleUrl>#occ_style</styleUrl>
        <Point>
          <coordinates>${occ.longitude},${occ.latitude},0</coordinates>
        </Point>
      </Placemark>
`
    }
  }

  kml += `    </Folder>

    <!-- Folder 3: Setores de Risco IPT (Poligonos) -->
    <Folder>
      <name>Setores de Risco - IPT</name>
`

  for (const sector of riskSectors) {
    if (sector.geometry_geojson) {
      try {
        const geom = JSON.parse(sector.geometry_geojson)
        const code = escapeXml(sector.code || sector.area_name || 'Setor')
        const risk = escapeXml(sector.risk_level || 'R2')
        const process = escapeXml(sector.process_type || 'Risco Geologico')
        const loc = escapeXml(sector.location || sector.area_name || '')

        let coordsKml = ''
        if (geom.type === 'Polygon' && Array.isArray(geom.coordinates?.[0])) {
          coordsKml = geom.coordinates[0].map((pt: any[]) => `${pt[0]},${pt[1]},0`).join(' ')
        } else if (geom.type === 'MultiPolygon' && Array.isArray(geom.coordinates?.[0]?.[0])) {
          coordsKml = geom.coordinates[0][0].map((pt: any[]) => `${pt[0]},${pt[1]},0`).join(' ')
        }

        if (coordsKml) {
          kml += `      <Placemark>
        <name>${code} (${risk})</name>
        <description><![CDATA[
          <b>Codigo IPT:</b> ${code}<br/>
          <b>Grau de Risco:</b> ${risk}<br/>
          <b>Processo:</b> ${process}<br/>
          <b>Localizacao:</b> ${loc}<br/>
        ]]></description>
        <styleUrl>#sector_style</styleUrl>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>${coordsKml}</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>
`
        }
      } catch {
        /* ignore invalid geojson */
      }
    }
  }

  kml += `    </Folder>

    <!-- Folder 4: Trechos de Enxurrada IPT (Linhas) -->
    <Folder>
      <name>Trechos de Enxurrada - IPT</name>
`

  for (const stretch of dangerStretches) {
    if (stretch.geometry_geojson) {
      try {
        const geom = JSON.parse(stretch.geometry_geojson)
        const code = escapeXml(stretch.code || 'Trecho')
        const risk = escapeXml(stretch.risk_level || stretch.danger_grade || 'P1')
        const loc = escapeXml(stretch.location || stretch.area_name || '')
        const isT01 = code.includes('T01')

        let coordsKml = ''
        if (geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
          coordsKml = geom.coordinates.map((pt: any[]) => `${pt[0]},${pt[1]},0`).join(' ')
        } else if (geom.type === 'MultiLineString' && Array.isArray(geom.coordinates?.[0])) {
          coordsKml = geom.coordinates[0].map((pt: any[]) => `${pt[0]},${pt[1]},0`).join(' ')
        }

        if (coordsKml) {
          kml += `      <Placemark>
        <name>${code} (${risk})</name>
        <description><![CDATA[
          <b>Trecho IPT:</b> ${code}<br/>
          <b>Grau de Perigo:</b> ${risk}<br/>
          <b>Localizacao:</b> ${loc}<br/>
          ${
            isT01
              ? '<b>Aviso Técnico:</b> Classificações distintas por segmento — P2 a montante / P4 a jusante. Pendente de conferência técnica.<br/>'
              : ''
          }
        ]]></description>
        <styleUrl>#stretch_style</styleUrl>
        <LineString>
          <coordinates>${coordsKml}</coordinates>
        </LineString>
      </Placemark>
`
        }
      } catch {
        /* ignore invalid geojson */
      }
    }
  }

  kml += `    </Folder>
  </Document>
</kml>`

  return kml
}

export function downloadKmlFile(kmlContent: string, filename = 'defesa_civil_ibiuna.kml') {
  const blob = new Blob([kmlContent], {
    type: 'application/vnd.google-earth.kml+xml;charset=utf-8',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
