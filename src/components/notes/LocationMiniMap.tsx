"use client";

import * as React from "react";
import L, { Map as LeafletMap, Marker as LeafletMarker, Icon } from "leaflet";

export default function LocationMiniMap({
  lat,
  lng,
  geometry,
  onChange,
}: {
  lat: number;
  lng: number;
  geometry?: { type: string; coordinates?: any } | null;
  onChange: (p: { lat: number; lng: number; geometry?: any }) => void;
}) {
  const mapRef = React.useRef<LeafletMap | null>(null);
  const markerRef = React.useRef<LeafletMarker | null>(null);
  const vertexMarkersRef = React.useRef<LeafletMarker[]>([]);
  const polylineRef = React.useRef<L.Polyline | null>(null);
  const geometryRef = React.useRef<typeof geometry>(geometry);
  const divRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!divRef.current || mapRef.current) return;

    const m = L.map(divRef.current, { zoomControl: true, attributionControl: true }).setView([lat || 0, lng || 0], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(m);

    const icon = new Icon({
      iconUrl:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='%232d5f3f'%3E%3Ccircle cx='12' cy='12' r='7' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10],
    });

    const vertexIcon = new Icon({
      iconUrl:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='%230084ff'%3E%3Ccircle cx='12' cy='12' r='6' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    const mk = L.marker([lat || 0, lng || 0], { draggable: true, icon }).addTo(m);
    mk.on("dragend", () => {
      const p = mk.getLatLng();
      onChange({ lat: p.lat, lng: p.lng });
    });

    const syncLineGeometry = (geo?: { type: string; coordinates?: any }) => {
      const coords: [number, number][] =
        geo?.type === "LineString" && Array.isArray(geo.coordinates)
          ? (geo.coordinates as [number, number][])
          : [];

      if (!coords.length) {
        polylineRef.current?.remove();
        polylineRef.current = null;
        vertexMarkersRef.current.forEach((vm) => vm.remove());
        vertexMarkersRef.current = [];
        return;
      }

      const latlngs = coords.map((c) => L.latLng(c[1] ?? 0, c[0] ?? 0));

      if (!polylineRef.current) {
        polylineRef.current = L.polyline(latlngs, { color: "#0084ff", weight: 4 }).addTo(m);
      } else {
        polylineRef.current.setLatLngs(latlngs);
      }

      // Sync vertex markers with coordinates
      // Remove extras
      while (vertexMarkersRef.current.length > latlngs.length) {
        const vm = vertexMarkersRef.current.pop();
        vm?.remove();
      }

      // Add missing markers
      while (vertexMarkersRef.current.length < latlngs.length) {
        const idx = vertexMarkersRef.current.length;
        const vm = L.marker(latlngs[idx], { draggable: true, icon: vertexIcon }).addTo(m);
        vm.on("drag", () => {
          const updated = vertexMarkersRef.current.map((marker) => marker.getLatLng());
          const newCoords = updated.map((p) => [p.lng, p.lat]);
          polylineRef.current?.setLatLngs(updated);
          onChange({ lat: newCoords[0]?.[1] ?? lat, lng: newCoords[0]?.[0] ?? lng, geometry: { type: "LineString", coordinates: newCoords } });
        });
        vertexMarkersRef.current.push(vm);
      }

      // Update all marker positions to match current coordinates
      vertexMarkersRef.current.forEach((vm, i) => vm.setLatLng(latlngs[i]));
    };

    m.on("click", (e: any) => {
      mk.setLatLng(e.latlng);
      const next = { lat: e.latlng.lat, lng: e.latlng.lng };

      // If editing a line, move the first vertex to the clicked point
      const currentGeo = geometryRef.current;
      if (
        currentGeo?.type === "LineString" &&
        Array.isArray((currentGeo as any).coordinates) &&
        (currentGeo as any).coordinates.length
      ) {
        const coords = [...(currentGeo as any).coordinates];
        coords[0] = [next.lng, next.lat];
        syncLineGeometry({ type: "LineString", coordinates: coords });
        onChange({ ...next, geometry: { type: "LineString", coordinates: coords } });
        return;
      }

      onChange(next);
    });

    mapRef.current = m;
    markerRef.current = mk;

    if (geometry) syncLineGeometry(geometry);

    return () => { m.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  React.useEffect(() => {
    geometryRef.current = geometry;
  }, [geometry]);

  React.useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const p = L.latLng(lat || 0, lng || 0);
    markerRef.current.setLatLng(p);
    mapRef.current.setView(p);
  }, [lat, lng]);

  // Sync geometry updates into the map (polyline + vertices)
  React.useEffect(() => {
    if (!mapRef.current) return;
    const m = mapRef.current;

    const coords: [number, number][] =
      geometry?.type === "LineString" && Array.isArray(geometry.coordinates)
        ? (geometry.coordinates as [number, number][])
        : [];

    const latlngs = coords.map((c) => L.latLng(c[1] ?? 0, c[0] ?? 0));

    if (!coords.length) {
      polylineRef.current?.remove();
      polylineRef.current = null;
      vertexMarkersRef.current.forEach((vm) => vm.remove());
      vertexMarkersRef.current = [];
      return;
    }

    if (!polylineRef.current) {
      polylineRef.current = L.polyline(latlngs, { color: "#0084ff", weight: 4 }).addTo(m);
    } else {
      polylineRef.current.setLatLngs(latlngs);
    }

    while (vertexMarkersRef.current.length > latlngs.length) {
      const vm = vertexMarkersRef.current.pop();
      vm?.remove();
    }

    const vertexIcon = new Icon({
      iconUrl:
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='%230084ff'%3E%3Ccircle cx='12' cy='12' r='6' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });

    while (vertexMarkersRef.current.length < latlngs.length) {
      const idx = vertexMarkersRef.current.length;
      const vm = L.marker(latlngs[idx], { draggable: true, icon: vertexIcon }).addTo(m);
      vm.on("drag", () => {
        const updated = vertexMarkersRef.current.map((marker) => marker.getLatLng());
        const newCoords = updated.map((p) => [p.lng, p.lat]);
        polylineRef.current?.setLatLngs(updated);
        onChange({ lat: newCoords[0]?.[1] ?? lat, lng: newCoords[0]?.[0] ?? lng, geometry: { type: "LineString", coordinates: newCoords } });
      });
      vertexMarkersRef.current.push(vm);
    }

    vertexMarkersRef.current.forEach((vm, i) => vm.setLatLng(latlngs[i]));
  }, [geometry, lat, lng, onChange]);

  return <div ref={divRef} className="h-full w-full" />;
}
