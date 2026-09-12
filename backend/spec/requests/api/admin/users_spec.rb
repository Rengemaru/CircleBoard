require "rails_helper"

# 管理者によるアカウント発行(docs/api-spec.md §6)。
#
# 学年は「在学何年目か」(1〜9)で受け取り、入学年度と卒業年度はサーバーが
# 逆算する。年度を人手で入れるのは現実的でない(オーナー決定 2026-09-11)。
# 編集(PATCH /api/admin/users/:id)と同じ扱い。
RSpec.describe "POST /api/admin/users", type: :request do
  let(:admin) { create(:user, role: :admin) }
  let(:member) { create(:user) }
  let(:params) do
    {
      user: {
        name: "鈴木一郎",
        email: "ichiro@example.ac.jp",
        password: "password123",
        grade_years: 1,
        role: "member"
      }
    }
  end

  it "未ログインでは 401 を返し、作成しない" do
    expect { post "/api/admin/users", params: params, as: :json }
      .not_to change(User, :count)

    expect(response).to have_http_status(:unauthorized)
  end

  # フロントでメニューを隠すだけにしない。API側で必ず role を検証する
  it "一般メンバーでは 403 を返し、作成しない" do
    sign_in(member)

    expect { post "/api/admin/users", params: params, as: :json }
      .not_to change(User, :count)

    expect(response).to have_http_status(:forbidden)
    expect(response.parsed_body["error"]["code"]).to eq("forbidden")
  end

  it "管理者はアカウントを発行できる" do
    sign_in(admin)

    expect { post "/api/admin/users", params: params, as: :json }
      .to change(User, :count).by(1)

    expect(response).to have_http_status(:created)
    created = User.find(response.parsed_body["user"]["id"])
    expect(created.name).to eq("鈴木一郎")
    expect(created).to be_member
  end

  describe "権限" do
    before { sign_in(admin) }

    def issue(role)
      body = params.deep_dup
      body[:user][:role] = role
      post "/api/admin/users", params: body, as: :json
    end

    # users.role には確保しているが画面に出さない(ワイヤーフレーム③)。
    # 編集では弾いていたのに発行は素通しで、curl から作れていた(2026-09-12 の監査)
    it "demo では発行しない" do
      expect { issue("demo") }.not_to change(User, :count)

      expect(response).to have_http_status(:unprocessable_entity)
    end

    # 未知の値を enum に直接渡すと ArgumentError で 500 になっていた
    it "未知の権限は 500 ではなく 422 を返す" do
      expect { issue("superadmin") }.not_to change(User, :count)

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "member と admin は発行できる" do
      issue("member")
      expect(response).to have_http_status(:created)

      body = params.deep_dup
      body[:user][:email] = "another@example.ac.jp"
      body[:user][:role] = "admin"
      post "/api/admin/users", params: body, as: :json

      expect(User.find(response.parsed_body["user"]["id"])).to be_admin
    end
  end

  describe "学年" do
    before { sign_in(admin) }

    def issue(grade_years)
      body = params.deep_dup
      body[:user][:grade_years] = grade_years
      post "/api/admin/users", params: body, as: :json
    end

    it "在学年数から入学年度と卒業年度を決める" do
      travel_to(Date.new(2026, 9, 1)) { issue(3) }

      created = User.find(response.parsed_body["user"]["id"])
      expect(created.enrollment_year).to eq(2024)
      # 学部の4年目が終わる年度末に卒業する、とみなす
      expect(created.graduation_year).to eq(2028)
      expect(created.grade(Date.new(2026, 9, 1))).to eq("B3")
    end

    # 0 と 10 以上は入力させない。画面でも弾くが curl で直接叩ける
    [ 0, 10, -1, "３", "abc" ].each do |bad|
      it "#{bad.inspect} では発行しない" do
        expect { issue(bad) }.not_to change(User, :count)

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end

    # 年度を直接送っても効かない。grade_years から逆算した値が入る
    it "年度を混ぜても無視する" do
      body = params.deep_dup
      body[:user][:enrollment_year] = 1999
      body[:user][:graduation_year] = 2099

      travel_to(Date.new(2026, 9, 1)) { post "/api/admin/users", params: body, as: :json }

      created = User.find(response.parsed_body["user"]["id"])
      expect(created.enrollment_year).to eq(2026)
    end

    it "学年を送らないと 422（年度が決まらない）" do
      body = params.deep_dup
      body[:user].delete(:grade_years)

      expect { post "/api/admin/users", params: body, as: :json }
        .not_to change(User, :count)

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  it "admin ロールのアカウントも発行できる" do
    sign_in(admin)
    admin_params = params.deep_dup
    admin_params[:user][:role] = "admin"

    post "/api/admin/users", params: admin_params, as: :json

    expect(User.find(response.parsed_body["user"]["id"])).to be_admin
  end

  # 発行したパスワードは返さない。仕様書 §4.1 の表に無い情報は出さない
  it "レスポンスに password や email を含めない" do
    sign_in(admin)

    post "/api/admin/users", params: params, as: :json

    expect(response.parsed_body["user"].keys).to contain_exactly("id", "name", "role")
  end

  it "メールアドレスが重複していると 422 を返す" do
    create(:user, email: "ichiro@example.ac.jp")
    sign_in(admin)

    expect { post "/api/admin/users", params: params, as: :json }
      .not_to change(User, :count)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(response.parsed_body["error"].keys).to contain_exactly("code", "message")
  end

  # 公開サーバーで運用するため、最初から8文字以上を必須にする(spec-v2.2.md §2.1)
  it "パスワードが8文字未満だと 422 を返す" do
    sign_in(admin)
    short = params.deep_dup
    short[:user][:password] = "short"

    post "/api/admin/users", params: short, as: :json

    expect(response).to have_http_status(:unprocessable_entity)
  end

  it "必須項目が欠けていると 422 を返す" do
    sign_in(admin)
    invalid = params.deep_dup
    invalid[:user][:name] = ""

    post "/api/admin/users", params: invalid, as: :json

    expect(response).to have_http_status(:unprocessable_entity)
  end
end
