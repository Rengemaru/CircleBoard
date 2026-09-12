module Api
  # owner と管理者による脱退の承認・却下(docs/api-spec.md「プロジェクトの脱退」)。
  #
  # 他人の申請を捌くので、申請のIDを取る。企画の編集と同じく
  # 「owner 本人か管理者」で判定する(ApplicationController#owner_or_admin?)。
  class ProjectWithdrawalReviewsController < ApplicationController
    before_action :require_login
    before_action :set_project
    before_action :require_owner_or_admin
    before_action :set_participation

    # PUT /api/projects/:project_id/withdrawals/:id — 承認して抜けさせる
    def update
      @participation.approve_withdrawal!
      head :no_content
    end

    # DELETE /api/projects/:project_id/withdrawals/:id — 却下する
    #
    # 取り下げ(本人)と同じ結果になる。申請していない状態に戻すだけで、
    # 「却下された」という記録は残さない(操作ログは対象外)
    def destroy
      @participation.cancel_withdrawal_request!
      head :no_content
    end

    private

    def set_project
      @project = Project.active.find_by(id: params[:project_id])
      return if @project

      render_error(:not_found, "プロジェクトが見つかりません")
    end

    def require_owner_or_admin
      return if owner_or_admin?(@project)

      render_error(:forbidden, "この企画の脱退申請を扱う権限がありません")
    end

    # 申請中のものしか扱えない。申請していない参加を承認すると、本人の意思なしに
    # 抜けさせられる
    def set_participation
      @participation = @project.active_project_participations.withdrawal_requested
                               .find_by(id: params[:id])
      return if @participation

      render_error(:not_found, "脱退の申請が見つかりません")
    end
  end
end
