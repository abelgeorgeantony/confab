<?php

require_once "bootstrap.php"; // For database connection ($conn) and environment setup
require_once "auth.php"; // For validate_token function

//header("Content-Type: application/json");

$response = ["success" => false, "error" => "An unknown error occurred."];

// 1. Validate request method
if ($_SERVER["REQUEST_METHOD"] !== "POST") {
    http_response_code(405); // Method Not Allowed
    $response["error"] = "Invalid request method.";
    echo json_encode($response);
    exit();
}

// 2. Decode JSON input
$data = json_decode(file_get_contents("php://input"), true);

// 3. Validate token presence
$token = $data["token"] ?? null;
if (!$token) {
    http_response_code(400); // Bad Request
    $response["error"] = "Authentication failed: Token is missing.";
    echo json_encode($response);
    exit();
}

// 4. Authenticate token and get user ID
$user_id = validate_token($token, "login");

if ($user_id === false) {
    http_response_code(401); // Unauthorized
    $response["error"] = "Authentication failed: Invalid or expired token.";
    echo json_encode($response);
    exit();
}

// 5. Update message status
try {
    // Update messages where the receiver_id is the current user and status is 'sent'
    $stmt = $conn->prepare(
        "UPDATE messages SET status = 'delivered' WHERE receiver_id = ? AND status = 'queued'",
    );
    $stmt->bind_param("i", $user_id);

    if ($stmt->execute()) {
        // Check if any rows were affected
        if ($stmt->affected_rows > 0) {
            $response["success"] = true;
            $response["message"] =
                $stmt->affected_rows . " messages marked as delivered.";
        } else {
            $response["success"] = true; // Still a success, just no messages to update
            $response["message"] = "No new messages to mark as delivered.";
        }
    } else {
        throw new Exception("Database update failed: " . $stmt->error);
    }
} catch (Exception $e) {
    http_response_code(500); // Internal Server Error
    $response["error"] = $e->getMessage();
} finally {
    if (isset($stmt)) {
        $stmt->close();
    }
    $conn->close();
}

echo json_encode($response);

?>
