"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import dynamic from "next/dynamic";
import { Loader2, Save, X, Camera, Upload } from "lucide-react";

const LocationMiniMap = dynamic(
  () => import("@/components/notes/LocationMiniMap"),
  { ssr: false }
);

type FieldNote = {
  id: string;
  project_id?: string | null;
  project_name?: string | null;
  notes?: string | null;
  photos?: string[] | null;
  asset_type?: string | null;
  latitude: number;
  longitude: number;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export default function NoteEditModal({
  open,
  note,
  onClose,
  onSaved,
}: {
  open: boolean;
  note: FieldNote | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = React.useMemo(() => createClient(), []);
  const [form, setForm] = React.useState<FieldNote | null>(note);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => setForm(note), [note]);

  // Helps Leaflet recalc size when dialog opens
  React.useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
      }, 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const update = (patch: Partial<FieldNote>) =>
    setForm((f) => (f ? { ...f, ...patch } : f));

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || uploading) return;

    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        alert("Please sign in before uploading photos.");
        return;
      }

      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const key = `${uid}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("fieldnote-photos")
          .upload(key, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || `image/${ext}`,
          });

        if (upErr) {
          console.warn("Upload error:", upErr);
          alert(`Upload failed: ${upErr.message}`);
          continue;
        }
        const { data: pub } = supabase.storage
          .from("fieldnote-photos")
          .getPublicUrl(key);
        if (pub?.publicUrl) uploadedUrls.push(pub.publicUrl);
      }

      if (uploadedUrls.length) {
        update({ photos: [...(form?.photos || []), ...uploadedUrls] });
      }
    } finally {
      setUploading(false);
    }
  }

  const onSave = async () => {
    if (!form) return;
    setSaving(true);
    setError(null);

    const payload = {
      project_id: form.project_id ?? null,
      project_name: form.project_name ?? null,
      notes: form.notes ?? null,
      photos: form.photos ?? [],
      asset_type: form.asset_type ?? null,
      latitude: form.latitude,
      longitude: form.longitude,
    };

    const { error: err } = await supabase
      .from("field_notes")
      .update(payload)
      .eq("id", form.id);
    if (err) {
      setError(err.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    onSaved();
  };

  const rmPhoto = (idx: number) =>
    update({ photos: (form?.photos || []).filter((_, i) => i !== idx) });

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      {/* p-0 removes extra padding; max-h + flex layout + overflow control */}
      <DialogContent className="max-w-3xl md:max-w-4xl p-0 overflow-hidden">
        {/* Constrain total height and split header/body/footer */}
        <div className="flex max-h-[85vh] flex-col">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Edit Field Note</DialogTitle>
          </DialogHeader>

          {error && (
            <div className="px-6">
              <Alert variant="destructive" className="mb-3">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

          {/* Scrollable body */}
          <div className="px-6 pb-4 overflow-y-auto">
            {!form ? (
              <div className="py-10 text-center text-muted-foreground">
                No note loaded.
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-6">
                {/* Left column */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      ID: {form.id.slice(0, 8)}…
                    </Badge>
                    {form.created_by_name && <Badge>{form.created_by_name}</Badge>}
                  </div>

                  <div>
                    <Label>Project Name</Label>
                    <Input
                      value={form.project_name || ""}
                      onChange={(e) => update({ project_name: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>Asset Type</Label>
                    <Input
                      value={form.asset_type || ""}
                      onChange={(e) => update({ asset_type: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={form.notes || ""}
                      onChange={(e) => update({ notes: e.target.value })}
                      rows={6}
                    />
                  </div>

                  {/* Photos */}
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Photos</Label>

                    {(form.photos?.length ?? 0) > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {(form.photos || []).map((url, i) => (
                          <div
                            key={i}
                            className="relative group border rounded-md overflow-hidden"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={url}
                              alt={`photo-${i}`}
                              className="h-24 w-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => rmPhoto(i)}
                              className="absolute top-1 right-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-background/80 border opacity-0 group-hover:opacity-100 transition"
                              aria-label="Remove photo"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12"
                        onClick={() =>
                          (document.getElementById(
                            "edit-camera-upload"
                          ) as HTMLInputElement)?.click()
                        }
                        disabled={uploading}
                      >
                        {uploading ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                          <Camera className="w-5 h-5 mr-2" />
                        )}
                        Take Photo
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="h-12"
                        onClick={() =>
                          (document.getElementById(
                            "edit-file-upload"
                          ) as HTMLInputElement)?.click()
                        }
                        disabled={uploading}
                      >
                        {uploading ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-5 h-5 mr-2" />
                        )}
                        Upload Photo
                      </Button>
                    </div>

                    {/* Hidden inputs */}
                    <input
                      id="edit-camera-upload"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => handleUpload(e.currentTarget.files)}
                    />
                    <input
                      id="edit-file-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleUpload(e.currentTarget.files)}
                    />
                  </div>
                </div>

                {/* Right column */}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Latitude</Label>
                      <Input
                        type="number"
                        value={form.latitude}
                        onChange={(e) =>
                          update({ latitude: Number(e.target.value) })
                        }
                      />
                    </div>
                    <div>
                      <Label>Longitude</Label>
                      <Input
                        type="number"
                        value={form.longitude}
                        onChange={(e) =>
                          update({ longitude: Number(e.target.value) })
                        }
                      />
                    </div>
                  </div>

                  {/* Fixed-height map wrapper prevents overflow */}
                  <div className="h-64 md:h-80 rounded-md border overflow-hidden">
                    <LocationMiniMap
                      lat={form.latitude}
                      lng={form.longitude}
                      onChange={(p: { lat: number; lng: number }) =>
                        update({ latitude: p.lat, longitude: p.lng })
                      }
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sticky footer always visible */}
          <div className="mt-auto sticky bottom-0 border-t bg-background px-6 py-4 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={onSave} disabled={saving || uploading}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
