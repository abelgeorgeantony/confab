<?php
// This script is meant to be called from the command line ONLY.
// Example: php backend/send_email_cli.php "user@example.com" "Subject" "<html>Body</html>"

// We must change the directory to the script's location to ensure correct file include

// Use the bootstrap file to load environment, config, and Composer autoloader.
require_once 'bootstrap.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// $argv is an array containing command-line arguments.
// $argv[0] is the script name itself. We need at least 3 more arguments.
if ($argc < 4) {
    die("Error: Missing arguments. Usage: php send_email_cli.php {recipient} {subject} {body}\n");
}

$recipient = $argv[1];
$subject = $argv[2];
$body = $argv[3];

$mail = new PHPMailer(true);

try {
    // Use $_ENV variables for configuration
    $mail->isSMTP();
    $mail->Host       = $_ENV['SMTP_HOST'];
    $mail->SMTPAuth   = true;
    $mail->Username   = $_ENV['SMTP_USER'];
    $mail->Password   = $_ENV['SMTP_PASS'];
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port       = $_ENV['SMTP_PORT'];

    // Email details from arguments
    $mail->setFrom($_ENV['SMTP_USER'], 'Perfect Chat');
    $mail->addAddress($recipient);
    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body    = $body;

    $mail->send();
    // No output is needed on success, as this runs in the background.
} catch (Exception $e) {
    // Log any errors to the main PHP error log for debugging.
    error_log("CLI Mailer failed for $recipient: " . $mail->ErrorInfo);
}

