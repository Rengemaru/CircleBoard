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
  children,
}: {
  user: CurrentUser | null;
  width?: "wide" | "narrow";
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader user={user} />
      <main className={`mx-auto px-6 py-6 ${width === "narrow" ? "max-w-md" : "max-w-3xl"}`}>
        {children}
      </main>
    </>
  );
}
