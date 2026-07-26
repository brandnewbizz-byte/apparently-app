# Logger Migration Summary

Generated: 2026-07-24T14:21:37.224Z

## Files Modified

| File | Replacements |
|------|-------------|
| `contexts/AuthContext.tsx` | 36 |
| `contexts/BundleContext.tsx` | 2 |
| `contexts/ServiceRequestContext.tsx` | 2 |
| `contexts/SwapContext.tsx` | 37 |
| `contexts/MessagingContext.tsx` | 8 |
| `contexts/OnboardingContext.tsx` | 2 |
| `contexts/SocialContext.tsx` | 39 |
| `contexts/MarketplaceContext.tsx` | 16 |
| `contexts/ConnectionsContext.tsx` | 27 |
| `contexts/LifeCrmContext.tsx` | 39 |
| `contexts/PlannerContext.tsx` | 17 |
| `contexts/BookingsContext.tsx` | 42 |
| `contexts/ThemeContext.tsx` | 4 |
| `app/_layout.tsx` | 5 |

## Files Skipped (no console.log/error/warn calls)

- `contexts/TabBarContext.tsx`
- `app/(tabs)/feed/index.tsx`
- `lib/feedAggregator.ts`

## Conversion Rules Applied

- `console.log` → `logger.info`
- `console.error` → `logger.error`
- `console.warn` → `logger.warn`
- `console.debug` → left unchanged
- Bracketed context tag (e.g. `[AuthContext]`) extracted as first argument
- Remaining message string becomes second argument (trailing colons stripped)
- Simple variable extra args → shorthand `{ var }`
- Compound expression extra args (e.g. `error.message`) → `{ message: error.message }`
- Object literal extra args → passed directly as data object
- Files with no `console.log/error/warn` calls: skipped entirely (no import added)
- Import path: `import { logger } from '@/lib/logger'`

**Total replacements across 14 files: 276**
