import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { apiFetch } from "../api/client";
import { fetchTags } from "../api/tags";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { Tag } from "../types/event";

// 企画作成(wireframes/wireframe-member.html ⑥)。要ログイン。
//
// イベントとプロジェクトは別のリソースなので、最初にどちらを作るか選ばせる。
// 用語の区別は CLAUDE.md §9 のとおり:
//   イベント   … 単発。楽しむ・学ぶ。未ログインでも閲覧可能
//   プロジェクト … 継続的にコミットして成果物を作る。ログイン必須
type Kind = "event" | "project";

export function CreatePage() {
  const navigate = useNavigate();
  const { user, loading } = useCurrentUser();
  const [kind, setKind] = useState<Kind>("event");
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [capacity, setCapacity] = useState("");
  const [meetingSchedule, setMeetingSchedule] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchTags()
      .then(setTags)
      .catch(() => setTags([]));
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (kind === "event") {
        const created = await apiFetch<{ id: number }>("/api/events", {
          method: "POST",
          body: JSON.stringify({
            event: {
              title,
              description,
              location,
              starts_at: startsAt,
              capacity: capacity === "" ? null : Number(capacity),
              tag_ids: selectedTagIds,
            },
          }),
        });
        navigate(`/events/${created.id}`);
      } else {
        const created = await apiFetch<{ id: number }>("/api/projects", {
          method: "POST",
          body: JSON.stringify({
            project: {
              title,
              description,
              meeting_schedule: meetingSchedule,
              capacity: capacity === "" ? null : Number(capacity),
              tag_ids: selectedTagIds,
            },
          }),
        });
        navigate(`/projects/${created.id}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "作成に失敗しました");
    } finally {
      setBusy(false);
    }
  }

  function toggleTag(id: number) {
    setSelectedTagIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  if (loading) {
    return <Frame user={null}>読み込み中…</Frame>;
  }

  // 作成ボタンは未ログインでも見せてよいが、押下時は /login へ。
  // ボタンを隠すと、外部から見たときにサークルの活動量が伝わらない
  // (wireframe-member.html ②の注記)。API側は必ず401を返す
  if (user === null) {
    return (
      <Frame user={null}>
        <p className="rounded border border-gray-200 bg-gray-50 p-4">
          企画の作成にはログインが必要です。
          <Link to="/login" className="ml-2 underline">
            ログイン
          </Link>
        </p>
      </Frame>
    );
  }

  return (
    <Frame user={user}>
      <h1 className="mb-6 text-2xl font-bold">企画を作成</h1>

      <form onSubmit={submit} className="max-w-xl space-y-4">
        {error !== null && (
          <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <fieldset>
          <legend className="mb-2 text-sm text-gray-700">種類</legend>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={kind === "event"}
                onChange={() => setKind("event")}
              />
              イベント（単発。未ログインでも閲覧できます）
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={kind === "project"}
                onChange={() => setKind("project")}
              />
              プロジェクト（継続。ログイン必須）
            </label>
          </div>
        </fieldset>

        <Field label="タイトル">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </Field>

        <Field label="概要">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </Field>

        {kind === "event" ? (
          <>
            <Field label="開催場所">
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </Field>
            <Field label="開催日時">
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </Field>
          </>
        ) : (
          <Field label="MTGの予定（任意）">
            <input
              value={meetingSchedule}
              onChange={(e) => setMeetingSchedule(e.target.value)}
              placeholder="毎週水曜 19:00〜"
              className="w-full rounded border border-gray-300 px-3 py-2"
            />
          </Field>
        )}

        <Field label="定員（空欄なら無制限）">
          <input
            type="number"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2"
          />
        </Field>

        {/* タグは既存のものから選ぶ。作成APIは無い(docs/api-spec.md §4) */}
        <fieldset>
          <legend className="mb-2 text-sm text-gray-700">タグ</legend>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => toggleTag(tag.id)}
                className={`rounded border px-3 py-1 text-sm ${
                  selectedTagIds.includes(tag.id)
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300"
                }`}
              >
                {tag.name}
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={busy}
          className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-40"
        >
          作成する
        </button>
      </form>
    </Frame>
  );
}

function Frame({
  user,
  children,
}: {
  user: Parameters<typeof SiteHeader>[0]["user"];
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl p-6">{children}</main>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-gray-700">{label}</span>
      {children}
    </label>
  );
}
