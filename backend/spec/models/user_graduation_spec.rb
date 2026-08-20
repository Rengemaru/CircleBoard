require "rails_helper"

# 卒業したかどうかの判定(User#graduated?)。
#
# 日本の学年は4月始まりで卒業は3月。年度の切り替わりを跨ぐので、
# 「今年 = 卒業年度なら卒業生」と単純に比べると、1〜3月に在学生を卒業生にしてしまう。
RSpec.describe User, "#graduated?" do
  let(:user) { build(:user, graduation_year: 2026) }

  context "2026年3月に卒業する人" do
    it "2026年3月31日はまだ在学中" do
      expect(user.graduated?(Date.new(2026, 3, 31))).to be(false)
    end

    it "2026年4月1日から卒業生になる" do
      expect(user.graduated?(Date.new(2026, 4, 1))).to be(true)
    end

    it "2026年8月は卒業生" do
      expect(user.graduated?(Date.new(2026, 8, 20))).to be(true)
    end

    it "2027年1月も卒業生のまま" do
      expect(user.graduated?(Date.new(2027, 1, 1))).to be(true)
    end
  end

  context "2027年3月に卒業する人" do
    let(:user) { build(:user, graduation_year: 2027) }

    it "2026年8月は在学中" do
      expect(user.graduated?(Date.new(2026, 8, 20))).to be(false)
    end

    # ここを間違えると、卒業前の1〜3月に在学生が一覧から「卒業生」に化ける
    it "2027年1月はまだ在学中" do
      expect(user.graduated?(Date.new(2027, 1, 1))).to be(false)
    end

    it "2027年4月1日から卒業生になる" do
      expect(user.graduated?(Date.new(2027, 4, 1))).to be(true)
    end
  end
end
