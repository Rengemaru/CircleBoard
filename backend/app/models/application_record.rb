class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  # http(s) 以外を弾く。利用者が入れた文字列をそのまま <a href> に置くので、
  # javascript: を通すと、他の部員がクリックしたときにスクリプトが動く。
  # フロント側でも弾くが、curl で回避できるのでここを正とする
  # (docs/spec-my-page.md §6.1)。
  #
  # **スキームだけを見る。** URL 全体を正規表現で検証しない。厳密に書こうとすると
  # 読めない正規表現になり、「説明できないコードは価値がない」(CLAUDE.md §0)に反する。
  # 止めたいのは「押すと何か実行される」スキームで、それは先頭を見れば足りる。
  #
  # 元は UserLink だけが持っていた。イベントの外部リンクにこの検証が無く、
  # javascript: が保存できる状態だったため、共有できる場所に移した
  # (2026-09-12 の監査)
  HTTP_URL_SCHEME = %r{\Ahttps?://}
end
