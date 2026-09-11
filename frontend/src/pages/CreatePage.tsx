import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LoginRequired } from "../components/LoginRequired";
import { SessionUnavailable } from "../components/SessionUnavailable";
import { MemberPage } from "../components/MemberPage";
import { Button } from "../components/ui/Button";
import { FormControl, Input, Stack, StatusLabel, Text, Textarea } from "smarthr-ui";
import { Note } from "../components/ui/Note";
import { PageHeading } from "../components/ui/PageHeading";
import { Panel } from "../components/ui/Panel";
import { TagPicker } from "../components/TagPicker";
import { MAX_TAGS_PER_RESOURCE } from "../lib/tags";
import { apiFetch } from "../api/client";
import { fetchTags } from "../api/tags";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { flashState } from "../lib/flash";
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

// 必須と任意はステータスラベルで示す。ラベルの文字に「（任意）」と
// 混ぜると、必須の印だけ別の形になって2通りの書き方が並ぶ
// どの分岐でも同じ画面名を出す。通さないと document.title が書き換わらず、
// SPA では前に開いていた画面のタブ名が残る(PR #135、Issue #185)
const TITLE = "企画を作成";

const REQUIRED = <StatusLabel type="red">必須</StatusLabel>;
const OPTIONAL = <StatusLabel type="grey">任意</StatusLabel>;

export function CreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const session = useCurrentUser();
  const { user, loading, failed } = session;
  // どちらを作りに来たかは呼び出し元のボタンが決める。一覧の「プロジェクトを
  // 作成」から来た人にイベントのフォームを出さない(Issue #38)
  const [kind, setKind] = useState<Kind>(() => parseKind(searchParams.get("kind")));
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
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // 失敗を空配列に倒すと「選べるタグがありません。」と断定してしまう。
    // 実際は通信できていないだけかもしれない(Issue #52)
    fetchTags()
      .then(setTags)
      .catch(() => setTagsError(true));
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
              tag_names: selectedTagNames,
            },
          }),
        });
        // 画面が変わるだけでは「作られた」と言い切れない。
        // 他の操作はすべて文言で伝えている(Issue #191)
        navigate(`/events/${created.id}`, { state: flashState("イベントを作成しました。") });
      } else {
        const created = await apiFetch<{ id: number }>("/api/projects", {
          method: "POST",
          body: JSON.stringify({
            project: {
              title,
              description,
              meeting_schedule: meetingSchedule,
              capacity: capacity === "" ? null : Number(capacity),
              tag_names: selectedTagNames,
            },
          }),
        });
        navigate(`/projects/${created.id}`, {
          state: flashState("プロジェクトを作成しました。"),
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "作成に失敗しました");
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
        title={TITLE}
        subtitle="作ったあとで編集はできません。内容を確認してから作成してください"
      />

      {/* 必須の欄は required でブラウザ側でも止める。送っても 422 が返るだけで、
          往復する意味がないため(ログインフォームと同じ扱い)。
          検証そのものはサーバー側のモデルが持つ(spec-v2.2.md §2.2/§2.3) */}
      <form onSubmit={submit}>
        {error !== null && <Note tone="danger">{error}</Note>}

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

        <Panel title="内容">
          {/* 項目の間隔は Stack で決める。FormControl は自分では下余白を持たない */}
          <Stack gap={1.25}>
            <FormControl label="タイトル" statusLabels={REQUIRED}>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                width="100%"
              />
            </FormControl>

            {/* テンプレートは placeholder として表示する。初期値として入れると、
              消さずにそのまま送信されてしまう(wireframe-member.html ⑥の注記) */}
            <FormControl
              label="概要"
              statusLabels={REQUIRED}
              helpMessage="枠の中の見出しは目安です。書きやすい形で構いません"
            >
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={10}
                placeholder={kind === "event" ? EVENT_TEMPLATE : PROJECT_TEMPLATE}
                required
                width="100%"
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
          <Button type="submit" variant="primary" busy={busy} busyLabel="作成中…">
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
