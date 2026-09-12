# アプリ内通知1件分(Issue #292)。
#
# type を持たせるのは、あとから種類が増えても形を変えずに済ませるため。
# いま判断待ちになるのは脱退申請だけだが、参加申請を有効にしたときなどの
# 行き先がここになる。
#
# **これ自体は「誰に見せてよいか」を判断しない。** 絞り込みは
# NotificationsController 側にある(CLAUDE.md §3-2)。
class NotificationSerializer
  def initialize(participation)
    @participation = participation
  end

  def as_json
    {
      type: "project_withdrawal",
      id: @participation.id,
      project: {
        id: @participation.project.id,
        title: @participation.project.title
      },
      # 退会で user は nil になりうる(ON DELETE SET NULL)
      user: @participation.user && UserCardSerializer.new(@participation.user).as_json,
      requested_at: @participation.withdrawal_requested_at.iso8601
    }
  end
end
