<?php

// Get the requested URI and remove query string
$uri = urldecode(parse_url($_SERVER["REQUEST_URI"], PHP_URL_PATH));

// This is the root directory of the project
$documentRoot = $_SERVER["DOCUMENT_ROOT"];
$requestedFile = $documentRoot . $uri;

// 1. Handle the root request: Serve the main landing page.
if ($uri === "/") {
    header("Location: /frontend/index.html");
    return; // Stop the script
}
if ($uri === "/favicon.ico") {
    header("Location: /frontend/favicon.ico");
    return; // Stop the script
}

// 2. Define patterns for restricted files and directories.
// These resources should never be served directly.
$restrictedPatterns = [
    "/^\/vendor\//", // Deny access to the entire vendor directory
    "/^\/\.git/", // Deny access to the .git directory and its contents
    '/\.sql$/', // Deny access to .sql files
    '/\.md$/', // Deny access to Markdown files (like README.md)
    '/\.backup$/', // Deny access to any .backup files
    '/composer\.json$/', // Deny direct access to composer.json
    '/composer\.lock$/', // Deny direct access to composer.lock
    '/\.gitignore$/', // Deny direct access to .gitignore
    '/chat_server\.php$/', // Do not allow the WebSocket server to be executed via HTTP
];

foreach ($restrictedPatterns as $pattern) {
    if (preg_match($pattern, $uri)) {
        http_response_code(403);
        header("Location: /frontend/index.html");
        return; // Stop the script
    }
}

// 3. Let the built-in server handle all other valid files.
// This is the core of the router. If a requested file exists (e.g., a CSS, JS,
// image, or an API endpoint in /backend/), `return false` tells the PHP server
// to serve it directly.
if (file_exists($requestedFile) && is_file($requestedFile)) {
    // Prevent the router from serving itself or other sensitive PHP files in the root
    if (
        pathinfo($requestedFile, PATHINFO_EXTENSION) === "php" &&
        dirname($requestedFile) === $documentRoot
    ) {
        http_response_code(404);
        echo "<h1>404 Not Found</h1>";
        return;
    }

    // --- NEW: Check for direct GET requests to backend PHP scripts ---
    // If the request is a GET request AND it targets a .php file in the backend,
    // it's a user trying to access it directly. Block them.
    if (
        $_SERVER["REQUEST_METHOD"] === "GET" &&
        preg_match('/^\/backend\/.*\.php$/', $uri)
    ) {
        // Redirect to the homepage.
        header("Location: /frontend/index.html");
        return;
    }

    return false; // Serve the requested file as-is
}

// 4. If the file does not exist, return a 404 error.
http_response_code(404);
echo "<h1>404 Not Found</h1>";
echo "<p>The requested resource <code>" .
    htmlspecialchars($uri) .
    "</code> was not found on this server.</p>";
