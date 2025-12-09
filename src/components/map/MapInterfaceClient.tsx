"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff, Crosshair, CheckCircle, X, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import NoteForm from "./NoteForm";
import ProjectSelector from "./ProjectSelector";
import { useSearchParams, useRouter, usePathname } from "next/navigation"; // URL sync + read ?project

const MapView = dynamic(() => import("./MapView"), { ssr: false });

const DEFAULT_LOCATION = { lat: 25.9087, lng: -80.3087 }; // Miami Lakes
const almostEqual = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) < eps;

type LatLng = { lat: number; lng: number };
type NotePayload = { notes: string; photos: string[]; assetType: string | null };

export default function MapInterfaceClient() {
  const supabase = React.useMemo(() => createClient(), []);
  const searchParams = useSearchParams();                // read current query
  const router = useRouter();                            // update query without reload
  const pathname = usePathname();                        // current route path

  // Read the project id from URL (?project= or ?projectId=)
  const initialProjectId = React.useMemo(
    () => (searchParams?.get("project") || searchParams?.get("projectId") || ""),
    [searchParams]
  );

  const [projects, setProjects] = React.useState<any[]>([]);
  const [selectedProject, setSelectedProject] = React.useState<any | null>(null);
  const [notes, setNotes] = React.useState<any[]>([]);

  const [userLocation, setUserLocation] = React.useState<LatLng | null>(null);
  const [markerPosition, setMarkerPosition] = React.useState<LatLng | null>(null);
  const [confirmedPosition, setConfirmedPosition] = React.useState<LatLng | null>(null);
  const [showNoteForm, setShowNoteForm] = React.useState(false);
  const [showExistingNotes, setShowExistingNotes] = React.useState(false);
  const [locationError, setLocationError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [clickPath, setClickPath] = React.useState<LatLng[]>([]);
  const [draftAssetType, setDraftAssetType] = React.useState<string | null>(null);
  const [overlays, setOverlays] = React.useState<any[]>([]);
  const [overlayEnabled, setOverlayEnabled] = React.useState(false);
  const [selectedOverlayId, setSelectedOverlayId] = React.useState<string | "">("");

  // Track last project to trigger map resets on change
  const prevProjectIdRef = React.useRef<string | null>(null);

  // Track if we've already applied the URL preselect once
  const urlPreselectApplied = React.useRef(false);

  
  // Load overlays for the selected project
  React.useEffect(() => {
    if (!selectedProject) {
      setOverlays([]);
      setSelectedOverlayId("");
      setOverlayEnabled(false);
      return;
    }

    let cancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("project_overlays")
        .select("id, name, storage_path")
        .eq("project_id", selectedProject.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;

      if (error) {
        console.warn("[overlays] query error:", error);
        setOverlays([]);
        return;
      }

      setOverlays(data || []);

      setSelectedOverlayId((prev) => {
        if (prev && (data || []).some((o) => String(o.id) === String(prev))) {
          return prev; // keep if still valid for this project
        }
        return data?.[0]?.id || ""; // default to newest overlay or clear
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedProject, supabase]);

  // Soft reset map UI when switching projects via dropdown/URL
  React.useEffect(() => {
    const currentId = selectedProject ? String(selectedProject.id) : null;
    const prevId = prevProjectIdRef.current;

    if (prevId === currentId) return;

    prevProjectIdRef.current = currentId;

    // Clear map interaction state so overlays/notes reload cleanly
    setOverlayEnabled(false);
    setSelectedOverlayId("");
    setShowNoteForm(false);
    setMarkerPosition(null);
    setConfirmedPosition(null);
    setClickPath([]);
    setDraftAssetType(null);
  }, [selectedProject]);

// Load projects (tolerant to casing; no fragile user filters)
  React.useEffect(() => {
    let alive = true;
    async function load() {
      const tables = ["projects", "Project"];
      let found: any[] | null = null;

      for (const t of tables) {
        const { data, error } = await supabase
          .from(t as any)
          .select("id, name, status, created_at")
          .order("created_at", { ascending: false });

        if (error) {
          console.warn(`[projects] query error on ${t}:`, error);
          continue;
        }
        if (data && data.length) {
          found = data;
          break;
        }
      }

      if (alive) {
        setProjects(found ?? []);
        // default to first project; URL preselect (below) will override once if present
        setSelectedProject((prev: any | null) => prev ?? (found?.[0] ?? null));
        if (!found) console.warn("No projects returned. Check table name or RLS.");
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [supabase]);

  // After projects load, if URL provided a project id, preselect it ONCE.
  React.useEffect(() => {
    if (urlPreselectApplied.current) return;                 
    if (!projects.length || !initialProjectId) return;

    const match = projects.find((p: any) => String(p.id) === String(initialProjectId));
    if (match) {
      setSelectedProject(match);
      urlPreselectApplied.current = true;                     
    }
  }, [projects, initialProjectId]); // no selectedProject in deps → don't fight the dropdown

  // Load notes (tolerant to casing) — includes asset_type
  React.useEffect(() => {
    let alive = true;
    async function loadNotes() {
      const tables = ["field_notes", "FieldNote"];
      for (const t of tables) {
        const { data, error } = await supabase
          .from(t as any)
          .select(
            "id, project_id, project_name, created_by_name, latitude, longitude, geometry, notes, photos, asset_type, is_deleted, created_at"
          )
          .order("created_at", { ascending: false });

        if (!error && data) {
          if (alive) setNotes(data);
          return;
        }
      }
      console.warn("No field notes returned. Check table name or RLS.");
    }
    loadNotes();
    return () => {
      alive = false;
    };
  }, [supabase]);

  // Geolocation
  React.useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationError(null);
        },
        () => {
          setLocationError("Unable to get your location. Showing Miami Lakes, FL area.");
          setUserLocation(DEFAULT_LOCATION);
        }
      );
    } else {
      setLocationError("Geolocation not supported. Showing Miami Lakes, FL area.");
      setUserLocation(DEFAULT_LOCATION);
    }
  }, []);

  const existingNotes = React.useMemo(() => {
    if (!selectedProject || !showExistingNotes) return [] as any[];
    return (notes || []).filter((n: any) => n.project_id === selectedProject.id && !n.is_deleted);
  }, [selectedProject, showExistingNotes, notes]);


  // Map handlers
  const handleMapClick = (p: LatLng) => {
    if (!selectedProject) {
      alert("Please select a project first");
      return;
    }

    if (!showNoteForm) {
      // Selecting or adjusting the starting point before confirming
      setMarkerPosition(p);
      setConfirmedPosition(null);
    } else {
      // While the note form is open, treat additional clicks as extra vertices
      setClickPath((prev) => [...prev, p]);
    }
  };
  const handleMarkerDragEnd = (p: LatLng) => setMarkerPosition(p);


  const centerOnUser = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationError(null);
      },
      () => {
        setLocationError("Unable to get your location. Showing Miami Lakes, FL area.");
        setUserLocation(DEFAULT_LOCATION);
      }
    );
  };

  // Save note — writes assetType → asset_type (only if provided)
  async function handleSaveNote(payload: NotePayload) {
    if (!selectedProject || !confirmedPosition || isSaving) return;
    setIsSaving(true);

    // duplicate protection at same coords (based on starting point)
    const dup = notes.find(
      (n: any) =>
        !n.is_deleted &&
        n.project_id === selectedProject.id &&
        almostEqual(n.latitude, confirmedPosition.lat) &&
        almostEqual(n.longitude, confirmedPosition.lng)
    );
    if (dup) {
      const ok = confirm("A note already exists at this exact location. Archive old note and create a new one?");
      if (!ok) {
        setIsSaving(false);
        return;
      }
      await supabase.rpc("soft_delete_field_note", { p_note_id: dup.id }).throwOnError();
    }

    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    const displayName = user?.user_metadata?.full_name || user?.email || "Unknown";

    const isLineAsset = payload.assetType === "Conduit" || payload.assetType === "Cable";

    // Build the vertex list:
    // - For line assets, clickPath includes the starting point (confirmedPosition) plus any extra vertices.
    // - For point assets, just use confirmedPosition.
    const vertices: LatLng[] =
      isLineAsset && clickPath.length >= 1 ? clickPath : [confirmedPosition];

    const start = vertices[0];

    // Build row; omit asset_type if not set so DB default 'Unknown' applies
    const row: any = {
      project_id: selectedProject.id,
      project_name: selectedProject.name,
      created_by: user?.id,
      created_by_name: displayName,
      latitude: start.lat,
      longitude: start.lng,
      notes: payload.notes ?? null,
      photos: payload.photos ?? [],
      is_deleted: false,
    };

    // Geometry: store full LineString for Conduit/Cable when we have 2+ vertices,
    // otherwise store a Point for compatibility and future use.
    if (isLineAsset && vertices.length >= 2) {
      row.geometry = {
        type: "LineString",
        coordinates: vertices.map((v) => [v.lng, v.lat]),
      };
    } else {
      row.geometry = {
        type: "Point",
        coordinates: [start.lng, start.lat],
      };
    }

    if (payload.assetType) row.asset_type = payload.assetType;

    const { data, error } = await supabase.from("field_notes").insert(row).select().single();

    if (!error && data) {
      setNotes((prev) => [data, ...prev]);
      setShowNoteForm(false);
      setMarkerPosition(null);
      setConfirmedPosition(null);
      setClickPath([]);
      setDraftAssetType(null);
    } else {
      console.warn("[field_notes] insert error:", error);
      alert("Could not save note. Check console for details.");
    }
    setIsSaving(false);
  }

  // Helper to sync the dropdown selection into the URL (no history spam)
  const updateProjectParam = React.useCallback((proj: any | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (proj?.id) params.set("project", String(proj.id));
    else params.delete("project");
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname);
  }, [router, pathname, searchParams]);

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Top controls */}
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 min-w-[220px]">
          <ProjectSelector
            projects={projects}
            selectedProject={selectedProject}
            onSelect={(p) => {                    // sync state + URL
              setSelectedProject(p);
              updateProjectParam(p);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          {selectedProject && (
            <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-lg px-3 py-2 h-12">
              {showExistingNotes ? <Eye className="w-4 h-4 text-emerald-700" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
              <Label htmlFor="show-notes" className="text-sm font-medium cursor-pointer">
                Notes
              </Label>
              <Switch id="show-notes" checked={showExistingNotes} onCheckedChange={setShowExistingNotes} />
            </div>
          )}
          <Button onClick={centerOnUser} variant="outline" className="h-12">
            <Crosshair className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {locationError && (
        <Alert className="mb-3 border-red-200 bg-red-50 text-red-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5" />
            <AlertDescription>{locationError}</AlertDescription>
          </div>
        </Alert>
      )}

      {!selectedProject && (
        <Alert className="mb-3 bg-orange-50 border-orange-200">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              Please select a project before placing markers on the map
            </AlertDescription>
          </div>
        </Alert>
      )}

      {/* Map - Fixed height (70% of viewport) ensures map renders correctly */}
      <div className="relative w-full h-[70vh] min-h-[500px] rounded-lg border border-slate-200 overflow-visible md:overflow-hidden">
        {userLocation && (
          <MapView
            userLocation={userLocation}
            markerPosition={markerPosition}
            onMapClick={handleMapClick}
            onMarkerDragEnd={handleMarkerDragEnd}
            selectedProject={selectedProject}
            existingNotes={existingNotes}
            draftPath={showNoteForm ? clickPath : []}
            draftAssetType={draftAssetType}
            onDraftVertexMove={(idx, p) => {
              setClickPath((prev) =>
                prev.map((pt, i) => (i === idx ? { lat: p.lat, lng: p.lng } : pt))
              );
            }}
            locationConfirmed={!!confirmedPosition}
            overlayEnabled={overlayEnabled}
            overlayStoragePath={
              overlayEnabled && selectedOverlayId && overlays.length
                ? overlays.find((o) => o.id === selectedOverlayId)?.storage_path ?? null
                : null
            }
          />
        )}

        {markerPosition && !showNoteForm && (
          <div className="absolute bottom-4 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:w-auto z-[1000]">
            <Card className="border-2 border-orange-500 shadow-2xl bg-white">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row items-center gap-3">
                  <div className="text-center md:text-left">
                    <p className="font-semibold text-slate-900 text-lg">Position Marker</p>
                    <p className="text-sm text-slate-600">Drag marker to adjust, then confirm location</p>
                  </div>
                  <div className="flex gap-2 w-full md:w-auto">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setMarkerPosition(null);
                        setConfirmedPosition(null);
                        setClickPath([]);
                        setDraftAssetType(null);
                      }}
                      className="flex-1 md:flex-initial h-12 px-4"
                      disabled={isSaving}
                    >
                      <X className="w-5 h-5 mr-2" /> Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (!markerPosition) return;
                        setConfirmedPosition(markerPosition);
                        setClickPath([markerPosition]);
                        setDraftAssetType(null);
                        setShowNoteForm(true);
                      }}
                      className="flex-1 md:flex-initial h-12 px-6"
                    >
                      <CheckCircle className="w-5 h-5 mr-2" /> Confirm Location
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {showNoteForm && confirmedPosition && (
          <div
            className="
              mt-4
              md:mt-0
              md:absolute
              md:bottom-4
              md:right-4
              md:left-auto
              md:w-96
              z-[1000]
            "
          >
            <NoteForm
              onSave={handleSaveNote}
              onCancel={() => {
                setShowNoteForm(false);
                setMarkerPosition(null);
                setConfirmedPosition(null);
                setClickPath([]);
                setDraftAssetType(null);
                setDraftAssetType(null);
              }}
              isLoading={isSaving}
              position={confirmedPosition}
              lineVertexCount={clickPath.length}
              onAssetTypeChange={setDraftAssetType}
            />
          </div>
        )}
      </div>

      {/* Overlay Plans - sits under the map on all screens */}
      {selectedProject && (
        <div className="mt-4 w-full">
          <Card className="bg-white shadow-sm border border-slate-200">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-slate-800">Overlay Plans</span>
                <div className="flex items-center gap-1">
                  <span className="text-[11px] text-slate-500">Off</span>
                  <Switch
                    checked={overlayEnabled}
                    onCheckedChange={(v) => setOverlayEnabled(Boolean(v))}
                    disabled={!overlays.length}
                  />
                  <span className="text-[11px] text-slate-500">On</span>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Overlay file</Label>
                <select
                  className="w-full rounded-md border border-slate-300 px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  disabled={!overlays.length}
                  value={selectedOverlayId}
                  onChange={(e) => setSelectedOverlayId(e.target.value)}
                >
                  {overlays.length === 0 && <option value="">No overlays</option>}
                  {overlays.length > 0 && !selectedOverlayId && (
                    <option value="">Select overlay…</option>
                  )}
                  {overlays.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </div>

              {overlays.length === 0 && (
                <p className="text-[11px] text-slate-500">
                  Upload GeoJSON overlays to this project to enable map plans.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
