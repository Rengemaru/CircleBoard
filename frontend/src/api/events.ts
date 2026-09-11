import { apiFetch } from "./client";
import type { EventSummary } from "../types/event";

type Options = {
  // トップページの「注目イベント」枠だけがスコア順を使う。
  // 一覧(/events)は既定の日付順
  sort?: "spotlight";
  // 複数指定は OR。空配列は「絞り込まない」
  tagIds?: number[];
  // 企画名の部分一致。空文字は「絞り込まない」
  q?: string;
};

export async function fetchEvents(options: Options = {}): Promise<EventSummary[]> {
  const query = new URLSearchParams();
  if (options.sort !== undefined) query.set("sort", options.sort);
  if (options.tagIds !== undefined && options.tagIds.length > 0) {
    query.set("tag_ids", options.tagIds.join(","));
  }

  if (options.q !== undefined && options.q.trim() !== "") query.set("q", options.q.trim());

  const suffix = query.toString() === "" ? "" : `?${query.toString()}`;
  const data = await apiFetch<{ events: EventSummary[] }>(`/api/events${suffix}`);
  return data.events;
}
