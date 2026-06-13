"use client";

import React, { useState } from "react";
import {
  Folder,
  FileText,
  Search,
  Grid,
  List as ListIcon,
  ChevronRight,
  MoreVertical,
  Plus,
  ArrowLeft,
  Move,
  Download,
  Trash2,
  Edit,
  FolderOpen,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Breadcrumbs from "./Breadcrumbs";
import { CloudItem } from "@/lib/storage";

interface FileExplorerProps {
  items: CloudItem[];
  currentPath: string;
  userId: string;
  isLoading: boolean;
  isMoving: boolean;
  onNavigate: (path: string) => void;
  onUploadClick: () => void;
  onCreateFolderClick: () => void;
  onFileClick: (file: CloudItem) => void;
  onMoveItem: (itemKey: string, targetFolderKey: string) => Promise<void>;
  onDeleteItem: (key: string) => Promise<void>;
  onRenameItem: (oldKey: string, newName: string) => Promise<void>;
  isS3Mode: boolean;
}

export default function FileExplorer({
  items,
  currentPath,
  userId,
  isLoading,
  isMoving,
  onNavigate,
  onUploadClick,
  onCreateFolderClick,
  onFileClick,
  onMoveItem,
  onDeleteItem,
  onRenameItem,
  isS3Mode,
}: FileExplorerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // Parse file extension for icon selection
  const getFileIcon = (filename: string) => {
    const ext = filename.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return "text-red-500";
      case "png":
      case "jpg":
      case "jpeg":
      case "gif":
      case "webp":
      case "svg":
        return "text-emerald-500";
      case "mp3":
      case "wav":
      case "ogg":
        return "text-amber-500";
      case "mp4":
      case "webm":
        return "text-indigo-500";
      case "zip":
      case "rar":
      case "tar":
      case "gz":
        return "text-yellow-600";
      case "js":
      case "ts":
      case "tsx":
      case "jsx":
      case "py":
      case "html":
      case "css":
        return "text-sky-500";
      default:
        return "text-muted-foreground";
    }
  };

  // Get direct children of current path
  const prefix = userId ? `${userId}/` : "";
  const relativeCurrentPath = currentPath ? `${currentPath}/` : "";
  const fullPathPrefix = `${prefix}${relativeCurrentPath}`;

  const directItemsMap = new Map<string, CloudItem>();

  items.forEach((item) => {
    // Must start with our fullPathPrefix
    if (!item.key.startsWith(fullPathPrefix)) return;
    if (item.key === fullPathPrefix) return; // Skip current folder itself

    // Get the relative path segment immediately following the fullPathPrefix
    const relativePart = item.key.substring(fullPathPrefix.length);
    if (!relativePart) return;

    const segments = relativePart.split("/");
    const firstSegment = segments[0];

    if (segments.length === 1 && !item.isFolder) {
      // It's a file directly inside current folder
      directItemsMap.set(item.key, item);
    } else {
      // It's a folder (or a file nested inside a subfolder, so we show the subfolder)
      const folderKey = `${fullPathPrefix}${firstSegment}/`;
      
      // If we don't have the folder item already, or if this item is the folder itself
      if (!directItemsMap.has(folderKey) || item.isFolder) {
        directItemsMap.set(folderKey, {
          key: folderKey,
          name: firstSegment + "/",
          size: 0,
          isFolder: true,
          url: "",
        });
      }
    }
  });

  const directItems = Array.from(directItemsMap.values());

  // Filter based on search query
  const filteredItems = directItems.filter((item) => {
    const cleanName = item.name.replace(/\/$/, "");
    return cleanName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Sort: folders first, then files alphabetically
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name);
  });

  // Handle navigating up
  const handleBack = () => {
    if (!currentPath) return;
    const segments = currentPath.split("/");
    segments.pop();
    onNavigate(segments.join("/"));
  };

  // Drag-and-drop item movement handlers
  const handleDragStart = (e: React.DragEvent, item: CloudItem) => {
    e.dataTransfer.setData("text/plain", item.key);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, targetItem: CloudItem) => {
    e.preventDefault();
    if (targetItem.isFolder) {
      setDragOverKey(targetItem.key);
    }
  };

  const handleDragLeave = () => {
    setDragOverKey(null);
  };

  const handleDrop = async (e: React.DragEvent, targetItem: CloudItem) => {
    e.preventDefault();
    setDragOverKey(null);
    if (!targetItem.isFolder) return;

    const sourceKey = e.dataTransfer.getData("text/plain");
    if (!sourceKey || sourceKey === targetItem.key) return;

    // Check that we're not dropping a folder inside itself
    if (sourceKey.endsWith("/") && targetItem.key.startsWith(sourceKey)) {
      return;
    }

    try {
      await onMoveItem(sourceKey, targetItem.key);
    } catch (err) {
      console.error(err);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "--";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Explorer Action Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-border p-4 gap-3 bg-background select-none">
        {/* Left: Breadcrumbs & Back */}
        <div className="flex items-center gap-2 min-w-0">
          {currentPath && (
            <Button
              variant="ghost"
              size="icon-xs"
              className="border border-border shrink-0"
              onClick={handleBack}
            >
              <ArrowLeft className="size-3.5" />
            </Button>
          )}
          <Breadcrumbs
            currentPath={currentPath}
            onNavigate={onNavigate}
            onDropItem={async (sourceKey, targetPath) => {
              if (isMoving) return;
              const targetFolderKey = targetPath ? `${userId}/${targetPath}/` : `${userId}/`;
              await onMoveItem(sourceKey, targetFolderKey);
            }}
          />
        </div>

        {/* Right: Search & Actions */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Search bar */}
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search in folder..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 border border-border bg-background rounded-none w-full sm:w-[180px] focus:w-[220px] focus:border-primary outline-none transition-all"
            />
          </div>

          {/* View Toggles */}
          <div className="flex border border-border">
            <Button
              variant="ghost"
              size="icon-xs"
              className={`rounded-none border-0 ${viewMode === "grid" ? "bg-muted" : ""}`}
              onClick={() => setViewMode("grid")}
            >
              <Grid className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              className={`rounded-none border-0 ${viewMode === "list" ? "bg-muted" : ""}`}
              onClick={() => setViewMode("list")}
            >
              <ListIcon className="size-3.5" />
            </Button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="xs"
              className="border-border rounded-none text-[10px] font-semibold"
              onClick={onCreateFolderClick}
              disabled={isMoving}
            >
              <Plus className="size-3.5 mr-1" /> New Folder
            </Button>
            <Button
              size="xs"
              className="rounded-none text-[10px] font-semibold"
              onClick={onUploadClick}
              disabled={isMoving}
            >
              <Upload className="size-3.5 mr-1" /> Upload
            </Button>
          </div>
        </div>
      </div>

      {/* Explorer Content */}
      <div className="flex-1 overflow-y-auto p-4 bg-muted/5 min-h-[300px] relative">
        {isMoving && (
          <div className="absolute inset-0 bg-background/40 backdrop-blur-xs flex items-center justify-center z-30 select-none pointer-events-auto">
            <div className="flex items-center gap-2 border border-border bg-background px-4 py-2.5 rounded-none font-mono text-xs uppercase font-semibold tracking-wider">
              <span className="size-2 bg-primary rounded-full animate-ping" />
              <span>Moving items...</span>
            </div>
          </div>
        )}
        {isLoading ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground uppercase text-[10px] tracking-wider animate-pulse select-none gap-2">
            <FolderOpen className="size-5 text-muted-foreground/60 animate-bounce" />
            Loading files...
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 select-none">
            <Folder className="size-8 text-muted-foreground/30 mb-2.5" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">
              Folder is empty
            </p>
            <p className="text-[10px] text-muted-foreground mt-1 max-w-[200px]">
              Drag and drop files here to upload, or use the action buttons.
            </p>
          </div>
        ) : viewMode === "grid" ? (
          /* GRID VIEW */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {sortedItems.map((item) => {
              const cleanName = item.name.replace(/\/$/, "");
              const isOver = dragOverKey === item.key;

              return (
                <div
                  key={item.key}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragOver={(e) => handleDragOver(e, item)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, item)}
                  onClick={() => (item.isFolder ? onNavigate(item.key.replace(`${userId}/`, "").replace(/\/$/, "")) : onFileClick(item))}
                  className={`group relative flex flex-col border p-3 cursor-pointer select-none transition-all duration-100 ${
                    item.isFolder
                      ? "hover:border-primary/50"
                      : "hover:border-primary/50 hover:bg-muted/10"
                  } ${
                    isOver ? "border-primary bg-primary/5 scale-[0.98]" : "border-border bg-background"
                  }`}
                >
                  {/* Icon */}
                  <div className="flex items-center justify-center py-4 text-muted-foreground">
                    {item.isFolder ? (
                      <Folder className="size-10 text-primary/70 group-hover:scale-105 transition-transform" />
                    ) : (
                      <FileText className={`size-10 ${getFileIcon(item.name)} group-hover:scale-105 transition-transform`} />
                    )}
                  </div>

                  {/* Label */}
                  <div className="mt-1 flex flex-col min-w-0">
                    <span className="text-xs font-semibold truncate text-foreground group-hover:text-primary transition-colors">
                      {cleanName}
                    </span>
                    {!item.isFolder && (
                      <span className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {formatSize(item.size)}
                      </span>
                    )}
                  </div>

                  {/* Options & Drag handle */}
                  <div
                    className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="size-5 p-0 border border-border bg-background hover:bg-muted rounded-none"
                      onClick={() => onFileClick(item)}
                      title="Manage options"
                    >
                      <MoreVertical className="size-3" />
                    </Button>
                    <div className="opacity-60">
                      <Move className="size-3 text-muted-foreground/60" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* LIST VIEW */
          <div className="border border-border bg-background select-none">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-[9px] uppercase tracking-wider font-bold text-muted-foreground bg-muted/20">
                  <th className="py-2.5 px-4 font-semibold">Name</th>
                  <th className="py-2.5 px-4 font-semibold w-[100px]">Size</th>
                  <th className="py-2.5 px-4 font-semibold w-[150px] hidden sm:table-cell">Type</th>
                  <th className="py-2.5 px-4 font-semibold w-[40px]"></th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => {
                  const cleanName = item.name.replace(/\/$/, "");
                  const isOver = dragOverKey === item.key;

                  return (
                    <tr
                      key={item.key}
                      draggable
                      onDragStart={(e) => handleDragStart(e, item)}
                      onDragOver={(e) => handleDragOver(e, item)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, item)}
                      onClick={() => (item.isFolder ? onNavigate(item.key.replace(`${userId}/`, "").replace(/\/$/, "")) : onFileClick(item))}
                      className={`group border-b border-border/50 hover:bg-muted/10 cursor-pointer transition-colors last:border-b-0 ${
                        isOver ? "bg-primary/5 border-primary" : ""
                      }`}
                    >
                      {/* Name */}
                      <td className="py-2.5 px-4 min-w-0">
                        <div className="flex items-center gap-2.5 truncate">
                          {item.isFolder ? (
                            <Folder className="size-4 text-primary/70 shrink-0" />
                          ) : (
                            <FileText className={`size-4 ${getFileIcon(item.name)} shrink-0`} />
                          )}
                          <span className="text-xs font-semibold truncate group-hover:text-primary transition-colors">
                            {cleanName}
                          </span>
                        </div>
                      </td>

                      {/* Size */}
                      <td className="py-2.5 px-4 font-mono text-[10px] text-muted-foreground">
                        {formatSize(item.size)}
                      </td>

                      {/* Type */}
                      <td className="py-2.5 px-4 text-[10px] uppercase font-semibold text-muted-foreground/80 hidden sm:table-cell">
                        {item.isFolder ? "Folder" : item.name.split(".").pop() || "File"}
                      </td>

                      {/* Options & Drag handle */}
                      <td className="py-2.5 px-4 text-right font-semibold" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="size-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity border border-border rounded-none bg-background"
                            onClick={() => onFileClick(item)}
                            title="Manage options"
                          >
                            <MoreVertical className="size-3.5" />
                          </Button>
                          <Move className="size-3.5 text-muted-foreground/0 group-hover:text-muted-foreground/30 shrink-0 inline-block transition-colors" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
