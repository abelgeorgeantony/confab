<?php
require_once "bootstrap.php";
require_once "auth.php";
//header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true);
$email = $data["email"] ?? "";
$code = $data["code"] ?? "";
$purpose = $data["purpose"] ?? ""; // e.g., 'registration', 'password_reset'
error_log("Code: $code, Email: $email");

if (empty($email) || empty($code) || empty($purpose)) {
    echo json_encode([
        "success" => false,
        "error" => "Missing required parameters.",
    ]);
    exit();
}

global $conn;

// Find user and check code
$stmt = $conn->prepare(
    "SELECT id FROM users WHERE email = ? AND verification_code = ?",
);
$stmt->bind_param("ss", $email, $code);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 1) {
    $user = $result->fetch_assoc();
    $user_id = $user["id"];
    // For registration, we create the user's tables and a session
    if ($purpose === "registration") {
        // Mark as verified and clear code
        $stmt = $conn->prepare(
            "UPDATE users SET email_verified = TRUE, code_verified = TRUE, verification_code = NULL WHERE id = ?",
        );
        $stmt->bind_param("i", $user_id);
        $stmt->execute();

        // Create contacts table
        $contacts_table = "contacts_" . intval($user_id);
        $conn->query(
            "CREATE TABLE $contacts_table (id INT AUTO_INCREMENT PRIMARY KEY, contact_id INT NOT NULL, status ENUM('pending', 'contact', 'blocked') NOT NULL DEFAULT 'pending', added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY (contact_id), FOREIGN KEY (contact_id) REFERENCES users(id) ON DELETE CASCADE)",
        );

        // Create a session for the user (like login.php)
        $token = bin2hex(random_bytes(32));
        $expires_at = date("Y-m-d H:i:s", time() + 86400); // 1 day session
        $stmt = $conn->prepare(
            "INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)",
        );
        $stmt->bind_param("iss", $user_id, $token, $expires_at);
        $stmt->execute();

        echo json_encode(["success" => true, "token" => $token]);
    } else {
        // For other purposes, just confirm success
        $stmt = $conn->prepare(
            "UPDATE users SET code_verified = TRUE, verification_code = NULL WHERE id = ?",
        );
        $stmt->bind_param("i", $user_id);
        $stmt->execute();
        echo json_encode(["success" => true]);
    }
} else {
    echo json_encode([
        "success" => false,
        "error" => "Invalid verification code.",
    ]);
}
?>
