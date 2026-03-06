'use client'

/**
 * A submit button that automatically shows <LoadingDots> while the
 * parent <form> server action is in flight (uses React's useFormStatus).
 */
import { useFormStatus } from 'react-dom'
import { LoadingDots } from './LoadingDots'

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode
}

export function SubmitButton({ children, className, disabled, ...rest }: Props) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={className}
      {...rest}
    >
      {pending ? <LoadingDots /> : children}
    </button>
  )
}
