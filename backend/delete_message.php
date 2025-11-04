<?php

require_once "bootstrap.php";
require_once "auth.php"; // Contains the validate_token function

// Get the raw POST data
$input = file_get_contents("php://input");
$data = json_decode($input, true);

$response = ["success" => false, "message" => "An unknown error occurred."];

// 1. Validate the authentication token
$token = $data["token"] ?? null;

if (!$token) {
    http_response_code(401); // Unauthorized
    $response["message"] = "Authentication failed: Missing token.";
    echo json_encode($response);
    exit();
}

$user_id = validate_token($token, "login");

if ($user_id === false) {
    http_response_code(401); // Unauthorized
    $response["message"] = "Authentication failed: Invalid or expired token.";
    echo json_encode($response);
    exit();
}

// 2. Validate messageId
if (!isset($data["messageId"])) {
    http_response_code(400); // Bad Request
    $response["message"] = "Bad Request: messageId is required.";
    echo json_encode($response);
    exit();
}

$messageId = $data["messageId"];

// Ensure messageId is an integer to prevent type juggling and basic injection
if (!is_numeric($messageId) || $messageId <= 0) {
    http_response_code(400); // Bad Request
    $response["message"] = "Bad Request: Invalid messageId format.";
    echo json_encode($response);
    exit();
}

// Convert to integer for strict comparison and database binding
$messageId = (int) $messageId;

// 3. Database Operation: Delete the message using a prepared statement
//    IMPORTANT: Add logic to ensure only the owner of the message can delete it.
//    This requires fetching the message first or adding a user_id condition to the DELETE query.

// Example of a secure DELETE query using prepared statements
// You should add a condition to check if $user_id is the sender/owner of the message.
try {
    // Now, proceed with deletion if authorized
    $stmt_delete = $conn->prepare(
        "DELETE FROM messages WHERE id = ? AND sender_id = ?",
    );
    $stmt_delete->bind_param("ii", $messageId, $user_id);

    if ($stmt_delete->execute()) {
        if ($stmt_delete->affected_rows > 0) {
            $response = [
                "success" => true,
                "message" => "Message " . $messageId . " deleted successfully.",
            ];
        } else {
            // This case should ideally not be reached if the check above passed,
            // but kept for robustness.
            http_response_code(404); // Not Found
            $response["message"] =
                "Message " . $messageId . " not found or already deleted.";
        }
    } else {
        http_response_code(500); // Internal Server Error
        $response["message"] =
            "Database error during deletion: " . $conn->error;
    }
    $stmt_delete->close();
} catch (Exception $e) {
    http_response_code(500); // Internal Server Error
    $response["message"] = "Server error: " . $e->getMessage();
}

echo json_encode($response);

// Close connection (optional, as PHP closes it automatically at script end)
$conn->close();

?>
