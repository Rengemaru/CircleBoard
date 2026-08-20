module Api
  class EventsController < ApplicationController
    before_action :require_login, only: [ :create, :update, :destroy ]
    before_action :set_event, only: [ :show, :update, :destroy ]
    before_action :require_owner_or_admin, only: [ :update, :destroy ]

    def index
      # includes はN+1対策。1件ずつ関連を引きに行かせない(CLAUDE.md §3-3)
      events = Event.active.includes(:tags, :owner, :active_event_participations)
      render json: { events: events.map { EventSerializer.new(_1, current_user: current_user).as_json } }
    end

    def show
      render json: EventSerializer.new(@event, current_user: current_user, detail: true).as_json
    end

    def create
      # owner は current_user から設定する。リクエストの owner_id を信用しない
      # (docs/api-spec.md §2)。event_params でも許可していない
      event = current_user.owned_events.new(event_params)

      if event.save
        render json: EventSerializer.new(event, current_user: current_user, detail: true).as_json,
               status: :created
      else
        render_error(:unprocessable_entity, event.errors.full_messages.join("、"))
      end
    end

    def update
      if @event.update(event_params)
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
    def event_params
      params.require(:event).permit(
        :title, :description, :location, :starts_at, :capacity, :external_url
      )
    end
  end
end
