import { useEffect, useId, useRef } from "react";
import { Button } from "./Button";

// wireframe-admin-ver2.html の .modal-overlay / .modal-box に対応する。
//
// window.confirm を使わないのは、ブラウザの標準ダイアログだと
// 「何を消すのか」を1行しか書けず、取り返しのつかない操作の前に
// 十分な情報を出せないため。
//
// 取り消せない削除の確認に使うので、キーボードだけで操作しても
// 背後のボタンに移らないようにする(Issue #56)。
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
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  // 開く前にフォーカスしていた要素。閉じたらここへ戻す
  const openerRef = useRef<Element | null>(null);

  useEffect(() => {
    openerRef.current = document.activeElement;
    // 初期フォーカスはキャンセル側に置く。Enter を押しただけで
    // 取り返しのつかない操作が確定しないようにする。
    // Button は ref を受け取らないので、DOM から先頭のボタンを取る
    boxRef.current?.querySelector("button")?.focus();

    return () => {
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, []);

  // Esc で閉じ、Tab はダイアログの中で折り返す。
  // ダイアログの外に Tab が抜けると、見えているのに操作できない要素へ
  // フォーカスが移り、どこにいるのか分からなくなる
  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!busy) onCancel();

      return;
    }
    if (event.key !== "Tab") return;

    const focusable = boxRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
    if (focusable === undefined || focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    // オーバーレイのクリックでは閉じない。取り消せない操作の確認なので、
    // 背景を押したつもりで閉じてやり直しになるより、明示的に選ばせる
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onKeyDown={onKeyDown}
    >
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-[480px] rounded border border-gray-200 bg-white p-5"
      >
        <h2 id={titleId} className="mb-3 text-[15px] font-bold">
          {title}
        </h2>
        <div className="text-[13px] leading-relaxed text-gray-700">{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
            キャンセル
          </Button>
          {/* 確定側だけ aria-busy を付ける。キャンセルは押せないだけで処理中ではない */}
          <Button
            variant="dangerFill"
            size="sm"
            onClick={onConfirm}
            busy={busy}
            busyLabel="処理中…"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
