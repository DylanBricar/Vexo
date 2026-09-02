"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef } from "react";
import { CloseIcon } from "@/components/chat/ChatIcons";

interface ImageLightboxProps {
  src: string;
  onClose: () => void;
  canBypass: boolean;
  onScreenshotDetected: () => void;
}

export default function ImageLightbox({
  src,
  onClose,
  canBypass,
  onScreenshotDetected,
}: ImageLightboxProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab") {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && !canBypass) {
        onScreenshotDetected();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("visibilitychange", handleVisibility);
      previouslyFocused?.focus();
    };
  }, [onClose, canBypass, onScreenshotDetected]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Aperçu de l'image"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white cursor-pointer z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="Fermer"
      >
        <CloseIcon />
      </button>

      <img
        src={src}
        alt="Image envoyée agrandie"
        className="max-w-[90vw] max-h-[90vh] object-contain select-none"
        onContextMenu={(e) => {
          e.preventDefault();
          if (!canBypass) onScreenshotDetected();
        }}
        draggable={false}
      />
    </div>
  );
}
