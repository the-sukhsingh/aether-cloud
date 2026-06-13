"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, FolderPlus } from "lucide-react";
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

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (folderName: string) => Promise<void>;
}

export default function FolderModal({ isOpen, onClose, onCreate }: FolderModalProps) {
  const [folderName, setFolderName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [directions, setDirections] = useState(getRandomDirections);

  useEffect(() => {
    if (isOpen) {
      setFolderName("");
      setError("");
      setIsSubmitting(false);
    }

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    }

    addEventListener("keydown", handleKey);
    return () => removeEventListener("keydown", handleKey)

  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = folderName.trim();

    if (!trimmed) {
      setError("Folder name cannot be empty");
      return;
    }

    if (trimmed.includes("/") || trimmed.includes("\\")) {
      setError("Folder name cannot contain slashes");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      await onCreate(trimmed);
      onClose();
      noti.success(`Folder "${trimmed}" created successfully`);
    } catch (err: any) {
      setError(err.message || "Failed to create folder");
      setIsSubmitting(false);
    }
  };

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
          <div className="absolute inset-0" onClick={() => !isSubmitting && onClose()} />
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
            className="relative w-full max-w-sm p-2 rounded-none"
          >
            <div className="absolute -inset-8 z-[-1] [--pattern-fg:var(--color-primary)] dark:[--pattern-fg:#ffffff] bg-[repeating-linear-gradient(315deg,var(--pattern-fg)_0,var(--pattern-fg)_1px,transparent_0,transparent_50%)] bg-size-[10px_10px] bg-fixed opacity-40" />
            <div className="bg-background p-6 border border-border flex flex-col gap-5 ">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <FolderPlus className="size-6 text-muted-foreground" />
                <h2 className="text-sm font-semibold tracking-wider uppercase">New Folder</h2>
              </div>
              {!isSubmitting && (
                <Button variant="ghost" size="icon-xs" className="rounded-none border border-border" onClick={onClose}>
                  <X className="size-4" />
                </Button>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="folder-name" className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  Folder Name
                </label>
                <input
                  id="folder-name"
                  type="text"
                  value={folderName}
                  onChange={(e) => {
                    setFolderName(e.target.value);
                    if (error) setError("");
                  }}
                  disabled={isSubmitting}
                  className="text-xs border border-border px-3 py-2 bg-background rounded-none font-medium w-full focus:border-primary outline-none"
                  placeholder="e.g. Assets, Invoices, Docs"
                  autoFocus
                />
                {error && (
                  <span className="text-[10px] text-destructive font-semibold uppercase tracking-wider mt-1">
                    {error}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="border border-border"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || !folderName.trim()}
                  className="disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Folder"}
                </Button>
              </div>
            </form>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
