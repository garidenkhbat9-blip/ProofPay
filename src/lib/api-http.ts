export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function apiErrorResponse(error: unknown) {
  const known = error instanceof ApiError;
  return Response.json(
    {
      error: known
        ? error.message
        : "The request could not be completed. Please try again.",
    },
    {
      status: known ? error.status : 500,
      headers: {
        "Cache-Control": "no-store",
        ...(known && error.status === 429 ? { "Retry-After": "30" } : {}),
      },
    },
  );
}

export async function readJsonBounded(
  request: Request | Response,
  maxBytes: number,
): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxBytes)
    throw new ApiError(413, "The request is too large.");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "A JSON request is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new ApiError(413, "The request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    throw new ApiError(400, "The request must contain valid JSON.");
  }
}
