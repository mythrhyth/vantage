import React, { useLayoutEffect, useRef } from "react"
import { createPortal } from "react-dom"

type ModalStackEntry = {
  element: HTMLElement
  close: () => void
}

const modalStack: ModalStackEntry[] = []
let bodyLockCount = 0
let previousBodyOverflow = ""

const focusableSelector = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",")

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) =>
      !element.hasAttribute("hidden")
      && element.getAttribute("aria-hidden") !== "true"
      && element.getClientRects().length > 0,
    )
}

export function ModalDialog({
  children,
  onClose,
  labelledBy,
  describedBy,
  className = "",
  overlayClassName = "",
  variant = "dialog",
  closeOnBackdrop = true,
}: {
  children: React.ReactNode
  onClose: () => void
  labelledBy: string
  describedBy?: string
  className?: string
  overlayClassName?: string
  variant?: "dialog" | "drawer"
  closeOnBackdrop?: boolean
}) {
  const dialogRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useLayoutEffect(() => {
    const element = dialogRef.current
    if (!element) return

    const activeElement = document.activeElement
    const previousFocus = activeElement instanceof HTMLElement ? activeElement : null
    const entry: ModalStackEntry = {
      element,
      close: () => closeRef.current(),
    }

    modalStack.push(entry)
    if (bodyLockCount === 0) {
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
    }
    bodyLockCount += 1

    const focusInitialElement = () => {
      const target =
        element.querySelector<HTMLElement>("[autofocus], [data-autofocus]")
        || getFocusableElements(element)[0]
        || element
      target.focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (modalStack[modalStack.length - 1] !== entry) return

      if (event.key === "Escape") {
        event.preventDefault()
        event.stopPropagation()
        entry.close()
        return
      }
      if (event.key !== "Tab") return

      const focusable = getFocusableElements(element)
      if (focusable.length === 0) {
        event.preventDefault()
        element.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (
        event.shiftKey
        && (document.activeElement === first || !element.contains(document.activeElement))
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey
        && (document.activeElement === last || !element.contains(document.activeElement))
      ) {
        event.preventDefault()
        first.focus()
      }
    }

    const keepFocusInside = (event: FocusEvent) => {
      if (
        modalStack[modalStack.length - 1] === entry
        && event.target instanceof Node
        && !element.contains(event.target)
      ) {
        focusInitialElement()
      }
    }

    focusInitialElement()
    document.addEventListener("keydown", handleKeyDown)
    document.addEventListener("focusin", keepFocusInside)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      document.removeEventListener("focusin", keepFocusInside)
      const index = modalStack.indexOf(entry)
      if (index !== -1) modalStack.splice(index, 1)
      bodyLockCount = Math.max(0, bodyLockCount - 1)
      if (bodyLockCount === 0) document.body.style.overflow = previousBodyOverflow

      const nextModal = modalStack[modalStack.length - 1]
      if (nextModal) {
        if (previousFocus && nextModal.element.contains(previousFocus)) previousFocus.focus()
        else nextModal.element.focus()
      } else if (previousFocus?.isConnected) {
        previousFocus.focus()
      }
    }
  }, [])

  if (typeof document === "undefined") return null

  const overlayClasses = [
    "explainability-overlay",
    variant === "drawer" ? "modal-drawer-overlay" : "",
    overlayClassName,
  ].filter(Boolean).join(" ")
  const dialogClasses = [
    "explainability-dialog",
    variant === "drawer" ? "modal-drawer" : "",
    className,
  ].filter(Boolean).join(" ")
  const portalRoot = document.querySelector<HTMLElement>(".app") || document.body

  return createPortal(
    <div
      className={overlayClasses}
      data-modal-overlay
      style={{ zIndex: 1100 + modalStack.length * 2 }}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) closeRef.current()
      }}
    >
      <section
        ref={(node) => {
          dialogRef.current = node
        }}
        className={dialogClasses}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>,
    portalRoot,
  )
}
