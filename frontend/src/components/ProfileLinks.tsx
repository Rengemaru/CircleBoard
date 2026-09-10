import { TextLink } from "smarthr-ui";
import type { ProfileLink } from "../types/user";

// プロフィールの外部リンク。名札(ProfileHeader)と本文の両方が使うので
// ファイルを分けた。片方だけ直すと、同じリンクが画面によって違う形で出る。
//
// inline-flex を当てているのは、Tailwind の preflight が svg を
// display: block にしているため。TextLink の「別タブで開く」アイコンが
// ブロックになり、そのままだとラベルの下に落ちてリンクが2行になる
// （実測 47x35px）。リンクを1つずつ確認したときに見つけた
export function ProfileLinks({ links }: { links: ProfileLink[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {links.map((link) => (
        // 画面に出すのはラベル。URL をそのまま出さない(docs/spec-my-page.md §6.2)。
        // noopener が無いと、開いた先から元のタブを操作できる
        <li key={link.id}>
          <TextLink
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
            size="S"
            className="inline-flex items-center"
          >
            {link.label}
          </TextLink>
        </li>
      ))}
    </ul>
  );
}
