require "rails_helper"

# 定員の範囲(2026-09-12 の監査で追加。オーナー承認済み)。
#
# 監査では検証が1つも無く、capacity: -5 が HTTP 201 で保存できていた。
# 負の定員は full? が「参加者数 >= -5」で常に true になり、誰も参加できない
# 企画ができる。int4 を超える値では 422 ではなく 500 が返っていた。
RSpec.describe "定員の範囲" do
  shared_examples "定員の検証" do |factory, limit|
    it "1 は通る" do
      expect(build(factory, capacity: 1)).to be_valid
    end

    it "#{limit} は通る" do
      expect(build(factory, capacity: limit)).to be_valid
    end

    # nil = 無制限は仕様(spec-v2.2.md §2.2/§2.3)。numericality は
    # allow_nil を付けないと nil を不正として弾くので、必ず確かめる
    it "未入力（無制限）は通る" do
      expect(build(factory, capacity: nil)).to be_valid
    end

    it "0 は止まる" do
      expect(build(factory, capacity: 0)).not_to be_valid
    end

    # 監査で実際に 201 が返っていた値
    it "-5 は止まる" do
      record = build(factory, capacity: -5)

      expect(record).not_to be_valid
      expect(record.errors[:capacity]).to be_present
    end

    it "#{limit + 1} は止まる" do
      expect(build(factory, capacity: limit + 1)).not_to be_valid
    end

    it "小数は止まる" do
      expect(build(factory, capacity: 1.5)).not_to be_valid
    end
  end

  describe Event do
    include_examples "定員の検証", :event, Event::MAX_CAPACITY
  end

  describe Project do
    include_examples "定員の検証", :project, Project::MAX_CAPACITY
  end

  # 負の定員が通っていたときに壊れていた振る舞い。
  # 上限を入れた理由そのものなので、一緒に固定しておく
  describe "full? が壊れないこと" do
    it "定員なしの企画は満員にならない" do
      event = create(:event, capacity: nil)

      expect(event).not_to be_full
    end
  end
end
