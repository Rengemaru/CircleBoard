import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { LoginRequired } from "../components/LoginRequired";
import { SessionUnavailable } from "../components/SessionUnavailable";
import { MemberPage } from "../components/MemberPage";
import { Button } from "../components/ui/Button";
import { FormControl, Input, Stack, StatusLabel, Text } from "smarthr-ui";
import { Note } from "../components/ui/Note";
import { PageHeading } from "../components/ui/PageHeading";
import { Panel } from "../components/ui/Panel";
import { MarkdownField } from "../components/MarkdownField";
import { TagPicker } from "../components/TagPicker";
import { MAX_TAGS_PER_RESOURCE } from "../lib/tags";
import { apiFetch } from "../api/client";
import { fetchTags } from "../api/tags";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { flashState } from "../lib/flash";
import { Select } from "smarthr-ui";
import type { EventDetail, Tag } from "../types/event";
import type { ProjectSummary } from "../types/project";

// 企画作成(wireframes/wireframe-member.html ⑥)。要ログイン。
//
// イベントとプロジェクトは別のリソースなので、最初にどちらを作るか選ばせる。
// 用語の区別は CLAUDE.md §9 のとおり:
//   イベント   … 単発。楽しむ・学ぶ。未ログインでも閲覧可能
//   プロジェクト … 継続的にコミットして成果物を作る。ログイン必須
type Kind = "event" | "project";

type ProjectStatus = "recruiting" | "in_progress" | "completed";

const STATUS_LABEL: Record<ProjectStatus, string> = {
  recruiting: "募集中",
  in_progress: "進行中",
  completed: "完了",
};

// URL の ?kind= から種類を決める。想定外の値と未指定はイベントに倒す。
// 種類は作成後に変えられないので、黙って別のものを作らないよう既定を1つに固定する
function parseKind(value: string | null): Kind {
  return value === "project" ? "project" : "event";
}

// ISO の日時を datetime-local の形(YYYY-MM-DDTHH:mm)に直す。
//
// 手元の時刻で出す。toISOString() を切ると UTC になり、編集画面を開いただけで
// 開催日時が9時間ずれる
function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

// 概要の書き出しに迷わないための雛形。value ではなく placeholder に入れる。
// 【】ではなく `# ` で書く。見出しにすると詳細画面で節ごとの
// パネルに分かれる(Issue #303)。【】のままだとただの文字列で終わる
const EVENT_TEMPLATE = `# このイベントについて

# 参加対象

# 当日の流れ

# 持ち物・事前準備`;

const PROJECT_TEMPLATE = `# このプロジェクトについて

# 作るもの・目指す成果物

# 使う技術

# 求めるメンバー`;

// 必須と任意はステータスラベルで示す。ラベルの文字に「（任意）」と
// 混ぜると、必須の印だけ別の形になって2通りの書き方が並ぶ
// どの分岐でも同じ画面名を出す。通さないと document.title が書き換わらず、
// SPA では前に開いていた画面のタブ名が残る(PR #135、Issue #185)
const TITLE = "企画を作成";
const EDIT_TITLE = "企画を編集";

const REQUIRED = <StatusLabel type="red">必須</StatusLabel>;

// 文字数の上限。サーバー側の検証と同じ値にする
// (backend の Event::MAX_TITLE_LENGTH ほか。2026-09-12 の監査)。
//
// 打ち込めなくするのは1行の欄だけにしている。概要は貼り付けて書く欄で、
// 上限で切ると末尾が黙って消えるため、残り字数を見せるだけにする
// (マイページの自己紹介と同じ扱い)
const TITLE_MAX = 100;
const DESCRIPTION_MAX = 3000;
const LOCATION_MAX = 100;
const SCHEDULE_MAX = 100;
const EXTERNAL_URL_MAX = 2000;

// 定員の範囲。サーバー側の検証と同じ値(backend の Event::MAX_CAPACITY)。
// 空欄は無制限なので、min を付けても未入力は通る
const CAPACITY_MIN = 1;
const CAPACITY_MAX = 1000;
const OPTIONAL = <StatusLabel type="grey">任意</StatusLabel>;

export function CreatePage() {
  return <PostFormPage />;
}

// 編集は作成とまったく同じ項目を扱うので、フォームを共有する。
// 別の画面にすると、項目を足したときに片方だけ直る(docs/spec-admin-operations.md §3.2)。
//
// 種類は URL が決める。作成では ?kind= で選べるが、**編集では変えられない**。
// イベントとプロジェクトは別のテーブルで、作り直さないと移せない
export function EventEditPage() {
  return <PostFormPage editingKind="event" />;
}

export function ProjectEditPage() {
  return <PostFormPage editingKind="project" />;
}

function PostFormPage({ editingKind }: { editingKind?: Kind }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id } = useParams();
  const editing = editingKind !== undefined;
  const session = useCurrentUser();
  const { user, loading, failed } = session;
  // どちらを作りに来たかは呼び出し元のボタンが決める。一覧の「プロジェクトを
  // 作成」から来た人にイベントのフォームを出さない(Issue #38)
  const [kind, setKind] = useState<Kind>(() => editingKind ?? parseKind(searchParams.get("kind")));
  const [tags, setTags] = useState<Tag[]>([]);
  const [tagsError, setTagsError] = useState(false);
  // 選んだタグは名前で持つ。まだ存在しないタグはIDを持てないため(docs/spec-tags.md §3.7)
  const [selectedTagNames, setSelectedTagNames] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [capacity, setCapacity] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [meetingSchedule, setMeetingSchedule] = useState("");
  // プロジェクトの進行状況。募集中 → 進行中 → 完了 の遷移は編集にしか手段が無い
  // (docs/api-spec.md §3)。イベントの status は API が受け取らないので出さない
  const [status, setStatus] = useState<ProjectStatus>("recruiting");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 読み込みが終わるまでフォームを出さない。空欄を出すと、書き換えたつもりの
  // 人がそのまま保存して中身を消してしまう
  const [loadingPost, setLoadingPost] = useState(editing);

  useEffect(() => {
    // 失敗を空配列に倒すと「選べるタグがありません。」と断定してしまう。
    // 実際は通信できていないだけかもしれない(Issue #52)
    fetchTags()
      .then(setTags)
      .catch(() => setTagsError(true));
  }, []);

  useEffect(() => {
    if (!editing || user === null) return;

    let cancelled = false;
    const path = editingKind === "event" ? `/api/events/${id}` : `/api/projects/${id}`;

    apiFetch<EventDetail & ProjectSummary>(path)
      .then((post) => {
        if (cancelled) return;
        setTitle(post.title);
        setDescription(post.description);
        setCapacity(post.capacity === null ? "" : String(post.capacity));
        setSelectedTagNames(post.tags.map((tag: Tag) => tag.name));
        if (editingKind === "event") {
          setLocation(post.location);
          setStartsAt(toDateTimeLocal(post.starts_at));
          setExternalUrl(post.external_url ?? "");
        } else {
          setMeetingSchedule(post.meeting_schedule ?? "");
          setStatus(post.status as ProjectStatus);
        }
        setLoadingPost(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "読み込みに失敗しました");
        setLoadingPost(false);
      });

    return () => {
      cancelled = true;
    };
  }, [editing, editingKind, id, user]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (kind === "event") {
        const created = await apiFetch<{ id: number }>(
          editing ? `/api/events/${id}` : "/api/events",
          {
            method: editing ? "PUT" : "POST",
            body: JSON.stringify({
              event: {
                title,
                description,
                location,
                starts_at: startsAt,
                capacity: capacity === "" ? null : Number(capacity),
                // 空欄は null。空文字を送ると「空文字のリンク」が保存される
                external_url: externalUrl === "" ? null : externalUrl,
                tag_names: selectedTagNames,
              },
            }),
          },
        );
        // 画面が変わるだけでは「作られた」と言い切れない。
        // 他の操作はすべて文言で伝えている(Issue #191)
        navigate(`/events/${created.id}`, {
          state: flashState(editing ? "イベントを編集しました。" : "イベントを作成しました。"),
        });
      } else {
        const created = await apiFetch<{ id: number }>(
          editing ? `/api/projects/${id}` : "/api/projects",
          {
            method: editing ? "PUT" : "POST",
            body: JSON.stringify({
              project: {
                title,
                description,
                meeting_schedule: meetingSchedule,
                capacity: capacity === "" ? null : Number(capacity),
                tag_names: selectedTagNames,
                // 作成では受け取らない。作った直後は必ず募集中
                ...(editing ? { status } : {}),
              },
            }),
          },
        );
        navigate(`/projects/${created.id}`, {
          state: flashState(
            editing ? "プロジェクトを編集しました。" : "プロジェクトを作成しました。",
          ),
        });
      }
    } catch (e: unknown) {
      setError(
        e instanceof Error ? e.message : editing ? "保存に失敗しました" : "作成に失敗しました",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <MemberPage session={session} size="NARROW">
        <PageHeading title={TITLE} />
        <Text size="S" color="TEXT_GREY">
          読み込み中…
        </Text>
      </MemberPage>
    );
  }

  // 作成ボタンは未ログインでも見せてよいが、押下時は /login へ。
  // ボタンを隠すと、外部から見たときにサークルの活動量が伝わらない
  // (wireframe-member.html ②の注記)。API側は必ず401を返す
  // ログイン状態を確かめられなかったときは、未ログインの案内を出さない(Issue #72)
  if (failed) {
    return (
      <MemberPage session={session} size="NARROW">
        <PageHeading title={TITLE} />
        <SessionUnavailable />
      </MemberPage>
    );
  }

  if (user === null) {
    return (
      <MemberPage session={session} size="NARROW">
        <PageHeading title={TITLE} />
        <LoginRequired>企画の作成にはログインが必要です。</LoginRequired>
      </MemberPage>
    );
  }

  // フォーム1枚の画面なので NARROW。DEFAULT だと1行のタイトル欄が
  // 1000px を超えて読みにくくなる(docs/spec-layout-unification.md §5)
  return (
    <MemberPage session={session} size="NARROW">
      <PageHeading
        title={editing ? EDIT_TITLE : TITLE}
        subtitle={
          editing
            ? "参加者にはすぐ反映されます。日時や場所を変えたときは本人たちにも伝えてください"
            : "内容はあとから編集できます"
        }
      />

      {loadingPost && (
        <Text size="S" color="TEXT_GREY">
          読み込み中…
        </Text>
      )}

      {/* 必須の欄は required でブラウザ側でも止める。送っても 422 が返るだけで、
          往復する意味がないため(ログインフォームと同じ扱い)。
          検証そのものはサーバー側のモデルが持つ(spec-v2.2.md §2.2/§2.3) */}
      <form onSubmit={submit}>
        {error !== null && <Note tone="danger">{error}</Note>}

        {!editing && (
          <Panel title="種類">
            {/* name が無いと2つが別々のラジオになり、矢印キーで切り替えられず、
              「2つのうち1つを選ぶ」と支援技術に伝わらない。
              fieldset と legend で1つの選択肢の集まりだと示す。
              legend は Panel の見出しと文言が重なるので視覚的には隠す(Issue #55) */}
            <fieldset className="flex flex-wrap gap-4 text-[13px]">
              <legend className="sr-only">種類</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="kind"
                  checked={kind === "event"}
                  onChange={() => setKind("event")}
                />
                イベント（単発。未ログインでも閲覧できます）
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="kind"
                  checked={kind === "project"}
                  onChange={() => setKind("project")}
                />
                プロジェクト（継続。ログイン必須）
              </label>
            </fieldset>
          </Panel>
        )}

        <Panel title="内容">
          {/* 項目の間隔は Stack で決める。FormControl は自分では下余白を持たない */}
          <Stack gap={1.25}>
            <FormControl label="タイトル" statusLabels={REQUIRED}>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={TITLE_MAX}
                required
                width="100%"
              />
            </FormControl>

            {/* テンプレートは placeholder として表示する。初期値として入れると、
              消さずにそのまま送信されてしまう(wireframe-member.html ⑥の注記) */}
            <FormControl
              label="概要"
              statusLabels={REQUIRED}
              helpMessage="Markdown で書けます。`# 見出し` で節に分かれ、箇条書き・太字・リンク・表・コードが使えます"
            >
              <MarkdownField
                value={description}
                onChange={setDescription}
                rows={10}
                maxLetters={DESCRIPTION_MAX}
                placeholder={kind === "event" ? EVENT_TEMPLATE : PROJECT_TEMPLATE}
                required
              />
            </FormControl>

            {kind === "event" ? (
              <>
                <FormControl
                  label="開催場所"
                  statusLabels={REQUIRED}
                  exampleMessage="部室A / オンライン（Zoom）"
                >
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    maxLength={LOCATION_MAX}
                    required
                    width="100%"
                  />
                </FormControl>
                <FormControl label="開催日時" statusLabels={REQUIRED}>
                  <Input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    required
                    width="100%"
                  />
                </FormControl>
              </>
            ) : (
              <FormControl
                label="MTGの予定"
                statusLabels={OPTIONAL}
                exampleMessage="毎週水曜 19:00〜"
              >
                <Input
                  value={meetingSchedule}
                  onChange={(e) => setMeetingSchedule(e.target.value)}
                  maxLength={SCHEDULE_MAX}
                  width="100%"
                />
              </FormControl>
            )}

            {/* 進行状況は編集でだけ出す。作った直後は必ず募集中で、
              募集中 → 進行中 → 完了 の遷移は編集にしか手段が無い
              (docs/api-spec.md §3)。イベントの status は API が受け取らない */}
            {editing && kind === "project" && (
              <FormControl label="進行状況">
                <Select
                  value={status}
                  options={(Object.keys(STATUS_LABEL) as ProjectStatus[]).map((key) => ({
                    label: STATUS_LABEL[key],
                    value: key,
                  }))}
                  onChangeValue={(value) => setStatus(value)}
                  width="100%"
                />
              </FormControl>
            )}

            {/* 任意であることはラベルの文字ではなくステータスラベルで示す。
              空欄にしたときの挙動は helpMessage に分ける。
              ラベルに混ぜると2通りの書き方になる(Issue #58) */}
            <FormControl
              label="定員"
              statusLabels={OPTIONAL}
              helpMessage="空欄にすると無制限になります"
            >
              <Input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                min={CAPACITY_MIN}
                max={CAPACITY_MAX}
                width="100%"
              />
            </FormControl>

            {/* 外部リンクはイベントのみ。projects テーブルに列を作っていない
              (docs/er.md)。connpass や Google フォームへの導線に使う */}
            {kind === "event" && (
              <FormControl
                label="外部リンク"
                statusLabels={OPTIONAL}
                exampleMessage="https://connpass.com/event/xxxxx"
              >
                <Input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  maxLength={EXTERNAL_URL_MAX}
                  width="100%"
                />
              </FormControl>
            )}
          </Stack>
        </Panel>

        {/* 候補から選ぶことも、無い名前を打って足すこともできる
            (docs/spec-tags.md §3.5) */}
        <Panel title="タグ">
          <FormControl
            label="タグ"
            helpMessage={`${MAX_TAGS_PER_RESOURCE}件まで。一覧に無いものは打って足せます。`}
          >
            <TagPicker
              candidates={tags}
              selected={selectedTagNames}
              onChange={setSelectedTagNames}
              max={MAX_TAGS_PER_RESOURCE}
              loadFailed={tagsError}
            />
          </FormControl>
        </Panel>

        <div className="flex gap-2">
          <Button
            type="submit"
            variant="primary"
            busy={busy}
            busyLabel={editing ? "保存中…" : "作成中…"}
            // 読み込みが終わる前に押させない。空欄のまま上書きされる
            disabled={loadingPost}
          >
            {editing ? "保存する" : "作成する"}
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
