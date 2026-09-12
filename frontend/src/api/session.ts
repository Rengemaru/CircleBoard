import { apiFetch } from "./client";

// docs/api-spec.md §1。未ログインでも 401 ではなく 200 + null が返る。
// フロントの初期化で毎回叩くため、エラー扱いにしない設計になっている。
export type CurrentUser = {
  id: number;
  name: string;
  role: "admin" | "member" | "demo";
};

// passwordChangeRequired は**自分の状態だけ**。管理者が発行したパスワードを
// 本人がまだ変えていない状態で、このとき他のAPIは全て403になる(api-spec.md §1)。
// 初期パスワードは全員に同じものが配られる前提の運用なので、変えていない人が
// 残っていると、その文字列を知っている人が全員のアカウントに入れる。
export type SessionInfo = {
  user: CurrentUser | null;
  passwordChangeRequired: boolean;
};

// APIのキーは snake_case のまま受ける(CLAUDE.md §4)。フロントの型は
// camelCase なので、境界のここだけで詰め替える
type SessionResponse = {
  user: CurrentUser | null;
  password_change_required: boolean;
};

export async function fetchCurrentUser(): Promise<SessionInfo> {
  const data = await apiFetch<SessionResponse>("/api/session");
  return { user: data.user, passwordChangeRequired: data.password_change_required };
}

export async function login(email: string, password: string): Promise<SessionInfo> {
  const data = await apiFetch<SessionResponse>("/api/session", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return { user: data.user, passwordChangeRequired: data.password_change_required };
}

export async function logout(): Promise<void> {
  await apiFetch<void>("/api/session", { method: "DELETE" });
}
