import L from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const statusStyles = {
  除雪済み: {
    color: '#1d7ed0',
    label: '除雪済み',
  },
  未除雪: {
    color: '#d93939',
    label: '未除雪',
  },
  積雪が多い: {
    color: '#7c3aed',
    label: '積雪が多い',
  },
  通行注意: {
    color: '#f59e0b',
    label: '通行注意',
  },
}

const snowReports = [
  {
    id: 1,
    title: '金沢駅西口 周辺道路',
    status: '除雪済み',
    description: '駅前ロータリーから県道方面まで通行しやすい状態です。',
    position: [36.5781, 136.6478],
    updatedAt: '今日 07:20',
  },
  {
    id: 2,
    title: '富山市 呉羽丘陵入口',
    status: '通行注意',
    description: '坂道で一部凍結が見られます。速度を落として通行してください。',
    position: [36.6995, 137.1689],
    updatedAt: '今日 07:45',
  },
  {
    id: 3,
    title: '福井市 大和田交差点',
    status: '未除雪',
    description: '生活道路側に雪が残っており、車幅が狭くなっています。',
    position: [36.0959, 136.2478],
    updatedAt: '今日 06:55',
  },
  {
    id: 4,
    title: '新潟市 中央区 学校町通',
    status: '積雪が多い',
    description: '歩道と路肩にまとまった積雪があります。徒歩移動は注意が必要です。',
    position: [37.9161, 139.0364],
    updatedAt: '今日 08:05',
  },
  {
    id: 5,
    title: '長岡市 宮内駅前',
    status: '除雪済み',
    description: '駅前通りは除雪済みで、バス停周辺も利用しやすい状態です。',
    position: [37.4243, 138.8406],
    updatedAt: '今日 07:10',
  },
  {
    id: 6,
    title: '白山市 鶴来支所付近',
    status: '通行注意',
    description: '交差点付近にシャーベット状の雪が残っています。',
    position: [36.4497, 136.6266],
    updatedAt: '今日 08:18',
  },
]

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
              position={report.position}
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
                    {report.status}
                  </span>
                  <h2>{report.title}</h2>
                  <p>{report.description}</p>
                  <time>{report.updatedAt}</time>
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
