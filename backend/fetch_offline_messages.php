<?php
require_once "bootstrap.php";
require_once "auth.php";
//header('Content-Type: application/json');

// Parse request
$data = json_decode(file_get_contents("php://input"), true);
$token = $data["token"] ?? null;

$user_id = validate_token($token, "login");
if (!$user_id) {
    echo json_encode(["success" => false, "error" => "Invalid token"]);
    exit();
}

global $conn;

// Inbox table for this user
$inbox_table = "inbox_" . intval($user_id);

// Fetch all offline messages
$query = "SELECT sender_id, payload, created_at FROM $inbox_table ORDER BY created_at ASC";
$result = $conn->query($query);

$messages = [];
if ($result && $result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        $messages[] = [
            "sender_id" => $row["sender_id"],
            "payload" => $row["payload"],
            "created_at" => $row["created_at"],
        ];
    }
}

// Clear inbox after fetching (optional)
$conn->query("DELETE FROM $inbox_table");

echo json_encode([
    "success" => true,
    "messages" => $messages,
]);
