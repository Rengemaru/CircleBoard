import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { ApiError } from "../api/client";
import { fetchSignage } from "../api/signage";
import { formatCountdownDays } from "../lib/countdown";
import type { SignageData, SignageEvent, SignageProject } from "../types/signage";

// 部室ディスプレイ用の全画面ビュー(1920x1080 / 16:9)。
// 16:9 以外のディスプレイに繋がれても崩れないよう、寸法は SIGNAGE_UNIT で測る。
// ナビゲーションは一切置かない。ヘッダー・フッター・リンクも表示しない
// (wireframes/wireframe-signage.html「共通仕様」)。
// 視認距離2.5m(55型・1080p)を想定し、最小フォントは38px相当
// (docs/spec-signage-style-v2.md 案B)。
// 60秒ごとに更新する(wireframe-signage.html「共通仕様」)。
// WebSocket は不採用。1台のディスプレイが1分遅れて更新されることに実害は無く、
// 常時接続を維持する仕組みを持つと、切れたときに気づけない方が問題になる。
//
// window.location.reload() でページごと読み直していたが、その瞬間に
// サーバーが落ちているとブラウザのエラーページになり、誰も操作しない
// 端末なので自力で復帰できなかった。データだけ取り直す(Issue #47)。
const REFRESH_INTERVAL_SECONDS = 60;

// 画面に内接する 16:9 の枠の、幅1%にあたる長さ。
//
// 寸法をすべて vw(=画面幅の1%)で書いていたため、16:9 より横長のディスプレイでは
// 高さが足りないのに文字だけ大きくなり、カードが下の段に重なっていた
// (2560×1080 で再現。1件表示のときはタグ行が「プロジェクト」の見出しに重なる)。
// 縦長では逆に、余った高さの分だけ文字が小さく見えていた。
//
// 横長のときは高さ基準に切り替わる単位を1つ用意し、縦に効く寸法はすべてこれで測る。
// 16:9 ちょうどなら min() は 1vw を選ぶので、1920×1080 での見た目は変わらない。
const SIGNAGE_UNIT = "min(1vw, 1vh * 16 / 9)";

// サイネージだけのフォント。指定が無いと smarthr-ui.css の system-ui が効き、
// Windows では線の細い Yu Gothic UI、和文フォントの無い Linux 端末では豆腐になる。
// system-ui は「机の前で操作する業務アプリ」向けの指定で、3mから読む画面のために
// 選ばれたものではない(Issue #220)。
//
// palt は wireframe-signage.html にあった詰め設定。実装で落ちていたので戻す。
// weight を 500 にするのは、遠距離では線の細さがそのまま読めなさになるため
const SIGNAGE_FONT_FAMILY = '"Noto Sans JP", "Hiragino Sans", "Yu Gothic UI", sans-serif';

// 1920px 幅を基準に書かれていた「Xvw」を、そのまま su(X) に置き換えられる。
// min() を各所に展開せず var() を参照するのは、どこが基準なのかを1か所に残すため
function su(n: number): string {
  return `calc(${n} * var(--sg-u))`;
}

// 視認距離2.5mで読める文字の下限。1920×1080 で約38px にあたる。
//
// 1080p の 1px が何ミリになるかは画面の対角で倍以上変わる。55型なら 1px = 0.634mm で、
// 「視距離3mにつき文字高25mm」に当てると 38.4px が 2.5m ぶん。
// 旧値の 25px は 1.6m までしか届いていなかった(Issue #219)。
//
// className に書くと Tailwind の任意値がリテラルになり、下回っていても
// レビューで気づけない。style で定数を使い、grep できる形にする(Issue #49)
const MIN_FONT_SIZE = su(2.0);

// QRはカードの大きさに対する比率で置く(要望2)。
//
// 以前は画面幅から実pxを毎回計算し、件数・種別ごとに 320/221/165/125 px と
// 変えていた。そのため件数や解像度が変わるとカードごとに大きさがばらついて
// 見えた。カード高さの一定割合にすると、どのカードでも「同じ位置に・同じ比率で」
// QR が載る。右寄せ・上下中央の配置は各カードの flex(justify-between /
// items-center)が担う。高さで測るのは、QR が正方形で、横長のカードでは
// 高さが最も効く制約になるため。
const QR_HEIGHT_RATIO: Record<"event" | "project", string> = {
  event: "h-[72%]",
  project: "h-[64%]",
};

// 表示サイズは上の CSS 比率で決まるので、size は SVG の内部解像度にとどめる。
// viewBox があるので、どの CSS サイズにも滑らかに拡縮する
const QR_RESOLUTION = 512;

// カード内のQR。カード高さに対する比率で大きさを決め、shrink-0 で
// フレックスに圧縮されないようにする(サイズが不揃いに見える原因の対処)。
//
// 外周を白で囲む(要望3)。暗いカード背景の上でコードの矩形を際立たせ、
// 遠くからでも「そこがQR」と分かって読み取りやすくする。白枠は
// QR の読み取りに要るクワイエットゾーン(余白)も兼ねる
function CardQr({ value, kind }: { value: string; kind: "event" | "project" }) {
  return (
    <div
      className={"flex shrink-0 items-center rounded bg-white " + QR_HEIGHT_RATIO[kind]}
      style={{ padding: su(0.4) }}
    >
      <QRCodeSVG
        value={value}
        size={QR_RESOLUTION}
        bgColor="#ffffff"
        level="M"
        className="h-full w-auto"
      />
    </div>
  );
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

// 焼き付き対策。部室のディスプレイは終日点けっぱなしで、データが変わらなければ
// 描画も1ピクセルも変わらない。黄色のセクションバーやピン留めバッジのような
// 固定位置の高輝度な要素が、同じ画素に焼き付き続ける(Issue #223)。
//
// 60秒ごとに 2px の範囲で描画位置を回す。3m先からは分からない。
// 左右・上下で足した値が一定になるよう padding を振り分けるので、
// 中身の入る幅と高さは変わらない（ずらしたせいではみ出すことがない）
const BURN_IN_OFFSETS = [
  { x: 0, y: 0 },
  { x: 2, y: 0 },
  { x: 2, y: 2 },
  { x: 0, y: 2 },
] as const;

function useBurnInOffset(): (typeof BURN_IN_OFFSETS)[number] {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => s + 1), REFRESH_INTERVAL_SECONDS * 1000);

    return () => clearInterval(timer);
  }, []);

  return BURN_IN_OFFSETS[step % BURN_IN_OFFSETS.length];
}

function Screen({ children }: { children: React.ReactNode }) {
  const offset = useBurnInOffset();

  return (
    <div
      className="flex h-screen w-screen flex-col gap-[1.6%] bg-[linear-gradient(135deg,#0f0f15_0%,#1a1a24_100%)] text-[#f2f3f7]"
      // padding の % は上下も「幅」に対して効く(CSSの仕様)。横長のディスプレイでは
      // 上下の余白だけが増え、中身の入る高さを奪っていた。
      // gap は行方向だけ高さに対して効くので、% のままでよい
      style={
        {
          "--sg-u": SIGNAGE_UNIT,
          paddingTop: `calc(${su(2.2)} + ${offset.y}px)`,
          paddingBottom: `calc(${su(2.2)} - ${offset.y}px)`,
          paddingLeft: `calc(${su(2.6)} + ${offset.x}px)`,
          paddingRight: `calc(${su(2.6)} - ${offset.x}px)`,
          fontFamily: SIGNAGE_FONT_FAMILY,
          fontFeatureSettings: '"palt"',
          fontWeight: 500,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

function CenteredMessage({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-1 items-center justify-center text-[#9aa0ae]"
      style={{ fontSize: su(2) }}
    >
      {children}
    </div>
  );
}

function Header({ fetchedAt, failure }: { fetchedAt: Date | null; failure: Failure | null }) {
  return (
    <header
      className="flex items-end justify-between border-b border-[#676f88]"
      // 1.04 は 16:9 のときの pb-[1.1%] と同じ値。% のままだと横長で下線だけが下がる
      style={{ paddingBottom: su(1.04) }}
    >
      <div>
        <div className="font-bold tracking-tight" style={{ fontSize: su(2.4) }}>
          CircleBoard
        </div>
        <div className="mt-1 text-[#8b93a4]" style={{ fontSize: MIN_FONT_SIZE }}>
          情報系学生サークル
        </div>
      </div>
      <div className="flex items-end" style={{ gap: su(2) }}>
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
    <div className="text-right leading-snug" style={{ fontSize: MIN_FONT_SIZE, maxWidth: su(26) }}>
      <div className="text-[#8b93a4]">最終更新 {formatClock(fetchedAt)}</div>
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
      <div
        className="font-mono font-bold leading-none tracking-tight"
        style={{ fontSize: su(3.6) }}
      >
        {formatClock(now)}
        {/* 秒を小さく添える。毎秒更新しているのに分単位の表示だと、
            画面が固まっているのか動いているのかが遠目に分からない。
            「動いている時計＝生きている画面」の証拠にならなかった(Issue #69) */}
        {/* 区切りを入れないと 02:46 と 01秒 が「02:461」に見える */}
        <span className="ml-[0.15em] text-[0.45em] font-normal text-[#8b93a4]">
          :{formatSeconds(now)}
        </span>
      </div>
      <div className="mt-[0.35em] text-[#8b93a4]" style={{ fontSize: MIN_FONT_SIZE }}>
        {formatToday(now)}
      </div>
    </div>
  );
}

function SectionTitle({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div
      className="flex items-center gap-[0.7em] font-bold tracking-[0.08em] text-[#9aa0ae]"
      // 0.85 は 16:9 のときの mb-[0.9%] と同じ値
      style={{ fontSize: MIN_FONT_SIZE, marginBottom: su(0.85) }}
    >
      <span className="h-[1.15em] w-[0.35em]" style={{ backgroundColor: color }} />
      {label}
      {/* 数字だけだと何の数か分からない。他の画面も「4件」「7件」と
          単位を付けている。数メートル離れて見る画面なので、なおさら
          読み替えを挟ませない(Issue #191) */}
      <span className="ml-auto font-normal text-[#8b93a4]">{count}件</span>
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
    <section className={"flex min-h-0 flex-col " + (grown ? "flex-1" : "flex-[1.75]")}>
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
  hero: su(7.0),
  normal: su(4.8),
  compact: su(3.2),
};

const TITLE_SIZE: Record<Density, string> = {
  hero: su(3.8),
  normal: su(3.2),
  compact: su(2.5),
};

// 行間も詰める。文字だけ小さくしても、間の余白が同じだと収まらない
const ROW_GAP: Record<Density, string> = {
  hero: "0.5em",
  normal: "0.5em",
  compact: "0.35em",
};

// 枠の内側の余白。% はカード幅に対して効くので、横長のディスプレイでは
// カードが広がるぶん上下の余白まで増え、2段組みで中身が入りきらなくなっていた。
// 値は 16:9 のときの 1.5% / 1% と同じ(hero はカード1枚が全幅なので倍率だけ違う)
const CARD_PADDING: Record<Density, string> = {
  hero: su(1.4),
  normal: su(0.7),
  compact: su(0.47),
};

// 1行しかない行は、既定の line-height(約1.5)だと文字の上下に無駄が出る。
// v2.2 では compact だけ詰めていたが、文字を大きくした v2.3 では
// hero・normal でも無駄が効くので、全段階に同じ値を効かせる
const CARD_LINE_HEIGHT = 1.15;

function EventCard({ event, density }: { event: SignageEvent; density: Density }) {
  return (
    <article
      // overflow-hidden で、万一中身が枠を越えても外へこぼさず切る(要望1のはみ出し対策)
      className="flex min-h-0 items-center justify-between gap-[2%] overflow-hidden rounded border border-[#676f88] bg-white/[0.03]"
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
              style={{ fontSize: MIN_FONT_SIZE, lineHeight: CARD_LINE_HEIGHT }}
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
            lineHeight: CARD_LINE_HEIGHT,
          }}
        >
          {formatStartsAt(event.starts_at)} ・ {event.location}
        </div>
        <h2
          className="truncate font-bold"
          style={{
            fontSize: TITLE_SIZE[density],
            marginTop: density === "compact" ? "0.25em" : "0.3em",
            lineHeight: CARD_LINE_HEIGHT,
          }}
        >
          {event.title}
        </h2>
        {/* 3〜4件のときはタグを出さない。最小フォントを 38px に上げた結果、
            残り日数・日時・タイトルで1枚の高さを使い切る。タグを残すと必ずはみ出す
            (docs/spec-signage-style-v2.md §1 案B) */}
        {density !== "compact" && event.tags.length > 0 && (
          <ul className="flex flex-wrap gap-[0.5em]" style={{ marginTop: ROW_GAP[density] }}>
            {event.tags.map((tag) => (
              // 長い名前でカードから溢れないよう、幅8em(全角8文字ぶん)で切る
              // (docs/spec-tags.md §3.3)。
              //
              // title はこの画面では効かない。誰も操作しないのでマウスを乗せる人がいない。
              // それでも付けるのは、仕様が画面を限定せずに「タグ要素に title を付ける」と
              // 定めているため。効かないことを理由に外すのは実装側の判断になる(PR #238 レビュー)
              <li
                key={tag.id}
                className="max-w-[8em] truncate rounded bg-[#2b2e3c] px-[0.6em] py-[0.2em]"
                style={{ fontSize: MIN_FONT_SIZE, lineHeight: CARD_LINE_HEIGHT }}
                title={tag.name}
              >
                {tag.name}
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* QRはフロントで生成する。サーバー生成だと60秒ごとに無駄な処理が走る
          (wireframe-signage.html「QRコード」)。中身は detail_url */}
      <CardQr value={event.detail_url} kind="event" />
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
    <article
      // overflow-hidden で、万一中身が枠を越えても外へこぼさず切る(要望1のはみ出し対策)
      className="flex min-h-0 items-center justify-between gap-[4%] overflow-hidden rounded border border-[#676f88] bg-white/[0.03]"
      // 0.46 は 16:9・3列のときの p-[1.5%] と同じ値
      style={{ padding: su(0.46) }}
    >
      <div className="min-w-0">
        <span
          // inline のままだと縦 padding(py) が行ボックスに反映されず、色付き背景だけが
          // 上下にはみ出してカードの枠を越えて見えていた。inline-block にして
          // padding を寸法として確保する(要望1)
          className="inline-block rounded px-[0.6em] py-[0.2em] font-bold"
          style={{
            fontSize: MIN_FONT_SIZE,
            lineHeight: CARD_LINE_HEIGHT,
            backgroundColor: project.status === "recruiting" ? "#4ade80" : "#5eb3f5",
            color: "#0f0f15",
          }}
        >
          {project.status === "recruiting" ? "募集中" : "進行中"}
        </span>
        {/* 3列だと1枚の幅が足りず、1行では名前がほぼ残らない。2行まで許す */}
        <h2
          className="mt-[0.4em] line-clamp-2 font-bold"
          style={{ fontSize: su(2.2), lineHeight: CARD_LINE_HEIGHT }}
        >
          {project.title}
        </h2>
        {/* 予定と人数を1行にまとめる。イベント枠に高さを回したぶん、
            プロジェクト枠は1行ぶん削る必要がある */}
        <div
          className="mt-[0.3em] truncate text-[#9aa0ae]"
          style={{ fontSize: MIN_FONT_SIZE, lineHeight: CARD_LINE_HEIGHT }}
        >
          {formatProjectMeta(project)}
        </div>
      </div>
      <CardQr value={project.detail_url} kind="project" />
    </article>
  );
}

// イベント・プロジェクトとも0件のとき。真っ黒な画面を出さない
function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-[2vh]">
      <div className="font-bold" style={{ fontSize: su(4.6) }}>
        CircleBoard
      </div>
      <p className="text-[#9aa0ae]" style={{ fontSize: su(2.8) }}>
        いま募集中の企画はありません
      </p>
      {/* カードではないので、幅は画面比(su)で決める。外周を白で囲む(要望3) */}
      <div className="rounded bg-white" style={{ width: su(16), padding: su(0.5) }}>
        <QRCodeSVG
          // 空なら、このサイネージを開いている URL をそのまま使う。
          // 部室の端末が LAN の IP で開いていれば、QR もその IP になる
          value={import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin}
          size={QR_RESOLUTION}
          bgColor="#ffffff"
          level="M"
          className="h-auto w-full"
        />
      </div>
      <p className="text-[#8b93a4]" style={{ fontSize: MIN_FONT_SIZE }}>
        企画の投稿はこちらから
      </p>
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

// 予定が無いプロジェクトもあるので、中黒だけが残らないようにする
function formatProjectMeta(project: SignageProject): string {
  const members = formatMembers(project);
  if (project.meeting_schedule === null) return members;

  return `${project.meeting_schedule} ・ ${members}`;
}

// capacity が null のときは無制限。「8 / null名」と出さない
function formatMembers(project: SignageProject): string {
  if (project.capacity === null) return project.participants_count + "名";
  return project.participants_count + " / " + project.capacity + "名";
}
