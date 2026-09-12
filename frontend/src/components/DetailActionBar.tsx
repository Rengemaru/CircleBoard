import { useEffect } from "react";

// 企画詳細の操作を、画面下端に固定してまとめる（Issue #302）。
//
// もとは「編集」が見出しと開催日時の間に挟まっていて、情報 → 操作 → 情報 と
// 切り替わっていた。利用者から「イベント情報と同列であるのか UX としてどうなの」
// という指摘を受けた形。
//
// **SmartHR の採用ページ（open.talentio.com）の応募バーを再現している**
// （オーナー決定 2026-09-13）。実際のページの計算済みスタイルを読んで測った値:
//
//   position … fixed（sticky ではない。末尾でも定位置に収まらない）
//   大きさ  … 画面幅いっぱい x 100px（1024px 未満では 72px）
//   背景    … rgba(51, 51, 51, 0.87)。ぼかしは無し
//   中身    … ボタンを中央に置く
//
// **最初は smarthr-ui の `FloatArea` を使っていたが、外した。**
// あれは中身が `Panel`（白・角丸・影）の sticky で、本文幅に収まる。
// 上の4点はどれも合わず、全部 Tailwind で打ち消すことになる。
// 素の div を1枚書く方が、何が起きているかを読んで追える。
//
// **濃い色で半透明にするのが肝。** 白いバーだとページに並ぶ Panel と同じ色で、
// 本文の続きに見えて、固定されていることが伝わらなかった。
// 濃い膜が掛かると「上に重なっている」ことが見て分かる。
//
// z-index は 100。smarthr-ui が固定メニューに使う値と同じで、
// ダイアログ（10000 以上）より下。モーダルを開いたときにバーが手前に出ない。
export function DetailActionBar({
  primary,
  secondary,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
}) {
  // 主操作が無い状態（セッション確認中など）ではバーごと出さない。
  // 空のバーが画面下端に居座ると、何を待てばよいのか分からない
  const visible = primary !== null;

  // **バーの高さぶん、ページの一番下に余白を作る。**
  //
  // fixed は文書の流れから外れるので、何もしないとフッターがバーの下に入り、
  // 利用規約へのリンクが**押せなくなる**（実際に重なるのを確認した）。
  //
  // 本文の中に同じ高さの箱を置く形では届かない。フッターは本文の外側
  // (MemberLayout)にあり、箱はその手前にしか入らないため。
  // 採用ページは下に長いフッターがあるのでこれが要らない。
  useEffect(() => {
    if (!visible) return;

    const SPACE = ["pb-[72px]", "lg:pb-[100px]"];
    document.body.classList.add(...SPACE);

    return () => document.body.classList.remove(...SPACE);
  }, [visible]);

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] flex h-[72px] items-center justify-center gap-4 bg-[rgba(51,51,51,0.87)] px-4 lg:h-[100px]">
      {secondary}
      {primary}
    </div>
  );
}
