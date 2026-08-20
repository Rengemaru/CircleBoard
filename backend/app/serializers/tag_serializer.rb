# タグの表現は tags API・イベント・プロジェクトの3箇所で同じ形になるため、
# ここ1箇所にまとめる(CLAUDE.md §3-2 と同じ考え方)。
class TagSerializer
  def initialize(tag)
    @tag = tag
  end

  def as_json
    { id: @tag.id, name: @tag.name }
  end
end
