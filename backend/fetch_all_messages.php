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
    "SELECT * FROM messages WHERE sender_id = ? OR receiver_id = ? ORDER BY created_at ASC",
);
$stmt->bind_param("ii", $userId, $userId);
$stmt->execute();
$result = $stmt->get_result();
$messages = $result->fetch_all(MYSQLI_ASSOC);

echo json_encode(["success" => true, "messages" => $messages]);
