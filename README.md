# Confab – Real-time Private Messaging

A real-time chat application built with **PHP, MySQL, and Ratchet WebSocket** as the backend, and **HTML, CSS, and JavaScript** as the frontend.

> This project was submitted as a Mini Project for the 5th Semester of the BCA (Bachelor of Computer Applications) program at Mahatma Gandhi University.

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
  - vlucas/phpdotenv \
  (Running "composer install" in the **/backend/** would be sufficient)

---

### 2. Clone the Project

```bash
git clone https://github.com/abelgeorgeantony/confab.git
cd confab
```

---

### 3. Configure the Database

1. Create a new MySQL database `confab`.
2. Import the base schema:
   ```bash
   mysql -u root -p confab < backend/schema.sql
   ```
3. Create a `.env` file in the `backend/` directory and add your database and SMTP credentials. You can use the following template:
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

On user registration, their **inbox_<user_id>** and **contacts_<user_id>** tables will be auto-created.

---

### 4. Install Dependencies

Move to the backend folder and install dependencies using Composer:
```bash
cd backend
composer install
```

This will create the `vendor/` folder with the required libraries.

---

## Running the Application

Before starting, make sure the following services are running on your system:
- MySQL (`mysqld`)

### Starting the Servers

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
