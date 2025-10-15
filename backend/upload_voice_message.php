<?php
require_once "bootstrap.php";
require_once "auth.php";

header("Content-Type: application/json");

// 1. Authenticate the user
// We expect the token to be sent as a POST field along with the file
$token = $_POST["token"] ?? null;
$user_id = validate_token($token, "login");

if (!$user_id) {
    http_response_code(403);
    echo json_encode([
        "success" => false,
        "error" => "Invalid or expired token.",
    ]);
    exit();
}

// 2. Check for the uploaded file
if (!isset($_FILES["voiceMessage"])) {
    http_response_code(400);
    echo json_encode(["success" => false, "error" => "No file was uploaded."]);
    exit();
}

// 3. Perform security and validation checks
$file = $_FILES["voiceMessage"];

if ($file["error"] !== UPLOAD_ERR_OK) {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "File upload error: code " . $file["error"],
    ]);
    exit();
}

$file_size = $file["size"];
if ($file_size > 5 * 1024 * 1024) {
    // 5 MB limit
    http_response_code(413); // Payload Too Large
    echo json_encode([
        "success" => false,
        "error" => "File is too large. 5MB limit.",
    ]);
    exit();
}

// 4. Generate a unique filename and path
$upload_dir = __DIR__ . "/../uploads/voice/";
// Ensure the directory exists (it should be created by start-server.sh, but this is a safeguard)
if (!is_dir($upload_dir)) {
    mkdir($upload_dir, 0755, true);
}

$unique_id = bin2hex(random_bytes(16));
$file_extension = ".bin"; // We are saving an encrypted binary blob
$new_filename = $unique_id . $file_extension;
$destination = $upload_dir . $new_filename;

// 5. Move the file to its final destination
if (move_uploaded_file($file["tmp_name"], $destination)) {
    // 6. Respond with the public URL
    $public_url = "/uploads/voice/" . $new_filename;
    echo json_encode(["success" => true, "url" => $public_url]);
} else {
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "error" => "Failed to save uploaded file.",
    ]);
}

?>
