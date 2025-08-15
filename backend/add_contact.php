<?php
require_once "bootstrap.php";
require_once "auth.php";
//header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true);
$token = $data["token"] ?? null;
$username = trim($data["username"] ?? "");

$user_id = validate_token($token);
if (!$user_id || empty($username)) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Invalid request"]);
    exit();
}

global $conn;

// Find the target user's ID
$stmt_find_user = $conn->prepare("SELECT id FROM users WHERE username = ?");
$stmt_find_user->bind_param("s", $username);
$stmt_find_user->execute();
$result = $stmt_find_user->get_result();

if ($result->num_rows === 0) {
    echo json_encode(["success" => false, "error" => "User not found"]);
    exit();
}
$contact_id = $result->fetch_assoc()["id"];

if ($contact_id == $user_id) {
    echo json_encode([
        "success" => false,
        "error" => "You cannot add yourself as a contact.",
    ]);
    exit();
}

// Define both users' contact table names
$my_contacts_table = "contacts_" . intval($user_id);
$their_contacts_table = "contacts_" . intval($contact_id);

// --- Use a Transaction for Data Integrity ---
$conn->begin_transaction();

try {
    // Step 1: Update MY contact list for THEM.
    // Check the current status of this user in my contact list.
    $stmt_check = $conn->prepare(
        "SELECT status FROM $my_contacts_table WHERE contact_id = ?",
    );
    $stmt_check->bind_param("i", $contact_id);
    $stmt_check->execute();
    $exists = $stmt_check->get_result()->fetch_assoc();
    $current_status = $exists["status"] ?? null;

    if ($current_status === "contact") {
        throw new Exception("User is already a contact!");
    }
    if ($current_status === "blocked") {
        throw new Exception("User is blocked. Please unblock them first.");
    }

    // Set my status for them to 'contact'. This handles both new and pending entries.
    $stmt_update_mine = $conn->prepare(
        "INSERT INTO $my_contacts_table (contact_id, status) VALUES (?, 'contact')
         ON DUPLICATE KEY UPDATE status = VALUES(status)",
    );
    $stmt_update_mine->bind_param("i", $contact_id);
    if (!$stmt_update_mine->execute()) {
        throw new Exception("Failed to update your contact list.");
    }

    // Step 2: Update THEIR contact list for ME.
    // Add myself to their contact list as 'pending' ONLY if a record doesn't already exist.
    // We don't want to downgrade their status if they have already added me as a 'contact' or 'blocked' me.
    $stmt_update_theirs = $conn->prepare(
        "INSERT INTO $their_contacts_table (contact_id, status) VALUES (?, 'pending')
         ON DUPLICATE KEY UPDATE status = status", // This does nothing if a row already exists, which is the desired behavior.
    );
    $stmt_update_theirs->bind_param("i", $user_id);
    if (!$stmt_update_theirs->execute()) {
        throw new Exception("Failed to update their contact list.");
    }

    // If all queries succeeded, commit the transaction
    $conn->commit();
    echo json_encode([
        "success" => true,
        "message" => "Contact added successfully.",
    ]);
} catch (Exception $e) {
    // If any query fails, roll back the entire transaction
    $conn->rollback();
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
