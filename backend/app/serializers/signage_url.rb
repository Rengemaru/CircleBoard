# サイネージに出す詳細ページのURLを組み立てる。
#
# フロントでURLを組み立てない(docs/api-spec.md §5)。
# サイネージ端末はURLを開くだけの存在にしておくと、ドメインが変わっても
# サーバーの環境変数1つで済む。
module SignageUrl
  def self.for(resource, id)
    "#{ENV.fetch('PUBLIC_BASE_URL')}/#{resource}/#{id}"
  end
end
