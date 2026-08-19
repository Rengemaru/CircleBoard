require "rails_helper"

# T1-7 では基盤が動くことの確認に絞る。境界値を含む厚いテストは
# Event#calculate_spotlight_score に対して T3-1 で書く(CLAUDE.md §6)。
RSpec.describe Event, type: :model do
  it "必須項目が揃っていれば有効" do
    expect(build(:event)).to be_valid
  end

  # DB の NOT NULL 制約に対応する presence を確認する(仕様書 §2.2)
  %i[title description location starts_at].each do |column|
    it "#{column} が無いと無効" do
      event = build(:event, column => nil)
      expect(event).not_to be_valid
      expect(event.errors[column]).to be_present
    end
  end
end
