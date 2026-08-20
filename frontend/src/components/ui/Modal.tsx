import { Button } from "./Button";

// wireframe-admin-ver2.html の .modal-overlay / .modal-box に対応する。
//
// window.confirm を使わないのは、ブラウザの標準ダイアログだと
// 「何を消すのか」を1行しか書けず、取り返しのつかない操作の前に
// 十分な情報を出せないため。
export function Modal({
  title,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
  children,
}: {
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-[480px] rounded border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-[15px] font-bold">{title}</h2>
        <div className="text-[13px] leading-relaxed text-gray-700">{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            キャンセル
          </Button>
          <Button variant="dangerFill" size="sm" onClick={onConfirm} disabled={busy}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
