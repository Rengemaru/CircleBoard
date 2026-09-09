// タグを出す小さな枠と、絞り込みに使う押せる版。
//
// Badge と分けているのは役割が違うため。Badge は状態（募集中・終了・停止中）を
// 色で示すもので、色に意味がある。こちらはタグや絞り込みの選択肢で、
// 色は付けず、選ばれているかどうかだけを反転で示す。
export function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600">
      {children}
    </span>
  );
}

// 一覧の絞り込みと、企画作成のタグ選択で使う。
// 見た目は wireframe-admin-ver2.html の .wf-btn.sm に合わせ、
// 選択中は primary と同じ反転にする
export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded border-[1.5px] px-[10px] py-1 text-xs font-semibold ${
        active
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-300 bg-white text-gray-600 hover:border-gray-900 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}
