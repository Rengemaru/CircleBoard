import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { fetchEvents } from "../api/events";
import { fetchProjects } from "../api/projects";
import { fetchCurrentUser, type CurrentUser } from "../api/session";
import type { EventSummary } from "../types/event";
import type { ProjectSummary } from "../types/project";

// トップページ(wireframes/wireframe-member.html 画面①)。
// ゲスト可。ただしプロジェクト欄はログイン必須なので差し替える。
const SPOTLIGHT_LIMIT = 4;
const EVENT_LIST_LIMIT = 3;

export function TopPage() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  // 通信に失敗したとき「0件」と表示すると、企画が無いのか繋がっていないのかを
  // 見分けられない。部室のディスプレイでは「今日は企画が無いんだ」と誤読される
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCurrentUser()
      .then((current) => {
        setUser(current);
        // プロジェクトはログイン必須。未ログインで叩くと 401 になるので呼ばない
        if (current !== null) {
          fetchProjects()
            .then(setProjects)
            .catch((e: unknown) => setError(toMessage(e)));
        }
      })
      .catch(() => setUser(null));

    fetchEvents({ sort: "spotlight" })
      .then(setEvents)
      .catch((e: unknown) => setError(toMessage(e)));
  }, []);

  if (error !== null) {
    return (
      <>
        <SiteHeader user={user} />
        <main className="mx-auto max-w-3xl p-6">
          <p className="rounded border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>
        </main>
      </>
    );
  }

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl space-y-10 p-6">
        <SpotlightSection events={events} />
        <ProjectSection user={user} projects={projects} />
        <EventListSection events={events} />
      </main>
    </>
  );
}

// 一覧APIはピン留めを先頭に、残りを注目スコア降順で返す。
// ここでは先頭から最大4件を取るだけでよい。
// 表示件数は可変で、空枠は描かない。閑散期に空箱が並ぶのが最も見苦しい
// (wireframe-member.html 画面①の注記)
function SpotlightSection({ events }: { events: EventSummary[] | null }) {
  if (events === null) {
    return <p className="text-gray-500">読み込み中…</p>;
  }

  const spotlight = events.slice(0, SPOTLIGHT_LIMIT);
  if (spotlight.length === 0) {
    return (
      <section>
        <SectionTitle>注目イベント</SectionTitle>
        <p className="text-gray-500">いま募集中のイベントはありません。</p>
      </section>
    );
  }

  return (
    <section>
      <SectionTitle>注目イベント</SectionTitle>
      <ul className={spotlight.length === 1 ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
        {spotlight.map((event) => (
          <li key={event.id} className="rounded-lg border border-gray-200 p-4">
            {event.pinned && <span className="text-sm font-bold">📌 ピン留め</span>}
            <div className="text-2xl font-bold">あと{daysUntil(event.starts_at)}日</div>
            <div className="mt-1 text-sm text-gray-500">
              {formatDate(event.starts_at)} ・ {event.location}
            </div>
            <h3 className="mt-1 font-bold">{event.title}</h3>
            {event.tags.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-2">
                {event.tags.map((tag) => (
                  <li key={tag.id} className="rounded bg-gray-100 px-2 py-0.5 text-xs">
                    {tag.name}
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
}: {
  user: CurrentUser | null;
  projects: ProjectSummary[] | null;
}) {
  return (
    <section>
      <SectionTitle link="/projects">プロジェクト</SectionTitle>
      {user === null ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-gray-700">
          ログインすると閲覧できます。
        </p>
      ) : projects === null ? (
        <p className="text-gray-500">読み込み中…</p>
      ) : projects.length === 0 ? (
        <p className="text-gray-500">いま募集中のプロジェクトはありません。</p>
      ) : (
        <ul className="space-y-3">
          {projects.slice(0, 3).map((project) => (
            <li key={project.id} className="rounded-lg border border-gray-200 p-4">
              <span className="text-sm text-gray-600">
                {project.status === "recruiting" ? "募集中" : "進行中"}
              </span>
              <h3 className="font-bold">{project.title}</h3>
              <div className="mt-1 text-sm text-gray-500">
                {project.meeting_schedule} ・ {formatMembers(project)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EventListSection({ events }: { events: EventSummary[] | null }) {
  if (events === null || events.length === 0) return null;

  return (
    <section>
      <SectionTitle link="/events">イベント</SectionTitle>
      <ul className="divide-y divide-gray-200">
        {events.slice(0, EVENT_LIST_LIMIT).map((event) => (
          <li key={event.id} className="flex items-baseline gap-4 py-3 text-sm">
            <span className="shrink-0 text-gray-500">{formatDate(event.starts_at)}</span>
            <span className="truncate font-bold">{event.title}</span>
            <span className="ml-auto shrink-0 text-gray-500">{formatCapacity(event)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionTitle({ children, link }: { children: React.ReactNode; link?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="text-lg font-bold">{children}</h2>
      {link !== undefined && (
        <Link to={link} className="text-sm text-gray-600 underline">
          すべて見る
        </Link>
      )}
    </div>
  );
}

// サーバーは days_until をサイネージAPIでしか返さないので、ここで数える。
// 時刻を無視して日付だけで引くのは、サーバー側の計算(spec-v2.2.md §3.4)と
// 揃えるため
function daysUntil(startsAt: string): number {
  const start = new Date(startsAt);
  const startDate = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((startDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
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

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : "読み込みに失敗しました";
}

function formatMembers(project: ProjectSummary): string {
  if (project.capacity === null) return `${project.participants_count}名`;
  return `${project.participants_count} / ${project.capacity}名`;
}
