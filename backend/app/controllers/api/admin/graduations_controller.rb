module Api
  module Admin
    class GraduationsController < ApplicationController
      before_action :require_login
      before_action :require_admin
      before_action :set_user

      # 自分自身も切り替えられる。停止や削除と違い、卒業しても権限は残るので
      # (spec-v2.2.md §2.1)、管理画面から締め出されない。4年目の管理者が
      # 自分を卒業生にするのは、むしろ普通の操作になる。
      #
      # PUT /api/admin/users/:user_id/graduation — 卒業生にする
      #
      # 卒業は列ではなく、graduation_year と今の年度の比較結果(User#graduated?)。
      # フラグが無いので、卒業させるには年度を今年度まで引き寄せることになる。
      #
      # **元の卒業年度は戻らない。** 2029 を 2026 で上書きするだけで、
      # 「本当は 2029 だった」という記録はどこにも残らない。押す前に確認を
      # 挟むのは画面側の責任(オーナー決定 2026-09-11)。
      #
      # 入学年度は触らない。学年の表記(B3 / M1)はそちらから出るので、
      # 現役に戻したときに元の学年が復元される
      def update
        # まだ入学していない人は卒業生にできない。翌年度の入学者は先に登録できる
        # ので(User::ENROLLMENT_YEARS_AHEAD)、この状態は実際に作れる。
        #
        # 卒業年度を今の年度まで引くと入学より前になり、年度の検証に落ちて 500 に
        # なる。入学年度に丸めて 200 を返す手もあるが、押しても卒業生にならない
        # ボタンになるので、何が起きなかったのかを返す
        if @user.enrollment_year > User.academic_year
          return render_error(:unprocessable_entity, "まだ入学していない人は卒業生にできません")
        end

        @user.update!(graduation_year: User.academic_year)
        render json: serialize(@user)
      end

      # DELETE /api/admin/users/:user_id/graduation — 現役に戻す
      #
      # 本当の卒業年度は分からないので、今の年度の終わりまで在学しているとみなす。
      # 卒業年度そのものを直したいときは、学年を指定し直す
      # (PATCH /api/admin/users/:id の grade_years)
      def destroy
        @user.update!(graduation_year: User.academic_year + 1)
        render json: serialize(@user)
      end

      private

      def set_user
        @user = User.find_by(id: params[:user_id])
        return if @user

        render_error(:not_found, "ユーザーが見つかりません")
      end

      def serialize(user)
        {
          id: user.id,
          graduated: user.graduated?,
          graduation_year: user.graduation_year,
          grade: user.grade
        }
      end
    end
  end
end
