module Api
  module Admin
    class TagsController < ApplicationController
      before_action :require_login
      before_action :require_admin

      # タグは自由記述なので、Rails と rails、誤字、使われなくなったものが溜まる。
      # ここは「作る場所」ではなく**「直す場所」**(docs/spec-tags.md §3.8)。
      #
      # 作成は持たない。タグは企画かプロフィールに付ける過程で生まれる(§3.5)。
      # 管理画面から作れると、どこにも付いていないタグが生まれる

      # GET /api/admin/tags
      def index
        render json: { tags: Tag.with_usage_count.map { serialize(_1) } }
      end

      # PATCH /api/admin/tags/:id
      def update
        tag = Tag.find_by(id: params[:id])
        return render_error(:not_found, "タグが見つかりません") if tag.nil?

        # category は変えさせない。企画に付いているタグをプロフィール用に
        # 移すと、その企画からタグが消える。用途を変えたいなら作り直す
        if tag.update(name: params.dig(:tag, :name))
          render json: serialize(tag)
        else
          render_error(:unprocessable_entity, tag.errors.full_messages.join("、"))
        end
      end

      # DELETE /api/admin/tags/:id
      def destroy
        tag = Tag.find_by(id: params[:id])
        return render_error(:not_found, "タグが見つかりません") if tag.nil?

        # 使われているタグを消すと、中間テーブルが dependent: :destroy で
        # 一緒に消え、企画から黙ってタグが外れる。件数を見せて止める(§3.8)
        if tag.usage_count.positive?
          return render_error(:unprocessable_entity, "使われているタグは削除できません")
        end

        tag.destroy!
        head :no_content
      end

      private

      def serialize(tag)
        {
          id: tag.id,
          name: tag.name,
          category: tag.category,
          usage_count: tag.usage_count
        }
      end
    end
  end
end
