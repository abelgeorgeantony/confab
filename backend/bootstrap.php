<?php
// This file will be the single entry point for all backend scripts.

// 1. Load Composer's autoloader
require_once __DIR__ . '/vendor/autoload.php';

// 2. Load environment variables from .env file
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// 3. Include the database configuration
require_once __DIR__ . '/config.php';

