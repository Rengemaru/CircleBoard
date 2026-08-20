module Api
  module Admin
    class EventsController < ApplicationController
      before_action :require_login
      before_action :require_admin

      # GET /api/admin/events
      #
      # ピン留め設定画面(wireframes/wireframe-admin.html A2)で使う。
      #
      # 公開APIを使い回さないのは、A2 が「score はこの画面にだけ表示する。
      # 一般ユーザーには見せない（数値が見えると、順位を上げるための操作を
      # 誘発するため）」と明記しているため。spotlight_score を
      # GET /api/events に足すと、その要求を破ることになる。
      #
      # 認可の出し分け(owner など)を含まないので、EventSerializer を
      # 使い回す必要はない。ここでしか使わない形をここで組み立てる。
      def index
        # 「対象イベント（開催前のみ表示）」。終わった企画をピン留めできても意味がない
        events = Event.spotlight_targets
                      .includes(:active_event_participations)
                      .order(pinned: :desc, spotlight_score: :desc, starts_at: :asc)

        render json: { events: events.map { serialize(_1) } }
      end

      private

      def serialize(event)
        {
          id: event.id,
          title: event.title,
          starts_at: event.starts_at.iso8601,
          location: event.location,
          participants_count: event.active_event_participations.size,
          spotlight_score: event.spotlight_score,
          pinned: event.pinned
        }
      end
    end
  end
end
