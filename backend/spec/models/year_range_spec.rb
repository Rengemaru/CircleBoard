require "rails_helper"

# 入学年度と卒業年度の範囲(2026-09-12 の監査で追加。オーナー承認済み)。
#
# NOT NULL なだけで 0 も 99999 も通っていた。学年表記も卒業判定も年度から
# 計算するので、そこが壊れると両方おかしくなる。
RSpec.describe "年度の範囲" do
  let(:this_year) { User.academic_year }

  describe "入学年度" do
    it "今年度は通る" do
      expect(build(:user, enrollment_year: this_year, graduation_year: this_year + 4)).to be_valid
    end

    # 在学は最長でも9年目まで。10年前は上限ちょうど
    it "10年前は通る" do
      enrolled = this_year - User::ENROLLMENT_YEARS_BACK

      expect(build(:user, enrollment_year: enrolled, graduation_year: enrolled + 4)).to be_valid
    end

    it "11年前は止まる" do
      enrolled = this_year - User::ENROLLMENT_YEARS_BACK - 1

      expect(build(:user, enrollment_year: enrolled, graduation_year: enrolled + 4)).not_to be_valid
    end

    # 翌年度の入学者を先に登録できるようにしている
    it "翌年度は通る" do
      expect(build(:user, enrollment_year: this_year + 1, graduation_year: this_year + 5)).to be_valid
    end

    it "再来年度は止まる" do
      expect(build(:user, enrollment_year: this_year + 2, graduation_year: this_year + 6)).not_to be_valid
    end

    # 監査で実際に通っていた値
    it "0 は止まる" do
      expect(build(:user, enrollment_year: 0, graduation_year: 4)).not_to be_valid
    end

    # 代入は通り、保存するときに ActiveModel::RangeError で 500 になっていた
    it "int4 を超える値は検証で止まる（保存まで行かせない）" do
      user = build(:user, enrollment_year: 2_147_483_648)

      expect(user).not_to be_valid
      expect(user.errors[:enrollment_year]).to be_present
    end
  end

  describe "卒業年度" do
    let(:enrolled) { this_year - 2 }

    it "入学年度の10年後までは通る" do
      expect(build(:user, enrollment_year: enrolled,
                          graduation_year: enrolled + User::MAX_YEARS_TO_GRADUATION)).to be_valid
    end

    it "入学年度の11年後は止まる" do
      expect(build(:user, enrollment_year: enrolled,
                          graduation_year: enrolled + User::MAX_YEARS_TO_GRADUATION + 1)).not_to be_valid
    end

    # 下限は入学年度と同じ年まで。一覧の「卒業生にする」が卒業年度を今の年度まで
    # 引き寄せるので、入学した年度に辞めた人は両方が同じ年になる
    it "入学年度と同じ年は通る" do
      expect(build(:user, enrollment_year: enrolled, graduation_year: enrolled)).to be_valid
    end

    it "入学年度より前は止まる" do
      expect(build(:user, enrollment_year: enrolled, graduation_year: enrolled - 1)).not_to be_valid
    end
  end

  # **古い卒業生の記録を触れなくしない。** 毎回見ていると、20年前に入学した人を
  # 停止しようとしただけで年度の検証に落ちる
  describe "既存の記録" do
    let(:old_graduate) do
      user = build(:user, enrollment_year: this_year - 20, graduation_year: this_year - 16)
      user.save!(validate: false)
      user
    end

    it "範囲の外にいても、年度に触らない更新は通る" do
      expect { old_graduate.suspend! }.not_to raise_error
      expect(old_graduate.reload).to be_suspended
    end

    it "年度を変えようとすると止まる" do
      old_graduate.enrollment_year = this_year - 30

      expect(old_graduate).not_to be_valid
    end
  end
end
