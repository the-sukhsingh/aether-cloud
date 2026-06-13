"use client";

import React, { useState } from "react";
import { ChevronRight, Home } from "lucide-react";

interface BreadcrumbsProps {
  currentPath: string; // e.g. "Documents/Projects" or ""
  onNavigate: (path: string) => void;
  onDropItem?: (sourceKey: string, targetPath: string) => void;
}

export default function Breadcrumbs({ currentPath, onNavigate, onDropItem }: BreadcrumbsProps) {
  const [dragOverSegment, setDragOverSegment] = useState<string | null>(null);
  const segments = currentPath ? currentPath.split("/") : [];

  const handleSegmentClick = (index: number) => {
    const targetPath = segments.slice(0, index + 1).join("/");
    onNavigate(targetPath);
  };

  const handleDragOver = (e: React.DragEvent, segmentKey: string) => {
    e.preventDefault();
    setDragOverSegment(segmentKey);
  };

  const handleDragLeave = () => {
    setDragOverSegment(null);
  };

  const handleDrop = (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    setDragOverSegment(null);
    const sourceKey = e.dataTransfer.getData("text/plain");
    if (sourceKey && onDropItem) {
      onDropItem(sourceKey, targetPath);
    }
  };

  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground select-none font-medium">
      {/* Root / Home */}
      <button
        onClick={() => onNavigate("")}
        onDragOver={(e) => handleDragOver(e, "root")}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, "")}
        className={`flex items-center gap-1 transition-all py-1 px-1.5 border rounded-none ${
          dragOverSegment === "root"
            ? "border-primary bg-primary/5 text-primary border-dashed scale-[0.98]"
            : "border-transparent hover:text-foreground hover:border-border"
        }`}
      >
        <Home className="size-3.5" />
        <span className="uppercase tracking-wider text-[10px] font-semibold">Root</span>
      </button>

      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1;
        const segmentPath = segments.slice(0, index + 1).join("/");
        const isOver = dragOverSegment === segmentPath;

        return (
          <React.Fragment key={index}>
            <ChevronRight className="size-3 text-muted-foreground/50 shrink-0" />
            <button
              onClick={() => !isLast && handleSegmentClick(index)}
              disabled={isLast}
              onDragOver={(e) => !isLast && handleDragOver(e, segmentPath)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => !isLast && handleDrop(e, segmentPath)}
              className={`py-1 px-1.5 border transition-all rounded-none max-w-[120px] truncate ${
                isLast
                  ? "border-transparent text-foreground font-semibold cursor-default"
                  : isOver
                  ? "border-primary bg-primary/5 text-primary border-dashed scale-[0.98]"
                  : "border-transparent hover:border-border hover:text-foreground"
              }`}
            >
              {segment}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}

