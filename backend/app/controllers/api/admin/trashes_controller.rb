module Api
  module Admin
    class TrashesController < ApplicationController
      before_action :require_login
      before_action :require_admin

      # DELETE /api/admin/events/:event_id/trash
      # DELETE /api/admin/projects/:project_id/trash
      #
      # 論理削除の取り消し(wireframes/wireframe-admin-ver2.html ④「復旧」)。
      #
      # 削除そのものは DELETE /api/events/:id と DELETE /api/projects/:id を
      # そのまま使う。owner 本人も行える一般の操作なので、同じことをする入口を
      # 管理者用にもう1本作らない。復旧だけがここにあるのは、公開APIが
      # trashed を必ず 404 にするため。消したものに触れるのは管理者だけ。
      #
      # すでに active な企画に対して呼んでも 204 を返す。結果が同じなので
      # エラーにする理由がない
      def destroy
        post = find_post
        return render_error(:not_found, "企画が見つかりません") if post.nil?

        post.active!
        head :no_content
      end

      private

      # ルートは events 配下と projects 配下の2本ある。
      # どちらから来たかはネストしたIDのパラメータ名で分かる
      def find_post
        if params[:event_id].present?
          Event.find_by(id: params[:event_id])
        else
          Project.find_by(id: params[:project_id])
        end
      end
    end
  end
end
