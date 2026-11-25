# URBS — Projeto completo

**Aplicação acadêmica para registrar e acompanhar situações de infraestrutura urbana em Montes Claros–MG.** Este repositório reúne a interface web URBS e a API PHP/MySQL do backend.

> O URBS é um projeto acadêmico independente e não possui vínculo com a Prefeitura de Montes Claros. Os pontos exibidos como exemplo são fictícios; os registros cadastrados são armazenados apenas no banco configurado para esta aplicação.

## Tecnologias

- Frontend: HTML, CSS e JavaScript, Leaflet, GSAP e CesiumJS.
- Backend: PHP 8+, PDO e sessões.
- Banco de dados: MySQL ou MariaDB.
- Mapa: Leaflet com OpenStreetMap.

## Trabalho em dupla

- Frontend e integração: [Saulo Gabriel Rodrigues Guimarães](https://github.com/sauloz20).
- Backend: [Davi161108](https://github.com/Davi161108).
- Repositórios de origem: [interface URBS](https://github.com/sauloz20/urbs) · [backend do projeto](https://github.com/Davi161108/TCC-Project).

## Executar com XAMPP

1. Copie ou clone este repositório para a pasta `htdocs` definida no `DocumentRoot` do Apache (no XAMPP usado no projeto, `C:\Users\aluno\xampp\htdocs\urbs-pjcompleto`).
2. Abra o XAMPP e inicie **Apache** e **MySQL**.
3. Acesse o phpMyAdmin em `http://localhost/phpmyadmin` e importe `database/urbs.sql`. O arquivo cria o banco `urbs`, as tabelas e as categorias usadas pelo frontend.
4. Confira a conexão em `backend/config/database.php`. Os valores padrão são `localhost`, banco `urbs`, usuário `root` e senha vazia, que correspondem à instalação padrão do XAMPP.
5. Abra `http://localhost/urbs-pjcompleto/public/`.

Use o endereço pelo Apache do XAMPP, não abra os arquivos diretamente e não use apenas Live Server: a autenticação e os registros dependem do PHP e do MySQL.

## Fluxo da aplicação

- Crie uma conta pela tela **Entrar**. O cadastro exige senha com pelo menos 8 caracteres.
- Entre com a conta para visualizar o mapa e registrar ocorrências.
- O formulário permite selecionar a categoria, descrever o problema e marcar a localização no mapa.
- A pessoa que registrou pode editar ou excluir a própria ocorrência enquanto ela estiver com status **Novo**.
- Contas com papel `resolver` ou `master` podem atualizar o status, conforme as permissões da API.

Para promover uma conta localmente a administradora, altere seu papel diretamente no phpMyAdmin, depois de criar a conta:

```sql
UPDATE users SET role = 'master' WHERE email = 'seu-email@exemplo.com';
```

Não existe conta administrativa pré-cadastrada. Não use essa alteração em um servidor aberto ao público.

## Estrutura

```text
public/                   Interface URBS principal
backend/config/            Conexão com MySQL
backend/public/api/        Endpoints de autenticação e ocorrências
backend/src/               Middleware e regras do backend
database/                  Esquema inicial e migração
web/                       Interface complementar que veio junto do backend
```

A interface principal está em `public/`. A pasta `web/` mantém a interface complementar que acompanhava o backend original.

## Observações

- A migração `database/migrations/001_integracao_frontend.sql` serve para quem já tem o esquema antigo do backend. Em uma instalação nova, importe somente `database/urbs.sql`.
- O login depende de cookies de sessão e funciona sob o mesmo host no XAMPP.
- A experiência 3D usa imagens e bibliotecas servidas por provedores externos; o restante do aplicativo requer PHP e MySQL locais.
- Este projeto é demonstrativo. Não publique dados pessoais ou reais sem revisar hospedagem, privacidade e segurança.
