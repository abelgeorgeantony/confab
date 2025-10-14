# Confab – Real-time Private Messaging

A real-time chat application built with **PHP, MySQL, and Ratchet WebSocket** as the backend, and **HTML, CSS, and JavaScript** as the frontend.

This project is being developed as a Mini Project for the 5th Semester BCA program at Mahatma Gandhi University.

---

## Setup on a New Device
> The instructions are for linux based systems and for making the application available on a local network.

### 1. Clone the Project

```bash
git clone https://github.com/abelgeorgeantony/confab.git
```

---

### 2. Requirements

a). **Install dependencies:**
- apt install:
  - php
  - php-mysql
  - mariadb-server
  - composer
  - caddy

- composer require(php libraries must be installed in **/backend/**):
  - cboden/ratchet
  - phpmailer/phpmailer
  - vlucas/phpdotenv \
  (Running "composer install" in the **/backend/** would be sufficient)


b). **Create a new MySQL database `confab`.**

c). **Import the database schema:**
   ```bash
   mysql -u root -p confab < backend/schema.sql
   ```
d). **Create a `.env` file in the `backend/` directory and add your database and SMTP credentials. Use the following template:**
   ```
    DB_HOST=127.0.0.1
    DB_USER=root
    DB_PASS=
    DB_NAME=confab

    SMTP_HOST=smtp.gmail.com
    SMTP_USER=your-email@gmail.com
    SMTP_PASS=your-app-password
    SMTP_PORT=587
   ```

---

### Starting the Servers

> Before starting, make sure MySQL (`mysqld`) is running.

To start all the necessary servers (Caddy, PHP, WebSocket), simply run the startup script from the project root:

```bash
./start-server.sh
```

The script will automatically handle prerequisite checks, update network configurations, and launch all servers in the background. It will also provide you with the URL to access the application.

### Stopping the Servers

To stop all the running servers, use the stop script:

```bash
./stop-server.sh
```

### Accessing the Application

Once the servers are running, open your browser and go to the `https://<ip-address>` URL provided by the startup script.

Login or register a new user and start chatting.

---
