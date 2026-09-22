"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { downloadPng, publishShot, type ShotKind } from "@/lib/screenshot";

export function ScreenshotModal({
  blob,
  filename,
  kind,
  problem,
  onDismiss,
}: {
  blob?: Blob;
  filename: string;
  kind: ShotKind;
  problem?: string;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onDismissRef = useRef(onDismiss);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(problem ?? null);
  const [intentHref, setIntentHref] = useState<string | null>(null);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Strict Mode runs this cleanup after the open frame. Closing there
    // dismisses the dialog, and the close event unmounts it for good.
    let current = true;
    const handleClose = () => {
      if (current) onDismissRef.current();
    };
    const open = () => {
      if (current && dialog.isConnected && !dialog.open) dialog.showModal();
    };
    dialog.addEventListener("close", handleClose);
    open();
    const frame = requestAnimationFrame(open);
    return () => {
      current = false;
      cancelAnimationFrame(frame);
      dialog.removeEventListener("close", handleClose);
    };
  }, []);

  async function share() {
    if (!blob || busy) return;
    setBusy(true);
    setError(null);
    setIntentHref(null);
    try {
      const result = await publishShot({ blob, filename, kind });
      if (result.status === "cancelled") return;
      if (result.status === "ready") {
        setIntentHref(result.href);
        return;
      }
      onDismiss();
    } catch (shareError) {
      setError(
        shareError instanceof Error
          ? shareError.message
          : "The screenshot couldn't be shared.",
      );
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className="screenshot-modal panel"
      aria-label="Screenshot"
      aria-busy={busy}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      {preview ? (
        // The shot is already a PNG. The optimizer would resample the pixels.
        // biome-ignore lint/performance/noImgElement: keep the captured pixels intact
        <img className="screenshot-preview" src={preview} alt="" />
      ) : (
        <p className="screenshot-status" role="alert">
          {error ?? "Preparing the screenshot…"}
        </p>
      )}
      {preview && error && (
        <p className="screenshot-status" role="alert">
          {error}
        </p>
      )}
      {blob && (
        <div className="screenshot-actions">
          <button
            type="button"
            className="screenshot-download"
            onClick={() => downloadPng(blob, filename)}
          >
            Download
          </button>
          {intentHref ? (
            <a
              className="screenshot-open"
              href={intentHref}
              target="_blank"
              rel="noreferrer"
            >
              Open on X
            </a>
          ) : (
            <button
              type="button"
              className="screenshot-x"
              aria-label="Share on X"
              title="Share on X"
              disabled={busy}
              onClick={() => void share()}
            >
              <XMark />
            </button>
          )}
        </div>
      )}
    </dialog>,
    document.body,
  );
}

function XMark() {
  return (
    <svg className="screenshot-x-mark" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14.7 10.3 22.4 1h-1.8l-6.7 8-5.3-8H1.6l8.1 11.8L1.2 23h1.8l7.1-8.4 5.7 8.4h7.1l-8.2-12.7Zm-2.5 2.9-.8-1.2L4.2 2.6h2.8l5.3 7.6.8 1.2 6.9 9.9h-2.8l-5-7.1Z"
      />
    </svg>
  );
}
