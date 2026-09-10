require "rails_helper"

# プロフィールの参照(docs/api-spec.md §4.5)。
# 未ログインに漏れないことと、他人のメールアドレスが出ないことを見る
# (spec-v2.2.md §4.1、CLAUDE.md §3-2)。
RSpec.describe "Api::Users", type: :request do
  let(:me) { create(:user, department: "情報工学科", bio: "テスト") }
  let(:other) { create(:user) }

  def login(user)
    post "/api/session", params: { email: user.email, password: "password123" }, as: :json
  end

  describe "GET /api/users/me" do
    it "未ログインは 401" do
      get "/api/users/me"

      expect(response).to have_http_status(:unauthorized)
    end

    it "自分の情報を返す" do
      login(me)
      get "/api/users/me"
      body = response.parsed_body

      expect(response).to have_http_status(:ok)
      expect(body["id"]).to eq me.id
      expect(body["department"]).to eq "情報工学科"
    end

    it "自分にはメールアドレスを返す" do
      login(me)
      get "/api/users/me"

      expect(response.parsed_body).to have_key("email")
    end

    it "スキルとリンクを返す" do
      me.tags = [ create(:tag, name: "Web開発") ]
      create(:user_link, user: me, label: "GitHub", url: "https://github.com/x", position: 0)
      login(me)
      get "/api/users/me"
      body = response.parsed_body

      expect(body["tags"].map { _1["name"] }).to eq [ "Web開発" ]
      expect(body["links"].map { _1["label"] }).to eq [ "GitHub" ]
    end

    it "リンクは position の昇順で返る" do
      create(:user_link, user: me, label: "2番目", position: 1)
      create(:user_link, user: me, label: "1番目", position: 0)
      login(me)
      get "/api/users/me"

      expect(response.parsed_body["links"].map { _1["label"] }).to eq [ "1番目", "2番目" ]
    end
  end

  describe "GET /api/users/:id" do
    it "未ログインは 401" do
      get "/api/users/#{other.id}"

      expect(response).to have_http_status(:unauthorized)
    end

    it "ログインしていれば他人のプロフィールを返す" do
      login(me)
      get "/api/users/#{other.id}"

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["id"]).to eq other.id
    end

    # 他人のメールアドレスを配る理由がない
    it "他人のメールアドレスは返さない" do
      login(me)
      get "/api/users/#{other.id}"

      expect(response.parsed_body).not_to have_key("email")
    end

    it "自分を id で引いたときはメールアドレスを返す" do
      login(me)
      get "/api/users/#{me.id}"

      expect(response.parsed_body).to have_key("email")
    end

    # 管理画面の情報であって、プロフィールではない
    it "role と suspended_at はどちらでも返さない" do
      login(me)
      get "/api/users/#{other.id}"

      expect(response.parsed_body).not_to have_key("role")
      expect(response.parsed_body).not_to have_key("suspended_at")
    end

    it "存在しない id は 404" do
      login(me)
      get "/api/users/999999"

      expect(response).to have_http_status(:not_found)
    end

    # "me" が :id に吸われていないことの確認
    it "/api/users/me が show ではなく me に届く" do
      login(me)
      get "/api/users/me"

      expect(response.parsed_body["id"]).to eq me.id
    end
  end

  describe "他のAPIへの漏れ" do
    # 今回増えた列は users にあるので、user.as_json のような書き方が
    # 残っていると参加者一覧に混ざる
    it "未ログインのイベント詳細に department が混ざらない" do
      event = create(:event, owner: me)
      create(:event_participation, event:, user: me)

      get "/api/events/#{event.id}"

      expect(response.body).not_to include("department")
      expect(response.body).not_to include("情報工学科")
    end

    it "ログイン済みのイベント詳細にも department は出さない" do
      event = create(:event, owner: me)
      create(:event_participation, event:, user: me)
      login(other)

      get "/api/events/#{event.id}"

      expect(response.body).not_to include("department")
    end
  end
end
