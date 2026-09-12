module Api
  class EventParticipationsController < ApplicationController
    before_action :require_login
    before_action :set_event

    # POST /api/events/:event_id/participation
    def create
      # owner は参加表明できない(Issue #307)。プロジェクトと揃える
      if @event.owner_id == current_user.id
        return render_error(:unprocessable_entity, "主催者は参加表明できません")
      end

      # **終了したイベントには参加させない。** 画面には「終了」と出ているのに
      # 参加表明できていた(Issue #307)。
      #
      # **開催日時では判定しない。** 「開催日が過ぎたのに募集中のまま」は
      # 実際に起きる状態として許容している(spec/factories/events.rb の注記、
      # 一覧の upcoming もサイネージもその前提)。弾くのは
      # 「終了」と明示されたものだけにする
      return render_error(:unprocessable_entity, "終了したイベントには参加できません") if @event.completed?

      return render_error(:unprocessable_entity, "すでに参加しています") if already_joined?
      # 満員判定は必ずサーバー側で行う(docs/api-spec.md §2)。
      # フロントのボタン非表示は表示の話であって制限ではない
      return render_error(:unprocessable_entity, "定員に達しています") if @event.full?

      @event.event_participations.create!(user: current_user)
      render json: event_json, status: :created
    rescue ActiveRecord::RecordNotUnique
      # 同時に2回押されたときは部分ユニークインデックスが弾く。
      # アプリ層のチェックをすり抜けても二重参加にはならない
      render_error(:unprocessable_entity, "すでに参加しています")
    end

    # DELETE /api/events/:event_id/participation
    def destroy
      participation = @event.event_participations.active.find_by(user: current_user)
      return render_error(:not_found, "このイベントに参加していません") if participation.nil?

      # 物理削除しない。注目スコアの集計に使う(docs/api-spec.md §2、仕様書 §2.5)
      participation.update!(cancelled_at: Time.current)
      head :no_content
    end

    private

    def set_event
      @event = Event.active.find_by(id: params[:event_id])
      return if @event

      render_error(:not_found, "イベントが見つかりません")
    end

    def already_joined?
      @event.event_participations.active.exists?(user: current_user)
    end

    # 参加した直後の状態をそのまま返す。詳細APIと同じ形なので、
    # フロントは再取得せずに画面を更新できる
    def event_json
      event = Event.active
                   .includes(:tags, :owner, active_event_participations: :user)
                   .find(@event.id)
      EventSerializer.new(event, current_user: current_user, detail: true).as_json
    end
  end
end
