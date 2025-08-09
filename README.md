# Chat App – Real-time WebSocket Messaging

A lightweight real-time chat application built with **PHP, MySQL, and Ratchet WebSocket**.  
It supports **user authentication**, **per-user contacts**, and **offline message storage** for seamless chat delivery.

---

## Setup on a New Device

### 1. Requirements
- apt install:
  - php
  - composer
  - mkcert
  - caddy
  - mariadb-server

- composer install:
  - cboden/ratchet
  - phpmailer/phpmailer
  - vlucas/phpdotenv

---

### 2. Clone the Project

```bash
git clone https://github.com/abelgeorgeantony/chat_app.git
cd chat_app
```

---

### 3. Configure the Database

1. Create a new MySQL database `chat_app`
2. Import the base schema:
   ```bash
   mysql -u root -p chat_app < backend/schema.sql
   ```
3. Update credentials in **backend/.env** the file must first be created:
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

You need two servers running simultaneously:  

---

### 1. Start the PHP Server
From the project root, run:
```bash
php -S localhost:8000 -t ./
```
This will serve all PHP backend APIs like:
- `http://localhost:8000/backend/register.php`
- `http://localhost:8000/backend/login.php`

---

### 2. Start the WebSocket Chat Server
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

### 3. Open the Frontend
Open your browser and go to:
```
http://localhost:8000/index.html
```
Login or register a new user and start chatting.

---
