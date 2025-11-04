<?php
require_once "bootstrap.php"; // For database connection ($conn) and environment setup
require_once "auth.php"; // For validate_token function

// Initialize response array
$response = ["success" => false, "message" => "An unknown error occurred."];

// Get the raw POST data
$input = file_get_contents("php://input");
$data = json_decode($input, true);

// --- 1. Validate Token for Authentication ---
// This uses the existing `validate_token` function from `auth.php`,
// which checks the `sessions` table for a valid, non-expired token
// associated with a user.
$token = $data["token"] ?? null;
$token_type = $data["token_type"] ?? "login"; // Assuming 'login' is the standard type for user sessions

if (!$token) {
    http_response_code(401); // Unauthorized
    $response["message"] = "Authentication failed: Token is missing.";
    echo json_encode($response);
    exit();
}

$user_id = validate_token($token, $token_type);

if ($user_id === false) {
    http_response_code(401); // Unauthorized
    $response["message"] = "Authentication failed: Invalid or expired token.";
    echo json_encode($response);
    exit();
}

// Construct the dynamic table name for the authenticated user's contacts
// This is critical for interacting with the `contacts_<user_id>` table.
$user_contacts_table = "contacts_" . $user_id;

// --- 2. Validate Input (contact_id) ---
// Ensures that `contact_id` is present and is a valid positive integer.
// This prevents malformed requests and potential issues with database queries.
if (!isset($data["contact_id"])) {
    http_response_code(400); // Bad Request
    $response["message"] = "Bad Request: contact_id is required.";
    echo json_encode($response);
    exit();
}

$contact_id = $data["contact_id"];

if (!is_numeric($contact_id) || $contact_id <= 0) {
    http_response_code(400); // Bad Request
    $response["message"] = "Bad Request: Invalid contact_id format.";
    echo json_encode($response);
    exit();
}

$contact_id = (int) $contact_id;

// --- 3. Prevent self-unblocking ---
if ($user_id === $contact_id) {
    http_response_code(400); // Bad Request
    $response["message"] = "You cannot unblock yourself.";
    echo json_encode($response);
    exit();
}

// --- 4. Validate if contact_id refers to an existing user in the global users table ---
// Ensures that the user being unblocked actually exists in the 'users' table.
$stmt_check_user = $conn->prepare("SELECT id FROM users WHERE id = ?");
if ($stmt_check_user === false) {
    http_response_code(500); // Internal Server Error
    $response["message"] =
        "Database error: Unable to prepare user check statement.";
    echo json_encode($response);
    exit();
}
$stmt_check_user->bind_param("i", $contact_id);
$stmt_check_user->execute();
$result_check_user = $stmt_check_user->get_result();

if ($result_check_user->num_rows === 0) {
    http_response_code(404); // Not Found
    $response["message"] = "The user you are trying to unblock does not exist.";
    echo json_encode($response);
    exit();
}
$stmt_check_user->close();

// --- 5. Unblock the user in the authenticated user's contacts table ---
// This section handles the one-sided unblocking logic.
//   - Checks if an entry for `contact_id` exists in `contacts_{$user_id}`.
//   - If it exists and is currently 'blocked', it updates its status to 'pending'
//     (or 'contact' if they were previously an active contact and you want to restore that).
//     Using 'pending' as it's the schema default and a neutral unblocked state.
//   - If no entry exists or the status is not 'blocked', it indicates no action needed.
try {
    // Check if the contact exists and its current status in the user's contacts table
    // Note: Table name is dynamically inserted, so we wrap it in backticks for safety.
    $stmt_check_existing = $conn->prepare(
        "SELECT id, status FROM `" .
            $user_contacts_table .
            "` WHERE contact_id = ?",
    );

    if ($stmt_check_existing === false) {
        throw new Exception(
            "Database error: Unable to prepare check statement for " .
                $user_contacts_table .
                ".",
        );
    }

    $stmt_check_existing->bind_param("i", $contact_id);
    $stmt_check_existing->execute();
    $result_existing = $stmt_check_existing->get_result();

    if ($result_existing->num_rows > 0) {
        // Contact entry exists, check its status
        $existing_entry = $result_existing->fetch_assoc();
        $existing_id = $existing_entry["id"];
        $current_status = $existing_entry["status"];

        if ($current_status === "blocked") {
            // User is currently blocked, proceed to unblock
            // Set status to 'pending' as a neutral state after unblocking, based on schema default
            $stmt_update = $conn->prepare(
                "UPDATE `" .
                    $user_contacts_table .
                    "` SET status = 'pending' WHERE id = ?", // Use added_at as updated_at
            );
            if ($stmt_update === false) {
                throw new Exception(
                    "Database error: Unable to prepare unblock update statement for " .
                        $user_contacts_table .
                        ".",
                );
            }
            $stmt_update->bind_param("i", $existing_id);
            if ($stmt_update->execute()) {
                $response = [
                    "success" => true,
                    "message" => "User unblocked successfully.",
                ];
                http_response_code(200); // OK
            } else {
                throw new Exception(
                    "Failed to update contact status (unblock) in " .
                        $user_contacts_table .
                        ": " .
                        $conn->error,
                );
            }
            $stmt_update->close();
        } else {
            // User is not blocked (e.g., pending, contact), so no action needed to unblock
            $response = [
                "success" => true,
                "message" => "User is not currently blocked by you.",
            ];
            http_response_code(200); // OK
        }
    } else {
        // No existing entry for this contact in the user's table, meaning they weren't blocked by this user
        $response = [
            "success" => true,
            "message" => "User is not in your contacts or not blocked by you.",
        ];
        http_response_code(200); // OK
    }
    $stmt_check_existing->close();
} catch (Exception $e) {
    http_response_code(500); // Internal Server Error
    $response["message"] = "Server error: " . $e->getMessage();
}

echo json_encode($response);

// Close connection
$conn->close();

?>
