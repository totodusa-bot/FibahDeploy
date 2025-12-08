'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export interface Project {
  id: string
  user_id: string
  name: string
  description: string | null
  status: string
  start_date: string | null
  location: string | null
  created_at: string
  updated_at: string
  project_overlays?: ProjectOverlay[]
}

export interface ProjectOverlay {
  id: string
  project_id: string
  name: string
  description: string | null
  storage_path: string
  file_type: string
  created_by: string
  created_at: string
  is_active: boolean
  style: any
}

export async function getProjects() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*, project_overlays(*)')
    
    .order('created_at', { ascending: false })

  if (error) {
    return { error: error.message }
  }

  return { data }
}

export async function createProject(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const status = formData.get("status") as string;
  const start_date = formData.get("start_date") as string;
  const location = formData.get("location") as string;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name,
      description,
      status,
      start_date,
      location,
    })
    .select("*")
    .single();

  if (projectError || !project) {
    return { error: projectError?.message ?? "Failed to create project" };
  }

  const overlayFile = formData.get("overlay_file");

  if (overlayFile && overlayFile instanceof File && overlayFile.size > 0) {
    const originalName = overlayFile.name || "overlay.geojson";
    const ext = (originalName.split(".").pop() || "").toLowerCase();

    // Prevent duplicate overlays by file name within the same project
    const { data: existingOverlays, error: existingOverlaysError } = await supabase
      .from("project_overlays")
      .select("id")
      .eq("project_id", project.id)
      .eq("name", originalName)
      .limit(1);

    if (existingOverlaysError) {
      return { error: `Failed to check existing overlays: ${existingOverlaysError.message}` };
    }

    if (existingOverlays && existingOverlays.length > 0) {
      return {
        error:
          "This project already has an overlay with that file name. Rename the file or delete the existing overlay before uploading again.",
      };
    }

    if (ext !== "geojson") {
      return {
        error:
          "Only .geojson overlays are supported right now. Pleas...convert other formats (SHP, GPKG) to GeoJSON before uploading.",
      };
    }

    try {
      const text = await overlayFile.text();
      const parsed = JSON.parse(text);

      const validTypes = [
        "FeatureCollection",
        "Feature",
        "GeometryCollection",
        "Point",
        "MultiPoint",
        "LineString",
        "MultiLineString",
        "Polygon",
        "MultiPolygon",
      ];

      if (!parsed || !validTypes.includes(parsed.type)) {
        return { error: 'Invalid GeoJSON: unsupported or missing "type" field.' };
      }
    } catch {
      return { error: "Invalid GeoJSON: could not parse JSON." };
    }

    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${project.id}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("project-overlays")
      .upload(storagePath, overlayFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: overlayFile.type || "application/geo+json",
      });

    if (uploadError) {
      return { error: `Overlay upload failed: ${uploadError.message}` };
    }

    const { error: overlayInsertError } = await supabase
      .from("project_overlays")
      .insert({
        project_id: project.id,
        name: originalName,
        description: null,
        storage_path: storagePath,
        file_type: "geojson",
        created_by: user.id,
      });

    if (overlayInsertError) {
      return { error: `Overlay metadata insert failed: ${overlayInsertError.message}` };
    }
  }

  revalidatePath("/dashboard");
  return { success: true };
}



export async function updateProject(id: string, formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const name = formData.get("name") as string;
  const description = formData.get("description") as string;
  const status = formData.get("status") as string;
  const start_date = formData.get("start_date") as string;
  const location = formData.get("location") as string;

  const { error: projectError } = await supabase
    .from("projects")
    .update({
      name,
      description,
      status,
      start_date,
      location,
    })
    .eq("id", id);

  if (projectError) {
    return { error: projectError.message };
  }

  const overlayFile = formData.get("overlay_file");

  if (overlayFile && overlayFile instanceof File && overlayFile.size > 0) {
    const originalName = overlayFile.name || "overlay.geojson";
    const ext = (originalName.split(".").pop() || "").toLowerCase();

    // Prevent duplicate overlays by file name within the same project
    const { data: existingOverlays, error: existingOverlaysError } = await supabase
      .from("project_overlays")
      .select("id")
      .eq("project_id", id)
      .eq("name", originalName)
      .limit(1);

    if (existingOverlaysError) {
      return { error: `Failed to check existing overlays: ${existingOverlaysError.message}` };
    }

    if (existingOverlays && existingOverlays.length > 0) {
      return {
        error:
          "This project already has an overlay with that file name. Rename the file or delete the existing overlay before uploading again.",
      };
    }

    if (ext !== "geojson") {
      return {
        error:
          "Only .geojson overlays are supported right now. Pleas...convert other formats (SHP, GPKG) to GeoJSON before uploading.",
      };
    }

    try {
      const text = await overlayFile.text();
      const parsed = JSON.parse(text);

      const validTypes = [
        "FeatureCollection",
        "Feature",
        "GeometryCollection",
        "Point",
        "MultiPoint",
        "LineString",
        "MultiLineString",
        "Polygon",
        "MultiPolygon",
      ];

      if (!parsed || !validTypes.includes(parsed.type)) {
        return { error: 'Invalid GeoJSON: unsupported or missing "type" field.' };
      }
    } catch {
      return { error: "Invalid GeoJSON: could not parse JSON." };
    }

    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${id}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("project-overlays")
      .upload(storagePath, overlayFile, {
        cacheControl: "3600",
        upsert: false,
        contentType: overlayFile.type || "application/geo+json",
      });

    if (uploadError) {
      return { error: `Overlay upload failed: ${uploadError.message}` };
    }

    const { error: overlayInsertError } = await supabase
      .from("project_overlays")
      .insert({
        project_id: id,
        name: originalName,
        description: null,
        storage_path: storagePath,
        file_type: "geojson",
        created_by: user.id,
      });

    if (overlayInsertError) {
      return { error: `Overlay metadata insert failed: ${overlayInsertError.message}` };
    }
  }

  revalidatePath("/dashboard");
  return { success: true };
}




export async function deleteProjectOverlay(projectId: string, overlayId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: overlay, error: fetchError } = await supabase
    .from("project_overlays")
    .select("id, project_id, storage_path")
    .eq("id", overlayId)
    .single();

  if (fetchError || !overlay) {
    return { error: fetchError?.message ?? "Overlay not found" };
  }

  if (overlay.project_id !== projectId) {
    return { error: "Overlay does not belong to this project" };
  }

  if (overlay.storage_path) {
    const { error: storageError } = await supabase.storage
      .from("project-overlays")
      .remove([overlay.storage_path]);

    if (storageError) {
      console.warn("Failed to remove overlay file", storageError.message);
    }
  }

  const { error: deleteError } = await supabase
    .from("project_overlays")
    .delete()
    .eq("id", overlayId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteProject(id: string) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Not authenticated' }
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  return { success: true }
}
