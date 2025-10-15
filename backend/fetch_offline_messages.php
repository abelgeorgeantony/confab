<?php
require_once "bootstrap.php";
require_once "auth.php";

//header("Content-Type: application/json");

// Parse request
$data = json_decode(file_get_contents("php://input"), true);
$token = $data["token"] ?? null;

$user_id = validate_token($token, "login");
if (!$user_id) {
    echo json_encode(["success" => false, "error" => "Invalid token"]);
    exit();
}

global $conn;

// --- New Logic: Fetch from global messages table ---

// Fetch all messages for the user that are in a 'queued' state
$stmt = $conn->prepare(
    "SELECT id, sender_id, message_type, payload, created_at FROM messages WHERE receiver_id = ? AND status = 'queued' ORDER BY created_at ASC",
);
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

$messages = [];
$message_ids = [];
if ($result && $result->num_rows > 0) {
    while ($row = $result->fetch_assoc()) {
        $messages[] = [
            "sender_id" => $row["sender_id"],
            "message_type" => $row["message_type"],
            "payload" => $row["payload"],
            "created_at" => $row["created_at"],
        ];
        $message_ids[] = $row["id"];
    }
}

// If we fetched any messages, update their status to 'delivered'
if (!empty($message_ids)) {
    $ids_placeholder = implode(",", array_fill(0, count($message_ids), "?"));
    $update_stmt = $conn->prepare(
        "UPDATE messages SET status = 'delivered' WHERE id IN ($ids_placeholder)",
    );
    // Dynamically bind parameters
    $types = str_repeat("i", count($message_ids));
    $update_stmt->bind_param($types, ...$message_ids);
    $update_stmt->execute();
}

echo json_encode([
    "success" => true,
    "messages" => $messages,
]);
?>
