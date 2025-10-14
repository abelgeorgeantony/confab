<?php
// This file will be included by all backend scripts to avoid code duplication.

// 1. Set the default timezone to UTC to ensure consistency.
date_default_timezone_set("UTC");

// 2. Load Composer's autoloader
require_once __DIR__ . "/vendor/autoload.php";

// 3. Load environment variables from .env file
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// 4. Include the database configuration
require_once __DIR__ . "/config.php";
