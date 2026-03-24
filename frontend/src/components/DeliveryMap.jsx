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

function getCoords(delivery) {
  if (delivery.delivery_lat != null && delivery.delivery_lng != null) {
    return [delivery.delivery_lat, delivery.delivery_lng]
  }
  const address = delivery.receiver_address || ''
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (address.includes(city)) {
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

const STATUS_LABEL = {
  READY:            '택배사 인수완료',
  IN_TRANSIT:       '배송중',
  OUT_FOR_DELIVERY: '배달 출발',
  DELIVERED:        '배송완료',
  FAILED:           '배송 실패',
}

const CARRIER_META = {
  CJ:     { label: 'CJ대한통운', color: '#EF4444' },
  LOTTE:  { label: '롯데택배',   color: '#3B82F6' },
  HANJIN: { label: '한진택배',   color: '#EAB308' },
  ROSEN:  { label: '로젠택배',   color: '#22C55E' },
  ETC:    { label: '기타',       color: '#94A3B8' },
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

  // Render delivery markers
  useEffect(() => {
    const map = mapInstance.current
    if (!map) return

    // Clear existing delivery markers
    Object.values(markersRef.current).forEach((m) => m.remove())
    markersRef.current = {}

    deliveries.forEach((d) => {
      const coords = getCoords(d)
      const cm = CARRIER_META[d.carrier] || CARRIER_META.ETC
      const icon = makeColoredIcon(cm.color)
      const statusLabel = STATUS_LABEL[d.status] || d.status
      const marker = L.marker(coords, { icon })
        .addTo(map)
        .bindPopup(`
          <div style="font-size:13px; line-height:1.6; min-width:180px">
            <div style="font-weight:700; margin-bottom:4px">${d.order_number}</div>
            <div>수신자: <b>${d.receiver_name}</b></div>
            <div>주소: ${d.receiver_address}</div>
            <div>택배사: <span style="color:${cm.color};font-weight:600">${cm.label}</span></div>
            <div>상태: ${statusLabel}</div>
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
