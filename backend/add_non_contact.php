<?php
require_once "bootstrap.php";
require_once "auth.php";

//header('Content-Type: application/json');

// Validate token
$data = json_decode(file_get_contents("php://input"), true);
$token = $data["token"] ?? null;
$id_to_add = $data["id_to_add"] ?? null;

$user_id = validate_token($token);
if (!$user_id) {
    echo json_encode(["valid" => false]);
    exit();
}

global $conn;

$stmt = $conn->prepare(
    "SELECT id, username, display_name, bio, profile_picture_url, public_key FROM users WHERE id = ?",
);
$stmt->bind_param("i", $id_to_add);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 1) {
    $non_contact_details = $result->fetch_assoc();
    $my_contacts_table = "contacts_" . intval($user_id);
    echo json_encode([
        "valid" => true,
        "contact" => $contact,
    ]);
} else {
    echo json_encode([
        "valid" => false,
        "error" => "User doesn't exist",
    ]);
}
