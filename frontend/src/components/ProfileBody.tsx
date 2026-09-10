import { DefinitionList, DefinitionListItem, Cluster, Text, TextLink } from "smarthr-ui";
import { Chip } from "./ui/Chip";
import type { Profile } from "../types/user";

// プロフィールの中身(docs/spec-my-page.md §4.1、§4.3)。
//
// マイページと他人のプロフィールで同じ部品を使う。別々に書くと、
// 項目を1つ足したときに片方だけ古い形のまま残る。
//
// 見せてよいかどうかの判断はここでしない。サーバーが返した Profile を
// そのまま出す。email を落とすのは ProfileSerializer の仕事(CLAUDE.md §3-2)。

type Props = {
  profile: Profile;
  // 何も書かれていないときの案内。自分の画面では「書くと何が起きるか」を
  // 出せるが、他人の画面では書けるのは本人だけなので文言が変わる
  emptyMessage: string;
};

export function ProfileBody({ profile, emptyMessage }: Props) {
  // 空欄を4つ並べない。何も書いていない人には、書くと何が起きるかを出す
  // (Issue #53 と同じ考え方)
  if (isEmpty(profile)) {
    return (
      <Text size="S" color="TEXT_GREY">
        {emptyMessage}
      </Text>
    );
  }

  return (
    <DefinitionList>
      <DefinitionListItem term="学科" maxColumns={1}>
        {profile.department ?? "—"}
      </DefinitionListItem>
      <DefinitionListItem term="自己紹介" maxColumns={1}>
        {/* 改行はそのまま出すが、HTML としては解釈しない(React が既定でエスケープする) */}
        <span className="whitespace-pre-wrap">{profile.bio ?? "—"}</span>
      </DefinitionListItem>
      <DefinitionListItem term="使える技術" maxColumns={1}>
        {profile.tags.length === 0 ? (
          "—"
        ) : (
          <Cluster gap={0.5}>
            {profile.tags.map((tag) => (
              <Chip key={tag.id}>{tag.name}</Chip>
            ))}
          </Cluster>
        )}
      </DefinitionListItem>
      <DefinitionListItem term="リンク" maxColumns={1}>
        {profile.links.length === 0 ? "—" : <ProfileLinks profile={profile} />}
      </DefinitionListItem>
    </DefinitionList>
  );
}

// リンクの並びは箇条書きなので ul/li で出す。
//
// inline-flex を当てているのは、Tailwind の preflight が svg を
// display: block にしているため。TextLink の「別タブで開く」アイコンが
// ブロックになり、そのままだとラベルの下に落ちてリンクが2行になる
// （実測 47x35px）。リンクを1つずつ確認したときに見つけた
function ProfileLinks({ profile }: { profile: Profile }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {profile.links.map((link) => (
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

// 4項目すべてが未入力かどうか。department と bio は API が null で返すが、
// 画面から空文字が入ることもあるので両方を空として扱う
function isEmpty(profile: Profile): boolean {
  return (
    (profile.department ?? "") === "" &&
    (profile.bio ?? "") === "" &&
    profile.tags.length === 0 &&
    profile.links.length === 0
  );
}
