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

const facilityStatusStyles = {
  normal: {
    color: '#1dd02f',
    label: '通常営業',
  },
  changed: {
    color: '#f59e0b',
    label: '営業情報変更あり',
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

const passableReportDefaults = {
  passableReportCount: 0,
  passableReports: [],
  autoResolved: false,
}

const snowReports = [
  {
    ...passableReportDefaults,
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
    ...passableReportDefaults,
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
    ...passableReportDefaults,
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
    ...passableReportDefaults,
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
    ...passableReportDefaults,
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
    ...passableReportDefaults,
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

const createFacilityStatusIcon = (status) => {
  const { color } = facilityStatusStyles[status]

  const houseSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="1.5" width="28" height="28"><path d="M3 10L12 3L21 10V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V10Z" /><path d="M9 21V15H15V21" /></svg>`

  return L.divIcon({
    className: 'facility-marker',
    html: `<div style="filter: drop-shadow(0 2px 3px rgba(0,0,0,0.3))">${houseSvg}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 28],
    popupAnchor: [0, -28],
  })
}

const reportsCollection = collection(db, 'snowReports')
const reportsQuery = query(reportsCollection, orderBy('updatedAt', 'desc'))

const facilityCollection = collection(db, 'facilityReports')
const facilityQuery = query(facilityCollection, orderBy('updatedAt', 'desc'))

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

function MapFilterButtons({ filterType, onFilterChange }) {
  return (
    <div className="map-filter-container">
      <button
        className={`map-filter-button ${filterType === 'snow' ? 'is-active' : ''}`}
        onClick={() => onFilterChange('snow')}
      >
        🛣️ 除雪情報
      </button>
      <button
        className={`map-filter-button ${filterType === 'facility' ? 'is-active' : ''}`}
        onClick={() => onFilterChange('facility')}
      >
        🏠 施設情報
      </button>
      <button
        className={`map-filter-button ${filterType === 'all' ? 'is-active' : ''}`}
        onClick={() => onFilterChange('all')}
      >
        📍 すべて
      </button>
    </div>
  )
}

function App() {
  const [mode, setMode] = useState('post')
  const [reports, setReports] = useState([])
  const [facilityReports, setFacilityReports] = useState([])
  const [filterType, setFilterType] = useState('snow') // 'snow' または 'facility'
  const [mapFilterType, setMapFilterType] = useState('all') // 'snow', 'facility', または 'all'
  const [selectedPosition, setSelectedPosition] = useState(null)
  const [status, setStatus] = useState('caution')
  const [facilityStatus, setFacilityStatus] = useState('normal')
  const [target, setTarget] = useState('car')
  const [title, setTitle] = useState('')
  const [facilityName, setFacilityName] = useState('')
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
  const [editingFacilityReportId, setEditingFacilityReportId] = useState(null)

  const isPostMode = mode === 'post'
  const isNavigationMode = mode === 'navigation'
  const routeModeLabel = ROUTE_MODES[routeMode].label
  const trimmedTitle = title.trim()
  const trimmedComment = comment.trim()
  const trimmedFacilityName = facilityName.trim()
  const isSubmitDisabled =
    !selectedPosition || !trimmedTitle || !trimmedComment
  const isFacilitySubmitDisabled =
    !selectedPosition || !trimmedFacilityName || !trimmedComment
  const isEditing = editingReportId !== null
  const isFacilityEditing = editingFacilityReportId !== null

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

        snapshot.docs.forEach((reportDoc) => {
          const missingFields = getMissingPassableReportFields(reportDoc.data())

          if (Object.keys(missingFields).length > 0) {
            updateDoc(doc(reportsCollection, reportDoc.id), missingFields).catch(
              (error) => {
                console.error(error)
                setDataError('投稿データの更新に失敗しました。')
              },
            )
          }
        })

        setReports(
          snapshot.docs.map((reportDoc) =>
            applyPassableReportDefaults({
              ...reportDoc.data(),
              id: reportDoc.id,
            }),
          ),
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

  useEffect(() => {
    const unsubscribeFacility = onSnapshot(
      facilityQuery,
      (snapshot) => {
        setFacilityReports(
          snapshot.docs.map((reportDoc) => ({
            ...reportDoc.data(),
            id: reportDoc.id,
          })),
        )
      },
      (error) => {
        console.error(error)
      },
    )

    return unsubscribeFacility
  }, [])

  const resetForm = () => {
    setSelectedPosition(null)
    setStatus('caution')
    setFacilityStatus('normal')
    setTarget('car')
    setTitle('')
    setFacilityName('')
    setComment('')
    setFormError('')
    setEditingReportId(null)
    setEditingFacilityReportId(null)
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
      ...passableReportDefaults,
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

  const handlePassableReport = (reportId) => {
    const reportedAt = formatTokyoIso()
    const targetReport = reports.find((report) => report.id === reportId)
    const nextPassableReportCount =
      (targetReport?.passableReportCount ?? 0) + 1
    const shouldAutoResolve =
      targetReport?.status !== 'cleared' && nextPassableReportCount >= 3

    setReports((currentReports) =>
      currentReports.map((report) => {
        if (report.id !== reportId) {
          return report
        }

        const passableReports = Array.isArray(report.passableReports)
          ? report.passableReports
          : []
        const passableReportCount = (report.passableReportCount ?? 0) + 1
        const isAutoResolved =
          report.status !== 'cleared' && passableReportCount >= 3

        return {
          ...report,
          status: isAutoResolved ? 'cleared' : report.status,
          isResolved: isAutoResolved ? true : report.isResolved,
          autoResolved: isAutoResolved ? true : report.autoResolved,
          passableReportCount,
          passableReports: [...passableReports, reportedAt],
          updatedAt: isAutoResolved ? reportedAt : report.updatedAt,
        }
      }),
    )

    if (shouldAutoResolve) {
      setRouteDangerPosts((currentRouteDangerPosts) =>
        currentRouteDangerPosts.filter((report) => report.id !== reportId),
      )
    }

    setPassableReportMessages((currentMessages) => ({
      ...currentMessages,
      [reportId]: '通行可能報告を送信しました',
    }))

    window.setTimeout(() => {
      setPassableReportMessages((currentMessages) => {
        const remainingMessages = { ...currentMessages }
        delete remainingMessages[reportId]
        return remainingMessages
      })
    }, 2500)
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

  const handleFacilitySubmit = async (event) => {
    event.preventDefault()

    if (!selectedPosition) {
      setFormError('地図をクリックして投稿地点を選択してください。')
      return
    }

    if (!trimmedFacilityName || !trimmedComment) {
      setFormError('施設名とコメントを入力してください。')
      return
    }

    const now = formatTokyoIso()

    if (isFacilityEditing) {
      try {
        await updateDoc(doc(facilityCollection, editingFacilityReportId), {
          facilityName: trimmedFacilityName,
          status: facilityStatus,
          comment: trimmedComment,
          lat: selectedPosition.lat,
          lng: selectedPosition.lng,
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

    const newReportRef = doc(facilityCollection)
    const newReport = {
      id: newReportRef.id,
      facilityName: trimmedFacilityName,
      status: facilityStatus,
      comment: trimmedComment,
      lat: selectedPosition.lat,
      lng: selectedPosition.lng,
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

  const handleEditFacilityReport = (report) => {
    setEditingFacilityReportId(report.id)
    setFacilityStatus(report.status)
    setFacilityName(report.facilityName)
    setComment(report.comment)
    setSelectedPosition({
      lat: report.lat,
      lng: report.lng,
    })
    setFormError('')
    setFilterType('facility')
  }

  const handleDeleteFacilityReport = async (reportId) => {
    if (!window.confirm('この投稿を削除しますか？')) {
      return
    }

    try {
      await deleteDoc(doc(facilityCollection, reportId))
      setDataError('')

      if (editingFacilityReportId === reportId) {
        resetForm()
      }
    } catch (error) {
      console.error(error)
      setDataError('投稿の削除に失敗しました。')
    }
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

      <div className="content-grid">
        <section className="form-panel" aria-labelledby="post-form-title">
          <h2 id="post-form-title">
            {filterType === 'snow'
              ? isEditing
                ? '投稿を編集'
                : '除雪状況を投稿'
              : isFacilityEditing
                ? '投稿を編集'
                : '施設情報を投稿'}
          </h2>

          <div className="filter-buttons">
            <button
              className={`filter-button ${filterType === 'snow' ? 'is-active' : ''}`}
              onClick={() => {
                setFilterType('snow')
                resetForm()
              }}
            >
              ☑︎ 道路情報
            </button>
            <button
              className={`filter-button ${filterType === 'facility' ? 'is-active' : ''}`}
              onClick={() => {
                setFilterType('facility')
                resetForm()
              }}
            >
              ☑︎ 施設情報
            </button>
          </div>

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
        </div>
      )}

          {filterType === 'snow' ? (
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
            </form>
          ) : (
            <form className="report-form" onSubmit={handleFacilitySubmit}>
              <label>
                施設名
                <input
                  type="text"
                  value={facilityName}
                  onChange={(event) => setFacilityName(event.target.value)}
                  required
                />
              </label>

              <fieldset>
                <legend>営業状況</legend>
                <div className="option-grid status-option-grid">
                  {Object.entries(facilityStatusStyles).map(([statusValue, style]) => (
                    <button
                      className={`option-button ${
                        facilityStatus === statusValue ? 'is-selected' : ''
                      }`}
                      key={statusValue}
                      type="button"
                      aria-pressed={facilityStatus === statusValue}
                      style={{ '--option-color': style.color }}
                      onClick={() => setFacilityStatus(statusValue)}
                    >
                      <span className="option-icon" aria-hidden="true" />
                      <span>{style.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

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
                <button type="submit" disabled={isFacilitySubmitDisabled}>
                  {isFacilityEditing ? '更新する' : '投稿する'}
                </button>
                {isFacilityEditing && (
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
          )}
        </section>

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
            <MapClickHandler onSelect={setSelectedPosition} />
            <MapFilterButtons filterType={mapFilterType} onFilterChange={setMapFilterType} />

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

            {(mapFilterType === 'snow' || mapFilterType === 'all') &&
              reports.map((report) => (
                <Marker
                  key={report.id}
                  position={[report.lat, report.lng]}
                  icon={createStatusIcon(getMapStatus(report.status))}
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
                      <div className="popup-actions">
                        <button
                          type="button"
                          onClick={() => {
                            handleEditReport(report)
                            setFilterType('snow')
                          }}
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
                    </article>
                  </Popup>
                </Marker>
              ))}

            {(mapFilterType === 'facility' || mapFilterType === 'all') &&
              facilityReports.map((report) => (
                <Marker
                  key={report.id}
                  position={[report.lat, report.lng]}
                  icon={createFacilityStatusIcon(report.status)}
                >
                  <Popup>
                    <article className="report-popup">
                      <span
                        className="popup-status"
                        style={{
                          '--popup-status-color':
                            facilityStatusStyles[report.status].color,
                        }}
                      >
                        {facilityStatusStyles[report.status].label}
                      </span>
                      <h2>{report.facilityName}</h2>
                      <p>{report.comment}</p>
                      <time dateTime={report.updatedAt}>
                        {formatUpdatedAt(report.updatedAt)}
                      </time>
                      <div className="popup-actions">
                        <button
                          type="button"
                          onClick={() => handleEditFacilityReport(report)}
                        >
                          編集
                        </button>
                        <button
                          className="danger-button"
                          type="button"
                          onClick={() => handleDeleteFacilityReport(report.id)}
                        >
                          削除
                        </button>
                      </div>
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
