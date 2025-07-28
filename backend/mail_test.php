<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

require_once 'vendor/autoload.php';

$mail = new PHPMailer(true);

//Configure an SMTP
$mail->isSMTP();
$mail->Host = "smtp.gmail.com";
$mail->SMTPAuth = true;
$mail->Username = "abel.chatapp@gmail.com";
$mail->Password = "lrde ibev nqav gqrg";
$mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
$mail->Port = 587;

// Sender information
$mail->setFrom('abel.chatapp@gmail.com', 'just test');

// Multiple recipient email addresses and names
// Primary recipients
$mail->addAddress('abelgeorgeantony@gmail.com', 'Abel George Antony');  

$mail->isHTML(false);

$mail->Subject = "Chat verification code";

$mail->Body    = "Here is your verification code:";

// Attempt to send the email
if (!$mail->send()) {
    echo 'Email not sent. An error was encountered: ' . $mail->ErrorInfo;
} else {
    echo 'Message has been sent.';
}

$mail->smtpClose();
?>
