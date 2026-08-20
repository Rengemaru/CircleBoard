require "rails_helper"

# 管理者によるアカウント発行(docs/api-spec.md §6)。
# ユーザーの一覧・編集・停止・削除UIは MVP 対象外(CLAUDE.md §10)で、
# rails console で対応する。ここは発行だけを担う。
RSpec.describe "POST /api/admin/users", type: :request do
  let(:admin) { create(:user, role: :admin) }
  let(:member) { create(:user) }
  let(:params) do
    {
      user: {
        name: "鈴木一郎",
        email: "ichiro@example.ac.jp",
        password: "password123",
        enrollment_year: 2026,
        graduation_year: 2030,
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
