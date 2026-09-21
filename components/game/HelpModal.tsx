"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Markdown } from "./Markdown";
import { forgetWelcomeDismissal } from "./WelcomeSplash";

export function HelpModal({
  onDismiss,
  onRestoreWelcome,
}: {
  onDismiss: () => void;
  onRestoreWelcome: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onDismissRef = useRef(onDismiss);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [storageError, setStorageError] = useState(false);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/help", { signal: controller.signal, cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("Help could not be loaded.");
        return response.text();
      })
      .then((text) => setMarkdown(text))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setLoadError(true);
      });
    return () => controller.abort();
  }, []);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onDismissRef.current();
    dialog.addEventListener("close", handleClose);
    // Open after the click that summoned the dialog, so that click does not dismiss it.
    const frame = requestAnimationFrame(() => {
      if (!dialog.open) dialog.showModal();
    });
    return () => {
      cancelAnimationFrame(frame);
      dialog.removeEventListener("close", handleClose);
      if (dialog.open) dialog.close();
    };
  }, []);

  function restoreWelcome() {
    try {
      forgetWelcomeDismissal();
    } catch {
      setStorageError(true);
      return;
    }
    onRestoreWelcome();
  }

  return createPortal(
    <dialog
      ref={dialogRef}
      className="help-modal"
      aria-label="Help"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onDismiss();
      }}
    >
      <button
        type="button"
        className="help-close"
        aria-label="Close help"
        onClick={onDismiss}
      >
        <span aria-hidden="true">×</span>
      </button>
      <div className="help-modal-body">
        {markdown !== null ? (
          <Markdown source={markdown} />
        ) : (
          <p className="help-status" role={loadError ? "alert" : "status"}>
            {loadError ? "The help file couldn’t be loaded." : "Loading help…"}
          </p>
        )}
      </div>
      <footer className="help-modal-footer">
        {storageError && (
          <p className="help-storage-error" role="alert">
            Your browser couldn’t forget this preference. The welcome screen
            will stay hidden next time.
          </p>
        )}
        <button type="button" className="help-restore" onClick={restoreWelcome}>
          Show the welcome screen again
        </button>
      </footer>
    </dialog>,
    document.body,
  );
}
