// Public surface of the typed API layer. Feature code imports from here.
// No raw fetch / axios / hand-written URL strings outside src/api/.

export { ApiError, createApiClient, isApiError } from "./client"
export type { ApiClient, AuthHeaderProvider, CreateApiClientOptions } from "./client"
export { useApiClient } from "./useApiClient"
export type * from "./types"
