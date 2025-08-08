<?php
require "bootstrap.php";
require "code_mailer.php";
//header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"));

$username = $conn->real_escape_string($data->username);
$default_display_name = strtoupper($username);
$email = $conn->real_escape_string($data->email);
$password = $data->password;

$publicKey = $data->publicKey;
$encryptedPrivateKey = $data->encryptedPrivateKey;
$privateKeySalt = $data->privateKeySalt;
$privateKeyIv = $data->privateKeyIv;


// --- Basic Validation ---
if (empty($username) || empty($email) || empty($password) || empty($publicKey) || empty($encryptedPrivateKey) || empty($privateKeySalt) || empty($privateKeyIv)) {
    echo json_encode(["success" => false, "error" => "All fields are required."]);
    exit;
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(["success" => false, "error" => "Invalid email format."]);
    exit;
}

// --- Check for existing user ---
$stmt = $conn->prepare("SELECT id FROM users WHERE username = ? OR email = ?");
$stmt->bind_param("ss", $username, $email);
$stmt->execute();
if ($stmt->get_result()->num_rows > 0) {
    echo json_encode(["success" => false, "error" => "Username or email already exists."]);
    exit;
}

// --- Create User with verification code ---
$hash = password_hash($password, PASSWORD_BCRYPT);

// Insert a basic user entry, not yet fully profiled
$stmt = $conn->prepare("INSERT INTO users (username, display_name, email, password_hash, email_verified, public_key, encrypted_private_key, private_key_salt, private_key_iv) VALUES (?, ?, ?, ?, FALSE, ?, ?, ?, ?)");
$stmt->bind_param("ssssssss", $username, $default_display_name, $email, $hash, $publicKey, $encryptedPrivateKey, $privateKeySalt, $privateKeyIv);

if ($stmt->execute()) {
    send_verification_code($conn, $email);
    echo json_encode(["success" => true]);
} else {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Failed to create account."]);
}
?>

