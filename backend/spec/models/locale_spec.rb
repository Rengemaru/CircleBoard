require "rails_helper"

# 検証エラーが日本語で返ることの確認(Issue #176)。
#
# ここが英語に戻ると、部員には何を直せばよいか分からない画面が出る。
# 属性名の訳を書き忘れると**その項目だけ**英語になるので、
# 画面に出る主要な項目を一通り並べて押さえる。
RSpec.describe "検証エラーの文言" do
  it "既定のロケールが :ja" do
    expect(I18n.default_locale).to eq(:ja)
  end

  it "必須の項目は「〜を入力してください」" do
    user = User.new

    user.valid?

    expect(user.errors.full_messages).to include("名前を入力してください", "メールアドレスを入力してください")
  end

  it "長すぎる項目は「〜文字以内で入力してください」" do
    user = build(:user, bio: "あ" * 501)

    user.valid?

    expect(user.errors.full_messages).to include("自己紹介は500文字以内で入力してください")
  end

  it "重複は「すでに使われています」" do
    create(:user, email: "taken@example.ac.jp")
    user = build(:user, email: "taken@example.ac.jp")

    user.valid?

    expect(user.errors.full_messages).to include("メールアドレスはすでに使われています")
  end

  # 属性名の訳を1つでも落とすと、その項目だけ英語のまま残る。
  # 画面に出る項目を並べて、落ちていないことを見る。
  #
  # 「日本語かどうか」では判定できない（MTGの予定・URL のように、
  # 訳した結果に英字が残る項目がある）。訳が無いと Rails が
  # humanize した英語を返すので、それと違うことを見る
  it "画面に出る項目の名前に、訳の書き忘れが無い" do
    targets = {
      User => %i[name email password department bio enrollment_year graduation_year],
      Event => %i[title description location starts_at capacity external_url],
      Project => %i[title description activity_schedule meeting_schedule capacity],
      UserLink => %i[label url],
      SignageToken => %i[name]
    }

    untranslated = targets.flat_map do |model, attrs|
      attrs.filter_map do |attr|
        "#{model}##{attr}" if model.human_attribute_name(attr) == attr.to_s.humanize
      end
    end

    expect(untranslated).to be_empty
  end
end
