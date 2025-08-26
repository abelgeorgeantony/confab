<?php
require_once "bootstrap.php";

function validate_token($token, $type)
{
    global $conn;

    $stmt = $conn->prepare(
        "SELECT user_id FROM sessions WHERE token = ? AND type = ? AND expires_at > NOW()",
    );
    $stmt->bind_param("ss", $token, $type);
    $stmt->execute();
    $result = $stmt->get_result();

    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        return $row["user_id"]; // Valid token → return user_id
    }

    return false; // Invalid or expired
}
?>
