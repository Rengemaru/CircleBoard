Rails.application.routes.draw do
  # 死活監視。/api 配下ではない。認証不要(docs/api-spec.md §7)。
  get "/healthz", to: "healthz#show"

  namespace :api do
    # 単数形リソース。ログイン中のセッションは常に1つなのでIDを取らない
    resource :session, only: [ :show, :create, :destroy ]
    resources :events, only: [ :index, :show, :create, :update, :destroy ] do
      # 1人につき1つなので単数形。参加表明とキャンセルだけを持つ
      resource :participation, only: [ :create, :destroy ], controller: "event_participations"
    end
    resources :projects, only: [ :index, :show, :create, :update, :destroy ] do
      resource :participation, only: [ :create ], controller: "project_participations"
      # 脱退は申請制(docs/api-spec.md「プロジェクトの脱退」)。
      # 申請と取り下げは「自分の参加」しか指せないので単数形で :id を取らない。
      # 承認と却下は owner が他人の申請を捌くので、申請のIDを取る
      resource :withdrawal, only: [ :create, :destroy ], controller: "project_withdrawals"
      resources :withdrawals, only: [ :update, :destroy ], controller: "project_withdrawal_reviews"
    end
    resources :tags, only: [ :index ]

    # プロフィール(docs/api-spec.md §4.5)。
    # /users/me を resources より先に置く。後ろだと :id に "me" が入る
    get "users/me", to: "users#me"
    patch "users/me", to: "users#update"
    # パスワードはプロフィールと別の入口にする。現在のパスワードを要求する点も、
    # 失敗したときに返すものも違う(docs/spec-admin-operations.md §3.1)
    patch "users/me/password", to: "passwords#update"
    resources :users, only: [ :show ]
    # サイネージが必要とするデータを1リクエストで返す。単数形リソース
    resource :signage, only: [ :show ]

    namespace :admin do
      # 管理者トップの集計(wireframes/wireframe-admin-ver2.html ①)。
      # 1件しかないので単数形
      resource :dashboard, only: [ :show ]

      # ユーザー管理(wireframes/wireframe-admin-ver2.html ②③)。
      # update が扱うのは権限と学年だけ。氏名・メールはまだ持たない
      # (docs/spec-admin-operations.md §3.3)。学科は本人が /me/edit で書く
      resources :users, only: [ :index, :create, :update, :destroy ] do
        # 1人につき1つの状態なので単数形。停止と解除だけを持つ
        resource :suspension, only: [ :update, :destroy ], controller: "suspensions"
        # 卒業したかどうかは graduation_year からの計算結果で、列ではない。
        # 一覧のバッジを押したときに年度を動かす入口をここに置く
        resource :graduation, only: [ :update, :destroy ], controller: "graduations"
        # 再発行。忘れた人が対象なので現在の値は求めない。
        # 1人につき1つなので単数形(suspension と同じ形)
        resource :password, only: [ :update ], controller: "passwords"
      end
      resources :signage_tokens, only: [ :index, :create, :destroy ]
      # タグは「直す場所」。作成は持たない。タグは企画かプロフィールに
      # 付ける過程で生まれる(docs/spec-tags.md §3.5 / §3.8)
      resources :tags, only: [ :index, :update, :destroy ]
      # 企画一覧・全件(wireframes/wireframe-admin-ver2.html ④)。
      # イベントとプロジェクトを1つの表に混ぜるので、どちらでもない名前で持つ
      resources :posts, only: [ :index ]
      # ピン留め設定画面用。spotlight_score を公開APIに載せないため専用に持つ
      resources :events, only: [ :index ] do
        # 全体で1件だけなので単数形
        resource :pin, only: [ :update, :destroy ], controller: "pins"
        # 論理削除の取り消し。削除は DELETE /api/events/:id をそのまま使う
        resource :trash, only: [ :destroy ], controller: "trashes"
      end
      # 復旧だけを持つ。プロジェクトの一覧は admin/posts が返す
      resources :projects, only: [] do
        resource :trash, only: [ :destroy ], controller: "trashes"
      end
    end
  end
end
