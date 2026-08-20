# 素のRubyクラス。gemは使わない(CLAUDE.md §4)。
#
# プロジェクトはイベントと違い、一覧・詳細ともログイン必須(docs/api-spec.md §3)。
# そのため owner は常に返る。それでも EventSerializer と同じく
# current_user を受け取る形にしてあるのは、出し分けが必要になったときに
# ここ1箇所だけを見ればよい状態を保つため(CLAUDE.md §3-2)。
#
# participants と current_user_joined は T2-7(参加申請・参加者一覧)の担当。
class ProjectSerializer
  def initialize(project, current_user: nil)
    @project = project
    @current_user = current_user
  end

  def as_json
    {
      id: @project.id,
      title: @project.title,
      description: @project.description,
      activity_schedule: @project.activity_schedule,
      meeting_schedule: @project.meeting_schedule,
      capacity: @project.capacity,
      # MVPでは参加は即時承認(status は 0:approved 固定)なので、
      # 絞らずに数える(仕様書 §2.6)
      participants_count: @project.project_participations.size,
      status: @project.status,
      owner: @project.owner && { id: @project.owner.id, name: @project.owner.name },
      tags: @project.tags.map { TagSerializer.new(_1).as_json }
    }
  end
end
