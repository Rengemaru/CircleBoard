module Api
  # 本人によるパスワードの変更(docs/spec-admin-operations.md §3.1)。
  #
  # プロフィールの更新(UsersController#update)と入口を分けている。
  # 現在のパスワードを要求する点も、間違えたときに返すものも違うため。
  class PasswordsController < ApplicationController
    before_action :require_login

    # **ここを塞ぐと詰む。** 初期パスワードのままの人が変更するための
    # 唯一の経路なので、対象から外す(Issue #288)
    skip_before_action :require_password_change_done

    # JSON の自動ラップを切る。**このコントローラ名だと params[:password] に
    # ボディ全体が入る。** ActionController::ParamsWrapper は JSON を
    # コントローラ名(passwords → password)のキーで包むので、
    # { "current_password": "x" } が { "password": { "current_password": "x" } } になり、
    # 「新しいパスワードが無い」を検知できなくなる。
    #
    # ラップが要るのは params.require(:user) のように受ける場合で、ここは違う
    wrap_parameters false

    # PATCH /api/users/me/password
    def update
      # **現在のパスワードを必ず検証する。** これが無いと、席を外した隙に
      # 画面を触られただけでパスワードを書き換えられ、乗っ取りが固定化する。
      # ログイン中であることは「本人である」ことの証明にならない。
      #
      # 401 ではなく 422 を返す。このリポジトリでは 401 に「ログインし直せ」という
      # 意味を持たせていて、画面が受け取ると再ログインの案内を出す(Issue #72)。
      # セッションは切れていないので、そこに混ぜると「有効期限が切れました」と
      # 誤って出る（実際に出た）
      unless current_user.authenticate(params[:current_password].to_s)
        return render_error(:unprocessable_entity, "現在のパスワードが違います")
      end

      # **空文字と未指定をここで弾く。** has_secure_password の setter は空文字を
      # 渡されても何もせず、User の長さ検証も present? を条件にしているので
      # 素通りする。結果、**何も変えていないのに成功を返していた**（204）。
      # 管理者は再発行したつもりで、使えない値を本人に伝えることになる
      if params[:password].blank?
        return render_error(:unprocessable_entity, "新しいパスワードを入力してください")
      end

      # password_changed_at を同じ update に入れる。**別の update に分けない。**
      # 片方だけ通ると「パスワードは変わったのに未変更のまま」または
      # その逆になり、どちらも本人には直せない状態になる(Issue #288)
      if current_user.update(password: params[:password], password_changed_at: Time.current)
        head :no_content
      else
        render_error(:unprocessable_entity, current_user.errors.full_messages.join("、"))
      end
    end
  end
end
