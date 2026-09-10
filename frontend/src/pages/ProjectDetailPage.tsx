import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DefinitionList, DefinitionListItem, Text, TextLink } from "smarthr-ui";
import { LoginRequired } from "../components/LoginRequired";
import { SessionUnavailable } from "../components/SessionUnavailable";
import { MemberPage } from "../components/MemberPage";
import { UserLink } from "../components/UserLink";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Chip } from "../components/ui/Chip";
import { Modal } from "../components/ui/Modal";
import { Note } from "../components/ui/Note";
import { PageHeading } from "../components/ui/PageHeading";
import { Panel } from "../components/ui/Panel";
import { apiFetch } from "../api/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { ProjectSummary } from "../types/project";

// プロジェクト詳細(wireframes/wireframe-member.html ⑤)。要ログイン。
//
// 脱退APIは作らない(MVP対象外。rails console で対応。docs/api-spec.md §3)ので、
// 参加後に取り消すボタンも置かない。
// プロジェクト名が分かるまでの画面名。どの分岐でも PageHeading を通さないと
// document.title が書き換わらず、SPA では前の画面のタブ名が残る
// (PR #135、Issue #185)
const FALLBACK_TITLE = "プロジェクト";

export function ProjectDetailPage() {
  const { id } = useParams();
  const session = useCurrentUser();
  const { user, loading, failed } = session;
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 参加は自分では取り消せないので、押す前に確認する(Issue #42)
  const [confirming, setConfirming] = useState(false);

  // 再読み込みに成功したらエラーを消す。消さないと、通信が直ったあとも
  // 赤い帯が残り続け、失敗したのか成功したのかが判別できない(Issue #44)
  const load = useCallback(() => {
    apiFetch<ProjectSummary>(`/api/projects/${id}`)
      .then((result) => {
        setProject(result);
        setError(null);
      })
      .catch((e: unknown) => setError(toMessage(e)));
  }, [id]);

  useEffect(() => {
    if (loading || user === null) return;
    load();
  }, [loading, user, load]);

  async function join() {
    setBusy(true);
    setError(null);
    try {
      await apiFetch<unknown>(`/api/projects/${id}/participation`, { method: "POST" });
      setConfirming(false);
      load();
    } catch (e: unknown) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <MemberPage session={session}>
        <PageHeading title={FALLBACK_TITLE} />
        <Text size="S" color="TEXT_GREY">
          読み込み中…
        </Text>
      </MemberPage>
    );
  }

  // ログイン状態を確かめられなかったときは、未ログインの案内を出さない(Issue #72)
  if (failed) {
    return (
      <MemberPage session={session}>
        <PageHeading title={FALLBACK_TITLE} />
        <SessionUnavailable />
      </MemberPage>
    );
  }

  if (user === null) {
    return (
      <MemberPage session={session}>
        <PageHeading title={FALLBACK_TITLE} />
        <LoginRequired>プロジェクトの閲覧にはログインが必要です。</LoginRequired>
      </MemberPage>
    );
  }

  if (error !== null && project === null) {
    return (
      <MemberPage session={session}>
        <PageHeading title={FALLBACK_TITLE} />
        <Note tone="danger">{error}</Note>
      </MemberPage>
    );
  }
  if (project === null) {
    return (
      <MemberPage session={session}>
        <PageHeading title={FALLBACK_TITLE} />
        <Text size="S" color="TEXT_GREY">
          読み込み中…
        </Text>
      </MemberPage>
    );
  }

  const full = project.capacity !== null && project.participants_count >= project.capacity;

  return (
    <MemberPage session={session}>
      <div className="mb-3">
        <TextLink elementAs={Link} to="/projects" size="XS">
          ← プロジェクト一覧
        </TextLink>
      </div>

      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={project.status === "recruiting" ? "recruiting" : "inprogress"}>
            {project.status === "recruiting" ? "募集中" : "進行中"}
          </Badge>
          {project.tags.map((tag) => (
            <Chip key={tag.id}>{tag.name}</Chip>
          ))}
        </div>

        {/* PageHeading を通すとタブにも企画名が出る。
            size は XL。smarthr-ui は太さではなく大きさで階層を作るので、
            既定の L だとパネル内の他の情報に埋もれる(PR #134 と同じ) */}
        <PageHeading title={project.title} className="mt-2.5" size="XL" />

        {/* 「いつ活動して・いつ集まって・あと何枠か」は参加を決めるのに
            一緒に見る情報なので横に並べる
            (SmartHR「関連性のある項目は横に並べて関連性を伝える」) */}
        <DefinitionList className="mt-4 border-t border-gray-200 pt-4">
          {project.activity_schedule !== null && (
            <DefinitionListItem term="活動日" maxColumns={3}>
              {project.activity_schedule}
            </DefinitionListItem>
          )}
          {project.meeting_schedule !== null && (
            <DefinitionListItem term="MTG" maxColumns={3}>
              {project.meeting_schedule}
            </DefinitionListItem>
          )}
          {/* 定員なしのときに「残り null枠」と出さない */}
          <DefinitionListItem term="残り枠" maxColumns={3}>
            {formatRemaining(project)}
          </DefinitionListItem>
        </DefinitionList>
      </Panel>

      <Panel title="概要">
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{project.description}</p>
      </Panel>

      <Panel
        title={`メンバー ${project.participants_count}${
          project.capacity !== null ? ` / ${project.capacity}` : ""
        }名`}
      >
        {(project.participants ?? []).length === 0 ? (
          <p className="text-[13px] text-gray-500">まだメンバーがいません。</p>
        ) : (
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {(project.participants ?? []).map((p) => (
              <li key={p.id}>
                <UserLink id={p.id} name={p.name} />
                {/* 誰が主催かを一覧の中でも分かるようにする(ワイヤーフレーム⑤)。
                    下の「主催」欄と照らし合わせずに済む。
                    リンクの中に入れない。押せる文字列は名前だけにする */}
                {p.id === project.owner?.id && (
                  <span className="ml-1 text-xs text-gray-500">（主催）</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {project.owner !== undefined && project.owner !== null && (
        <Panel title="主催">
          <p>
            <UserLink id={project.owner.id} name={project.owner.name} />
          </p>
        </Panel>
      )}

      {error !== null && <Note tone="danger">{error}</Note>}

      {project.current_user_joined === true ? (
        <Note>このプロジェクトに参加しています。脱退は部長に連絡してください。</Note>
      ) : full ? (
        <Note tone="warning">定員に達しています。</Note>
      ) : (
        // 「申請」と書いていたが、承認フローは無く押した時点で参加が確定する。
        // 実態に合わせて「参加する」にする(Issue #42)
        <Button variant="primary" onClick={() => setConfirming(true)} disabled={busy}>
          参加する
        </Button>
      )}

      {confirming && (
        <Modal
          title="このプロジェクトに参加しますか？"
          confirmLabel="参加する"
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={join}
        >
          <p>
            <strong>{project.title}</strong>に参加します。
            <br />
            <strong>参加すると、自分では取り消せません。</strong>
            やめるときは部長に連絡してください。
          </p>
        </Modal>
      )}
    </MemberPage>
  );
}

// 定員が null のときは無制限(spec-v2.2.md §2.3)。
// 満員を超えて参加できることは無いが、負の数は 0 に丸める
function formatRemaining(project: ProjectSummary): string {
  if (project.capacity === null) return "制限なし";
  return `${Math.max(0, project.capacity - project.participants_count)}名`;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "読み込みに失敗しました";
}
