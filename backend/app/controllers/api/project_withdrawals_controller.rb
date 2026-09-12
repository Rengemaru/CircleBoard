module Api
  # 本人による脱退の申請と取り下げ(docs/api-spec.md「プロジェクトの脱退」)。
  #
  # **抜けるのは owner が承認してから。** プロジェクトは継続的に成果物を作る
  # 活動で、抜けられると owner が引き継ぎを考える必要がある。黙って消えると
  # 気づけないので、イベントの参加キャンセルと同じ「1クリックで抜ける」に
  # しない(spec-v2.2.md §2.6)。
  #
  # 「自分の参加」しか指せないのでパスに :id を取らない。他人の参加を指せる形
  # そのものを作らない(PATCH /api/users/me と同じ考え方)。
  class ProjectWithdrawalsController < ApplicationController
    before_action :require_login
    before_action :set_project
    before_action :set_participation

    # POST /api/projects/:project_id/withdrawal — 脱退を申請する
    def create
      # owner が抜けると持ち主のいない企画が残る。付け替えは MVP 対象外
      # (co_organizer と同じ。CLAUDE.md §10)
      if @project.owner_id == current_user.id
        return render_error(:unprocessable_entity, "主催者は脱退できません")
      end

      if @participation.withdrawal_requested?
        return render_error(:unprocessable_entity, "すでに脱退を申請しています")
      end

      @participation.request_withdrawal!
      head :no_content
    end

    # DELETE /api/projects/:project_id/withdrawal — 申請を取り下げる
    def destroy
      unless @participation.withdrawal_requested?
        return render_error(:unprocessable_entity, "脱退を申請していません")
      end

      @participation.cancel_withdrawal_request!
      head :no_content
    end

    private

    def set_project
      @project = Project.active.find_by(id: params[:project_id])
      return if @project

      render_error(:not_found, "プロジェクトが見つかりません")
    end

    # 参加していない人には 404 を返す。403 にすると「参加していないこと」が
    # 分かってしまう。抜けた人も対象外(active)
    def set_participation
      @participation = @project.active_project_participations.find_by(user: current_user)
      return if @participation

      render_error(:not_found, "このプロジェクトに参加していません")
    end
  end
end
