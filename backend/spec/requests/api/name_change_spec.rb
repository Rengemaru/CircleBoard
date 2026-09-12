require "rails_helper"

# 氏名の変更(オーナー決定 2026-09-12)。
#
# **本人と管理者の両方から変えられる。** 直したい人が違うため。改姓は本人が
# 気づき、発行時の打ち間違いは管理者が気づく(docs/spec-admin-operations.md §3.4)。
#
# メールアドレスは引き続きどちらからも変えられない(rails console)。
RSpec.describe "氏名の変更", type: :request do
  let(:user) { create(:user, name: "旧姓 花子") }

  describe "本人（PATCH /api/users/me）" do
    before { sign_in(user) }

    it "自分の氏名を変えられる" do
      patch "/api/users/me", params: { name: "新姓 花子" }, as: :json

      expect(response).to have_http_status(:ok)
      expect(user.reload.name).to eq("新姓 花子")
    end

    it "空にはできない" do
      patch "/api/users/me", params: { name: "" }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(user.reload.name).to eq("旧姓 花子")
    end

    it "上限を超えると 422" do
      patch "/api/users/me", params: { name: "あ" * (User::MAX_NAME_LENGTH + 1) }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(user.reload.name).to eq("旧姓 花子")
    end

    # **メールと権限と年度は引き続き受け取らない。** 氏名を通したついでに
    # 他の項目まで通っていないことを見る
    it "メール・権限・年度を混ぜても変わらない" do
      before_attrs = user.slice(:email, :role, :enrollment_year, :graduation_year)
      patch "/api/users/me",
            params: {
              name: "新姓 花子", email: "hijack@example.com", role: "admin",
              enrollment_year: 1999, graduation_year: 2099
            }, as: :json

      expect(response).to have_http_status(:ok)
      expect(user.reload.name).to eq("新姓 花子")
      expect(user.slice(:email, :role, :enrollment_year, :graduation_year)).to eq(before_attrs)
    end

    it "未ログインでは 401" do
      delete "/api/session"
      patch "/api/users/me", params: { name: "新姓 花子" }, as: :json

      expect(response).to have_http_status(:unauthorized)
      expect(user.reload.name).to eq("旧姓 花子")
    end
  end

  describe "管理者（PATCH /api/admin/users/:id）" do
    let(:admin) { create(:user, role: :admin) }

    it "他人の氏名を変えられる" do
      sign_in(admin)
      patch "/api/admin/users/#{user.id}", params: { user: { name: "鈴木 一郎" } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(user.reload.name).to eq("鈴木 一郎")
    end

    it "空にはできない" do
      sign_in(admin)
      patch "/api/admin/users/#{user.id}", params: { user: { name: "" } }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(user.reload.name).to eq("旧姓 花子")
    end

    # フロントでボタンを隠すのは表示の話。API側で必ず role を検証する
    it "一般メンバーでは 403" do
      sign_in(create(:user))
      patch "/api/admin/users/#{user.id}", params: { user: { name: "乗っ取り" } }, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(user.reload.name).to eq("旧姓 花子")
    end

    # 氏名を足しても、メールが通るようにはなっていない
    it "メールアドレスは変えられない" do
      before_email = user.email
      sign_in(admin)
      patch "/api/admin/users/#{user.id}",
            params: { user: { name: "鈴木 一郎", email: "changed@example.ac.jp" } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(user.reload.email).to eq(before_email)
    end

    # 氏名だけを直したいことがある。学年と権限を一緒に送らなくても通る
    it "氏名だけを送っても通る" do
      sign_in(admin)
      before_grade = user.enrollment_year
      patch "/api/admin/users/#{user.id}", params: { user: { name: "鈴木 一郎" } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(user.reload.enrollment_year).to eq(before_grade)
    end
  end
end
