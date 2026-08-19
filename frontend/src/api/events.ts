import { apiFetch } from "./client";
import type { EventSummary } from "../types/event";

export async function fetchEvents(): Promise<EventSummary[]> {
  const data = await apiFetch<{ events: EventSummary[] }>("/api/events");
  return data.events;
}
