# 素のRubyクラス。gemは使わない(CLAUDE.md §4)。
#
# プロジェクトはイベントと違い、一覧・詳細ともログイン必須(docs/api-spec.md §3)。
# そのため owner は常に返る。それでも EventSerializer と同じく
# current_user を受け取る形にしてあるのは、出し分けが必要になったときに
# ここ1箇所だけを見ればよい状態を保つため(CLAUDE.md §3-2)。
#
class ProjectSerializer
  def initialize(project, current_user: nil, signage: false)
    @project = project
    @current_user = current_user
    @signage = signage
  end

  def as_json
    return signage_json if @signage

    base = {
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
      tags: @project.tags.map { TagSerializer.new(_1).as_json }
    }

    # current_user が nil なら owner と参加者一覧を落とす。
    # 通常のAPIはログイン必須なので nil にならないが、サイネージが
    # current_user: nil で通る(docs/api-spec.md §5)。
    # EventSerializer と同じ形にしておくことで、サイネージ専用の
    # シリアライザを作らずに済む(CLAUDE.md §3-2)
    return base unless signed_in?

    base.merge(
      owner: @project.owner && { id: @project.owner.id, name: @project.owner.name },
      participants: participants,
      current_user_joined: current_user_joined?
    )
  end

  private

  # 返すキーの集合は docs/api-spec.md §5 に合わせる。
  # description や activity_schedule は載せない（サイネージの枠に入らない）
  def signage_json
    {
      id: @project.id,
      title: @project.title,
      status: @project.status,
      participants_count: @project.project_participations.size,
      capacity: @project.capacity,
      meeting_schedule: @project.meeting_schedule,
      tags: @project.tags.map { TagSerializer.new(_1).as_json },
      detail_url: SignageUrl.for("projects", @project.id)
    }
  end

  def signed_in? = @current_user.present?

  # user は退会で nil になりうる(ON DELETE SET NULL)
  def participants
    @project.project_participations.filter_map do |participation|
      participation.user && { id: participation.user.id, name: participation.user.name }
    end
  end

  # 読み込み済みの配列から数えるので追加SQLが飛ばない
  def current_user_joined?
    return false if @current_user.nil?

    @project.project_participations.any? { |p| p.user_id == @current_user.id }
  end
end
