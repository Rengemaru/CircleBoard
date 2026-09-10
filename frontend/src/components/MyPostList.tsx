import { Link } from "react-router-dom";
import { Cluster, Text, TextLink } from "smarthr-ui";
import { Badge } from "./ui/Badge";
import { Chip } from "./ui/Chip";
import { formatCountdown } from "../lib/countdown";
import type { EventSummary } from "../types/event";
import type { ProjectSummary } from "../types/project";

// マイページの「自分の企画」(docs/spec-my-page.md §4.1)。
//
// イベントとプロジェクトを1つの表に混ぜず、種類ごとに並べる。
// 用語の区別(CLAUDE.md §9)がこの画面でも意味を持つ。単発のイベントには
// 開催日があり、継続するプロジェクトには無い。混ぜると日付欄が半分空く。
//
// 種類は Chip、状態は Badge。1つのオブジェクトに StatusLabel を
// 2つ付けないという使い分けに合わせている(Badge.tsx 参照)。
// イベントは募集中のものしか一覧APIが返さないので、状態ではなく
// 残り日数を出す。そちらの方が「次に何があるか」が分かる
type Props = {
  events: EventSummary[];
  projects: ProjectSummary[];
};

const PROJECT_STATUS = {
  recruiting: { tone: "recruiting", label: "募集中" },
  in_progress: { tone: "inprogress", label: "進行中" },
  completed: { tone: "completed", label: "終了" },
} as const;

export function MyPostList({ events, projects }: Props) {
  if (events.length === 0 && projects.length === 0) {
    return (
      <Text size="S" color="TEXT_GREY">
        いま募集中の企画はありません。
      </Text>
    );
  }

  return (
    <ul className="divide-y divide-gray-200">
      {events.map((event) => (
        <Row
          key={`event-${event.id}`}
          to={`/events/${event.id}`}
          kind="イベント"
          title={event.title}
          // 開催日そのものではなく残り日数。他の画面と同じ書式を使う
          right={
            <Text size="S" color="TEXT_GREY">
              {formatCountdown(event.starts_at)}
            </Text>
          }
        />
      ))}
      {projects.map((project) => (
        <Row
          key={`project-${project.id}`}
          to={`/projects/${project.id}`}
          kind="プロジェクト"
          title={project.title}
          right={
            <Badge tone={PROJECT_STATUS[project.status].tone}>
              {PROJECT_STATUS[project.status].label}
            </Badge>
          }
        />
      ))}
    </ul>
  );
}

function Row({
  to,
  kind,
  title,
  right,
}: {
  to: string;
  kind: string;
  title: string;
  right: React.ReactNode;
}) {
  return (
    <li className="py-2.5">
      <Cluster align="center" justify="space-between" gap={1}>
        <Cluster align="center" gap={0.75}>
          <Chip>{kind}</Chip>
          <TextLink elementAs={Link} to={to} size="S">
            {title}
          </TextLink>
        </Cluster>
        {right}
      </Cluster>
    </li>
  );
}
