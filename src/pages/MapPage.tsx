import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Filter,
  Layers,
  Search
} from 'lucide-react';
import { api } from '../lib/api';
import { Device, Substation, Feeder } from '../types';
import { normalizeLocation } from '../utils/location';

interface MapPageProps {
  onNavigateToDetail: (deviceId: number | string) => void;
}

export const MapPage: React.FC<MapPageProps> = ({ onNavigateToDetail }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [devices, setDevices] = useState<Device[]>([]);
  const [substations, setSubstations] = useState<Substation[]>([]);
  const [feeders, setFeeders] = useState<Feeder[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [stationFilter, setStationFilter] = useState('');
  const [feederFilter, setFeederFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [switchFilter, setSwitchFilter] = useState('');
  const [search, setSearch] = useState('');

  // Map Tile Style
  const [tileMode, setTileMode] = useState<'osm' | 'satellite'>('osm');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [devRes, stRes, fdRes] = await Promise.all([
        api.getDevices(),
        api.getSubstations(),
        api.getFeeders()
      ]);

      if (devRes.success) setDevices(devRes.data);
      if (stRes.success) setSubstations(stRes.data);
      if (fdRes.success) setFeeders(fdRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Filter devices that have coordinates
  const filteredDevices = devices.filter(d => {
    const loc = normalizeLocation(d.latitude, d.longitude);
    if (!loc) return false;
    if (stationFilter && String(d.substation_id) !== String(stationFilter)) return false;
    if (feederFilter && String(d.feeder_id) !== String(feederFilter)) return false;
    if (typeFilter && d.device_type !== typeFilter) return false;
    if (switchFilter && d.switch_status !== switchFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchId = d.device_id.toLowerCase().includes(q);
      const matchName = d.name.toLowerCase().includes(q);
      const matchPole = (d.pole_number || '').toLowerCase().includes(q);
      if (!matchId && !matchName && !matchPole) return false;
    }
    return true;
  });

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [21.0458, 105.7925],
        zoom: 13,
        zoomControl: false
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapInstanceRef.current = map;
      markersLayerRef.current = L.layerGroup().addTo(map);
    }

    const map = mapInstanceRef.current;
    map.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        map.removeLayer(layer);
      }
    });

    if (tileMode === 'osm') {
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
    } else {
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18,
        attribution: 'Tiles &copy; Esri'
      }).addTo(map);
    }
  }, [tileMode]);

  // Update Markers when filtered devices change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const map = mapInstanceRef.current;
    const markersGroup = markersLayerRef.current;
    markersGroup.clearLayers();

    const bounds = L.latLngBounds([]);

    filteredDevices.forEach(device => {
      const loc = normalizeLocation(device.latitude, device.longitude);
      if (!loc) return;

      bounds.extend([loc.lat, loc.lng]);

      const isClosed = device.switch_status === 'CLOSED';
      const isOpen = device.switch_status === 'OPEN';
      const dotColor = isClosed ? '#10b981' : isOpen ? '#ef4444' : '#6b7280';

      const customIcon = L.divIcon({
        className: 'custom-map-marker',
        html: `
          <div style="
            width: 28px;
            height: 28px;
            background-color: ${dotColor};
            border: 3px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: 800;
            font-size: 10px;
            font-family: monospace;
          ">
            ${device.device_type}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        popupAnchor: [0, -14]
      });

      const popupHtml = `
        <div style="font-family: sans-serif; padding: 4px; min-width: 220px;">
          <div style="font-size: 10px; font-weight: 800; color: #3b82f6; font-family: monospace; margin-bottom: 2px;">
            ${device.device_id}
          </div>
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">
            ${device.name}
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 4px;">
            📍 Trạm: <strong>${device.substation_name || 'N/A'}</strong> | ⚡ Phát tuyến: <strong>${device.feeder_name || 'N/A'}</strong>
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 8px;">
            Trạng thái: <strong>${device.switch_status}</strong> | SCADA: <strong>${device.scada_status}</strong>
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 8px;">
            Rơle 79: <strong>${device.relay_79}</strong> | Ắc quy: <strong>${device.battery_status || 'N/A'}</strong>
          </div>
          <div style="display: flex; gap: 6px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
            <button class="btn-device-detail" style="flex: 1; padding: 6px; background-color: #2563eb; color: white; border: none; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Xem Chi Tiết</button>
            <button class="btn-device-directions" style="padding: 6px 10px; background-color: #059669; color: white; border: none; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">🧭 Chỉ Đường</button>
          </div>
        </div>
      `;

      const marker = L.marker([loc.lat, loc.lng], { icon: customIcon }).bindPopup(popupHtml);
      marker.on('popupopen', () => {
        const popupEl = marker.getPopup()?.getElement();
        popupEl?.querySelector('.btn-device-detail')?.addEventListener('click', () => onNavigateToDetail(device.id));
        popupEl?.querySelector('.btn-device-directions')?.addEventListener('click', () => {
          window.open(`https://www.google.com/maps/dir/?api=1&destination=${loc.lat},${loc.lng}`, '_blank');
        });
      });
      markersGroup.addLayer(marker);
    });

    if (filteredDevices.length > 0 && bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    }
  }, [filteredDevices, onNavigateToDetail]);

  const closedCount = filteredDevices.filter(d => d.switch_status === 'CLOSED').length;
  const openCount = filteredDevices.filter(d => d.switch_status === 'OPEN').length;

  return (
    <div className="space-y-4 h-[calc(100vh-6rem)] flex flex-col">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold text-slate-900 text-sm">Bản đồ GIS Lưới điện</h2>
          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-mono font-bold rounded">
            {filteredDevices.length} / {devices.length} Thiết bị có GIS
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select value={stationFilter} onChange={e => { setStationFilter(e.target.value); setFeederFilter(''); }} className="p-1.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-700">
            <option value="">Tất cả Trạm</option>
            {substations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={feederFilter} onChange={e => setFeederFilter(e.target.value)} className="p-1.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-700">
            <option value="">Tất cả Phát tuyến</option>
            {feeders.filter(f => !stationFilter || String(f.substation_id) === String(stationFilter)).map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="p-1.5 bg-slate-50 border border-slate-200 rounded font-semibold text-slate-700">
            <option value="">Loại</option>
            <option value="LBS">LBS</option>
            <option value="REC">REC</option>
            <option value="DS">DS</option>
            <option value="RMU">RMU</option>
          </select>
          <input type="text" placeholder="Tìm ID, tên..." value={search} onChange={e => setSearch(e.target.value)} className="p-1.5 bg-slate-50 border border-slate-200 rounded text-xs font-medium w-36" />
          <button onClick={() => setTileMode(prev => prev === 'osm' ? 'satellite' : 'osm')} className="p-1.5 rounded font-bold bg-slate-100 text-slate-700 border border-slate-200 transition-colors">
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-inner">
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-30 flex items-center justify-center text-xs font-bold text-slate-600">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full mr-2" />
            Đang tải bản đồ...
          </div>
        )}
        <div ref={mapContainerRef} className="w-full h-full z-10" />
        <div className="absolute bottom-4 left-4 z-20 bg-white/90 backdrop-blur-md p-3 rounded-xl border border-slate-200 shadow-lg text-[11px] space-y-1.5">
          <div className="font-bold text-slate-900 mb-1">Trạng thái:</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500 border border-white shadow-sm inline-block" /> Đang Đóng ({closedCount})</div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500 border border-white shadow-sm inline-block" /> Đang Mở ({openCount})</div>
        </div>
      </div>
    </div>
  );
};
