import { apiFetch } from "./client";
import type { EventSummary } from "../types/event";

type Options = {
  // トップページの「注目イベント」枠だけがスコア順を使う。
  // 一覧(/events)は既定の日付順
  sort?: "spotlight";
  tagId?: number;
};

export async function fetchEvents(options: Options = {}): Promise<EventSummary[]> {
  const query = new URLSearchParams();
  if (options.sort !== undefined) query.set("sort", options.sort);
  if (options.tagId !== undefined) query.set("tag_id", String(options.tagId));

  const suffix = query.toString() === "" ? "" : `?${query.toString()}`;
  const data = await apiFetch<{ events: EventSummary[] }>(`/api/events${suffix}`);
  return data.events;
}
