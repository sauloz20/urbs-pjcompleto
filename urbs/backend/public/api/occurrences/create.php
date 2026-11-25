<?php
// backend/public/api/occurrences/create.php

// 1. Carregar middleware e banco de dados
require_once __DIR__ . '/../../../src/middlewares/auth.php';
require_once __DIR__ . '/../../../config/database.php';

// 2. Exigir autenticação antes de qualquer coisa
requireLogin();

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido.']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Envie os dados da ocorrência em formato JSON válido.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// Capturar os dados
$title = trim($input['title'] ?? '');
$description = trim($input['description'] ?? '');
$address = trim($input['address'] ?? '');
$category_id = filter_var($input['category_id'] ?? 0, FILTER_VALIDATE_INT);
$latitude = $input['latitude'] ?? null;
$longitude = $input['longitude'] ?? null;

// Validação básica
if ($title === '' || $description === '' || !$category_id || $latitude === null || $longitude === null) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Preencha todos os campos obrigatórios e a localização.']);
    exit;
}

if (mb_strlen($title, 'UTF-8') > 150 || mb_strlen($address, 'UTF-8') > 180 || mb_strlen($description, 'UTF-8') > 5000) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Um dos campos excede o tamanho permitido.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$latitude = filter_var($latitude, FILTER_VALIDATE_FLOAT);
$longitude = filter_var($longitude, FILTER_VALIDATE_FLOAT);
if ($latitude === false || $longitude === false || $latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'As coordenadas informadas são inválidas.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    // Iniciar a transação (garante que ou tudo salva, ou nada salva)
    $pdo->beginTransaction();

    // 1. Inserir a ocorrência
    $sqlOccurrence = "INSERT INTO occurrences (user_id, category_id, title, description, address, latitude, longitude, status)
                      VALUES (:user_id, :category_id, :title, :description, :address, :latitude, :longitude, 'pending')";
    
    $stmt = $pdo->prepare($sqlOccurrence);
    $stmt->execute([
        ':user_id'     => $_SESSION['user_id'], // Pego direto da sessão segura!
        ':category_id' => $category_id,
        ':title'       => $title,
        ':description' => $description,
        ':address'     => $address,
        ':latitude'    => $latitude,
        ':longitude'   => $longitude
    ]);

    $occurrence_id = $pdo->lastInsertId();

    // 2. Inserir o registro no histórico inicial
    $sqlHistory = "INSERT INTO occurrence_history (occurrence_id, user_id, new_status, comment) 
                   VALUES (:occurrence_id, :user_id, 'pending', 'Ocorrência registrada pelo cidadão.')";
    
    $stmtHistory = $pdo->prepare($sqlHistory);
    $stmtHistory->execute([
        ':occurrence_id' => $occurrence_id,
        ':user_id'       => $_SESSION['user_id']
    ]);

    // Confirmar a transação
    $pdo->commit();

    http_response_code(201);
    echo json_encode([
        'success' => true,
        'message' => 'Ocorrência registrada com sucesso!',
        'occurrence_id' => $occurrence_id
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    // Desfazer tudo caso ocorra um erro no meio do processo
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Erro interno ao registrar a ocorrência.'
    ], JSON_UNESCAPED_UNICODE);
}
