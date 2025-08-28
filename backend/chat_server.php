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
            error_log("✅ User $user_id registered & online");

            // TODO: fetch and deliver inbox_<user_id> messages here later
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

        $sender_id = $this->userConnections[$conn->resourceId];
        $receiver_id = $data["receiver_id"] ?? null;
        $payload = $data["payload"] ?? null;
        error_log("Rid: $receiver_id");

        if (!$receiver_id || !$payload) {
            error_log("⚠️ Invalid message payload from $sender_id");
            return;
        }

        if ($this->isSenderBlocked($sender_id, $receiver_id)) {
            error_log(
                "🚫 Message blocked: Sender $sender_id is blocked by receiver $receiver_id.",
            );
            // Optionally, send a "blocked" confirmation back to the sender's client
            // $conn->send(json_encode(['type' => 'message_blocked', 'to' => $receiver_id]));
            return; // Stop processing the message
        }

        if (isset($this->onlineUsers[$receiver_id])) {
            // Receiver online → send directly
            $this->onlineUsers[$receiver_id]->send(
                json_encode([
                    "type" => "message",
                    "from" => $sender_id,
                    "payload" => $payload,
                ]),
            );
            error_log(
                "📨 Delivered message from $sender_id → $receiver_id (online)",
            );
        } else {
            // Receiver offline → save to inbox_<receiver_id>
            $this->saveToInbox($receiver_id, $sender_id, $payload);
            error_log("💾 Receiver $receiver_id offline → message saved");
        }

        // Always back up the message to the central log
        $this->backupMessage($sender_id, $receiver_id, $payload);
    }

    private function saveToInbox($receiver_id, $sender_id, $payload)
    {
        require_once __DIR__ . "/config.php";
        global $conn;

        $inbox_table = "inbox_" . intval($receiver_id);
        $stmt = $conn->prepare(
            "INSERT INTO $inbox_table (sender_id, payload) VALUES (?, ?)",
        );
        $enc_payload = json_encode($payload);
        $stmt->bind_param("is", $sender_id, $enc_payload);
        $stmt->execute();
    }

    // Saves a copy of every message to the central 'messages' table for history.
    private function backupMessage($sender_id, $receiver_id, $payload)
    {
        require __DIR__ . "/config.php";
        global $conn;
        $status = isset($this->onlineUsers[$receiver_id])
            ? "delivered"
            : "sent";
        $stmt = $conn->prepare(
            "INSERT INTO messages (sender_id, receiver_id, payload, status) VALUES (?, ?, ?, ?)",
        );
        $payload_json = json_encode($payload);
        $stmt->bind_param(
            "iiss",
            $sender_id,
            $receiver_id,
            $payload_json,
            $status,
        );
        $stmt->execute();
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
}

// === Run Server ===
$port = 8080;
$server = IoServer::factory(
    new HttpServer(new WsServer(new ChatServer())),
    $port,
);

error_log("✅ WebSocket ChatServer running on port $port...");
$server->run();
