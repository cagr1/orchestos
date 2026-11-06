"use client";

import { FileText } from "lucide-react";
import { useCallback, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { useShape } from "@/lib/shape-context";

// ─── Object URLs ──────────────────────────────────────────────────────────
// One blob URL per File while any thumbnail shows it. The last unsubscribe does
// not revoke at once: the revoke is deferred so a thumbnail that unmounts and
// remounts right away (list re-render, StrictMode's simulated remount, the
// composer chip handing the file over to the sent message) reuses the same URL
// instead of racing a revoked one. A late resubscribe cancels the pending revoke.
const OBJECT_URL_GRACE_MS = 3000;
const objectUrls = new Map<
  File,
  { url: string; users: number; timer: ReturnType<typeof setTimeout> | null }
>();

function subscribeObjectUrl(file: File) {
  let entry = objectUrls.get(file);
  if (!entry) {
    entry = { url: URL.createObjectURL(file), users: 0, timer: null };
    objectUrls.set(file, entry);
  }
  if (entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
  entry.users += 1;
  const held = entry;
  return () => {
    held.users -= 1;
    if (held.users === 0) {
      held.timer = setTimeout(() => {
        if (held.users === 0 && objectUrls.get(file) === held) {
          URL.revokeObjectURL(held.url);
          objectUrls.delete(file);
        }
      }, OBJECT_URL_GRACE_MS);
    }
  };
}

function useObjectUrl(file: File | null): string | null {
  const subscribe = useCallback(
    () => (file ? subscribeObjectUrl(file) : () => {}),
    [file]
  );
  return useSyncExternalStore(
    subscribe,
    () => (file ? (objectUrls.get(file)?.url ?? null) : null),
    () => null
  );
}

// ─── File thumbnail ───────────────────────────────────────────────────────
// Read-only square preview of a File. Images use object-cover via
// `URL.createObjectURL`; PDFs render the first page via pdfjs; while either is
// resolving a spinner is shown. Self-contained (outline + surface + sizing) so
// it can be reused both inside the composer's preview row and to render
// already-sent attachments in a chat transcript.
interface FileThumbnailProps {
  file: File;
  /** Side length of the square thumbnail in pixels. */
  size: number;
  /** Explicit corner radius for a known nested inset. Defaults to the active
   *  shape's regular image/control radius. */
  radius?: number;
  className?: string;
}

function FileThumbnail({ file, size, radius, className }: FileThumbnailProps) {
  const shape = useShape();
  const isImage = file.type.startsWith("image/");

  // The URL exists from the commit on, so the first render has none. That
  // one-frame "before URL" state is covered by the bg-accent (no fallback
  // icon shown for images), so the transition is visually clean.
  const imageUrl = useObjectUrl(isImage ? file : null);

  const extension = file.name.split(".").pop()?.toUpperCase() ?? "FILE";

  return (
    <div
      className={cn(
        // Paint the hairline over the preview: unlike a border, it costs no
        // space, and pure neutral ink stays clean over every surface tint.
        "relative shrink-0 overflow-hidden bg-accent outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10",
        shape.bg,
        className
      )}
      style={{
        width: size,
        height: size,
        // Keep className radius overrides working at the default. Inline
        // geometry is reserved for an explicit nested-radius calculation.
        ...(radius == null ? {} : { borderRadius: radius }),
      }}
    >
      {isImage && imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={file.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : isImage ? (
        // Circular spinner while we wait for the preview to be ready.
        // Used during the brief image URL creation gap. The thin ring is subtle
        // with one quadrant accented (border-t-muted-foreground) so the
        // `animate-spin` rotation reads as a moving arc.
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="w-6 h-6 rounded-full border-2 border-border border-t-muted-foreground animate-spin"
            aria-label="Loading preview"
            role="status"
          />
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-surface-3 text-muted-foreground" role="img" aria-label={file.name}>
          <FileText size={Math.max(16, size * 0.35)} aria-hidden="true" />
          <span className="text-micro">{extension}</span>
        </div>
      )}
    </div>
  );
}

export { FileThumbnail };
export type { FileThumbnailProps };
