<?php
require_once "bootstrap.php"; // For database connection ($conn) and environment setup
require_once "auth.php"; // For validate_token function

header("Content-Type: application/json");

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

// --- 3. Prevent self-blocking ---
if ($user_id === $contact_id) {
    http_response_code(400); // Bad Request
    $response["message"] = "You cannot block yourself.";
    echo json_encode($response);
    exit();
}

// --- 4. Validate if contact_id refers to an existing user in the global users table ---
// Ensures that the user being blocked actually exists in the 'users' table.
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
    $response["message"] = "The user you are trying to block does not exist.";
    echo json_encode($response);
    exit();
}
$stmt_check_user->close();

// --- 5. Block the user in the current user's specific contacts table ---
// This section handles the one-sided blocking logic.
//   - Checks if an entry for `contact_id` already exists in `contacts_{$user_id}`.
//   - If it exists and is not 'blocked', it updates its status to 'blocked'.
//   - If no entry exists, it creates a new 'blocked' entry for `contact_id` in `contacts_{$user_id}`.

// Check if a relationship already exists in the current user's contacts table
$stmt_check_relation = $conn->prepare(
    "SELECT id, status FROM " . $user_contacts_table . " WHERE contact_id = ?",
);

if ($stmt_check_relation === false) {
    http_response_code(500); // Internal Server Error
    $response["message"] =
        "Database error: Unable to prepare relation check statement for " .
        $user_contacts_table .
        ".";
    echo json_encode($response);
    exit();
}

$stmt_check_relation->bind_param("i", $contact_id);
$stmt_check_relation->execute();
$result_relation = $stmt_check_relation->get_result();

if ($result_relation->num_rows > 0) {
    // Relationship exists in the current user's table, update its status to 'blocked'
    $existing_relation = $result_relation->fetch_assoc();
    $relation_id = $existing_relation["id"];
    $current_status = $existing_relation["status"];

    if ($current_status === "blocked") {
        $response = [
            "success" => true,
            "message" => "User is already blocked.",
        ];
        http_response_code(200); // OK
    } else {
        // Update the existing contact entry to 'blocked'
        $stmt_update = $conn->prepare(
            "UPDATE " .
                $user_contacts_table .
                " SET status = 'blocked' WHERE id = ?",
        );
        if ($stmt_update === false) {
            http_response_code(500); // Internal Server Error
            $response["message"] =
                "Database error: Unable to prepare update statement for " .
                $user_contacts_table .
                ".";
            echo json_encode($response);
            exit();
        }
        $stmt_update->bind_param("i", $relation_id);
        if ($stmt_update->execute()) {
            $response = [
                "success" => true,
                "message" => "User blocked successfully.",
            ];
            http_response_code(200); // OK
        } else {
            http_response_code(500); // Internal Server Error
            $response["message"] =
                "Failed to update contact status in " .
                $user_contacts_table .
                ": " .
                $conn->error;
        }
        $stmt_update->close();
    }
} else {
    // No existing relationship found for contact_id in the current user's table.
    // Create a new entry with 'blocked' status.
    $stmt_insert = $conn->prepare(
        "INSERT INTO " .
            $user_contacts_table .
            " (contact_id, status, added_at) VALUES (?, 'blocked', NOW())",
    );
    if ($stmt_insert === false) {
        http_response_code(500); // Internal Server Error
        $response["message"] =
            "Database error: Unable to prepare insert statement for " .
            $user_contacts_table .
            ".";
        echo json_encode($response);
        exit();
    }
    $stmt_insert->bind_param("i", $contact_id);
    if ($stmt_insert->execute()) {
        $response = [
            "success" => true,
            "message" => "User blocked successfully.",
        ];
        http_response_code(200); // OK
    } else {
        http_response_code(500); // Internal Server Error
        $response["message"] =
            "Failed to create blocked entry in " .
            $user_contacts_table .
            ": " .
            $conn->error;
    }
    $stmt_insert->close();
}

$stmt_check_relation->close();

echo json_encode($response);

// Close connection
$conn->close();

?>
