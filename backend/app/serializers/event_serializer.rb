# 仕様書 §4.2 のコードを土台にした素のRubyクラス。gemは使わない。
#
# このクラスが「誰に何を見せるか」の唯一の判断場所。一覧APIも詳細APIも
# サイネージもこのクラスを通す(CLAUDE.md §3-2)。片方だけ塞いで漏れる事故を
# 構造的に起こせなくするため。
class EventSerializer
  def initialize(event, current_user: nil)
    @event = event
    @current_user = current_user
  end

  def as_json
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
      external_url: @event.external_url,
      tags: @event.tags.map { |t| { id: t.id, name: t.name } }
    }

    # 未ログインならここで返す。owner キーごと存在しない
    return base unless signed_in?

    base.merge(
      owner: @event.owner && { id: @event.owner.id, name: @event.owner.name }
    )
  end

  private

  def signed_in? = @current_user.present?
end
