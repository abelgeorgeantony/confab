<?php
require_once "bootstrap.php";
/**
 * Generates a new verification code for a user, saves it to the database,
 * and sends it via email.
 *
 * @param mysqli $conn The database connection object.
 * @param string $email The email address of the user.
 * @return bool True on success, false on failure.
 */
function send_verification_code(mysqli $conn, string $email): bool {
    error_log("Mailing function started");
    if (empty($email)) {
        return false;
    }

    // Generate a new 6-digit code
    $new_code = random_int(100000, 999999);

    // Update the code in the database for the given email
    $stmt = $conn->prepare("UPDATE users SET verification_code = ? WHERE email = ?");
    $stmt->bind_param("ss", $new_code, $email);
    
    if (!$stmt->execute()) {
        error_log("Failed to update verification code for $email in DB.");
        return false; // Database update failed
    }

    error_log("Code: $new_code saved in db, proceeding to use smtp");

    $subject = "Your Verification Code - Perfect Chat";
    $body = "<h2>Welcome to Perfect Chat!</h2><p>Your verification code is: <b>$new_code</b></p>";
    
    // IMPORTANT: Escape all arguments to prevent command injection vulnerabilities
    $recipient_arg = escapeshellarg($email);
    $subject_arg = escapeshellarg($subject);
    $body_arg = escapeshellarg($body);

    // Get the full path to the PHP executable and the script
    $php_executable = PHP_BINARY; // Finds the path to the 'php' command on the server
    $script_path = __DIR__ . '/send_email_cli.php';

    // Build the command to run in the background
    // The "> /dev/null 2>&1 &" part is crucial for making it asynchronous on Linux/macOS
    $command = "$php_executable $script_path $recipient_arg $subject_arg $body_arg > /dev/null 2>&1 &";
    
    // For Windows servers, the command would be slightly different:
    // $command = "start /B \"email\" $php_executable $script_path $recipient_arg $subject_arg $body_arg";

    exec($command);

    // We return true immediately, as the command has been fired off.
    // The web script does not wait for the email to be sent.
    return true;
}

