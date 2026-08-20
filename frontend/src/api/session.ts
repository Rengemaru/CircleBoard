import { apiFetch } from "./client";

// docs/api-spec.md §1。未ログインでも 401 ではなく 200 + null が返る。
// フロントの初期化で毎回叩くため、エラー扱いにしない設計になっている。
export type CurrentUser = {
  id: number;
  name: string;
  role: "admin" | "member" | "demo";
};

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const data = await apiFetch<{ user: CurrentUser | null }>("/api/session");
  return data.user;
}

export async function login(email: string, password: string): Promise<CurrentUser> {
  const data = await apiFetch<{ user: CurrentUser }>("/api/session", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  return data.user;
}

export async function logout(): Promise<void> {
  await apiFetch<void>("/api/session", { method: "DELETE" });
}
