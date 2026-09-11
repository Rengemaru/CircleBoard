import { useEffect, useState } from "react";
import { TagChip } from "../components/TagChip";
import { Link } from "react-router-dom";
import { Base, Cluster, Heading, Section, Stack, Text, TextLink } from "smarthr-ui";
import { MemberPage } from "../components/MemberPage";
import { PageHeading } from "../components/ui/PageHeading";
import { SessionUnavailable } from "../components/SessionUnavailable";
import { Badge } from "../components/ui/Badge";
import { Chip } from "../components/ui/Chip";
import { Note } from "../components/ui/Note";
import { SectionHeading } from "../components/ui/SectionHeading";
import { fetchEvents } from "../api/events";
import { fetchProjects } from "../api/projects";
import type { CurrentUser } from "../api/session";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { formatCountdown } from "../lib/countdown";
import type { EventSummary } from "../types/event";
import type { ProjectSummary } from "../types/project";

// トップページ(wireframes/wireframe-member.html 画面①)。
// ゲスト可。ただしプロジェクト欄はログイン必須なので差し替える。
//
// 画面の構成は旧ワイヤーフレームのまま。見た目だけ
// wireframe-admin-ver2.html のデザイン言語に合わせた(T7-5)。
const SPOTLIGHT_LIMIT = 4;
const EVENT_LIST_LIMIT = 3;

export function TopPage() {
  // 自前で fetchCurrentUser を呼ばず、他の画面と同じ hook を使う。
  // ここだけ独自に持っていたため「読み込み中」の状態が無く、
  // ヘッダーに一瞬「ログイン」が出ていた(Issue #184)
  const session = useCurrentUser();
  const { user, loading, failed: sessionFailed } = session;
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  // 通信に失敗したとき「0件」と表示すると、企画が無いのか繋がっていないのかを
  // 見分けられない。部室のディスプレイでは「今日は企画が無いんだ」と誤読される
  //
  // イベントとプロジェクトでエラーを分ける。1つの state を共有していたときは
  // 片方が失敗すると画面全体が消え、取得できていた注目イベントまで
  // 見えなくなっていた(Issue #45)
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  useEffect(() => {
    fetchEvents({ sort: "spotlight" })
      .then(setEvents)
      .catch((e: unknown) => setEventsError(toMessage(e)));
  }, []);

  useEffect(() => {
    // プロジェクトはログイン必須。未ログインで叩くと 401 になるので呼ばない
    if (loading || user === null) return;

    fetchProjects()
      .then(setProjects)
      .catch((e: unknown) => setProjectsError(toMessage(e)));
  }, [loading, user]);

  return (
    <MemberPage session={session}>
      {/* サイトの入口なのに見出しが h2 から始まっていた。ヘッダーのロゴは
          リンクであって見出しではない。視覚的には冗長なので隠す(Issue #58)。
          PageHeading を通すのは document.title も書き換えるため。
          自前の h1 だと、他の画面から戻ったときにタブ名が前のまま残る */}
      <PageHeading title="今週の企画" visuallyHidden className="" />
      <div className="space-y-7">
        <SpotlightSection events={events} error={eventsError} />
        <ProjectSection
          user={user}
          projects={projects}
          error={projectsError}
          sessionFailed={sessionFailed}
        />
        <EventListSection events={events} error={eventsError} />
      </div>
    </MemberPage>
  );
}

// 一覧APIはピン留めを先頭に、残りを注目スコア降順で返す。
// ここでは先頭から最大4件を取るだけでよい。
// 表示件数は可変で、空枠は描かない。閑散期に空箱が並ぶのが最も見苦しい
// (wireframe-member.html 画面①の注記)
function SpotlightSection({
  events,
  error,
}: {
  events: EventSummary[] | null;
  error: string | null;
}) {
  // イベントの取得エラーはこのセクションにだけ出す。下のイベント一覧にも
  // 出すと同じ文言が2回並ぶ
  if (error !== null) {
    return (
      <Section>
        <SectionHeading>注目イベント</SectionHeading>
        <Note tone="danger">{error}</Note>
      </Section>
    );
  }

  if (events === null) {
    return <p className="text-[13px] text-gray-500">読み込み中…</p>;
  }

  const spotlight = events.slice(0, SPOTLIGHT_LIMIT);
  if (spotlight.length === 0) {
    return (
      <Section>
        <SectionHeading>注目イベント</SectionHeading>
        <p className="text-[13px] text-gray-500">いま募集中のイベントはありません。</p>
      </Section>
    );
  }

  return (
    <Section>
      <SectionHeading>注目イベント</SectionHeading>
      <ul className={spotlight.length === 1 ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
        {spotlight.map((event) => (
          <Base as="li" key={event.id} padding={1.25}>
            {/* カード1枚ずつを Section で包む。包まないと、カードの見出しが
                「注目イベント」と同じ h2 になり、セクションの中身なのか
                隣のセクションなのかが見出しからは分からない(Issue #187)。
                smarthr-ui の Heading は Section の入れ子の深さでレベルが決まる */}
            <Section>
              <Stack gap="XXS">
                {event.pinned && (
                  <Cluster gap="XS">
                    <Chip>📌 ピン留め</Chip>
                  </Cluster>
                )}
                {/* 日数 28px / タイトル 14px で、一番目立つのが「そのイベントが何か」
                ではなく「あと何日か」になっていた。28px は ver2 の .stat-value
                （ダッシュボードの統計値）から借りた値で、ワイヤーフレームの
                .cd は 17px。

                大小関係は smarthr-ui へ移行済みの /events に揃える。
                あちらは日数 14px < タイトル 16px で、識別のための名前を主に
                している(smarthr-list.mdx)。兄弟画面で逆になっていると、
                一覧から詳細へ移るたびに視線の置き場所が変わる。
                ワイヤーフレームは日数を大きくしているが、/events は Phase 8 で
                既にその配分を離れており、そちらに合わせる(Issue #59) */}
                <Text size="S" weight="bold">
                  {formatCountdown(event.starts_at)}
                </Text>
                <Text size="S" color="TEXT_GREY">
                  {formatDate(event.starts_at)} ・ {event.location}
                </Text>
                <Heading type="subBlockTitle">
                  <TextLink elementAs={Link} to={`/events/${event.id}`}>
                    {event.title}
                  </TextLink>
                </Heading>
                {event.tags.length > 0 && (
                  <Cluster gap="XXS" as="ul">
                    {event.tags.map((tag) => (
                      <li key={tag.id}>
                        <TagChip name={tag.name} />
                      </li>
                    ))}
                  </Cluster>
                )}
              </Stack>
            </Section>
          </Base>
        ))}
      </ul>
    </Section>
  );
}

// 未ログインではセクションごと「ログインすると閲覧できます」に置き換える。
// プロジェクトはログイン必須のため(wireframe-member.html 画面①の注記)
function ProjectSection({
  user,
  projects,
  error,
  sessionFailed,
}: {
  user: CurrentUser | null;
  projects: ProjectSummary[] | null;
  error: string | null;
  sessionFailed: boolean;
}) {
  return (
    <Section>
      <SectionHeading link="/projects">プロジェクト</SectionHeading>
      {sessionFailed ? (
        <SessionUnavailable />
      ) : user === null ? (
        <Note>プロジェクトはログインすると閲覧できます。アカウントは管理者が発行します。</Note>
      ) : error !== null ? (
        <Note tone="danger">{error}</Note>
      ) : projects === null ? (
        <Text size="S" color="TEXT_GREY">
          読み込み中…
        </Text>
      ) : projects.length === 0 ? (
        // 一覧と同じく募集中と進行中の両方を出すので、募集中だけを否定しない(Issue #53)
        <Text size="S" color="TEXT_GREY">
          参加できるプロジェクトはありません。
        </Text>
      ) : (
        <ListPanel>
          {projects.slice(0, 3).map((project) => (
            <li key={project.id} className="px-4 py-3">
              <Cluster align="center" gap="XS">
                <Badge tone={project.status === "recruiting" ? "recruiting" : "inprogress"}>
                  {project.status === "recruiting" ? "募集中" : "進行中"}
                </Badge>
                <TextLink elementAs={Link} to={`/projects/${project.id}`} size="S">
                  {project.title}
                </TextLink>
                <Text size="S" color="TEXT_GREY" className="ml-auto">
                  {formatProjectMeta(project)}
                </Text>
              </Cluster>
            </li>
          ))}
        </ListPanel>
      )}
    </Section>
  );
}

function EventListSection({
  events,
  error,
}: {
  events: EventSummary[] | null;
  error: string | null;
}) {
  // エラーは注目イベントのセクションで出しているので、ここでは何も出さない
  if (error !== null) return null;
  if (events === null || events.length === 0) return null;

  return (
    <Section>
      <SectionHeading link="/events">イベント</SectionHeading>
      <ListPanel>
        {events.slice(0, EVENT_LIST_LIMIT).map((event) => (
          <li key={event.id} className="px-4 py-3">
            <Cluster align="center" gap="XS">
              <Text size="S" color="TEXT_GREY" className="shrink-0">
                {formatDate(event.starts_at)}
              </Text>
              <TextLink elementAs={Link} to={`/events/${event.id}`} size="S">
                {event.title}
              </TextLink>
              <Text size="S" color="TEXT_GREY" className="ml-auto shrink-0">
                {formatCapacity(event)}
              </Text>
            </Cluster>
          </li>
        ))}
      </ListPanel>
    </Section>
  );
}

// 行を並べる白い枠。ver2 の .admin-table-wrap と同じ見た目を、
// 表ではないもの（一覧の行）にも使う
function ListPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded border border-gray-200 bg-white">
      <ul className="divide-y divide-gray-100">{children}</ul>
    </div>
  );
}

// 開催時刻は分まで出す。日付だけだと「その日に行けるか」は分かっても
// 「何時に行けばよいか」が分からず、詳細を開き直すことになる。
// 秒は出さない。イベントの開始時刻に秒の精度は要らない。
// 他の画面（/events・詳細・サイネージ）も同じ粒度で揃えている
function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCapacity(event: EventSummary): string {
  if (event.capacity === null) return `${event.participants_count}名`;
  return `${event.participants_count} / ${event.capacity}名`;
}

// meeting_schedule は NULL 可(spec-v2.2.md §2.3)。未設定のときに
// 区切りの「・」だけが残らないよう、埋まっている項目だけを繋ぐ
function formatProjectMeta(project: ProjectSummary): string {
  const members =
    project.capacity === null
      ? `${project.participants_count}名`
      : `${project.participants_count} / ${project.capacity}名`;

  return [project.meeting_schedule, members].filter((part) => part !== null).join(" ・ ");
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "読み込みに失敗しました";
}
