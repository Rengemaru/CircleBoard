module Api
  module Admin
    class PostsController < ApplicationController
      before_action :require_login
      before_action :require_admin

      # GET /api/admin/posts
      #
      # 企画一覧・全件管理(wireframes/wireframe-admin-ver2.html ④)。
      #
      # 公開APIを使い回さないのは、あちらが論理削除済み(visibility: trashed)を
      # 必ず外すため。この画面は消したものを一覧して戻す場所なので、
      # trashed が見えないと成立しない。
      #
      # 検索と絞り込みをクエリで受けないのは users#index と同じ理由で、
      # 部内の企画は多くても数十件であり、1文字打つたびに往復させる意味がない。
      # メンバー側の一覧が ?status= / ?tag_id= を受けるのは、URLで共有できる
      # ことが要件だったため(画面②④)。この画面にその要件は無い。
      def index
        rows = events.map { event_row(_1) } + projects.map { project_row(_1) }

        # 投稿日の新しい順。2つのテーブルを混ぜるので、SQLではなくRubyで並べる。
        # iso8601 の文字列は辞書順がそのまま時刻順になる(同じタイムゾーンのため)
        render json: { posts: rows.sort_by { _1[:created_at] }.reverse }
      end

      private

      # active に絞らない。この画面だけが trashed を見る
      def events
        Event.includes(:owner, :active_event_participations)
      end

      def projects
        Project.includes(:owner, :project_participations)
      end

      # イベントの参加者はキャンセルを除いて数える(spec-v2.2.md §2.5)。
      # プロジェクトはキャンセルの概念が無いのでそのまま数える(§2.6)。
      # 公開APIのシリアライザと同じ数え方に揃えてある
      def event_row(event)
        row(event, "event").merge(participants_count: event.active_event_participations.size)
      end

      def project_row(project)
        row(project, "project").merge(participants_count: project.project_participations.size)
      end

      def row(record, kind)
        {
          id: record.id,
          kind: kind,
          title: record.title,
          status: record.status,
          # 状態は status(募集中/進行中/終了)と visibility(削除済み)の2列に
          # 分かれている。画面④は1つの選択肢として見せるが、ここでまとめると
          # 「削除済みの募集中」が表現できなくなるので、2つのまま返す
          trashed: record.trashed?,
          # owner は退会で nil になりうる(ON DELETE SET NULL)。
          # 名前だけを返す。管理画面でも本人の連絡先までは要らない
          owner_name: record.owner&.name,
          capacity: record.capacity,
          created_at: record.created_at.iso8601
        }
      end
    end
  end
end
