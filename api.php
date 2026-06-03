<?php
session_start(); // Запуск сессии
header('Content-Type: application/json; charset=utf-8');

// 1. Класс для работы с БД (ООП)
class DB
{
    private $pdo;
    public function __construct()
    {
        // Подключение к MySQL
        $this->pdo = new PDO("mysql:host=localhost;dbname=korochki_DB;charset=utf8mb4", "root", "");
    }
    // Метод выполнения запроса
    public function q($sql, $p = [])
    {
        $s = $this->pdo->prepare($sql);
        $s->execute($p);
        return $s;
    }
}
$db = new DB();
$action = $_GET['a'] ?? ''; // Получаем действие из URL (?a=login)
$data = json_decode(file_get_contents('php://input'), true); // Данные из JSON

// --- 2. Регистрация ---
if ($action === 'reg') {
    $e = []; // Массив ошибок
    // Валидация Regex
    if (!preg_match('/^[a-z0-9]{6,}$/i', $data['login']))
        $e['login'] = 'Лат+цифры, мин 6';
    if (strlen($data['pass']) < 8)
        $e['pass'] = 'Мин 8 символов';
    if (!preg_match('/^[\p{Cyrillic} ]+$/u', $data['fio']))
        $e['fio'] = 'Только кириллица';
    if (!preg_match('/^8\(\d{3}\)\d{3}-\d{2}-\d{2}$/', $data['phone']))
        $e['phone'] = '8(XXX)XXX-XX-XX';
    if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL))
        $e['email'] = 'Неверный email';

    if (empty($e)) {
        // Проверка уникальности
        $cnt = $db->q("SELECT COUNT(*) c FROM users WHERE login=?", [$data['login']])->fetch()['c'];
        if ($cnt > 0)
            exit(json_encode(['err' => ['login' => 'Логин занят']]));

        // Insert в БД (password_hash шифрует пароль)
        $db->q(
            "INSERT users(login,pwd_hash,fio,phone,email) VALUES(?,?,?,?,?)",
            [$data['login'], password_hash($data['pass'], PASSWORD_DEFAULT), $data['fio'], $data['phone'], $data['email']]
        );
        exit(json_encode(['ok' => 1]));
    }
    exit(json_encode(['err' => $e])); // Возврат ошибок
}

// --- 3. Авторизация ---
if ($action === 'login') {
    // Админ (хардкод по ТЗ)
    if ($data['login'] === 'Admin' && $data['pass'] === 'KorokNET') {
        $_SESSION['role'] = 'admin';
        $_SESSION['fio'] = 'Администратор';
        exit(json_encode(['ok' => 1, 'role' => 'admin', 'fio' => 'Администратор']));
    }

    // Обычный юзер
    $u = $db->q("SELECT * FROM users WHERE login=?", [$data['login']])->fetch();
    if ($u && password_verify($data['pass'], $u['pwd_hash'])) {
        $_SESSION['uid'] = $u['id'];
        $_SESSION['role'] = 'user';
        $_SESSION['fio'] = $u['fio'];
        exit(json_encode(['ok' => 1, 'role' => 'user', 'fio' => $u['fio']]));
    }
    exit(json_encode(['err' => 'Неверные данные']));
}

// --- 4. Список заявок (User) ---
if ($action === 'myapps') {
    if (!$_SESSION['uid'])
        exit(json_encode(['err' => 'auth']));
    exit(json_encode($db->q("SELECT * FROM apps WHERE user_id=?", [$_SESSION['uid']])->fetchAll()));
}

// --- 5. Новая заявка ---
if ($action === 'newapp') {
    if (!$_SESSION['uid'])
        exit(json_encode(['err' => 'auth']));
    $db->q(
        "INSERT apps(user_id,course,start_date,pay_method) VALUES(?,?,?,?)",
        [$_SESSION['uid'], $data['course'], $data['date'], $data['pay']]
    );
    exit(json_encode(['ok' => 1]));
}

// --- 6. Отзыв ---
if ($action === 'feedback') {
    $db->q("UPDATE apps SET feedback=? WHERE id=?", [$data['fb'], $data['id']]);
    exit(json_encode(['ok' => 1]));
}

// --- 7. Админка (Список + Фильтр) ---
if ($action === 'adminapps') {
    if ($_SESSION['role'] !== 'admin')
        exit(json_encode(['err' => 'Доступ запрещён']));
    $f = $_GET['f'] ?? ''; // Фильтр из GET
    $sql = "SELECT a.*, u.fio, u.email FROM apps a JOIN users u ON a.user_id=u.id";
    $params = [];
    if ($f) {
        $sql .= " WHERE a.status=?";
        $params[] = $f;
    }
    exit(json_encode($db->q($sql, $params)->fetchAll()));
}

// --- 8. Смена статуса ---
if ($action === 'setstatus') {
    if ($_SESSION['role'] !== 'admin')
        exit(json_encode(['err' => 'Доступ запрещён']));
    $db->q("UPDATE apps SET status=? WHERE id=?", [$data['status'], $data['id']]);
    exit(json_encode(['ok' => 1]));
}
?>