module Api
  class ProjectsController < ApplicationController
    # イベントと違い、一覧・詳細もログイン必須(docs/api-spec.md §3)。
    # プロジェクトは継続的に成果物を作る活動で、参加者や進行状況が
    # 部外者に見える必要がないため
    before_action :require_login
    before_action :set_project, only: [ :show, :update, :destroy ]
    before_action :require_owner_or_admin, only: [ :update, :destroy ]

    def index
      projects = Project.active.includes(:tags, :owner, :project_participations)
      render json: { projects: projects.map { ProjectSerializer.new(_1, current_user: current_user).as_json } }
    end

    def show
      render json: ProjectSerializer.new(@project, current_user: current_user).as_json
    end

    def create
      # owner は current_user から設定する。リクエストの owner_id を信用しない
      project = current_user.owned_projects.new(project_params)

      if project.save
        render json: ProjectSerializer.new(project, current_user: current_user).as_json, status: :created
      else
        render_error(:unprocessable_entity, project.errors.full_messages.join("、"))
      end
    end

    def update
      if @project.update(project_params)
        render json: ProjectSerializer.new(@project, current_user: current_user).as_json
      else
        render_error(:unprocessable_entity, @project.errors.full_messages.join("、"))
      end
    end

    def destroy
      @project.trashed!
      head :no_content
    end

    private

    def set_project
      @project = Project.active
                        .includes(:tags, :owner, :project_participations)
                        .find_by(id: params[:id])
      return if @project

      render_error(:not_found, "プロジェクトが見つかりません")
    end

    def require_owner_or_admin
      return if owner_or_admin?(@project)

      render_error(:forbidden, "この企画を編集する権限がありません")
    end

    # status を許可しているのは、募集中 → 進行中 → 完了 の遷移が
    # 編集以外に手段が無いため(docs/api-spec.md §3 は3値と定めている)。
    # tag_ids は T2-5(タグ付け)の担当。owner_id は許可しない
    def project_params
      params.require(:project).permit(
        :title, :description, :activity_schedule, :meeting_schedule, :capacity, :status
      )
    end
  end
end
