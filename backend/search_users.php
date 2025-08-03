<?php
ob_start();
require_once 'bootstrap.php';
require_once 'auth.php';

$data = json_decode(file_get_contents("php://input"), true);
$token = $data['token'] ?? null;
$query = trim($data['query'] ?? '');

$user_id = validate_token($token);
if (!$user_id) {
    http_response_code(401);
    echo json_encode(["success" => false, "error" => "Invalid session"]);
    exit;
}

if (strlen($query) < 2) {
    echo json_encode(["success" => true, "users" => []]);
    exit;
}

global $conn;
$search_term = "%" . $query . "%";
$contacts_table = "contacts_" . intval($user_id);

// This query finds users whose username or display name matches the search term,
// excluding the user themselves and anyone already in their contacts.
$stmt = $conn->prepare("
    SELECT id, username, display_name, bio, profile_picture_url 
    FROM users 
    WHERE (username LIKE ? OR display_name LIKE ?) 
    AND id != ? 
    AND id NOT IN (SELECT contact_id FROM $contacts_table)
");
$stmt->bind_param("ssi", $search_term, $search_term, $user_id);
$stmt->execute();
$result = $stmt->get_result();

$users = [];
while ($row = $result->fetch_assoc()) {
    $users[] = $row;
}

echo json_encode(["success" => true, "users" => $users]);

ob_end_flush();
?>

