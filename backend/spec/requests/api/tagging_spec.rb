require "rails_helper"

# 企画へのタグ付け。イベントとプロジェクトで同じ仕組みを使う。
#
# タグは自由記述で、名前で受け取る(docs/spec-tags.md §3.7)。
# まだ存在しないタグはIDを持てないので、以前の tag_ids では表現できない。
RSpec.describe "企画へのタグ付け", type: :request do
  let(:owner) { create(:user) }
  let!(:web) { create(:tag, name: "Web開発") }
  let!(:lt) { create(:tag, name: "LT") }

  before { sign_in(owner) }

  describe "イベント" do
    let(:base_params) do
      { title: "LT大会", description: "d", location: "情報棟", starts_at: 10.days.from_now.iso8601 }
    end

    it "tag_names を指定して作成すると中間テーブルに入る" do
      post "/api/events", params: { event: base_params.merge(tag_names: [ "Web開発", "LT" ]) }, as: :json

      expect(response).to have_http_status(:created)
      event = Event.find(response.parsed_body["id"])
      expect(event.tags).to contain_exactly(web, lt)
    end

    # 自由記述の肝。無ければその場で作る(§3.5)
    it "存在しない名前を送ると、その場でタグが作られて付く" do
      expect {
        post "/api/events", params: { event: base_params.merge(tag_names: [ "Photogrammetry" ]) }, as: :json
      }.to change(Tag, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(Event.find(response.parsed_body["id"]).tags.map(&:name)).to eq([ "Photogrammetry" ])
    end

    # 既にあるものを送っただけで増えると、同じ名前の行が2つ並ぶ
    it "既にある名前を送っても二重に作られない" do
      expect {
        post "/api/events", params: { event: base_params.merge(tag_names: [ "Web開発" ]) }, as: :json
      }.not_to change(Tag, :count)
    end

    # 入り口で形を揃える(§3.1)。揃えないと Web開発 と Ｗｅｂ開発 が別の行になる
    it "全角と空白は正規化してから引く" do
      post "/api/events", params: { event: base_params.merge(tag_names: [ "　Ｗｅｂ開発　" ]) }, as: :json

      expect(response).to have_http_status(:created)
      expect(Event.find(response.parsed_body["id"]).tags).to eq([ web ])
    end

    # 正規化してから重複を取り除く。UNIQUE(event_id, tag_id) に衝突させない
    it "正規化すると同じになる名前は1件にまとまる" do
      post "/api/events", params: { event: base_params.merge(tag_names: [ "Web開発", "Ｗｅｂ開発" ]) }, as: :json

      expect(response).to have_http_status(:created)
      expect(Event.find(response.parsed_body["id"]).tags).to eq([ web ])
    end

    # 企画とプロフィールで語彙を分ける(§3.4)。
    # 同じ名前でも別の行になり、互いの候補には出てこない
    it "プロフィール用の同名タグとは別の行を作る" do
      profile_tag = create(:tag, name: "3D", category: :profile)

      post "/api/events", params: { event: base_params.merge(tag_names: [ "3D" ]) }, as: :json

      expect(response).to have_http_status(:created)
      created = Event.find(response.parsed_body["id"]).tags.first
      expect(created).not_to eq(profile_tag)
      expect(created).to be_project_event
    end

    it "6個送ると 422 を返し、作成しない" do
      expect {
        post "/api/events", params: { event: base_params.merge(tag_names: %w[a b c d e f]) }, as: :json
      }.not_to change(Event, :count)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["error"].keys).to contain_exactly("code", "message")
    end

    it "5個までは通る" do
      post "/api/events", params: { event: base_params.merge(tag_names: %w[a b c d e]) }, as: :json

      expect(response).to have_http_status(:created)
    end

    it "21文字を送ると 422 を返す" do
      post "/api/events", params: { event: base_params.merge(tag_names: [ "あ" * 21 ]) }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    # 配列以外や文字列でない値を渡されても 500 にせず 422 で弾く
    it "tag_names が配列でない場合は 422 を返す" do
      post "/api/events", params: { event: base_params.merge(tag_names: { "0" => "Web開発" }) }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "tag_names に文字列でない値が混ざると 422 を返す" do
      post "/api/events", params: { event: base_params.merge(tag_names: [ "Web開発", 12 ]) }, as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end

    # 空文字だけを送られたときに空のタグを作らない
    it "空白だけの名前は無視する" do
      post "/api/events", params: { event: base_params.merge(tag_names: [ "　 　" ]) }, as: :json

      expect(response).to have_http_status(:created)
      expect(Event.find(response.parsed_body["id"]).tags).to be_empty
    end

    context "編集" do
      let!(:event) { create(:event, owner: owner, tags: [ web ]) }

      it "tag_names を渡すと差し替わる" do
        patch "/api/events/#{event.id}", params: { event: { tag_names: [ "LT" ] } }, as: :json

        expect(event.reload.tags).to eq([ lt ])
      end

      it "tag_names を省くとタグを変更しない" do
        patch "/api/events/#{event.id}", params: { event: { location: "別の場所" } }, as: :json

        expect(event.reload.tags).to eq([ web ])
      end

      # タグの割り当ては中間テーブルへ即座に書き込まれるため、
      # 本体の更新が失敗したときに巻き戻らないと、タグだけ変わった状態が残る
      it "本体の更新が失敗したらタグも巻き戻る" do
        patch "/api/events/#{event.id}",
              params: { event: { title: "", tag_names: [ "LT" ] } }, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(event.reload.tags).to eq([ web ])
      end
    end
  end

  describe "プロジェクト" do
    it "tag_names を指定して作成すると中間テーブルに入る" do
      post "/api/projects",
           params: { project: { title: "開発チーム", description: "d", tag_names: [ "Web開発" ] } },
           as: :json

      expect(response).to have_http_status(:created)
      expect(Project.find(response.parsed_body["id"]).tags).to eq([ web ])
    end

    it "存在しない名前でもその場で作られる" do
      expect {
        post "/api/projects",
             params: { project: { title: "開発チーム", description: "d", tag_names: [ "Blender" ] } },
             as: :json
      }.to change(Tag, :count).by(1)

      expect(response).to have_http_status(:created)
    end

    it "6個送ると 422 を返す" do
      post "/api/projects",
           params: { project: { title: "開発チーム", description: "d", tag_names: %w[a b c d e f] } },
           as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end
end
