import { useCallback, useRef, useState } from 'react'
import {
  createReport,
  ReportSubmissionError,
  type CreateReportInput,
} from '../services/reports'
import type { ReportReceipt } from '../types/report'

function messageForError(error: unknown) {
  if (!(error instanceof ReportSubmissionError)) {
    return 'No se pudo guardar el reporte. Intentá nuevamente.'
  }

  switch (error.code) {
    case 'RATE_LIMIT_EXCEEDED':
      return error.retryAfterSeconds
        ? `Alcanzaste el límite temporal. Intentá nuevamente en ${Math.ceil(error.retryAfterSeconds / 60)} minutos.`
        : 'Alcanzaste el límite temporal de reportes. Intentá más tarde.'
    case 'LOCATION_OUTSIDE_CITY':
      return 'La ubicación está fuera del área habilitada.'
    case 'CITY_REPORTING_BOUNDS_UNAVAILABLE':
      return 'Los reportes no están habilitados temporalmente para esta ciudad.'
    case 'TURNSTILE_INVALID':
      return 'La verificación antiabuso venció o no fue válida. Completala nuevamente.'
    case 'TURNSTILE_UNAVAILABLE':
      return 'La verificación antiabuso no está disponible. Intentá más tarde.'
    case 'TRUSTED_IP_UNAVAILABLE':
      return 'No se pudo validar el origen de la solicitud. Intentá más tarde.'
    case 'IDEMPOTENCY_CONFLICT':
      return 'La solicitud anterior no puede reutilizarse. Volvé a intentar el envío.'
    case 'INVALID_REQUEST':
    case 'INVALID_SUBMISSION':
    case 'BODY_TOO_LARGE':
    case 'UNSUPPORTED_MEDIA_TYPE':
      return 'Revisá los datos del reporte antes de volver a enviarlo.'
    default:
      return 'No se pudo guardar el reporte. Intentá nuevamente.'
  }
}

export function useReportSubmission() {
  const requestId = useRef(crypto.randomUUID())
  const submitting = useRef(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submissionError, setSubmissionError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<ReportReceipt | null>(null)
  const [turnstileGeneration, setTurnstileGeneration] = useState(0)

  const invalidateRequest = useCallback(() => {
    requestId.current = crypto.randomUUID()
    setSubmissionError(null)
    setTurnstileGeneration((current) => current + 1)
  }, [])

  const submit = useCallback(async (
    input: Omit<CreateReportInput, 'requestId'>
  ) => {
    if (submitting.current) return null
    submitting.current = true
    setIsSubmitting(true)
    setSubmissionError(null)

    try {
      const result = await createReport({
        ...input,
        requestId: requestId.current,
      })
      setReceipt(result)
      return result
    } catch (error) {
      if (
        error instanceof ReportSubmissionError &&
        error.code === 'IDEMPOTENCY_CONFLICT'
      ) {
        requestId.current = crypto.randomUUID()
      }
      setSubmissionError(messageForError(error))
      return null
    } finally {
      submitting.current = false
      setIsSubmitting(false)
      setTurnstileGeneration((current) => current + 1)
    }
  }, [])

  const reset = useCallback(() => {
    requestId.current = crypto.randomUUID()
    setSubmissionError(null)
    setReceipt(null)
    setTurnstileGeneration((current) => current + 1)
  }, [])

  return {
    isSubmitting,
    submissionError,
    receipt,
    turnstileGeneration,
    invalidateRequest,
    submit,
    reset,
  }
}
