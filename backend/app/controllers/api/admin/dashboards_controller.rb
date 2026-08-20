module Api
  module Admin
    class DashboardsController < ApplicationController
      before_action :require_login
      before_action :require_admin

      # 最近の企画アクティビティに出す件数。表の高さが崩れない程度に留める
      ACTIVITY_LIMIT = 5

      # GET /api/admin/dashboard
      #
      # 管理者トップ(wireframes/wireframe-admin-ver2.html ①)。
      #
      # 集計を1本のエンドポイントにまとめているのは、画面が開くたびに
      # ユーザー・イベント・プロジェクトへ3往復させないため。
      # どの数字も「今この瞬間の件数」であり、別々に取ると互いにずれる。
      #
      def show
        render json: { stats: stats, recent_activity: recent_activity }
      end

      private

      def stats
        {
          member_count: User.count,
          # 年度の切り替わりを跨ぐ判断なのでモデルに持たせている(User#graduated?)
          graduate_count: User.select(:graduation_year).count(&:graduated?),
          # 「進行中」= 終わっていないもの。募集中もこれから活動するので含める
          active_project_count: Project.active.where.not(status: :completed).count,
          recruiting_project_count: Project.active.recruiting.count,
          events_this_month_count: Event.active.where(starts_at: this_month).count,
          suspended_count: User.suspended.count,
          next_event: next_event
        }
      end

      def this_month
        Time.current.beginning_of_month..Time.current.end_of_month
      end

      # 次に開催されるイベント。spotlight_targets を使い回すのは、
      # 「まだ開催されていない」の定義(開催当日は23時まで含む)を2箇所に
      # 書かないため。ここで独自に starts_at > 今 と書くと、23時台だけ
      # サイネージと食い違う
      def next_event
        event = Event.spotlight_targets.order(starts_at: :asc).first
        return nil if event.nil?

        {
          id: event.id,
          title: event.title,
          days_until: (event.starts_at.to_date - Date.current).to_i
        }
      end

      # イベントとプロジェクトを1つの表に混ぜて新しい順に出す。
      # それぞれ ACTIVITY_LIMIT 件だけ取ってから混ぜるのは、片方に大量の
      # 古いレコードがあっても読む行数が増えないようにするため
      def recent_activity
        events = Event.active.includes(:owner).order(created_at: :desc).limit(ACTIVITY_LIMIT)
        projects = Project.active.includes(:owner).order(created_at: :desc).limit(ACTIVITY_LIMIT)

        rows = events.map { activity_row(_1, "event") } + projects.map { activity_row(_1, "project") }
        rows.sort_by { _1[:created_at] }.reverse.first(ACTIVITY_LIMIT)
      end

      def activity_row(record, kind)
        {
          id: record.id,
          kind: kind,
          title: record.title,
          status: record.status,
          # owner は退会で nil になりうる(ON DELETE SET NULL)。
          # 名前だけを返す。管理画面でも本人の連絡先までは要らない
          owner_name: record.owner&.name,
          created_at: record.created_at.iso8601
        }
      end
    end
  end
end
