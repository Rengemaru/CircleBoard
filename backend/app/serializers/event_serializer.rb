# 仕様書 §4.2 のコードを土台にした素のRubyクラス。gemは使わない。
#
# このクラスが「誰に何を見せるか」の唯一の判断場所。一覧APIも詳細APIも
# サイネージもこのクラスを通す(CLAUDE.md §3-2)。片方だけ塞いで漏れる事故を
# 構造的に起こせなくするため、詳細用に別クラスを作らず detail: で切り替える。
#
#   base                       … 常に返す
#   owner                      … ログイン時のみ(一覧・詳細とも)
#   participants               … ログイン時 かつ detail: true のときのみ
#   current_user_joined
class EventSerializer
  def initialize(event, current_user: nil, detail: false, signage: false)
    @event = event
    @current_user = current_user
    @detail = detail
    @signage = signage
  end

  def as_json
    # サイネージは返すキーの集合が違う(docs/api-spec.md §5)。
    # days_until / pinned / detail_url を足し、capacity や status は載せない。
    # 別クラスにせずここに置いているのは、owner の出し分けを2箇所で
    # 管理しないため(CLAUDE.md §3-2、instructions.md T3-4)
    return signage_json if @signage

    base = {
      id: @event.id,
      title: @event.title,
      description: @event.description,
      location: @event.location,
      starts_at: @event.starts_at.iso8601,
      capacity: @event.capacity,
      # active_event_participations は includes 済みなので追加SQLが飛ばない。
      # ここを event_participations.active.size にすると N+1 になる(Event モデル参照)
      participants_count: @event.active_event_participations.size,
      status: @event.status,
      # トップページの📌バッジに使う。サイネージでも公開している情報なので
      # 未ログインでも返す。一方 spotlight_score は返さない
      # (wireframes/wireframe-admin.html A2「一般ユーザーには見せない」)
      pinned: @event.pinned,
      external_url: @event.external_url,
      tags: @event.tags.map { TagSerializer.new(_1).as_json }
    }

    # 未ログインならここで返す。owner キーごと存在しない
    return base unless signed_in?

    with_owner = base.merge(
      owner: @event.owner && { id: @event.owner.id, name: @event.owner.name }
    )
    return with_owner unless @detail

    with_owner.merge(
      participants: participants,
      current_user_joined: current_user_joined?
    )
  end

  private

  # サイネージは「トークン認証は通っているが current_user は nil」の状態で呼ばれる。
  # owner も participants もそもそも組み立てないので、漏れようがない
  def signage_json
    {
      id: @event.id,
      title: @event.title,
      starts_at: @event.starts_at.iso8601,
      days_until: (@event.starts_at.to_date - Date.current).to_i,
      location: @event.location,
      description: @event.description,
      tags: @event.tags.map { TagSerializer.new(_1).as_json },
      pinned: @event.pinned,
      detail_url: SignageUrl.for("events", @event.id)
    }
  end

  def signed_in? = @current_user.present?

  # キャンセル済みは含めない。user は退会で nil になりうる(ON DELETE SET NULL)
  def participants
    @event.active_event_participations.filter_map do |participation|
      participation.user && { id: participation.user.id, name: participation.user.name }
    end
  end

  # 読み込み済みの配列から数えるので追加SQLが飛ばない
  def current_user_joined?
    @event.active_event_participations.any? { |p| p.user_id == @current_user.id }
  end
end
