import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { DefinitionList, DefinitionListItem, Text, TextLink } from "smarthr-ui";
import { MemberPage } from "../components/MemberPage";
import { UserLink } from "../components/UserLink";
import { SessionUnavailable } from "../components/SessionUnavailable";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { LinkButton } from "../components/ui/LinkButton";
import { Chip } from "../components/ui/Chip";
import { Note } from "../components/ui/Note";
import { PageHeading } from "../components/ui/PageHeading";
import { Panel } from "../components/ui/Panel";
import { apiFetch } from "../api/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useFlash } from "../lib/flash";
import { formatCountdown } from "../lib/countdown";
import { loginPathFrom } from "../lib/redirectTo";
import type { EventDetail } from "../types/event";

// イベント詳細(wireframes/wireframe-member.html ③)。ゲスト可だが表示内容が変わる。
//
// owner と participants は**サーバーがキーごと落とす**。CSSで隠すのは不可
// (CLAUDE.md §3-2)。ここでは「キーが無い＝見せてよい情報ではない」として扱う。
// イベント名が分かるまでの画面名。どの分岐でも PageHeading を通さないと
// document.title が書き換わらず、SPA では前の画面のタブ名が残る
// (PR #135、Issue #185)
const FALLBACK_TITLE = "イベント";

export function EventDetailPage() {
  const { id } = useParams();
  const session = useCurrentUser();
  const { user, failed } = session;
  const flash = useFlash();
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 再読み込みに成功したらエラーを消す。消さないと、通信が直ったあとも
  // 赤い帯が残り続け、失敗したのか成功したのかが判別できない(Issue #44)
  const load = useCallback(() => {
    apiFetch<EventDetail>(`/api/events/${id}`)
      .then((result) => {
        setEvent(result);
        setError(null);
      })
      .catch((e: unknown) => setError(toMessage(e)));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch<unknown>(`/api/events/${id}/participation`, { method: "POST" });
      load();
    } catch (e: unknown) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch<void>(`/api/events/${id}/participation`, { method: "DELETE" });
      load();
    } catch (e: unknown) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (error !== null && event === null) {
    return (
      <MemberPage session={session}>
        <PageHeading title={FALLBACK_TITLE} />
        <Note tone="danger">{error}</Note>
      </MemberPage>
    );
  }
  if (event === null) {
    return (
      <MemberPage session={session}>
        <PageHeading title={FALLBACK_TITLE} />
        <Text size="S" color="TEXT_GREY">
          読み込み中…
        </Text>
      </MemberPage>
    );
  }

  const full = event.capacity !== null && event.participants_count >= event.capacity;

  return (
    <MemberPage session={session}>
      <div className="mb-3">
        <TextLink elementAs={Link} to="/events" size="XS">
          ← イベント一覧
        </TextLink>
      </div>

      {/* 作成直後だけ出す。画面が変わるだけでは「作られた」と言い切れない */}
      {flash !== null && <Note tone="success">{flash}</Note>}

      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={event.status === "recruiting" ? "recruiting" : "completed"}>
            {event.status === "recruiting" ? "募集中" : "終了"}
          </Badge>
          {event.pinned && <Chip>📌 ピン留め</Chip>}
          {event.tags.map((tag) => (
            <Chip key={tag.id}>{tag.name}</Chip>
          ))}
        </div>

        {/* PageHeading を通すとタブにもイベント名が出る。
            同じイベントのタブを2枚開いても見分けられる */}
        <PageHeading title={event.title} className="mt-2.5" size="XL" />
        {/* 開催の近さがこの画面で一番効く情報なので、見出しの直下に大きく置く */}
        <p className="mt-1 text-lg font-bold text-gray-700">{formatCountdown(event.starts_at)}</p>

        {/* 「いつ・どこで・あと何枠」は関連する3つなので横に並べる。
            縦に積むと、行き先を決めるのに必要な情報が縦長に散る
            (SmartHR「関連性のある項目は横に並べて関連性を伝える」) */}
        <DefinitionList className="mt-4 border-t border-gray-200 pt-4">
          <DefinitionListItem term="開催日時" maxColumns={3}>
            {formatDateTime(event.starts_at)}
          </DefinitionListItem>
          <DefinitionListItem term="開催場所" maxColumns={3}>
            {event.location}
          </DefinitionListItem>
          {/* 定員なしのときに「残り null枠」と出さない */}
          <DefinitionListItem term="残り枠" maxColumns={3}>
            {formatRemaining(event)}
          </DefinitionListItem>
        </DefinitionList>

        {/* 外部リンクは任意。connpass や申し込みフォームへ飛ばす。
            外部サイトなので新しいタブで開く */}
        {event.external_url !== null && event.external_url !== "" && (
          <p className="mt-3">
            <TextLink href={event.external_url} target="_blank" rel="noreferrer noopener" size="S">
              関連リンクを開く
            </TextLink>
          </p>
        )}
      </Panel>

      <Panel title="概要">
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{event.description}</p>
      </Panel>

      <Panel
        title={`参加者 ${event.participants_count}${
          event.capacity !== null ? ` / ${event.capacity}` : ""
        }名`}
      >
        {/* participants キーが無い＝未ログイン。サーバーが落としている */}
        {event.participants === undefined ? (
          <Note>参加者一覧はログインすると表示されます。</Note>
        ) : event.participants.length === 0 ? (
          <p className="text-[13px] text-gray-500">まだ参加者がいません。</p>
        ) : (
          // 名前からその人のプロフィールへ行けるようにする
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {event.participants.map((p) => (
              <li key={p.id}>
                <UserLink id={p.id} name={p.name} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* owner キーが無い＝未ログイン。実名がインターネットに公開されるのを避ける */}
      {event.owner !== undefined && event.owner !== null && (
        <Panel title="主催">
          <p>
            <UserLink id={event.owner.id} name={event.owner.name} />
          </p>
        </Panel>
      )}

      {error !== null && <Note tone="danger">{error}</Note>}

      <ParticipationButton
        sessionFailed={failed}
        loggedIn={user !== null}
        joined={event.current_user_joined === true}
        full={full}
        busy={busy}
        onJoin={join}
        onCancel={cancel}
      />
    </MemberPage>
  );
}

function ParticipationButton({
  sessionFailed,
  loggedIn,
  joined,
  full,
  busy,
  onJoin,
  onCancel,
}: {
  sessionFailed: boolean;
  loggedIn: boolean;
  joined: boolean;
  full: boolean;
  busy: boolean;
  onJoin: () => void;
  onCancel: () => void;
}) {
  const location = useLocation();

  // ログイン状態を確かめられていないときに「ログインして参加」を出すと、
  // 参加済みの人にまで未ログインだと言うことになる。ここは判断を保留する(Issue #72)
  if (sessionFailed) {
    return <SessionUnavailable />;
  }

  // 未ログイン時のラベルは「ログインして参加」→ /login へ(ワイヤーフレーム ③)。
  // ログイン後はこのイベントに戻す(Issue #37)
  if (!loggedIn) {
    return (
      <LinkButton to={loginPathFrom(location.pathname + location.search)} variant="primary">
        ログインして参加
      </LinkButton>
    );
  }

  if (joined) {
    return (
      <Button variant="ghost" onClick={onCancel} busy={busy} busyLabel="キャンセル中…">
        参加をキャンセル
      </Button>
    );
  }

  // 満員時はボタンを消す。ただしAPI側でも必ず定員を検証し422を返す。
  // ボタンの非表示は表示の話であって制限ではない(ワイヤーフレーム ③)
  if (full) {
    return <Note tone="warning">満員です。空きが出ると参加できるようになります。</Note>;
  }

  return (
    <Button variant="primary" onClick={onJoin} busy={busy} busyLabel="参加中…">
      参加する
    </Button>
  );
}

// 定員が null のときは無制限(spec-v2.2.md §2.2)。
// 満員を超えて参加できることは無いが、キャンセル前提の数え方にしないため
// 負の数は 0 に丸める
function formatRemaining(event: EventDetail): string {
  if (event.capacity === null) return "制限なし";
  return `${Math.max(0, event.capacity - event.participants_count)}名`;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "読み込みに失敗しました";
}
