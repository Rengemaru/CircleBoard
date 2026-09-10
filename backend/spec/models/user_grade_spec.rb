require "rails_helper"

# 学年の表記(B1 / M1 / D2 …)。オーナー決定 2026-09-11。
#
# 入学年度からの通算年数で決める。年度は4月始まりなので、
# 3月31日までは据え置き、4月1日に1つ繰り上がる。
#
# 境界(4年目→5年目、6年目→7年目、9年目の次)を必ず両側から見る。
# 片側だけだと「常に B を返す実装」でも通ってしまう。
RSpec.describe "User#grade" do
  # 入学年度と「その年度の9月時点」を渡して学年を得る
  def grade_at(enrollment_year:, years_later:, graduation_year: 2099)
    user = build(:user, enrollment_year: enrollment_year, graduation_year: graduation_year)
    user.grade(Date.new(enrollment_year + years_later, 9, 1))
  end

  describe "通算年数と表記の対応" do
    {
      0 => "B1", 1 => "B2", 2 => "B3", 3 => "B4",
      4 => "M1", 5 => "M2",
      6 => "D1", 7 => "D2", 8 => "D3"
    }.each do |years_later, expected|
      it "#{years_later + 1}年目は #{expected}" do
        expect(grade_at(enrollment_year: 2020, years_later: years_later)).to eq(expected)
      end
    end

    # オーナーが挙げた例をそのまま置く。表を書き換えたときに、
    # 何を守るつもりだったのかが読み取れるようにしておく
    it "3年目 B3 / 5年目 M1 / 8年目 D2（決定時に挙がった例）" do
      expect(grade_at(enrollment_year: 2020, years_later: 2)).to eq("B3")
      expect(grade_at(enrollment_year: 2020, years_later: 4)).to eq("M1")
      expect(grade_at(enrollment_year: 2020, years_later: 7)).to eq("D2")
    end
  end

  describe "年度の切り替わり" do
    let(:user) { build(:user, enrollment_year: 2026, graduation_year: 2099) }

    it "3月31日までは据え置き" do
      expect(user.grade(Date.new(2027, 3, 31))).to eq("B1")
    end

    it "4月1日に1つ繰り上がる" do
      expect(user.grade(Date.new(2027, 4, 1))).to eq("B2")
    end

    # 1〜3月は前年度に属する。ここを間違えると、卒業直前の3月に
    # 学年が1つ進んで見える
    it "1月は前年度のまま" do
      expect(user.grade(Date.new(2027, 1, 5))).to eq("B1")
    end
  end

  describe "学年を出さない場合" do
    it "卒業年度を過ぎていたら nil" do
      user = build(:user, enrollment_year: 2020, graduation_year: 2024)

      expect(user.grade(Date.new(2026, 9, 1))).to be_nil
    end

    # 卒業する年度の3月までは在学中。4月に入って初めて卒業生になる
    it "卒業年度の年度内はまだ学年が出る" do
      user = build(:user, enrollment_year: 2023, graduation_year: 2027)

      expect(user.grade(Date.new(2027, 3, 31))).to eq("B4")
      expect(user.grade(Date.new(2027, 4, 1))).to be_nil
    end

    it "入学年度が未来なら nil" do
      user = build(:user, enrollment_year: 2030, graduation_year: 2034)

      expect(user.grade(Date.new(2026, 9, 1))).to be_nil
    end

    # 博士の3年を超えているが卒業年度は先、という状態。
    # 当てずっぽうの表記を出すより、出さない方がよい
    it "10年目以降は nil" do
      expect(grade_at(enrollment_year: 2020, years_later: 9)).to be_nil
    end
  end
end
