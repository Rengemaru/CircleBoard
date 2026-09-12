module Api
  # アプリ内通知(Issue #292)。**自分が判断すべきことだけ**を返す。
  #
  # 脱退申請は、オーナーが自分でプロジェクトの詳細を開かない限り気づけない。
  # 申請した側は待っているのに、された側は来ていることを知らない状態になる。
  #
  # **アプリの外へは飛ばさない。** メール・LINE・Discord は作らない方針
  # (CLAUDE.md §10)。ここは画面の中に出すためのデータだけを返す。
  #
  # 既読は持たない。「見た」と「対応した」は違うので、**承認か却下をして
  # 初めて消える**。現在の状態をその場で数えるだけで済み、列も増えない。
  class NotificationsController < ApplicationController
    before_action :require_login

    # GET /api/notifications
    def index
      render json: { items: withdrawal_items }
    end

    private

    # オーナーは自分の企画の分だけ、管理者は全件(オーナー決定 2026-09-13)。
    # オーナーが放置したときに気づけるのは部長だけなので、管理者には絞らない。
    #
    # 判定の軸は ApplicationController#owner_or_admin? と同じだが、あちらは
    # 1件を受け取る。ここは一覧を引くので SQL 側で絞る
    def visible_projects
      projects = Project.active
      projects = projects.where(owner_id: current_user.id) unless current_user.admin?
      projects
    end

    # includes はN+1対策(CLAUDE.md §3-3)。件数分の企画と申請者を引きに行かせない
    def withdrawal_items
      ProjectParticipation.withdrawal_requested
                          .where(project: visible_projects)
                          .includes(:project, :user)
                          .order(withdrawal_requested_at: :asc)
                          .map { NotificationSerializer.new(_1).as_json }
    end
  end
end
