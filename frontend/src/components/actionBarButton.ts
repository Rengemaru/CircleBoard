// 企画詳細の固定バーに置くボタンの見た目（Issue #302）。
//
// SmartHR の採用ページ（open.talentio.com）の応募バーをそのまま再現する
// （オーナー決定 2026-09-13）。実際のページの計算済みスタイルを読んで測った値:
//
//   ボタン … 280 x 50px、#00C4CC、白の 20px 太字、角丸 4px
//   1024px 未満 … 幅いっぱい、高さ 40px（文字の大きさは変わらない）
//
// **#00C4CC は smarthr-ui の色ではありません。** smarthr-ui の primary は
// #0077C7 で、あちらは「プロダクトの操作」の青。#00C4CC は SmartHR の
// コーポレートのブランドカラーで、採用サイトなど「伝える面」で使われています。
// 採用ページの見た目を再現するという判断で、ここだけ体系の外に出ています。
//
// 上書きが効くのは、index.css を smarthr-ui.css より後に読んでいるため
// （main.tsx にその意図が書いてある）。!important は要らない。
//
// コンポーネントと同じファイルに置くと react-refresh の警告が出るので
// 別ファイルにしている（buttonVariant.ts と同じ理由。Issue #54）。

// バーに並ぶボタンの寸法。色は変えない。
// 「参加をキャンセル」「満員です」など、主操作の位置に出るが
// ターコイズにはしたくないものに使う
// 角丸を 4px に揃える。smarthr-ui の既定は 6px で、採用ページは 4px。
//
// **大きさだけは採用ページより小さくしている**（240x44px / 18px。
// 向こうは 280x50px / 20px。オーナー判断 2026-09-13）。
// 採用ページは「応募する」1つのためのページだが、こちらは
// 「編集」が隣に並ぶことがあり、使う回数も多い。
const SHAPE = "h-10 w-full rounded text-lg font-bold lg:h-11 lg:w-[240px]";

export const ACTION_BAR_BUTTON = SHAPE;

// 主操作。押させたいものだけに使う（参加する / ログインして参加）。
//
// disabled のときはターコイズを外す。処理中（busy）もここを通るので、
// 押せない状態が押せるように見えないようにする
export const ACTION_BAR_CTA = [
  SHAPE,
  "border-[#00C4CC] bg-[#00C4CC] text-white",
  "hover:border-[#00AFB6] hover:bg-[#00AFB6]",
  "disabled:border-gray-300 disabled:bg-gray-300 disabled:text-white",
].join(" ");
