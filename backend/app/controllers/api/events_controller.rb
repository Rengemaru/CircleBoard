module Api
  class EventsController < ApplicationController
    def index
      # includes はN+1対策。1件ずつ関連を引きに行かせない(CLAUDE.md §3-3)
      events = Event.active.includes(:tags, :owner, :active_event_participations)
      render json: { events: events.map { EventSerializer.new(_1, current_user: current_user).as_json } }
    end

    private

    # 認証は T2-1 で実装する。それまでは常に未ログイン扱い。
    def current_user = nil
  end
end
