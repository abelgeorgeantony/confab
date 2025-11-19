<?php
require_once "bootstrap.php";
require_once __DIR__ . "/auth.php"; // reuse validate_token()

use Ratchet\MessageComponentInterface;
use Ratchet\ConnectionInterface;
use Ratchet\Http\HttpServer;
use Ratchet\Server\IoServer;
use Ratchet\WebSocket\WsServer;

class ChatServer implements MessageComponentInterface
{
    protected $connections = []; // resourceId => connection
    protected $onlineUsers = []; // user_id => connection
    protected $userConnections = []; // resourceId => user_id

    public function onOpen(ConnectionInterface $conn)
    {
        error_log("🔌 New WebSocket connection: {$conn->resourceId}");
        $this->connections[$conn->resourceId] = $conn;
    }

    public function onMessage(ConnectionInterface $conn, $msg)
    {
        error_log("📩 Message from {$conn->resourceId}: $msg");
        $data = json_decode($msg, true);

        if (!isset($data["type"])) {
            error_log("⚠️ Invalid message structure (missing type)");
            return;
        }

        switch ($data["type"]) {
            case "register":
                $this->handleRegister($conn, $data);
                break;

            case "message":
                $this->handleMessage($conn, $data);
                break;

            case "message_received_ack":
                $this->handleMessageAcknowledgement($conn, $data, "delivered");
                break;

            case "message_read_ack":
                $this->handleMessageAcknowledgement($conn, $data, "read");
                break;

            /*case "all_message_received_ack":
                $this->handleAllMessageAcknowledgement($conn, $data);
                break;*/

            default:
                error_log("⚠️ Unknown message type: {$data["type"]}");
        }
    }

    public function onClose(ConnectionInterface $conn)
    {
        error_log("❌ Connection {$conn->resourceId} closed");

        // If this connection belonged to a user, mark them offline
        if (isset($this->userConnections[$conn->resourceId])) {
            $user_id = $this->userConnections[$conn->resourceId];
            unset($this->onlineUsers[$user_id]);
            unset($this->userConnections[$conn->resourceId]);
            $this->sendOfflineStatusToContacts($user_id);
            error_log("👤 User $user_id is now offline");
        }

        unset($this->connections[$conn->resourceId]);
    }

    public function onError(ConnectionInterface $conn, \Exception $e)
    {
        error_log("💥 WebSocket error: {$e->getMessage()}");
        $conn->close();
    }

    private function handleRegister(ConnectionInterface $conn, array $data)
    {
        $token = $data["token"] ?? null;
        $user_id = validate_token($token, "login");

        if ($user_id) {
            $this->onlineUsers[$user_id] = $conn;
            $this->userConnections[$conn->resourceId] = $user_id;
            $this->sendOnlineStatusToContacts($user_id);
            error_log("✅ User $user_id registered & online");
        } else {
            error_log("❌ Invalid token for {$conn->resourceId}");
            $conn->close();
        }
    }

    private function handleMessage(ConnectionInterface $conn, array $data)
    {
        if (!isset($this->userConnections[$conn->resourceId])) {
            error_log("⛔ Message rejected: sender not authenticated");
            return;
        }

        print_r($data);

        $sender_id = $this->userConnections[$conn->resourceId];
        $receiver_id = $data["receiver_id"] ?? null;
        $client_message_id = $data["client_message_id"] ?? null;
        $payload = $data["payload"] ?? null;
        error_log("Rid: $receiver_id");

        if (!$receiver_id || !$payload) {
            error_log("⚠️ Invalid message payload from $sender_id");
            return;
        }

        error_log($this->isSenderBlocked($sender_id, $receiver_id));
        if ($this->isSenderBlocked($sender_id, $receiver_id)) {
            error_log(
                "🚫 Message blocked: Sender $sender_id is blocked by receiver $receiver_id.",
            );
            // Optionally, send a "blocked" confirmation back to the sender's client
            // $conn->send(json_encode(['type' => 'message_blocked', 'to' => $receiver_id]));
            return; // Stop processing the message
        }

        // Always back up the message to the central log
        $message_id = $this->backupMessage(
            $sender_id,
            $receiver_id,
            $payload,
            $data["message_type"],
        );
        if ($message_id) {
            $conn->send(
                json_encode([
                    "type" => "message_saved_receipt",
                    "receiver_id" => $receiver_id,
                    "id" => $message_id, // This is the ID from the server
                    "message_status" => "queued",
                    "client_message_id" => $client_message_id, // This is the original ID from the client
                ]),
            );
            error_log(
                "✅ Sent message receipt to $sender_id for message $message_id (client ID: $client_message_id)",
            );
        }

        if (isset($this->onlineUsers[$receiver_id])) {
            // Receiver online → send directly
            $this->onlineUsers[$receiver_id]->send(
                json_encode([
                    "type" => "message",
                    "id" => $message_id,
                    "from" => $sender_id,
                    "message_type" => $data["message_type"],
                    "payload" => $payload,
                ]),
            );
            error_log(
                "📨 Delivered message from $sender_id → $receiver_id (online)",
            );
        }
    }

    private function handleMessageAcknowledgement(
        ConnectionInterface $conn,
        array $data,
        $status,
    ) {
        if (!isset($this->userConnections[$conn->resourceId])) {
            error_log("⛔ Acknowledgement rejected: sender not authenticated");
            return;
        }

        $receiver_id = $this->userConnections[$conn->resourceId];
        $sender_id = $data["sender_id"] ?? null;

        $message_id = $data["id"] ?? null;
        $message_type = $data["message_type"] ?? null;

        $success = $this->updateMessageStatus(
            $sender_id,
            $receiver_id,
            $message_id,
            $message_type,
            $status,
        );
        if ($success) {
            if (isset($this->onlineUsers[$sender_id])) {
                $this->onlineUsers[$sender_id]->send(
                    json_encode([
                        "type" => "message_status_ack",
                        "id" => $message_id,
                        "receiver_id" => $receiver_id,
                        "message_status" => $status,
                    ]),
                );
                error_log(
                    "📨 Delivered message from $sender_id → $receiver_id (online)",
                );
            }
        } else {
            error_log("❌ Failed to update message status");
            return false;
        }
    }

    // Saves a copy of every message to the central 'messages' table for history.
    private function backupMessage(
        $sender_id,
        $receiver_id,
        $payload,
        $message_type,
    ) {
        require __DIR__ . "/config.php";
        global $conn;
        $status = isset($this->onlineUsers[$receiver_id])
            ? "delivered"
            : "queued";
        $stmt = $conn->prepare(
            "INSERT INTO messages (sender_id, receiver_id, message_type, payload, status) VALUES (?, ?, ?, ?, ?)",
        );
        $payload_json = json_encode($payload);
        $stmt->bind_param(
            "iisss",
            $sender_id,
            $receiver_id,
            $message_type,
            $payload_json,
            $status,
        );
        if ($stmt->execute()) {
            return $conn->insert_id;
        }
        return false;
    }

    private function updateMessageStatus(
        $sender_id,
        $receiver_id,
        $message_id,
        $message_type,
        $status,
    ) {
        error_log("Updating message status");
        require __DIR__ . "/config.php";
        global $conn;
        // Need to add checks which only allow the status to be upgraded updwards. That is, a sent message
        // shouldn't be updates to delivered or queued status.

        // update
        $stmt = $conn->prepare(
            "UPDATE messages SET status = ? WHERE id = ? AND sender_id = ? AND receiver_id = ? AND message_type = ?",
        );
        $stmt->bind_param(
            "siiis",
            $status,
            $message_id,
            $sender_id,
            $receiver_id,
            $message_type,
        );
        if ($stmt->execute()) {
            return true;
        }
        return false;
    }

    private function isSenderBlocked($sender_id, $receiver_id)
    {
        require __DIR__ . "/config.php";
        global $conn;

        // The table to check the RECEIVER'S contact list.
        $contacts_table = "contacts_" . intval($receiver_id);

        // Check if the SENDER'S ID is in the receiver's contact list with a status of 'blocked'.
        $stmt = $conn->prepare(
            "SELECT id FROM $contacts_table WHERE contact_id = ? AND status = 'blocked'",
        );
        $stmt->bind_param("i", $sender_id);
        $stmt->execute();
        $result = $stmt->get_result();

        return $result->num_rows > 0;
    }

    private function getContactsOf($user_id)
    {
        require __DIR__ . "/config.php";
        global $conn;
        $contacts = [];

        $contacts_table = "contacts_" . intval($user_id);

        $stmt = $conn->prepare(
            "SELECT contact_id FROM $contacts_table WHERE status != 'blocked'",
        );
        if ($stmt->execute()) {
            $result = $stmt->get_result();

            while ($row = $result->fetch_assoc()) {
                $contacts[] = $row["contact_id"];
            }
            $stmt->close();
            return $contacts;
        }
        return false;
    }

    private function sendOnlineStatusToContacts($user_id)
    {
        require __DIR__ . "/config.php";
        global $conn;

        $is_online = 1;
        $stmt = $conn->prepare("UPDATE users SET is_online = ? WHERE id = ?");
        $stmt->bind_param("ii", $is_online, $user_id); // "b" for boolean, "i" for integer

        if ($stmt->execute()) {
            error_log(
                "✅ User $user_id is_online status updated to " .
                    ($is_online ? "true" : "false"),
            );
        } else {
            error_log(
                "❌ Failed to update user $user_id is_online status: " .
                    $stmt->error,
            );
        }

        $contacts = $this->getContactsOf($user_id);
        if (!$contacts) {
            return false;
        }

        $statusMessage = json_encode([
            "type" => "user_status",
            "user_id" => $user_id,
            "is_online" => 1,
        ]);

        foreach ($contacts as $contactId) {
            if (isset($this->onlineUsers[$contactId])) {
                $this->onlineUsers[$contactId]->send($statusMessage);
                error_log(
                    "✅ Notified user $contactId that user $user_id is online",
                );
            }
        }
        return true;
    }

    private function sendOfflineStatusToContacts($user_id)
    {
        require __DIR__ . "/config.php";
        global $conn;

        $is_online = 0;
        $stmt = $conn->prepare("UPDATE users SET is_online = ? WHERE id = ?");
        $stmt->bind_param("ii", $is_online, $user_id); // "b" for boolean, "i" for integer

        if ($stmt->execute()) {
            error_log(
                "✅ User $user_id is_online status updated to " .
                    ($is_online ? "true" : "false"),
            );
        } else {
            error_log(
                "❌ Failed to update user $user_id is_online status: " .
                    $stmt->error,
            );
        }

        $contacts = $this->getContactsOf($user_id);
        if (!$contacts) {
            return false;
        }

        $statusMessage = json_encode([
            "type" => "user_status",
            "user_id" => $user_id,
            "is_online" => 0,
        ]);

        foreach ($contacts as $contactId) {
            if (isset($this->onlineUsers[$contactId])) {
                $this->onlineUsers[$contactId]->send($statusMessage);
                error_log(
                    "✅ Notified user $contactId that user $user_id is offline",
                );
            }
        }
        return true;
    }
}

// === Run Server ===
$port = 8080;
$server = IoServer::factory(
    new HttpServer(new WsServer(new ChatServer())),
    $port,
);

error_log("✅ WebSocket ChatServer running on port $port...");
$server->run();
