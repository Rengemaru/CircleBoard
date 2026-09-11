import { apiFetch } from "./client";
import type { Tag } from "../types/event";

// 企画用とプロフィール用で語彙を分けている(docs/spec-tags.md §3.4)。
// 省略時は企画用。一覧の絞り込みが既定で使うのはこちら
export type TagCategory = "project_event" | "profile";

export async function fetchTags(category: TagCategory = "project_event"): Promise<Tag[]> {
  const data = await apiFetch<{ tags: Tag[] }>(`/api/tags?category=${category}`);
  return data.tags;
}
