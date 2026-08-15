import { Turnstile } from '@marsidev/react-turnstile'
import { useEffect } from 'react'
import { env } from '../config/env'

type TurnstileWidgetProps = {
  generation: number
  onTokenChange: (token: string | null) => void
}

function TurnstileWidget({
  generation,
  onTokenChange,
}: TurnstileWidgetProps) {
  useEffect(() => {
    onTokenChange(null)
  }, [generation, onTokenChange])

  return (
    <div className="turnstile-container">
      <Turnstile
        key={generation}
        siteKey={env.turnstileSiteKey}
        onSuccess={(token) => onTokenChange(token)}
        onExpire={() => onTokenChange(null)}
        onError={() => onTokenChange(null)}
        onTimeout={() => onTokenChange(null)}
        options={{
          action: 'submit_report',
          language: 'es',
          theme: 'auto',
          size: 'flexible',
          refreshExpired: 'auto',
        }}
      />
    </div>
  )
}

export default TurnstileWidget
