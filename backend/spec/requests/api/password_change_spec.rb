require "rails_helper"

# パスワードの変更と再発行(docs/spec-admin-operations.md §3.1)。
#
# メール送信を作らない方針なので、リセットリンクを送る方式は採れない。
# 本人が変える経路と、管理者が再発行する経路の2本立てにしている。
RSpec.describe "パスワード", type: :request do
  let(:user) { create(:user, password: "oldpassword1") }

  describe "PATCH /api/users/me/password（本人）" do
    it "未ログインでは 401 を返す" do
      patch "/api/users/me/password",
            params: { current_password: "oldpassword1", password: "newpassword1" }, as: :json

      expect(response).to have_http_status(:unauthorized)
    end

    it "現在のパスワードが合っていれば変えられる" do
      sign_in(user, password: "oldpassword1")
      patch "/api/users/me/password",
            params: { current_password: "oldpassword1", password: "newpassword1" }, as: :json

      expect(response).to have_http_status(:no_content)
      expect(user.reload.authenticate("newpassword1")).to be_truthy
      expect(user.authenticate("oldpassword1")).to be_falsey
    end

    # **ログイン中であることは「本人である」ことの証明にならない。**
    # これが無いと、席を外した隙に画面を触られただけで乗っ取りが固定化する。
    #
    # 401 にしない。このリポジトリでは 401 が「ログインし直せ」の意味で、
    # 画面が再ログインの案内を出す(Issue #72)。セッションは切れていないので、
    # 401 を返すと「有効期限が切れました」と誤って出る
    it "現在のパスワードが違うと 422 を返し、変えない" do
      sign_in(user, password: "oldpassword1")
      patch "/api/users/me/password",
            params: { current_password: "wrongpassword", password: "newpassword1" }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["error"]["message"]).to include("現在のパスワード")
      expect(user.reload.authenticate("oldpassword1")).to be_truthy
    end

    it "現在のパスワードを送らないと 422 を返す" do
      sign_in(user, password: "oldpassword1")
      patch "/api/users/me/password", params: { password: "newpassword1" }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    # 8文字以上の検証は既存の User バリデーションがそのまま効く
    it "短いパスワードは 422 を返し、日本語で理由を返す" do
      sign_in(user, password: "oldpassword1")
      patch "/api/users/me/password",
            params: { current_password: "oldpassword1", password: "short" }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["error"]["message"]).to include("8文字以上")
      expect(user.reload.authenticate("oldpassword1")).to be_truthy
    end

    # 空文字は has_secure_password の setter が何もせず、長さ検証も present? を
    # 条件にしているので素通りしていた。**変えていないのに 204 を返していた**
    [ "", nil ].each do |blank|
      it "新しいパスワードが #{blank.inspect} なら 422 を返し、変えない" do
        sign_in(user, password: "oldpassword1")
        patch "/api/users/me/password",
              params: { current_password: "oldpassword1", password: blank }, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(user.reload.authenticate("oldpassword1")).to be_truthy
      end
    end

    it "新しいパスワードのキーごと無いなら 422 を返す" do
      sign_in(user, password: "oldpassword1")
      patch "/api/users/me/password", params: { current_password: "oldpassword1" }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(user.reload.authenticate("oldpassword1")).to be_truthy
    end

    # 他人のパスワードを指せる形そのものを作らない(/users/me の1本だけ)
    it "他人のパスワードは変えられない（経路が無い）" do
      other = create(:user)
      sign_in(user, password: "oldpassword1")
      patch "/api/users/#{other.id}/password",
            params: { current_password: "oldpassword1", password: "newpassword1" }, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PUT /api/admin/users/:id/password（管理者による再発行）" do
    let(:admin) { create(:user, role: :admin) }

    it "未ログインでは 401 を返す" do
      put "/api/admin/users/#{user.id}/password", params: { password: "newpassword1" }, as: :json

      expect(response).to have_http_status(:unauthorized)
    end

    # フロントでボタンを隠すのは表示の話。API側で必ず role を検証する
    it "一般メンバーでは 403 を返し、変えない" do
      sign_in(create(:user))
      put "/api/admin/users/#{user.id}/password", params: { password: "newpassword1" }, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(user.reload.authenticate("oldpassword1")).to be_truthy
    end

    # 忘れた人が対象なので、現在の値は求めない
    it "現在のパスワードを知らなくても再発行できる" do
      sign_in(admin)
      put "/api/admin/users/#{user.id}/password", params: { password: "newpassword1" }, as: :json

      expect(response).to have_http_status(:no_content)
      expect(user.reload.authenticate("newpassword1")).to be_truthy
    end

    it "短いパスワードは 422 を返す" do
      sign_in(admin)
      put "/api/admin/users/#{user.id}/password", params: { password: "short" }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(user.reload.authenticate("oldpassword1")).to be_truthy
    end

    # 管理者側でも同じ穴が空いていた。再発行したつもりで、使えない値を
    # 本人に伝えることになる
    [ "", nil ].each do |blank|
      it "新しいパスワードが #{blank.inspect} なら 422 を返し、変えない" do
        sign_in(admin)
        put "/api/admin/users/#{user.id}/password", params: { password: blank }, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(user.reload.authenticate("oldpassword1")).to be_truthy
      end
    end

    it "新しいパスワードのキーごと無いなら 422 を返す" do
      sign_in(admin)
      put "/api/admin/users/#{user.id}/password", params: {}, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(user.reload.authenticate("oldpassword1")).to be_truthy
    end

    it "存在しないIDでは 404 を返す" do
      sign_in(admin)
      put "/api/admin/users/0/password", params: { password: "newpassword1" }, as: :json

      expect(response).to have_http_status(:not_found)
    end

    # 自分自身の再発行は止めない。締め出される操作ではないため
    it "自分自身にも使える" do
      sign_in(admin)
      put "/api/admin/users/#{admin.id}/password", params: { password: "newpassword1" }, as: :json

      expect(response).to have_http_status(:no_content)
    end
  end

  # 初期パスワードのままかどうかの記録(Issue #288)。
  #
  # 判定は password_digest では出来ない(ハッシュしか持っていない)ので、
  # 「本人が設定し直した」という事実を列に残す。この段階では記録するだけで、
  # 使う側(403 で弾く / 画面で誘導する)はまだ入っていない
  describe "password_changed_at" do
    it "発行したばかりのユーザーは未変更として扱う" do
      issued = create(:user, :initial_password)

      expect(issued.password_changed_at).to be_nil
      expect(issued.password_unchanged?).to be true
    end

    it "本人が変えると時刻が入る" do
      sign_in(user, password: "oldpassword1")
      patch "/api/users/me/password",
            params: { current_password: "oldpassword1", password: "newpassword1" }, as: :json

      expect(response).to have_http_status(:no_content)
      expect(user.reload.password_changed_at).to be_present
      expect(user.password_unchanged?).to be false
    end

    it "本人の変更が失敗したときは時刻が入らない" do
      issued = create(:user, :initial_password, password: "oldpassword1")
      sign_in(issued, password: "oldpassword1")
      patch "/api/users/me/password",
            params: { current_password: "oldpassword1", password: "short" }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(issued.reload.password_changed_at).to be_nil
    end

    # **ここが抜けると、再発行のたびに仕組みが素通しになる。**
    # 再発行した直後は、また管理者の知っているパスワードに戻っている
    it "管理者が再発行すると未変更に戻る" do
      admin = create(:user, role: :admin, password: "adminpassword1")
      user.update!(password: "ownpassword1", password_changed_at: Time.current)

      sign_in(admin, password: "adminpassword1")
      put "/api/admin/users/#{user.id}/password", params: { password: "reissued12345" }, as: :json

      expect(response).to have_http_status(:no_content)
      expect(user.reload.password_changed_at).to be_nil
      expect(user.password_unchanged?).to be true
    end

    it "管理者の再発行が失敗したときは記録を変えない" do
      admin = create(:user, role: :admin, password: "adminpassword1")
      changed_at = 1.day.ago
      user.update!(password: "ownpassword1", password_changed_at: changed_at)

      sign_in(admin, password: "adminpassword1")
      put "/api/admin/users/#{user.id}/password", params: { password: "short" }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(user.reload.password_changed_at).to be_within(1.second).of(changed_at)
    end
  end

  # **既知の穴。** セッションは session[:user_id] しか持っていないので、
  # パスワードを変えても他の端末で開いたままのセッションは生き続ける。
  # 切るには users に session_token 列が要り、spec-v2.2.md §2 に触る。
  # 今回のスコープ外(docs/spec-admin-operations.md §3.1 の⚠️)
  it "パスワードを変えても、いま開いているセッションは無効にならない" do
    sign_in(user, password: "oldpassword1")
    patch "/api/users/me/password",
          params: { current_password: "oldpassword1", password: "newpassword1" }, as: :json
    get "/api/users/me"

    expect(response).to have_http_status(:ok)
  end
end
