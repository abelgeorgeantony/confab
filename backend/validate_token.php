<?php
require_once "auth.php";

//header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"));
$token = $data->token ?? "";
$type = $data->type ?? "";

$user_id = validate_token($token, $type);

if ($user_id !== false) {
    echo json_encode([
        "valid" => true,
        "user_id" => $user_id,
    ]);
} else {
    http_response_code(401);
    echo json_encode([
        "valid" => false,
    ]);
}
?>
