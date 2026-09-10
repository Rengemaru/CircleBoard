import { Container } from "smarthr-ui";
import { SiteHeader } from "./SiteHeader";
import type { CurrentUser } from "../api/session";

// メンバー画面の外枠。ヘッダーと本文の幅・余白をここ1箇所で決める。
//
// 各ページが自前で <main className="mx-auto max-w-3xl …"> を書いていると、
// 画面ごとに余白がずれる（実際に p-6 と px-6 py-6 が混在していた）。
//
// width="narrow" はログインと企画作成のようなフォーム1枚の画面用。
// 入力欄が画面幅いっぱいに伸びると、どこを読めばよいのか分からなくなる。
export function MemberPage({
  user,
  width = "wide",
  sessionFailed = false,
  children,
}: {
  user: CurrentUser | null;
  width?: "wide" | "narrow";
  // ログイン状態を確かめられなかったとき。未ログインとは区別する(Issue #72)
  sessionFailed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader user={user} sessionFailed={sessionFailed} />
      {/* 幅と余白は Container に決めてもらう。既定のパディングが
          SmartHR の基準（デスクトップ 2=32px、モバイルは上下 1.5・左右 1）と
          同じなので、画面側で書かなくて済む(Issue #143) */}
      <main>
        <Container size={width === "narrow" ? "NARROW" : "DEFAULT"}>{children}</Container>
      </main>
    </>
  );
}
