import { apiFetch } from "./client";

// docs/api-spec.md §6。すべて admin のみ。
// 未ログインは 401、admin 以外のログインユーザーは 403 が返る。
// フロントでメニューを隠すのは表示の話であって制限ではないので、
// ここで隠しても API 側の検証がある前提で書く。

export type SignageTokenRow = {
  id: number;
  name: string;
  token: string;
  url: string;
  revoked_at: string | null;
  created_at: string;
};

// ピン留め設定画面専用。spotlight_score は公開APIに載せていない
// (wireframes/wireframe-admin.html A2「一般ユーザーには見せない」)
export type AdminEventRow = {
  id: number;
  title: string;
  starts_at: string;
  location: string;
  participants_count: number;
  spotlight_score: number;
  pinned: boolean;
};

export type NewUserInput = {
  name: string;
  email: string;
  password: string;
  enrollment_year: number;
  graduation_year: number;
  role: "admin" | "member";
};

export async function fetchAdminEvents(): Promise<AdminEventRow[]> {
  const data = await apiFetch<{ events: AdminEventRow[] }>("/api/admin/events");
  return data.events;
}

export async function fetchSignageTokens(): Promise<SignageTokenRow[]> {
  const data = await apiFetch<{ signage_tokens: SignageTokenRow[] }>("/api/admin/signage_tokens");
  return data.signage_tokens;
}

export async function createSignageToken(name: string): Promise<SignageTokenRow> {
  return apiFetch<SignageTokenRow>("/api/admin/signage_tokens", {
    method: "POST",
    body: JSON.stringify({ signage_token: { name } }),
  });
}

export async function revokeSignageToken(id: number): Promise<void> {
  await apiFetch<void>(`/api/admin/signage_tokens/${id}`, { method: "DELETE" });
}

export async function createUser(input: NewUserInput): Promise<{ id: number; name: string }> {
  const data = await apiFetch<{ user: { id: number; name: string } }>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify({ user: input }),
  });
  return data.user;
}

export async function pinEvent(eventId: number): Promise<void> {
  await apiFetch<unknown>(`/api/admin/events/${eventId}/pin`, { method: "PUT" });
}

export async function unpinEvent(eventId: number): Promise<void> {
  await apiFetch<void>(`/api/admin/events/${eventId}/pin`, { method: "DELETE" });
}
