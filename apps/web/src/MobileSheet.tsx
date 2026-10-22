import {
  Icon,
  X,
  Zap,
  Users,
  BookOpen,
  Scroll,
  Footprints,
  Info,
} from "./icons";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Secondary information is modal; board targeting stays in the nonmodal dock. */
export function MobileSheet({
  title,
  onClose,
  headerContent,
  children,
}: {
  title: string;
  onClose: () => void;
  headerContent?: ReactNode;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const label = useId();
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const node = dialog.current!;
    node.showModal();
    node.querySelector<HTMLElement>("[data-sheet-close]")?.focus();
    return () => {
      node.close();
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <dialog
      ref={dialog}
      className={`mobile-sheet ${headerContent ? "mobile-sheet-with-status" : ""}`}
      aria-labelledby={label}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        const focusable = [
          ...e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
          ),
        ].filter(
          (node) => node.getClientRects().length && !node.closest("[inert]"),
        );
        const first = focusable[0],
          last = focusable.at(-1);
        if (!first || !last) {
          e.preventDefault();
          return;
        }
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !e.currentTarget.contains(document.activeElement))
        ) {
          e.preventDefault();
          last.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !e.currentTarget.contains(document.activeElement))
        ) {
          e.preventDefault();
          first.focus();
        }
      }}
      onCancel={(e) => {
        e.preventDefault();
        close.current();
      }}
    >
      <header className="mobile-sheet-heading">
        <div>
          <span className="sheet-handle" aria-hidden="true" />
          <h2 id={label}>
            <Icon
              icon={
                title === "Skills"
                  ? Zap
                  : title === "Players"
                    ? Users
                    : title === "Match Events"
                      ? Scroll
                      : title === "Choose a move"
                        ? Footprints
                        : title === "Welcome to War"
                          ? Info
                          : BookOpen
              }
            />{" "}
            {title}
          </h2>
          {headerContent && (
            <div className="mobile-sheet-status">{headerContent}</div>
          )}
        </div>
        <button
          data-sheet-close
          aria-label={`Close ${title}`}
          onClick={onClose}
        >
          <Icon icon={X} />
        </button>
      </header>
      <div className="mobile-sheet-body">{children}</div>
    </dialog>,
    document.body,
  );
}
