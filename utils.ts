
export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

// Enumerated error types for the entire application.
export type AppError =
  | { type: "MissingApiKey" }
  | { type: "HttpError"; status: number; statusText: string; detail: Json }
  | { type: "FetchError"; detail: string }
  | { type: "NoResponseContent" }
  | { type: "InvalidResponseJson" }
  | { type: "InvalidChatMessages"; detail: string }
  | { type: "MissingMetadata"; detail: string }
  | { type: "DownsampleError"; detail: string }
  | { type: "StitchingError"; detail: string }
  | { type: "InvalidFontName" }
  | { type: "InvalidParameters" }
  | { type: "RequestFailed" }
  | { type: "FallbackFailed" };

// A Result type that represents either a successful value or an AppError.
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: AppError };
