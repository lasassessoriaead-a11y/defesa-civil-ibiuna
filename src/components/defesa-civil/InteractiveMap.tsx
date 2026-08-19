import React, { useState, useEffect } from 'react'
import {
  MapPin,
  Layers,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Navigation,
  Eye,
  EyeOff,
  AlertOctagon,
  Building2,
  Users,
  Radio,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Occurrence, Shelter, Team, AffectedArea } from '@/types/defesa-civil'
import { SeverityBadge, getHazardIcon } from './StatusBadges'

interface InteractiveMapProps {
  height?: string
  occurrences?: Occurrence[]
  shelters?: Shelter[]
  teams?: Team[]
  areas?: AffectedArea[]
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
}

// Default bounding box for visual mock map centered around standard municipal coordinates (-23.55, -46.63)
const DEFAULT_CENTER = { lat: -23.5505, lng: -46.6333 }
const LAT_RANGE = 0.08
const LNG_RANGE = 0.12

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  height = '380px',
  occurrences = [],
  shelters = [],
  teams = [],
  areas = [],
  selectedItem,
  onSelectItem,
  interactivePick = false,
  onPickCoordinate,
  pickedCoordinate,
  center = [-23.5505, -46.6333],
  allowDrawingPolygon = false,
  polygonPoints = [],
  onPolygonChange,
}) => {
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({
    lat: center[0],
    lng: center[1],
  })

  // Layer toggles
  const [showOccurrences, setShowOccurrences] = useState(true)
  const [showAreas, setShowAreas] = useState(true)
  const [showShelters, setShowShelters] = useState(true)
  const [showTeams, setShowTeams] = useState(true)
  const [activePopup, setActivePopup] = useState<{ type: string; item: any } | null>(null)

  useEffect(() => {
    if (center) {
      setMapCenter({ lat: center[0], lng: center[1] })
    }
  }, [center[0], center[1]])

  // Convert lat/lng to percentage in container
  const toMapPos = (lat: number, lng: number) => {
    const latSpan = LAT_RANGE / zoomLevel
    const lngSpan = LNG_RANGE / zoomLevel
    const minLat = mapCenter.lat - latSpan / 2
    const maxLat = mapCenter.lat + latSpan / 2
    const minLng = mapCenter.lng - lngSpan / 2
    const maxLng = mapCenter.lng + lngSpan / 2

    const x = ((lng - minLng) / (maxLng - minLng)) * 100
    const y = ((maxLat - lat) / (maxLat - minLat)) * 100 // inverted y
    return { x, y }
  }

  // Convert click on map container to lat/lng
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = (e.clientX - rect.left) / rect.width // 0 to 1
    const clickY = (e.clientY - rect.top) / rect.height // 0 to 1

    const latSpan = LAT_RANGE / zoomLevel
    const lngSpan = LNG_RANGE / zoomLevel
    const minLat = mapCenter.lat - latSpan / 2
    const maxLat = mapCenter.lat + latSpan / 2
    const minLng = mapCenter.lng - lngSpan / 2
    const maxLng = mapCenter.lng + lngSpan / 2

    const clickedLng = Number((minLng + clickX * (maxLng - minLng)).toFixed(5))
    const clickedLat = Number((maxLat - clickY * (maxLat - minLat)).toFixed(5))

    if (allowDrawingPolygon && onPolygonChange) {
      onPolygonChange([...polygonPoints, [clickedLat, clickedLng]])
      return
    }

    if (interactivePick && onPickCoordinate) {
      onPickCoordinate(clickedLat, clickedLng)
    }
  }

  // Color mapping by severity/risk
  const getSeverityBg = (sev: string) => {
    switch (sev) {
      case 'critica':
      case 'critico':
      case 'perigo_extremo':
        return 'bg-red-600 border-red-200 text-white animate-pulse'
      case 'alta':
      case 'alto':
      case 'perigo':
        return 'bg-orange-500 border-orange-200 text-white'
      case 'media':
      case 'medio':
      case 'alerta':
        return 'bg-amber-500 border-amber-200 text-white'
      default:
        return 'bg-emerald-600 border-emerald-200 text-white'
    }
  }

  const getAreaColor = (risk: string) => {
    switch (risk) {
      case 'critico':
        return { fill: 'rgba(220, 38, 38, 0.35)', stroke: '#dc2626' }
      case 'alto':
        return { fill: 'rgba(234, 88, 12, 0.35)', stroke: '#ea580c' }
      case 'medio':
        return { fill: 'rgba(217, 119, 6, 0.35)', stroke: '#d97706' }
      default:
        return { fill: 'rgba(5, 150, 105, 0.35)', stroke: '#059669' }
    }
  }

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-slate-200/80 shadow-inner bg-slate-900 select-none group"
      style={{ height }}
    >
      {/* Map Graphic Layer (Realistic SVG grid + styled topographic vectors) */}
      <div className="absolute inset-0 cursor-crosshair overflow-hidden" onClick={handleMapClick}>
        {/* Dark Carto/Satellite Hybrid Base Layer */}
        <div className="absolute inset-0 bg-[#0f172a] bg-gradient-to-tr from-[#090d16] via-[#0f172a] to-[#1e293b]" />

        {/* Dynamic coordinate grid */}
        <svg
          className="absolute inset-0 w-full h-full opacity-25"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="0.75"
                strokeDasharray="3 3"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-pattern)" />
        </svg>

        {/* River Waterway SVG representation for realistic topography */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-40"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            d="M 10,20 Q 30,35 45,50 T 80,75 T 95,90"
            fill="none"
            stroke="#0284c7"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <path
            d="M 5,60 Q 25,65 45,50 T 70,30"
            fill="none"
            stroke="#0369a1"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Topographic Contour lines */}
          <path
            d="M 60,10 Q 75,25 90,15"
            fill="none"
            stroke="#475569"
            strokeWidth="0.8"
            strokeDasharray="2 2"
          />
          <path
            d="M 55,18 Q 75,32 95,20"
            fill="none"
            stroke="#475569"
            strokeWidth="0.8"
            strokeDasharray="2 2"
          />
        </svg>

        {/* Render Polygons for Affected Areas */}
        {showAreas && (
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {areas.map((area) => {
              if (!area.area_polygon) return null
              try {
                const pts: [number, number][] = JSON.parse(area.area_polygon)
                if (!Array.isArray(pts) || pts.length < 3) return null
                const svgPts = pts
                  .map(([pLat, pLng]) => {
                    const { x, y } = toMapPos(pLat, pLng)
                    return `${x},${y}`
                  })
                  .join(' ')

                const colors = getAreaColor(area.risk_level)

                return (
                  <g
                    key={area.id}
                    className="pointer-events-auto cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      setActivePopup({ type: 'area', item: area })
                      onSelectItem?.('area', area)
                    }}
                  >
                    <polygon
                      points={svgPts}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth="1.5"
                      strokeDasharray={area.status === 'interditado' ? '4 2' : undefined}
                      className="transition-all hover:opacity-90 duration-200"
                    />
                  </g>
                )
              } catch (_) {
                return null
              }
            })}

            {/* Currently drawing polygon preview */}
            {allowDrawingPolygon && polygonPoints.length > 0 && (
              <polyline
                points={polygonPoints
                  .map(([pLat, pLng]) => {
                    const { x, y } = toMapPos(pLat, pLng)
                    return `${x},${y}`
                  })
                  .join(' ')}
                fill="rgba(59, 130, 246, 0.2)"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeDasharray="3 3"
              />
            )}
          </svg>
        )}

        {/* Map Markers: Occurrences */}
        {showOccurrences &&
          occurrences.map((occ) => {
            if (occ.latitude === undefined || occ.longitude === undefined) return null
            const { x, y } = toMapPos(occ.latitude, occ.longitude)
            if (x < -5 || x > 105 || y < -5 || y > 105) return null

            const isSelected = selectedItem?.type === 'occurrence' && selectedItem?.id === occ.id

            return (
              <div
                key={occ.id}
                style={{ left: `${x}%`, top: `${y}%` }}
                onClick={(e) => {
                  e.stopPropagation()
                  setActivePopup({ type: 'occurrence', item: occ })
                  onSelectItem?.('occurrence', occ)
                }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-20 group/marker transition-all duration-300 ${
                  isSelected ? 'scale-125 z-30' : 'hover:scale-115'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white transition-transform ${getSeverityBg(
                    occ.severity,
                  )}`}
                >
                  {getHazardIcon(occ.type, 'w-4 h-4 text-white')}
                </div>
                <div className="absolute top-9 left-1/2 -translate-x-1/2 hidden group-hover/marker:flex bg-slate-900/90 backdrop-blur text-white text-[11px] font-medium px-2 py-0.5 rounded shadow whitespace-nowrap pointer-events-none border border-slate-700">
                  {occ.title.length > 24 ? occ.title.slice(0, 24) + '...' : occ.title}
                </div>
              </div>
            )
          })}

        {/* Map Markers: Shelters */}
        {showShelters &&
          shelters.map((shelter) => {
            if (shelter.latitude === undefined || shelter.longitude === undefined) return null
            const { x, y } = toMapPos(shelter.latitude, shelter.longitude)
            if (x < -5 || x > 105 || y < -5 || y > 105) return null

            const isFull =
              shelter.status === 'cheio' || (shelter.occupancy || 0) >= shelter.capacity

            return (
              <div
                key={shelter.id}
                style={{ left: `${x}%`, top: `${y}%` }}
                onClick={(e) => {
                  e.stopPropagation()
                  setActivePopup({ type: 'shelter', item: shelter })
                  onSelectItem?.('shelter', shelter)
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-15 hover:scale-115 transition-transform"
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shadow-md border-2 border-white ${
                    isFull ? 'bg-red-700 text-white' : 'bg-blue-600 text-white'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
            )
          })}

        {/* Map Markers: Teams */}
        {showTeams &&
          teams.map((team) => {
            if (team.latitude === undefined || team.longitude === undefined) return null
            const { x, y } = toMapPos(team.latitude, team.longitude)
            if (x < -5 || x > 105 || y < -5 || y > 105) return null

            return (
              <div
                key={team.id}
                style={{ left: `${x}%`, top: `${y}%` }}
                onClick={(e) => {
                  e.stopPropagation()
                  setActivePopup({ type: 'team', item: team })
                  onSelectItem?.('team', team)
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer z-15 hover:scale-115 transition-transform"
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center shadow-md border-2 border-white ${
                    team.status === 'em_operacao'
                      ? 'bg-purple-600 text-white animate-pulse'
                      : 'bg-emerald-600 text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                </div>
              </div>
            )
          })}

        {/* Interactively Picked Pin Coordinate */}
        {pickedCoordinate && (
          <div
            style={{
              left: `${toMapPos(pickedCoordinate.lat, pickedCoordinate.lng).x}%`,
              top: `${toMapPos(pickedCoordinate.lat, pickedCoordinate.lng).y}%`,
            }}
            className="absolute -translate-x-1/2 -translate-y-full cursor-pointer z-40 animate-bounce"
          >
            <MapPin className="w-9 h-9 text-red-500 fill-red-500 stroke-white stroke-2 drop-shadow-md" />
          </div>
        )}
      </div>

      {/* Floating Header Controls */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 z-30 pointer-events-none">
        {/* Layer filter chips */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-2 py-1.5 rounded-lg border border-slate-700/80 shadow-md pointer-events-auto">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowOccurrences(!showOccurrences)}
            className={`h-7 px-2 text-xs font-medium rounded-md transition-all ${
              showOccurrences
                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertOctagon className="w-3.5 h-3.5 mr-1 text-red-400" />
            Ocorrências ({occurrences.length})
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowAreas(!showAreas)}
            className={`h-7 px-2 text-xs font-medium rounded-md transition-all ${
              showAreas
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 mr-1 text-amber-400" />
            Áreas de Risco ({areas.length})
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowShelters(!showShelters)}
            className={`h-7 px-2 text-xs font-medium rounded-md transition-all ${
              showShelters
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 mr-1 text-blue-400" />
            Abrigos ({shelters.length})
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowTeams(!showTeams)}
            className={`h-7 px-2 text-xs font-medium rounded-md transition-all ${
              showTeams
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5 mr-1 text-purple-400" />
            Equipes ({teams.length})
          </Button>
        </div>

        {/* Map Zoom Controls */}
        <div className="flex items-center gap-1 bg-slate-900/80 backdrop-blur-md p-1 rounded-lg border border-slate-700/80 shadow-md pointer-events-auto ml-auto">
          <Button
            size="icon"
            variant="ghost"
            className="w-7 h-7 text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => setZoomLevel((z) => Math.min(z + 0.3, 2.5))}
            title="Aproximar Zoom"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="w-7 h-7 text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => setZoomLevel((z) => Math.max(z - 0.3, 0.7))}
            title="Afastar Zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="w-7 h-7 text-slate-300 hover:text-white hover:bg-slate-800"
            onClick={() => {
              setZoomLevel(1)
              setMapCenter(DEFAULT_CENTER)
            }}
            title="Centralizar Município"
          >
            <Navigation className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Floating Interactive Popup on Item Click */}
      {activePopup && (
        <div className="absolute bottom-3 left-3 max-w-sm w-[90%] sm:w-80 bg-white/95 backdrop-blur-md rounded-xl p-3.5 shadow-xl border border-slate-200 z-40 animate-fade-in-up">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {activePopup.type === 'occurrence' && getHazardIcon(activePopup.item.type, 'w-4 h-4')}
              {activePopup.type === 'area' && <Layers className="w-4 h-4 text-amber-600" />}
              {activePopup.type === 'shelter' && <Building2 className="w-4 h-4 text-blue-600" />}
              {activePopup.type === 'team' && <Users className="w-4 h-4 text-purple-600" />}
              <h4 className="font-semibold text-slate-900 text-sm leading-tight truncate">
                {activePopup.item.name || activePopup.item.title}
              </h4>
            </div>
            <button
              onClick={() => setActivePopup(null)}
              className="text-slate-400 hover:text-slate-700 text-xs font-bold px-1"
            >
              ✕
            </button>
          </div>

          <div className="mt-2 text-xs text-slate-600 space-y-1">
            {activePopup.type === 'occurrence' && (
              <>
                <p className="line-clamp-2">
                  {activePopup.item.description || 'Sem descrição detalhada.'}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <SeverityBadge severity={activePopup.item.severity} />
                  <span className="text-[11px] font-medium text-slate-500">
                    {activePopup.item.address}
                  </span>
                </div>
              </>
            )}

            {activePopup.type === 'shelter' && (
              <>
                <p className="text-slate-500">{activePopup.item.address}</p>
                <div className="flex items-center justify-between pt-1 font-medium">
                  <span>
                    Ocupação: {activePopup.item.occupancy || 0}/{activePopup.item.capacity}
                  </span>
                  <Badge variant={activePopup.item.status === 'cheio' ? 'destructive' : 'default'}>
                    {activePopup.item.status === 'cheio' ? 'Lotado' : 'Disponível'}
                  </Badge>
                </div>
              </>
            )}

            {activePopup.type === 'team' && (
              <>
                <p>Líder: {activePopup.item.leader_name || 'Não informado'}</p>
                <div className="flex items-center justify-between pt-1">
                  <Badge variant="outline" className="capitalize">
                    {activePopup.item.type} ({activePopup.item.member_count} membros)
                  </Badge>
                  <span className="capitalize font-semibold text-purple-700">
                    {activePopup.item.status.replace('_', ' ')}
                  </span>
                </div>
              </>
            )}

            {activePopup.type === 'area' && (
              <>
                <p className="line-clamp-2">
                  {activePopup.item.notes || 'Monitoramento preventivo em vigor.'}
                </p>
                <div className="flex items-center justify-between pt-1 font-medium">
                  <span>
                    População: {activePopup.item.affected_population?.toLocaleString('pt-BR')} hab.
                  </span>
                  <Badge className="capitalize">{activePopup.item.risk_level}</Badge>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Mini Legend Footer */}
      <div className="absolute bottom-2 right-3 hidden sm:flex items-center gap-3 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-md border border-slate-700 text-[10px] text-slate-300 pointer-events-none">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" /> Crítico
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-orange-500" /> Alto
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-500" /> Médio
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Baixo
        </span>
      </div>
    </div>
  )
}
