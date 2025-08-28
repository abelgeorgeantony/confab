# Confab – Real-time Private Messaging

A real-time chat application built with **PHP, MySQL, and Ratchet WebSocket** as the backend, and **HTML, CSS, and JavaScript** as the frontend.
It supports **username based user identification**.

---

## Setup on a New Device

### 1. Requirements
- apt install:
  - php
  - php-mysql
  - mariadb-server
  - composer
  - caddy

- composer require(php libraries must be installed in **/backend/**):
  - cboden/ratchet
  - phpmailer/phpmailer
  - vlucas/phpdotenv

---

### 2. Clone the Project

```bash
git clone https://github.com/abelgeorgeantony/confab.git
cd confab
```

---

### 3. Configure the Database

1. Create a new MySQL database `confab`
2. Import the base schema:
   ```bash
   mysql -u root -p chat_app < backend/schema.sql
   ```
3. Update credentials in **backend/.env**, the file must first be created:
   ```
    DB_HOST=127.0.0.1
    DB_USER=root
    DB_PASS=
    DB_NAME=chat_app

    SMTP_HOST=smtp.gmail.com
    SMTP_USER=abel.chatapp@gmail.com
    SMTP_PASS=
    SMTP_PORT=587
   ```

On user registration, their **inbox_<user_id>** and **contacts_<user_id>** tables will be auto-created.

---

### 4. Install Dependencies

Move to the backend folder and install Ratchet WebSocket library:
```bash
cd backend
composer require cboden/ratchet
```

This will create the `vendor/` folder with required dependencies.

---

## Starting the Server

Before starting, make sure *MySQL (mysqld)* is running.
Without the database service running, the backend will fail to connect.

You need 3 servers running simultaneously:

---

### 1. Start the Caddy server(https)
From the project root, run:
```bash
sudo caddy run --config ./Caddyfile
```
This makes the Caddy server run on port 80, 443(default ports).
**If those ports are already in use, you need to free up those ports and start caddy again!**

---

### 2. Start the PHP Server(http)
In a new terminal window, from the project root, run:
```bash
php -S localhost:8000 -t ./ front_controller.php
```
This is the actual server that does most of the work!

---

### 3. Start the WebSocket Chat Server
In a new terminal window:
```bash
cd backend
php chat_server.php
```
You should see:
```
WebSocket Chat Server running on port 8080...
```

---

### 3. Access the Application
Open your browser and go to:
```
https://<ip-address>
```
eg:
```
https://192.168.1.100
```
Login or register a new user and start chatting.

---
