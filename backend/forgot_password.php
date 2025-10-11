<?php
require_once "bootstrap.php";

// This script should always return a generic success response to prevent username enumeration.
//header("Content-Type: application/json");
$response = ["success" => true];

$data = json_decode(file_get_contents("php://input"), true);
$username = $data["username"] ?? "";

if (empty($username)) {
    // Silently fail if no username is provided, but still report success.
    echo json_encode($response);
    exit();
}

global $conn;

// 1. Find the user by username to get their ID and email.
$stmt = $conn->prepare("SELECT id, email FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 1) {
    $user = $result->fetch_assoc();
    $user_id = $user["id"];
    $email = $user["email"];

    // 2. Generate a secure, unique token for the reset link.
    $token = bin2hex(random_bytes(32));

    // 3. Set an expiration time for the token (e.g., 1 hour from now).
    //$expires_at = date("Y-m-d H:i:s", time() + 3600);
    //error_log($expires_at);

    // 4. Store the token in the 'sessions' table with a 'password_reset' type.
    $insert_stmt = $conn->prepare(
        "INSERT INTO sessions (user_id, token, expires_at, type) VALUES (?, ?, NOW() + INTERVAL 1 HOUR, 'password_reset')",
    );
    $insert_stmt->bind_param("is", $user_id, $token);
    $insert_stmt->execute();

    // 5. Construct the full reset link and send the email.
    $reset_link =
        "https://" .
        $_SERVER["HTTP_HOST"] .
        "/frontend/auth/reset_password.html?token=" .
        $token;

    $subject = "Your Password Reset Link for Perfect Chat";
    $body =
        "<h2>Password Reset Request</h2>
             <p>Hello " .
        htmlspecialchars($username) .
        ",</p>
             <p>We received a request to reset your password. Please click the link below to set a new one. This link is valid for 1 hour.</p>
             <p><a href='" .
        $reset_link .
        "'>Reset Your Password</a></p>
             <p>If you did not request a password reset, you can safely ignore this email.</p>";

    // 6. Use the existing asynchronous email script to send the mail.
    $recipient_arg = escapeshellarg($email);
    $subject_arg = escapeshellarg($subject);
    $body_arg = escapeshellarg($body);
    $php_executable = PHP_BINARY;
    $script_path = __DIR__ . "/send_email_cli.php";
    $command = "$php_executable $script_path $recipient_arg $subject_arg $body_arg > /dev/null 2>&1 &";
    exec($command);
    $response = ["success" => true, "link" => $reset_link];
    echo json_encode($response);
    exit();
}

// 7. Always send a success response to the frontend.
echo json_encode($response);
?>
