import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { LoginRequired } from "../components/LoginRequired";
import { SessionUnavailable } from "../components/SessionUnavailable";
import { MemberPage } from "../components/MemberPage";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Chip } from "../components/ui/Chip";
import { Modal } from "../components/ui/Modal";
import { Note } from "../components/ui/Note";
import { Panel } from "../components/ui/Panel";
import { apiFetch } from "../api/client";
import { useCurrentUser } from "../hooks/useCurrentUser";
import type { ProjectSummary } from "../types/project";

// プロジェクト詳細(wireframes/wireframe-member.html ⑤)。要ログイン。
//
// 脱退APIは作らない(MVP対象外。rails console で対応。docs/api-spec.md §3)ので、
// 参加後に取り消すボタンも置かない。
export function ProjectDetailPage() {
  const { id } = useParams();
  const { user, loading, failed } = useCurrentUser();
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
      <MemberPage user={null}>
        <p className="text-[13px] text-gray-500">読み込み中…</p>
      </MemberPage>
    );
  }

  // ログイン状態を確かめられなかったときは、未ログインの案内を出さない(Issue #72)
  if (failed) {
    return (
      <MemberPage user={null} sessionFailed>
        <SessionUnavailable />
      </MemberPage>
    );
  }

  if (user === null) {
    return (
      <MemberPage user={null}>
        <LoginRequired>プロジェクトの閲覧にはログインが必要です。</LoginRequired>
      </MemberPage>
    );
  }

  if (error !== null && project === null) {
    return (
      <MemberPage user={user}>
        <Note tone="danger">{error}</Note>
      </MemberPage>
    );
  }
  if (project === null) {
    return (
      <MemberPage user={user}>
        <p className="text-[13px] text-gray-500">読み込み中…</p>
      </MemberPage>
    );
  }

  const full = project.capacity !== null && project.participants_count >= project.capacity;

  return (
    <MemberPage user={user}>
      <Link to="/projects" className="mb-3 inline-block text-xs text-gray-500 hover:text-gray-900">
        ← プロジェクト一覧
      </Link>

      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={project.status === "recruiting" ? "recruiting" : "inprogress"}>
            {project.status === "recruiting" ? "募集中" : "進行中"}
          </Badge>
          {project.tags.map((tag) => (
            <Chip key={tag.id}>{tag.name}</Chip>
          ))}
        </div>

        <h1 className="mt-2.5 text-xl font-bold">{project.title}</h1>

        <dl className="mt-4 space-y-2 border-t border-gray-200 pt-4 text-[13px]">
          {project.activity_schedule !== null && (
            <Row label="活動日" value={project.activity_schedule} />
          )}
          {project.meeting_schedule !== null && (
            <Row label="MTG" value={project.meeting_schedule} />
          )}
          {/* 残り枠(ワイヤーフレーム⑤のサイド)。定員なしのときに
              「残り null枠」と出さない */}
          <Row label="残り枠" value={formatRemaining(project)} />
        </dl>
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
          <ul className="flex flex-wrap gap-1.5">
            {(project.participants ?? []).map((p) => (
              <li key={p.id}>
                {/* 誰が主催かを一覧の中でも分かるようにする(ワイヤーフレーム⑤)。
                    下の「主催」欄と照らし合わせずに済む */}
                <Chip>
                  {p.name}
                  {p.id === project.owner?.id && (
                    <span className="ml-1 text-gray-400">（主催）</span>
                  )}
                </Chip>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {project.owner !== undefined && project.owner !== null && (
        <Panel title="主催">
          <p className="text-[13px]">{project.owner.name}</p>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-24 shrink-0 text-gray-500">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "読み込みに失敗しました";
}
