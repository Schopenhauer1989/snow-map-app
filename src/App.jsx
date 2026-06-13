import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const statusStyles = {
  cleared: {
    color: '#1dd02f',
    label: '除雪済み',
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

const targetLabels = {
  car: '車',
  pedestrian: '歩行者',
  both: '車・歩行者',
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

const createStatusIcon = (status) => {
  const { color, label } = statusStyles[status]

  return L.divIcon({
    className: 'snow-marker',
    html: `<span aria-label="${label}" style="--marker-color: ${color}"></span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

function App() {
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
          {Object.entries(statusStyles).map(([status, style]) => (
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

      <section className="map-panel" aria-label="北陸地域の除雪情報マップ">
        <MapContainer
          center={[36.95, 137.55]}
          zoom={7}
          minZoom={6}
          scrollWheelZoom
          className="snow-map"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {snowReports.map((report) => (
            <Marker
              key={report.id}
              position={[report.lat, report.lng]}
              icon={createStatusIcon(report.status)}
            >
              <Popup>
                <article className="report-popup">
                  <span
                    className="popup-status"
                    style={{
                      '--popup-status-color': statusStyles[report.status].color,
                    }}
                  >
                    {statusStyles[report.status].label}
                  </span>
                  <h2>{report.title}</h2>
                  <p>{report.comment}</p>
                  <dl>
                    <div>
                      <dt>エリア</dt>
                      <dd>{report.area}</dd>
                    </div>
                    <div>
                      <dt>対象</dt>
                      <dd>{targetLabels[report.target]}</dd>
                    </div>
                  </dl>
                  <time dateTime={report.updatedAt}>
                    {formatUpdatedAt(report.updatedAt)}
                  </time>
                </article>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </section>
    </main>
  )
}

export default App
