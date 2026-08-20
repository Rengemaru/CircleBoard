module Api
  class SignagesController < ApplicationController
    before_action :require_signage_token

    # GET /api/signage?token=xxx
    #
    # サイネージ画面が必要とするデータを1リクエストで返す(docs/api-spec.md §5)。
    # 60秒ごとに叩かれるため、リクエスト数を最小化する。
    def show
      render json: {
        spotlight_events: spotlight_events.map { EventSerializer.new(_1, signage: true).as_json },
        projects: projects.map { ProjectSerializer.new(_1, signage: true).as_json }
      }
    end

    private

    # サイネージは「トークン認証は通っているが current_user は nil」という状態
    # (docs/api-spec.md §0)。ここを混同すると事故る。
    # current_user を設定しないので、シリアライザ側で owner が自動的に落ちる
    def require_signage_token
      return if SignageToken.valid.exists?(token: params[:token])

      # 401 ではなく 404。トークンの存在有無を推測させないため(§0)
      render_error(:not_found, "見つかりません")
    end

    SPOTLIGHT_EVENTS_LIMIT = 4
    PROJECTS_LIMIT = 6

    # ピン留めが常に先頭 → 残りは spotlight_score 降順。
    # 除外条件(過去 / completed / trashed)は spotlight_targets が持っている
    def spotlight_events
      Event.spotlight_targets
           .includes(:tags)
           .order(pinned: :desc, spotlight_score: :desc, starts_at: :asc)
           .limit(SPOTLIGHT_EVENTS_LIMIT)
    end

    # recruiting → in_progress の順。completed は除外。
    # プロジェクトに注目スコアは使わない。開催日が無く締切感が存在しないため、
    # スコアの主成分(開催間近ボーナス)が機能しない(wireframe-signage.html)
    def projects
      Project.active
             .where(status: [ :recruiting, :in_progress ])
             .includes(:tags, :project_participations)
             .order(:status, :created_at)
             .limit(PROJECTS_LIMIT)
    end
  end
end
