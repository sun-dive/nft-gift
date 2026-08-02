<?php
// nft.gift — © 2026 sun-dive — Licensed under the Business Source License 1.1 (see LICENSE).
// nft.gift — store a shared card (the free tier). Returns {"id":"…"} → link is /open/?c=<id>.
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); echo '{"error":"post only"}'; exit; }
$data = file_get_contents('php://input');
$len  = strlen($data);
if ($len < 60 || $len > 1600000) { http_response_code(413); echo '{"error":"size"}'; exit; }        // ~1.6MB cap
if (strpos($data, '<svg') === false || strpos($data, 'nftsale.card') === false) { http_response_code(400); echo '{"error":"not a card"}'; exit; }
if (preg_match('/<script|javascript:|\son\w+\s*=/i', $data)) { http_response_code(400); echo '{"error":"unsafe"}'; exit; }  // no active content
$dir = __DIR__ . '/cards';
if (!is_dir($dir)) @mkdir($dir, 0755, true);
$id = substr(bin2hex(random_bytes(6)), 0, 10);
if (@file_put_contents($dir . '/' . $id . '.svg', $data) === false) { http_response_code(500); echo '{"error":"save failed"}'; exit; }
echo json_encode(['id' => $id]);
