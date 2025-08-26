<?php
require_once "bootstrap.php";
require_once "auth.php";

header("Content-Type: application/json");

// 1. Validate token and input
$data = json_decode(file_get_contents("php://input"), true);
$token = $data["token"] ?? null;
$contact_id = $data["contactId"] ?? null;
error_log("user id to add: " . intval($contact_id));
$user_id = validate_token($token, "login");
if (!$user_id) {
    http_response_code(401);
    echo json_encode(["success" => false, "error" => "Invalid session"]);
    exit();
}

if (empty($contact_id)) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "error" => "User ID to add is required.",
    ]);
    exit();
}

if ($contact_id == $user_id) {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "error" => "You cannot add yourself as a contact.",
    ]);
    exit();
}

global $conn;

// 2. Define table names
$my_contacts_table = "contacts_" . intval($user_id);
$their_contacts_table = "contacts_" . intval($contact_id);

// 3. Use a Transaction for Data Integrity
$conn->begin_transaction();

try {
    // Step 1: Add THEM to MY contact list as 'pending'.
    // This will do nothing if a row for this contact already exists (e.g., they are already a 'contact' or 'blocked').
    $stmt_insert_mine = $conn->prepare(
        "INSERT INTO $my_contacts_table (contact_id, status) VALUES (?, 'pending')
         ON DUPLICATE KEY UPDATE status = status",
    );
    $stmt_insert_mine->bind_param("i", $contact_id);
    if (!$stmt_insert_mine->execute()) {
        throw new Exception("Failed to update your contact list.");
    }

    // Step 2: Add ME to THEIR contact list as 'pending'.
    // This ensures they see a pending request from me.
    $stmt_insert_theirs = $conn->prepare(
        "INSERT INTO $their_contacts_table (contact_id, status) VALUES (?, 'pending')
         ON DUPLICATE KEY UPDATE status = status",
    );
    $stmt_insert_theirs->bind_param("i", $user_id);
    if (!$stmt_insert_theirs->execute()) {
        throw new Exception("Failed to update their contact list.");
    }

    // 4. Fetch the target user's details to return them.
    $stmt_fetch_details = $conn->prepare(
        "SELECT id, username, display_name, bio, profile_picture_url, public_key FROM users WHERE id = ?",
    );
    $stmt_fetch_details->bind_param("i", $contact_id);
    $stmt_fetch_details->execute();
    $result = $stmt_fetch_details->get_result();

    if ($result->num_rows === 0) {
        // This should theoretically not happen if the user exists, but it's a good safeguard.
        throw new Exception("Could not find the specified user's details.");
    }
    $non_contact_details = $result->fetch_assoc();

    // 5. If all queries succeeded, commit the transaction
    $conn->commit();

    // 6. Return a success response with the user's details
    echo json_encode([
        "success" => true,
        "message" => "Pending contact relationship established.",
        "contact" => $non_contact_details,
    ]);
} catch (Exception $e) {
    // If any query fails, roll back the entire transaction to maintain data consistency
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["success" => false, "error" => $e->getMessage()]);
}
?>
