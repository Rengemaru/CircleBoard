require "rails_helper"

# 「在学何年目か」と入学年度・卒業年度の相互変換(オーナー決定 2026-09-11)。
#
# 管理画面が入力するのはこの数字だけで、年度は入れない。逆算を1つ間違えると
# 全員の学年がまとめてずれるので、年度の切り替わりを両側から見る。
RSpec.describe "User の在学年数" do
  # 年度は4月始まり。9月は必ずその年度の内側にある
  let(:autumn) { Date.new(2026, 9, 1) }

  describe "#grade_years" do
    it "入学した年度は1年目" do
      expect(build(:user, enrollment_year: 2026).grade_years(autumn)).to eq(1)
    end

    it "6年前に入学していれば7年目" do
      expect(build(:user, enrollment_year: 2020).grade_years(autumn)).to eq(7)
    end

    # 1〜3月はまだ前年度。ここを間違えると、卒業直前の3月に1つ進んで見える
    it "3月31日までは繰り上がらない" do
      expect(build(:user, enrollment_year: 2026).grade_years(Date.new(2027, 3, 31))).to eq(1)
    end

    it "4月1日に繰り上がる" do
      expect(build(:user, enrollment_year: 2026).grade_years(Date.new(2027, 4, 1))).to eq(2)
    end
  end

  describe ".enrollment_year_for" do
    it "3年目なら2年前の入学" do
      expect(User.enrollment_year_for(3, autumn)).to eq(2024)
    end

    # 往復して元の数字に戻らなければ、画面で入れた学年と表示がずれる
    it "grade_years と往復しても同じ数字に戻る" do
      User::GRADE_YEARS_RANGE.each do |years|
        user = build(:user, enrollment_year: User.enrollment_year_for(years, autumn))

        expect(user.grade_years(autumn)).to eq(years)
      end
    end

    # オーナーが挙げた例をそのまま置く。入力した数字がどの表記になるかは、
    # この機能で一番見られる部分
    it "3→B3 / 5→M1 / 8→D2 になる" do
      { 3 => "B3", 5 => "M1", 8 => "D2" }.each do |years, expected|
        expect(user_at(years).grade(autumn)).to eq(expected)
      end
    end
  end

  describe ".graduation_year_for" do
    # いま在籍している課程の終わりで卒業するとみなす。
    # 卒業年度を人手で入れない以上、どこかで決め打つしかない
    it "学部生は4年目の年度末に卒業する" do
      expect(User.graduation_year_for(3, autumn)).to eq(2028)
      expect(User.graduation_year_for(4, autumn)).to eq(2027)
    end

    it "修士は6年目の年度末" do
      expect(User.graduation_year_for(5, autumn)).to eq(2028)
      expect(User.graduation_year_for(6, autumn)).to eq(2027)
    end

    it "博士は9年目の年度末" do
      expect(User.graduation_year_for(7, autumn)).to eq(2029)
      expect(User.graduation_year_for(9, autumn)).to eq(2027)
    end

    # 入れた直後に卒業生扱いになると、学年が消えて一覧が灰色になる
    it "入れた学年の範囲では卒業生にならない" do
      User::GRADE_YEARS_RANGE.each do |years|
        expect(user_at(years).graduated?(autumn)).to be(false)
      end
    end

    it "最終学年は次の4月に卒業生になる" do
      user = user_at(4)

      expect(user.graduated?(Date.new(2027, 3, 31))).to be(false)
      expect(user.graduated?(Date.new(2027, 4, 1))).to be(true)
    end
  end

  describe "GRADE_YEARS_RANGE" do
    # 0 と 10 以上は入力させない(オーナー決定 2026-09-11)。
    # 10年目以降は grade が表記を決められず、0 以下は在学していない
    it "1〜9" do
      expect(User::GRADE_YEARS_RANGE).to eq(1..9)
    end

    it "範囲の外では grade が表記を出せない" do
      enrolled = User.enrollment_year_for(10, autumn)
      # まだ卒業していない10年目。年度の範囲検証に落ちない最大の卒業年度にする
      outside = build(:user, enrollment_year: enrolled,
                             graduation_year: enrolled + User::MAX_YEARS_TO_GRADUATION)

      expect(outside.grade(autumn)).to be_nil
    end
  end

  # 「その年度に在学 n 年目の人」を作る。管理画面が学年を保存したのと同じ形
  def user_at(years)
    build(
      :user,
      enrollment_year: User.enrollment_year_for(years, autumn),
      graduation_year: User.graduation_year_for(years, autumn)
    )
  end
end
