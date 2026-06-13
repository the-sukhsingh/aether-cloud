"use client";

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  X,
  Download,
  Trash2,
  Edit3,
  FileText,
  Clock,
  HardDrive,
  ExternalLink,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CloudItem } from "@/lib/storage";

interface DetailsDrawerProps {
  file: CloudItem | null;
  onClose: () => void;
  onDelete: (key: string) => Promise<void>;
  onRename: (oldKey: string, newName: string) => Promise<void>;
  isS3Mode: boolean;
}

export default function DetailsDrawer({
  file,
  onClose,
  onDelete,
  onRename,
  isS3Mode,
}: DetailsDrawerProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [textContents, setTextContents] = useState("");
  const [isLoadingContents, setIsLoadingContents] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Parse file extension
  const getExtension = (filename: string) => {
    const parts = filename.split(".");
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  };

  const ext = file ? getExtension(file.name) : "";
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext);
  const isAudio = ["mp3", "wav", "ogg", "m4a"].includes(ext);
  const isVideo = ["mp4", "webm", "ogv", "mov"].includes(ext);
  const isPdf = ext === "pdf";
  const isMarkdown = ["md", "markdown"].includes(ext);
  const isText = ["txt", "log", "csv"].includes(ext);
  const isCode = [
    "js",
    "ts",
    "tsx",
    "jsx",
    "json",
    "html",
    "css",
    "py",
    "go",
    "rs",
    "sh",
    "yml",
    "yaml",
    "xml",
  ].includes(ext);

  // Fetch text/markdown contents when file changes
  useEffect(() => {
    if (!file) {
      setTextContents("");
      setIsEditingName(false);
      return;
    }

    setNewName(file.name.replace(/\/$/, "")); // Strip ending slash if folder
    setIsEditingName(false);

    if (file.url && (isText || isMarkdown || isCode)) {
      setIsLoadingContents(true);
      const targetUrl = isS3Mode
        ? `/api/storage/content?key=${encodeURIComponent(file.key)}`
        : file.url;

      fetch(targetUrl)
        .then((res) => {
          if (!res.ok) throw new Error("Failed to fetch file content");
          return res.text();
        })
        .then((text) => {
          setTextContents(text);
          setIsLoadingContents(false);
        })
        .catch((err) => {
          console.error(err);
          setTextContents("Error: Could not load text preview.");
          setIsLoadingContents(false);
        });
    } else {
      setTextContents("");
      setIsLoadingContents(false);
    }
  }, [file?.key]);

  if (!file) return null;

  const handleSaveName = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === file.name.replace(/\/$/, "")) {
      setIsEditingName(false);
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onRename(file.key, trimmed);
      setIsEditingName(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = async () => {
    setIsSubmitting(true);
    try {
      await onDelete(file.key);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (file?.isFolder) return "--";
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return "Unknown";
    return new Date(isoString).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  // Quick markdown simple renderer (converts basic markers to html tags)
  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, i) => {
      // Headers
      if (line.startsWith("# ")) {
        return <h1 key={i} className="text-lg font-bold border-b border-border pb-1 mt-4 mb-2 text-foreground">{line.substring(2)}</h1>;
      }
      if (line.startsWith("## ")) {
        return <h2 key={i} className="text-base font-bold mt-4 mb-1 text-foreground">{line.substring(3)}</h2>;
      }
      if (line.startsWith("### ")) {
        return <h3 key={i} className="text-sm font-bold mt-3 mb-1 text-foreground">{line.substring(4)}</h3>;
      }
      // List
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        return <li key={i} className="ml-4 list-disc text-xs my-0.5 text-muted-foreground">{line.trim().substring(2)}</li>;
      }
      // Code blocks
      if (line.startsWith("```")) {
        return null; // Skip code fence markers
      }
      // Empty line
      if (!line.trim()) {
        return <div key={i} className="h-2" />;
      }
      // Standard line
      return <p key={i} className="text-xs text-muted-foreground my-1 leading-relaxed">{line}</p>;
    });
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
      className="fixed top-0 right-0 z-40 h-full w-full sm:w-[450px] border-l border-border bg-background flex flex-col focus:outline-none"
    >
      {/* Drawer Header */}
      <div className="flex items-center justify-between border-b border-border p-4 shrink-0">
        <div className="flex-1 min-w-0 mr-2">
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={isSubmitting}
                className="text-xs font-semibold border border-border bg-background px-2 py-1 w-full rounded-none outline-none focus:border-primary"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
              />
              <Button
                variant="ghost"
                size="icon-xs"
                className="border border-border"
                onClick={handleSaveName}
                disabled={isSubmitting}
              >
                <Save className="size-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 group">
              <h3 className="text-xs font-bold uppercase tracking-wider truncate">
                {file.name.replace(/\/$/, "")}
              </h3>
              <button
                onClick={() => setIsEditingName(true)}
                className="text-muted-foreground hover:text-foreground opacity-50 group-hover:opacity-100 transition-opacity"
              >
                <Edit3 className="size-3" />
              </button>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground truncate font-mono mt-0.5">
            {file.key}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          className="border border-border shrink-0"
          onClick={onClose}
        >
          <X className="size-3" />
        </Button>
      </div>

      {/* Preview Area */}
      <div className="flex-1 overflow-y-auto border-b border-border bg-muted/5 flex flex-col">
        {/* Render Preview depending on type */}
        {isImage && file.url && (
          <div className="flex-1 p-6 flex items-center justify-center min-h-[200px]">
            <img
              src={file.url}
              alt={file.name}
              className="max-h-[280px] max-w-full object-contain border border-border p-1 bg-background"
            />
          </div>
        )}

        {isAudio && file.url && (
          <div className="p-6 flex flex-col items-center justify-center gap-4 min-h-[150px]">
            <div className="size-16 border border-border bg-background flex items-center justify-center rounded-full">
              <FileText className="size-8 text-primary" />
            </div>
            <audio controls src={file.url} className="w-full h-8" />
          </div>
        )}

        {isVideo && file.url && (
          <div className="p-4 flex items-center justify-center min-h-[220px]">
            <video
              controls
              src={file.url}
              className="max-h-[260px] w-full object-contain border border-border"
            />
          </div>
        )}

        {isPdf && file.url && (
          <div className="flex-1 flex flex-col p-4 gap-3">
            <iframe
              src={isS3Mode ? `/api/storage/content?key=${encodeURIComponent(file.key)}` : file.url}
              className="flex-1 min-h-[300px] border border-border"
              title="PDF Preview"
            />
            <a
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] uppercase font-semibold tracking-wider text-primary flex items-center gap-1 hover:underline"
            >
              Open PDF in new tab <ExternalLink className="size-3" />
            </a>
          </div>
        )}

        {(isText || isMarkdown || isCode) && (
          <div className="flex-1 flex flex-col p-4 min-h-[250px] font-mono text-xs">
            <div className="flex items-center justify-between border-b border-border pb-2 mb-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              <span>Preview Panel</span>
              <span>{ext}</span>
            </div>
            {isLoadingContents ? (
              <div className="flex-1 flex items-center justify-center text-muted-foreground animate-pulse text-[10px] uppercase tracking-wider">
                Loading preview...
              </div>
            ) : isMarkdown ? (
              <div className="flex-1 bg-background border border-border p-4 font-sans overflow-y-auto select-text">
                {renderMarkdown(textContents || "*Empty File*")}
              </div>
            ) : (
              // Code / Text Line-by-Line Viewer
              <div className="flex-1 bg-background border border-border p-3 overflow-auto select-text max-h-[400px]">
                <table className="w-full border-collapse">
                  <tbody>
                    {(textContents || "/* Empty file */").split("\n").map((line, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="w-8 pr-3 text-right select-none text-[10px] text-muted-foreground/60 border-r border-border/60">
                          {idx + 1}
                        </td>
                        <td className="pl-3 whitespace-pre text-[11px] leading-relaxed">
                          {line}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Fallback (Not previewable) */}
        {!isImage && !isAudio && !isVideo && !isPdf && !isText && !isMarkdown && !isCode && (
          <div className="flex-1 p-6 flex flex-col items-center justify-center text-center gap-3">
            <div className="size-16 border border-border bg-background flex items-center justify-center">
              <FileText className="size-8 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider">
                Preview Not Available
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Type: {file.type || ext || "unknown"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Properties Table */}
      <div className="p-4 shrink-0 border-b border-border flex flex-col gap-2.5 bg-background">
        <h4 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
          Properties
        </h4>
        <div className="grid grid-cols-3 gap-y-2 text-xs">
          <div className="text-muted-foreground flex items-center gap-1 select-none">
            <HardDrive className="size-3.5" /> Size
          </div>
          <div className="col-span-2 font-mono text-[11px]">
            {formatSize(file.size)}
          </div>

          <div className="text-muted-foreground flex items-center gap-1 select-none">
            <Clock className="size-3.5" /> Modified
          </div>
          <div className="col-span-2 font-mono text-[11px] truncate">
            {formatDate(file.lastModified)}
          </div>
        </div>
      </div>

      {/* Action panel */}
      <div className="p-4 shrink-0 bg-background flex items-center gap-3">
        {file.url && (
          <Button
            asChild
            variant="outline"
            className="flex-1 border-border rounded-none"
          >
            <a
              href={isS3Mode ? `/api/storage/content?key=${encodeURIComponent(file.key)}&download=true` : file.url}
              download={file.name.replace(/\/$/, "")}
            >
              <Download className="size-4 mr-1.5" /> Download
            </a>
          </Button>
        )}
        <Button
          variant="destructive"
          onClick={handleDeleteClick}
          disabled={isSubmitting}
          className="flex-1 rounded-none border border-transparent"
        >
          <Trash2 className="size-4 mr-1.5" /> Delete
        </Button>
      </div>
    </motion.div>
  );
}
