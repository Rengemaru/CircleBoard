import { useCallback, useEffect, useState } from "react";
import { TagChip } from "../components/TagChip";
import { Link, useParams } from "react-router-dom";
import { DefinitionList, DefinitionListItem, Text, TextLink } from "smarthr-ui";
import { LoginRequired } from "../components/LoginRequired";
import { SessionUnavailable } from "../components/SessionUnavailable";
import { MemberPage } from "../components/MemberPage";
import { UserCard } from "../components/UserCard";
import { Badge } from "../components/ui/Badge";
import { PROJECT_STATUS } from "../lib/projectStatus";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Note } from "../components/ui/Note";
import { PageHeading } from "../components/ui/PageHeading";
import { Panel } from "../components/ui/Panel";
import { apiFetch } from "../api/client";
import { LinkButton } from "../components/ui/LinkButton";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useFlash } from "../lib/flash";
import {
  approveWithdrawal,
  cancelWithdrawalRequest,
  rejectWithdrawal,
  requestWithdrawal,
} from "../api/projects";
import type { ProjectSummary } from "../types/project";

// プロジェクト詳細(wireframes/wireframe-member.html ⑤)。要ログイン。
//
// 脱退は申請制(docs/api-spec.md「プロジェクトの脱退」)。押した時点では抜けず、
// owner が承認して初めて抜ける。プロジェクトは継続的に成果物を作る活動で、
// 黙って抜けられると owner が引き継ぎを考えられないため。
// プロジェクト名が分かるまでの画面名。どの分岐でも PageHeading を通さないと
// document.title が書き換わらず、SPA では前の画面のタブ名が残る
// (PR #135、Issue #185)
const FALLBACK_TITLE = "プロジェクト";

export function ProjectDetailPage() {
  const { id } = useParams();
  const session = useCurrentUser();
  const { user, loading, failed } = session;
  const flash = useFlash();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // 参加は自分では取り消せないので、押す前に確認する(Issue #42)
  const [confirming, setConfirming] = useState(false);
  // 脱退も押した時点では戻せないので、同じく確認を挟む
  const [withdrawing, setWithdrawing] = useState(false);

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

  // 成功しても load() するだけだと、押せたのか無視されたのかが分からない。
  // 何が起きたかを message で受け取って出す(AdminUsersPage と同じ)
  async function run(action: () => Promise<void>, message: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setWithdrawing(false);
      setNotice(message);
      load();
    } catch (e: unknown) {
      setError(toMessage(e));
    } finally {
      setBusy(false);
    }
  }

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
  // owner 本人か管理者だけが編集できる(docs/api-spec.md §3)
  const canEdit =
    user !== null && (user.role === "admin" || (project.owner?.id ?? null) === user.id);

  return (
    <MemberPage session={session}>
      <div className="mb-3">
        <TextLink elementAs={Link} to="/projects" size="XS">
          ← プロジェクト一覧
        </TextLink>
      </div>

      {/* 作成直後だけ出す。画面が変わるだけでは「作られた」と言い切れない */}
      {flash !== null && <Note tone="success">{flash}</Note>}

      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={PROJECT_STATUS[project.status].tone}>
            {PROJECT_STATUS[project.status].label}
          </Badge>
          {project.tags.map((tag) => (
            <TagChip key={tag.id} name={tag.name} />
          ))}
        </div>

        {/* PageHeading を通すとタブにも企画名が出る。
            size は XL。smarthr-ui は太さではなく大きさで階層を作るので、
            既定の L だとパネル内の他の情報に埋もれる(PR #134 と同じ) */}
        <PageHeading title={project.title} className="mt-2.5" size="XL" />

        {/* owner 本人と管理者だけに出す。**隠すのは表示の話で制限ではない**ので、
            API 側が require_owner_or_admin で弾いている(CLAUDE.md §3-2) */}
        {canEdit && (
          <div className="mt-3">
            <LinkButton to={`/projects/${project.id}/edit`} variant="default" size="sm">
              編集
            </LinkButton>
          </div>
        )}

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
          <ul className="flex flex-wrap gap-2">
            {(project.participants ?? []).map((p) => (
              <li key={p.id}>
                {/* 誰が主催かを一覧の中でも分かるようにする(ワイヤーフレーム⑤)。
                    下の「主催」欄と照らし合わせずに済む */}
                <UserCard user={p} note={p.id === project.owner?.id ? "（主催）" : undefined} />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {project.owner !== undefined && project.owner !== null && (
        <Panel title="主催">
          <UserCard user={project.owner} />
        </Panel>
      )}

      {error !== null && <Note tone="danger">{error}</Note>}

      {notice !== null && <Note tone="success">{notice}</Note>}

      {project.current_user_joined === true ? (
        <WithdrawalSection
          project={project}
          busy={busy}
          isOwner={project.owner?.id === user.id}
          onRequest={() => setWithdrawing(true)}
          onCancel={() =>
            run(() => cancelWithdrawalRequest(Number(id)), "脱退の申請を取り下げました。")
          }
        />
      ) : full ? (
        <Note tone="warning">定員に達しています。</Note>
      ) : (
        // 「申請」と書いていたが、承認フローは無く押した時点で参加が確定する。
        // 実態に合わせて「参加する」にする(Issue #42)
        <Button variant="primary" onClick={() => setConfirming(true)} disabled={busy}>
          参加する
        </Button>
      )}

      {/* owner と管理者にだけ返る。キーが無ければ捌く権限が無い */}
      {project.withdrawal_requests !== undefined && project.withdrawal_requests.length > 0 && (
        <Panel title={`脱退の申請 ${project.withdrawal_requests.length}件`}>
          <ul className="divide-y divide-gray-200">
            {project.withdrawal_requests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-3 py-2.5">
                <span className="grow">{request.user?.name ?? "退会した人"}</span>
                <Button
                  variant="default"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => approveWithdrawal(Number(id), request.id),
                      `${request.user?.name ?? "この人"}の脱退を承認しました。`,
                    )
                  }
                >
                  承認する
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => rejectWithdrawal(Number(id), request.id),
                      `${request.user?.name ?? "この人"}の脱退を却下しました。`,
                    )
                  }
                >
                  却下する
                </Button>
              </li>
            ))}
          </ul>
          <Text size="S" color="TEXT_GREY" as="p" className="mt-2">
            承認すると、その人はこのプロジェクトのメンバーから外れます。却下すると参加が続きます。
            どちらも本人に通知は届きません。
          </Text>
        </Panel>
      )}

      {withdrawing && (
        <Modal
          title="このプロジェクトの脱退を申請しますか？"
          confirmLabel="申請する"
          busy={busy}
          onCancel={() => setWithdrawing(false)}
          onConfirm={() => run(() => requestWithdrawal(Number(id)), "脱退を申請しました。")}
        >
          <p>
            <strong>{project.title}</strong>の脱退を申請します。
            <br />
            <strong>この時点ではまだ抜けていません。</strong>
            主催者が承認すると、メンバーから外れます。
          </p>
        </Modal>
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
            <strong>抜けるときは脱退の申請が要ります。</strong>
            主催者が承認するまでは抜けられません。
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

// 参加中の人に出す欄。申請しているかどうかで出すものが変わる。
//
// **主催者には出さない。** 抜けると持ち主のいない企画が残るので、API も 422 で
// 弾く(docs/api-spec.md)。押せるボタンを出して怒られるより、出さない
function WithdrawalSection({
  project,
  busy,
  isOwner,
  onRequest,
  onCancel,
}: {
  project: ProjectSummary;
  busy: boolean;
  isOwner: boolean;
  onRequest: () => void;
  onCancel: () => void;
}) {
  if (isOwner) {
    return <Note>あなたが主催しています。主催者はこのプロジェクトを抜けられません。</Note>;
  }

  if (project.current_user_withdrawal_requested === true) {
    return (
      <Note tone="warning">
        脱退を申請しています。<strong>主催者が承認するまでは参加したままです。</strong>
        <div className="mt-2">
          <Button variant="default" size="sm" onClick={onCancel} disabled={busy}>
            申請を取り下げる
          </Button>
        </div>
      </Note>
    );
  }

  return (
    <Note>
      このプロジェクトに参加しています。
      <div className="mt-2">
        <Button variant="default" size="sm" onClick={onRequest} disabled={busy}>
          脱退を申請する
        </Button>
      </div>
    </Note>
  );
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "読み込みに失敗しました";
}
