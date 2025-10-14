# Confab Documentation

This directory contains the documentation for the Confab project.

## Contents

*   [API Documentation](./api.md): Describes the backend API endpoints.
*   [Database Schema](./database.md): Details on the database structure.
*   [Frontend Architecture](./frontend.md): Information on the frontend code structure.
*   [Backend Architecture](./backend.md): Information on the backend code structure.
*   [Deployment Guide](./deployment.md): Instructions for deploying the application.

# API Documentation

This document outlines the API endpoints for the Confab application.

## Authentication

*   **POST /backend/register.php**: Register a new user.
*   **POST /backend/login.php**: Log in a user.
*   **POST /backend/forgot_password.php**: Initiate the password reset process.
*   **POST /backend/reset_password.php**: Reset the user's password.

## Chat

*   **GET /backend/fetch_all_messages.php**: Fetch all messages for the logged-in user.
*   **GET /backend/fetch_offline_messages.php**: Fetch offline messages.

## Contacts

*   **GET /backend/fetch_contacts.php**: Get the contact list for the logged-in user.
*   **POST /backend/add_contact.php**: Add a new contact.

## Profile

*   **GET /backend/fetch_my_profile.php**: Get the profile of the logged-in user.
*   **GET /backend/fetch_profile.php**: Get the profile of another user.
*   **POST /backend/update_profile.php**: Update the user's profile.

# Backend Architecture

This document provides an overview of the backend architecture for the Confab application.

## Technologies

*   **PHP**: The primary backend language.
*   **MySQL**: The database for storing user data and messages.
*   **Ratchet**: A PHP library for WebSocket communication.

## Structure

The backend code is located in the `/backend` directory and includes the following key components:

*   **front_controller.php**: A single entry point for all HTTP requests.
*   **chat_server.php**: The WebSocket server for real-time chat.
*   **bootstrap.php**: Initializes the application, including database connections and environment variables.
*   **config.php**: Contains database and other configuration settings.
*   **Authentication**: A set of scripts for user registration, login, and password management.
*   **API Endpoints**: PHP scripts that handle requests for fetching and updating data.

# Database Schema

This document describes the database schema for the Confab application.

## Tables

*   **users**: Stores user information (id, username, email, password).
*   **inbox_&lt;user_id&gt;**: Each user has their own inbox table to store received messages.
*   **contacts_&lt;user_id&gt;**: Each user has their own contacts table.

For more details, refer to the `backend/schema.sql` and `backend/schema_templated.sql` files.

# Deployment Guide

This document provides instructions for deploying the Confab application.

## Requirements

*   PHP
*   MySQL
*   Composer
*   Caddy

## Setup

1.  **Clone the repository**.
2.  **Configure the database**: Create a MySQL database and update the credentials in `backend/.env`.
3.  **Install dependencies**: Run `composer install` in the `backend` directory.

## Running the Servers

1.  **Start the Caddy server**: `sudo caddy run --config ./Caddyfile`
2.  **Start the PHP server**: `php -S localhost:8000 -t ./ front_controller.php`
3.  **Start the WebSocket server**: `php backend/chat_server.php`

For more detailed instructions, refer to the main [README.md](../../README.md) file.

# Frontend Architecture

This document provides an overview of the frontend architecture for the Confab application.

## Structure

The frontend code is organized into the following directories:

*   **/frontend/auth**: Contains the HTML, CSS, and JavaScript for authentication (login, registration, password reset).
*   **/frontend/chat**: The main chat interface, including HTML, CSS, and JavaScript for handling messages, events, and WebSocket communication.
*   **/frontend/profile**: User profile page.
*   **/frontend/assets**: Static assets like images and sounds.

## Key Files

*   **index.html**: The main entry point of the application.
*   **chat/main.js**: The primary JavaScript file for the chat interface.
*   **chat/websocket.js**: Handles WebSocket communication with the backend.
*   **auth/auth.js**: Manages authentication logic.
*   **utils.js**: Contains utility functions used throughout the application.
