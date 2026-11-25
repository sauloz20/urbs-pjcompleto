<?php

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../../config/database.php';

function response(int $status, array $data): void
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    response(405, [
        'success' => false,
        'message' => 'Método não permitido. Utilize POST.'
    ]);
}

$input = json_decode(file_get_contents('php://input'), true);

if (!is_array($input)) {
    response(400, [
        'success' => false,
        'message' => 'Dados inválidos ou formato JSON incorreto.'
    ]);
}

$name = trim($input['name'] ?? '');
$email = strtolower(trim($input['email'] ?? ''));
$password = $input['password'] ?? '';

if ($name === '' || $email === '' || $password === '') {
    response(400, [
        'success' => false,
        'message' => 'Preencha todos os campos obrigatórios.'
    ]);
}

$nameLength = function_exists('mb_strlen')
    ? mb_strlen($name, 'UTF-8')
    : strlen($name);

if ($nameLength > 120) {
    response(400, [
        'success' => false,
        'message' => 'O nome deve possuir no máximo 120 caracteres.'
    ]);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    response(400, [
        'success' => false,
        'message' => 'Informe um endereço de e-mail válido.'
    ]);
}

if (strlen($email) > 150) {
    response(400, [
        'success' => false,
        'message' => 'O e-mail deve possuir no máximo 150 caracteres.'
    ]);
}

if (strlen($password) < 8) {
    response(400, [
        'success' => false,
        'message' => 'A senha deve possuir pelo menos 8 caracteres.'
    ]);
}

try {
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    $sql = "INSERT INTO users (name, email, password)
            VALUES (:name, :email, :password)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':name' => $name,
        ':email' => $email,
        ':password' => $passwordHash
    ]);

    $userId = (int) $pdo->lastInsertId();

    response(201, [
        'success' => true,
        'message' => 'Usuário cadastrado com sucesso!',
        'user' => [
            'id' => $userId,
            'name' => $name,
            'email' => $email,
            'role' => 'citizen',
            'category_id' => null,
            'company_name' => null
        ]
    ]);
} catch (PDOException $e) {
    if ($e->getCode() === '23000') {
        response(409, [
            'success' => false,
            'message' => 'Este e-mail já está cadastrado.'
        ]);
    }

    error_log('Erro no cadastro Urbs: ' . $e->getMessage());

    response(500, [
        'success' => false,
        'message' => 'Não foi possível realizar o cadastro.'
    ]);
}