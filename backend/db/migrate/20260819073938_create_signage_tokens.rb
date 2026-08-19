class CreateSignageTokens < ActiveRecord::Migration[7.2]
  def change
    create_table :signage_tokens do |t|
      t.string :token, null: false             # SecureRandom.hex(16) = 32文字
      t.string :name, null: false
      t.datetime :revoked_at                   # null = 有効

      t.timestamps
    end

    add_index :signage_tokens, :token, unique: true
  end
end
