"use client";

import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  Edit2,
  MapPin,
  Image as ImageIcon,
  Clock,
} from "lucide-react";
import NoteEditModal from "@/components/notes/NoteEditModal";

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

const PAGE_SIZE = 25;

export default function NotesClient() {
  const supabase = React.useMemo(() => createClient(), []);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState<FieldNote[]>([]);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [total, setTotal] = React.useState(0);
  const [selected, setSelected] = React.useState<FieldNote | null>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    // Adjust table name if your schema uses "FieldNote"
    let q = supabase
      .from("field_notes")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (query.trim()) {
      q = q.or(
        `notes.ilike.%${query}%,project_name.ilike.%${query}%,created_by_name.ilike.%${query}%`
      );
    }

    const { data, error: err, count } = await q;
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    setNotes(data || []);
    setTotal(count || 0);
    setLoading(false);
  }, [supabase, from, to, query, refreshKey]);

  React.useEffect(() => {
    load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <Card className="shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center gap-2">
            <div className="relative w-full">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search notes, project, or author…"
                value={query}
                onChange={(e) => {
                  setPage(0);
                  setQuery(e.target.value);
                }}
              />
            </div>
            <Button variant="outline" onClick={() => setRefreshKey((k) => k + 1)}>
              Refresh
            </Button>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-3 py-1 text-xs font-medium text-emerald-700 shadow-sm whitespace-nowrap">
                {total.toLocaleString()} <span className="opacity-70">Total</span>
            </div>

            

          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>
                Could not load notes: {error}
              </AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead className="hidden md:table-cell">Location</TableHead>
                      <TableHead className="hidden md:table-cell">Photos</TableHead>
                      <TableHead className="hidden md:table-cell">By</TableHead>
                      <TableHead className="hidden md:table-cell">When</TableHead>
                      <TableHead className="w-16 text-right">Edit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notes.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell className="max-w-[12rem]">
                          <div className="font-medium">
                            {n.project_name || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {n.asset_type || "—"}
                          </div>
                        </TableCell>

                        <TableCell className="max-w-[24rem]">
                          <div className="line-clamp-2">
                            {n.notes || "—"}
                          </div>
                        </TableCell>

                        <TableCell className="hidden md:table-cell">
                          <div className="inline-flex items-center gap-1 text-sm">
                            <MapPin className="h-4 w-4" />
                            {Number.isFinite(n.latitude) && Number.isFinite(n.longitude)
                              ? `${n.latitude.toFixed(5)}, ${n.longitude.toFixed(5)}`
                              : "—"}
                          </div>
                        </TableCell>

                        <TableCell className="hidden md:table-cell">
                          <div className="inline-flex items-center gap-1 text-sm">
                            <ImageIcon className="h-4 w-4" />
                            {Array.isArray(n.photos) ? n.photos.length : 0}
                          </div>
                        </TableCell>

                        <TableCell className="hidden md:table-cell text-sm">
                          {n.created_by_name || n.created_by || "—"}
                        </TableCell>

                        <TableCell className="hidden md:table-cell text-sm">
                          <div className="inline-flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {n.updated_at || n.created_at || "—"}
                          </div>
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setSelected(n)}
                            aria-label={`Edit note ${n.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}

                    {!notes.length && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="text-center text-muted-foreground"
                        >
                          No notes found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Page {page + 1} of {pageCount}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={page === 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    Prev
                  </Button>
                  <Button
                    variant="outline"
                    disabled={page + 1 >= pageCount}
                    onClick={() =>
                      setPage((p) => (p + 1 < pageCount ? p + 1 : p))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <NoteEditModal
        open={!!selected}
        note={selected}
        onClose={() => setSelected(null)}
        onSaved={() => {
          setSelected(null);
          setRefreshKey((k) => k + 1);
        }}
      />
    </>
  );
}
