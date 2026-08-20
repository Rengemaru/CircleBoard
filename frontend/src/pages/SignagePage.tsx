import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { fetchSignage } from "../api/signage";
import type { SignageData, SignageEvent, SignageProject } from "../types/signage";

// 部室ディスプレイ用の全画面ビュー(1920x1080 / 16:9)。
// ナビゲーションは一切置かない。ヘッダー・フッター・リンクも表示しない
// (wireframes/wireframe-signage.html「共通仕様」)。
// 視認距離2〜3mを想定し、最小フォントは24px相当。
// 60秒ごとにページごと読み込み直す(wireframe-signage.html「共通仕様」)。
// WebSocket は不採用。1台のディスプレイが1分遅れて更新されることに実害は無く、
// 常時接続を維持する仕組みを持つと、切れたときに気づけない方が問題になる。
const RELOAD_INTERVAL_SECONDS = 60;

function useAutoReload() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.reload();
    }, RELOAD_INTERVAL_SECONDS * 1000);

    return () => clearTimeout(timer);
  }, []);
}

export function SignagePage() {
  useAutoReload();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [data, setData] = useState<SignageData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetchSignage(token)
      .then(setData)
      .catch(() => setFailed(true));
  }, [token]);

  if (failed) {
    return (
      <Screen>
        <CenteredMessage>表示できません</CenteredMessage>
      </Screen>
    );
  }
  if (data === null) {
    return (
      <Screen>
        <CenteredMessage>読み込み中…</CenteredMessage>
      </Screen>
    );
  }

  const hasEvents = data.spotlight_events.length > 0;
  const hasProjects = data.projects.length > 0;

  // 0件のとき真っ黒な画面が部室に映るのを防ぐ(spec-v2.2.md §5.4)。
  // 文言は「エラー」でも「準備中」でもなく、次の行動を促す言い方にする
  if (!hasEvents && !hasProjects) {
    return (
      <Screen>
        <Header />
        <EmptyState />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header />
      {/* 片方が0件なら、残った方を全画面に繰り上げる。
          空セクションの見出しだけを残さない(wireframe-signage.html S4) */}
      {hasEvents && <EventSection events={data.spotlight_events} grown={!hasProjects} />}
      {hasProjects && <ProjectSection projects={data.projects} />}
    </Screen>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-screen flex-col gap-[1.6%] bg-[linear-gradient(135deg,#0f0f15_0%,#1a1a24_100%)] px-[2.6%] py-[2.2%] text-[#f2f3f7]">
      {children}
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center text-[2vw] text-[#9aa0ae]">
      {children}
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-end justify-between border-b border-[#2b2e3c] pb-[1.1%]">
      <div>
        <div className="text-[2.1vw] font-bold tracking-tight">CircleBoard</div>
        <div className="mt-1 text-[1.05vw] text-[#5d6474]">情報系学生サークル</div>
      </div>
      <Clock />
    </header>
  );
}

// 時計はリロードとは独立に毎秒更新する(wireframe-signage.html「共通仕様」)。
// 60秒に1回しか動かない時計は、画面が固まっているのか動いているのかが
// 遠目に分からない。動いている時計は「生きている画面」の証拠になる
function Clock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="text-right">
      <div className="font-mono text-[3.1vw] font-bold leading-none tracking-tight">
        {formatClock(now)}
      </div>
      <div className="mt-[0.35em] text-[1.05vw] text-[#5d6474]">{formatToday(now)}</div>
    </div>
  );
}

function SectionTitle({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="mb-[0.9%] flex items-center gap-[0.7em] text-[1.25vw] font-bold tracking-[0.08em] text-[#9aa0ae]">
      <span className="h-[1.15em] w-[0.35em]" style={{ backgroundColor: color }} />
      {label}
      <span className="ml-auto font-normal text-[#5d6474]">{count}</span>
    </div>
  );
}

// 対象件数でグリッドを変える。空枠は描画しない
// (wireframes/wireframe-signage.html「レイアウトの分岐」)
function eventGridClass(count: number): string {
  if (count === 1) return "grid-cols-1";
  if (count === 2) return "grid-cols-2";
  return "grid-cols-2 grid-rows-2";
}

function EventSection({ events, grown }: { events: SignageEvent[]; grown: boolean }) {
  // 1件のときはフォントを段階的に拡大する。枠だけ広げて文字が小さいままだと
  // 間の抜けた画面になる(wireframe-signage.html S2)
  const hero = events.length === 1;

  return (
    <section className={"flex min-h-0 flex-col " + (grown ? "flex-1" : "flex-[1.35]")}>
      <SectionTitle label="注目イベント" count={events.length} color="#fcd34d" />
      <div className={"grid min-h-0 flex-1 gap-[1.1%] " + eventGridClass(events.length)}>
        {events.map((event) => (
          <EventCard key={event.id} event={event} hero={hero} />
        ))}
      </div>
    </section>
  );
}

function EventCard({ event, hero }: { event: SignageEvent; hero: boolean }) {
  return (
    <article className="flex min-h-0 items-center justify-between gap-[2%] rounded border border-[#2b2e3c] bg-white/[0.03] p-[1.5%]">
      <div className="min-w-0">
        <div className="flex items-baseline gap-[1em]">
          {event.pinned && (
            <span className="rounded bg-[#fcd34d] px-2 py-0.5 text-[0.9vw] font-bold text-[#0f0f15]">
              注目
            </span>
          )}
          <span
            className="font-bold text-[#fcd34d]"
            style={{ fontSize: hero ? "5.6vw" : "2.7vw", lineHeight: 1 }}
          >
            あと{event.days_until}日
          </span>
        </div>
        <div className="mt-[0.6em] text-[1.05vw] text-[#9aa0ae]">
          {formatStartsAt(event.starts_at)} ・ {event.location}
        </div>
        <h2
          className="mt-[0.3em] truncate font-bold"
          style={{ fontSize: hero ? "3.2vw" : "1.75vw" }}
        >
          {event.title}
        </h2>
        {event.tags.length > 0 && (
          <ul className="mt-[0.6em] flex flex-wrap gap-[0.5em]">
            {event.tags.map((tag) => (
              <li key={tag.id} className="rounded bg-[#2b2e3c] px-[0.6em] py-[0.2em] text-[0.95vw]">
                {tag.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* QRはフロントで生成する。サーバー生成だと60秒ごとに無駄な処理が走る
          (wireframe-signage.html「QRコード」)。中身は detail_url */}
      <QRCodeSVG value={event.detail_url} size={hero ? 220 : 110} bgColor="#f2f3f7" level="M" />
    </article>
  );
}

function ProjectSection({ projects }: { projects: SignageProject[] }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <SectionTitle label="プロジェクト" count={projects.length} color="#5eb3f5" />
      <div className="grid min-h-0 flex-1 grid-cols-3 gap-[1.1%]">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </section>
  );
}

function ProjectCard({ project }: { project: SignageProject }) {
  return (
    <article className="flex min-h-0 items-center justify-between gap-[4%] rounded border border-[#2b2e3c] bg-white/[0.03] p-[1.5%]">
      <div className="min-w-0">
        <span
          className="rounded px-[0.6em] py-[0.2em] text-[0.95vw] font-bold"
          style={{
            backgroundColor: project.status === "recruiting" ? "#4ade80" : "#5eb3f5",
            color: "#0f0f15",
          }}
        >
          {project.status === "recruiting" ? "募集中" : "進行中"}
        </span>
        <h2 className="mt-[0.4em] truncate text-[1.5vw] font-bold">{project.title}</h2>
        {project.meeting_schedule !== null && (
          <div className="mt-[0.3em] truncate text-[1vw] text-[#9aa0ae]">
            {project.meeting_schedule}
          </div>
        )}
        <div className="mt-[0.3em] text-[1vw] text-[#9aa0ae]">{formatMembers(project)}</div>
      </div>
      <QRCodeSVG value={project.detail_url} size={90} bgColor="#f2f3f7" level="M" />
    </article>
  );
}

// イベント・プロジェクトとも0件のとき。真っ黒な画面を出さない
function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[2vh]">
      <div className="text-[4vw] font-bold">CircleBoard</div>
      <p className="text-[2.4vw] text-[#9aa0ae]">いま募集中の企画はありません</p>
      <QRCodeSVG
        value={import.meta.env.VITE_PUBLIC_BASE_URL}
        size={200}
        bgColor="#f2f3f7"
        level="M"
      />
      <p className="text-[1.4vw] text-[#5d6474]">企画の投稿はこちらから</p>
    </div>
  );
}

function formatClock(now: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
}

function formatToday(now: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(now);
}

function formatStartsAt(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

// capacity が null のときは無制限。「8 / null名」と出さない
function formatMembers(project: SignageProject): string {
  if (project.capacity === null) return project.participants_count + "名";
  return project.participants_count + " / " + project.capacity + "名";
}
