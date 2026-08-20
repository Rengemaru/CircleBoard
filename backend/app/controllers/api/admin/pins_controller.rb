module Api
  module Admin
    class PinsController < ApplicationController
      before_action :require_login
      before_action :require_admin
      before_action :set_event

      # PUT /api/admin/events/:event_id/pin
      def update
        # 既存のピンを外してから新しいピンを立てる。**必ず同じトランザクション内**で行う。
        #
        # 順序を逆にすると、新しい行を true にした瞬間に部分ユニークインデックス
        # index_events_single_pinned に衝突する。実際に順序を入れ替えて確認した:
        #   PG::UniqueViolation: duplicate key value violates unique constraint
        #   "index_events_single_pinned"
        #
        # 「ピンは全体で1件」という運用ルールをアプリのif文ではなくDB制約で
        # 表現しているので、順序を守る責任がこちら側にある(spec-v2.2.md §2.2)
        Event.transaction do
          Event.where(pinned: true).where.not(id: @event.id).update_all(pinned: false)
          @event.update!(pinned: true)
        end

        render json: EventSerializer.new(@event, current_user: current_user, detail: true).as_json
      end

      # DELETE /api/admin/events/:event_id/pin
      def destroy
        # ピンが立っていなくても 204。「消えている」という結果は同じなので、
        # 呼び出し側が現在の状態を知らなくても使える
        @event.update!(pinned: false)
        head :no_content
      end

      private

      def set_event
        @event = Event.active.find_by(id: params[:event_id])
        return if @event

        render_error(:not_found, "イベントが見つかりません")
      end
    end
  end
end
