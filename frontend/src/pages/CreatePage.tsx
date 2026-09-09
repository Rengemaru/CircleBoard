import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LoginRequired } from "../components/LoginRequired";
import { MemberPage } from "../components/MemberPage";
import { Button } from "../components/ui/Button";
import { FilterChip } from "../components/ui/Chip";
import { Field, INPUT_CLASS } from "../components/ui/Field";
import { Note } from "../components/ui/Note";
import { PageHeading } from "../components/ui/PageHeading";
import { Panel } from "../components/ui/Panel";
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

// URL の ?kind= から種類を決める。想定外の値と未指定はイベントに倒す。
// 種類は作成後に変えられないので、黙って別のものを作らないよう既定を1つに固定する
function parseKind(value: string | null): Kind {
  return value === "project" ? "project" : "event";
}

// 概要の書き出しに迷わないための雛形。value ではなく placeholder に入れる
const EVENT_TEMPLATE = `【このイベントについて】

【参加対象】

【当日の流れ】

【持ち物・事前準備】`;

const PROJECT_TEMPLATE = `【このプロジェクトについて】

【作るもの・目指す成果物】

【使う技術】

【求めるメンバー】`;

export function CreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading } = useCurrentUser();
  // どちらを作りに来たかは呼び出し元のボタンが決める。一覧の「プロジェクトを
  // 作成」から来た人にイベントのフォームを出さない(Issue #38)
  const [kind, setKind] = useState<Kind>(() => parseKind(searchParams.get("kind")));
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [capacity, setCapacity] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
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
              // 空欄は null。空文字を送ると「空文字のリンク」が保存される
              external_url: externalUrl === "" ? null : externalUrl,
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
    return (
      <MemberPage user={null}>
        <p className="text-[13px] text-gray-500">読み込み中…</p>
      </MemberPage>
    );
  }

  // 作成ボタンは未ログインでも見せてよいが、押下時は /login へ。
  // ボタンを隠すと、外部から見たときにサークルの活動量が伝わらない
  // (wireframe-member.html ②の注記)。API側は必ず401を返す
  if (user === null) {
    return (
      <MemberPage user={null}>
        <LoginRequired>企画の作成にはログインが必要です。</LoginRequired>
      </MemberPage>
    );
  }

  return (
    <MemberPage user={user}>
      <PageHeading
        title="企画を作成"
        subtitle="作ったあとで編集はできません。内容を確認してから作成してください"
      />

      {/* 必須の欄は required でブラウザ側でも止める。送っても 422 が返るだけで、
          往復する意味がないため(ログインフォームと同じ扱い)。
          検証そのものはサーバー側のモデルが持つ(spec-v2.2.md §2.2/§2.3) */}
      <form onSubmit={submit}>
        {error !== null && <Note tone="danger">{error}</Note>}

        <Panel title="種類">
          <div className="flex flex-wrap gap-4 text-[13px]">
            <label className="flex items-center gap-2">
              <input type="radio" checked={kind === "event"} onChange={() => setKind("event")} />
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
        </Panel>

        <Panel title="内容">
          <Field label="タイトル" required>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={INPUT_CLASS}
            />
          </Field>

          {/* テンプレートは placeholder として表示する。初期値として入れると、
              消さずにそのまま送信されてしまう(wireframe-member.html ⑥の注記) */}
          <Field label="概要" required hint="枠の中の見出しは目安です。書きやすい形で構いません">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={10}
              placeholder={kind === "event" ? EVENT_TEMPLATE : PROJECT_TEMPLATE}
              required
              className={INPUT_CLASS}
            />
          </Field>

          {kind === "event" ? (
            <>
              <Field label="開催場所" required>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="部室A / オンライン（Zoom）"
                  required
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="開催日時" required>
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                  className={INPUT_CLASS}
                />
              </Field>
            </>
          ) : (
            <Field label="MTGの予定（任意）">
              <input
                value={meetingSchedule}
                onChange={(e) => setMeetingSchedule(e.target.value)}
                placeholder="毎週水曜 19:00〜"
                className={INPUT_CLASS}
              />
            </Field>
          )}

          <Field label="定員（空欄なら無制限）">
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>

          {/* 外部リンクはイベントのみ。projects テーブルに列を作っていない
              (docs/er.md)。connpass や Google フォームへの導線に使う */}
          {kind === "event" && (
            <Field label="外部リンク（任意）">
              <input
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
                placeholder="https://connpass.com/event/xxxxx"
                className={INPUT_CLASS}
              />
            </Field>
          )}
        </Panel>

        {/* タグは既存のものから選ぶ。作成APIは無い(docs/api-spec.md §4) */}
        <Panel title="タグ">
          {tags.length === 0 ? (
            <p className="text-[13px] text-gray-500">選べるタグがありません。</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <FilterChip
                  key={tag.id}
                  active={selectedTagIds.includes(tag.id)}
                  onClick={() => toggleTag(tag.id)}
                >
                  {tag.name}
                </FilterChip>
              ))}
            </div>
          )}
        </Panel>

        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={busy}>
            作成する
          </Button>
          {/* 直前の画面に戻る。/ に固定で飛ばすと、一覧から来た人が
              一覧に戻れない */}
          <Button variant="ghost" onClick={() => navigate(-1)}>
            キャンセル
          </Button>
        </div>
      </form>
    </MemberPage>
  );
}
