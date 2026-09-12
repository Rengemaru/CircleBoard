// APIを叩く唯一の入口。fetch の薄いラッパー。
//
// credentials: "include" が必須。認証はサーバー側セッション + HttpOnly Cookie で行い、
// トークンを JS から触れる場所に置かないため(CLAUDE.md §4)。
// **本番は空文字にして相対パスで出す。** フロントとAPIは同じオリジンで、
// /api/* は Caddy が backend へ渡す(spec-v2.2.md §7.3)。backend の 3000 番は
// ホストに公開していないので、絶対URLを組み立てると必ず届かない。
//
// 開発だけ「いま開いている画面と同じホストの :3000」に落ちる。フロントが
// :5173、APIが :3000 と別オリジンなため。localhost を決め打ちにしないのは、
// LAN の別端末（スマホなど）から 192.168.x.x で開いたときに、その端末自身を
// 叩いて必ず失敗するため。
//
// import.meta.env.DEV は Vite が埋める値で、vite build では false になる。
const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV
    ? `${window.location.protocol}//${window.location.hostname}:${import.meta.env.VITE_API_PORT || "3000"}`
    : "");

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
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch {
    // サーバーが落ちている / ネットワークが切れている場合、fetch は
    // TypeError("Failed to fetch") を投げる。そのまま画面に出しても
    // 利用者には何のことか分からないので、読める文言に置き換える。
    // status は HTTP の応答が無かったことを表す 0 にする
    throw new ApiError(0, "サーバーに接続できませんでした。時間をおいて試してください");
  }

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
