// Public surface of the typed API layer. Feature code imports from here.
// No raw fetch / axios / hand-written URL strings outside src/api/.

export {
  ApiError,
  RateLimitError,
  createApiClient,
  isApiError,
  isRateLimitError,
} from "./client"
export type { ApiClient, AuthHeaderProvider, CreateApiClientOptions } from "./client"
export {
  __resetApiClientForTests,
  getApiClient,
  getAuthToken,
  setAuthToken,
  useApiClient,
} from "./useApiClient"
export type * from "./types"
