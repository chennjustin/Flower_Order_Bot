import type { OnboardingStep } from '@/types/auth'

/** Route for the given onboarding step. */
export function getOnboardingPath(step: OnboardingStep): string {
  switch (step) {
    case 'NAME':
      return '/onboarding/name'
    case 'LINE_OA':
      return '/onboarding/line-official'
    case 'DONE':
      return '/settings/order-fields'
  }
}
