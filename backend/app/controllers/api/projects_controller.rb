module Api
  class ProjectsController < ApplicationController
    # イベントと違い、一覧・詳細もログイン必須(docs/api-spec.md §3)。
    # プロジェクトは継続的に成果物を作る活動で、参加者や進行状況が
    # 部外者に見える必要がないため
    before_action :require_login
    before_action :set_project, only: [ :show, :update, :destroy ]
    before_action :require_owner_or_admin, only: [ :update, :destroy ]

    def index
      # includes はN+1対策。1件ずつ関連を引きに行かせない(CLAUDE.md §3-3)
      projects = Project.active.includes(:tags, :owner, project_participations: :user)
      projects = filter_by_status(projects)
      projects = filter_by_tag(projects)
      projects = sort_projects(projects)

      render json: { projects: projects.map { ProjectSerializer.new(_1, current_user: current_user).as_json } }
    end

    def show
      render json: ProjectSerializer.new(@project, current_user: current_user).as_json
    end

    def create
      # owner は current_user から設定する。リクエストの owner_id を信用しない
      tags = resolve_tags(tag_ids_param)
      return render_error(:unprocessable_entity, "タグの指定が正しくありません") if tags.nil?

      project = current_user.owned_projects.new(project_params)
      project.tags = tags

      if project.save
        render json: ProjectSerializer.new(project, current_user: current_user).as_json, status: :created
      else
        render_error(:unprocessable_entity, project.errors.full_messages.join("、"))
      end
    end

    def update
      tags = resolve_tags(tag_ids_param)
      return render_error(:unprocessable_entity, "タグの指定が正しくありません") if tags.nil?

      # タグの割り当ては保存済みレコードに対して即座に中間テーブルへ書き込まれる。
      # 本体の更新が失敗したときにタグだけ変わった状態が残らないよう、まとめて巻き戻す
      updated = false
      ActiveRecord::Base.transaction do
        @project.tags = tags if tag_ids_param
        updated = @project.update(project_params)
        raise ActiveRecord::Rollback unless updated
      end

      if updated
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

    # 既定は終了以外。進行中も一覧に出すのは、途中参加できる設計のため
    # (wireframes/wireframe-member.html 画面④)。
    # 未知の値を渡されたら既定に戻す。エラーにしないのは、URLを手で編集された
    # だけで画面が壊れるのを避けるため(イベント側と同じ扱い)
    def filter_by_status(scope)
      status = params[:status]
      return scope.where.not(status: :completed) unless Project.statuses.key?(status)

      scope.where(status: status)
    end

    # 絞り込みは ?tag_id= で行い、URLで共有できる状態にする
    # (wireframes/wireframe-member.html 画面④)
    def filter_by_tag(scope)
      tag_id = params[:tag_id]
      return scope if tag_id.blank?

      scope.joins(:project_tags).where(project_tags: { tag_id: tag_id })
    end

    # 募集中 → 進行中 の順(画面④)。enum の整数(0:recruiting 1:in_progress
    # 2:completed)がそのままこの順序なので、status で並べるだけでよい。
    # イベントと違い注目スコアは使わない。プロジェクトには開催日が無く、
    # 締切感が存在しないため(wireframe-signage.html)
    def sort_projects(scope)
      scope.order(status: :asc, id: :asc)
    end

    def set_project
      @project = Project.active
                        .includes(:tags, :owner, project_participations: :user)
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
    def tag_ids_param
      params.dig(:project, :tag_ids)
    end

    def project_params
      params.require(:project).permit(
        :title, :description, :activity_schedule, :meeting_schedule, :capacity, :status
      )
    end
  end
end
