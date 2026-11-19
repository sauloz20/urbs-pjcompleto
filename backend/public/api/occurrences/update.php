<?php

require_once __DIR__ . '/../../../src/middlewares/auth.php';
require_once __DIR__ . '/../../../config/database.php';
requireLogin();

header('Content-Type: application/json; charset=utf-8');

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['success' => false, 'message' => 'Método não permitido. Utilize POST.']);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) {
    respond(400, ['success' => false, 'message' => 'Envie os dados da ocorrência em formato JSON.']);
}

$occurrenceId = filter_var($input['occurrence_id'] ?? 0, FILTER_VALIDATE_INT);
$categoryId = filter_var($input['category_id'] ?? 0, FILTER_VALIDATE_INT);
$title = trim($input['title'] ?? '');
$description = trim($input['description'] ?? '');
$address = trim($input['address'] ?? '');
$latitude = filter_var($input['latitude'] ?? null, FILTER_VALIDATE_FLOAT);
$longitude = filter_var($input['longitude'] ?? null, FILTER_VALIDATE_FLOAT);

if (!$occurrenceId || !$categoryId || $title === '' || $description === '' || $latitude === false || $longitude === false) {
    respond(400, ['success' => false, 'message' => 'Preencha os campos obrigatórios e selecione uma localização válida.']);
}

if (mb_strlen($title, 'UTF-8') > 150 || mb_strlen($address, 'UTF-8') > 180 || mb_strlen($description, 'UTF-8') > 5000) {
    respond(400, ['success' => false, 'message' => 'Um dos campos excede o tamanho permitido.']);
}

if ($latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
    respond(400, ['success' => false, 'message' => 'As coordenadas informadas são inválidas.']);
}

try {
    $stmt = $pdo->prepare('SELECT user_id, status FROM occurrences WHERE id = :id LIMIT 1');
    $stmt->execute([':id' => $occurrenceId]);
    $occurrence = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$occurrence) {
        respond(404, ['success' => false, 'message' => 'Ocorrência não encontrada.']);
    }

    $isMaster = ($_SESSION['role'] ?? '') === 'master';
    $isOwnerWithPendingOccurrence = (int) $occurrence['user_id'] === (int) $_SESSION['user_id']
        && $occurrence['status'] === 'pending';

    if (!$isMaster && !$isOwnerWithPendingOccurrence) {
        respond(403, ['success' => false, 'message' => 'Você só pode editar suas próprias ocorrências ainda não analisadas.']);
    }

    $sql = 'UPDATE occurrences
            SET category_id = :category_id,
                title = :title,
                description = :description,
                address = :address,
                latitude = :latitude,
                longitude = :longitude
            WHERE id = :id';
    $update = $pdo->prepare($sql);
    $update->execute([
        ':category_id' => $categoryId,
        ':title' => $title,
        ':description' => $description,
        ':address' => $address,
        ':latitude' => $latitude,
        ':longitude' => $longitude,
        ':id' => $occurrenceId
    ]);

    respond(200, ['success' => true, 'message' => 'Ocorrência atualizada com sucesso.']);
} catch (PDOException $e) {
    error_log('Erro ao atualizar ocorrência no URBS: ' . $e->getMessage());
    respond(500, ['success' => false, 'message' => 'Não foi possível atualizar a ocorrência.']);
}
