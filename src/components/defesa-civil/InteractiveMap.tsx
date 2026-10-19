import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  MapContainer as RLMapContainer,
  TileLayer as RLTileLayer,
  Marker as RLMarker,
  Popup,
  Polygon,
  Polyline,
  useMap,
  useMapEvents,
} from 'react-leaflet'

const MapContainer = RLMapContainer as React.ComponentType<any>
const TileLayer = RLTileLayer as React.ComponentType<any>
const Marker = RLMarker as React.ComponentType<any>
import L from 'leaflet'
import {
  Layers,
  ZoomIn,
  ZoomOut,
  Navigation,
  AlertOctagon,
  Building2,
  Users,
  Maximize2,
  Trash2,
  MapPin,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import pb from '@/lib/pocketbase/client'
import type {
  Occurrence,
  Shelter,
  Team,
  AffectedArea,
  StrategicInfrastructure,
} from '@/types/defesa-civil'
import { SeverityBadge, getHazardIcon } from './StatusBadges'

// Helper to construct modern custom HTML markers with DivIcon
function createDivIcon(
  html: string,
  className = '',
  iconSize: [number, number] = [32, 32],
  iconAnchor: [number, number] = [16, 16],
) {
  return L.divIcon({
    html,
    className: `custom-leaflet-marker ${className}`,
    iconSize,
    iconAnchor,
    popupAnchor: [0, -iconAnchor[1]],
  })
}

// Occurrence icons based on hazard type and severity
function getOccurrenceIcon(occ: Occurrence, isSelected = false) {
  let bgColor = '#059669' // low
  if (occ.severity === 'critica') bgColor = '#dc2626'
  else if (occ.severity === 'alta') bgColor = '#ea580c'
  else if (occ.severity === 'media') bgColor = '#d97706'

  const borderClass = isSelected ? 'border-yellow-400 ring-4 ring-yellow-400/40' : 'border-white'
  const pulseClass = occ.severity === 'critica' ? 'animate-pulse' : ''
  const size = isSelected ? 38 : 32
  const anchor = isSelected ? 19 : 16

  // SVG symbols
  let iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  if (occ.type === 'enchente') {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M16 14v6"/><path d="M8 14v6"/><path d="M12 16v6"/></svg>`
  } else if (occ.type === 'deslizamento') {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>`
  } else if (occ.type === 'incendio_florestal') {
    iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`
  }

  const html = `
    <div style="background-color: ${bgColor}; width: ${size}px; height: ${size}px;" 
         class="rounded-full flex items-center justify-center text-white shadow-lg border-2 ${borderClass} ${pulseClass} transition-all">
      ${iconSvg}
    </div>
  `
  return createDivIcon(html, '', [size, size], [anchor, anchor])
}

// Shelter icon
function getShelterIcon(shelter: Shelter) {
  const isFull = shelter.status === 'cheio' || (shelter.occupancy || 0) >= shelter.capacity
  const bgColor = isFull ? '#b91c1c' : '#2563eb'
  const html = `
    <div style="background-color: ${bgColor}; width: 32px; height: 32px;" 
         class="rounded-lg flex items-center justify-center text-white shadow-md border-2 border-white transition-all">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>
    </div>
  `
  return createDivIcon(html, '', [32, 32], [16, 16])
}

// Team icon
function getTeamIcon(team: Team) {
  const isInOp = team.status === 'em_operacao'
  const bgColor = isInOp ? '#9333ea' : '#059669'
  const pulseClass = isInOp ? 'animate-pulse' : ''
  const html = `
    <div style="background-color: ${bgColor}; width: 30px; height: 30px;" 
         class="rounded-full flex items-center justify-center text-white shadow-md border-2 border-white ${pulseClass} transition-all">
      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
    </div>
  `
  return createDivIcon(html, '', [30, 30], [15, 15])
}

// Picked Coordinate Pin Icon
function getPickedPinIcon() {
  const html = `
    <div class="relative -translate-y-2 flex flex-col items-center">
      <div class="w-8 h-8 rounded-full bg-red-600 border-2 border-white shadow-xl flex items-center justify-center text-white animate-bounce">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div class="w-2 h-2 bg-red-800 rounded-full blur-[1px] -mt-0.5"></div>
    </div>
  `
  return createDivIcon(html, '', [32, 42], [16, 40])
}

// Color and stroke settings for risk areas
function getAreaStyle(riskLevel: string, status?: string) {
  let color = '#059669' // baixo
  let fillColor = '#059669'

  if (riskLevel === 'critico') {
    color = '#dc2626'
    fillColor = '#ef4444'
  } else if (riskLevel === 'alto') {
    color = '#ea580c'
    fillColor = '#f97316'
  } else if (riskLevel === 'medio') {
    color = '#d97706'
    fillColor = '#f59e0b'
  }

  return {
    color,
    fillColor,
    fillOpacity: 0.35,
    weight: 2.5,
    dashArray: status === 'interditado' ? '6, 6' : undefined,
  }
}

// Controller component to handle map clicks for picking coords or drawing polygons
interface MapEventsHandlerProps {
  interactivePick?: boolean
  onPickCoordinate?: (lat: number, lng: number) => void
  allowDrawingPolygon?: boolean
  polygonPoints?: [number, number][]
  onPolygonChange?: (points: [number, number][]) => void
  onViewportChange?: (center: [number, number], zoom: number) => void
}

const MapEventsHandler: React.FC<MapEventsHandlerProps> = ({
  interactivePick,
  onPickCoordinate,
  allowDrawingPolygon,
  polygonPoints = [],
  onPolygonChange,
  onViewportChange,
}) => {
  useMapEvents({
    click(e) {
      const lat = Number(e.latlng.lat.toFixed(5))
      const lng = Number(e.latlng.lng.toFixed(5))

      if (allowDrawingPolygon && onPolygonChange) {
        onPolygonChange([...polygonPoints, [lat, lng]])
        return
      }

      if (interactivePick && onPickCoordinate) {
        onPickCoordinate(lat, lng)
      }
    },
    moveend(e) {
      if (onViewportChange) {
        const c = e.target.getCenter()
        const z = e.target.getZoom()
        onViewportChange([Number(c.lat.toFixed(6)), Number(c.lng.toFixed(6))], z)
      }
    },
    zoomend(e) {
      if (onViewportChange) {
        const c = e.target.getCenter()
        const z = e.target.getZoom()
        onViewportChange([Number(c.lat.toFixed(6)), Number(c.lng.toFixed(6))], z)
      }
    },
  })
  return null
}

// Controller component to sync map center / view and container size when props update
const MapViewController: React.FC<{
  center: [number, number]
  zoom?: number
}> = ({ center, zoom }) => {
  const map = useMap()
  const prevCenterRef = useRef<[number, number] | null>(null)

  // Invalidate map size after mounting / rendering in dynamic dialogs/containers
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 150)
    return () => clearTimeout(timer)
  }, [map])

  useEffect(() => {
    if (center && center[0] !== undefined && center[1] !== undefined) {
      const isDifferent =
        !prevCenterRef.current ||
        Math.abs(prevCenterRef.current[0] - center[0]) > 0.0001 ||
        Math.abs(prevCenterRef.current[1] - center[1]) > 0.0001

      if (isDifferent) {
        map.flyTo(center, zoom || map.getZoom(), { duration: 0.8 })
        prevCenterRef.current = center
      }
    }
  }, [center, zoom, map])

  return null
}

// Custom map zoom/center controls inside Leaflet Container
const CustomMapControls: React.FC<{
  defaultCenter: [number, number]
  defaultZoom: number
}> = ({ defaultCenter, defaultZoom }) => {
  const map = useMap()

  return (
    <div className="leaflet-top leaflet-right" style={{ pointerEvents: 'auto', margin: '10px' }}>
      <div className="flex flex-col gap-1 bg-white/95 backdrop-blur-md p-1 rounded-lg border border-slate-300 shadow-md">
        <Button
          size="icon"
          variant="ghost"
          className="w-7 h-7 text-slate-700 hover:text-black hover:bg-slate-100"
          onClick={() => map.zoomIn()}
          title="Aproximar Zoom"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="w-7 h-7 text-slate-700 hover:text-black hover:bg-slate-100"
          onClick={() => map.zoomOut()}
          title="Afastar Zoom"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="w-7 h-7 text-slate-700 hover:text-blue-600 hover:bg-blue-50"
          onClick={() => map.setView(defaultCenter, defaultZoom)}
          title="Centralizar Município"
        >
          <Navigation className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}

export interface InteractiveMapLayersState {
  showOccurrences?: boolean
  showInfrastructures?: boolean
  showAreas?: boolean
  showShelters?: boolean
  showTeams?: boolean
  showRiskSectorsGeo?: boolean
  showDangerStretchesGeo?: boolean
  showInundationGeo?: boolean
  showHydroGeo?: boolean
  showMacroGeo?: boolean
  showContoursGeo?: boolean
  showUtbGeo?: boolean
  showPhotosGeo?: boolean
  showCadEvGeo?: boolean
  riskFilter?: 'all' | 'R1' | 'R2' | 'R3' | 'R4'
  localityFilter?: string
  typeFilter?: 'all' | 'setor' | 'trecho'
}

export interface InteractiveMapProps {
  height?: string
  occurrences?: Occurrence[]
  shelters?: Shelter[]
  teams?: Team[]
  areas?: AffectedArea[]
  strategicInfrastructures?: StrategicInfrastructure[]
  riskSectorsCount?: number
  dangerStretchesCount?: number
  selectedItem?: { type: string; id: string } | null
  onSelectItem?: (type: string, item: any) => void
  interactivePick?: boolean
  onPickCoordinate?: (lat: number, lng: number) => void
  pickedCoordinate?: { lat: number; lng: number } | null
  center?: [number, number]
  zoom?: number
  allowDrawingPolygon?: boolean
  polygonPoints?: [number, number][]
  onPolygonChange?: (points: [number, number][]) => void
  showLayerToggles?: boolean
  onViewportChange?: (center: [number, number], zoom: number) => void
  initialLayers?: InteractiveMapLayersState
  onLayersChange?: (layers: InteractiveMapLayersState) => void
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  height = '400px',
  occurrences = [],
  shelters = [],
  teams = [],
  areas = [],
  strategicInfrastructures = [],
  riskSectorsCount = 0,
  dangerStretchesCount = 0,
  selectedItem,
  onSelectItem,
  interactivePick = false,
  onPickCoordinate,
  pickedCoordinate,
  center = [-23.655, -47.22],
  zoom = 13,
  allowDrawingPolygon = false,
  polygonPoints = [],
  onPolygonChange,
  showLayerToggles = true,
  onViewportChange,
  initialLayers,
  onLayersChange,
}) => {
  // Layer toggles
  const [showOccurrences, setShowOccurrences] = useState(
    initialLayers?.showOccurrences !== undefined ? initialLayers.showOccurrences : true,
  )
  const [showInfrastructures, setShowInfrastructures] = useState(
    initialLayers?.showInfrastructures !== undefined ? initialLayers.showInfrastructures : true,
  )
  const [showAreas, setShowAreas] = useState(
    initialLayers?.showAreas !== undefined ? initialLayers.showAreas : true,
  )
  const [showShelters, setShowShelters] = useState(
    initialLayers?.showShelters !== undefined ? initialLayers.showShelters : true,
  )
  const [showTeams, setShowTeams] = useState(
    initialLayers?.showTeams !== undefined ? initialLayers.showTeams : true,
  )
  const [showRiskSectorsGeo, setShowRiskSectorsGeo] = useState(
    initialLayers?.showRiskSectorsGeo !== undefined ? initialLayers.showRiskSectorsGeo : true,
  )
  const [showDangerStretchesGeo, setShowDangerStretchesGeo] = useState(
    initialLayers?.showDangerStretchesGeo !== undefined
      ? initialLayers.showDangerStretchesGeo
      : true,
  )
  const [showInundationGeo, setShowInundationGeo] = useState(
    initialLayers?.showInundationGeo !== undefined ? initialLayers.showInundationGeo : true,
  )
  const [showHydroGeo, setShowHydroGeo] = useState(
    initialLayers?.showHydroGeo !== undefined ? initialLayers.showHydroGeo : true,
  )
  const [showMacroGeo, setShowMacroGeo] = useState(
    initialLayers?.showMacroGeo !== undefined ? initialLayers.showMacroGeo : false,
  )
  const [showContoursGeo, setShowContoursGeo] = useState(
    initialLayers?.showContoursGeo !== undefined ? initialLayers.showContoursGeo : false,
  )
  const [showUtbGeo, setShowUtbGeo] = useState(
    initialLayers?.showUtbGeo !== undefined ? initialLayers.showUtbGeo : false,
  )
  const [showPhotosGeo, setShowPhotosGeo] = useState(
    initialLayers?.showPhotosGeo !== undefined ? initialLayers.showPhotosGeo : false,
  )
  const [showCadEvGeo, setShowCadEvGeo] = useState(
    initialLayers?.showCadEvGeo !== undefined ? initialLayers.showCadEvGeo : false,
  )
  const [riskFilter, setRiskFilter] = useState<'all' | 'R1' | 'R2' | 'R3' | 'R4'>(
    initialLayers?.riskFilter || 'all',
  )

  // Report layer toggles to parent if callback provided
  useEffect(() => {
    onLayersChange?.({
      showOccurrences,
      showInfrastructures,
      showAreas,
      showShelters,
      showTeams,
      showRiskSectorsGeo,
      showDangerStretchesGeo,
      showInundationGeo,
      showHydroGeo,
      showMacroGeo,
      showContoursGeo,
      showUtbGeo,
      showPhotosGeo,
      showCadEvGeo,
      riskFilter,
    })
  }, [
    showOccurrences,
    showInfrastructures,
    showAreas,
    showShelters,
    showTeams,
    showRiskSectorsGeo,
    showDangerStretchesGeo,
    showInundationGeo,
    showHydroGeo,
    showMacroGeo,
    showContoursGeo,
    showUtbGeo,
    showPhotosGeo,
    showCadEvGeo,
    riskFilter,
    onLayersChange,
  ])

  // Camadas dinâmicas do banco de dados (geo_layers e geometrias vinculadas de risk_sectors/danger_stretches)
  const [loadedGeoLayers, setLoadedGeoLayers] = useState<any[]>([])
  const [geoRiskSectors, setGeoRiskSectors] = useState<any[]>([])
  const [geoDangerStretches, setGeoDangerStretches] = useState<any[]>([])
  const [currentZoom, setCurrentZoom] = useState(zoom)
  const [mapCenter, setMapCenter] = useState<[number, number]>(center)
  const [localityFilter, setLocalityFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'setor' | 'trecho'>('all')

  const navigate = useNavigate()

  // Carregamento resiliente das geometrias vinculadas do banco
  useEffect(() => {
    let isMounted = true
    async function fetchGeometries() {
      try {
        const [layersRes, sectorsRes, stretchesRes] = await Promise.all([
          pb
            ?.collection('geo_layers')
            ?.getFullList({ batch: 1000, requestKey: null })
            .catch(() => []) || [],
          pb
            ?.collection('risk_sectors')
            ?.getFullList({
              filter: 'geometry_geojson != ""',
              batch: 500,
              requestKey: null,
            })
            .catch(() => []) || [],
          pb
            ?.collection('danger_stretches')
            ?.getFullList({
              filter: 'geometry_geojson != ""',
              batch: 500,
              requestKey: null,
            })
            .catch(() => []) || [],
        ])

        if (isMounted) {
          setLoadedGeoLayers(layersRes || [])
          setGeoRiskSectors(sectorsRes || [])
          setGeoDangerStretches(stretchesRes || [])
        }
      } catch {
        /* intentionally ignored */
      }
    }
    fetchGeometries()
    return () => {
      isMounted = false
    }
  }, [])

  // Coleta todas as localidades únicas disponíveis nas feições e registros
  const availableLocalities = useMemo(() => {
    const locSet = new Set<string>()
    geoRiskSectors.forEach((s) => {
      const loc = s.location || s.area_name
      if (loc && typeof loc === 'string') locSet.add(loc.trim())
    })
    geoDangerStretches.forEach((t) => {
      const loc = t.location || t.area_name
      if (loc && typeof loc === 'string') locSet.add(loc.trim())
    })
    loadedGeoLayers.forEach((l) => {
      const loc = l.locality || l.location || l.name
      if (loc && typeof loc === 'string') locSet.add(loc.trim())
    })
    return Array.from(locSet)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
  }, [geoRiskSectors, geoDangerStretches, loadedGeoLayers])

  // Handlers para clique em setor e trecho IPT levando para a ficha técnica pelo identificador único
  const handleSectorClick = (sectorRecordOrLayer: any) => {
    if (onSelectItem) {
      onSelectItem('risk_sector', sectorRecordOrLayer)
    }
    const targetId = sectorRecordOrLayer.id || sectorRecordOrLayer.code
    if (targetId) {
      navigate(`/setores-risco?id=${encodeURIComponent(targetId)}`)
    }
  }

  const handleStretchClick = (stretchRecordOrLayer: any) => {
    if (onSelectItem) {
      onSelectItem('danger_stretch', stretchRecordOrLayer)
    }
    const targetId = stretchRecordOrLayer.id || stretchRecordOrLayer.code
    if (targetId) {
      navigate(`/setores-risco?id=${encodeURIComponent(targetId)}`)
    }
  }
  // Validate initial center
  const validCenter: [number, number] = useMemo(() => {
    if (
      Array.isArray(center) &&
      center.length === 2 &&
      typeof center[0] === 'number' &&
      !isNaN(center[0]) &&
      typeof center[1] === 'number' &&
      !isNaN(center[1])
    ) {
      return center
    }
    return [-23.5505, -46.6333]
  }, [center])

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-slate-300 shadow-inner bg-slate-100 group"
      style={{ height }}
    >
      {/* Real Interactive Leaflet OpenStreetMap */}
      <MapContainer
        center={validCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        {/* OpenStreetMap standard tiles (Fast, public, free, no API key needed) */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* View controller & Click event listeners */}
        <MapViewController center={validCenter} zoom={zoom} />
        <MapEventsHandler
          interactivePick={interactivePick}
          onPickCoordinate={onPickCoordinate}
          allowDrawingPolygon={allowDrawingPolygon}
          polygonPoints={polygonPoints}
          onPolygonChange={onPolygonChange}
          onViewportChange={onViewportChange}
        />
        <CustomMapControls defaultCenter={validCenter} defaultZoom={zoom} />

        {/* Render Risk Areas (Polygons) */}
        {showAreas &&
          areas.map((area) => {
            if (!area.area_polygon) return null
            try {
              const pts: [number, number][] = JSON.parse(area.area_polygon)
              if (!Array.isArray(pts) || pts.length < 3) return null

              const style = getAreaStyle(area.risk_level, area.status)

              return (
                <Polygon
                  key={area.id}
                  positions={pts}
                  pathOptions={style}
                  eventHandlers={{
                    click: (e) => {
                      L.DomEvent.stopPropagation(e)
                      onSelectItem?.('area', area)
                    },
                  }}
                >
                  <Popup>
                    <div className="p-1 min-w-[200px]">
                      <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                        <Layers className="w-4 h-4 text-amber-600" />
                        {area.name}
                      </div>
                      <div className="text-xs text-slate-600 mt-1 space-y-1">
                        <p>{area.notes || 'Área de monitoramento preventivo.'}</p>
                        <div className="flex items-center justify-between pt-1 font-medium">
                          <span>
                            População:{' '}
                            <strong>{area.affected_population?.toLocaleString('pt-BR')}</strong>{' '}
                            hab.
                          </span>
                          <span className="capitalize font-bold text-red-600">
                            {area.risk_level}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Popup>
                </Polygon>
              )
            } catch (_) {
              return null
            }
          })}

        {/* Render Active Drawing Polygon Preview */}
        {allowDrawingPolygon && polygonPoints.length > 0 && (
          <>
            {polygonPoints.length >= 3 ? (
              <Polygon
                positions={polygonPoints}
                pathOptions={{
                  color: '#2563eb',
                  fillColor: '#3b82f6',
                  fillOpacity: 0.3,
                  dashArray: '5, 5',
                  weight: 2,
                }}
              />
            ) : (
              <Polyline
                positions={polygonPoints}
                pathOptions={{
                  color: '#2563eb',
                  dashArray: '4, 4',
                  weight: 2,
                }}
              />
            )}
            {polygonPoints.map((pt, idx) => (
              <Marker
                key={`draft-pt-${idx}`}
                position={pt}
                icon={createDivIcon(
                  `<div class="w-3.5 h-3.5 bg-blue-600 border-2 border-white rounded-full shadow"></div>`,
                  '',
                  [14, 14],
                  [7, 7],
                )}
              />
            ))}
          </>
        )}

        {/* Render Occurrences Markers */}
        {showOccurrences &&
          occurrences.map((occ) => {
            if (occ.latitude === undefined || occ.longitude === undefined) return null
            if (isNaN(occ.latitude) || isNaN(occ.longitude)) return null

            const isSelected = selectedItem?.type === 'occurrence' && selectedItem?.id === occ.id
            const icon = getOccurrenceIcon(occ, isSelected)

            return (
              <Marker
                key={occ.id}
                position={[occ.latitude, occ.longitude]}
                icon={icon}
                eventHandlers={{
                  click: () => onSelectItem?.('occurrence', occ),
                }}
              >
                <Popup>
                  <div className="p-1 min-w-[220px]">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                      {getHazardIcon(occ.type, 'w-4 h-4')}
                      <span>{occ.title}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                      {occ.description || 'Sem descrição detalhada.'}
                    </p>
                    <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-xs">
                      <SeverityBadge severity={occ.severity} />
                      <span className="text-[11px] text-slate-500 truncate max-w-[120px]">
                        {occ.address}
                      </span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}

        {/* Render Shelters Markers */}
        {showShelters &&
          shelters.map((shelter) => {
            if (shelter.latitude === undefined || shelter.longitude === undefined) return null
            if (isNaN(shelter.latitude) || isNaN(shelter.longitude)) return null

            const icon = getShelterIcon(shelter)

            return (
              <Marker
                key={shelter.id}
                position={[shelter.latitude, shelter.longitude]}
                icon={icon}
                eventHandlers={{
                  click: () => onSelectItem?.('shelter', shelter),
                }}
              >
                <Popup>
                  <div className="p-1 min-w-[200px]">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                      <Building2 className="w-4 h-4 text-blue-600" />
                      <span>{shelter.name}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{shelter.address}</p>
                    <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-xs font-semibold">
                      <span>
                        Vagas: {shelter.occupancy || 0}/{shelter.capacity}
                      </span>
                      <span
                        className={
                          shelter.status === 'cheio' ? 'text-red-600 font-bold' : 'text-emerald-600'
                        }
                      >
                        {shelter.status === 'cheio' ? 'Lotado' : 'Disponível'}
                      </span>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}

        {/* Render Teams Markers */}
        {showTeams &&
          teams.map((team) => {
            if (team.latitude === undefined || team.longitude === undefined) return null
            if (isNaN(team.latitude) || isNaN(team.longitude)) return null

            const icon = getTeamIcon(team)

            return (
              <Marker
                key={team.id}
                position={[team.latitude, team.longitude]}
                icon={icon}
                eventHandlers={{
                  click: () => onSelectItem?.('team', team),
                }}
              >
                <Popup>
                  <div className="p-1 min-w-[190px]">
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                      <Users className="w-4 h-4 text-purple-600" />
                      <span>{team.name}</span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1 space-y-1">
                      <p>Líder: {team.leader_name || 'Não informado'}</p>
                      <div className="flex items-center justify-between pt-1 text-[11px] font-semibold">
                        <span className="capitalize">
                          {team.type} ({team.member_count} membros)
                        </span>
                        <span className="capitalize text-purple-700">
                          {team.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </Popup>
              </Marker>
            )
          })}

        {/* Render Strategic Infrastructures (Pontes e Aduelas com coordenadas válidas) */}
        {showInfrastructures &&
          strategicInfrastructures.map((infra) => {
            if (
              infra.latitude === undefined ||
              infra.longitude === undefined ||
              infra.latitude === null ||
              infra.longitude === null ||
              isNaN(infra.latitude) ||
              isNaN(infra.longitude)
            ) {
              return null
            }

            const isValidated = infra.validation_status === 'conferido'
            const isNeedInspection = infra.needs_inspection
            const bgColor = isNeedInspection ? '#ea580c' : isValidated ? '#059669' : '#ca8a04'

            const customIcon = createDivIcon(
              `<div style="
                background-color: ${bgColor};
                width: 26px;
                height: 26px;
                border-radius: 6px;
                border: 2px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-weight: bold;
                font-size: 10px;
              ">${infra.structure_type === 'aduela' ? 'AD' : 'PT'}</div>`,
              'infra-marker',
              [26, 26],
              [13, 13],
            )

            return (
              <Marker
                key={infra.id}
                position={[infra.latitude, infra.longitude]}
                icon={customIcon}
                eventHandlers={{
                  click: () => onSelectItem?.('infrastructure', infra),
                }}
              >
                <Popup>
                  <div className="p-1 min-w-[200px] text-xs space-y-1">
                    <div className="flex items-center justify-between border-b pb-1 font-bold">
                      <span className="text-slate-900">
                        {infra.original_code} ({infra.structure_type?.toUpperCase() || 'ESTRUTURA'})
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] ${
                          isValidated
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {infra.validation_status}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      <strong>Bairro:</strong> {infra.neighborhood || 'Não informado'}
                    </p>
                    {infra.reference_point && (
                      <p className="text-slate-600">
                        <strong>Ref:</strong> {infra.reference_point}
                      </p>
                    )}
                    {infra.structural_condition && (
                      <p className="text-slate-600">
                        <strong>Condição:</strong> {infra.structural_condition}
                      </p>
                    )}
                    {infra.problems_reported && (
                      <p className="text-amber-800 bg-amber-50 p-1 rounded border border-amber-200">
                        <strong>Problema:</strong> {infra.problems_reported}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          })}

        {/* Camada 1: Setores de Risco — IPT (Polígonos independentes com identificação por clique e filtros) */}
        {showRiskSectorsGeo && (
          <>
            {/* 1.1: Polígonos vinculados diretamente na tabela risk_sectors */}
            {geoRiskSectors
              .filter((sector) => typeFilter === 'all' || typeFilter === 'setor')
              .filter((sector) => {
                if (riskFilter === 'all') return true
                const lvl = (sector.risk_level || sector.danger_grade || '').toUpperCase()
                return lvl.includes(riskFilter)
              })
              .filter((sector) => {
                if (localityFilter === 'all') return true
                const loc = `${sector.location || ''} ${sector.area_name || ''}`.toLowerCase()
                return loc.includes(localityFilter.toLowerCase())
              })
              .map((sector) => {
                if (!sector.geometry_geojson) return null
                try {
                  const geom = JSON.parse(sector.geometry_geojson)
                  let positions: any = []
                  if (geom.type === 'Polygon') {
                    positions = geom.coordinates.map((ring: any[]) =>
                      ring.map((pt: any[]) => [pt[1], pt[0]]),
                    )
                  } else if (geom.type === 'MultiPolygon') {
                    positions = geom.coordinates.map((poly: any[]) =>
                      poly.map((ring: any[]) => ring.map((pt: any[]) => [pt[1], pt[0]])),
                    )
                  } else {
                    return null
                  }

                  const rLevel = sector.risk_level || sector.danger_grade || 'R2'
                  const isR4 = rLevel.includes('R4') || rLevel.includes('P4')
                  const isR3 = rLevel.includes('R3') || rLevel.includes('P3')
                  const isR1 = rLevel.includes('R1') || rLevel.includes('P1')
                  const color = isR4 ? '#b91c1c' : isR3 ? '#ea580c' : isR1 ? '#059669' : '#d97706'
                  const fillColor = isR4
                    ? '#ef4444'
                    : isR3
                      ? '#f97316'
                      : isR1
                        ? '#10b981'
                        : '#f59e0b'

                  return (
                    <Polygon
                      key={`rs-${sector.id}`}
                      positions={positions}
                      pathOptions={{
                        color,
                        fillColor,
                        fillOpacity: 0.45,
                        weight: 2,
                      }}
                      eventHandlers={{
                        click: (e) => {
                          L.DomEvent.stopPropagation(e)
                          handleSectorClick(sector)
                        },
                      }}
                    >
                      <Popup>
                        <div className="p-1 min-w-[240px] text-xs space-y-1.5">
                          <div className="flex items-center justify-between border-b pb-1 font-bold">
                            <span className="text-slate-900">
                              {sector.code || sector.area_name}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] text-white font-bold bg-slate-800">
                              {rLevel}
                            </span>
                          </div>
                          <p className="text-slate-600">
                            <strong>Localidade:</strong>{' '}
                            {sector.location || sector.area_name || '-'}
                          </p>
                          <p className="text-slate-600">
                            <strong>Processo:</strong>{' '}
                            {sector.process_type || 'Escorregamento / Risco Geológico'}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            <strong>Fonte:</strong>{' '}
                            {sector.import_source || 'IPT · Síntese 29/11/2024'}
                          </p>
                          <div className="pt-1 border-t flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleSectorClick(sector)}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-[11px] font-semibold hover:bg-blue-700 w-full"
                            >
                              Abrir Ficha do Setor
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </Polygon>
                  )
                } catch {
                  return null
                }
              })}

            {/* 1.2: Polígonos de geo_layers (camada Setores de Risco — IPT / setores_risco) */}
            {loadedGeoLayers
              .filter(
                (l) =>
                  l.layer_type === 'setores_risco' || l.layer_name === 'Setores de Risco — IPT',
              )
              .filter((l) => typeFilter === 'all' || typeFilter === 'setor')
              .filter((l) => {
                if (riskFilter === 'all') return true
                const lvl = (l.risk_level || l.grade || '').toUpperCase()
                return lvl.includes(riskFilter)
              })
              .filter((l) => {
                if (localityFilter === 'all') return true
                const loc = `${l.locality || ''} ${l.name || ''}`.toLowerCase()
                return loc.includes(localityFilter.toLowerCase())
              })
              .map((layer) => {
                if (!layer.geometry_geojson) return null
                try {
                  const geom = JSON.parse(layer.geometry_geojson)
                  let positions: any = []
                  if (geom.type === 'Polygon') {
                    positions = geom.coordinates.map((ring: any[]) =>
                      ring.map((pt: any[]) => [pt[1], pt[0]]),
                    )
                  } else if (geom.type === 'MultiPolygon') {
                    positions = geom.coordinates.map((poly: any[]) =>
                      poly.map((ring: any[]) => ring.map((pt: any[]) => [pt[1], pt[0]])),
                    )
                  } else {
                    return null
                  }

                  const rLevel = layer.risk_level || 'R2'
                  const color =
                    rLevel === 'R4'
                      ? '#b91c1c'
                      : rLevel === 'R3'
                        ? '#ea580c'
                        : rLevel === 'R1'
                          ? '#059669'
                          : '#d97706'
                  const fillColor =
                    rLevel === 'R4'
                      ? '#ef4444'
                      : rLevel === 'R3'
                        ? '#f97316'
                        : rLevel === 'R1'
                          ? '#10b981'
                          : '#f59e0b'

                  return (
                    <Polygon
                      key={`gl-sector-${layer.id}`}
                      positions={positions}
                      pathOptions={{
                        color,
                        fillColor,
                        fillOpacity: 0.45,
                        weight: 2,
                      }}
                      eventHandlers={{
                        click: (e) => {
                          L.DomEvent.stopPropagation(e)
                          handleSectorClick(layer)
                        },
                      }}
                    >
                      <Popup>
                        <div className="p-1 min-w-[240px] text-xs space-y-1.5">
                          <div className="flex items-center justify-between border-b pb-1 font-bold">
                            <span className="text-slate-900">{layer.name || layer.code}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] text-white font-bold bg-slate-800">
                              {rLevel}
                            </span>
                          </div>
                          <p className="text-slate-600">
                            <strong>Código:</strong> {layer.code || '-'}
                          </p>
                          <p className="text-slate-600">
                            <strong>Processo:</strong> {layer.process_type || 'Setor de Risco IPT'}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            <strong>Fonte:</strong>{' '}
                            {layer.source_file || 'IPT · Síntese 29/11/2024'}
                          </p>
                          <div className="pt-1 border-t flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleSectorClick(layer)}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-[11px] font-semibold hover:bg-blue-700 w-full"
                            >
                              Abrir Ficha do Setor
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </Polygon>
                  )
                } catch {
                  return null
                }
              })}
          </>
        )}

        {/* Camada 2: Trechos de Enxurrada — IPT (Linhas, kind=trecho / process=ENX com filtros e clique) */}
        {showDangerStretchesGeo && (
          <>
            {/* 2.1: Linhas vinculadas diretamente na tabela danger_stretches */}
            {geoDangerStretches
              .filter((stretch) => typeFilter === 'all' || typeFilter === 'trecho')
              .filter((stretch) => {
                if (riskFilter === 'all') return true
                const lvl = (stretch.risk_level || stretch.danger_grade || '').toUpperCase()
                return lvl.includes(riskFilter)
              })
              .filter((stretch) => {
                if (localityFilter === 'all') return true
                const loc = `${stretch.location || ''} ${stretch.area_name || ''}`.toLowerCase()
                return loc.includes(localityFilter.toLowerCase())
              })
              .map((stretch) => {
                if (!stretch.geometry_geojson) return null
                try {
                  const geom = JSON.parse(stretch.geometry_geojson)
                  let positions: any = []
                  if (geom.type === 'LineString') {
                    positions = geom.coordinates.map((pt: any[]) => [pt[1], pt[0]])
                  } else if (geom.type === 'MultiLineString') {
                    positions = geom.coordinates.map((line: any[]) =>
                      line.map((pt: any[]) => [pt[1], pt[0]]),
                    )
                  } else {
                    return null
                  }

                  const rLevel = stretch.risk_level || stretch.danger_grade || 'P1'
                  const color = rLevel.includes('4')
                    ? '#dc2626'
                    : rLevel.includes('3')
                      ? '#ea580c'
                      : rLevel.includes('2')
                        ? '#d97706'
                        : '#2563eb'

                  return (
                    <Polyline
                      key={`ds-${stretch.id}`}
                      positions={positions}
                      pathOptions={{
                        color,
                        weight: 4,
                        opacity: 0.85,
                      }}
                      eventHandlers={{
                        click: (e) => {
                          L.DomEvent.stopPropagation(e)
                          handleStretchClick(stretch)
                        },
                      }}
                    >
                      <Popup>
                        <div className="p-1 min-w-[240px] text-xs space-y-1.5">
                          <div className="flex items-center justify-between border-b pb-1 font-bold">
                            <span className="text-slate-900">{stretch.code}</span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] text-white font-bold bg-blue-700">
                              {rLevel}
                            </span>
                          </div>
                          <p className="text-slate-600">
                            <strong>Localidade:</strong>{' '}
                            {stretch.location || stretch.area_name || '-'}
                          </p>
                          <p className="text-slate-600">
                            <strong>Processo:</strong> {stretch.process_type || 'Enxurrada (ENX)'}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            <strong>Fonte:</strong>{' '}
                            {stretch.import_source ||
                              'IPT · Trechos_perigo.gpkg + síntese 29/11/2024'}
                          </p>
                          <div className="pt-1 border-t flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleStretchClick(stretch)}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-[11px] font-semibold hover:bg-blue-700 w-full"
                            >
                              Abrir Ficha do Trecho
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </Polyline>
                  )
                } catch {
                  return null
                }
              })}

            {/* 2.2: Linhas de geo_layers (camada Trechos de Enxurrada — IPT / trechos_perigo) */}
            {loadedGeoLayers
              .filter(
                (l) =>
                  l.layer_type === 'trechos_perigo' ||
                  l.layer_name === 'Trechos de Enxurrada — IPT',
              )
              .filter((l) => typeFilter === 'all' || typeFilter === 'trecho')
              .filter((l) => {
                if (riskFilter === 'all') return true
                const lvl = (l.risk_level || l.grade || '').toUpperCase()
                return lvl.includes(riskFilter)
              })
              .filter((l) => {
                if (localityFilter === 'all') return true
                const loc = `${l.locality || ''} ${l.name || ''}`.toLowerCase()
                return loc.includes(localityFilter.toLowerCase())
              })
              .map((layer) => {
                if (!layer.geometry_geojson) return null
                try {
                  const geom = JSON.parse(layer.geometry_geojson)
                  let positions: any = []
                  if (geom.type === 'LineString') {
                    positions = geom.coordinates.map((pt: any[]) => [pt[1], pt[0]])
                  } else if (geom.type === 'MultiLineString') {
                    positions = geom.coordinates.map((line: any[]) =>
                      line.map((pt: any[]) => [pt[1], pt[0]]),
                    )
                  } else {
                    return null
                  }

                  const rLevel = layer.risk_level || 'P1'
                  const color = rLevel.includes('4')
                    ? '#dc2626'
                    : rLevel.includes('3')
                      ? '#ea580c'
                      : '#2563eb'

                  return (
                    <Polyline
                      key={`gl-stretch-${layer.id}`}
                      positions={positions}
                      pathOptions={{
                        color,
                        weight: 4,
                        opacity: 0.85,
                      }}
                      eventHandlers={{
                        click: (e) => {
                          L.DomEvent.stopPropagation(e)
                          handleStretchClick(layer)
                        },
                      }}
                    >
                      <Popup>
                        <div className="p-1 min-w-[240px] text-xs space-y-1.5">
                          <div className="flex items-center justify-between border-b pb-1 font-bold">
                            <span className="text-slate-900">{layer.name || layer.code}</span>
                            <span className="text-blue-700 font-bold">{rLevel}</span>
                          </div>
                          <p className="text-slate-600">
                            <strong>Trecho:</strong> {layer.code}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            <strong>Fonte:</strong>{' '}
                            {layer.source_file || 'IPT · Trechos_perigo.gpkg + síntese 29/11/2024'}
                          </p>
                          <div className="pt-1 border-t flex justify-end">
                            <button
                              type="button"
                              onClick={() => handleStretchClick(layer)}
                              className="px-2 py-1 bg-blue-600 text-white rounded text-[11px] font-semibold hover:bg-blue-700 w-full"
                            >
                              Abrir Ficha do Trecho
                            </button>
                          </div>
                        </div>
                      </Popup>
                    </Polyline>
                  )
                } catch {
                  return null
                }
              })}
          </>
        )}

        {/* Render Áreas de Inundação Oficial */}
        {showInundationGeo &&
          loadedGeoLayers
            .filter((l) => l.layer_type === 'areas_inundacao')
            .map((layer) => {
              if (!layer.geometry_geojson) return null
              try {
                const geom = JSON.parse(layer.geometry_geojson)
                let positions: any = []
                if (geom.type === 'Polygon') {
                  positions = geom.coordinates.map((ring: any[]) =>
                    ring.map((pt: any[]) => [pt[1], pt[0]]),
                  )
                } else if (geom.type === 'MultiPolygon') {
                  positions = geom.coordinates.map((poly: any[]) =>
                    poly.map((ring: any[]) => ring.map((pt: any[]) => [pt[1], pt[0]])),
                  )
                } else {
                  return null
                }

                return (
                  <Polygon
                    key={layer.id}
                    positions={positions}
                    pathOptions={{
                      color: '#0284c7',
                      fillColor: '#38bdf8',
                      fillOpacity: 0.5,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="p-1 min-w-[200px] text-xs space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-sky-900 border-b pb-1">
                          <span>Área de Inundação: {layer.name}</span>
                        </div>
                        <p className="text-slate-600">Risco hídrico mapeado em Ibiúna</p>
                        <p className="text-[10px] text-slate-500">Fonte: {layer.source_file}</p>
                      </div>
                    </Popup>
                  </Polygon>
                )
              } catch (_) {
                return null
              }
            })}

        {/* Render Hidrografia Principal */}
        {showHydroGeo &&
          loadedGeoLayers
            .filter((l) => l.layer_type === 'hidro_principal')
            .map((layer) => {
              if (!layer.geometry_geojson) return null
              try {
                const geom = JSON.parse(layer.geometry_geojson)
                let positions: any = []
                if (geom.type === 'LineString') {
                  positions = geom.coordinates.map((pt: any[]) => [pt[1], pt[0]])
                } else if (geom.type === 'MultiLineString') {
                  positions = geom.coordinates.map((line: any[]) =>
                    line.map((pt: any[]) => [pt[1], pt[0]]),
                  )
                } else {
                  return null
                }

                return (
                  <Polyline
                    key={layer.id}
                    positions={positions}
                    pathOptions={{
                      color: '#2563eb',
                      weight: 2.5,
                      opacity: 0.75,
                    }}
                  >
                    <Popup>
                      <div className="p-1 text-xs">
                        <strong>Hidrografia:</strong> {layer.name || 'Rio/Córrego'}
                      </div>
                    </Popup>
                  </Polyline>
                )
              } catch (_) {
                return null
              }
            })}

        {/* Render Curvas de Nível (Topografia com Zoom >= 14) */}
        {showContoursGeo &&
          loadedGeoLayers
            .filter((l) => l.layer_type === 'curva_nivel')
            .slice(0, 300)
            .map((layer) => {
              if (!layer.geometry_geojson) return null
              try {
                const geom = JSON.parse(layer.geometry_geojson)
                if (geom.type !== 'LineString' && geom.type !== 'MultiLineString') return null
                const positions =
                  geom.type === 'LineString'
                    ? geom.coordinates.map((pt: any[]) => [pt[1], pt[0]])
                    : geom.coordinates.map((line: any[]) => line.map((pt: any[]) => [pt[1], pt[0]]))

                return (
                  <Polyline
                    key={layer.id}
                    positions={positions}
                    pathOptions={{
                      color: '#a8a29e',
                      weight: 1,
                      opacity: 0.6,
                    }}
                  />
                )
              } catch (_) {
                return null
              }
            })}

        {/* Render Interactively Picked Pin Marker */}
        {pickedCoordinate &&
          pickedCoordinate.lat !== undefined &&
          pickedCoordinate.lng !== undefined && (
            <Marker
              position={[pickedCoordinate.lat, pickedCoordinate.lng]}
              icon={getPickedPinIcon()}
            />
          )}
      </MapContainer>

      {/* Floating Layer Filter Chips */}
      {showLayerToggles && (
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 z-[400] pointer-events-auto">
          <div className="flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-lg border border-slate-300 shadow-md">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowOccurrences(!showOccurrences)}
              className={`h-7 px-2 text-xs font-semibold rounded-md transition-all ${
                showOccurrences
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <AlertOctagon className="w-3.5 h-3.5 mr-1 text-red-600" />
              Ocorrências ({occurrences.length})
            </Button>

            {/* Camada 1: Pontes e Aduelas — Levantamento Municipal (pontos) */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowInfrastructures(!showInfrastructures)}
              className={`h-7 px-2 text-xs font-semibold rounded-md transition-all ${
                showInfrastructures
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Pontes e Aduelas — Levantamento Municipal (camada independente)"
            >
              <Building2 className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              Pontes e Aduelas — Levantamento Municipal (
              {strategicInfrastructures.filter((i) => i.latitude && i.longitude).length})
            </Button>

            {/* Camada 2: Setores de Risco — IPT (Polígonos) */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowRiskSectorsGeo(!showRiskSectorsGeo)}
              className={`h-7 px-2 text-xs font-semibold rounded-md transition-all ${
                showRiskSectorsGeo
                  ? 'bg-orange-100 text-orange-800 border border-orange-300'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Setores de Risco — IPT (Polígonos independentes)"
            >
              <Layers className="w-3.5 h-3.5 mr-1 text-orange-600" />
              Setores de Risco — IPT (
              {geoRiskSectors.length > 0
                ? geoRiskSectors.length
                : loadedGeoLayers.filter(
                    (l) =>
                      l.layer_type === 'setores_risco' ||
                      l.layer_name === 'Setores de Risco — IPT' ||
                      l.layer_type === 'areas_avaliacao_risco',
                  ).length}
              )
            </Button>

            {/* Camada 3: Trechos de Enxurrada — IPT (Linhas, kind=trecho / process=ENX) */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowDangerStretchesGeo(!showDangerStretchesGeo)}
              className={`h-7 px-2 text-xs font-semibold rounded-md transition-all ${
                showDangerStretchesGeo
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
              title="Trechos de Enxurrada — IPT (Linhas, process=ENX)"
            >
              <Navigation className="w-3.5 h-3.5 mr-1 text-blue-600" />
              Trechos de Enxurrada — IPT (
              {geoDangerStretches.length > 0
                ? geoDangerStretches.length
                : loadedGeoLayers.filter(
                    (l) =>
                      l.layer_type === 'trechos_perigo' ||
                      l.layer_name === 'Trechos de Enxurrada — IPT',
                  ).length}
              )
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowAreas(!showAreas)}
              className={`h-7 px-2 text-xs font-semibold rounded-md transition-all ${
                showAreas
                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5 mr-1 text-amber-600" />
              Áreas ({areas.length})
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowShelters(!showShelters)}
              className={`h-7 px-2 text-xs font-semibold rounded-md transition-all ${
                showShelters
                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 mr-1 text-blue-600" />
              Abrigos ({shelters.length})
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowTeams(!showTeams)}
              className={`h-7 px-2 text-xs font-semibold rounded-md transition-all ${
                showTeams
                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 mr-1 text-purple-600" />
              Equipes ({teams.length})
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowInundationGeo(!showInundationGeo)}
              className={`h-7 px-2 text-xs font-semibold rounded-md transition-all ${
                showInundationGeo
                  ? 'bg-sky-100 text-sky-800 border border-sky-300'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Inundação ({loadedGeoLayers.filter((l) => l.layer_type === 'areas_inundacao').length})
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowHydroGeo(!showHydroGeo)}
              className={`h-7 px-2 text-xs font-semibold rounded-md transition-all ${
                showHydroGeo
                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Hidrografia (
              {loadedGeoLayers.filter((l) => l.layer_type === 'hidro_principal').length})
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowContoursGeo(!showContoursGeo)}
              className={`h-7 px-2 text-xs font-semibold rounded-md transition-all ${
                showContoursGeo
                  ? 'bg-stone-200 text-stone-800 border border-stone-400'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Curvas de Nível
            </Button>
          </div>

          {/* Filtros Integrados IPT: Tipo (Setor/Trecho), Localidade e Grau de Risco */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white/95 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-300 shadow-md text-xs">
            {/* Tipo */}
            <div className="flex items-center gap-1 mr-1">
              <span className="font-semibold text-slate-600 text-[11px]">Tipo:</span>
              <button
                type="button"
                onClick={() => setTypeFilter('all')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  typeFilter === 'all'
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('setor')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  typeFilter === 'setor'
                    ? 'bg-orange-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Setores
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('trecho')}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-all ${
                  typeFilter === 'trecho'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Trechos
              </button>
            </div>

            {/* Filtro R1-R4 / P1-P4 */}
            <div className="flex items-center gap-1 mr-1 border-l border-slate-200 pl-1.5">
              <span className="font-semibold text-slate-600 text-[11px]">Grau:</span>
              {(['all', 'R4', 'R3', 'R2', 'R1'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRiskFilter(r)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                    riskFilter === r
                      ? r === 'R4'
                        ? 'bg-red-600 text-white'
                        : r === 'R3'
                          ? 'bg-orange-500 text-white'
                          : r === 'R2'
                            ? 'bg-amber-500 text-white'
                            : r === 'R1'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {r === 'all' ? 'Todos' : r}
                </button>
              ))}
            </div>

            {/* Localidade (select compacto) */}
            {availableLocalities.length > 0 && (
              <div className="flex items-center gap-1 border-l border-slate-200 pl-1.5">
                <span className="font-semibold text-slate-600 text-[11px]">Localidade:</span>
                <select
                  value={localityFilter}
                  onChange={(e) => setLocalityFilter(e.target.value)}
                  className="text-[11px] bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 max-w-[130px] truncate text-slate-700"
                >
                  <option value="all">Todas ({availableLocalities.length})</option>
                  {availableLocalities.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legenda Oficial Completa de Camadas */}
      <div className="absolute bottom-2 right-2 hidden sm:flex items-center gap-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-md border border-slate-300 text-[10px] text-slate-700 shadow-md z-[400] font-medium">
        <span className="flex items-center gap-1 font-bold text-slate-900 mr-1">Legenda:</span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-emerald-600 border border-white shadow-xs" />{' '}
          Pontes & Aduelas
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded bg-orange-500 border border-white shadow-xs" />{' '}
          Setores IPT (Polígonos)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-1 bg-blue-600 rounded-sm" /> Trechos ENX IPT (Linhas)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-600" /> R4/P4 Muito Alto
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> R3/P3 Alto
        </span>
        {(riskSectorsCount > 0 || dangerStretchesCount > 0) && (
          <span className="flex items-center gap-1 text-slate-500 border-l border-slate-200 pl-2">
            <span className="w-2 h-2 rounded-full border border-dashed border-slate-400" />
            {riskSectorsCount + dangerStretchesCount} setores/trechos cadastrados
          </span>
        )}
      </div>

      {/* Helper hint for interactive pick or drawing */}
      {(interactivePick || allowDrawingPolygon) && (
        <div className="absolute bottom-2 left-2 z-[400] bg-slate-900/90 text-white text-[11px] px-2.5 py-1 rounded-md shadow pointer-events-none flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-red-400" />
          <span>
            {allowDrawingPolygon
              ? 'Clique no mapa para adicionar os pontos do polígono de risco'
              : 'Clique no mapa para posicionar as coordenadas'}
          </span>
        </div>
      )}
    </div>
  )
}
