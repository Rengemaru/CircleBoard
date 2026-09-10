import { Cluster, Stack, Text } from "smarthr-ui";
import { Avatar } from "./ui/Avatar";
import { Chip } from "./ui/Chip";
import { ProfileLinks } from "./ProfileLinks";
import { PageHeading } from "./ui/PageHeading";
import { Panel } from "./ui/Panel";
import type { Profile } from "../types/user";

// プロフィールの先頭に置く名札(docs/spec-my-page.md §4.3)。
//
// これまでは名前が見出しにあるだけで、その下に「学科」「自己紹介」…と
// 定義リストが並んでいた。項目名の列が主で、その人の情報が従に見える。
//
// connpass のプロフィールは、先頭にアイコン・名前・所属・外部リンクを
// 1つの塊として置き、自己紹介やイベント一覧はその下に続く。
// **その並びだけを写す。** フォロー / 所属グループ / 発表数は、
// CircleBoard に対応する機能が無いので持ち込まない。
//
// 見出し(h1)は PageHeading のまま。document.title を書き換えるのが
// この部品で、自前の h1 にするとタブ名が前の画面のまま残る(PR #135)。
export function ProfileHeader({ profile }: { profile: Profile }) {
  return (
    <Panel>
      <Cluster align="center" gap={1}>
        <Avatar id={profile.id} name={profile.name} size="lg" />

        <Stack gap={0.5} className="min-w-0">
          <PageHeading title={profile.name} className="" />

          {/* 学科と学年は1行にまとめる。どちらも「その人が誰か」の手がかりで、
              項目名を立てて縦に並べるほどの分量ではない。
              学年はサーバーが出す(backend の User#grade)。卒業後は null で、
              代わりに「卒業生」と出す */}
          <ProfileMeta profile={profile} />

          {profile.tags.length > 0 && (
            <Cluster gap={0.5} as="ul">
              {profile.tags.map((tag) => (
                <li key={tag.id}>
                  <Chip>{tag.name}</Chip>
                </li>
              ))}
            </Cluster>
          )}

          {profile.links.length > 0 && <ProfileLinks links={profile.links} />}
        </Stack>
      </Cluster>
    </Panel>
  );
}

// 学科と学年の行。どちらも無いときは行ごと出さない。
// 空の行が残ると、読み込みに失敗したように見える
function ProfileMeta({ profile }: { profile: Profile }) {
  const department = profile.department ?? "";
  const grade = gradeLabel(profile);
  if (department === "" && grade === null) return null;

  return (
    <Text size="S" color="TEXT_GREY" leading="TIGHT" as="p">
      {department !== "" && grade !== null
        ? `${department} ・ ${grade}`
        : `${department}${grade ?? ""}`}
    </Text>
  );
}

// 学年、または卒業生。
//
// 学年は入学年度からの通算年数で決まり、年度末(3月31日)まで据え置いて
// 4月1日に繰り上がる。判定はすべてサーバー側(User#grade / #graduated?)で、
// ここは受け取ったものを出すだけ。年度の切り替わりの規則を画面側に持つと、
// RubyとTypeScriptに同じものが2本並ぶ。
//
// grade が null でも卒業とは限らない(入学年度が未来・10年目以降)。
// 当てずっぽうを出すより、その行を出さない方がよい
function gradeLabel(profile: Profile): string | null {
  if (profile.grade !== null) return profile.grade;

  return profile.graduated ? "卒業生" : null;
}
