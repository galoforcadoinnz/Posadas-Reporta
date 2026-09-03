import { useCallback, useReducer } from 'react'
import type { Category, Subcategory } from '../types/category'
import type {
  ReportDetailsDraft,
  ReportDraft,
  ReportLocation,
  ReportStep,
} from '../types/report'

export const INITIAL_REPORT_DRAFT: ReportDraft = {
  location: null,
  category: null,
  subcategory: null,
  description: '',
  photo: null,
  urgency: 'medium',
}

export type ReportDraftState = {
  step: ReportStep
  draft: ReportDraft
}

type ReportDraftAction =
  | { type: 'locationSelected'; location: ReportLocation }
  | {
      type: 'categorySelected'
      category: Category
      subcategory: Subcategory | null
    }
  | { type: 'detailsChanged'; changes: Partial<ReportDetailsDraft> }
  | { type: 'detailsCompleted' }
  | { type: 'backToMap' }
  | { type: 'backToCategory' }
  | { type: 'backToDetails' }
  | { type: 'submissionSucceeded' }
  | { type: 'reset' }

export const INITIAL_REPORT_DRAFT_STATE: ReportDraftState = {
  step: 'map',
  draft: INITIAL_REPORT_DRAFT,
}

function hasRequiredDraftData(draft: ReportDraft) {
  return Boolean(
    draft.location &&
    draft.category &&
    draft.description.trim()
  )
}

export function reportDraftReducer(
  state: ReportDraftState,
  action: ReportDraftAction
): ReportDraftState {
  switch (action.type) {
    case 'locationSelected':
      return {
        step: 'category',
        draft: { ...state.draft, location: action.location },
      }
    case 'categorySelected':
      if (!state.draft.location) return state
      return {
        step: 'details',
        draft: {
          ...state.draft,
          category: action.category,
          subcategory: action.subcategory,
        },
      }
    case 'detailsChanged':
      return {
        ...state,
        draft: { ...state.draft, ...action.changes },
      }
    case 'detailsCompleted':
      return hasRequiredDraftData(state.draft)
        ? { ...state, step: 'preview' }
        : state
    case 'backToMap':
      return { ...state, step: 'map' }
    case 'backToCategory':
      return state.draft.location
        ? { ...state, step: 'category' }
        : state
    case 'backToDetails':
      return state.draft.location && state.draft.category
        ? { ...state, step: 'details' }
        : state
    case 'submissionSucceeded':
      return hasRequiredDraftData(state.draft)
        ? { ...state, step: 'success' }
        : state
    case 'reset':
      return INITIAL_REPORT_DRAFT_STATE
  }
}

export function useReportDraft() {
  const [state, dispatch] = useReducer(
    reportDraftReducer,
    INITIAL_REPORT_DRAFT_STATE
  )

  const selectLocation = useCallback((location: ReportLocation) => {
    dispatch({ type: 'locationSelected', location })
  }, [])

  const selectCategory = useCallback((
    category: Category,
    subcategory: Subcategory | null
  ) => {
    dispatch({ type: 'categorySelected', category, subcategory })
  }, [])

  const updateDetails = useCallback((
    changes: Partial<ReportDetailsDraft>
  ) => {
    dispatch({ type: 'detailsChanged', changes })
  }, [])

  const completeDetails = useCallback(() => {
    dispatch({ type: 'detailsCompleted' })
  }, [])

  const backToMap = useCallback(() => dispatch({ type: 'backToMap' }), [])
  const backToCategory = useCallback(
    () => dispatch({ type: 'backToCategory' }),
    []
  )
  const backToDetails = useCallback(
    () => dispatch({ type: 'backToDetails' }),
    []
  )
  const markSubmissionSucceeded = useCallback(
    () => dispatch({ type: 'submissionSucceeded' }),
    []
  )
  const resetDraft = useCallback(() => dispatch({ type: 'reset' }), [])

  return {
    reportStep: state.step,
    reportDraft: state.draft,
    selectLocation,
    selectCategory,
    updateDetails,
    completeDetails,
    backToMap,
    backToCategory,
    backToDetails,
    markSubmissionSucceeded,
    resetDraft,
  }
}
