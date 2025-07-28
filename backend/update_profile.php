<?php
require_once "bootstrap.php";
require_once "auth.php";

//header('Content-Type: application/json');

// We use $_POST and $_FILES because the data is sent as 'multipart/form-data'
$token = $_POST['token'] ?? null;
$user_id = validate_token($token);

// 1. Authenticate the user
if (!$user_id) {
    http_response_code(401); // Unauthorized
    echo json_encode(["success" => false, "error" => "Invalid or expired session. Please login again."]);
    exit;
}

// 2. Initialize variables for data to be updated
$display_name = trim($_POST['display_name'] ?? '');
$username = trim($_POST['username'] ?? ''); // For general profile updates
$bio = trim($_POST['bio'] ?? '');
$pfp_url = null; // This will hold the new path if a picture is uploaded

// 3. Handle the profile picture upload
if (isset($_FILES['profile_picture']) && $_FILES['profile_picture']['error'] === 0) {
    $file = $_FILES['profile_picture'];
    
    // IMPORTANT: Make sure you have an 'uploads' directory in your project root
    $upload_dir = '../uploads/'; 
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0775, true); // Create the directory if it doesn't exist
    }

    $file_ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed_exts = ['jpg', 'jpeg', 'png', 'gif'];

    if (in_array($file_ext, $allowed_exts)) {
        // Create a unique filename to prevent conflicts and overwriting
        $file_name = "pfp_" . $user_id . "_" . time() . "." . $file_ext;
        $destination = $upload_dir . $file_name;
        
        if (move_uploaded_file($file['tmp_name'], $destination)) {
            // If upload is successful, set the URL to be saved in the database
            $pfp_url = 'uploads/' . $file_name; 
        }
    }
}

// 4. Dynamically build the SQL query based on what data was provided
global $conn;
$fields = []; // Holds parts of the query like "display_name = ?"
$params = []; // Holds the values to bind
$types = "";  // Holds the type string for bind_param, e.g., "sssi"

// Add fields to the update query only if they have new data
if (!empty($display_name)) { $fields[] = "display_name = ?"; $params[] = &$display_name; $types .= "s"; }
if (!empty($bio)) { $fields[] = "bio = ?"; $params[] = &$bio; $types .= "s"; }
if ($pfp_url) { $fields[] = "profile_picture_url = ?"; $params[] = &$pfp_url; $types .= "s"; }

// Special handling for username to check for conflicts
if (!empty($username)) {
    $stmt_check = $conn->prepare("SELECT id FROM users WHERE username = ? AND id != ?");
    $stmt_check->bind_param("si", $username, $user_id);
    $stmt_check->execute();
    if ($stmt_check->get_result()->num_rows > 0) {
        http_response_code(409); // Conflict
        echo json_encode(["success" => false, "error" => "Username is already taken by another user."]);
        exit;
    }
    $fields[] = "username = ?"; $params[] = &$username; $types .= "s";
}

// If no fields were provided, there's nothing to update
if (empty($fields)) {
    echo json_encode(["success" => false, "error" => "No data provided to update."]);
    exit;
}

// 5. Execute the final database update
$sql = "UPDATE users SET " . implode(", ", $fields) . " WHERE id = ?";
$params[] = &$user_id;
$types .= "i";

$stmt = $conn->prepare($sql);
// Use call_user_func_array to bind params from the arrays we built
call_user_func_array([$stmt, 'bind_param'], array_merge([$types], $params));

if ($stmt->execute()) {
    echo json_encode(["success" => true, "message" => "Profile updated successfully."]);
} else {
    http_response_code(500); // Internal Server Error
    echo json_encode(["success" => false, "error" => "A database error occurred."]);
}
?>

