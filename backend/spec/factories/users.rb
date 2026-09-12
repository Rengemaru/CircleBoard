FactoryBot.define do
  factory :user do
    sequence(:name) { |n| "テストユーザー#{n}" }
    sequence(:email) { |n| "user#{n}@example.ac.jp" }
    password { "password123" }
    role { :member }
    enrollment_year { 2026 }
    graduation_year { 2030 }

    # **既定は「自分でパスワードを設定済み」。** 普段の部員はこの状態で、
    # ほとんどの spec が見たいのもこちら(Issue #288)。
    #
    # 実物の発行直後は nil だが、それを既定にすると全ての spec が
    # 403 になり、何を試している spec なのか分からなくなる。
    # 発行直後を試したいときは :initial_password を付ける
    password_changed_at { Time.current }

    # 管理者が発行したパスワードのまま。他のAPIは403で弾かれる
    trait :initial_password do
      password_changed_at { nil }
    end
  end
end
