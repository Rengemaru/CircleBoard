require "rails_helper"

# イベント一覧の絞り込み。
# ワイヤーフレーム画面②「既定は status=recruiting のみ表示。終了イベントは
# 表示しない」「絞り込みは ?tag_ids= で行い、URLで共有できる状態にする」に対応する。
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

  # status を completed に変え忘れた企画は運用上必ず出る。
  # 外さないとトップと一覧に「あと-1日」が並ぶ
  describe "開催日が過ぎた募集中イベント" do
    let!(:past) { create(:event, title: "終わった会", status: :recruiting, starts_at: 1.day.ago) }

    it "既定では返さない" do
      get "/api/events"

      expect(titles).not_to include("終わった会")
    end

    it "status=recruiting を明示しても返さない" do
      get "/api/events", params: { status: "recruiting" }

      expect(titles).not_to include("終わった会")
    end

    it "tag_ids と併用しても返さない" do
      past.tags = [ tag ]

      get "/api/events", params: { tag_ids: tag.id }

      expect(titles).to be_empty
    end

    # completed は終わったものを見に行く指定。日付で絞ると必ず0件になる
    it "status=completed のときは日付で絞らない" do
      create(:event, title: "先月の会", status: :completed, starts_at: 1.month.ago)

      get "/api/events", params: { status: "completed" }

      expect(titles).to contain_exactly("終了した会", "先月の会")
    end

    # 「まだ開催されていない」の基準はサイネージと同じ(Event.upcoming)。
    # 別々に書くと23時台だけ食い違う
    it "開催当日は23時までは返す" do
      travel_to(Time.zone.local(2026, 6, 15, 22, 59, 0)) do
        create(:event, title: "今夜の会", status: :recruiting,
                       starts_at: Time.zone.local(2026, 6, 15, 19, 0, 0))

        get "/api/events"

        expect(titles).to include("今夜の会")
      end
    end

    it "開催当日でも23時を過ぎたら返さない" do
      travel_to(Time.zone.local(2026, 6, 15, 23, 0, 0)) do
        create(:event, title: "今夜の会", status: :recruiting,
                       starts_at: Time.zone.local(2026, 6, 15, 19, 0, 0))

        get "/api/events"

        expect(titles).not_to include("今夜の会")
      end
    end
  end

  describe "tag_ids" do
    before { hackathon.tags = [ tag ] }

    it "指定したタグを持つイベントだけを返す" do
      get "/api/events", params: { tag_ids: tag.id }

      expect(titles).to eq([ "ハッカソン" ])
    end

    # 複数指定は OR。AND にするとタグを足すほど0件に近づく
    it "複数指定したときは、どれか1つでも持つイベントを返す" do
      other = create(:tag, name: "LT")
      lt = create(:event, title: "LT会", starts_at: 5.days.from_now, tags: [ other ])

      get "/api/events", params: { tag_ids: "#{tag.id},#{other.id}" }

      expect(titles).to contain_exactly("ハッカソン", lt.title)
    end

    # 2つのタグが付いたイベントは join で2行になる。distinct が要る
    it "複数のタグを持つイベントが重複しない" do
      other = create(:tag, name: "LT")
      hackathon.tags = [ tag, other ]

      get "/api/events", params: { tag_ids: "#{tag.id},#{other.id}" }

      expect(titles).to eq([ "ハッカソン" ])
    end

    it "空のときは絞り込まない" do
      get "/api/events", params: { tag_ids: "" }

      expect(titles).to include("ハッカソン")
    end

    # URLを手で書き換えられてもエラーにしない
    it "数字でない値は無視する" do
      get "/api/events", params: { tag_ids: "abc" }

      expect(titles).to include("ハッカソン")
    end

    # Integer("010") は基数を省くと8進数として 8 になる。フロントの
    # Number("010") は 10 なので、押したタグと違う結果が返る
    it "先頭にゼロが付いていても10進数として読む" do
      other = create(:tag, name: "10番目のタグ")
      lt = create(:event, title: "ゼロ埋めの会", starts_at: 5.days.from_now, tags: [ other ])

      get "/api/events", params: { tag_ids: format("%03d", other.id) }

      expect(titles).to eq([ lt.title ])
    end

    # 桁の大きい値を渡しても 500 にしない
    # (docs/api-spec.md「URLを手で書き換えられてもエラーにせず」)
    it "bigint を超える値でもエラーにならない" do
      get "/api/events", params: { tag_ids: "99999999999999999999" }

      expect(response).to have_http_status(:ok)
      expect(titles).to be_empty
    end

    it "負の値でもエラーにならない" do
      get "/api/events", params: { tag_ids: "-1" }

      expect(response).to have_http_status(:ok)
      expect(titles).to be_empty
    end

    it "数字でない値が混ざっていても、数字の分だけで絞る" do
      get "/api/events", params: { tag_ids: "abc,#{tag.id}" }

      expect(titles).to eq([ "ハッカソン" ])
    end

    it "存在しないタグIDでは0件になる" do
      get "/api/events", params: { tag_ids: 999_999 }

      expect(titles).to be_empty
    end

    it "status と併用できる" do
      finished.tags = [ tag ]

      get "/api/events", params: { tag_ids: tag.id, status: "completed" }

      expect(titles).to eq([ "終了した会" ])
    end

    # 論理削除済みは絞り込みの結果にも出てはいけない
    it "論理削除済みは tag_ids で絞っても出ない" do
      hackathon.trashed!

      get "/api/events", params: { tag_ids: tag.id }

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
