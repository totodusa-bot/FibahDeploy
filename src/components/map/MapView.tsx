"use client";

import React from "react";
import L, { Map as LeafletMap, Marker as LeafletMarker, Icon } from "leaflet";
import { createClient } from "@/lib/supabase/client";

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
    geometry?: {
      type: string;
      coordinates?: any;
    } | null;
  }>;
  draftPath?: LatLng[];
  draftAssetType?: string | null;
  onDraftVertexMove?: (index: number, p: LatLng) => void;
  locationConfirmed?: boolean;
  overlayEnabled?: boolean;
  overlayStoragePath?: string | null;
}

const userIcon = new Icon({
  iconUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='%232d5f3f'%3E%3Ccircle cx='12' cy='12' r='8' stroke='white' stroke-width='3'/%3E%3C/svg%3E",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

function getAssetColor(assetType?: string | null) {
  switch (assetType) {
    case "Conduit":
      return "#f97316"; // orange
    case "Cable":
      return "#39ff14"; // neon green
    case "Vault":
      return "#7e22ce"; // purple
    case "Cabinet":
      return "#eab308"; // yellow
    case "Flower Pot":
      return "#14532d"; // dark green
    case "Pedestal":
      return "#111111"; // black
    default:
      return "#1e3a5f"; // fallback
  }
}

const markerIcon = new Icon({
  iconUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24' fill='%23ff6b35'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z'/%3E%3C/svg%3E",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

const lineIcon = new Icon({
  iconUrl: "data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%3E%0A%20%20%3Cpath%20d%3D%22M12%202L4%2010L12%2022L20%2010Z%22%20fill%3D%22%23ea580c%22/%3E%0A%20%20%3Ccircle%20cx%3D%2212%22%20cy%3D%2211%22%20r%3D%223%22%20fill%3D%22white%22/%3E%0A%3C/svg%3E",
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

const vertexIcon = new Icon({
  iconUrl:
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 18 18'%3E%3Ccircle cx='9' cy='9' r='4' fill='%23ffffff' stroke='%23000000' stroke-width='1.5'/%3E%3C/svg%3E",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export default function MapView({
  userLocation,
  markerPosition,
  onMapClick,
  selectedProject,
  onMarkerDragEnd,
  existingNotes = [],
  draftPath = [],
  draftAssetType,
  onDraftVertexMove,
  locationConfirmed,
  overlayEnabled = false,
  overlayStoragePath = null,
}: MapViewProps) {
  const supabase = React.useMemo(() => createClient(), []);

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const userMarkerRef = React.useRef<LeafletMarker | null>(null);
  const dragMarkerRef = React.useRef<LeafletMarker | null>(null);
  const notesLayerRef = React.useRef<L.LayerGroup | null>(null);
  const draftLayerRef = React.useRef<L.LayerGroup | null>(null);
  const overlayLayerRef = React.useRef<L.GeoJSON | null>(null);

  // Base layers
  const osmRef = React.useRef<L.TileLayer | null>(null);
  const esriRef = React.useRef<L.TileLayer | null>(null);
  const currentBaseRef = React.useRef<"osm" | "sat">("osm");

  // latest click handler
  const onMapClickRef = React.useRef(onMapClick);
  React.useEffect(() => {
    onMapClickRef.current = onMapClick;
  }, [onMapClick]);

  // stable drag-end callback ref so we don't recreate marker on every render
  const onMarkerDragEndRef = React.useRef(onMarkerDragEnd);
  React.useEffect(() => {
    onMarkerDragEndRef.current = onMarkerDragEnd;
  }, [onMarkerDragEnd]);

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
    const draftLayer = L.layerGroup().addTo(map);
    draftLayerRef.current = draftLayer;

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
      dragMarkerRef.current = null;
      draftLayerRef.current = null;
      notesLayerRef.current = null;
      if (overlayLayerRef.current) {
        overlayLayerRef.current = null;
      }
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


  // overlay GeoJSON renderer
  React.useEffect(() => {
    if (!mapRef.current) return;

    if (!overlayEnabled || !overlayStoragePath) {
      if (overlayLayerRef.current) {
        mapRef.current.removeLayer(overlayLayerRef.current);
        overlayLayerRef.current = null;
      }
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.storage
          .from("project-overlays")
          .download(overlayStoragePath);

        if (error || !data) {
          console.warn("Failed to download overlay", error);
          return;
        }

        const text = await data.text();
        const geojson = JSON.parse(text);

        if (!mapRef.current || cancelled) return;

        if (overlayLayerRef.current) {
          mapRef.current.removeLayer(overlayLayerRef.current);
        }

        const layer = L.geoJSON(geojson as any, {
          style: {
            color: "#2563eb",
            weight: 2,
            opacity: 0.9,
          },
          pointToLayer: (feature, latlng) => {
            const circle = L.circleMarker(latlng, {
              radius: 3,
              color: "#1d4ed8",
              weight: 1.5,
              fillColor: "#2563eb",
              fillOpacity: 0.9,
              opacity: 0.9,
              pane: "overlayPane",
            });

            if (feature?.properties) {
              const name = feature.properties.name || feature.properties.title;
              if (name) {
                circle.bindTooltip(String(name), {
                  permanent: false,
                  direction: "top",
                  offset: [0, -8],
                  className: "overlay-point-label",
                });
              }
            }

            return circle;
          },
        }).addTo(mapRef.current);

        overlayLayerRef.current = layer;
      } catch (err) {
        console.error("Error rendering overlay", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [overlayEnabled, overlayStoragePath, supabase]);

  // render notes (always on)
  React.useEffect(() => {
    if (!notesLayerRef.current) return;
    notesLayerRef.current.clearLayers();

    existingNotes.forEach((note) => {
      const isLineAsset = note.asset_type === "Conduit" || note.asset_type === "Cable";
      const geom = note.geometry;
      const assetColor = getAssetColor(note.asset_type);

      const html = `
        <div class="custom-popup">
          <div class="popup-project-name" style="font-weight:600;font-size:14px;margin-bottom:4px;border-bottom:2px solid rgba(255,255,255,.2);padding-bottom:6px;">
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

      // Draw line geometry first, if available
      if (isLineAsset && geom && geom.type === "LineString" && Array.isArray(geom.coordinates)) {
        const coords = (geom.coordinates as [number, number][]).map(
          (c) => [c[1], c[0]] as [number, number] // [lat, lng]
        );
        if (coords.length >= 2) {
          const isConduit = note.asset_type === "Conduit";
          const polyline = L.polyline(coords, {
            color: assetColor,
            weight: isConduit ? 5 : 6,
            dashArray: isConduit ? "6 6" : undefined,
          });
          polyline.bindPopup(html, { className: "custom-popup" });
          polyline.addTo(notesLayerRef.current!);
          return;
        }
      }

      // For point assets (and line fallback when no valid geometry), use a compact color marker.
      const point = L.circleMarker([note.latitude, note.longitude], {
        radius: 7,
        color: assetColor,
        fillColor: assetColor,
        fillOpacity: 0.95,
        weight: 2,
      });
      point.bindPopup(html, { className: "custom-popup" });
      point.addTo(notesLayerRef.current!);
    });
  }, [existingNotes]);
  // render draft line for line assets while placing
  React.useEffect(() => {
    if (!draftLayerRef.current) return;
    draftLayerRef.current.clearLayers();

    if (!draftPath || draftPath.length === 0) return;

    const isLineDraft = draftAssetType === "Conduit" || draftAssetType === "Cable";
    if (!isLineDraft) return;

    const coords = draftPath.map((p) => [p.lat, p.lng] as [number, number]);

    if (coords.length >= 2) {
      const isConduit = draftAssetType === "Conduit";
      const poly = L.polyline(coords, {
        weight: isConduit ? 3 : 4,
        dashArray: isConduit ? "6 6" : undefined,
      });
      poly.addTo(draftLayerRef.current!);
    }

    coords.forEach((c, idx) => {
      // First vertex (starting point) should not be draggable once confirmed;
      // here we just show it as a small vertex marker.
      if (idx === 0) {
        const v = L.circleMarker(c, {
          radius: 4,
        });
        v.addTo(draftLayerRef.current!);
        return;
      }

      // Subsequent vertices are draggable so the user can refine the path
      const v = L.marker(c, {
        icon: vertexIcon,
        draggable: true,
        keyboard: false,
      });

      v.on("dragend", () => {
        const p = v.getLatLng();
        if (typeof (onDraftVertexMove as any) === "function") {
          (onDraftVertexMove as any)(idx, { lat: p.lat, lng: p.lng });
        }
      });

      v.addTo(draftLayerRef.current!);
    });
  }, [draftPath, draftAssetType, onDraftVertexMove]);
  // draggable “new note” marker
  React.useEffect(() => {
    if (!mapRef.current) return;

    if (dragMarkerRef.current) {
      dragMarkerRef.current.off();
      mapRef.current.removeLayer(dragMarkerRef.current);
      dragMarkerRef.current = null;
    }

    if (!markerPosition) {
      mapRef.current.closePopup();
      return;
    }

    const isLineDraft = draftAssetType === "Conduit" || draftAssetType === "Cable";
    const activeIcon = isLineDraft ? lineIcon : markerIcon;
    const canDragStart = !locationConfirmed;

    const dragMarker = L.marker([markerPosition.lat, markerPosition.lng], {
      icon: activeIcon,
      draggable: canDragStart,
      autoPan: true,
      autoPanPadding: [30, 30],
      keyboard: false,
    }).addTo(mapRef.current);

    // Only show the helper popup while we're still choosing the starting point.
    if (!locationConfirmed) {
      dragMarker
        .bindPopup(
          `<div class="text-center">
             <p class="font-semibold" style="color:#ea580c">New Marker</p>
             <p class="text-xs" style="color:#475569">${markerPosition.lat.toFixed(6)}, ${markerPosition.lng.toFixed(6)}</p>
             ${
               selectedProject
                 ? `<p class="text-xs" style="color:#64748b;margin-top:4px">${selectedProject.name}</p>`
                 : ""
             }
             <p class="text-xs" style="color:#ea580c;margin-top:4px;font-weight:600">Drag to adjust</p>
           </div>`
        )
        .openPopup();

      setTimeout(() => {
        if (dragMarkerRef.current === dragMarker) {
          dragMarker.closePopup();
        }
      }, 3000);
    }

    if (canDragStart) {
      dragMarker.on("dragend", () => {
        const p = dragMarker.getLatLng();
        if (onMarkerDragEndRef.current) {
          onMarkerDragEndRef.current({ lat: p.lat, lng: p.lng });
        }
      });
    }

    dragMarkerRef.current = dragMarker;
  }, [markerPosition, selectedProject, draftAssetType, locationConfirmed]);

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
