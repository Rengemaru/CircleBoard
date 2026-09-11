FactoryBot.define do
  factory :event do
    sequence(:title) { |n| "テストイベント#{n}" }
    description { "説明" }
    location { "部室A" }
    starts_at { 3.days.from_now }
    association :owner, factory: :user

    # 過去日時のイベントは、作成時の検証(Event#starts_at_not_in_past)を通さずに作る。
    #
    # 「開催日が過ぎたのに募集中のまま」は実際に起きる状態で、一覧の upcoming も
    # サイネージもその前提で書かれている。作成時の検証はその状態を**新しく作らせない**
    # ためのもので、すでにそうなっている企画を否定するものではない。
    # テストではその状態を直接用意したいので、ここだけ迂回する。
    #
    # 拒否されること自体を確かめる spec は build を使う(create を通さない)
    to_create do |event|
      past = event.starts_at.present? && event.starts_at < Event.upcoming_from
      event.save!(validate: !past)
    end
  end
end
