import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix Leaflet default marker icon in Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, shadowUrl: markerShadow })

// City coordinate map
const CITY_COORDS = {
  '서울': [37.5665, 126.9780],
  '부산': [35.1796, 129.0756],
  '대구': [35.8714, 128.6014],
  '인천': [37.4563, 126.7052],
  '광주': [35.1595, 126.8526],
  '대전': [36.3504, 127.3845],
  '경기': [37.4138, 127.5183],
}
const DEFAULT_COORDS = [36.5, 127.5]

function getCoords(address) {
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (address && address.includes(city)) {
      return [
        coords[0] + (Math.random() - 0.5) * 0.1,
        coords[1] + (Math.random() - 0.5) * 0.1,
      ]
    }
  }
  return [
    DEFAULT_COORDS[0] + (Math.random() - 0.5) * 0.1,
    DEFAULT_COORDS[1] + (Math.random() - 0.5) * 0.1,
  ]
}

const STATUS_COLOR = {
  IN_TRANSIT:       '#3b82f6',  // blue
  OUT_FOR_DELIVERY: '#f97316',  // orange
  DELIVERED:        '#22c55e',  // green
  READY:            '#9ca3af',  // gray
  FAILED:           '#ef4444',  // red
}

const STATUS_LABEL = {
  READY:            '준비',
  IN_TRANSIT:       '배송중',
  OUT_FOR_DELIVERY: '배달중',
  DELIVERED:        '배송완료',
  FAILED:           '배송실패',
}

const CARRIER_LABEL = {
  CJ:     'CJ대한통운',
  HANJIN: '한진택배',
  LOTTE:  '롯데택배',
  ETC:    '기타',
}

function makeColoredIcon(color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 16px; height: 16px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  })
}

export default function DeliveryMap({ deliveries = [], height = 400, flyToId = null }) {
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markersRef = useRef({})

  useEffect(() => {
    if (mapInstance.current) return
    mapInstance.current = L.map(mapRef.current, {
      center: DEFAULT_COORDS,
      zoom: 7,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>',
    }).addTo(mapInstance.current)
  }, [])

  useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    // Clear existing markers
    Object.values(markersRef.current).forEach((m) => m.remove())
    markersRef.current = {}

    deliveries.forEach((d) => {
      const coords = getCoords(d.receiver_address)
      const color = STATUS_COLOR[d.status] || '#9ca3af'
      const icon = makeColoredIcon(color)
      const marker = L.marker(coords, { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-size:13px; line-height:1.6; min-width:180px">
            <div style="font-weight:700; margin-bottom:4px">${d.order_number}</div>
            <div>수신자: <b>${d.receiver_name}</b></div>
            <div>주소: ${d.receiver_address}</div>
            <div>택배사: ${CARRIER_LABEL[d.carrier] || d.carrier}</div>
            <div>상태: <span style="color:${color};font-weight:600">${STATUS_LABEL[d.status] || d.status}</span></div>
            <div>예상배송일: ${d.estimated_delivery || '—'}</div>
          </div>
        `)
      markersRef.current[d.id] = marker
    })
  }, [deliveries])

  // Fly to marker when flyToId changes
  useEffect(() => {
    if (flyToId == null) return
    const marker = markersRef.current[flyToId]
    if (marker && mapInstance.current) {
      const latlng = marker.getLatLng()
      mapInstance.current.flyTo(latlng, 13, { duration: 1 })
      setTimeout(() => marker.openPopup(), 1100)
    }
  }, [flyToId])

  return <div ref={mapRef} style={{ height, width: '100%', borderRadius: '12px', zIndex: 0 }} />
}
