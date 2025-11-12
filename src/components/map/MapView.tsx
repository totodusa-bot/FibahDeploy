"use client";

import React from "react";
import L, { Map as LeafletMap, Marker as LeafletMarker, Icon } from "leaflet";

type LatLng = { lat: number; lng: number };

interface MapViewProps {
  userLocation: LatLng;
  markerPosition: LatLng | null;
  onMapClick: (p: LatLng) => void;
  selectedProject: any | null;
  onMarkerDragEnd: (p: LatLng) => void;
  existingNotes: Array<{
    id: string;
    latitude: number;
    longitude: number;
    project_name: string;
    notes: string;
    created_by_name: string;
    asset_type?: string | null;
  }>;
}

const userIcon = new Icon({
  iconUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='%232d5f3f'%3E%3Ccircle cx='12' cy='12' r='8' stroke='white' stroke-width='3'/%3E%3C/svg%3E",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const markerIcon = new Icon({
  iconUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='%23ff6b35'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

const existingNoteIcon = new Icon({
  iconUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24' fill='%231e3a5f'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E",
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

export default function MapView({
  userLocation,
  markerPosition,
  onMapClick,
  selectedProject,
  onMarkerDragEnd,
  existingNotes = [],
}: MapViewProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const userMarkerRef = React.useRef<LeafletMarker | null>(null);
  const dragMarkerRef = React.useRef<LeafletMarker | null>(null);
  const notesLayerRef = React.useRef<L.LayerGroup | null>(null);

  // Base layers
  const osmRef = React.useRef<L.TileLayer | null>(null);
  const esriRef = React.useRef<L.TileLayer | null>(null);
  const currentBaseRef = React.useRef<"osm" | "sat">("osm");

  // latest click handler
  const onMapClickRef = React.useRef(onMapClick);
  React.useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // init once
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [userLocation.lat, userLocation.lng],
      zoom: 16,
      minZoom: 3,
      maxZoom: 19,          // clamp to provider native max
      zoomSnap: 1,
      zoomDelta: 1,
      zoomControl: true,
      preferCanvas: true,
      worldCopyJump: false, // avoid wrap “teleport”
    });
    mapRef.current = map;

    // --- Street (OSM) ---
    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxNativeZoom: 19,
      maxZoom: 19,
      noWrap: true, // prevent world repeats that can misalign when switching
      bounds: [[-85, -180], [85, 180]],
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    // --- Satellite (Esri World Imagery): NOTE {z}/{y}/{x} (not x/y) ---
    const esriSat = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        maxNativeZoom: 19, // many areas top out at ~19; clamp here
        maxZoom: 19,
        noWrap: true,
        bounds: [[-85, -180], [85, 180]],
        updateWhenIdle: true,
        attribution:
          "Tiles &copy; Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
      }
    );

    osmRef.current = osm;
    esriRef.current = esriSat;
    currentBaseRef.current = "osm";

    // Click to drop/move waypoint
    const handleClick = (e: L.LeafletMouseEvent) => {
      onMapClickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    };
    map.on("click", handleClick);

    // Notes (always on)
    const notesLayer = L.layerGroup().addTo(map);
    notesLayerRef.current = notesLayer;

    // User marker
    userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
      icon: userIcon,
      keyboard: false,
    })
      .addTo(map)
      .on("click", () => {
        onMapClickRef.current({ lat: userLocation.lat, lng: userLocation.lng });
      });

    // Pill switch control
    const SwitchControl = L.Control.extend({
      options: { position: "topright" as L.ControlPosition },
      onAdd: () => {
        const div = L.DomUtil.create("div", "leaflet-bar");
        div.style.background = "white";
        div.style.borderRadius = "8px";
        div.style.boxShadow = "0 2px 8px rgba(0,0,0,.15)";
        div.style.overflow = "hidden";
        div.style.display = "flex";
        div.style.fontFamily = "system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif";

        const btn = L.DomUtil.create("button", "", div);
        btn.type = "button";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.padding = "6px 10px";
        btn.style.border = "none";
        btn.style.background = "transparent";
        btn.style.cursor = "pointer";
        btn.style.fontSize = "13px";

        const pill = L.DomUtil.create("div", "", btn);
        pill.style.display = "grid";
        pill.style.gridTemplateColumns = "1fr 1fr";
        pill.style.border = "1px solid #e5e7eb";
        pill.style.borderRadius = "9999px";
        pill.style.overflow = "hidden";

        const left = L.DomUtil.create("div", "", pill);
        left.textContent = "Street";
        left.style.padding = "4px 10px";

        const right = L.DomUtil.create("div", "", pill);
        right.textContent = "Satellite";
        right.style.padding = "4px 10px";

        const setActive = (base: "osm" | "sat") => {
          left.style.background = base === "osm" ? "#e5f3ea" : "transparent";
          left.style.fontWeight = base === "osm" ? "700" : "500";
          right.style.background = base === "sat" ? "#e5f3ea" : "transparent";
          right.style.fontWeight = base === "sat" ? "700" : "500";
        };
        setActive("osm");

        L.DomEvent.disableClickPropagation(div);
        L.DomEvent.disableScrollPropagation(div);

        const toggle = () => {
          if (!mapRef.current || !osmRef.current || !esriRef.current) return;
          const map = mapRef.current;
          const center = map.getCenter();
          const zoom = Math.min(map.getZoom(), 19); // never exceed native

          if (currentBaseRef.current === "osm") {
            if (map.hasLayer(osmRef.current)) map.removeLayer(osmRef.current);
            esriRef.current.addTo(map);
            currentBaseRef.current = "sat";
            setActive("sat");
          } else {
            if (map.hasLayer(esriRef.current)) map.removeLayer(esriRef.current);
            osmRef.current.addTo(map);
            currentBaseRef.current = "osm";
            setActive("osm");
          }
          map.setView(center, zoom, { animate: false }); // preserve view, no drift
        };

        btn.onclick = toggle;
        return div;
      },
    });

    map.addControl(new SwitchControl());

    return () => {
      map.off("click", handleClick);
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      dragMarkerRef.current = null;
      notesLayerRef.current = null;
      osmRef.current = null;
      esriRef.current = null;
      currentBaseRef.current = "osm";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep user marker + view synced
  React.useEffect(() => {
    if (!mapRef.current || !userMarkerRef.current) return;
    userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    mapRef.current.setView([userLocation.lat, userLocation.lng], mapRef.current.getZoom());
  }, [userLocation]);

  // render notes (always on)
  React.useEffect(() => {
    if (!notesLayerRef.current) return;
    notesLayerRef.current.clearLayers();

    existingNotes.forEach((note) => {
      const m = L.marker([note.latitude, note.longitude], {
        icon: existingNoteIcon,
        keyboard: false,
      });
      const html = `
        <div class="custom-popup">
          <div class="popup-project-name" style="font-weight:700;font-size:16px;margin-bottom:8px;color:#fff;border-bottom:2px solid rgba(255,255,255,.2);padding-bottom:6px;">
            ${note.project_name}
          </div>
          ${note.asset_type ? `
          <div class="popup-asset" style="font-size:12px;color:#cfead8;margin-bottom:6px;">
            Asset: <strong>${note.asset_type}</strong>
          </div>` : ``}
          <div class="popup-notes" style="font-size:14px;line-height:1.5;margin-bottom:10px;color:rgba(255,255,255,.95);">
            ${note.notes}
          </div>
          <div class="popup-coords" style="font-size:11px;color:rgba(255,255,255,.7);font-family:monospace;margin-bottom:6px;">
            ${note.latitude.toFixed(6)}, ${note.longitude.toFixed(6)}
          </div>
          <div class="popup-author" style="font-size:12px;color:rgba(255,255,255,.8);display:flex;gap:4px;">
            <span class="popup-author-label" style="font-weight:600;">By:</span><span>${note.created_by_name}</span>
          </div>
        </div>`;
      m.bindPopup(html, { className: "custom-popup" });
      m.addTo(notesLayerRef.current!);
    });
  }, [existingNotes]);

  // draggable “new note” marker
  React.useEffect(() => {
    if (!mapRef.current) return;

    if (dragMarkerRef.current) {
      mapRef.current.closePopup();
      dragMarkerRef.current.off();
      mapRef.current.removeLayer(dragMarkerRef.current);
      dragMarkerRef.current = null;
    }

    if (!markerPosition) {
      mapRef.current.closePopup();
      return;
    }

    const dragMarker = L.marker([markerPosition.lat, markerPosition.lng], {
      icon: markerIcon,
      draggable: true,
      autoPan: true,
      autoPanPadding: [30, 30],
      keyboard: false,
    })
      .addTo(mapRef.current)
      .bindPopup(
        `<div class="text-center">
           <p class="font-semibold" style="color:#ea580c">New Marker</p>
           <p class="text-xs" style="color:#475569">${markerPosition.lat.toFixed(6)}, ${markerPosition.lng.toFixed(6)}</p>
           ${selectedProject ? `<p class="text-xs" style="color:#64748b;margin-top:4px">${selectedProject.name}</p>` : ""}
           <p class="text-xs" style="color:#ea580c;margin-top:4px;font-weight:600">Drag to adjust</p>
         </div>`
      )
      .openPopup();

    dragMarker.on("dragend", () => {
      const p = dragMarker.getLatLng();
      onMarkerDragEnd({ lat: p.lat, lng: p.lng });
    });

    dragMarkerRef.current = dragMarker;
  }, [markerPosition, selectedProject, onMarkerDragEnd]);

  return (
    <>
      <style>{`
        .custom-popup .leaflet-popup-content-wrapper {
          background: linear-gradient(135deg, #1e3a5f 0%, #2d5f3f 100%);
          color: white; border-radius: 12px; padding: 0;
          box-shadow: 0 10px 30px rgba(0,0,0,.3);
        }
        .custom-popup .leaflet-popup-content { margin: 0; padding: 16px; min-width: 200px; max-width: 300px; }
        .custom-popup .leaflet-popup-tip { background: #2d5f3f; }
      `}</style>
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ background: "#f0f4f8", position: "relative", zIndex: 1 }}
      />
    </>
  );
}
