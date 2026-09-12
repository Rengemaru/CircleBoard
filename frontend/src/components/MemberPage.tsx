import type { ComponentProps } from "react";
import { Container } from "smarthr-ui";
import { SiteHeader } from "./SiteHeader";
import type { SessionState } from "../hooks/useCurrentUser";

// メンバー画面の外枠。ヘッダーと本文の幅・余白をここ1箇所で決める。
//
// 各ページが自前で <main className="mx-auto max-w-3xl …"> を書いていると、
// 画面ごとに余白がずれる（実際に p-6 と px-6 py-6 が混在していた）。
//
// size="NARROW" はログインのようなフォーム1枚の画面用。
// 入力欄が画面幅いっぱいに伸びると、どこを読めばよいのか分からなくなる。
// size="WIDE" は列の多い表の画面用(docs/spec-layout-unification.md §5)。
//
// ログイン状態は user だけを抜き出さず、hook の返り値をそのまま渡す。
// 画面ごとに user={null} と sessionFailed を組み立てていたときは、
// 読み込み中の分岐が user={null} だけを渡していたため、ヘッダーからは
// 未ログインと区別が付かず「ログイン」ボタンが一瞬出ていた(Issue #184)。
// 3つまとめて渡す形にすると、渡し忘れが起こせない
export function MemberPage({
  session,
  size = "DEFAULT",
  hideNav = false,
  children,
}: {
  session: SessionState;
  size?: ComponentProps<typeof Container>["size"];
  // パスワード変更の強制画面だけが使う(Issue #288)。詳細は SiteHeader
  hideNav?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader session={session} hideNav={hideNav} />
      {/* 幅と余白は Container に決めてもらう。既定のパディングが
          SmartHR の基準（デスクトップ 2=32px、モバイルは上下 1.5・左右 1）と
          同じなので、画面側で書かなくて済む(Issue #143) */}
      <main>
        <Container size={size}>{children}</Container>
      </main>
    </>
  );
}
