<?php
require_once "bootstrap.php";
require_once "auth.php";

//header('Content-Type: application/json');

// Validate token
$data = json_decode(file_get_contents("php://input"), true);
$token = $data["token"] ?? null;

$user_id = validate_token($token, "login");
if (!$user_id) {
    echo json_encode(["valid" => false]);
    exit();
}

// Fetch from contacts_<user_id>
$contacts_table = "contacts_" . intval($user_id);
error_log("$contacts_table", 0);

global $conn;

$sql = "
    SELECT c.contact_id, u.username, u.display_name, u.bio, u.profile_picture_url, u.public_key, u.is_online, c.status
    FROM $contacts_table c
    JOIN users u ON c.contact_id = u.id
    ORDER BY c.added_at DESC
";

$result = $conn->query($sql);
$contacts = [];
while ($row = $result->fetch_assoc()) {
    $contacts[] = $row;
}

echo json_encode([
    "valid" => true,
    "contacts" => $contacts,
]);
