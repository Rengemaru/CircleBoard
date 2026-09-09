import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MemberPage } from "../components/MemberPage";
import { Badge } from "../components/ui/Badge";
import { Chip } from "../components/ui/Chip";
import { Note } from "../components/ui/Note";
import { SectionHeading } from "../components/ui/SectionHeading";
import { fetchEvents } from "../api/events";
import { fetchProjects } from "../api/projects";
import { fetchCurrentUser, type CurrentUser } from "../api/session";
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
  const [user, setUser] = useState<CurrentUser | null>(null);
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
    fetchCurrentUser()
      .then((current) => {
        setUser(current);
        // プロジェクトはログイン必須。未ログインで叩くと 401 になるので呼ばない
        if (current !== null) {
          fetchProjects()
            .then(setProjects)
            .catch((e: unknown) => setProjectsError(toMessage(e)));
        }
      })
      .catch(() => setUser(null));

    fetchEvents({ sort: "spotlight" })
      .then(setEvents)
      .catch((e: unknown) => setEventsError(toMessage(e)));
  }, []);

  return (
    <MemberPage user={user}>
      <div className="space-y-7">
        <SpotlightSection events={events} error={eventsError} />
        <ProjectSection user={user} projects={projects} error={projectsError} />
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
      <section>
        <SectionHeading>注目イベント</SectionHeading>
        <Note tone="danger">{error}</Note>
      </section>
    );
  }

  if (events === null) {
    return <p className="text-[13px] text-gray-500">読み込み中…</p>;
  }

  const spotlight = events.slice(0, SPOTLIGHT_LIMIT);
  if (spotlight.length === 0) {
    return (
      <section>
        <SectionHeading>注目イベント</SectionHeading>
        <p className="text-[13px] text-gray-500">いま募集中のイベントはありません。</p>
      </section>
    );
  }

  return (
    <section>
      <SectionHeading>注目イベント</SectionHeading>
      <ul className={spotlight.length === 1 ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
        {spotlight.map((event) => (
          <li key={event.id} className="rounded border border-gray-200 bg-white p-5">
            {event.pinned && (
              <div className="mb-2">
                <Badge tone="pinned">📌 ピン留め</Badge>
              </div>
            )}
            {/* 開催の近さがこの枠で一番効く情報なので、数字を一番大きく置く
                (ver2 の .stat-value と同じ 28px) */}
            <div className="text-[28px] leading-none font-bold">
              {formatCountdown(event.starts_at)}
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {formatDate(event.starts_at)} ・ {event.location}
            </div>
            <h3 className="mt-1 text-sm font-bold">
              <Link to={`/events/${event.id}`} className="hover:underline">
                {event.title}
              </Link>
            </h3>
            {event.tags.length > 0 && (
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {event.tags.map((tag) => (
                  <li key={tag.id}>
                    <Chip>{tag.name}</Chip>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// 未ログインではセクションごと「ログインすると閲覧できます」に置き換える。
// プロジェクトはログイン必須のため(wireframe-member.html 画面①の注記)
function ProjectSection({
  user,
  projects,
  error,
}: {
  user: CurrentUser | null;
  projects: ProjectSummary[] | null;
  error: string | null;
}) {
  return (
    <section>
      <SectionHeading link="/projects">プロジェクト</SectionHeading>
      {user === null ? (
        <Note>プロジェクトはログインすると閲覧できます。アカウントは管理者が発行します。</Note>
      ) : error !== null ? (
        <Note tone="danger">{error}</Note>
      ) : projects === null ? (
        <p className="text-[13px] text-gray-500">読み込み中…</p>
      ) : projects.length === 0 ? (
        // 一覧と同じく募集中と進行中の両方を出すので、募集中だけを否定しない(Issue #53)
        <p className="text-[13px] text-gray-500">参加できるプロジェクトはありません。</p>
      ) : (
        <ListPanel>
          {projects.slice(0, 3).map((project) => (
            <li key={project.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
              <Badge tone={project.status === "recruiting" ? "recruiting" : "inprogress"}>
                {project.status === "recruiting" ? "募集中" : "進行中"}
              </Badge>
              <Link
                to={`/projects/${project.id}`}
                className="text-[13px] font-bold hover:underline"
              >
                {project.title}
              </Link>
              <span className="ml-auto text-xs text-gray-500">{formatProjectMeta(project)}</span>
            </li>
          ))}
        </ListPanel>
      )}
    </section>
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
    <section>
      <SectionHeading link="/events">イベント</SectionHeading>
      <ListPanel>
        {events.slice(0, EVENT_LIST_LIMIT).map((event) => (
          <li key={event.id} className="flex items-baseline gap-3 px-4 py-3 text-[13px]">
            <span className="shrink-0 text-xs text-gray-500">{formatDate(event.starts_at)}</span>
            <Link to={`/events/${event.id}`} className="truncate font-bold hover:underline">
              {event.title}
            </Link>
            <span className="ml-auto shrink-0 text-xs text-gray-500">{formatCapacity(event)}</span>
          </li>
        ))}
      </ListPanel>
    </section>
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
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
