require "rails_helper"

# イベント一覧の絞り込み。
# ワイヤーフレーム画面②「既定は status=recruiting のみ表示。終了イベントは
# 表示しない」「絞り込みは ?tag_id= で行い、URLで共有できる状態にする」に対応する。
RSpec.describe "GET /api/events の絞り込み", type: :request do
  let!(:hackathon) { create(:event, title: "ハッカソン", status: :recruiting) }
  let!(:lt) { create(:event, title: "LT会", status: :recruiting) }
  let!(:finished) { create(:event, title: "終了した会", status: :completed) }
  let(:tag) { create(:tag, name: "ハッカソン") }

  def titles
    response.parsed_body["events"].map { _1["title"] }
  end

  describe "status" do
    # 「過去の企画」セクションは MVP 対象外(CLAUDE.md §10)
    it "既定では募集中のみを返し、終了イベントは含めない" do
      get "/api/events"

      expect(titles).to contain_exactly("ハッカソン", "LT会")
    end

    it "status=completed を指定すると終了イベントだけを返す" do
      get "/api/events", params: { status: "completed" }

      expect(titles).to eq([ "終了した会" ])
    end

    it "status=recruiting を明示しても既定と同じ" do
      get "/api/events", params: { status: "recruiting" }

      expect(titles).to contain_exactly("ハッカソン", "LT会")
    end

    # URLを手で編集されただけで画面が壊れるのを避ける
    it "未知の status は既定（募集中のみ）に戻す" do
      get "/api/events", params: { status: "unknown" }

      expect(titles).to contain_exactly("ハッカソン", "LT会")
    end
  end

  describe "tag_id" do
    before { hackathon.tags = [ tag ] }

    it "指定したタグを持つイベントだけを返す" do
      get "/api/events", params: { tag_id: tag.id }

      expect(titles).to eq([ "ハッカソン" ])
    end

    it "存在しないタグIDでは0件になる" do
      get "/api/events", params: { tag_id: 999_999 }

      expect(titles).to be_empty
    end

    it "status と併用できる" do
      finished.tags = [ tag ]

      get "/api/events", params: { tag_id: tag.id, status: "completed" }

      expect(titles).to eq([ "終了した会" ])
    end

    # 論理削除済みは絞り込みの結果にも出てはいけない
    it "論理削除済みは tag_id で絞っても出ない" do
      hackathon.trashed!

      get "/api/events", params: { tag_id: tag.id }

      expect(titles).to be_empty
    end
  end
end

# トップページの「注目イベント」は、ピン留めを先頭に spotlight_score 降順で
# 並べる(wireframes/wireframe-member.html 画面①)。
# ただし score そのものは公開しない(画面② A2 の要求)。
RSpec.describe "GET /api/events の並び順", type: :request do
  # 画面② は日付順で描かれている。一覧としてはこちらが素直
  it "既定では開催日の近い順で返す" do
    late = create(:event, starts_at: 7.days.from_now, spotlight_score: 200)
    early = create(:event, starts_at: 3.days.from_now, spotlight_score: 1)

    get "/api/events"

    expect(response.parsed_body["events"].map { _1["id"] }).to eq([ early.id, late.id ])
  end

  # トップページの「注目イベント」枠(画面①)が要求する順序
  it "?sort=spotlight ではピン留めを先頭に、残りを spotlight_score の降順で返す" do
    low = create(:event, starts_at: 5.days.from_now, spotlight_score: 10)
    high = create(:event, starts_at: 6.days.from_now, spotlight_score: 200)
    pinned = create(:event, starts_at: 7.days.from_now, spotlight_score: 1, pinned: true)

    get "/api/events", params: { sort: "spotlight" }

    ids = response.parsed_body["events"].map { _1["id"] }
    expect(ids).to eq([ pinned.id, high.id, low.id ])
  end

  it "未知の sort は既定（日付順）に戻す" do
    late = create(:event, starts_at: 7.days.from_now, spotlight_score: 200)
    early = create(:event, starts_at: 3.days.from_now, spotlight_score: 1)

    get "/api/events", params: { sort: "unknown" }

    expect(response.parsed_body["events"].map { _1["id"] }).to eq([ early.id, late.id ])
  end

  it "pinned を返す（トップページの📌バッジに使う）" do
    create(:event, pinned: true)

    get "/api/events"

    expect(response.parsed_body["events"].first["pinned"]).to be(true)
  end

  # 数値が見えると、順位を上げるための操作を誘発する
  it "spotlight_score は返さない" do
    create(:event, spotlight_score: 210)

    get "/api/events"

    expect(response.parsed_body["events"].first.keys).not_to include("spotlight_score")
  end
end
