<?php
require_once "bootstrap.php";

//header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true);
$token = $data["token"] ?? null;
$new_password = $data["new_password"] ?? null;

$publicKey = $data["publicKey"];
$encryptedPrivateKey = $data["encryptedPrivateKey"];
$privateKeySalt = $data["privateKeySalt"];
$privateKeyIv = $data["privateKeyIv"];

// 1. Basic input validation
if (empty($token) || empty($new_password)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "error" => "Missing token or new password.",
    ]);
    exit();
}

if (strlen($new_password) < 8) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "error" => "Password must be at least 8 characters long.",
    ]);
    exit();
}

global $conn;

// 2. Find the user ID associated with the valid, unexpired reset token
// THE FIX: We now compare the expiration date directly in the PHP script
// by fetching the 'expires_at' value from the database first.
$stmt = $conn->prepare(
    "SELECT user_id, expires_at FROM sessions WHERE token = ? AND type = 'password_reset'",
);
$stmt->bind_param("s", $token);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "error" => "Invalid reset token. It may have already been used.",
    ]);
    exit();
}

$session = $result->fetch_assoc();
$user_id = $session["user_id"];
$expires_at = new DateTime($session["expires_at"]);
$now = new DateTime();

// 3. Check if the token has expired
if ($now > $expires_at) {
    // Clean up the expired token
    $delete_stmt = $conn->prepare("DELETE FROM sessions WHERE token = ?");
    $delete_stmt->bind_param("s", $token);
    $delete_stmt->execute();

    http_response_code(400);
    echo json_encode([
        "success" => false,
        "error" => "This reset token has expired. Please request a new one.",
    ]);
    exit();
}

// 4. If the token is valid, hash the new password
$new_password_hash = password_hash($new_password, PASSWORD_BCRYPT);

// 5. Update the user's password in the 'users' table
$update_stmt = $conn->prepare(
    "UPDATE users SET password_hash = ?, public_key = ?, encrypted_private_key = ?, private_key_salt = ?, private_key_iv = ? WHERE id = ?",
);
$update_stmt->bind_param(
    "sssssi",
    $new_password_hash,
    $publicKey,
    $encryptedPrivateKey,
    $privateKeySalt,
    $privateKeyIv,
    $user_id,
);

if ($update_stmt->execute()) {
    // 6. Invalidate the reset token by deleting it from the sessions table
    $delete_stmt = $conn->prepare("DELETE FROM sessions WHERE token = ?");
    $delete_stmt->bind_param("s", $token);
    $delete_stmt->execute();

    echo json_encode([
        "success" => true,
        "message" => "Password updated successfully.",
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "Failed to update password.",
    ]);
}
?>
