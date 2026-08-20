FactoryBot.define do
  factory :event_participation do
    association :event
    association :user
    cancelled_at { nil }
  end
end
