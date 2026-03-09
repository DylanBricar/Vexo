"use client";

import { useEffect } from "react";

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
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
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
    };
  }, [onClose, canBypass, onScreenshotDetected]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white cursor-pointer z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        aria-label="Fermer"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
      </button>

      <img
        src={src}
        alt=""
        className="max-w-[90vw] max-h-[90vh] object-contain select-none"
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!canBypass) onScreenshotDetected();
        }}
        draggable={false}
        style={{ WebkitUserSelect: "none", userSelect: "none" }}
      />
    </div>
  );
}
