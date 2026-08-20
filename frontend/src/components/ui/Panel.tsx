// wireframe-admin-ver2.html の .admin-panel / .admin-panel-title に対応する。
export function Panel({
  title,
  action,
  className = "",
  children,
}: {
  title?: string;
  // タイトル行の右端に置くボタン（例: ⑥「ピン留めを解除」）
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`mb-4 rounded border border-gray-200 bg-white p-5 ${className}`}>
      {title !== undefined && (
        <h2 className="mb-3.5 flex items-center justify-between border-b border-gray-200 pb-2.5 text-sm font-bold">
          {title}
          {action}
        </h2>
      )}
      {children}
    </section>
  );
}
