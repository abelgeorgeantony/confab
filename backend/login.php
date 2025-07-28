<?php
require_once 'bootstrap.php';
require_once "code_mailer.php";

$data = json_decode(file_get_contents("php://input"));

$username = $conn->real_escape_string($data->username);
$password = $data->password;

$result = $conn->query("SELECT * FROM users WHERE username='$username'");

if ($result->num_rows === 0) {
    http_response_code(401);
    echo json_encode(["error" => "Invalid credentials"]);
    exit;
}

$user = $result->fetch_assoc();

if (!password_verify($password, $user['password_hash'])) {
    http_response_code(401);
    echo json_encode(["error" => "Invalid credentials"]);
    exit;
}

if (!$user['email_verified']) {
    send_verification_code($conn, $user['email']);

    //http_response_code(403); // Forbidden
    // Send a specific error type and the user's email
    echo json_encode([
	"success" => false,
        "error" => "not_verified", 
        "email" => $user['email']
    ]);
    exit;
}


// Generate a random token
$token = bin2hex(random_bytes(32));
$user_id = $user['id'];

$duration = isset($data->duration) ? intval($data->duration) : 86400; // default to 1 day
$expires_at = date('Y-m-d H:i:s', time() + $duration);

$stmt = $conn->prepare("INSERT INTO sessions (user_id, token, created_at, expires_at) VALUES (?, ?, NOW(), ?)");
$stmt->bind_param("iss", $user_id, $token, $expires_at);
$stmt->execute();

echo json_encode(["success" => true, "token" => $token, "display_name" => $user['display_name']]);
?>

