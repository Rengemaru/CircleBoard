FactoryBot.define do
  factory :user_link do
    user
    sequence(:label) { |n| "リンク#{n}" }
    sequence(:url) { |n| "https://example.com/#{n}" }
    position { 0 }
  end
end
