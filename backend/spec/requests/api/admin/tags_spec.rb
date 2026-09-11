require "rails_helper"

# タグの管理(docs/spec-tags.md §3.8)。
#
# タグが自由記述になると、Rails と rails、誤字、使われなくなったものが溜まる。
# ここは「作る場所」ではなく「直す場所」。作成は持たない。
RSpec.describe "Api::Admin::Tags", type: :request do
  let(:admin) { create(:user, role: :admin) }
  let(:member) { create(:user, role: :member) }

  describe "認可" do
    # フロントで隠しても curl で叩けるので、サーバー側で止まることを確かめる
    # (CLAUDE.md §3-2)
    it "未ログインは 401" do
      get "/api/admin/tags"

      expect(response).to have_http_status(:unauthorized)
    end

    it "メンバーは 403" do
      sign_in(member)
      get "/api/admin/tags"

      expect(response).to have_http_status(:forbidden)
    end

    it "メンバーは改名できない" do
      tag = create(:tag, name: "Web開発")
      sign_in(member)
      patch "/api/admin/tags/#{tag.id}", params: { tag: { name: "Web" } }, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(tag.reload.name).to eq("Web開発")
    end
  end

  describe "GET /api/admin/tags" do
    before { sign_in(admin) }

    it "用途と使用件数を返す" do
      tag = create(:tag, name: "Web開発", category: :project_event)
      create(:event, tags: [ tag ])

      get "/api/admin/tags"

      row = response.parsed_body["tags"].find { _1["id"] == tag.id }
      expect(row).to eq("id" => tag.id, "name" => "Web開発",
                        "category" => "project_event", "usage_count" => 1)
    end

    # イベント・プロジェクト・プロフィールの3つを足す。1本の JOIN にすると
    # 行が掛け算になって件数がずれる
    it "3種類の付き先をすべて数える" do
      tag = create(:tag, name: "Web開発")
      create(:event, tags: [ tag ])
      create(:project, tags: [ tag ])
      create(:user).tags = [ tag ]

      get "/api/admin/tags"

      row = response.parsed_body["tags"].find { _1["id"] == tag.id }
      expect(row["usage_count"]).to eq(3)
    end

    it "どこにも付いていないタグは0件で出る" do
      tag = create(:tag, name: "孤児")

      get "/api/admin/tags"

      row = response.parsed_body["tags"].find { _1["id"] == tag.id }
      expect(row["usage_count"]).to eq(0)
    end

    it "プロフィール用のタグも返す" do
      tag = create(:tag, name: "3D", category: :profile)

      get "/api/admin/tags"

      row = response.parsed_body["tags"].find { _1["id"] == tag.id }
      expect(row["category"]).to eq("profile")
    end
  end

  describe "PATCH /api/admin/tags/:id" do
    before { sign_in(admin) }

    it "改名できる" do
      tag = create(:tag, name: "Web開発")

      patch "/api/admin/tags/#{tag.id}", params: { tag: { name: "Web" } }, as: :json

      expect(response).to have_http_status(:ok)
      expect(tag.reload.name).to eq("Web")
    end

    # 改名した名前も入り口で揃える。揃えないと管理画面から表記ゆれを作れてしまう
    it "改名した名前も正規化される" do
      tag = create(:tag, name: "Web開発")

      patch "/api/admin/tags/#{tag.id}", params: { tag: { name: "　Ｗｅｂ　" } }, as: :json

      expect(tag.reload.name).to eq("Web")
    end

    it "同じ用途に同じ名前があると 422" do
      create(:tag, name: "LT", category: :project_event)
      tag = create(:tag, name: "Web開発", category: :project_event)

      patch "/api/admin/tags/#{tag.id}", params: { tag: { name: "LT" } }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
      expect(tag.reload.name).to eq("Web開発")
    end

    it "用途が違えば同じ名前に改名できる" do
      create(:tag, name: "3D", category: :profile)
      tag = create(:tag, name: "Web開発", category: :project_event)

      patch "/api/admin/tags/#{tag.id}", params: { tag: { name: "3D" } }, as: :json

      expect(response).to have_http_status(:ok)
    end

    it "21文字は 422" do
      tag = create(:tag, name: "Web開発")

      patch "/api/admin/tags/#{tag.id}", params: { tag: { name: "あ" * 21 } }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "存在しないIDは 404" do
      patch "/api/admin/tags/999999", params: { tag: { name: "Web" } }, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/admin/tags/:id" do
    before { sign_in(admin) }

    it "使われていないタグは削除できる" do
      tag = create(:tag, name: "孤児")

      expect { delete "/api/admin/tags/#{tag.id}" }.to change(Tag, :count).by(-1)

      expect(response).to have_http_status(:no_content)
    end

    # 中間テーブルが dependent: :destroy なので、消すと企画から黙ってタグが外れる
    it "使われているタグは 422 で止める" do
      tag = create(:tag, name: "Web開発")
      create(:event, tags: [ tag ])

      expect { delete "/api/admin/tags/#{tag.id}" }.not_to change(Tag, :count)

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "プロフィールに付いていても止める" do
      tag = create(:tag, name: "3D", category: :profile)
      create(:user).tags = [ tag ]

      delete "/api/admin/tags/#{tag.id}"

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "存在しないIDは 404" do
      delete "/api/admin/tags/999999"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "作成APIは持たない" do
    # タグは企画かプロフィールに付ける過程で生まれる(docs/spec-tags.md §3.5)。
    # 管理画面から作れると、どこにも付いていないタグが生まれる
    it "POST は 404" do
      sign_in(admin)
      post "/api/admin/tags", params: { tag: { name: "勝手なタグ" } }, as: :json

      expect(response).to have_http_status(:not_found)
    end
  end
end
