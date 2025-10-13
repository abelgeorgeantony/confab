<?php
//header("Content-Type: application/json");
require_once "auth.php";

$token = $_POST["token"] ?? "";

if (empty($token)) {
    echo json_encode(["success" => false, "error" => "Missing token."]);
    exit();
}

$userId = validate_token($token, "login");
if (!$userId) {
    echo json_encode([
        "success" => false,
        "error" => "Invalid or expired token.",
    ]);
    exit();
}

$stmt = $conn->prepare(
    "SELECT id, username, display_name, email, bio, public_key, profile_picture_url FROM users WHERE id = ?",
);
$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();

if ($user) {
    echo json_encode(["success" => true, "profile" => $user]);
} else {
    echo json_encode(["success" => false, "error" => "User not found."]);
}
