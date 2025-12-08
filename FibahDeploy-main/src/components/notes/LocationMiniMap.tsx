"use client";

import * as React from "react";
import L, { Map as LeafletMap, Marker as LeafletMarker, Icon } from "leaflet";

export default function LocationMiniMap({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (p: { lat: number; lng: number }) => void;
}) {
  const mapRef = React.useRef<LeafletMap | null>(null);
  const markerRef = React.useRef<LeafletMarker | null>(null);
  const divRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!divRef.current || mapRef.current) return;

    const m = L.map(divRef.current, { zoomControl: true, attributionControl: true }).setView([lat || 0, lng || 0], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);

    const icon = new Icon({
      iconUrl:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 24 24' fill='%232d5f3f'%3E%3Ccircle cx='12' cy='12' r='8' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -28],
    });

    const mk = L.marker([lat || 0, lng || 0], { draggable: true, icon }).addTo(m);
    mk.on("dragend", () => {
      const p = mk.getLatLng();
      onChange({ lat: p.lat, lng: p.lng });
    });

    m.on("click", (e: any) => {
      mk.setLatLng(e.latlng);
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapRef.current = m;
    markerRef.current = mk;

    return () => { m.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  React.useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const p = L.latLng(lat || 0, lng || 0);
    markerRef.current.setLatLng(p);
    mapRef.current.setView(p);
  }, [lat, lng]);

  return <div ref={divRef} className="h-full w-full" />;
}
