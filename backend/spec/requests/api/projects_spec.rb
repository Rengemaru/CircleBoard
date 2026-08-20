require "rails_helper"

RSpec.describe "Api::Projects", type: :request do
  let(:owner) { create(:user) }
  let(:other) { create(:user) }
  let(:admin) { create(:user, role: :admin) }

  # プロジェクトはイベントと違い、一覧・詳細ともログイン必須(docs/api-spec.md §3)。
  # イベントはゲスト可なので、ここを取り違えると公開範囲が逆になる
  describe "未ログイン" do
    let!(:project) { create(:project, owner: owner) }

    it "一覧は 401 を返す" do
      get "/api/projects"

      expect(response).to have_http_status(:unauthorized)
      expect(response.parsed_body.keys).to eq([ "error" ])
      expect(response.parsed_body["error"]["code"]).to eq("unauthorized")
    end

    it "詳細も 401 を返す" do
      get "/api/projects/#{project.id}"

      expect(response).to have_http_status(:unauthorized)
    end

    it "作成も 401 を返す" do
      post "/api/projects", params: { project: { title: "x", description: "d" } }, as: :json

      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/projects" do
    it "ログインしていれば一覧を返し、論理削除済みは含めない" do
      visible = create(:project, owner: owner)
      trashed = create(:project, owner: owner)
      trashed.trashed!
      sign_in(other)

      get "/api/projects"

      ids = response.parsed_body["projects"].map { _1["id"] }
      expect(ids).to include(visible.id)
      expect(ids).not_to include(trashed.id)
    end
  end

  describe "POST /api/projects" do
    it "リクエストの owner_id を無視し、ログイン中のユーザーを owner にする" do
      sign_in(owner)

      post "/api/projects",
           params: { project: { title: "新規", description: "d", owner_id: admin.id } },
           as: :json

      expect(response).to have_http_status(:created)
      expect(Project.find(response.parsed_body["id"]).owner_id).to eq(owner.id)
    end

    it "status を3値のいずれかで設定できる" do
      sign_in(owner)

      post "/api/projects",
           params: { project: { title: "進行中の企画", description: "d", status: "in_progress" } },
           as: :json

      expect(response.parsed_body["status"]).to eq("in_progress")
    end

    it "必須項目が欠けていると 422 を返す" do
      sign_in(owner)

      post "/api/projects", params: { project: { title: "", description: "d" } }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body.keys).to eq([ "error" ])
    end
  end

  describe "PATCH / DELETE" do
    let!(:project) { create(:project, owner: owner) }

    it "owner 本人は編集できる" do
      sign_in(owner)

      patch "/api/projects/#{project.id}", params: { project: { title: "変更後" } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(project.reload.title).to eq("変更後")
    end

    it "admin は他人の企画でも編集できる" do
      sign_in(admin)

      patch "/api/projects/#{project.id}", params: { project: { title: "管理者が修正" } }, as: :json

      expect(response).to have_http_status(:ok)
    end

    it "無関係なメンバーは 403 を返し、内容が変わらない" do
      sign_in(other)

      patch "/api/projects/#{project.id}", params: { project: { title: "乗っ取り" } }, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body["error"]["code"]).to eq("forbidden")
      expect(project.reload.title).not_to eq("乗っ取り")
    end

    it "owner 本人は論理削除でき、物理削除はしない" do
      sign_in(owner)

      delete "/api/projects/#{project.id}"

      expect(response).to have_http_status(:no_content)
      expect(project.reload).to be_trashed
      expect(Project.find_by(id: project.id)).to be_present
    end

    it "論理削除済みは 404 を返す" do
      project.trashed!
      sign_in(owner)

      get "/api/projects/#{project.id}"

      expect(response).to have_http_status(:not_found)
      expect(response.parsed_body["error"]["code"]).to eq("not_found")
    end
  end
end
