<?php
require_once "bootstrap.php";
require_once "auth.php";
//header('Content-Type: application/json');

// Get token from request
$data = json_decode(file_get_contents("php://input"), true);
$token = $data["token"] ?? null;

// Validate token and get user_id
$user_id = validate_token($token, "login");
if (!$user_id) {
    echo json_encode(["success" => false, "error" => "Invalid session"]);
    exit();
}

global $conn;

// Fetch user data from the database
$stmt = $conn->prepare(
    "SELECT display_name, username, email, bio, profile_picture_url FROM users WHERE id = ?",
);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();

if ($user) {
    echo json_encode(["success" => true, "user" => $user]);
} else {
    echo json_encode(["success" => false, "error" => "User not found"]);
}
?>
