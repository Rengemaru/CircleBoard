// wireframe-admin-ver2.html の .admin-topbar-title / .admin-topbar-sub に対応する。
//
// 管理画面ではトップバーが持っている「画面名 + その画面で何ができるか」を、
// メンバー画面では本文の先頭に置く。member 用のワイヤーフレームは無いので、
// 管理画面と同じ字送り・同じ大きさを使う(docs/instructions.md T7-5)。
export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  // 見出し行の右端に置く主操作（例: 「＋ イベントを作成」）
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div>
        <h1 className="text-base font-bold">{title}</h1>
        {subtitle !== undefined && <p className="mt-px text-xs text-gray-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
