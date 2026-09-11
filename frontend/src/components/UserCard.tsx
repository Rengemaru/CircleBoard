import { Link } from "react-router-dom";
import { Text, TextLink } from "smarthr-ui";
import { Avatar } from "./ui/Avatar";
import type { UserCard as UserCardData } from "../types/event";

// 参加者・主催に出す1人分のカード(Issue #214)。
//
// もとは名前のリンクが1つ並んでいるだけで、周りの「開催日時」「残り枠」や
// 概要に比べて明らかに薄かった。誰がいるのかを見に来た人に対して、
// 名前以外の手がかりが何も無い。
//
// 出すのはアイコン・名前・呼ばれ方・学科の4つ。connpass の参加者一覧も
// この並びで、それ以上は詳細(プロフィール)に置いている。
//
// **参加数は出さない。** 他人に「誰がどこに参加しているか」が見えるのは
// docs/spec-my-page.md §4.3 で意図的に外した判断。
//
// 押せるのは名前だけにする。カード全体をリンクにすると、呼ばれ方や学科まで
// 下線が付いて、どこが行き先なのか読み取りにくくなる。
export function UserCard({ user, note }: { user: UserCardData; note?: string }) {
  return (
    // inline-flex にして内容の幅に収める。block のままだと、参加者の一覧
    // (flex の子)では縮むのに、主催のように単独で置いた場所では幅いっぱいに
    // 伸びて、1人しかいないのに横長の箱になる
    <div className="inline-flex min-w-0 items-center gap-2 rounded border border-gray-200 bg-white px-2.5 py-2 align-top">
      <Avatar id={user.id} name={user.name} />

      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-1.5">
          <TextLink elementAs={Link} to={`/users/${user.id}`} size="S">
            {user.name}
          </TextLink>
          {/* 主催であることなど、その企画の中での役割。カードの外から渡す */}
          {note !== undefined && (
            <Text size="S" color="TEXT_GREY">
              {note}
            </Text>
          )}
        </div>

        {/* 呼ばれ方と学科は1行にまとめる。2行にすると、参加者が10人いる
            画面で縦が伸びすぎる。どちらも空なら行ごと出さない */}
        {subtitle(user) !== null && (
          <Text size="S" color="TEXT_GREY" leading="TIGHT" as="p">
            {subtitle(user)}
          </Text>
        )}
      </div>
    </div>
  );
}

function subtitle(user: UserCardData): string | null {
  // 空文字はサーバー側で nil に寄せているが、寄せる前に保存された行も
  // 未入力として扱う
  const parts = [user.pronouns, user.department].filter(
    (value): value is string => value !== null && value !== "",
  );

  return parts.length === 0 ? null : parts.join(" ・ ");
}
