require "rails_helper"

# 検証エラーの文言が日本語で出ること。
#
# rails-i18n gem を入れていないので、訳は config/locales/ja.yml に手で書く
# (Issue #176)。**足し忘れると、その項目だけ英語のまま画面に出る。**
# 実際、監査でパスワードの上限が、追加した定員の整数チェックが、
# それぞれ "Translation missing" を画面に出していた。
#
# 検証を足したときにここが落ちれば、訳の足し忘れに気づける。
RSpec.describe "検証エラーの文言" do
  # 画面に出る文字列をそのまま見る。キーの存在ではなく、出力を見ないと
  # 「訳はあるが参照されていない」状態を拾えない
  def messages_for(record)
    record.valid?
    record.errors.full_messages
  end

  it "どのモデルのどの検証も Translation missing を出さない" do
    broken = probes.flat_map { |record| messages_for(record) }
                   .select { |message| message.include?("Translation missing") }

    expect(broken).to be_empty
  end

  it "パスワードが長すぎるときは日本語で返す" do
    user = build(:user, password: "a" * 100)

    expect(messages_for(user)).to include(a_string_including("72バイト"))
  end

  it "定員が整数でないときは日本語で返す" do
    event = build(:event, capacity: 1.5)

    expect(messages_for(event)).to include("定員は整数で入力してください")
  end

  # いま持っている検証をひととおり踏む。新しい検証を足したらここにも足す
  def probes
    [
      build(:event, title: ""),
      build(:event, title: "あ" * 200),
      build(:event, starts_at: nil),
      build(:event, capacity: -1),
      build(:event, capacity: 99_999),
      build(:event, capacity: 1.5),
      build(:event, capacity: "abc"),
      build(:event, external_url: "javascript:x"),
      build(:project, title: ""),
      build(:project, capacity: -1),
      build(:user, name: ""),
      build(:user, email: "bad"),
      build(:user, email: "#{'a' * 300}@e.ac.jp"),
      build(:user, password: "short"),
      build(:user, password: "a" * 100),
      build(:tag, name: ""),
      build(:tag, name: "あ" * 30),
      build(:user_link, label: ""),
      build(:user_link, url: "ftp://example.jp"),
      build(:signage_token, name: "")
    ]
  end
end
