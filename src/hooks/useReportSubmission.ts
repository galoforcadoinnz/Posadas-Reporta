import { useCallback, useRef, useState } from 'react'
import { createReport, type CreateReportInput } from '../services/reports'
import type { ReportReceipt } from '../types/report'

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
    } catch {
      setSubmissionError('No se pudo guardar el reporte. Intentá nuevamente.')
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
