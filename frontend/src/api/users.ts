import { apiFetch } from "./client";
import type { Profile } from "../types/user";

// プロフィール(docs/api-spec.md §4.5)。ログイン必須で、未ログインには
// 401 が返る(session と違い null は返らない)。
//
// 他人のプロフィール(GET /api/users/:id)を読む関数は M-7 で足す。
// 使う画面と一緒に入れないと、消し忘れたのか未実装なのか分からなくなる
export async function fetchMyProfile(): Promise<Profile> {
  return apiFetch<Profile>("/api/users/me");
}
