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
      # 脱退APIは作らない(MVP対象外。rails console で対応。docs/api-spec.md §3)
      resource :participation, only: [ :create ], controller: "project_participations"
    end
    resources :tags, only: [ :index ]
    # サイネージが必要とするデータを1リクエストで返す。単数形リソース
    resource :signage, only: [ :show ]

    namespace :admin do
      # 管理者トップの集計(wireframes/wireframe-admin-ver2.html ①)。
      # 1件しかないので単数形
      resource :dashboard, only: [ :show ]

      # ユーザー管理(wireframes/wireframe-admin-ver2.html ②③)。
      # 編集と停止はまだ持たない。停止は users に suspended_at が無く、
      # 追加には spec-v2.2.md §2 の変更が要る(docs/instructions.md T7-4)
      resources :users, only: [ :index, :create, :destroy ]
      resources :signage_tokens, only: [ :index, :create, :destroy ]
      # ピン留め設定画面用。spotlight_score を公開APIに載せないため専用に持つ
      resources :events, only: [ :index ] do
        # 全体で1件だけなので単数形
        resource :pin, only: [ :update, :destroy ], controller: "pins"
      end
    end
  end
end
