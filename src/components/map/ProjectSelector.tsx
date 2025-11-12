"use client";
import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FolderOpen } from "lucide-react";

export default function ProjectSelector({
  projects,
  selectedProject,
  onSelect,
}: {
  projects: any[];
  selectedProject: any | null;
  onSelect: (p: any | null) => void;
}) {
  const list = projects ?? [];

  return (
    <Select
      value={selectedProject?.id ? String(selectedProject.id) : ""}
      onValueChange={(val) => onSelect(list.find((p: any) => String(p.id) === val) || null)}
    >
      <SelectTrigger className="h-12 bg-white border-2 border-gray-200 hover:border-emerald-700 transition-colors w-full">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-5 h-5 text-emerald-700" />
          <SelectValue placeholder={list.length ? "Select Project" : "No projects found"} />
        </div>
      </SelectTrigger>

      <SelectContent>
        {list.length === 0 ? (
          // Text-only so the shim can render it
          <SelectItem value="">
            No projects found
          </SelectItem>
        ) : (
          list.map((p: any) => (
            // children MUST be plain text for the shim
            <SelectItem key={p.id} value={String(p.id)}>
              {p.name}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
