-- TEMPLATES for use in php files only.
-- Create a inbox table for each registered user.
CREATE TABLE inbox_<user_id> (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  payload TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);
-- Create a contacts table for each registered user.
CREATE TABLE contacts_<user_id> (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contact_id INT NOT NULL,
  status ENUM('pending', 'contact', 'blocked') NOT NULL DEFAULT 'pending',
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (contact_id),
  FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE
);
