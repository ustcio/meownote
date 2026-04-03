/**
 * @deprecated This file is deprecated. Use `@/lib/workspace/api` instead.
 *
 * The centralized workspace API at `@/lib/workspace/api` now provides:
 * - Proper authentication (no longer skips auth)
 * - CSRF protection for state-changing requests
 * - Retry logic with exponential backoff
 * - Timeout management
 * - Consistent error handling
 *
 * Migration:
 *   Before: import { workspaceApi } from '@/lib/workspace/client-api';
 *   After:  import { workspaceApi } from '@/lib/workspace/api';
 *
 * This file is kept for backward compatibility only.
 */

export { workspaceApi } from './api';
