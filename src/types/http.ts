export interface ApiRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string };
}

export interface ApiResponse {
  setHeader(name: string, value: string | number | readonly string[]): ApiResponse;
  status(code: number): ApiResponse;
  json(body: unknown): ApiResponse;
}
