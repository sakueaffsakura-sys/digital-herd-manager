-- Esquema do Pecuária Digital em MySQL/MariaDB.
-- Gerado a partir do banco PostgreSQL atual por gerar.py. Não edite à mão.
--
-- Datas e horas são gravadas SEMPRE em UTC. Quem converte para o horário de Brasília
-- é o servidor da aplicação; o MySQL não guarda fuso junto com a hora.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE `usuarios` (
  `id` CHAR(36) NOT NULL,
  `email` VARCHAR(180) NOT NULL,
  `senha_hash` VARCHAR(255) NULL,
  `email_confirmado_em` DATETIME(3) NULL,
  `bloqueado` TINYINT(1) NOT NULL DEFAULT 0,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ultimo_acesso` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `usuarios_email_uq` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `identidades` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `provedor` VARCHAR(40) NOT NULL,
  `provedor_id` VARCHAR(180) NOT NULL,
  `email` VARCHAR(180) NULL,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `identidades_provedor_uq` (`provedor`,`provedor_id`),
  KEY `identidades_user_id_idx` (`user_id`),
  CONSTRAINT `identidades_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `sessoes` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `criada_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ultimo_uso` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expira_em` DATETIME(3) NOT NULL,
  `navegador` VARCHAR(512) NULL,
  `ip` VARCHAR(64) NULL,
  `aal` VARCHAR(10) NOT NULL DEFAULT 'aal1',
  PRIMARY KEY (`id`),
  UNIQUE KEY `sessoes_token_uq` (`token_hash`),
  KEY `sessoes_user_id_idx` (`user_id`),
  KEY `sessoes_expira_idx` (`expira_em`),
  CONSTRAINT `sessoes_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `recuperacoes_senha` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `token_hash` CHAR(64) NOT NULL,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expira_em` DATETIME(3) NOT NULL,
  `usado_em` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `recuperacoes_token_uq` (`token_hash`),
  KEY `recuperacoes_user_id_idx` (`user_id`),
  CONSTRAINT `recuperacoes_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `fatores_2fa` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `tipo` VARCHAR(20) NOT NULL DEFAULT 'totp',
  `segredo_cifrado` TEXT NOT NULL,
  `confirmado_em` DATETIME(3) NULL,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `fatores_user_id_idx` (`user_id`),
  CONSTRAINT `fatores_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `chaves_sistema` (
  `nome` VARCHAR(60) NOT NULL,
  `valor_cifrado` VARCHAR(255) NOT NULL,
  `final` VARCHAR(255) NOT NULL,
  `alterado_por` CHAR(36) NULL,
  `alterado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`nome`),
  CONSTRAINT `chaves_sistema_nome_check` CHECK (nome IN ('MERCADOPAGO_ACCESS_TOKEN','MERCADOPAGO_WEBHOOK_SECRET','CHAVE_RESGATE'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `configuracoes_sistema` (
  `chave` VARCHAR(120) NOT NULL,
  `valor` MEDIUMTEXT NULL,
  `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `atualizado_por` CHAR(36) NULL,
  PRIMARY KEY (`chave`),
  CONSTRAINT `valor_tamanho` CHECK (valor IS NULL OR CHAR_LENGTH(valor) <= 800000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ebooks` (
  `id` CHAR(36) NOT NULL,
  `titulo` TEXT NOT NULL,
  `autor` VARCHAR(255) NULL,
  `descricao` VARCHAR(2000) NULL,
  `categoria` VARCHAR(255) NULL,
  `paginas` INT NULL,
  `capa_path` VARCHAR(255) NULL,
  `arquivo_path` VARCHAR(255) NULL,
  `tamanho_bytes` BIGINT NULL,
  `sha256` VARCHAR(255) NULL,
  `publicado` TINYINT(1) NOT NULL DEFAULT 0,
  `publicado_em` DATETIME(3) NULL,
  `criado_por` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `ebooks_autor_check` CHECK (autor IS NULL OR CHAR_LENGTH(autor) <= 120),
  CONSTRAINT `ebooks_categoria_check` CHECK (categoria IS NULL OR CHAR_LENGTH(categoria) <= 60),
  CONSTRAINT `ebooks_descricao_check` CHECK (descricao IS NULL OR CHAR_LENGTH(descricao) <= 2000),
  CONSTRAINT `ebooks_paginas_check` CHECK (paginas IS NULL OR (paginas >= 1 AND paginas <= 5000)),
  CONSTRAINT `ebooks_sha256_check` CHECK (sha256 IS NULL OR sha256 REGEXP '^[0-9a-f]{64}$'),
  CONSTRAINT `ebooks_titulo_check` CHECK (CHAR_LENGTH(titulo) >= 2 AND CHAR_LENGTH(titulo) <= 160)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `eventos_seguranca` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `tipo` VARCHAR(255) NOT NULL,
  `severidade` VARCHAR(255) NOT NULL DEFAULT 'aviso',
  `ip` VARCHAR(255) NULL,
  `caminho` VARCHAR(255) NULL,
  `quantidade` INT NOT NULL DEFAULT 1,
  `detalhe` TEXT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `eventos_seguranca_severidade_check` CHECK (severidade IN ('info','aviso','critico'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `imagens_site` (
  `chave` VARCHAR(60) NOT NULL,
  `valor` LONGTEXT NOT NULL,
  `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `atualizado_por` CHAR(36) NULL,
  PRIMARY KEY (`chave`),
  CONSTRAINT `imagens_site_chave_check` CHECK (chave IN ('fundo_login','banner_inicio','fundo_menu')),
  CONSTRAINT `imagens_site_valor_check` CHECK (CHAR_LENGTH(valor) <= 1500000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `incidentes_seguranca` (
  `id` CHAR(36) NOT NULL,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `tipo` VARCHAR(255) NOT NULL,
  `severidade` VARCHAR(255) NOT NULL DEFAULT 'aviso',
  `ip` VARCHAR(255) NULL,
  `dispositivo` VARCHAR(255) NULL,
  `user_id` CHAR(36) NULL,
  `caminho` VARCHAR(255) NULL,
  `metodo` VARCHAR(255) NULL,
  `agente` TEXT NULL,
  `motivo` TEXT NOT NULL,
  `detalhes` JSON NOT NULL DEFAULT '{}',
  `bloqueou` TINYINT(1) NOT NULL DEFAULT 0,
  `repeticoes` INT NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `manutencao_config` (
  `id` SMALLINT NOT NULL DEFAULT 1,
  `status` VARCHAR(255) NOT NULL DEFAULT 'ativo',
  `titulo` TEXT NOT NULL DEFAULT 'Estamos em manutenção',
  `mensagem` TEXT NOT NULL DEFAULT 'O sistema está passando por melhorias para atender você ainda melhor. Voltamos em breve.',
  `modulos` JSON NOT NULL DEFAULT (JSON_ARRAY()),
  `duracao_bloqueio_min` INT NOT NULL DEFAULT 1440,
  `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `atualizado_por` CHAR(36) NULL,
  `termina_em` DATETIME(3) NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `manutencao_config_duracao_check` CHECK (duracao_bloqueio_min >= 0 AND duracao_bloqueio_min <= 525600),
  CONSTRAINT `manutencao_config_id_check` CHECK (id = 1),
  CONSTRAINT `manutencao_config_status_check` CHECK (status IN ('ativo','manutencao','bloqueado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `manutencao_historico` (
  `id` CHAR(36) NOT NULL,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `user_id` CHAR(36) NULL,
  `email` VARCHAR(255) NULL,
  `status_anterior` VARCHAR(255) NULL,
  `status_novo` VARCHAR(255) NOT NULL,
  `detalhes` JSON NOT NULL DEFAULT '{}',
  `ip` VARCHAR(255) NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `planos` (
  `id` CHAR(36) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `descricao` VARCHAR(500) NULL,
  `meses` INT NOT NULL,
  `preco_centavos` INT NOT NULL DEFAULT 0,
  `ativo` TINYINT(1) NOT NULL DEFAULT 0,
  `ordem` INT NOT NULL DEFAULT 0,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `planos_descricao_check` CHECK (descricao IS NULL OR CHAR_LENGTH(descricao) <= 500),
  CONSTRAINT `planos_meses_check` CHECK (meses >= 1 AND meses <= 36),
  CONSTRAINT `planos_nome_check` CHECK (CHAR_LENGTH(nome) >= 2 AND CHAR_LENGTH(nome) <= 60),
  CONSTRAINT `planos_preco_centavos_check` CHECK (preco_centavos >= 0 AND preco_centavos <= 10000000)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `presenca_usuarios` (
  `user_id` CHAR(36) NOT NULL,
  `visto_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `pagina` VARCHAR(255) NULL,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `profiles` (
  `id` CHAR(36) NOT NULL,
  `nome_completo` VARCHAR(255) NOT NULL DEFAULT '',
  `telefone` VARCHAR(255) NULL,
  `avatar_url` TEXT NULL,
  `preferencias` JSON NOT NULL DEFAULT '{}',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `nome_exibicao` VARCHAR(255) NULL,
  `cargo` VARCHAR(255) NULL,
  `biografia` TEXT NULL,
  `bloqueado` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `propriedades` (
  `id` CHAR(36) NOT NULL,
  `proprietario_id` CHAR(36) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `cidade` VARCHAR(255) NULL,
  `estado` VARCHAR(255) NULL,
  `periodo_gestacao_dias` INT NOT NULL DEFAULT 283,
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  CONSTRAINT `propriedades_nome_check` CHECK (CHAR_LENGTH(nome) >= 2 AND CHAR_LENGTH(nome) <= 120),
  CONSTRAINT `propriedades_gestacao_check` CHECK (periodo_gestacao_dias >= 260 AND periodo_gestacao_dias <= 300)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `qualidade_leite` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `data` DATE NOT NULL,
  `ccs` INT NULL,
  `cpp` INT NULL,
  `gordura` DECIMAL(18,6) NULL,
  `proteina` DECIMAL(18,6) NULL,
  `temperatura` DECIMAL(18,6) NULL,
  `laboratorio` VARCHAR(255) NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `qualidade_leite_propriedade_id_idx` (`propriedade_id`),
  KEY `qualidade_leite_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `ccs_valido` CHECK (ccs IS NULL OR ccs >= 0),
  CONSTRAINT `cpp_valido` CHECK (cpp IS NULL OR cpp >= 0),
  CONSTRAINT `gordura_valido` CHECK (gordura IS NULL OR (gordura >= 0 AND gordura <= 100)),
  CONSTRAINT `proteina_valido` CHECK (proteina IS NULL OR (proteina >= 0 AND proteina <= 100)),
  CONSTRAINT `temperatura_valido` CHECK (temperatura IS NULL OR (temperatura >= -10 AND temperatura <= 60))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `rate_limits` (
  `chave` VARCHAR(180) NOT NULL,
  `janela` DATETIME(3) NOT NULL,
  `contador` INT NOT NULL DEFAULT 0,
  `termina_em` DATETIME(3) NULL,
  PRIMARY KEY (`chave`,`janela`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `registros_excluidos` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `propriedade_id` CHAR(36) NOT NULL,
  `tabela` VARCHAR(255) NOT NULL,
  `registro_id` CHAR(36) NOT NULL,
  `excluido_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `solicitacoes_exclusao` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NULL,
  `motivo` VARCHAR(1000) NULL,
  `status` VARCHAR(255) NOT NULL DEFAULT 'pendente',
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `prazo` DATE NOT NULL,
  `concluida_em` DATETIME(3) NULL,
  `atendida_por` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `solicitacoes_exclusao_motivo_check` CHECK (motivo IS NULL OR CHAR_LENGTH(motivo) <= 1000),
  CONSTRAINT `solicitacoes_exclusao_status_check` CHECK (status IN ('pendente','concluida','cancelada'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `suporte_contatos` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `email` VARCHAR(255) NULL,
  `assunto` VARCHAR(255) NOT NULL,
  `mensagem` VARCHAR(4000) NOT NULL,
  `propriedade_id` CHAR(36) NULL,
  `status` VARCHAR(255) NOT NULL DEFAULT 'aberto',
  `resposta` TEXT NULL,
  `respondido_por` CHAR(36) NULL,
  `respondido_em` DATETIME(3) NULL,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `suporte_contatos_propriedade_id_idx` (`propriedade_id`),
  CONSTRAINT `suporte_contatos_assunto_check` CHECK (CHAR_LENGTH(assunto) >= 2 AND CHAR_LENGTH(assunto) <= 120),
  CONSTRAINT `suporte_contatos_mensagem_check` CHECK (CHAR_LENGTH(mensagem) >= 10 AND CHAR_LENGTH(mensagem) <= 4000),
  CONSTRAINT `suporte_contatos_status_check` CHECK (status IN ('aberto','respondido','fechado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `suporte_mensagens` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `mensagem_id` VARCHAR(120) NOT NULL,
  `papel` VARCHAR(255) NOT NULL,
  `partes` JSON NOT NULL DEFAULT '[]',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `suporte_mensagens_user_id_mensagem_id_uq` (`user_id`,`mensagem_id`),
  CONSTRAINT `suporte_mensagens_papel_check` CHECK (papel IN ('user','assistant'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `talhoes` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `area_ha` DECIMAL(18,6) NOT NULL,
  `solo` VARCHAR(255) NULL,
  `situacao` VARCHAR(255) NULL DEFAULT 'Livre',
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `talhoes_propriedade_id_idx` (`propriedade_id`),
  CONSTRAINT `area_ha_valido` CHECK (area_ha IS NULL OR area_ha >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tipos_vacinas` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `nome` VARCHAR(120) NOT NULL,
  `intervalo_dias` INT NULL,
  `descricao` TEXT NULL,
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `tipos_vacinas_propriedade_id_nome_uq` (`propriedade_id`,`nome`),
  CONSTRAINT `tipos_vacinas_intervalo_dias_check` CHECK (intervalo_dias IS NULL OR intervalo_dias > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `user_roles` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `role` ENUM('proprietario','administrador','colaborador','visualizador') NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_roles_user_id_role_uq` (`user_id`,`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `yui_uso` (
  `user_id` CHAR(36) NOT NULL,
  `dia` DATE NOT NULL,
  `mensagens` INT NOT NULL DEFAULT 0,
  `falas` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`user_id`,`dia`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `assinaturas` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `plano` ENUM('gratuito','premium') NOT NULL DEFAULT 'gratuito',
  `status` ENUM('ativo','trial','cancelado','expirado','pendente') NOT NULL DEFAULT 'pendente',
  `origem` VARCHAR(255) NOT NULL DEFAULT 'demonstracao',
  `data_inicio` DATETIME(3) NULL,
  `data_expiracao` DATETIME(3) NULL,
  `stripe_customer_id` VARCHAR(255) NULL,
  `stripe_subscription_id` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `assinaturas_propriedade_id_idx` (`propriedade_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bloqueios_acesso` (
  `id` CHAR(36) NOT NULL,
  `tipo` VARCHAR(255) NOT NULL,
  `valor` VARCHAR(255) NOT NULL,
  `motivo` TEXT NOT NULL,
  `incidente_id` CHAR(36) NULL,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `expira_em` DATETIME(3) NULL,
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `tentativas` INT NOT NULL DEFAULT 0,
  `ultima_tentativa` DATETIME(3) NULL,
  `removido_em` DATETIME(3) NULL,
  `removido_por` CHAR(36) NULL,
  PRIMARY KEY (`id`),
  KEY `bloqueios_acesso_incidente_id_idx` (`incidente_id`),
  CONSTRAINT `bloqueios_acesso_tipo_check` CHECK (tipo IN ('ip','dispositivo','usuario'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `campanhas` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `tipo` VARCHAR(255) NULL DEFAULT 'Vacinação',
  `inicio` DATE NOT NULL,
  `fim` DATE NULL,
  `produto` VARCHAR(255) NULL,
  `lotes` TEXT NULL,
  `status` VARCHAR(255) NOT NULL DEFAULT 'Planejada',
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `campanhas_propriedade_id_idx` (`propriedade_id`),
  KEY `campanhas_prop_data_idx` (`propriedade_id`,`inicio` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `clientes` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `telefone` VARCHAR(255) NULL,
  `cidade` VARCHAR(255) NULL,
  `ativo` TINYINT(1) NULL DEFAULT 1,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `clientes_propriedade_id_idx` (`propriedade_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `clima_obs` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `data` DATE NOT NULL,
  `chuva_mm` DECIMAL(18,6) NULL,
  `temp_min` DECIMAL(18,6) NULL,
  `temp_max` DECIMAL(18,6) NULL,
  `evento` VARCHAR(255) NULL DEFAULT 'Nenhum',
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `clima_obs_propriedade_id_idx` (`propriedade_id`),
  KEY `clima_obs_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `chuva_mm_valido` CHECK (chuva_mm IS NULL OR chuva_mm >= 0),
  CONSTRAINT `temp_max_valido` CHECK (temp_max IS NULL OR (temp_max >= -20 AND temp_max <= 60)),
  CONSTRAINT `temp_min_valido` CHECK (temp_min IS NULL OR (temp_min >= -20 AND temp_min <= 60))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `configuracoes` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `chave` VARCHAR(120) NOT NULL,
  `valor` JSON NOT NULL DEFAULT '{}',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `configuracoes_propriedade_id_chave_uq` (`propriedade_id`,`chave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cotacoes` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `produto` VARCHAR(255) NOT NULL,
  `produto_outro` VARCHAR(255) NULL,
  `data` DATE NOT NULL,
  `preco` DECIMAL(14,2) NOT NULL,
  `praca` VARCHAR(255) NULL,
  `fonte` VARCHAR(255) NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `cotacoes_propriedade_id_idx` (`propriedade_id`),
  KEY `cotacoes_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `preco_valido` CHECK (preco IS NULL OR preco >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ebook_acessos` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `ebook_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ip_mascarado` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  KEY `ebook_acessos_ebook_id_idx` (`ebook_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `fornecedores` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `categoria` VARCHAR(255) NOT NULL,
  `contato` VARCHAR(255) NULL,
  `telefone` VARCHAR(255) NULL,
  `email` VARCHAR(255) NULL,
  `cidade` VARCHAR(255) NULL,
  `condicoes` VARCHAR(255) NULL,
  `ativo` TINYINT(1) NULL DEFAULT 1,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `fornecedores_propriedade_id_idx` (`propriedade_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `funcionarios` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `funcao` VARCHAR(255) NOT NULL,
  `setor` VARCHAR(255) NULL,
  `telefone` VARCHAR(255) NULL,
  `admissao` DATE NULL,
  `situacao` VARCHAR(255) NOT NULL DEFAULT 'Ativo',
  `salario` DECIMAL(14,2) NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `funcionarios_propriedade_id_idx` (`propriedade_id`),
  CONSTRAINT `salario_valido` CHECK (salario IS NULL OR salario >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `horas_trabalho` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `funcionario_id` CHAR(36) NOT NULL,
  `data` DATE NOT NULL,
  `tipo` VARCHAR(255) NOT NULL DEFAULT 'Dia normal',
  `horas` DECIMAL(18,6) NULL DEFAULT 8,
  `atividade` VARCHAR(255) NULL,
  `valor` DECIMAL(14,2) NULL,
  `pago` TINYINT(1) NULL DEFAULT 0,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `horas_trabalho_funcionario_id_idx` (`funcionario_id`),
  KEY `horas_trabalho_propriedade_id_idx` (`propriedade_id`),
  KEY `horas_trabalho_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `horas_valido` CHECK (horas IS NULL OR (horas >= 0 AND horas <= 24)),
  CONSTRAINT `valor_valido` CHECK (valor IS NULL OR valor >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `importacoes` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `tabela` VARCHAR(60) NOT NULL,
  `arquivo` VARCHAR(255) NOT NULL,
  `total_linhas` INT NOT NULL DEFAULT 0,
  `processadas` INT NOT NULL DEFAULT 0,
  `aceitas` INT NOT NULL DEFAULT 0,
  `rejeitadas` INT NOT NULL DEFAULT 0,
  `status` VARCHAR(255) NOT NULL DEFAULT 'em_andamento',
  `rejeitadas_detalhe` JSON NOT NULL DEFAULT '[]',
  `erro` TEXT NULL,
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `importacoes_propriedade_id_tabela_arquivo_uq` (`propriedade_id`,`tabela`,`arquivo`),
  CONSTRAINT `importacoes_status_check` CHECK (status IN ('em_andamento','concluida','erro','cancelada'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `instalacoes` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `tipo` VARCHAR(255) NOT NULL,
  `capacidade` TEXT NULL,
  `ativo` TINYINT(1) NULL DEFAULT 1,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `instalacoes_propriedade_id_idx` (`propriedade_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `irrig_sistemas` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `tipo` VARCHAR(255) NOT NULL,
  `fonte` VARCHAR(255) NULL,
  `capacidade` DECIMAL(18,6) NULL,
  `area_ha` DECIMAL(18,6) NULL,
  `situacao` VARCHAR(255) NULL DEFAULT 'Funcionando',
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `irrig_sistemas_propriedade_id_idx` (`propriedade_id`),
  CONSTRAINT `area_ha_valido` CHECK (area_ha IS NULL OR area_ha >= 0),
  CONSTRAINT `capacidade_valido` CHECK (capacidade IS NULL OR capacidade >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `irrigacoes` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `sistema_id` CHAR(36) NOT NULL,
  `data` DATE NOT NULL,
  `talhao_id` CHAR(36) NULL,
  `horas` DECIMAL(18,6) NULL,
  `volume` DECIMAL(18,6) NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `irrigacoes_propriedade_id_idx` (`propriedade_id`),
  KEY `irrigacoes_sistema_id_idx` (`sistema_id`),
  KEY `irrigacoes_talhao_id_idx` (`talhao_id`),
  KEY `irrigacoes_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `horas_valido` CHECK (horas IS NULL OR horas >= 0),
  CONSTRAINT `volume_valido` CHECK (volume IS NULL OR volume >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lotes` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `nome` VARCHAR(120) NOT NULL,
  `descricao` TEXT NULL,
  `finalidade` VARCHAR(255) NULL,
  `ativo` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `lotes_propriedade_id_nome_uq` (`propriedade_id`,`nome`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `maquinas` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `tipo` VARCHAR(255) NOT NULL,
  `marca` VARCHAR(255) NULL,
  `modelo` VARCHAR(255) NULL,
  `serie` VARCHAR(255) NULL,
  `ano` INT NULL,
  `aquisicao_data` DATE NULL,
  `aquisicao_valor` DECIMAL(14,2) NULL,
  `horimetro` DECIMAL(18,6) NULL,
  `km` DECIMAL(18,6) NULL,
  `intervalo_revisao` DECIMAL(18,6) NULL,
  `situacao` VARCHAR(255) NOT NULL DEFAULT 'Ativa',
  `operadores` TEXT NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `maquinas_propriedade_id_idx` (`propriedade_id`),
  CONSTRAINT `ano_valido` CHECK (ano IS NULL OR (ano >= 1900 AND ano <= 2100)),
  CONSTRAINT `aquisicao_valor_valido` CHECK (aquisicao_valor IS NULL OR aquisicao_valor >= 0),
  CONSTRAINT `horimetro_valido` CHECK (horimetro IS NULL OR horimetro >= 0),
  CONSTRAINT `intervalo_revisao_valido` CHECK (intervalo_revisao IS NULL OR intervalo_revisao >= 0),
  CONSTRAINT `km_valido` CHECK (km IS NULL OR km >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `movimentacoes_financeiras` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `tipo` ENUM('receita','despesa','investimento') NOT NULL,
  `categoria` VARCHAR(255) NOT NULL,
  `descricao` TEXT NOT NULL,
  `valor` DECIMAL(14,2) NOT NULL,
  `data` DATE NOT NULL,
  `origem_tipo` ENUM('compra','venda') NULL,
  `origem_id` CHAR(36) NULL,
  `observacao` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `movimentacoes_financeiras_propriedade_id_idx` (`propriedade_id`),
  KEY `movimentacoes_financeiras_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `movimentacoes_financeiras_valor_check` CHECK (valor >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `notificacoes` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NULL,
  `titulo` TEXT NOT NULL,
  `mensagem` TEXT NOT NULL,
  `lida` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `chave` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  KEY `notificacoes_propriedade_id_idx` (`propriedade_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ocorrencias` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `data` DATE NOT NULL,
  `titulo` TEXT NOT NULL,
  `gravidade` VARCHAR(255) NULL DEFAULT 'Baixa',
  `status` VARCHAR(255) NOT NULL DEFAULT 'Aberta',
  `setor` VARCHAR(255) NULL,
  `responsavel_id` CHAR(36) NULL,
  `descricao` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ocorrencias_propriedade_id_idx` (`propriedade_id`),
  KEY `ocorrencias_responsavel_id_idx` (`responsavel_id`),
  KEY `ocorrencias_prop_data_idx` (`propriedade_id`,`data` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pagamentos` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `plano_id` CHAR(36) NULL,
  `plano_nome` VARCHAR(255) NOT NULL,
  `meses` INT NOT NULL,
  `valor_centavos` INT NOT NULL,
  `moeda` VARCHAR(255) NOT NULL DEFAULT 'BRL',
  `status` VARCHAR(255) NOT NULL DEFAULT 'pendente',
  `metodo` VARCHAR(255) NULL,
  `mp_preference_id` VARCHAR(255) NULL,
  `mp_payment_id` VARCHAR(60) NULL,
  `detalhes` JSON NOT NULL DEFAULT '{}',
  `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `aprovado_em` DATETIME(3) NULL,
  `estornado_em` DATETIME(3) NULL,
  `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `pagamentos_mp_payment_id_uq` (`mp_payment_id`),
  KEY `pagamentos_plano_id_idx` (`plano_id`),
  KEY `pagamentos_propriedade_id_idx` (`propriedade_id`),
  CONSTRAINT `pagamentos_meses_check` CHECK (meses >= 1 AND meses <= 36),
  CONSTRAINT `pagamentos_status_check` CHECK (status IN ('pendente','em_analise','aprovado','recusado','cancelado','estornado')),
  CONSTRAINT `pagamentos_valor_centavos_check` CHECK (valor_centavos > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pastos` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `area_ha` DECIMAL(18,6) NOT NULL,
  `forrageira` VARCHAR(255) NULL,
  `capacidade` INT NULL,
  `situacao` VARCHAR(255) NOT NULL DEFAULT 'Disponível',
  `ultima_adubacao` DATE NULL,
  `ultima_reforma` DATE NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `pastos_propriedade_id_idx` (`propriedade_id`),
  CONSTRAINT `area_ha_valido` CHECK (area_ha IS NULL OR area_ha >= 0),
  CONSTRAINT `capacidade_valido` CHECK (capacidade IS NULL OR capacidade >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `plano_auditoria` (
  `id` CHAR(36) NOT NULL,
  `assinatura_id` CHAR(36) NULL,
  `user_id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NULL,
  `alterado_por` CHAR(36) NOT NULL,
  `plano_anterior` ENUM('gratuito','premium') NULL,
  `plano_novo` ENUM('gratuito','premium') NULL,
  `status_anterior` ENUM('ativo','trial','cancelado','expirado','pendente') NULL,
  `status_novo` ENUM('ativo','trial','cancelado','expirado','pendente') NULL,
  `motivo` TEXT NULL,
  `origem` VARCHAR(255) NOT NULL DEFAULT 'demonstracao',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `plano_auditoria_assinatura_id_idx` (`assinatura_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `plantios` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `talhao_id` CHAR(36) NOT NULL,
  `cultura` VARCHAR(255) NOT NULL,
  `variedade` VARCHAR(255) NULL,
  `safra` VARCHAR(255) NOT NULL,
  `area_ha` DECIMAL(18,6) NULL,
  `plantio_data` DATE NULL,
  `colheita_prevista` DATE NULL,
  `status` VARCHAR(255) NOT NULL DEFAULT 'Planejado',
  `producao_esperada` DECIMAL(18,6) NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `plantios_propriedade_id_idx` (`propriedade_id`),
  KEY `plantios_talhao_id_idx` (`talhao_id`),
  CONSTRAINT `area_ha_valido` CHECK (area_ha IS NULL OR area_ha >= 0),
  CONSTRAINT `producao_esperada_valido` CHECK (producao_esperada IS NULL OR producao_esperada >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `propriedade_membros` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `role` ENUM('proprietario','administrador','colaborador','visualizador') NOT NULL DEFAULT 'colaborador',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `propriedade_membros_propriedade_id_user_id_uq` (`propriedade_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `propriedade_perfil` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `descricao` TEXT NULL,
  `telefone` VARCHAR(255) NULL,
  `email` VARCHAR(255) NULL,
  `endereco` TEXT NULL,
  `website` TEXT NULL,
  `logo_url` TEXT NULL,
  `banner_url` TEXT NULL,
  `imagem_url` TEXT NULL,
  `texto_apresentacao` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `propriedade_perfil_propriedade_id_uq` (`propriedade_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `animais` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `lote_id` CHAR(36) NULL,
  `numero_brinco` VARCHAR(60) NOT NULL,
  `nome` VARCHAR(255) NULL,
  `sexo` ENUM('M','F') NOT NULL,
  `raca` VARCHAR(255) NULL,
  `data_nascimento` DATE NULL,
  `mae_id` CHAR(36) NULL,
  `pai_id` CHAR(36) NULL,
  `situacao` ENUM('ativo','vendido','perdido','falecido','transferido') NOT NULL DEFAULT 'ativo',
  `observacoes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `animais_propriedade_id_numero_brinco_uq` (`propriedade_id`,`numero_brinco`),
  KEY `animais_lote_id_idx` (`lote_id`),
  KEY `animais_mae_id_idx` (`mae_id`),
  KEY `animais_pai_id_idx` (`pai_id`),
  CONSTRAINT `animais_mae_dif` CHECK (mae_id IS NULL OR mae_id <> id),
  CONSTRAINT `animais_pai_dif` CHECK (pai_id IS NULL OR pai_id <> id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `animal_extra` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `animal_id` CHAR(36) NOT NULL,
  `pelagem` VARCHAR(255) NULL,
  `finalidade` VARCHAR(255) NULL,
  `origem` VARCHAR(255) NULL,
  `procedencia` VARCHAR(255) NULL,
  `identificacao` VARCHAR(255) NULL,
  `pasto_id` CHAR(36) NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `animal_extra_animal_id_idx` (`animal_id`),
  KEY `animal_extra_pasto_id_idx` (`pasto_id`),
  KEY `animal_extra_propriedade_id_idx` (`propriedade_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `anotacoes_producao` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `animal_id` CHAR(36) NULL,
  `lote_id` CHAR(36) NULL,
  `data` DATE NOT NULL,
  `producao` DECIMAL(10,2) NULL,
  `observacao` TEXT NOT NULL,
  `comportamento` VARCHAR(255) NULL,
  `alimentacao` VARCHAR(255) NULL,
  `informacoes_adicionais` VARCHAR(255) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `marcada` TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `anotacoes_producao_animal_id_idx` (`animal_id`),
  KEY `anotacoes_producao_lote_id_idx` (`lote_id`),
  KEY `anotacoes_producao_propriedade_id_idx` (`propriedade_id`),
  KEY `anotacoes_producao_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `anotacoes_producao_producao_check` CHECK (producao IS NULL OR producao >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `avaliacoes` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `tipo` VARCHAR(255) NOT NULL DEFAULT 'Escore corporal (1 a 5)',
  `data` DATE NOT NULL,
  `valor` DECIMAL(18,6) NOT NULL,
  `animal_id` CHAR(36) NULL,
  `lote_id` CHAR(36) NULL,
  `pasto_id` CHAR(36) NULL,
  `responsavel` VARCHAR(255) NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `avaliacoes_animal_id_idx` (`animal_id`),
  KEY `avaliacoes_lote_id_idx` (`lote_id`),
  KEY `avaliacoes_pasto_id_idx` (`pasto_id`),
  KEY `avaliacoes_propriedade_id_idx` (`propriedade_id`),
  KEY `avaliacoes_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `valor_valido` CHECK (valor IS NULL OR valor >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `bezerros_info` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `animal_id` CHAR(36) NOT NULL,
  `colostro` VARCHAR(255) NOT NULL DEFAULT 'Não sei',
  `parto` VARCHAR(255) NULL DEFAULT 'Normal',
  `peso_nascer` DECIMAL(18,6) NULL,
  `orfao` TINYINT(1) NULL DEFAULT 0,
  `desmame_previsto` DATE NULL,
  `desmamado_em` DATE NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `bezerros_info_animal_id_idx` (`animal_id`),
  KEY `bezerros_info_propriedade_id_idx` (`propriedade_id`),
  CONSTRAINT `peso_nascer_valido` CHECK (peso_nascer IS NULL OR peso_nascer >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `cios` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `animal_id` CHAR(36) NOT NULL,
  `data` DATE NOT NULL,
  `sinais` TEXT NULL,
  `acao` VARCHAR(255) NULL DEFAULT 'Observar',
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `cios_animal_id_idx` (`animal_id`),
  KEY `cios_propriedade_id_idx` (`propriedade_id`),
  KEY `cios_prop_data_idx` (`propriedade_id`,`data` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `compras` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `data` DATE NOT NULL,
  `produto_animal` VARCHAR(255) NOT NULL,
  `quantidade` DECIMAL(12,2) NOT NULL,
  `valor` DECIMAL(14,2) NOT NULL,
  `fornecedor` VARCHAR(255) NULL,
  `categoria` VARCHAR(255) NOT NULL,
  `observacao` TEXT NULL,
  `movimentacao_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `compras_movimentacao_id_uq` (`movimentacao_id`),
  KEY `compras_propriedade_id_idx` (`propriedade_id`),
  KEY `compras_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `compras_quantidade_check` CHECK (quantidade > 0),
  CONSTRAINT `compras_valor_check` CHECK (valor >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `contas` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `tipo` VARCHAR(255) NOT NULL DEFAULT 'A pagar',
  `descricao` TEXT NOT NULL,
  `valor` DECIMAL(14,2) NOT NULL,
  `vencimento` DATE NOT NULL,
  `status` VARCHAR(255) NOT NULL DEFAULT 'Aberta',
  `categoria` VARCHAR(255) NULL,
  `fornecedor_id` CHAR(36) NULL,
  `parte` VARCHAR(255) NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `contas_fornecedor_id_idx` (`fornecedor_id`),
  KEY `contas_propriedade_id_idx` (`propriedade_id`),
  KEY `contas_prop_data_idx` (`propriedade_id`,`vencimento` DESC),
  CONSTRAINT `valor_valido` CHECK (valor IS NULL OR valor >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `documentos` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `categoria` VARCHAR(255) NOT NULL,
  `numero` VARCHAR(255) NULL,
  `emissao` DATE NULL,
  `vencimento` DATE NULL,
  `animal_id` CHAR(36) NULL,
  `vinculo` VARCHAR(255) NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `documentos_animal_id_idx` (`animal_id`),
  KEY `documentos_propriedade_id_idx` (`propriedade_id`),
  KEY `documentos_prop_data_idx` (`propriedade_id`,`emissao` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `engorda` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `lote_id` CHAR(36) NOT NULL,
  `data_entrada` DATE NOT NULL,
  `peso_alvo` DECIMAL(18,6) NULL,
  `saida_prevista` DATE NULL,
  `custo_aquisicao` DECIMAL(14,2) NULL,
  `preco_arroba` DECIMAL(14,2) NULL,
  `rendimento` DECIMAL(18,6) NULL DEFAULT 52,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `engorda_lote_id_idx` (`lote_id`),
  KEY `engorda_propriedade_id_idx` (`propriedade_id`),
  KEY `engorda_prop_data_idx` (`propriedade_id`,`data_entrada` DESC),
  CONSTRAINT `custo_aquisicao_valido` CHECK (custo_aquisicao IS NULL OR custo_aquisicao >= 0),
  CONSTRAINT `peso_alvo_valido` CHECK (peso_alvo IS NULL OR peso_alvo >= 0),
  CONSTRAINT `preco_arroba_valido` CHECK (preco_arroba IS NULL OR preco_arroba >= 0),
  CONSTRAINT `rendimento_valido` CHECK (rendimento IS NULL OR (rendimento >= 0 AND rendimento <= 100))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `estoque_itens` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `categoria` VARCHAR(255) NOT NULL,
  `unidade` VARCHAR(255) NOT NULL DEFAULT 'un',
  `minimo` DECIMAL(18,6) NULL,
  `preco_ref` DECIMAL(14,2) NULL,
  `fornecedor_id` CHAR(36) NULL,
  `fabricante` VARCHAR(255) NULL,
  `conservacao` TEXT NULL,
  `controla_validade` TINYINT(1) NULL DEFAULT 0,
  `ativo` TINYINT(1) NULL DEFAULT 1,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `estoque_itens_fornecedor_id_idx` (`fornecedor_id`),
  KEY `estoque_itens_propriedade_id_idx` (`propriedade_id`),
  CONSTRAINT `minimo_valido` CHECK (minimo IS NULL OR minimo >= 0),
  CONSTRAINT `preco_ref_valido` CHECK (preco_ref IS NULL OR preco_ref >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `estoque_mov` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `item_id` CHAR(36) NOT NULL,
  `tipo` VARCHAR(255) NOT NULL DEFAULT 'Entrada (compra)',
  `data` DATE NOT NULL,
  `qtd` DECIMAL(18,6) NOT NULL,
  `valor_total` DECIMAL(14,2) NULL,
  `lote_produto` VARCHAR(255) NULL,
  `fabricacao` DATE NULL,
  `validade` DATE NULL,
  `fornecedor_id` CHAR(36) NULL,
  `motivo` TEXT NULL,
  `animal_id` CHAR(36) NULL,
  `lote_id` CHAR(36) NULL,
  `plantio_id` CHAR(36) NULL,
  `maquina_id` CHAR(36) NULL,
  `responsavel` VARCHAR(255) NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `estoque_mov_animal_id_idx` (`animal_id`),
  KEY `estoque_mov_fornecedor_id_idx` (`fornecedor_id`),
  KEY `estoque_mov_item_id_idx` (`item_id`),
  KEY `estoque_mov_lote_id_idx` (`lote_id`),
  KEY `estoque_mov_maquina_id_idx` (`maquina_id`),
  KEY `estoque_mov_plantio_id_idx` (`plantio_id`),
  KEY `estoque_mov_propriedade_id_idx` (`propriedade_id`),
  KEY `estoque_mov_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `valor_total_valido` CHECK (valor_total IS NULL OR valor_total >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `gta` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `numero` VARCHAR(255) NOT NULL,
  `emissao` DATE NOT NULL,
  `validade` DATE NOT NULL,
  `finalidade` VARCHAR(255) NOT NULL,
  `qtd` INT NOT NULL,
  `especie` VARCHAR(255) NULL DEFAULT 'Bovino',
  `lote_id` CHAR(36) NULL,
  `origem` VARCHAR(255) NULL,
  `destino` VARCHAR(255) NOT NULL,
  `situacao` VARCHAR(255) NOT NULL DEFAULT 'Emitida',
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `gta_lote_id_idx` (`lote_id`),
  KEY `gta_propriedade_id_idx` (`propriedade_id`),
  KEY `gta_prop_data_idx` (`propriedade_id`,`emissao` DESC),
  CONSTRAINT `qtd_valido` CHECK (qtd IS NULL OR qtd >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `inseminacoes` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `animal_id` CHAR(36) NOT NULL,
  `data_inseminacao` DATE NOT NULL,
  `reprodutor_semen` VARCHAR(255) NOT NULL,
  `previsao_parto` DATE NOT NULL,
  `situacao` ENUM('em_andamento','confirmada','falhou','parto_realizado','cancelada') NOT NULL DEFAULT 'em_andamento',
  `observacao` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `inseminacoes_animal_id_idx` (`animal_id`),
  KEY `inseminacoes_propriedade_id_idx` (`propriedade_id`),
  CONSTRAINT `inseminacoes_parto_depois` CHECK (previsao_parto > data_inseminacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `investimentos` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `movimentacao_id` CHAR(36) NULL,
  `descricao` TEXT NOT NULL,
  `categoria` VARCHAR(255) NOT NULL,
  `valor` DECIMAL(14,2) NOT NULL,
  `data` DATE NOT NULL,
  `observacao` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `investimentos_movimentacao_id_uq` (`movimentacao_id`),
  KEY `investimentos_propriedade_id_idx` (`propriedade_id`),
  KEY `investimentos_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `investimentos_valor_check` CHECK (valor >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `irrig_manut` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `sistema_id` CHAR(36) NOT NULL,
  `tipo` VARCHAR(255) NULL DEFAULT 'Preventiva',
  `data` DATE NOT NULL,
  `descricao` TEXT NOT NULL,
  `valor` DECIMAL(14,2) NULL,
  `proxima_data` DATE NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `irrig_manut_propriedade_id_idx` (`propriedade_id`),
  KEY `irrig_manut_sistema_id_idx` (`sistema_id`),
  KEY `irrig_manut_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `valor_valido` CHECK (valor IS NULL OR valor >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `lancamentos` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `tipo` VARCHAR(255) NOT NULL DEFAULT 'Despesa',
  `data` DATE NOT NULL,
  `valor` DECIMAL(14,2) NOT NULL,
  `categoria` VARCHAR(255) NOT NULL,
  `descricao` TEXT NOT NULL,
  `animal_id` CHAR(36) NULL,
  `lote_id` CHAR(36) NULL,
  `pasto_id` CHAR(36) NULL,
  `plantio_id` CHAR(36) NULL,
  `maquina_id` CHAR(36) NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `lancamentos_animal_id_idx` (`animal_id`),
  KEY `lancamentos_lote_id_idx` (`lote_id`),
  KEY `lancamentos_maquina_id_idx` (`maquina_id`),
  KEY `lancamentos_pasto_id_idx` (`pasto_id`),
  KEY `lancamentos_plantio_id_idx` (`plantio_id`),
  KEY `lancamentos_propriedade_id_idx` (`propriedade_id`),
  KEY `lancamentos_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `valor_valido` CHECK (valor IS NULL OR valor >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `manutencoes` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `maquina_id` CHAR(36) NOT NULL,
  `tipo` VARCHAR(255) NOT NULL DEFAULT 'Preventiva',
  `data` DATE NOT NULL,
  `horimetro` DECIMAL(18,6) NULL,
  `km` DECIMAL(18,6) NULL,
  `litros` DECIMAL(18,6) NULL,
  `valor` DECIMAL(14,2) NULL,
  `pecas` TEXT NULL,
  `oficina` VARCHAR(255) NULL,
  `proxima_data` DATE NULL,
  `proxima_horas` DECIMAL(18,6) NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `manutencoes_maquina_id_idx` (`maquina_id`),
  KEY `manutencoes_propriedade_id_idx` (`propriedade_id`),
  KEY `manutencoes_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `horimetro_valido` CHECK (horimetro IS NULL OR horimetro >= 0),
  CONSTRAINT `km_valido` CHECK (km IS NULL OR km >= 0),
  CONSTRAINT `litros_valido` CHECK (litros IS NULL OR litros >= 0),
  CONSTRAINT `proxima_horas_valido` CHECK (proxima_horas IS NULL OR proxima_horas >= 0),
  CONSTRAINT `valor_valido` CHECK (valor IS NULL OR valor >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mov_animais` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `tipo` VARCHAR(255) NOT NULL,
  `data` DATE NOT NULL,
  `animal_id` CHAR(36) NULL,
  `lote_id` CHAR(36) NULL,
  `de` VARCHAR(255) NULL,
  `para` VARCHAR(255) NULL,
  `responsavel` VARCHAR(255) NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `mov_animais_animal_id_idx` (`animal_id`),
  KEY `mov_animais_lote_id_idx` (`lote_id`),
  KEY `mov_animais_propriedade_id_idx` (`propriedade_id`),
  KEY `mov_animais_prop_data_idx` (`propriedade_id`,`data` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `nascimentos` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `vaca_id` CHAR(36) NOT NULL,
  `bezerro_id` CHAR(36) NOT NULL,
  `data_nascimento` DATE NOT NULL,
  `sexo` ENUM('M','F') NOT NULL,
  `lote_id` CHAR(36) NULL,
  `observacoes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `nascimentos_bezerro_id_uq` (`bezerro_id`),
  KEY `nascimentos_lote_id_idx` (`lote_id`),
  KEY `nascimentos_propriedade_id_idx` (`propriedade_id`),
  KEY `nascimentos_vaca_id_idx` (`vaca_id`),
  CONSTRAINT `nascimentos_vaca_dif_bezerro` CHECK (vaca_id <> bezerro_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ocorr_reprod` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `animal_id` CHAR(36) NOT NULL,
  `tipo` VARCHAR(255) NOT NULL,
  `data` DATE NOT NULL,
  `descricao` TEXT NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `ocorr_reprod_animal_id_idx` (`animal_id`),
  KEY `ocorr_reprod_propriedade_id_idx` (`propriedade_id`),
  KEY `ocorr_reprod_prop_data_idx` (`propriedade_id`,`data` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pasto_mov` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `pasto_id` CHAR(36) NOT NULL,
  `lote_id` CHAR(36) NOT NULL,
  `qtd_animais` INT NULL,
  `entrada` DATE NOT NULL,
  `saida` DATE NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `pasto_mov_lote_id_idx` (`lote_id`),
  KEY `pasto_mov_pasto_id_idx` (`pasto_id`),
  KEY `pasto_mov_propriedade_id_idx` (`propriedade_id`),
  KEY `pasto_mov_prop_data_idx` (`propriedade_id`,`entrada` DESC),
  CONSTRAINT `qtd_animais_valido` CHECK (qtd_animais IS NULL OR qtd_animais >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pedidos_compra` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `fornecedor_id` CHAR(36) NOT NULL,
  `data` DATE NOT NULL,
  `descricao` TEXT NOT NULL,
  `item_id` CHAR(36) NULL,
  `qtd` DECIMAL(18,6) NULL,
  `valor` DECIMAL(14,2) NULL,
  `entrega_prevista` DATE NULL,
  `status` VARCHAR(255) NOT NULL DEFAULT 'Pedido',
  `pagamento` VARCHAR(255) NOT NULL DEFAULT 'Pendente',
  `vencimento_pgto` DATE NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `pedidos_compra_fornecedor_id_idx` (`fornecedor_id`),
  KEY `pedidos_compra_item_id_idx` (`item_id`),
  KEY `pedidos_compra_propriedade_id_idx` (`propriedade_id`),
  KEY `pedidos_compra_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `qtd_valido` CHECK (qtd IS NULL OR qtd >= 0),
  CONSTRAINT `valor_valido` CHECK (valor IS NULL OR valor >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pedidos_venda` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `cliente_id` CHAR(36) NOT NULL,
  `data` DATE NOT NULL,
  `produto` VARCHAR(255) NOT NULL,
  `item_id` CHAR(36) NULL,
  `qtd` DECIMAL(18,6) NOT NULL,
  `unidade` VARCHAR(255) NULL,
  `preco_unit` DECIMAL(14,2) NULL,
  `entrega_prevista` DATE NULL,
  `status` VARCHAR(255) NOT NULL DEFAULT 'Reservado',
  `pagamento` VARCHAR(255) NOT NULL DEFAULT 'Pendente',
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `pedidos_venda_cliente_id_idx` (`cliente_id`),
  KEY `pedidos_venda_item_id_idx` (`item_id`),
  KEY `pedidos_venda_propriedade_id_idx` (`propriedade_id`),
  KEY `pedidos_venda_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `preco_unit_valido` CHECK (preco_unit IS NULL OR preco_unit >= 0),
  CONSTRAINT `qtd_valido` CHECK (qtd IS NULL OR qtd >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pesagens` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `animal_id` CHAR(36) NOT NULL,
  `data` DATE NOT NULL,
  `peso_kg` DECIMAL(10,2) NOT NULL,
  `observacoes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `pesagens_animal_id_data_uq` (`animal_id`,`data`),
  KEY `pesagens_propriedade_id_idx` (`propriedade_id`),
  KEY `pesagens_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `pesagens_peso_kg_check` CHECK (peso_kg > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `planos_alim` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `nome` VARCHAR(255) NOT NULL,
  `categoria_animal` VARCHAR(255) NULL,
  `lote_id` CHAR(36) NULL,
  `item_id` CHAR(36) NOT NULL,
  `qtd_animal_dia` DECIMAL(18,6) NOT NULL,
  `inicio` DATE NULL,
  `fim` DATE NULL,
  `orientacao` TEXT NULL,
  `ativo` TINYINT(1) NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `planos_alim_item_id_idx` (`item_id`),
  KEY `planos_alim_lote_id_idx` (`lote_id`),
  KEY `planos_alim_propriedade_id_idx` (`propriedade_id`),
  KEY `planos_alim_prop_data_idx` (`propriedade_id`,`inicio` DESC),
  CONSTRAINT `qtd_animal_dia_valido` CHECK (qtd_animal_dia IS NULL OR qtd_animal_dia >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `producao_leite` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `animal_id` CHAR(36) NOT NULL,
  `lote_id` CHAR(36) NULL,
  `data` DATE NOT NULL,
  `litros` DECIMAL(10,2) NOT NULL,
  `valor_litro` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `valor_total` DECIMAL(12,2) AS (litros * valor_litro) STORED,
  `observacao` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `producao_leite_animal_id_idx` (`animal_id`),
  KEY `producao_leite_lote_id_idx` (`lote_id`),
  KEY `producao_leite_propriedade_id_idx` (`propriedade_id`),
  KEY `producao_leite_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `producao_leite_litros_check` CHECK (litros >= 0),
  CONSTRAINT `producao_leite_valor_litro_check` CHECK (valor_litro >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tarefas` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `titulo` TEXT NOT NULL,
  `tipo` VARCHAR(255) NOT NULL DEFAULT 'Geral',
  `data` DATE NOT NULL,
  `prioridade` VARCHAR(255) NOT NULL DEFAULT 'Normal',
  `status` VARCHAR(255) NOT NULL DEFAULT 'Pendente',
  `responsavel_id` CHAR(36) NULL,
  `setor` VARCHAR(255) NULL,
  `repete` VARCHAR(255) NULL DEFAULT 'Não repete',
  `animal_id` CHAR(36) NULL,
  `lote_id` CHAR(36) NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `tarefas_animal_id_idx` (`animal_id`),
  KEY `tarefas_lote_id_idx` (`lote_id`),
  KEY `tarefas_propriedade_id_idx` (`propriedade_id`),
  KEY `tarefas_responsavel_id_idx` (`responsavel_id`),
  KEY `tarefas_prop_data_idx` (`propriedade_id`,`data` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tratamentos` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `tipo` VARCHAR(255) NOT NULL DEFAULT 'Tratamento',
  `data` DATE NOT NULL,
  `animal_id` CHAR(36) NULL,
  `lote_id` CHAR(36) NULL,
  `descricao` TEXT NOT NULL,
  `medicamento` VARCHAR(255) NULL,
  `item_id` CHAR(36) NULL,
  `qtd_usada` DECIMAL(18,6) NULL,
  `dose` VARCHAR(255) NULL,
  `via` VARCHAR(255) NULL,
  `fabricante` VARCHAR(255) NULL,
  `lote_produto` VARCHAR(255) NULL,
  `responsavel` VARCHAR(255) NULL,
  `veterinario` VARCHAR(255) NULL,
  `carencia_leite` INT NULL,
  `carencia_carne` INT NULL,
  `status` VARCHAR(255) NOT NULL DEFAULT 'Em tratamento',
  `retorno` DATE NULL,
  `custo` DECIMAL(14,2) NULL,
  `orientacao` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `tratamentos_animal_id_idx` (`animal_id`),
  KEY `tratamentos_item_id_idx` (`item_id`),
  KEY `tratamentos_lote_id_idx` (`lote_id`),
  KEY `tratamentos_propriedade_id_idx` (`propriedade_id`),
  KEY `tratamentos_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `carencia_carne_valido` CHECK (carencia_carne IS NULL OR carencia_carne >= 0),
  CONSTRAINT `carencia_leite_valido` CHECK (carencia_leite IS NULL OR carencia_leite >= 0),
  CONSTRAINT `custo_valido` CHECK (custo IS NULL OR custo >= 0),
  CONSTRAINT `qtd_usada_valido` CHECK (qtd_usada IS NULL OR qtd_usada >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `vacinacoes` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `animal_id` CHAR(36) NULL,
  `lote_id` CHAR(36) NULL,
  `tipo_vacina_id` CHAR(36) NOT NULL,
  `data_aplicacao` DATE NOT NULL,
  `proxima_aplicacao` DATE NULL,
  `responsavel` VARCHAR(255) NULL,
  `observacao` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `vacinacoes_animal_id_idx` (`animal_id`),
  KEY `vacinacoes_lote_id_idx` (`lote_id`),
  KEY `vacinacoes_propriedade_id_idx` (`propriedade_id`),
  KEY `vacinacoes_tipo_vacina_id_idx` (`tipo_vacina_id`),
  CONSTRAINT `vacinacoes_um_alvo` CHECK ((animal_id IS NOT NULL) + (lote_id IS NOT NULL) = 1),
  CONSTRAINT `vacinacoes_proxima_depois` CHECK (proxima_aplicacao IS NULL OR proxima_aplicacao >= data_aplicacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `vendas` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `data` DATE NOT NULL,
  `animal_id` CHAR(36) NULL,
  `item` VARCHAR(255) NOT NULL,
  `quantidade` DECIMAL(12,2) NOT NULL,
  `valor` DECIMAL(14,2) NOT NULL,
  `comprador` VARCHAR(255) NULL,
  `categoria` VARCHAR(255) NOT NULL,
  `observacao` TEXT NULL,
  `movimentacao_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `vendas_movimentacao_id_uq` (`movimentacao_id`),
  KEY `vendas_animal_id_idx` (`animal_id`),
  KEY `vendas_propriedade_id_idx` (`propriedade_id`),
  KEY `vendas_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `vendas_quantidade_check` CHECK (quantidade > 0),
  CONSTRAINT `vendas_valor_check` CHECK (valor >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `alimentacao` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `data` DATE NOT NULL,
  `lote_id` CHAR(36) NULL,
  `animal_id` CHAR(36) NULL,
  `item_id` CHAR(36) NOT NULL,
  `qtd` DECIMAL(18,6) NOT NULL,
  `cocho` VARCHAR(255) NULL,
  `mudanca` TINYINT(1) NULL DEFAULT 0,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `alimentacao_animal_id_idx` (`animal_id`),
  KEY `alimentacao_item_id_idx` (`item_id`),
  KEY `alimentacao_lote_id_idx` (`lote_id`),
  KEY `alimentacao_propriedade_id_idx` (`propriedade_id`),
  KEY `alimentacao_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `qtd_valido` CHECK (qtd IS NULL OR qtd >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `atividades_agro` (
  `id` CHAR(36) NOT NULL,
  `propriedade_id` CHAR(36) NOT NULL,
  `plantio_id` CHAR(36) NOT NULL,
  `tipo` VARCHAR(255) NOT NULL DEFAULT 'Adubação',
  `data` DATE NOT NULL,
  `descricao` TEXT NULL,
  `item_id` CHAR(36) NULL,
  `qtd` DECIMAL(18,6) NULL,
  `praga` VARCHAR(255) NULL,
  `colhido_kg` DECIMAL(18,6) NULL,
  `perda_kg` DECIMAL(18,6) NULL,
  `entrada_item_id` CHAR(36) NULL,
  `custo` DECIMAL(14,2) NULL,
  `obs` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `atividades_agro_entrada_item_id_idx` (`entrada_item_id`),
  KEY `atividades_agro_item_id_idx` (`item_id`),
  KEY `atividades_agro_plantio_id_idx` (`plantio_id`),
  KEY `atividades_agro_propriedade_id_idx` (`propriedade_id`),
  KEY `atividades_agro_prop_data_idx` (`propriedade_id`,`data` DESC),
  CONSTRAINT `colhido_kg_valido` CHECK (colhido_kg IS NULL OR colhido_kg >= 0),
  CONSTRAINT `custo_valido` CHECK (custo IS NULL OR custo >= 0),
  CONSTRAINT `perda_kg_valido` CHECK (perda_kg IS NULL OR perda_kg >= 0),
  CONSTRAINT `qtd_valido` CHECK (qtd IS NULL OR qtd >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ligações entre tabelas, depois que todas existem.
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_id_fk` FOREIGN KEY (`id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;
ALTER TABLE `alimentacao` ADD CONSTRAINT `alimentacao_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE SET NULL;
ALTER TABLE `alimentacao` ADD CONSTRAINT `alimentacao_item_id_fk` FOREIGN KEY (`item_id`) REFERENCES `estoque_itens` (`id`) ON DELETE CASCADE;
ALTER TABLE `alimentacao` ADD CONSTRAINT `alimentacao_lote_id_fk` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON DELETE SET NULL;
ALTER TABLE `alimentacao` ADD CONSTRAINT `alimentacao_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `animais` ADD CONSTRAINT `animais_lote_id_fk` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON DELETE SET NULL;
ALTER TABLE `animais` ADD CONSTRAINT `animais_mae_id_fk` FOREIGN KEY (`mae_id`) REFERENCES `animais` (`id`) ON DELETE SET NULL;
ALTER TABLE `animais` ADD CONSTRAINT `animais_pai_id_fk` FOREIGN KEY (`pai_id`) REFERENCES `animais` (`id`) ON DELETE SET NULL;
ALTER TABLE `animais` ADD CONSTRAINT `animais_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `animal_extra` ADD CONSTRAINT `animal_extra_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE CASCADE;
ALTER TABLE `animal_extra` ADD CONSTRAINT `animal_extra_pasto_id_fk` FOREIGN KEY (`pasto_id`) REFERENCES `pastos` (`id`) ON DELETE SET NULL;
ALTER TABLE `animal_extra` ADD CONSTRAINT `animal_extra_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `anotacoes_producao` ADD CONSTRAINT `anotacoes_producao_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE SET NULL;
ALTER TABLE `anotacoes_producao` ADD CONSTRAINT `anotacoes_producao_lote_id_fk` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON DELETE SET NULL;
ALTER TABLE `anotacoes_producao` ADD CONSTRAINT `anotacoes_producao_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `assinaturas` ADD CONSTRAINT `assinaturas_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `atividades_agro` ADD CONSTRAINT `atividades_agro_entrada_item_id_fk` FOREIGN KEY (`entrada_item_id`) REFERENCES `estoque_itens` (`id`) ON DELETE SET NULL;
ALTER TABLE `atividades_agro` ADD CONSTRAINT `atividades_agro_item_id_fk` FOREIGN KEY (`item_id`) REFERENCES `estoque_itens` (`id`) ON DELETE SET NULL;
ALTER TABLE `atividades_agro` ADD CONSTRAINT `atividades_agro_plantio_id_fk` FOREIGN KEY (`plantio_id`) REFERENCES `plantios` (`id`) ON DELETE CASCADE;
ALTER TABLE `atividades_agro` ADD CONSTRAINT `atividades_agro_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `avaliacoes` ADD CONSTRAINT `avaliacoes_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE SET NULL;
ALTER TABLE `avaliacoes` ADD CONSTRAINT `avaliacoes_lote_id_fk` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON DELETE SET NULL;
ALTER TABLE `avaliacoes` ADD CONSTRAINT `avaliacoes_pasto_id_fk` FOREIGN KEY (`pasto_id`) REFERENCES `pastos` (`id`) ON DELETE SET NULL;
ALTER TABLE `avaliacoes` ADD CONSTRAINT `avaliacoes_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `bezerros_info` ADD CONSTRAINT `bezerros_info_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE CASCADE;
ALTER TABLE `bezerros_info` ADD CONSTRAINT `bezerros_info_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `bloqueios_acesso` ADD CONSTRAINT `bloqueios_acesso_incidente_id_fk` FOREIGN KEY (`incidente_id`) REFERENCES `incidentes_seguranca` (`id`) ON DELETE SET NULL;
ALTER TABLE `campanhas` ADD CONSTRAINT `campanhas_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `cios` ADD CONSTRAINT `cios_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE CASCADE;
ALTER TABLE `cios` ADD CONSTRAINT `cios_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `clientes` ADD CONSTRAINT `clientes_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `clima_obs` ADD CONSTRAINT `clima_obs_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `compras` ADD CONSTRAINT `compras_movimentacao_id_fk` FOREIGN KEY (`movimentacao_id`) REFERENCES `movimentacoes_financeiras` (`id`) ON DELETE SET NULL;
ALTER TABLE `compras` ADD CONSTRAINT `compras_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `configuracoes` ADD CONSTRAINT `configuracoes_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `contas` ADD CONSTRAINT `contas_fornecedor_id_fk` FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedores` (`id`) ON DELETE SET NULL;
ALTER TABLE `contas` ADD CONSTRAINT `contas_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `cotacoes` ADD CONSTRAINT `cotacoes_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `documentos` ADD CONSTRAINT `documentos_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE SET NULL;
ALTER TABLE `documentos` ADD CONSTRAINT `documentos_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `ebook_acessos` ADD CONSTRAINT `ebook_acessos_ebook_id_fk` FOREIGN KEY (`ebook_id`) REFERENCES `ebooks` (`id`) ON DELETE CASCADE;
ALTER TABLE `engorda` ADD CONSTRAINT `engorda_lote_id_fk` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON DELETE CASCADE;
ALTER TABLE `engorda` ADD CONSTRAINT `engorda_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `estoque_itens` ADD CONSTRAINT `estoque_itens_fornecedor_id_fk` FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedores` (`id`) ON DELETE SET NULL;
ALTER TABLE `estoque_itens` ADD CONSTRAINT `estoque_itens_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `estoque_mov` ADD CONSTRAINT `estoque_mov_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE SET NULL;
ALTER TABLE `estoque_mov` ADD CONSTRAINT `estoque_mov_fornecedor_id_fk` FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedores` (`id`) ON DELETE SET NULL;
ALTER TABLE `estoque_mov` ADD CONSTRAINT `estoque_mov_item_id_fk` FOREIGN KEY (`item_id`) REFERENCES `estoque_itens` (`id`) ON DELETE CASCADE;
ALTER TABLE `estoque_mov` ADD CONSTRAINT `estoque_mov_lote_id_fk` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON DELETE SET NULL;
ALTER TABLE `estoque_mov` ADD CONSTRAINT `estoque_mov_maquina_id_fk` FOREIGN KEY (`maquina_id`) REFERENCES `maquinas` (`id`) ON DELETE SET NULL;
ALTER TABLE `estoque_mov` ADD CONSTRAINT `estoque_mov_plantio_id_fk` FOREIGN KEY (`plantio_id`) REFERENCES `plantios` (`id`) ON DELETE SET NULL;
ALTER TABLE `estoque_mov` ADD CONSTRAINT `estoque_mov_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `fornecedores` ADD CONSTRAINT `fornecedores_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `funcionarios` ADD CONSTRAINT `funcionarios_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `gta` ADD CONSTRAINT `gta_lote_id_fk` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON DELETE SET NULL;
ALTER TABLE `gta` ADD CONSTRAINT `gta_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `horas_trabalho` ADD CONSTRAINT `horas_trabalho_funcionario_id_fk` FOREIGN KEY (`funcionario_id`) REFERENCES `funcionarios` (`id`) ON DELETE CASCADE;
ALTER TABLE `horas_trabalho` ADD CONSTRAINT `horas_trabalho_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `importacoes` ADD CONSTRAINT `importacoes_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `inseminacoes` ADD CONSTRAINT `inseminacoes_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE CASCADE;
ALTER TABLE `inseminacoes` ADD CONSTRAINT `inseminacoes_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `instalacoes` ADD CONSTRAINT `instalacoes_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `investimentos` ADD CONSTRAINT `investimentos_movimentacao_id_fk` FOREIGN KEY (`movimentacao_id`) REFERENCES `movimentacoes_financeiras` (`id`) ON DELETE CASCADE;
ALTER TABLE `investimentos` ADD CONSTRAINT `investimentos_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `irrig_manut` ADD CONSTRAINT `irrig_manut_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `irrig_manut` ADD CONSTRAINT `irrig_manut_sistema_id_fk` FOREIGN KEY (`sistema_id`) REFERENCES `irrig_sistemas` (`id`) ON DELETE CASCADE;
ALTER TABLE `irrig_sistemas` ADD CONSTRAINT `irrig_sistemas_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `irrigacoes` ADD CONSTRAINT `irrigacoes_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `irrigacoes` ADD CONSTRAINT `irrigacoes_sistema_id_fk` FOREIGN KEY (`sistema_id`) REFERENCES `irrig_sistemas` (`id`) ON DELETE CASCADE;
ALTER TABLE `irrigacoes` ADD CONSTRAINT `irrigacoes_talhao_id_fk` FOREIGN KEY (`talhao_id`) REFERENCES `talhoes` (`id`) ON DELETE SET NULL;
ALTER TABLE `lancamentos` ADD CONSTRAINT `lancamentos_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE SET NULL;
ALTER TABLE `lancamentos` ADD CONSTRAINT `lancamentos_lote_id_fk` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON DELETE SET NULL;
ALTER TABLE `lancamentos` ADD CONSTRAINT `lancamentos_maquina_id_fk` FOREIGN KEY (`maquina_id`) REFERENCES `maquinas` (`id`) ON DELETE SET NULL;
ALTER TABLE `lancamentos` ADD CONSTRAINT `lancamentos_pasto_id_fk` FOREIGN KEY (`pasto_id`) REFERENCES `pastos` (`id`) ON DELETE SET NULL;
ALTER TABLE `lancamentos` ADD CONSTRAINT `lancamentos_plantio_id_fk` FOREIGN KEY (`plantio_id`) REFERENCES `plantios` (`id`) ON DELETE SET NULL;
ALTER TABLE `lancamentos` ADD CONSTRAINT `lancamentos_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `lotes` ADD CONSTRAINT `lotes_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `manutencoes` ADD CONSTRAINT `manutencoes_maquina_id_fk` FOREIGN KEY (`maquina_id`) REFERENCES `maquinas` (`id`) ON DELETE CASCADE;
ALTER TABLE `manutencoes` ADD CONSTRAINT `manutencoes_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `maquinas` ADD CONSTRAINT `maquinas_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `mov_animais` ADD CONSTRAINT `mov_animais_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE SET NULL;
ALTER TABLE `mov_animais` ADD CONSTRAINT `mov_animais_lote_id_fk` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON DELETE SET NULL;
ALTER TABLE `mov_animais` ADD CONSTRAINT `mov_animais_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `movimentacoes_financeiras` ADD CONSTRAINT `movimentacoes_financeiras_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `nascimentos` ADD CONSTRAINT `nascimentos_bezerro_id_fk` FOREIGN KEY (`bezerro_id`) REFERENCES `animais` (`id`) ON DELETE RESTRICT;
ALTER TABLE `nascimentos` ADD CONSTRAINT `nascimentos_lote_id_fk` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON DELETE SET NULL;
ALTER TABLE `nascimentos` ADD CONSTRAINT `nascimentos_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `nascimentos` ADD CONSTRAINT `nascimentos_vaca_id_fk` FOREIGN KEY (`vaca_id`) REFERENCES `animais` (`id`) ON DELETE RESTRICT;
ALTER TABLE `notificacoes` ADD CONSTRAINT `notificacoes_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `ocorr_reprod` ADD CONSTRAINT `ocorr_reprod_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE CASCADE;
ALTER TABLE `ocorr_reprod` ADD CONSTRAINT `ocorr_reprod_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `ocorrencias` ADD CONSTRAINT `ocorrencias_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `ocorrencias` ADD CONSTRAINT `ocorrencias_responsavel_id_fk` FOREIGN KEY (`responsavel_id`) REFERENCES `funcionarios` (`id`) ON DELETE SET NULL;
ALTER TABLE `pagamentos` ADD CONSTRAINT `pagamentos_plano_id_fk` FOREIGN KEY (`plano_id`) REFERENCES `planos` (`id`) ON DELETE SET NULL;
ALTER TABLE `pagamentos` ADD CONSTRAINT `pagamentos_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `pasto_mov` ADD CONSTRAINT `pasto_mov_lote_id_fk` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON DELETE CASCADE;
ALTER TABLE `pasto_mov` ADD CONSTRAINT `pasto_mov_pasto_id_fk` FOREIGN KEY (`pasto_id`) REFERENCES `pastos` (`id`) ON DELETE CASCADE;
ALTER TABLE `pasto_mov` ADD CONSTRAINT `pasto_mov_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `pastos` ADD CONSTRAINT `pastos_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `pedidos_compra` ADD CONSTRAINT `pedidos_compra_fornecedor_id_fk` FOREIGN KEY (`fornecedor_id`) REFERENCES `fornecedores` (`id`) ON DELETE CASCADE;
ALTER TABLE `pedidos_compra` ADD CONSTRAINT `pedidos_compra_item_id_fk` FOREIGN KEY (`item_id`) REFERENCES `estoque_itens` (`id`) ON DELETE SET NULL;
ALTER TABLE `pedidos_compra` ADD CONSTRAINT `pedidos_compra_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `pedidos_venda` ADD CONSTRAINT `pedidos_venda_cliente_id_fk` FOREIGN KEY (`cliente_id`) REFERENCES `clientes` (`id`) ON DELETE CASCADE;
ALTER TABLE `pedidos_venda` ADD CONSTRAINT `pedidos_venda_item_id_fk` FOREIGN KEY (`item_id`) REFERENCES `estoque_itens` (`id`) ON DELETE SET NULL;
ALTER TABLE `pedidos_venda` ADD CONSTRAINT `pedidos_venda_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `pesagens` ADD CONSTRAINT `pesagens_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE CASCADE;
ALTER TABLE `pesagens` ADD CONSTRAINT `pesagens_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `plano_auditoria` ADD CONSTRAINT `plano_auditoria_assinatura_id_fk` FOREIGN KEY (`assinatura_id`) REFERENCES `assinaturas` (`id`) ON DELETE SET NULL;
ALTER TABLE `planos_alim` ADD CONSTRAINT `planos_alim_item_id_fk` FOREIGN KEY (`item_id`) REFERENCES `estoque_itens` (`id`) ON DELETE CASCADE;
ALTER TABLE `planos_alim` ADD CONSTRAINT `planos_alim_lote_id_fk` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON DELETE SET NULL;
ALTER TABLE `planos_alim` ADD CONSTRAINT `planos_alim_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `plantios` ADD CONSTRAINT `plantios_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `plantios` ADD CONSTRAINT `plantios_talhao_id_fk` FOREIGN KEY (`talhao_id`) REFERENCES `talhoes` (`id`) ON DELETE CASCADE;
ALTER TABLE `producao_leite` ADD CONSTRAINT `producao_leite_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE CASCADE;
ALTER TABLE `producao_leite` ADD CONSTRAINT `producao_leite_lote_id_fk` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON DELETE SET NULL;
ALTER TABLE `producao_leite` ADD CONSTRAINT `producao_leite_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `propriedade_membros` ADD CONSTRAINT `propriedade_membros_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `propriedade_perfil` ADD CONSTRAINT `propriedade_perfil_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `qualidade_leite` ADD CONSTRAINT `qualidade_leite_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `suporte_contatos` ADD CONSTRAINT `suporte_contatos_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE SET NULL;
ALTER TABLE `talhoes` ADD CONSTRAINT `talhoes_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `tarefas` ADD CONSTRAINT `tarefas_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE SET NULL;
ALTER TABLE `tarefas` ADD CONSTRAINT `tarefas_lote_id_fk` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON DELETE SET NULL;
ALTER TABLE `tarefas` ADD CONSTRAINT `tarefas_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `tarefas` ADD CONSTRAINT `tarefas_responsavel_id_fk` FOREIGN KEY (`responsavel_id`) REFERENCES `funcionarios` (`id`) ON DELETE SET NULL;
ALTER TABLE `tipos_vacinas` ADD CONSTRAINT `tipos_vacinas_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `tratamentos` ADD CONSTRAINT `tratamentos_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE SET NULL;
ALTER TABLE `tratamentos` ADD CONSTRAINT `tratamentos_item_id_fk` FOREIGN KEY (`item_id`) REFERENCES `estoque_itens` (`id`) ON DELETE SET NULL;
ALTER TABLE `tratamentos` ADD CONSTRAINT `tratamentos_lote_id_fk` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON DELETE SET NULL;
ALTER TABLE `tratamentos` ADD CONSTRAINT `tratamentos_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `vacinacoes` ADD CONSTRAINT `vacinacoes_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE CASCADE;
ALTER TABLE `vacinacoes` ADD CONSTRAINT `vacinacoes_lote_id_fk` FOREIGN KEY (`lote_id`) REFERENCES `lotes` (`id`) ON DELETE CASCADE;
ALTER TABLE `vacinacoes` ADD CONSTRAINT `vacinacoes_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `vacinacoes` ADD CONSTRAINT `vacinacoes_tipo_vacina_id_fk` FOREIGN KEY (`tipo_vacina_id`) REFERENCES `tipos_vacinas` (`id`) ON DELETE RESTRICT;
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_animal_id_fk` FOREIGN KEY (`animal_id`) REFERENCES `animais` (`id`) ON DELETE SET NULL;
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_movimentacao_id_fk` FOREIGN KEY (`movimentacao_id`) REFERENCES `movimentacoes_financeiras` (`id`) ON DELETE SET NULL;
ALTER TABLE `vendas` ADD CONSTRAINT `vendas_propriedade_id_fk` FOREIGN KEY (`propriedade_id`) REFERENCES `propriedades` (`id`) ON DELETE CASCADE;
ALTER TABLE `yui_uso` ADD CONSTRAINT `yui_uso_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE;

SET FOREIGN_KEY_CHECKS = 1;
