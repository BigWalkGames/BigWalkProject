import type { HTMLAttributes, ReactNode } from 'react'
import './AuthForm.css'

/**
 * Shared pieces for the login, sign-up, reset-password and account forms.
 * Esc inside a text box doesn't reach useHotkeys, so the form handles it.
 */
export function AuthForm({
  onSubmit,
  onEscape,
  children,
}: {
  onSubmit: () => void
  onEscape?: () => void
  children: ReactNode
}) {
  return (
    <form
      className="auth-form"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && onEscape) {
          e.preventDefault()
          onEscape()
        }
      }}>
      {children}
    </form>
  )
}

type FieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'email' | 'password'
  autoComplete?: string
  autoFocus?: boolean
  maxLength?: number
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  hint?: string
}

export function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  autoFocus,
  maxLength,
  inputMode,
  hint,
}: FieldProps) {
  return (
    <div className="auth-field">
      <label className="auth-field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="auth-field__input"
        type={type}
        value={value}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        maxLength={maxLength}
        inputMode={inputMode}
        autoCapitalize="none"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <p className="auth-field__hint">{hint}</p>}
    </div>
  )
}

export function FormMessage({
  error,
  notice,
}: {
  error?: string
  notice?: string
}) {
  if (error) {
    return (
      <p className="auth-msg auth-msg--error" role="alert">
        {error}
      </p>
    )
  }
  if (notice) {
    return (
      <p className="auth-msg auth-msg--notice" role="status">
        {notice}
      </p>
    )
  }
  return null
}

// Small text-style button for secondary actions like "Forgot password?"
export function LinkButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      className="auth-link"
      onClick={onClick}
      disabled={disabled}>
      {children}
    </button>
  )
}
