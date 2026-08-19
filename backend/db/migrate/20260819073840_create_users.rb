class CreateUsers < ActiveRecord::Migration[7.2]
  def change
    create_table :users do |t|
      t.string :name, null: false
      t.string :email, null: false
      t.string :password_digest, null: false
      # 0:admin / 1:member / 2:demo。既定は member
      t.integer :role, null: false, default: 1
      t.integer :enrollment_year, null: false
      t.integer :graduation_year, null: false

      t.timestamps
    end

    add_index :users, :email, unique: true
  end
end
