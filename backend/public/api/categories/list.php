<?php

require_once __DIR__ . '/../../../config/database.php';
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido. Utilize GET.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $stmt = $pdo->query('SELECT id, name, description FROM categories WHERE active = 1 ORDER BY id');
    echo json_encode([
        'success' => true,
        'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)
    ], JSON_UNESCAPED_UNICODE);
} catch (PDOException $e) {
    error_log('Erro ao listar categorias do URBS: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Não foi possível carregar as categorias.'], JSON_UNESCAPED_UNICODE);
}
