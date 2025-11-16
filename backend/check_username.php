<?php
ob_start();
require_once "bootstrap.php";

$data = json_decode(file_get_contents("php://input"), true);
$username = $data["username"] ?? "";
if (!is_string($username)) {
    $username = (string) $username;
}
$username = trim($username);

error_log("Checking username: $username");

if (strlen($username) < 3) {
    echo json_encode(["exists" => true]);
    exit();
}

global $conn;
$stmt = $conn->prepare("SELECT id FROM users WHERE username = ?");
$stmt->bind_param("s", $username);
$stmt->execute();

if ($stmt->get_result()->num_rows > 0) {
    echo json_encode(["exists" => true]);
} else {
    echo json_encode(["exists" => false]);
}
ob_end_flush();
?>
