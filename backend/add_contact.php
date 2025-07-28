<?php
require_once "bootstrap.php";
require_once "auth.php";
//header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true);
$token = $data['token'] ?? null;
$username = trim($data['username'] ?? '');

$user_id = validate_token($token);
if (!$user_id || empty($username)) {
    echo json_encode(["success" => false, "error" => "Invalid request"]);
    exit;
}

global $conn;

// Find the target user
$stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    echo json_encode(["success" => false, "error" => "User not found"]);
    exit;
}

$row = $result->fetch_assoc();
$contact_id = intval($row['id']);
if ($contact_id === $user_id) {
    echo json_encode(["success" => false, "error" => "Cannot add yourself"]);
    exit;
}

// Current user’s contact table
$contacts_table = "contacts_" . intval($user_id);

// Check if already added
$stmt = $conn->prepare("SELECT id FROM $contacts_table WHERE contact_id = ?");
$stmt->bind_param("i", $contact_id);
$stmt->execute();
$exists = $stmt->get_result();

if ($exists->num_rows === 0) {
    $stmt = $conn->prepare("INSERT INTO $contacts_table (contact_id) VALUES (?)");
    $stmt->bind_param("i", $contact_id);
    if ($stmt->execute()) {
	echo json_encode(["success" => true]);
    }
} else {
    echo json_encode(["success" => false, "error" => "User is already a contact!"]);
}

//echo json_encode(["success" => false, "error" => "Backend error, code out of logical bounds"]);

