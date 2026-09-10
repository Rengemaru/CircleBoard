import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { ApiError } from "../api/client";
import { fetchSignage } from "../api/signage";
import { formatCountdownDays } from "../lib/countdown";
import type { SignageData, SignageEvent, SignageProject } from "../types/signage";

// 部室ディスプレイ用の全画面ビュー(1920x1080 / 16:9)。
// ナビゲーションは一切置かない。ヘッダー・フッター・リンクも表示しない
// (wireframes/wireframe-signage.html「共通仕様」)。
// 視認距離2〜3mを想定し、最小フォントは24px相当。
// 60秒ごとに更新する(wireframe-signage.html「共通仕様」)。
// WebSocket は不採用。1台のディスプレイが1分遅れて更新されることに実害は無く、
// 常時接続を維持する仕組みを持つと、切れたときに気づけない方が問題になる。
//
// window.location.reload() でページごと読み直していたが、その瞬間に
// サーバーが落ちているとブラウザのエラーページになり、誰も操作しない
// 端末なので自力で復帰できなかった。データだけ取り直す(Issue #47)。
const REFRESH_INTERVAL_SECONDS = 60;

// 視認距離2〜3mで読める文字の下限。1920px 幅で約25px にあたり、
// ファイル冒頭の「最小フォントは24px相当」を満たす。
//
// className に書くと Tailwind の任意値がリテラルになり、下回っていても
// レビューで気づけない。style で定数を使い、grep できる形にする(Issue #49)
const MIN_FONT_SIZE = "1.3vw";

// QRの大きさ。1920px 幅を基準にして、画面幅で拡縮する。
//
// 固定pxのままだと、4Kのディスプレイでは文字だけ2倍になってQRは小さいまま
// 残り、2〜3mからスマホで読めない。QRは寸法が読み取り距離を直接決める。
// 逆に小さいモニタではQRがカードを圧迫する(Issue #50)
const SIGNAGE_BASE_WIDTH = 1920;
const QR_SIZE_AT_BASE = { hero: 220, event: 110, project: 90, empty: 200 } as const;

function useQrSize(kind: keyof typeof QR_SIZE_AT_BASE): number {
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  return Math.round((QR_SIZE_AT_BASE[kind] * viewportWidth) / SIGNAGE_BASE_WIDTH);
}

// 失敗の種類。部室に入った人が最初に打つ手が変わるので分ける
type Failure = "invalid_token" | "offline";

const FAILURE_MESSAGE: Record<Failure, string> = {
  // サーバーはトークン不正を 404 で返す(docs/api-spec.md §0 の「存在を隠す」方針)
  invalid_token: "このディスプレイのURLは無効です。管理画面でトークンを再発行してください",
  offline: "サーバーに接続できません",
};

// ApiError.status が 0 のときはネットワークに届いていない(api/client.ts)
function toFailure(error: unknown): Failure {
  if (error instanceof ApiError && error.status === 404) return "invalid_token";
  return "offline";
}

export function SignagePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [data, setData] = useState<SignageData | null>(null);
  // 失敗の理由を分ける。トークン失効・Wi-Fi断・サーバー停止が
  // 同じ「表示できません」だと、部室に入った人が何をすればよいか
  // 決められない(Issue #48)
  const [failure, setFailure] = useState<Failure | null>(null);
  // 最後に取得できた時刻。表示が古いことに気づけるよう、正常時も常に出す
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);

  useEffect(() => {
    // アンマウント後に setState しないための番人。
    // トークンを変えたときに古い応答が届くのも防ぐ
    let cancelled = false;

    function refresh() {
      fetchSignage(token)
        .then((next) => {
          if (cancelled) return;
          setData(next);
          setFetchedAt(new Date());
          setFailure(null);
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setFailure(toFailure(e));
        });
    }

    refresh();
    const timer = setInterval(refresh, REFRESH_INTERVAL_SECONDS * 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token]);

  // 一度でも取得できていれば、そのあと失敗しても画面を捨てない。
  // 部室のディスプレイは誰も操作しないので、消すと戻す人がいない
  if (failure !== null && data === null) {
    return (
      <Screen>
        <CenteredMessage>{FAILURE_MESSAGE[failure]}</CenteredMessage>
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
        <Header fetchedAt={fetchedAt} failure={failure} />
        <EmptyState />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header fetchedAt={fetchedAt} failure={failure} />
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

function Header({ fetchedAt, failure }: { fetchedAt: Date | null; failure: Failure | null }) {
  return (
    <header className="flex items-end justify-between border-b border-[#2b2e3c] pb-[1.1%]">
      <div>
        <div className="text-[2.1vw] font-bold tracking-tight">CircleBoard</div>
        <div className="mt-1 text-[#5d6474]" style={{ fontSize: MIN_FONT_SIZE }}>
          情報系学生サークル
        </div>
      </div>
      <div className="flex items-end gap-[2vw]">
        <FetchStatus fetchedAt={fetchedAt} failure={failure} />
        <Clock />
      </div>
    </header>
  );
}

// いつの情報かを常に出す。更新が止まっていても画面は最後の内容を映し続けるので、
// 時刻が無いと「古い」ことに気づけない(Issue #48)
function FetchStatus({ fetchedAt, failure }: { fetchedAt: Date | null; failure: Failure | null }) {
  if (fetchedAt === null) return null;

  return (
    <div className="max-w-[26vw] text-right leading-snug" style={{ fontSize: MIN_FONT_SIZE }}>
      <div className="text-[#5d6474]">最終更新 {formatClock(fetchedAt)}</div>
      {failure !== null && (
        // 更新できていないことは、色だけでなく文言でも伝える
        <div className="mt-1 text-[#fca5a5]">{FAILURE_MESSAGE[failure]}</div>
      )}
    </div>
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
        {/* 秒を小さく添える。毎秒更新しているのに分単位の表示だと、
            画面が固まっているのか動いているのかが遠目に分からない。
            「動いている時計＝生きている画面」の証拠にならなかった(Issue #69) */}
        {/* 区切りを入れないと 02:46 と 01秒 が「02:461」に見える */}
        <span className="ml-[0.15em] text-[0.45em] font-normal text-[#5d6474]">
          :{formatSeconds(now)}
        </span>
      </div>
      <div className="mt-[0.35em] text-[#5d6474]" style={{ fontSize: MIN_FONT_SIZE }}>
        {formatToday(now)}
      </div>
    </div>
  );
}

function SectionTitle({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div
      className="mb-[0.9%] flex items-center gap-[0.7em] font-bold tracking-[0.08em] text-[#9aa0ae]"
      style={{ fontSize: MIN_FONT_SIZE }}
    >
      <span className="h-[1.15em] w-[0.35em]" style={{ backgroundColor: color }} />
      {label}
      {/* 数字だけだと何の数か分からない。他の画面も「4件」「7件」と
          単位を付けている。数メートル離れて見る画面なので、なおさら
          読み替えを挟ませない(Issue #191) */}
      <span className="ml-auto font-normal text-[#5d6474]">{count}件</span>
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
  // 間の抜けた画面になる(wireframe-signage.html S2)。
  // 逆に3件以上は2段組みになり、1枚あたりの高さが半分になるので縮める。
  // 縮めないと中身が枠からはみ出し、下の段のカードに重なる(Issue #156)
  const density = events.length === 1 ? "hero" : events.length >= 3 ? "compact" : "normal";

  return (
    <section className={"flex min-h-0 flex-col " + (grown ? "flex-1" : "flex-[1.35]")}>
      <SectionTitle label="注目イベント" count={events.length} color="#fcd34d" />
      <div className={"grid min-h-0 flex-1 gap-[1.1%] " + eventGridClass(events.length)}>
        {events.map((event) => (
          <EventCard key={event.id} event={event} density={density} />
        ))}
      </div>
    </section>
  );
}

// 文字の大きさは1枚あたりの高さで決まる。下限の MIN_FONT_SIZE(1.3vw) は
// どの段階でも下回らない(Issue #49)
type Density = "hero" | "normal" | "compact";

const COUNTDOWN_SIZE: Record<Density, string> = {
  hero: "5.6vw",
  normal: "2.7vw",
  compact: "1.9vw",
};

const TITLE_SIZE: Record<Density, string> = {
  hero: "3.2vw",
  normal: "1.75vw",
  compact: "1.4vw",
};

// 行間も詰める。文字だけ小さくしても、間の余白が同じだと収まらない
const ROW_GAP: Record<Density, string> = {
  hero: "0.6em",
  normal: "0.6em",
  compact: "0.35em",
};

// 枠の内側の余白。カード幅に対する % なので、上下にも同じだけ効く。
// 2段組みでは上下で 28px 使ってしまう
const CARD_PADDING: Record<Density, string> = {
  hero: "1.5%",
  normal: "1.5%",
  compact: "1%",
};

// 1行しかない行は、既定の line-height(約1.5)だと文字の上下に無駄が出る。
// 実測で日時の行が 24.75px の文字に対して 37px を占めていた
const LINE_HEIGHT: Record<Density, number | undefined> = {
  hero: undefined,
  normal: undefined,
  compact: 1.15,
};

function EventCard({ event, density }: { event: SignageEvent; density: Density }) {
  const qrSize = useQrSize(density === "hero" ? "hero" : "event");

  return (
    <article
      className="flex min-h-0 items-center justify-between gap-[2%] rounded border border-[#2b2e3c] bg-white/[0.03]"
      style={{ padding: CARD_PADDING[density] }}
    >
      <div className="min-w-0">
        <div className="flex items-baseline gap-[1em]">
          {event.pinned && (
            // 見出しが「注目イベント」なので、バッジまで「注目」だと
            // 4件全部が注目なのに1件だけ注目と付く形になり、何が違うのか伝わらない。
            // 語は CLAUDE.md §9 の用語表と /events・/ に揃える(Issue #70)
            <span
              className="rounded bg-[#fcd34d] px-2 py-0.5 font-bold text-[#0f0f15]"
              style={{ fontSize: MIN_FONT_SIZE }}
            >
              📌 ピン留め
            </span>
          )}
          <span
            className="font-bold text-[#fcd34d]"
            style={{ fontSize: COUNTDOWN_SIZE[density], lineHeight: 1 }}
          >
            {formatCountdownDays(event.days_until)}
          </span>
        </div>
        <div
          className="text-[#9aa0ae]"
          style={{
            fontSize: MIN_FONT_SIZE,
            marginTop: ROW_GAP[density],
            lineHeight: LINE_HEIGHT[density],
          }}
        >
          {formatStartsAt(event.starts_at)} ・ {event.location}
        </div>
        <h2
          className="truncate font-bold"
          style={{
            fontSize: TITLE_SIZE[density],
            marginTop: "0.3em",
            lineHeight: LINE_HEIGHT[density],
          }}
        >
          {event.title}
        </h2>
        {event.tags.length > 0 && (
          <ul className="flex flex-wrap gap-[0.5em]" style={{ marginTop: ROW_GAP[density] }}>
            {event.tags.map((tag) => (
              <li
                key={tag.id}
                className="rounded bg-[#2b2e3c] px-[0.6em] py-[0.2em]"
                style={{ fontSize: MIN_FONT_SIZE, lineHeight: LINE_HEIGHT[density] }}
              >
                {tag.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* QRはフロントで生成する。サーバー生成だと60秒ごとに無駄な処理が走る
          (wireframe-signage.html「QRコード」)。中身は detail_url */}
      <QRCodeSVG value={event.detail_url} size={qrSize} bgColor="#f2f3f7" level="M" />
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
  const qrSize = useQrSize("project");

  return (
    <article className="flex min-h-0 items-center justify-between gap-[4%] rounded border border-[#2b2e3c] bg-white/[0.03] p-[1.5%]">
      <div className="min-w-0">
        <span
          className="rounded px-[0.6em] py-[0.2em] font-bold"
          style={{
            fontSize: MIN_FONT_SIZE,
            backgroundColor: project.status === "recruiting" ? "#4ade80" : "#5eb3f5",
            color: "#0f0f15",
          }}
        >
          {project.status === "recruiting" ? "募集中" : "進行中"}
        </span>
        <h2 className="mt-[0.4em] truncate text-[1.5vw] font-bold">{project.title}</h2>
        {project.meeting_schedule !== null && (
          <div className="mt-[0.3em] truncate text-[#9aa0ae]" style={{ fontSize: MIN_FONT_SIZE }}>
            {project.meeting_schedule}
          </div>
        )}
        <div className="mt-[0.3em] text-[#9aa0ae]" style={{ fontSize: MIN_FONT_SIZE }}>
          {formatMembers(project)}
        </div>
      </div>
      <QRCodeSVG value={project.detail_url} size={qrSize} bgColor="#f2f3f7" level="M" />
    </article>
  );
}

// イベント・プロジェクトとも0件のとき。真っ黒な画面を出さない
function EmptyState() {
  const qrSize = useQrSize("empty");

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[2vh]">
      <div className="text-[4vw] font-bold">CircleBoard</div>
      <p className="text-[2.4vw] text-[#9aa0ae]">いま募集中の企画はありません</p>
      <QRCodeSVG
        // 空なら、このサイネージを開いている URL をそのまま使う。
        // 部室の端末が LAN の IP で開いていれば、QR もその IP になる
        value={import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin}
        size={qrSize}
        bgColor="#f2f3f7"
        level="M"
      />
      <p className="text-[1.4vw] text-[#5d6474]">企画の投稿はこちらから</p>
    </div>
  );
}

// timeZone を明示する。省くと部室の端末の設定に依存し、ずれていても
// 誰も操作しないので現地で直されない(CLAUDE.md §4「時刻はタイムゾーン付きで扱う」)
const SIGNAGE_TIME_ZONE = "Asia/Tokyo";

function formatClock(now: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: SIGNAGE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);
}

function formatSeconds(now: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: SIGNAGE_TIME_ZONE,
    second: "2-digit",
  }).format(now);
}

function formatToday(now: Date): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: SIGNAGE_TIME_ZONE,
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(now);
}

function formatStartsAt(value: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: SIGNAGE_TIME_ZONE,
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
