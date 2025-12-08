"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Camera, Loader2, Upload } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = {
  onSave: (payload: { notes: string; photos: string[]; assetType: string | null }) => void;
  onCancel: () => void;
  isLoading: boolean;
  position: { lat: number; lng: number };
};

export default function NoteForm({ onSave, onCancel, isLoading, position }: Props) {
  const supabase = React.useMemo(() => createClient(), []);
  const [notes, setNotes] = React.useState("");
  const [photos, setPhotos] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [assetType, setAssetType] = React.useState<string>(""); // empty means not chosen yet

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0 || uploading) return;

    setUploading(true);
    try {
      // Ensure user is authenticated (required by storage RLS)
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        alert("Please sign in before uploading photos.");
        return;
      }

      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        // Build a key under the user's folder to satisfy RLS:
        // <uid>/<timestamp>_<uuid>.<ext>
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const rand =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : Math.random().toString(36).slice(2);
        const key = `${uid}/${Date.now()}_${rand}.${ext}`;

        const { error: upErr } = await supabase.storage
          .from("fieldnote-photos") // ← your bucket
          .upload(key, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || `image/${ext}`,
          });

        if (upErr) {
          console.warn("Upload error:", upErr);
          alert(`Upload failed: ${upErr.message}`);
          continue; // skip this file, try the rest
        }

        // Public bucket: get a public URL for immediate rendering
        const { data: pub } = supabase.storage.from("fieldnote-photos").getPublicUrl(key);
        if (pub?.publicUrl) uploadedUrls.push(pub.publicUrl);
      }

      if (uploadedUrls.length) {
        setPhotos((prev) => [...prev, ...uploadedUrls]);
      }
    } finally {
      setUploading(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ notes, photos, assetType: assetType || null });
  }

  return (
    <Card className="border-2 border-emerald-800 shadow-2xl">
      <CardHeader className="bg-gradient-to-r from-emerald-900 to-emerald-700 text-white pb-4">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-bold">Record Field Note</CardTitle>
            <p className="text-sm text-white/80 mt-1">
              {position.lat.toFixed(6)}, {position.lng.toFixed(6)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="text-white hover:bg-white/20"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        <form onSubmit={submit} className="space-y-4">
          {/* Asset Type */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Asset Type</Label>
            <Select value={assetType} onValueChange={setAssetType}>
              <SelectTrigger className="h-12 bg-white border-2 border-gray-200 hover:border-emerald-700 transition-colors w-full">
                <SelectValue placeholder="Select an asset type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Hand Hole">Hand Hole</SelectItem>
                <SelectItem value="Vault">Vault</SelectItem>
                <SelectItem value="Pedestal">Pedestal</SelectItem>
                <SelectItem value="Flower Pot">Flower Pot</SelectItem>
                <SelectItem value="MST">MST</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-semibold">
              Field Notes
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter observations, measurements, or any field data..."
              className="min-h-32 text-base"
              required
            />
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Photos</Label>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-12"
                onClick={() =>
                  (document.getElementById("camera-upload") as HTMLInputElement)?.click()
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
              <input
                id="camera-upload"
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />

              <Button
                type="button"
                variant="outline"
                className="h-12"
                onClick={() =>
                  (document.getElementById("gallery-upload") as HTMLInputElement)?.click()
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
              <input
                id="gallery-upload"
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleUpload(e.target.files)}
              />
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {photos.map((url, i) => (
                  <div
                    key={i}
                    className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 h-12"
              disabled={isLoading || uploading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1 h-12"
              disabled={isLoading || uploading}
            >
              {isLoading ? "Saving..." : "Save Note"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
