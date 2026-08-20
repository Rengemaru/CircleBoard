require "rails_helper"

# 企画へのタグ付け。イベントとプロジェクトで同じ仕組みを使う。
RSpec.describe "企画へのタグ付け", type: :request do
  let(:owner) { create(:user) }
  let!(:web) { create(:tag, name: "Web開発") }
  let!(:lt) { create(:tag, name: "LT") }

  before { sign_in(owner) }

  describe "イベント" do
    let(:base_params) do
      { title: "LT大会", description: "d", location: "情報棟", starts_at: 10.days.from_now.iso8601 }
    end

    it "tag_ids を指定して作成すると中間テーブルに入る" do
      post "/api/events", params: { event: base_params.merge(tag_ids: [ web.id, lt.id ]) }, as: :json

      expect(response).to have_http_status(:created)
      event = Event.find(response.parsed_body["id"])
      expect(event.tags).to contain_exactly(web, lt)
    end

    # 同じIDを2回渡されても UNIQUE(event_id, tag_id) に衝突させない
    it "同じタグを重複指定しても1件だけ入る" do
      post "/api/events", params: { event: base_params.merge(tag_ids: [ web.id, web.id ]) }, as: :json

      expect(response).to have_http_status(:created)
      expect(Event.find(response.parsed_body["id"]).tags).to eq([ web ])
    end

    # 黙って無視すると、タグを付けたつもりが付いていない状態に気づけない
    it "存在しないタグIDを混ぜると 422 を返し、作成しない" do
      expect {
        post "/api/events", params: { event: base_params.merge(tag_ids: [ web.id, 9999 ]) }, as: :json
      }.not_to change(Event, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["error"].keys).to contain_exactly("code", "message")
    end

    # 配列以外や数値でない値を渡されても 500 にせず 422 で弾く
    it "tag_ids が配列でない場合は 422 を返す" do
      post "/api/events", params: { event: base_params.merge(tag_ids: { "0" => web.id }) }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "tag_ids に数値でない値が混ざると 422 を返す" do
      post "/api/events", params: { event: base_params.merge(tag_ids: [ web.id, "abc" ]) }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "category: skill のタグは指定できない" do
      skill = create(:tag, name: "Rails", category: :skill)

      post "/api/events", params: { event: base_params.merge(tag_ids: [ skill.id ]) }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    context "編集" do
      let!(:event) { create(:event, owner: owner, tags: [ web ]) }

      it "tag_ids を渡すと差し替わる" do
        patch "/api/events/#{event.id}", params: { event: { tag_ids: [ lt.id ] } }, as: :json

        expect(event.reload.tags).to eq([ lt ])
      end

      it "tag_ids を省くとタグを変更しない" do
        patch "/api/events/#{event.id}", params: { event: { location: "別の場所" } }, as: :json

        expect(event.reload.tags).to eq([ web ])
      end

      # タグの割り当ては中間テーブルへ即座に書き込まれるため、
      # 本体の更新が失敗したときに巻き戻らないと、タグだけ変わった状態が残る
      it "本体の更新が失敗したらタグも巻き戻る" do
        patch "/api/events/#{event.id}",
              params: { event: { title: "", tag_ids: [ lt.id ] } }, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(event.reload.tags).to eq([ web ])
      end
    end
  end

  describe "プロジェクト" do
    it "tag_ids を指定して作成すると中間テーブルに入る" do
      post "/api/projects",
           params: { project: { title: "開発チーム", description: "d", tag_ids: [ web.id ] } },
           as: :json

      expect(response).to have_http_status(:created)
      expect(Project.find(response.parsed_body["id"]).tags).to eq([ web ])
    end

    it "存在しないタグIDを混ぜると 422 を返す" do
      post "/api/projects",
           params: { project: { title: "開発チーム", description: "d", tag_ids: [ 9999 ] } },
           as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
