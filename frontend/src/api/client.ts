// APIを叩く唯一の入口。fetch の薄いラッパー。
//
// credentials: "include" が必須。認証はサーバー側セッション + HttpOnly Cookie で行い、
// トークンを JS から触れる場所に置かないため(CLAUDE.md §4)。
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export class ApiError extends Error {
  // コンストラクタの引数プロパティ記法は erasableSyntaxOnly が禁じているため使わない
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    // エラーの形は docs/api-spec.md の { error: { code, message } } に従う。
    // ただしサーバーが落ちている場合など JSON が返らないこともあるため、失敗を許容する。
    const message = await response
      .json()
      .then((body: unknown) => extractErrorMessage(body))
      .catch(() => null);
    throw new ApiError(response.status, message ?? `API request failed: ${response.status}`);
  }

  // 204 No Content はボディが無いので json() が失敗する
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function extractErrorMessage(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("error" in body)) return null;
  const error = (body as { error: unknown }).error;
  if (typeof error !== "object" || error === null || !("message" in error)) return null;
  const message = (error as { message: unknown }).message;
  return typeof message === "string" ? message : null;
}
