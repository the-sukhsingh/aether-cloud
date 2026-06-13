"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import {
  Cloud,
  Copy,
  RefreshCw,
  FolderOpen,
  ArrowRightLeft,
  Check,
  CheckCircle,
  AlertCircle,
  Database,
  ArrowRight,
  User,
  Plus,
  Upload as UploadIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/theme/ThemeToggle";
import FileExplorer from "@/components/FileExplorer";
import UploadModal from "@/components/UploadModal";
import FolderModal from "@/components/FolderModal";
import DetailsDrawer from "@/components/DetailsDrawer";
import {
  CloudItem,
  checkS3Status,
  storageClient,
  prepopulateIndexedDB,
} from "@/lib/storage";
import { noti } from "noti-toast";

export default function Home() {
  const { theme } = useTheme();

  // Core state
  const [userId, setUserId] = useState<string>("");
  const [isS3Active, setIsS3Active] = useState<boolean>(false);
  const [items, setItems] = useState<CloudItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>(""); // Relative to user root
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modals & Panels
  const [selectedFile, setSelectedFile] = useState<CloudItem | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isFolderOpen, setIsFolderOpen] = useState<boolean>(false);
  const [isMoving, setIsMoving] = useState<boolean>(false);

  // User management UI state
  const [isEditingUserId, setIsEditingUserId] = useState<boolean>(false);
  const [userIdInput, setUserIdInput] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);

  // Drag and Drop (OS Files) State
  const [isPageDragging, setIsPageDragging] = useState<boolean>(false);
  const [droppedFiles, setDroppedFiles] = useState<FileList | null>(null);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatPercent = (bytes: number) => {
    const pct = (bytes / (10 * 1024 * 1024)) * 100;
    return `${Math.min(pct, 100).toFixed(1)}%`;
  };

  const totalSize = items.reduce((acc, item) => acc + item.size, 0);

  // Initialize userId and S3 configuration status
  useEffect(() => {
    const init = async () => {
      // 1. Check if S3 is active
      const s3Status = await checkS3Status();
      setIsS3Active(s3Status);

      // 2. Fetch or create userId
      let id = localStorage.getItem("cloud_storage_userid");
      if (!id) {
        id = `user_${Math.random().toString(36).substring(2, 9)}`;
        localStorage.setItem("cloud_storage_userid", id);
      }
      setUserId(id);
      setUserIdInput(id);

      // 3. Prepopulate IndexedDB if not using S3
      if (!s3Status) {
        await prepopulateIndexedDB(id);
      }
    };
    init();
  }, []);

  // Fetch file list when userId or S3 status changes
  const fetchFiles = async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const list = await storageClient.list(userId, isS3Active);
      setItems(list);
    } catch (err: any) {
      console.error(err);
      noti.error("Failed to load file index.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchFiles();
    }
  }, [userId, isS3Active]);

  // Copy User Space ID
  const copyUserId = () => {
    navigator.clipboard.writeText(userId);
    setCopied(true);
    noti.success("Workspace ID copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  // Switch Workspace/UserId
  const handleSwitchUserId = async () => {
    const trimmed = userIdInput.trim();
    if (!trimmed) return;

    localStorage.setItem("cloud_storage_userid", trimmed);
    setUserId(trimmed);
    setIsEditingUserId(false);
    setCurrentPath("");
    setSelectedFile(null);
    noti.info(`Switched to workspace: ${trimmed}`);

    if (!isS3Active) {
      await prepopulateIndexedDB(trimmed);
    }
  };

  // Generate new Workspace/UserId
  const handleRegenerateUserId = () => {
    const newId = `user_${Math.random().toString(36).substring(2, 9)}`;
    setUserIdInput(newId);
  };

  // File explorer callbacks
  const handleUpload = async (filesToUpload: { file: File; customName: string }[]) => {
    const uploadSize = filesToUpload.reduce((acc, item) => acc + item.file.size, 0);
    
    if (totalSize + uploadSize > 10 * 1024 * 1024) {
      noti.error(`Upload failed: Exceeds overall storage limit of 10MB (Used: ${formatSize(totalSize)}).`);
      throw new Error("Storage quota exceeded");
    }

    try {
      for (const item of filesToUpload) {
        const relativeKey = currentPath ? `${currentPath}/${item.customName}` : item.customName;
        const key = `${userId}/${relativeKey}`;
        await storageClient.upload(userId, key, item.customName, item.file, isS3Active);
      }
      await fetchFiles();
    } catch (err: any) {
      console.error(err);
      noti.error(err.message || "Failed to upload file(s)");
      throw err;
    }
  };

  const handleCreateFolder = async (folderName: string) => {
    try {
      const relativeKey = currentPath ? `${currentPath}/${folderName}/` : `${folderName}/`;
      const key = `${userId}/${relativeKey}`;
      await storageClient.createFolder(userId, key, isS3Active);
      await fetchFiles();
    } catch (err: any) {
      console.error(err);
      noti.error(err.message || "Failed to create folder");
      throw err;
    }
  };

  const handleDelete = async (key: string) => {
    try {
      await storageClient.delete(key, isS3Active);
      
      // Clear drawer selection if the deleted file is currently open
      if (selectedFile && selectedFile.key === key) {
        setSelectedFile(null);
      }
      
      await fetchFiles();
      noti.success("Item deleted successfully");
    } catch (err: any) {
      console.error(err);
      noti.error(err.message || "Failed to delete item");
      throw err;
    }
  };

  const handleRename = async (oldKey: string, newName: string) => {
    try {
      const isFolder = oldKey.endsWith("/");
      const keySegments = oldKey.split("/");
      const rootPrefix = keySegments[0]; // userId

      let newKey = "";
      if (isFolder) {
        // e.g. userId/Folder1/ -> userId/newName/
        keySegments[keySegments.length - 2] = newName;
        newKey = keySegments.join("/");
      } else {
        // e.g. userId/Folder1/file.txt -> userId/Folder1/newName.txt
        const oldName = keySegments[keySegments.length - 1];
        const extParts = oldName.split(".");
        const ext = extParts.length > 1 ? extParts.pop() : "";
        const newFilename = newName.includes(".") || !ext ? newName : `${newName}.${ext}`;
        keySegments[keySegments.length - 1] = newFilename;
        newKey = keySegments.join("/");
      }

      await storageClient.rename(oldKey, newKey, isS3Active);
      
      // Update selected file preview info in place
      if (selectedFile && selectedFile.key === oldKey) {
        const segments = newKey.replace(`${userId}/`, "").split("/");
        const display_name = isFolder ? segments[segments.length - 2] + "/" : segments[segments.length - 1];
        setSelectedFile({
          ...selectedFile,
          key: newKey,
          name: display_name,
        });
      }
      
      await fetchFiles();
      noti.success("Renamed successfully");
    } catch (err: any) {
      console.error(err);
      noti.error(err.message || "Failed to rename");
      throw err;
    }
  };

  const handleMoveItem = async (sourceKey: string, targetFolderKey: string) => {
    setIsMoving(true);
    try {
      const isSourceFolder = sourceKey.endsWith("/");
      const sourceSegments = sourceKey.replace(/\/$/, "").split("/");
      const sourceName = sourceSegments[sourceSegments.length - 1] + (isSourceFolder ? "/" : "");
      
      const newKey = `${targetFolderKey}${sourceName}`;
      
      await storageClient.rename(sourceKey, newKey, isS3Active);
      await fetchFiles();
      
      const cleanName = sourceName.replace(/\/$/, "");
      const folderName = targetFolderKey.split("/").slice(-2)[0] || "root";
      noti.success(`Moved "${cleanName}" to folder "${folderName}"`);
    } catch (err: any) {
      console.error(err);
      noti.error(err.message || "Failed to move item");
      throw err;
    } finally {
      setIsMoving(false);
    }
  };

  // Full Page Drag & Drop logic for OS Files
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) {
      setIsPageDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only turn off if cursor leaves the main window frame
    if (e.currentTarget === e.target || e.clientX === 0 || e.clientY === 0) {
      setIsPageDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPageDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setDroppedFiles(e.dataTransfer.files);
      setIsUploadOpen(true);
    }
  };

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="flex-1 flex flex-col bg-background text-foreground"
    >
      {/* Top Navbar */}
      <header className="flex items-center justify-between border-b border-border py-3 px-6 shrink-0 bg-background select-none">
        {/* App Title */}
        <div className="flex items-center gap-2">
          <div className="size-6 border border-primary bg-primary/10 flex items-center justify-center">
            <Cloud className="size-3.5 text-primary" />
          </div>
          <h1 className="text-xs font-bold uppercase tracking-widest text-foreground">
            AETHER<span className="text-primary">CLOUD</span>
          </h1>
        </div>

        {/* Workspace Display / Switcher */}
        <div className="flex items-center gap-3 ">
          {isEditingUserId ? (
            <div className="flex items-center justify-between border border-border bg-background select-text h-7">
              <input
                type="text"
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                className="text-[11px] font-mono px-3 bg-transparent outline-none h-full w-[160px]"
                placeholder="Workspace ID"
                onKeyDown={(e) => e.key === "Enter" && handleSwitchUserId()}
              />
              <div className="flex items-center h-full shrink-0">
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="border-y-0 border-r-0 border-border rounded-none h-full shrink-0"
                  onClick={handleSwitchUserId}
                >
                  <Check className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="border-y-0 border-r-0 border-border rounded-none h-full shrink-0 text-muted-foreground"
                  onClick={handleRegenerateUserId}
                  title="Generate New ID"
                >
                  <RefreshCw className="size-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="border-y-0 border-r-0 border-border rounded-none h-full shrink-0 text-destructive"
                  onClick={() => {
                    setIsEditingUserId(false);
                    setUserIdInput(userId);
                  }}
                >
                  <X className="size-3" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center border border-border px-3 py-1 bg-muted/20">
              <User className="size-3.5 text-muted-foreground mr-1.5" />
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mr-2">
                Space:
              </span>
              <span className="text-[11px] font-mono font-medium truncate max-w-[100px] sm:max-w-[150px] mr-2">
                {userId}
              </span>
              <button
                onClick={copyUserId}
                className="text-muted-foreground hover:text-foreground mr-2 p-0.5"
                title="Copy space ID"
              >
                <Copy className="size-3" />
              </button>
              <button
                onClick={() => setIsEditingUserId(true)}
                className="text-[10px] uppercase font-semibold text-primary tracking-wider hover:underline"
              >
                Switch
              </button>
            </div>
          )}

          {/* Theme Switcher */}
          <ModeToggle />
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Left Sidebar */}
        <aside className="w-[240px] border-r border-border flex-col justify-between hidden md:flex shrink-0 bg-background select-none">
          <div className="p-4 flex flex-col gap-6">
            {/* Storage space status */}
            <div className="flex flex-col gap-2.5 border border-border p-4 bg-muted/10">
              <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                <span>Adapter Status</span>
                <span className="font-mono">
                  {isS3Active ? "AWS S3" : "LOCAL DB"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {isS3Active ? (
                  <CheckCircle className="size-4 text-emerald-500" />
                ) : (
                  <AlertCircle className="size-4 text-amber-500" />
                )}
                <span className="text-xs font-semibold uppercase tracking-wider">
                  {isS3Active ? "Cloud Bucket Sync" : "IndexedDB Mode"}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                {isS3Active
                  ? "Connected directly to S3 storage bucket. Files uploaded here are saved in the cloud."
                  : "Running locally inside your browser storage. Set AWS variables in .env to activate Cloud Mode."}
              </p>
            </div>

            {/* Quick Folders */}
            <div className="flex flex-col gap-2.5">
              <h3 className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Quick Access
              </h3>
              <div className="flex flex-col gap-1 text-xs">
                <button
                  onClick={() => setCurrentPath("")}
                  className={`flex items-center gap-2 py-2 px-3 border text-left transition-colors rounded-none ${
                    currentPath === ""
                      ? "border-primary bg-primary/5 font-semibold text-primary"
                      : "border-transparent hover:border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FolderOpen className="size-3.5" /> All Workspaces
                </button>
                {/* Find top level subfolders and list them */}
                {Array.from(
                  new Set(
                    items
                      .filter((i) => i.isFolder)
                      .map((i) => {
                        // Strip prefix userId
                        const rel = i.key.replace(`${userId}/`, "");
                        const topLevelName = rel.split("/")[0];
                        return topLevelName;
                      })
                      .filter(Boolean)
                  )
                ).map((folderName) => (
                  <button
                    key={folderName}
                    onClick={() => setCurrentPath(folderName)}
                    className={`flex items-center gap-2 py-2 px-3 border text-left transition-colors rounded-none truncate ${
                      currentPath === folderName
                        ? "border-primary bg-primary/5 font-semibold text-primary"
                        : "border-transparent hover:border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <FolderOpen className="size-3.5 text-muted-foreground" /> {folderName}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Footer info */}
          <div className="p-4 border-t border-border flex flex-col gap-3 text-[10px] text-muted-foreground/80 tracking-wide font-mono bg-muted/5">
            <div className="flex flex-col gap-1.5 select-none">
              <div className="flex items-center justify-between text-[9px] uppercase font-bold text-muted-foreground">
                <span>Storage Used</span>
                <span>{formatPercent(totalSize)}</span>
              </div>
              <div className="w-full h-1.5 bg-muted border border-border overflow-hidden">
                <div 
                  className={`h-full transition-all duration-300 ${
                    totalSize >= 10 * 1024 * 1024 ? "bg-destructive" : "bg-primary"
                  }`} 
                  style={{ width: `${Math.min((totalSize / (10 * 1024 * 1024)) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px]">
                <span>{formatSize(totalSize)}</span>
                <span>10.0 MB Limit</span>
              </div>
            </div>
            <div className="flex flex-col gap-0.5 border-t border-border/40 pt-2 select-text">
              <div>Workspace ID: {userId.substring(0, 12)}...</div>
              <div>Engine: {isS3Active ? "AWS S3 Cloud" : "IndexedDB Local"}</div>
            </div>
          </div>
        </aside>

        {/* Center Main Area: File Explorer */}
        <main className="flex-1 flex flex-col min-w-0 bg-background">
          <FileExplorer
            items={items}
            currentPath={currentPath}
            userId={userId}
            isLoading={isLoading}
            isMoving={isMoving}
            onNavigate={setCurrentPath}
            onUploadClick={() => setIsUploadOpen(true)}
            onCreateFolderClick={() => setIsFolderOpen(true)}
            onFileClick={setSelectedFile}
            onMoveItem={handleMoveItem}
            onDeleteItem={handleDelete}
            onRenameItem={handleRename}
            isS3Mode={isS3Active}
          />
        </main>

        {/* Details Slider panel on the half-right screen */}
        <DetailsDrawer
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          onDelete={handleDelete}
          onRename={handleRename}
          isS3Mode={isS3Active}
        />
      </div>

      {/* Connection Indicator Status bar for smaller screens */}
      <div className="md:hidden flex items-center justify-between border-t border-border bg-muted/20 py-2 px-4 text-[10px] text-muted-foreground select-none">
        <div className="flex items-center gap-1.5">
          <Database className="size-3" />
          <span>Used: {formatSize(totalSize)} / 10MB ({formatPercent(totalSize)})</span>
        </div>
        <span>{isS3Active ? "AWS S3" : "Local DB"}</span>
      </div>

      {/* Folder Creation Modal */}
      <FolderModal
        isOpen={isFolderOpen}
        onClose={() => setIsFolderOpen(false)}
        onCreate={handleCreateFolder}
      />

      {/* File Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => {
          setIsUploadOpen(false);
          setDroppedFiles(null);
        }}
        onUpload={handleUpload}
        currentPath={currentPath}
        initialFiles={droppedFiles}
        currentTotalSize={totalSize}
      />

      {/* Fullscreen OS Drag & Drop Hover Overlay */}
      {isPageDragging && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center p-6 border-4 border-dashed border-primary animate-pulse pointer-events-none">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="size-16 border border-primary bg-primary/10 flex items-center justify-center rounded-none">
              <UploadIcon className="size-8 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-foreground">
                Drop Files Here
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Release your mouse to prepare files for upload to 
                <span className="font-mono text-foreground font-semibold"> /{currentPath || "root"}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
