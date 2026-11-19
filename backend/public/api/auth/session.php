<?php

require_once __DIR__ . '/../../../src/middlewares/auth.php';
header('Content-Type: application/json; charset=utf-8');

if (!isset($_SESSION['user_id'])) {
    echo json_encode([
        'success' => true,
        'authenticated' => false,
        'user' => null
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode([
    'success' => true,
    'authenticated' => true,
    'user' => [
        'id' => (int) $_SESSION['user_id'],
        'name' => $_SESSION['name'] ?? '',
        'role' => $_SESSION['role'] ?? 'citizen',
        'category_id' => isset($_SESSION['category_id']) ? (int) $_SESSION['category_id'] : null
    ]
], JSON_UNESCAPED_UNICODE);
