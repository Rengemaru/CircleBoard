import { apiFetch } from "./client";
import type { Tag } from "../types/event";

export async function fetchTags(): Promise<Tag[]> {
  const data = await apiFetch<{ tags: Tag[] }>("/api/tags");
  return data.tags;
}
