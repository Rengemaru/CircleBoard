import { apiFetch } from "./client";
import type { SignageData } from "../types/signage";

export async function fetchSignage(token: string): Promise<SignageData> {
  return apiFetch<SignageData>(`/api/signage?token=${encodeURIComponent(token)}`);
}
