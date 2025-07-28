<?php
require 'bootstrap.php';
require 'code_mailer.php'; // Include the new helper file

$data = json_decode(file_get_contents("php://input"), true);
$email = $data['email'] ?? '';

if (empty($email)) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "Email is required."]);
    exit;
}

global $conn;

// --- THE FIX: Call the reusable function ---
if (send_verification_code($conn, $email)) {
    echo json_encode(["success" => true, "message" => "A new verification code has been sent."]);
} else {
    http_response_code(500);
    echo json_encode(["success" => false, "error" => "Failed to generate a new code."]);
}
?>
