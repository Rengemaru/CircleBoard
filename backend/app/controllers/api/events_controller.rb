module Api
  class EventsController < ApplicationController
    before_action :require_login, only: [ :create, :update, :destroy ]
    before_action :set_event, only: [ :show, :update, :destroy ]
    before_action :require_owner_or_admin, only: [ :update, :destroy ]

    def index
      # includes はN+1対策。1件ずつ関連を引きに行かせない(CLAUDE.md §3-3)
      events = Event.active.includes(:tags, :owner, :active_event_participations)
      events = filter_by_status(events)
      events = filter_by_tag(events)

      render json: { events: events.map { EventSerializer.new(_1, current_user: current_user).as_json } }
    end

    def show
      render json: EventSerializer.new(@event, current_user: current_user, detail: true).as_json
    end

    def create
      # owner は current_user から設定する。リクエストの owner_id を信用しない
      # (docs/api-spec.md §2)。event_params でも許可していない
      tags = resolve_tags(tag_ids_param)
      return render_error(:unprocessable_entity, "存在しないタグが指定されています") if tags.nil?

      event = current_user.owned_events.new(event_params)
      event.tags = tags

      if event.save
        render json: EventSerializer.new(event, current_user: current_user, detail: true).as_json,
               status: :created
      else
        render_error(:unprocessable_entity, event.errors.full_messages.join("、"))
      end
    end

    def update
      tags = resolve_tags(tag_ids_param)
      return render_error(:unprocessable_entity, "存在しないタグが指定されています") if tags.nil?

      # タグの割り当ては保存済みレコードに対して即座に中間テーブルへ書き込まれる。
      # 本体の更新が失敗したときにタグだけ変わった状態が残らないよう、まとめて巻き戻す
      updated = false
      ActiveRecord::Base.transaction do
        @event.tags = tags if tag_ids_param
        updated = @event.update(event_params)
        raise ActiveRecord::Rollback unless updated
      end

      if updated
        render json: EventSerializer.new(@event, current_user: current_user, detail: true).as_json
      else
        render_error(:unprocessable_entity, @event.errors.full_messages.join("、"))
      end
    end

    def destroy
      # 論理削除。物理削除しない(docs/api-spec.md §2)
      @event.trashed!
      head :no_content
    end

    private

    # 既定は募集中のみ。終了イベントは表示しない
    # (wireframes/wireframe-member.html 画面② / docs/api-spec.md §2)。
    # 「過去の企画」セクションは MVP 対象外(CLAUDE.md §10)。
    # 未知の値を渡されたら既定に戻す。エラーにしないのは、URLを手で編集された
    # だけで画面が壊れるのを避けるため
    def filter_by_status(scope)
      status = params[:status]
      return scope.recruiting unless Event.statuses.key?(status)

      scope.where(status: status)
    end

    # 絞り込みは ?tag_id= で行い、URLで共有できる状態にする
    # (wireframes/wireframe-member.html 画面②)
    def filter_by_tag(scope)
      tag_id = params[:tag_id]
      return scope if tag_id.blank?

      scope.joins(:event_tags).where(event_tags: { tag_id: tag_id })
    end

    def set_event
      @event = Event.active
                    .includes(:tags, :owner, active_event_participations: :user)
                    .find_by(id: params[:id])
      return if @event

      # 論理削除済みは 403 ではなく 404。存在を隠したいものは404を返す
      # (docs/api-spec.md §0)。403だと「消されたイベントがある」と分かってしまう
      render_error(:not_found, "イベントが見つかりません")
    end

    def require_owner_or_admin
      return if owner_or_admin?(@event)

      render_error(:forbidden, "この企画を編集する権限がありません")
    end

    # tag_ids は T2-5(タグ付け)の担当なのでここでは受け取らない。
    # owner_id を許可しないのは、リクエストで他人を owner にできてしまうため
    def tag_ids_param
      params.dig(:event, :tag_ids)
    end

    def event_params
      params.require(:event).permit(
        :title, :description, :location, :starts_at, :capacity, :external_url
      )
    end
  end
end
