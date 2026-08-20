module Api
  class ProjectParticipationsController < ApplicationController
    before_action :require_login
    before_action :set_project

    # POST /api/projects/:project_id/participation
    #
    # MVPでは即時承認。status は approved 固定で、approved_at に現在時刻を入れる
    # (docs/api-spec.md §3、docs/spec-v2.2.md §2.6)。
    # 承認フローは 🟡 DBだけの状態で、UIとロジックは作らない。
    def create
      return render_error(:unprocessable_entity, "すでに参加しています") if already_joined?
      return render_error(:unprocessable_entity, "定員に達しています") if @project.full?

      @project.project_participations.create!(
        user: current_user, status: :approved, approved_at: Time.current
      )
      render json: project_json, status: :created
    rescue ActiveRecord::RecordNotUnique
      # UNIQUE(project_id, user_id) が最後の砦。同時に2回押されても二重にならない
      render_error(:unprocessable_entity, "すでに参加しています")
    end

    private

    def set_project
      @project = Project.active.find_by(id: params[:project_id])
      return if @project

      render_error(:not_found, "プロジェクトが見つかりません")
    end

    def already_joined?
      @project.project_participations.exists?(user: current_user)
    end

    def project_json
      project = Project.active
                       .includes(:tags, :owner, project_participations: :user)
                       .find(@project.id)
      ProjectSerializer.new(project, current_user: current_user).as_json
    end
  end
end
