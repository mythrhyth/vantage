import React from "react"
import { IconName } from "../../types"
import { Icon } from "../common/Icon"

export function Button({
  children,
  variant = "primary",
  onClick,
  icon,
  ariaLabel,
  className = "",
  ariaPressed,
  disabled,
  loading = false,
}: {
  children: React.ReactNode
  variant?: "primary" | "secondary" | "outline" | "text" | "icon"
  onClick?: () => void
  icon?: IconName
  ariaLabel?: string
  className?: string
  ariaPressed?: boolean
  disabled?: boolean
  loading?: boolean
}) {
  return (
    <button
      type="button"
      className={`button button-${variant} ${loading ? "is-loading" : ""} ${className}`}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      disabled={disabled || loading}
    >
      {loading ? (
        <span className="button-spinner" aria-hidden="true" />
      ) : (
        icon && <Icon name={icon} size={16} />
      )}
      <span>{children}</span>
    </button>
  )
}
