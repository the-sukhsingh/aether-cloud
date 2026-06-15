"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Upload, X, File as FileIcon, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { noti } from "noti-toast";

type Direction = "top" | "bottom" | "left" | "right";

const INSET_MAP: Record<Direction, string> = {
  top: "inset(0 0 100% 0)",
  bottom: "inset(100% 0 0 0)",
  left: "inset(0 100% 0 0)",
  right: "inset(0 0 0 100%)",
};

function getRandomDirections() {
  const directions: Direction[] = ["top", "bottom", "left", "right"];
  const bg = directions[Math.floor(Math.random() * directions.length)];
  let dialog = directions[Math.floor(Math.random() * directions.length)];
  while (dialog === bg) {
    dialog = directions[Math.floor(Math.random() * directions.length)];
  }
  return { bg, dialog };
}

interface UploadFileItem {
  id: string;
  file: File;
  customName: string;
  previewUrl?: string;
  isTooLarge: boolean;
}

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: { file: File; customName: string }[]) => Promise<void>;
  currentPath: string;
  initialFiles?: FileList | null;
  currentTotalSize: number;
}

export default function UploadModal({
  isOpen,
  onClose,
  onUpload,
  currentPath,
  initialFiles = null,
  currentTotalSize,
}: UploadModalProps) {
  const [files, setFiles] = useState<UploadFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [directions, setDirections] = useState(getRandomDirections);

  const newFilesSize = files.reduce((acc, f) => acc + f.file.size, 0);
  const exceedsQuota = currentTotalSize + newFilesSize > 10 * 1024 * 1024;

  // Load initial files if drag-dropped on page
  useEffect(() => {
    if (isOpen && initialFiles) {
      addFiles(initialFiles);
    }
  }, [isOpen, initialFiles]);

  // Clear state when opening/closing
  useEffect(() => {
    if (!isOpen) {
      // Clean up blob URLs
      files.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      setFiles([]);
      setIsUploading(false);
      setUploadProgress(0);
    }

    
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    }

    addEventListener("keydown", handleKey);
    return () => removeEventListener("keydown", handleKey)

  }, [isOpen]);

  const addFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;

    const allowedItems: UploadFileItem[] = [];
    const rejectedMediaNames: string[] = [];

    const isMediaFile = (file: File) => {
      const mediaTypes = ["image/", "audio/", "video/"];
      if (mediaTypes.some((prefix) => file.type.startsWith(prefix))) {
        return true;
      }
      const mediaExts = [
        "png",
        "jpg",
        "jpeg",
        "gif",
        "webp",
        "svg",
        "mp3",
        "wav",
        "ogg",
        "m4a",
        "mp4",
        "webm",
        "ogv",
        "mov",
      ];
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (ext && mediaExts.includes(ext)) {
        return true;
      }
      return false;
    };

    Array.from(newFiles).forEach((file) => {
      if (isMediaFile(file)) {
        rejectedMediaNames.push(file.name);
        return;
      }

      const isTooLarge = file.size > 10 * 1024 * 1024; // 10MB limit

      allowedItems.push({
        id: crypto.randomUUID(),
        file,
        customName: file.name,
        isTooLarge,
      });
    });

    if (rejectedMediaNames.length > 0) {
      noti.error(`Media files are not allowed: ${rejectedMediaNames.join(", ")}`);
    }

    setFiles((prev) => [...prev, ...allowedItems]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleNameChange = (id: string, newName: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, customName: newName } : f))
    );
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleSubmit = async () => {
    if (files.length === 0 || files.some((f) => f.isTooLarge)) return;

    setIsUploading(true);
    
    // Simulate dynamic upload progress (since actual upload might be too fast/slow)
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return 90;
        }
        return prev + 10;
      });
    }, 150);

    try {
      await onUpload(
        files.map((f) => ({
          file: f.file,
          customName: f.customName,
        }))
      );
      setUploadProgress(100);
      setTimeout(() => {
        onClose();
        noti.success(`Successfully uploaded ${files.length} file(s)`);
      }, 300);
    } catch (error) {
      console.error(error);
      setIsUploading(false);
      setUploadProgress(0);
    } finally {
      clearInterval(interval);
    }
  };

  const hasErrors = files.some((f) => f.isTooLarge);

  return (
    <AnimatePresence onExitComplete={() => setDirections(getRandomDirections())}>
      {isOpen && (
        <motion.div
          initial={{
            clipPath: INSET_MAP[directions.bg]
          }}
          animate={{
            clipPath: "inset(0 0 0 0)"
          }}
          exit={{
            clipPath: INSET_MAP[directions.bg],
            transition: {
              delay: 0.15
            }
          }}
          transition={{
            duration: 0.15,
            ease: "linear"
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary/20 backdrop-blur-xs"
        >
          {/* Backdrop click should close if not uploading */}
          <div className="absolute inset-0" onClick={() => !isUploading && onClose()} />

          <motion.div
            initial={{
              clipPath: INSET_MAP[directions.dialog]
            }}
            animate={{
              clipPath: "inset(0 0 0 0)",
              transition: {
                delay: 0.15
              }
            }}
            exit={{
              clipPath: INSET_MAP[directions.dialog]
            }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative w-full max-w-xl p-2 rounded-none"
          >
            <div className="absolute -inset-8 z-[-1] [--pattern-fg:var(--color-primary)] dark:[--pattern-fg:#ffffff] bg-[repeating-linear-gradient(315deg,var(--pattern-fg)_0,var(--pattern-fg)_1px,transparent_0,transparent_50%)] bg-size-[10px_10px] bg-fixed opacity-40" />
            <div className="bg-background p-6 border border-border flex flex-col gap-6">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h2 className="text-sm font-semibold tracking-wider uppercase">Upload Files</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Uploading to: <span className="font-mono text-foreground font-medium">/{currentPath || "root"}</span>
                  </p>
                </div>
                {!isUploading && (
                  <Button variant="ghost" size="icon-xs" className="rounded-none border border-border" onClick={onClose}>
                    <X className="size-4" />
                  </Button>
                )}
              </div>

              {/* Drag Zone */}
              {!isUploading && files.length === 0 && (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`flex flex-col items-center justify-center border border-dashed py-12 px-4 text-center cursor-pointer select-none transition-all duration-150 ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/30"
                  }`}
                >
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.csv,.json,.js,.ts,.tsx,.jsx,.css,.html,.py,.go,.rs,.sh,.yml,.yaml,.xml,.zip,.rar,.tar,.gz"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                  <Upload className="size-6 text-muted-foreground mb-3" />
                  <p className="text-xs font-semibold uppercase tracking-wider">Drag & drop files here</p>
                  <p className="text-xs text-muted-foreground mt-1">or click to browse from system</p>
                  <p className="text-[10px] text-muted-foreground/80 mt-4 uppercase tracking-wider">Max file size: 10MB</p>
                </div>
              )}

              {/* Selected Files List */}
              {!isUploading && files.length > 0 && (
                <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1">
                  {files.map((fileItem) => (
                    <div
                      key={fileItem.id}
                      className={`flex items-start gap-3 border p-3 rounded-none ${
                        fileItem.isTooLarge ? "border-destructive/30 bg-destructive/5" : "border-border"
                      }`}
                    >
                      {/* Preview / Icon */}
                      {fileItem.previewUrl ? (
                        <div className="size-10 border border-border overflow-hidden shrink-0">
                          <img
                            src={fileItem.previewUrl}
                            alt="preview"
                            className="size-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="size-10 border border-border flex items-center justify-center shrink-0 bg-muted/20">
                          <FileIcon className="size-5 text-muted-foreground" />
                        </div>
                      )}

                      {/* Meta & Input */}
                      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                        <input
                          type="text"
                          value={fileItem.customName}
                          onChange={(e) => handleNameChange(fileItem.id, e.target.value)}
                          className="text-xs border border-border px-2 py-1 bg-background rounded-none font-medium w-full focus:border-primary outline-none"
                          placeholder="Filename"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {formatSize(fileItem.file.size)}
                          </span>
                          {fileItem.isTooLarge && (
                            <span className="text-[10px] text-destructive font-semibold flex items-center gap-1 uppercase tracking-wider">
                              <AlertTriangle className="size-3" /> Exceeds 10MB
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="border border-border text-muted-foreground hover:text-foreground hover:border-destructive hover:bg-destructive/10"
                        onClick={() => removeFile(fileItem.id)}
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  ))}

                  {/* Add more files button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs py-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-3.5 mr-1" /> Add More Files
                  </Button>
                  <input
                    type="file"
                    multiple
                    ref={fileInputRef}
                    className="hidden"
                    accept=".pdf,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.csv,.json,.js,.ts,.tsx,.jsx,.css,.html,.py,.go,.rs,.sh,.yml,.yaml,.xml,.zip,.rar,.tar,.gz"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </div>
              )}

              {/* Uploading Animation state */}
              {isUploading && (
                <div className="flex flex-col items-center justify-center py-8 gap-4">
                  <div className="w-full h-1.5 bg-muted overflow-hidden relative border border-border">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: "0%" }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ ease: "easeInOut" }}
                    />
                  </div>
                  <div className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-wider text-muted-foreground font-mono">
                    <span>Uploading files...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {!isUploading && (
                <div className="flex flex-col gap-3 border-t border-border pt-4">
                  {exceedsQuota && (
                    <div className="text-[10px] text-destructive font-semibold flex items-center gap-1.5 uppercase tracking-wider bg-destructive/5 p-2 border border-destructive/20 select-none">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      <span>Upload exceeds overall 10MB limit (Remaining space: {formatSize(Math.max(0, 10 * 1024 * 1024 - currentTotalSize))})</span>
                    </div>
                  )}
                  <div className="flex items-center justify-end gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={onClose}
                      className="border border-border"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      disabled={files.length === 0 || hasErrors || exceedsQuota}
                      className="disabled:opacity-50"
                    >
                      Start Upload
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
