import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { TextLink } from "smarthr-ui";
import { escapeSubHeadings } from "../lib/markdown";

// 概要と自己紹介を Markdown として描く(Issue #303)。
//
// **rehype-raw を入れないこと。** react-markdown は既定で生の HTML を
// 無効にするので、<script> と書いても**ただの文字として表示される**。
// rehype-raw を足した瞬間に XSS の経路が開く。ここがこの機能で
// 一番大事な判断で、lint も型検査も検出してくれない。
//
// remark-gfm … 表・打ち消し線・自動リンク
// remark-breaks … **単一の改行を改行として出す**(オーナー決定 2026-09-13)。
//   CommonMark では段落内の単一改行はスペースに畳まれる。部員は Markdown の
//   仕様を知らずに書くので、そのままだと既存の文章が1行に潰れる。
const PLUGINS = [remarkGfm, remarkBreaks];

// 画像は出さない(オーナー決定)。大きさを指定できないので本文が崩れるのと、
// 外部の画像を読み込ませないため。alt ごと消える
const DISALLOWED = ["img"];

export function Markdown({ source }: { source: string }) {
  return (
    <div className="shr-markdown text-[13px] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={PLUGINS}
        disallowedElements={DISALLOWED}
        components={{
          // 外部サイトへ飛ばすので新しいタブで開く。
          // rel を付けないと、開いた先から window.opener を触れる
          a: ({ href, children }) => (
            <TextLink href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </TextLink>
          ),
          // **表とコードブロックは必ずはみ出す。** スマホでは特に。
          // それぞれの器で横スクロールさせ、ページ全体を横に伸ばさない
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-gray-300 bg-gray-50 px-2 py-1 text-left font-bold">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border border-gray-300 px-2 py-1">{children}</td>,
          // [&_code] で中の code の装飾を打ち消す。react-markdown は
          // ブロックのコードも pre > code で出すので、そのままだと
          // 灰色の箱が二重に重なる
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded bg-gray-100 p-3 text-[12px] [&_code]:bg-transparent [&_code]:p-0">
              {children}
            </pre>
          ),
          code: ({ children }) => (
            <code className="rounded bg-gray-100 px-1 py-0.5 text-[12px]">{children}</code>
          ),
          // 見出しは h1 だけ。## 以降は escapeSubHeadings が文字に変えている。
          // 節に分けて枠で囲む形は、使う側(企画の概要)で組み立てる
          h1: ({ children }) => (
            <h2 className="mt-5 mb-2 text-base font-bold first:mt-0">{children}</h2>
          ),
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
          blockquote: ({ children }) => (
            <blockquote className="my-2 border-l-4 border-gray-300 pl-3 text-gray-600">
              {children}
            </blockquote>
          ),
        }}
      >
        {escapeSubHeadings(source)}
      </ReactMarkdown>
    </div>
  );
}
