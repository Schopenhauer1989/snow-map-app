import { useCallback, useEffect, useMemo, useState } from 'react'
import L from 'leaflet'
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import 'leaflet-routing-machine'
import 'leaflet/dist/leaflet.css'
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css'
import './App.css'
import { db } from './firebase'

const statusStyles = {
  cleared: {
    color: '#1dd02f',
    label: '通行可能',
  },
  caution: {
    color: '#f59e0b',
    label: '通行注意',
  },
  heavy_snow: {
    color: '#7c3aed',
    label: '積雪多い',
  },
  blocked: {
    color: '#d93939',
    label: '通行止め',
  },
  icy: {
    color: '#0891b2',
    label: '凍結注意',
  },
}

const mapStatusStyles = {
  cleared: statusStyles.cleared,
  caution: statusStyles.caution,
  blocked: statusStyles.blocked,
}

const mapStatusByReportStatus = {
  cleared: 'cleared',
  caution: 'caution',
  icy: 'caution',
  blocked: 'blocked',
  heavy_snow: 'blocked',
}

const targetLabels = {
  car: '車',
  pedestrian: '歩行者',
  both: '車・歩行者',
}

const targetOptions = ['pedestrian', 'car', 'both']

const targetIcons = {
  pedestrian: '人',
  car: '車',
  both: '両',
}

const snowReports = [
  {
    id: 1,
    title: '金沢駅西口 周辺道路',
    area: '金沢市',
    status: 'cleared',
    target: 'both',
    comment: '駅前ロータリーから県道方面まで通行しやすい状態です。',
    lat: 36.5781,
    lng: 136.6478,
    isResolved: true,
    createdAt: '2026-06-13T07:20:00+09:00',
    updatedAt: '2026-06-13T07:20:00+09:00',
  },
  {
    id: 2,
    title: '富山市 呉羽丘陵入口',
    area: '富山市',
    status: 'caution',
    target: 'car',
    comment: '路面に雪が残っており、坂道で滑りやすいです。',
    lat: 36.6995,
    lng: 137.1689,
    isResolved: false,
    createdAt: '2026-06-13T07:45:00+09:00',
    updatedAt: '2026-06-13T07:45:00+09:00',
  },
  {
    id: 3,
    title: '福井市 大和田交差点',
    area: '福井市',
    status: 'blocked',
    target: 'car',
    comment: '生活道路側に雪が残っており、車幅が狭くなっています。',
    lat: 36.0959,
    lng: 136.2478,
    isResolved: false,
    createdAt: '2026-06-13T06:55:00+09:00',
    updatedAt: '2026-06-13T06:55:00+09:00',
  },
  {
    id: 4,
    title: '新潟市 中央区 学校町通',
    area: '新潟市',
    status: 'heavy_snow',
    target: 'pedestrian',
    comment: '歩道と路肩にまとまった積雪があります。徒歩移動は注意が必要です。',
    lat: 37.9161,
    lng: 139.0364,
    isResolved: false,
    createdAt: '2026-06-13T08:05:00+09:00',
    updatedAt: '2026-06-13T08:05:00+09:00',
  },
  {
    id: 5,
    title: '長岡市 宮内駅前',
    area: '長岡市',
    status: 'cleared',
    target: 'both',
    comment: '駅前通りは除雪済みで、バス停周辺も利用しやすい状態です。',
    lat: 37.4243,
    lng: 138.8406,
    isResolved: true,
    createdAt: '2026-06-13T07:10:00+09:00',
    updatedAt: '2026-06-13T07:10:00+09:00',
  },
  {
    id: 6,
    title: '白山市 鶴来支所付近',
    area: '白山市',
    status: 'icy',
    target: 'both',
    comment: '交差点付近にシャーベット状の雪が残っています。',
    lat: 36.4497,
    lng: 136.6266,
    isResolved: false,
    createdAt: '2026-06-13T08:18:00+09:00',
    updatedAt: '2026-06-13T08:18:00+09:00',
  },
]

const formatUpdatedAt = (date) =>
  new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(date))

const formatTokyoIso = (date = new Date()) => {
  const tokyoTime = new Date(date.getTime() + 9 * 60 * 60 * 1000)
  return `${tokyoTime.toISOString().slice(0, 19)}+09:00`
}

const getMapStatus = (status) => mapStatusByReportStatus[status] ?? 'caution'

const createStatusIcon = (
  status,
  { isNavigationMuted = false, isRouteDanger = false } = {},
) => {
  const { color, label } = mapStatusStyles[status]

  return L.divIcon({
    className: [
      'snow-marker',
      isNavigationMuted ? 'is-navigation-muted-marker' : '',
      isRouteDanger ? 'is-route-danger-marker' : '',
    ]
      .filter(Boolean)
      .join(' '),
    html: `<span aria-label="${label}" style="--marker-color: ${color}"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

const selectedPositionIcon = L.divIcon({
  className: 'selected-marker',
  html: '<span aria-label="選択中の投稿地点"></span>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -18],
})

const createNavigationIcon = ({ color, label, text }) =>
  L.divIcon({
    className: 'navigation-marker',
    html: `<span aria-label="${label}" style="--navigation-marker-color: ${color}">${text}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -19],
  })

const reportsCollection = collection(db, 'snowReports')
const reportsQuery = query(reportsCollection, orderBy('updatedAt', 'desc'))

function MapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      })
    },
  })

  return null
}

function NavigationMapClickHandler({ onSelect }) {
  useMapEvents({
    click(event) {
      onSelect({
        lat: event.latlng.lat,
        lng: event.latlng.lng,
      })
    },
  })

  return null
}

const formatPoint = (point) => {
  if (!point) {
    return '未選択'
  }

  return `緯度 ${point.lat.toFixed(5)}、経度 ${point.lng.toFixed(5)}`
}

const formatPlaceSearchResult = (result) => {
  const displayNameParts = (result.display_name ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  const name = result.name || displayNameParts[0] || '名称未設定の候補'
  const description =
    displayNameParts.filter((part) => part !== name).join('、') ||
    [result.type, result.class].filter(Boolean).join(' / ') ||
    '住所情報なし'

  return { description, name }
}

const createMapDestinationDetail = (point) => ({
  description: '地図上で指定した地点',
  lat: point.lat,
  lng: point.lng,
  name: '地図で選択した目的地',
})

const currentLocationErrorMessage =
  '現在地を取得できませんでした。地図をタップして出発地を選択してください。'

const routeErrorMessage =
  'ルートを表示できませんでした。地点を変更して再度お試しください。'

const ROUTE_MODES = {
  pedestrian: {
    label: '歩行者向けルート',
    osrmProfile: 'foot',
  },
  car: {
    label: '車向けルート',
    osrmProfile: 'driving',
  },
}

const OSRM_SERVICE_URL = 'https://router.project-osrm.org/route/v1'
const DANGER_STATUSES = new Set(['caution', 'heavy_snow', 'blocked', 'icy'])
const ROUTE_DANGER_DISTANCE_METERS = 50

const normalizeLatLng = (point) => ({
  lat: point.lat,
  lng: point.lng ?? point.lon,
})

const projectPointToMeters = (point, origin) => {
  const normalizedPoint = normalizeLatLng(point)
  const normalizedOrigin = normalizeLatLng(origin)
  const xDirection = normalizedPoint.lng >= normalizedOrigin.lng ? 1 : -1
  const yDirection = normalizedPoint.lat >= normalizedOrigin.lat ? 1 : -1

  return {
    x:
      L.latLng(normalizedOrigin.lat, normalizedOrigin.lng).distanceTo(
        L.latLng(normalizedOrigin.lat, normalizedPoint.lng),
      ) * xDirection,
    y:
      L.latLng(normalizedOrigin.lat, normalizedOrigin.lng).distanceTo(
        L.latLng(normalizedPoint.lat, normalizedOrigin.lng),
      ) * yDirection,
  }
}

const getPointToSegmentDistanceMeters = (point, segmentStart, segmentEnd) => {
  const projectedPoint = projectPointToMeters(point, segmentStart)
  const projectedStart = { x: 0, y: 0 }
  const projectedEnd = projectPointToMeters(segmentEnd, segmentStart)
  const segmentX = projectedEnd.x - projectedStart.x
  const segmentY = projectedEnd.y - projectedStart.y
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2

  if (segmentLengthSquared === 0) {
    return L.latLng(point.lat, point.lng).distanceTo(
      L.latLng(segmentStart.lat, segmentStart.lng),
    )
  }

  const projectedRatio = Math.max(
    0,
    Math.min(
      1,
      ((projectedPoint.x - projectedStart.x) * segmentX +
        (projectedPoint.y - projectedStart.y) * segmentY) /
        segmentLengthSquared,
    ),
  )
  const closestPoint = {
    x: projectedStart.x + projectedRatio * segmentX,
    y: projectedStart.y + projectedRatio * segmentY,
  }

  return Math.hypot(
    projectedPoint.x - closestPoint.x,
    projectedPoint.y - closestPoint.y,
  )
}

const getPointToRouteDistanceMeters = (point, routeCoordinates) => {
  if (routeCoordinates.length === 0) {
    return Number.POSITIVE_INFINITY
  }

  if (routeCoordinates.length === 1) {
    const routePoint = normalizeLatLng(routeCoordinates[0])
    return L.latLng(point.lat, point.lng).distanceTo(
      L.latLng(routePoint.lat, routePoint.lng),
    )
  }

  return routeCoordinates
    .slice(1)
    .reduce((shortestDistance, coordinate, index) => {
      const segmentStart = normalizeLatLng(routeCoordinates[index])
      const segmentEnd = normalizeLatLng(coordinate)
      const segmentDistance = getPointToSegmentDistanceMeters(
        point,
        segmentStart,
        segmentEnd,
      )

      return Math.min(shortestDistance, segmentDistance)
    }, Number.POSITIVE_INFINITY)
}

const getRouteDangerPosts = (reports, routeCoordinates) =>
  reports.filter(
    (report) =>
      DANGER_STATUSES.has(report.status) &&
      getPointToRouteDistanceMeters(report, routeCoordinates) <=
        ROUTE_DANGER_DISTANCE_METERS,
  )

function RoutingMachine({
  destinationPoint,
  onRouteError,
  onRouteFound,
  routeMode,
  startPoint,
  waypointList,
}) {
  const map = useMap()

  useEffect(() => {
    if (!startPoint || !destinationPoint) {
      return undefined
    }

    const waypoints = [startPoint, ...waypointList, destinationPoint].map(
      (point) => L.latLng(point.lat, point.lng),
    )

    const handleRoutesFound = (event) => {
      onRouteFound(event.routes[0]?.coordinates ?? [])
    }

    const routingControl = L.Routing.control({
      addWaypoints: false,
      createMarker: () => null,
      draggableWaypoints: false,
      fitSelectedRoutes: 'smart',
      lineOptions: {
        styles: [
          { color: '#bfdbfe', opacity: 0.72, weight: 10 },
          { color: '#1d4ed8', opacity: 0.88, weight: 6 },
        ],
      },
      router: L.Routing.osrmv1({
        profile: ROUTE_MODES[routeMode].osrmProfile,
        serviceUrl: OSRM_SERVICE_URL,
        timeout: 15000,
      }),
      routeWhileDragging: false,
      show: false,
      waypoints,
    })
      .on('routesfound', handleRoutesFound)
      .on('routingerror', onRouteError)
      .addTo(map)

    return () => {
      routingControl.off('routesfound', handleRoutesFound)
      routingControl.off('routingerror', onRouteError)
      map.removeControl(routingControl)
    }
  }, [
    destinationPoint,
    map,
    onRouteError,
    onRouteFound,
    routeMode,
    startPoint,
    waypointList,
  ])

  return null
}

function App() {
  const [mode, setMode] = useState('post')
  const [reports, setReports] = useState([])
  const [selectedPosition, setSelectedPosition] = useState(null)
  const [status, setStatus] = useState('caution')
  const [target, setTarget] = useState('car')
  const [title, setTitle] = useState('')
  const [comment, setComment] = useState('')
  const [startPoint, setStartPoint] = useState(null)
  const [destinationPoint, setDestinationPoint] = useState(null)
  const [destinationDetail, setDestinationDetail] = useState(null)
  const [isDestinationDetailVisible, setIsDestinationDetailVisible] =
    useState(true)
  const [waypointList, setWaypointList] = useState([])
  const [selectedNavigationStep, setSelectedNavigationStep] = useState(null)
  const [routeDangerPosts, setRouteDangerPosts] = useState([])
  const [hasCheckedRouteDanger, setHasCheckedRouteDanger] = useState(false)
  const [isNavigationSetupOpen, setIsNavigationSetupOpen] = useState(false)
  const [isNavigationStarted, setIsNavigationStarted] = useState(false)
  const [navigationAlertMessage, setNavigationAlertMessage] = useState('')
  const [placeSearchQuery, setPlaceSearchQuery] = useState('')
  const [placeSearchResults, setPlaceSearchResults] = useState([])
  const [placeSearchMessage, setPlaceSearchMessage] = useState('')
  const [isSearchingPlace, setIsSearchingPlace] = useState(false)
  const [isDestinationSearchOpen, setIsDestinationSearchOpen] =
    useState(false)
  const [placeSearchCache, setPlaceSearchCache] = useState({})
  const [startSearchQuery, setStartSearchQuery] = useState('')
  const [startSearchResults, setStartSearchResults] = useState([])
  const [startSearchMessage, setStartSearchMessage] = useState('')
  const [isStartSearchOpen, setIsStartSearchOpen] = useState(false)
  const [isSearchingStart, setIsSearchingStart] = useState(false)
  const [startSearchCache, setStartSearchCache] = useState({})
  const [routeMode] = useState('pedestrian')
  const [formError, setFormError] = useState('')
  const [dataError, setDataError] = useState('')
  const [loadingReports, setLoadingReports] = useState(true)
  const [editingReportId, setEditingReportId] = useState(null)

  const isPostMode = mode === 'post'
  const isNavigationMode = mode === 'navigation'
  const routeModeLabel = ROUTE_MODES[routeMode].label
  const trimmedTitle = title.trim()
  const trimmedComment = comment.trim()
  const isSubmitDisabled =
    !selectedPosition || !trimmedTitle || !trimmedComment
  const isEditing = editingReportId !== null
  const routeDangerPostIds = useMemo(
    () => new Set(routeDangerPosts.map((report) => report.id)),
    [routeDangerPosts],
  )

  useEffect(() => {
    const seedInitialReports = async () => {
      await Promise.all(
        snowReports.map((report) => {
          const seedId = `seed-${report.id}`
          return setDoc(doc(reportsCollection, seedId), {
            ...report,
            id: seedId,
          })
        }),
      )
    }

    const unsubscribe = onSnapshot(
      reportsQuery,
      (snapshot) => {
        if (snapshot.empty) {
          seedInitialReports().catch((error) => {
            console.error(error)
            setDataError('初期データの保存に失敗しました。')
          })
          setReports([])
          setLoadingReports(false)
          return
        }

        setReports(
          snapshot.docs.map((reportDoc) => ({
            ...reportDoc.data(),
            id: reportDoc.id,
          })),
        )
        setDataError('')
        setLoadingReports(false)
      },
      (error) => {
        console.error(error)
        setDataError('投稿データの読み込みに失敗しました。')
        setLoadingReports(false)
      },
    )

    return unsubscribe
  }, [])

  const resetForm = () => {
    setSelectedPosition(null)
    setStatus('caution')
    setTarget('car')
    setTitle('')
    setComment('')
    setFormError('')
    setEditingReportId(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!selectedPosition) {
      setFormError('地図をクリックして投稿地点を選択してください。')
      return
    }

    if (!trimmedTitle || !trimmedComment) {
      setFormError('タイトルとコメントを入力してください。')
      return
    }

    const now = formatTokyoIso()

    if (isEditing) {
      try {
        await updateDoc(doc(reportsCollection, editingReportId), {
          title: trimmedTitle,
          status,
          target,
          comment: trimmedComment,
          lat: selectedPosition.lat,
          lng: selectedPosition.lng,
          isResolved: status === 'cleared',
          updatedAt: now,
        })
        setDataError('')
        resetForm()
      } catch (error) {
        console.error(error)
        setDataError('投稿の更新に失敗しました。')
      }
      return
    }

    const newReportRef = doc(reportsCollection)
    const newReport = {
      id: newReportRef.id,
      title: trimmedTitle,
      area: '',
      status,
      target,
      comment: trimmedComment,
      lat: selectedPosition.lat,
      lng: selectedPosition.lng,
      isResolved: status === 'cleared',
      createdAt: now,
      updatedAt: now,
    }

    try {
      await setDoc(newReportRef, newReport)
      setDataError('')
      resetForm()
    } catch (error) {
      console.error(error)
      setDataError('投稿の保存に失敗しました。')
    }
  }

  const handleEditReport = (report) => {
    setMode('post')
    setEditingReportId(report.id)
    setStatus(report.status)
    setTarget(report.target)
    setTitle(report.title)
    setComment(report.comment)
    setSelectedPosition({
      lat: report.lat,
      lng: report.lng,
    })
    setFormError('')
  }

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('この投稿を削除しますか？')) {
      return
    }

    try {
      await deleteDoc(doc(reportsCollection, reportId))
      setDataError('')

      if (editingReportId === reportId) {
        resetForm()
      }
    } catch (error) {
      console.error(error)
      setDataError('投稿の削除に失敗しました。')
    }
  }

  const handleToggleMode = () => {
    setMode((currentMode) => {
      if (currentMode === 'navigation') {
        setRouteDangerPosts([])
        setHasCheckedRouteDanger(false)
        setNavigationAlertMessage('')
        setSelectedNavigationStep(null)
        setIsDestinationSearchOpen(false)
        setIsNavigationSetupOpen(false)
        setIsNavigationStarted(false)
        setIsDestinationDetailVisible(false)
        return 'post'
      }

      return 'navigation'
    })
    setFormError('')
  }

  const resetRouteDangerCheck = () => {
    setRouteDangerPosts([])
    setHasCheckedRouteDanger(false)
  }

  const resetStartedNavigation = () => {
    setIsNavigationStarted(false)
    resetRouteDangerCheck()
  }

  const handleOpenNavigationSetup = () => {
    setIsNavigationSetupOpen(true)
    setNavigationAlertMessage('')
  }

  const handleSetStartPoint = (point) => {
    if (isNavigationStarted) {
      resetRouteDangerCheck()
    } else {
      resetStartedNavigation()
    }

    setStartPoint(point)
    setSelectedNavigationStep(null)
    setIsStartSearchOpen(false)
    setStartSearchMessage('')
    setNavigationAlertMessage('')
  }

  const handleSelectNavigationPoint = (point) => {
    if (selectedNavigationStep === 'start') {
      handleSetStartPoint(point)
      return
    }

    if (selectedNavigationStep === 'waypoint') {
      resetStartedNavigation()
      setWaypointList((currentWaypointList) => [
        ...currentWaypointList,
        point,
      ])
      setSelectedNavigationStep(null)
      return
    }

    resetStartedNavigation()
    setDestinationPoint(point)
    setDestinationDetail(createMapDestinationDetail(point))
    setIsDestinationDetailVisible(true)
    setIsNavigationSetupOpen(true)
    setSelectedNavigationStep(null)
  }

  const handleClearNavigation = () => {
    setStartPoint(null)
    setDestinationPoint(null)
    setDestinationDetail(null)
    setIsDestinationDetailVisible(false)
    setWaypointList([])
    setSelectedNavigationStep(null)
    setRouteDangerPosts([])
    setHasCheckedRouteDanger(false)
    setIsNavigationSetupOpen(false)
    setIsNavigationStarted(false)
    setNavigationAlertMessage('')
    setStartSearchQuery('')
    setStartSearchResults([])
    setStartSearchMessage('')
    setIsStartSearchOpen(false)
  }

  const handleDeleteWaypoint = (waypointIndex) => {
    resetStartedNavigation()
    setWaypointList((currentWaypointList) =>
      currentWaypointList.filter((_, index) => index !== waypointIndex),
    )
  }

  const handleRouteFound = useCallback((routeCoordinates) => {
    setRouteDangerPosts(getRouteDangerPosts(reports, routeCoordinates))
    setHasCheckedRouteDanger(true)
    setNavigationAlertMessage('')
  }, [reports])

  const handleRouteError = useCallback(() => {
    setRouteDangerPosts([])
    setHasCheckedRouteDanger(false)
    setNavigationAlertMessage(routeErrorMessage)
  }, [])

  const handleSearchPlace = async (event) => {
    event.preventDefault()
    setIsDestinationSearchOpen(true)

    const trimmedQuery = placeSearchQuery.trim()

    if (!trimmedQuery) {
      setPlaceSearchResults([])
      setPlaceSearchMessage('検索キーワードを入力してください。')
      return
    }

    if (placeSearchCache[trimmedQuery]) {
      const cachedResults = placeSearchCache[trimmedQuery]
      setPlaceSearchResults(cachedResults)
      setPlaceSearchMessage(
        cachedResults.length > 0 ? '' : '候補が見つかりませんでした',
      )
      return
    }

    const searchParams = new URLSearchParams({
      q: trimmedQuery,
      format: 'jsonv2',
      limit: '5',
      countrycodes: 'jp',
      'accept-language': 'ja',
      addressdetails: '1',
    })

    setIsSearchingPlace(true)
    setPlaceSearchMessage('')

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${searchParams.toString()}`,
      )

      if (!response.ok) {
        throw new Error('Failed to search place')
      }

      const results = await response.json()
      setPlaceSearchCache((currentCache) => ({
        ...currentCache,
        [trimmedQuery]: results,
      }))
      setPlaceSearchResults(results)
      setPlaceSearchMessage(
        results.length > 0 ? '' : '候補が見つかりませんでした',
      )
    } catch (error) {
      console.error(error)
      setPlaceSearchResults([])
      setPlaceSearchMessage(
        '場所検索に失敗しました。時間をおいて再度お試しください。',
      )
    } finally {
      setIsSearchingPlace(false)
    }
  }

  const handleClearDestinationSearch = () => {
    setPlaceSearchQuery('')
    setPlaceSearchResults([])
    setPlaceSearchMessage('')
    setIsDestinationSearchOpen(false)
  }

  const handleSelectPlaceSearchResult = (result) => {
    const { description, name } = formatPlaceSearchResult(result)
    const destination = {
      lat: Number(result.lat),
      lng: Number(result.lon),
    }

    resetStartedNavigation()
    setIsNavigationSetupOpen(false)
    setDestinationPoint({
      lat: destination.lat,
      lng: destination.lng,
    })
    setDestinationDetail({
      description,
      lat: destination.lat,
      lng: destination.lng,
      name,
    })
    setIsDestinationDetailVisible(true)
    setSelectedNavigationStep(null)
    setIsDestinationSearchOpen(false)
    setPlaceSearchMessage('')
  }

  const handleSearchStartPlace = async (event) => {
    event.preventDefault()
    setIsStartSearchOpen(true)

    const trimmedQuery = startSearchQuery.trim()

    if (!trimmedQuery) {
      setStartSearchResults([])
      setStartSearchMessage('検索キーワードを入力してください。')
      return
    }

    if (startSearchCache[trimmedQuery]) {
      const cachedResults = startSearchCache[trimmedQuery]
      setStartSearchResults(cachedResults)
      setStartSearchMessage(
        cachedResults.length > 0 ? '' : '候補が見つかりませんでした',
      )
      return
    }

    const searchParams = new URLSearchParams({
      q: trimmedQuery,
      format: 'jsonv2',
      limit: '5',
      countrycodes: 'jp',
      'accept-language': 'ja',
      addressdetails: '1',
    })

    setIsSearchingStart(true)
    setStartSearchMessage('')

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${searchParams.toString()}`,
      )

      if (!response.ok) {
        throw new Error('Failed to search start place')
      }

      const results = await response.json()
      setStartSearchCache((currentCache) => ({
        ...currentCache,
        [trimmedQuery]: results,
      }))
      setStartSearchResults(results)
      setStartSearchMessage(
        results.length > 0 ? '' : '候補が見つかりませんでした',
      )
    } catch (error) {
      console.error(error)
      setStartSearchResults([])
      setStartSearchMessage(
        '場所検索に失敗しました。時間をおいて再度お試しください。',
      )
    } finally {
      setIsSearchingStart(false)
    }
  }

  const handleSelectStartSearchResult = (result) => {
    handleSetStartPoint({
      lat: Number(result.lat),
      lng: Number(result.lon),
    })
    setStartSearchResults([])
    setStartSearchMessage('')
  }

  const handleSelectMapStartInput = () => {
    setSelectedNavigationStep('start')
    setIsStartSearchOpen(false)
    setStartSearchMessage('地図をタップして出発地を選択してください。')
  }

  const handleStartRouteNavigation = () => {
    if (!destinationPoint) {
      setNavigationAlertMessage('目的地を設定してください。')
      setSelectedNavigationStep('destination')
      return
    }

    if (!startPoint) {
      setNavigationAlertMessage('出発地を設定してください。')
      setSelectedNavigationStep('start')
      return
    }

    setNavigationAlertMessage('')
    setSelectedNavigationStep(null)
    setIsNavigationStarted(true)
  }

  const handleAddFavorite = () => {
    setNavigationAlertMessage('お気に入り機能は今後対応予定です。')
  }

  const handleCloseDestinationDetail = () => {
    setIsDestinationDetailVisible(false)
  }

  const handleUseCurrentLocationAsStart = () => {
    if (!navigator.geolocation) {
      setNavigationAlertMessage(currentLocationErrorMessage)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        handleSetStartPoint({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      () => {
        setNavigationAlertMessage(currentLocationErrorMessage)
      },
    )
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="header-copy">
          <p className="eyebrow">北陸4県 除雪情報</p>
          <h1>道路の除雪状況を地図で確認</h1>
          <p>
            新潟・富山・石川・福井の仮投稿データを表示しています。通勤・通学前の道路状況確認を想定した初期画面です。
          </p>
        </div>

        <ul className="status-legend" aria-label="除雪状態の凡例">
          {Object.entries(mapStatusStyles).map(([status, style]) => (
            <li key={status}>
              <span
                className="legend-dot"
                style={{ '--legend-color': style.color }}
              />
              {style.label}
            </li>
          ))}
        </ul>
      </header>

      {isNavigationMode && hasCheckedRouteDanger && (
        <div
          className={`route-alert-bar ${
            routeDangerPosts.length > 0 ? 'is-danger' : 'is-clear'
          }`}
          role="status"
        >
          {routeDangerPosts.length > 0 ? (
            <>
              <strong>
                現在のルート付近に危険箇所が{routeDangerPosts.length}
                件あります
              </strong>
              <span>
                経由地を追加すると、危険箇所を避けられる場合があります
              </span>
            </>
          ) : (
            <strong>現在のルート付近に危険投稿はありません</strong>
          )}
        </div>
      )}

      <div className="content-grid">
        {isPostMode && (
          <section className="form-panel" aria-labelledby="post-form-title">
            <h2 id="post-form-title">
              {isEditing ? '投稿を編集' : '除雪状況を投稿'}
            </h2>
            <p className="selected-position">
              {selectedPosition
                ? `選択中の位置：緯度 ${selectedPosition.lat.toFixed(
                    5,
                  )}、経度 ${selectedPosition.lng.toFixed(5)}`
                : '地図をクリックして投稿地点を選択してください'}
            </p>
            {loadingReports && (
              <p className="data-status">投稿データを読み込んでいます。</p>
            )}
            {dataError && <p className="form-error">{dataError}</p>}

            <form className="report-form" onSubmit={handleSubmit}>
              <fieldset>
                <legend>状態</legend>
                <div className="option-grid status-option-grid">
                  {Object.entries(statusStyles).map(([statusValue, style]) => (
                    <button
                      className={`option-button ${
                        status === statusValue ? 'is-selected' : ''
                      }`}
                      key={statusValue}
                      type="button"
                      aria-pressed={status === statusValue}
                      style={{ '--option-color': style.color }}
                      onClick={() => setStatus(statusValue)}
                    >
                      <span className="option-icon" aria-hidden="true" />
                      <span>{style.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend>対象</legend>
                <div className="option-grid target-option-grid">
                  {targetOptions.map((targetValue) => (
                    <button
                      className={`option-button target-option ${
                        target === targetValue ? 'is-selected' : ''
                      }`}
                      key={targetValue}
                      type="button"
                      aria-pressed={target === targetValue}
                      onClick={() => setTarget(targetValue)}
                    >
                      <span className="target-icon" aria-hidden="true">
                        {targetIcons[targetValue]}
                      </span>
                      <span>{targetLabels[targetValue]}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <label>
                タイトル
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                />
              </label>

              <label>
                コメント
                <textarea
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  rows="5"
                  required
                />
              </label>

              {formError && <p className="form-error">{formError}</p>}

              <div className="form-actions">
                <button type="submit" disabled={isSubmitDisabled}>
                  {isEditing ? '更新する' : '投稿する'}
                </button>
                {isEditing && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={resetForm}
                  >
                    キャンセル
                  </button>
                )}
              </div>
            </form>
          </section>
        )}

        {isNavigationMode && (
          <section
            className="form-panel navigation-panel"
            aria-labelledby="navigation-title"
          >
            <h2 id="navigation-title">ナビゲーション設定</h2>
            <p className="selected-position">
              危険箇所を避けたい場合は、地図上で経由地を追加してください。
            </p>

            <div className="route-form">
              <section className="navigation-section" aria-label="目的地詳細">
                <dl className="navigation-point-list">
                  <div>
                    <dt>出発地</dt>
                    <dd>{formatPoint(startPoint)}</dd>
                  </div>
                  <div>
                    <dt>目的地</dt>
                    <dd>{formatPoint(destinationPoint)}</dd>
                  </div>
                  <div>
                    <dt>経由地</dt>
                    <dd>
                      {waypointList.length > 0
                        ? `${waypointList.length}件`
                        : '未選択'}
                    </dd>
                  </div>
                </dl>

                {waypointList.length > 0 && (
                  <ol className="waypoint-list">
                    {waypointList.map((waypoint, index) => (
                      <li key={`${waypoint.lat}-${waypoint.lng}-${index}`}>
                        <div>
                          <strong>経由地 {index + 1}</strong>
                          <span>{formatPoint(waypoint)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteWaypoint(index)}
                        >
                          削除
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </section>

              {isNavigationSetupOpen && (
                <section
                  className="navigation-section navigation-action-bar"
                  aria-label="ナビゲーション設定バー"
                >
                  <p className="route-mode-label">{routeModeLabel}</p>

                  <div
                    className="option-grid navigation-step-grid"
                    aria-label="ナビゲーション地点の入力対象"
                  >
                    <form
                      className="start-search-form"
                      onSubmit={handleSearchStartPlace}
                    >
                      <label>
                        出発地
                        <span className="place-search-input-row">
                          <input
                            type="search"
                            value={startSearchQuery}
                            onChange={(event) =>
                              setStartSearchQuery(event.target.value)
                            }
                            onFocus={() => setIsStartSearchOpen(true)}
                            placeholder="地名・施設名で検索"
                          />
                          <button type="submit" disabled={isSearchingStart}>
                            {isSearchingStart ? '検索中...' : '検索'}
                          </button>
                        </span>
                      </label>

                      {isStartSearchOpen && (
                        <div
                          className="start-search-dropdown"
                          aria-label="出発地候補"
                        >
                          <button
                            className="start-search-dropdown-button"
                            type="button"
                            onClick={handleUseCurrentLocationAsStart}
                          >
                            <span>現在地を使用</span>
                            <small>ブラウザの現在地を出発地にします</small>
                          </button>
                          <button
                            className="start-search-dropdown-button"
                            type="button"
                            onClick={handleSelectMapStartInput}
                          >
                            <span>地図をタップして出発地を選択</span>
                            <small>次にタップした地点を出発地にします</small>
                          </button>

                          {startSearchMessage && (
                            <p className="place-search-message">
                              {startSearchMessage}
                            </p>
                          )}

                          {startSearchResults.length > 0 && (
                            <div className="place-search-results">
                              {startSearchResults.map((result) => {
                                const { description, name } =
                                  formatPlaceSearchResult(result)

                                return (
                                  <button
                                    className="place-search-result-button"
                                    key={result.place_id}
                                    type="button"
                                    onClick={() =>
                                      handleSelectStartSearchResult(result)
                                    }
                                  >
                                    <span>{name}</span>
                                    <small>{description}</small>
                                  </button>
                                )
                              })}
                              <p className="place-search-attribution">
                                Search results by OpenStreetMap Nominatim
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </form>
                    <button
                      className={`option-button navigation-step-button ${
                        selectedNavigationStep === 'destination'
                          ? 'is-selected'
                          : ''
                      }`}
                      type="button"
                      aria-pressed={selectedNavigationStep === 'destination'}
                      onClick={() => setSelectedNavigationStep('destination')}
                    >
                      目的地を選択
                    </button>
                    <button
                      className={`option-button navigation-step-button ${
                        selectedNavigationStep === 'waypoint'
                          ? 'is-selected'
                          : ''
                      }`}
                      type="button"
                      aria-pressed={selectedNavigationStep === 'waypoint'}
                      onClick={() => setSelectedNavigationStep('waypoint')}
                    >
                      経由地を追加
                    </button>
                    <button
                      className="option-button navigation-step-button navigation-clear-button"
                      type="button"
                      onClick={handleClearNavigation}
                    >
                      クリア
                    </button>
                    <button
                      className="option-button navigation-step-button navigation-start-button"
                      type="button"
                      onClick={handleStartRouteNavigation}
                    >
                      ナビ開始
                    </button>
                  </div>
                </section>
              )}

              {navigationAlertMessage && (
                <p className="navigation-alert">{navigationAlertMessage}</p>
              )}
            </div>
          </section>
        )}

        <section className="map-panel" aria-label="北陸地域の除雪情報マップ">
          {isNavigationMode && (
            <div className="destination-search-overlay">
              <form
                className="place-search-form map-place-search-form"
                onSubmit={handleSearchPlace}
              >
                <label>
                  目的地を検索
                  <span className="place-search-input-row">
                    <input
                      type="search"
                      value={placeSearchQuery}
                      onChange={(event) =>
                        setPlaceSearchQuery(event.target.value)
                      }
                      onFocus={() => setIsDestinationSearchOpen(true)}
                      placeholder="例：金沢駅、富山県庁"
                    />
                    {(placeSearchQuery ||
                      placeSearchMessage ||
                      placeSearchResults.length > 0) && (
                      <button
                        className="place-search-clear-button"
                        type="button"
                        aria-label="目的地検索欄をクリア"
                        onClick={handleClearDestinationSearch}
                      >
                        ×
                      </button>
                    )}
                  </span>
                </label>
                <button type="submit" disabled={isSearchingPlace}>
                  {isSearchingPlace ? '検索中...' : '検索'}
                </button>
              </form>

              {isDestinationSearchOpen &&
                (placeSearchMessage || placeSearchResults.length > 0) && (
                <div
                  className="destination-search-popover"
                  aria-label="目的地設定"
                >
                  {placeSearchMessage && (
                    <p className="place-search-message">
                      {placeSearchMessage}
                    </p>
                  )}

                  {placeSearchResults.length > 0 && (
                    <div className="place-search-results">
                      {placeSearchResults.map((result) => {
                        const { description, name } =
                          formatPlaceSearchResult(result)

                        return (
                          <button
                            className="place-search-result-button"
                            key={result.place_id}
                            type="button"
                            onClick={() =>
                              handleSelectPlaceSearchResult(result)
                            }
                          >
                            <span>{name}</span>
                            <small>{description}</small>
                          </button>
                        )
                      })}
                      <p className="place-search-attribution">
                        Search results by OpenStreetMap Nominatim
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <MapContainer
            center={[36.95, 137.55]}
            zoom={7}
            minZoom={6}
            scrollWheelZoom
            className="snow-map"
          >
            {isPostMode && <MapClickHandler onSelect={setSelectedPosition} />}
            {isNavigationMode && (
              <NavigationMapClickHandler
                onSelect={handleSelectNavigationPoint}
              />
            )}
            {isNavigationMode &&
              isNavigationStarted &&
              startPoint &&
              destinationPoint && (
              <RoutingMachine
                destinationPoint={destinationPoint}
                onRouteError={handleRouteError}
                onRouteFound={handleRouteFound}
                routeMode={routeMode}
                startPoint={startPoint}
                waypointList={waypointList}
              />
            )}

            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {isPostMode && selectedPosition && (
              <Marker
                position={[selectedPosition.lat, selectedPosition.lng]}
                icon={selectedPositionIcon}
              />
            )}

            {isNavigationMode && startPoint && (
              <Marker
                position={[startPoint.lat, startPoint.lng]}
                icon={createNavigationIcon({
                  color: '#2563eb',
                  label: '出発地',
                  text: 'S',
                })}
              />
            )}

            {isNavigationMode && destinationPoint && (
              <Marker
                position={[destinationPoint.lat, destinationPoint.lng]}
                icon={createNavigationIcon({
                  color: '#16a34a',
                  label: '目的地',
                  text: 'G',
                })}
                eventHandlers={{
                  click: () => setIsDestinationSearchOpen(false),
                }}
              />
            )}

            {isNavigationMode &&
              waypointList.map((waypoint, index) => (
                <Marker
                  key={`${waypoint.lat}-${waypoint.lng}-${index}`}
                  position={[waypoint.lat, waypoint.lng]}
                  icon={createNavigationIcon({
                    color: '#d97706',
                    label: `経由地 ${index + 1}`,
                    text: String(index + 1),
                  })}
                />
              ))}

            {reports.map((report) => (
              <Marker
                key={report.id}
                position={[report.lat, report.lng]}
                icon={createStatusIcon(getMapStatus(report.status), {
                  isNavigationMuted:
                    isNavigationMode && !routeDangerPostIds.has(report.id),
                  isRouteDanger:
                    isNavigationMode && routeDangerPostIds.has(report.id),
                })}
              >
                <Popup>
                  <article className="report-popup">
                    <span
                      className="popup-status"
                      style={{
                        '--popup-status-color':
                          mapStatusStyles[getMapStatus(report.status)].color,
                      }}
                    >
                      {mapStatusStyles[getMapStatus(report.status)].label}
                    </span>
                    <h2>{report.title}</h2>
                    <p>{report.comment}</p>
                    <dl>
                      {report.area && (
                        <div>
                          <dt>エリア</dt>
                          <dd>{report.area}</dd>
                        </div>
                      )}
                      <div>
                        <dt>詳細理由</dt>
                        <dd>{statusStyles[report.status].label}</dd>
                      </div>
                      <div>
                        <dt>対象</dt>
                        <dd>{targetLabels[report.target]}</dd>
                      </div>
                    </dl>
                    <time dateTime={report.updatedAt}>
                      {formatUpdatedAt(report.updatedAt)}
                    </time>
                    {isPostMode && (
                      <div className="popup-actions">
                        <button
                          type="button"
                          onClick={() => handleEditReport(report)}
                        >
                          編集
                        </button>
                        <button
                          className="danger-button"
                          type="button"
                          onClick={() => handleDeleteReport(report.id)}
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </article>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </section>
      </div>

      {isNavigationMode && destinationDetail && isDestinationDetailVisible && (
        <section
          className="destination-detail-card"
          aria-label="目的地詳細"
        >
          <button
            className="destination-detail-close-button"
            type="button"
            aria-label="目的地詳細を閉じる"
            onClick={handleCloseDestinationDetail}
          >
            ×
          </button>

          <div className="destination-detail-copy">
            <p className="destination-detail-label">目的地</p>
            <h2>{destinationDetail.name}</h2>
            <p>{destinationDetail.description}</p>
            <dl>
              <div>
                <dt>緯度</dt>
                <dd>{destinationDetail.lat.toFixed(5)}</dd>
              </div>
              <div>
                <dt>経度</dt>
                <dd>{destinationDetail.lng.toFixed(5)}</dd>
              </div>
            </dl>
          </div>

          <div className="destination-detail-actions">
            <button type="button" onClick={handleOpenNavigationSetup}>
              ナビゲーション設定を開く
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={handleAddFavorite}
            >
              お気に入りに追加
            </button>
          </div>
        </section>
      )}

      <div className="mode-switcher" aria-label="表示モード切り替え">
        <button type="button" onClick={handleToggleMode}>
          {isNavigationMode ? '投稿モードに戻る' : 'ナビゲーション'}
        </button>
      </div>
    </main>
  )
}

export default App
