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
      # アカウント発行のみ。一覧・編集・停止・削除UIは MVP 対象外(CLAUDE.md §10)
      resources :users, only: [ :create ]
      resources :signage_tokens, only: [ :index, :create, :destroy ]
      resources :events, only: [] do
        # 全体で1件だけなので単数形
        resource :pin, only: [ :update, :destroy ], controller: "pins"
      end
    end
  end
end
