import { useState } from "react";
import { Button } from "./ui/Button";

// クリップボードにコピーするボタン。管理画面で発行した値を人に渡すために使う。
//
// navigator.clipboard は安全なコンテキスト(HTTPS または localhost)でしか
// 使えない。本番は Caddy が HTTPS を張るので通るが、失敗したときに
// 何も起きないと「押したのにコピーされていない」と気づけないため、
// 結果を必ず画面に出す。
export function CopyButton({ text, label = "コピー" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("copied");
    } catch {
      setState("failed");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button variant="ghost" size="xs" onClick={copy}>
        {label}
      </Button>
      {state === "copied" && <span className="text-[11px] text-green-700">コピーしました</span>}
      {state === "failed" && (
        <span className="text-[11px] text-red-700">コピーできません。手で選択してください</span>
      )}
    </span>
  );
}
