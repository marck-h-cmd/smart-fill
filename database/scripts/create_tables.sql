-- Crear la base de datos (si no existe)
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'SmartFillDB')
BEGIN
    CREATE DATABASE SmartFillDB;
END;
GO

USE SmartFillDB;
GO

-- Tabla de usuarios (para autenticación básica)
CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    username NVARCHAR(50) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    email NVARCHAR(100),
    role NVARCHAR(20) DEFAULT 'admin',
    created_at DATETIME DEFAULT GETDATE()
);

-- Tabla de metadatos de tablas (las tablas que monitoreamos)
CREATE TABLE table_metadata (
    id INT IDENTITY(1,1) PRIMARY KEY,
    database_name NVARCHAR(100) NOT NULL,
    schema_name NVARCHAR(50) NOT NULL,
    table_name NVARCHAR(100) NOT NULL,
    fill_factor INT DEFAULT 90,
    last_analyzed DATETIME,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    CONSTRAINT UQ_Table UNIQUE (database_name, schema_name, table_name)
);

-- Tabla de métricas de fragmentación (histórico)
CREATE TABLE fragmentation_metrics (
    id INT IDENTITY(1,1) PRIMARY KEY,
    table_id INT FOREIGN KEY REFERENCES table_metadata(id),
    avg_fragmentation_percent DECIMAL(5,2),
    page_count BIGINT,
    record_count BIGINT,
    fragmentation_type NVARCHAR(20), -- 'logical' o 'extent'
    analyzed_at DATETIME DEFAULT GETDATE(),
    -- para seguimiento de la recomendación
    recommended_fill_factor INT NULL,
    optimization_applied BIT DEFAULT 0
);

-- Tabla de recomendaciones generadas
CREATE TABLE recommendations (
    id INT IDENTITY(1,1) PRIMARY KEY,
    table_id INT FOREIGN KEY REFERENCES table_metadata(id),
    current_fill_factor INT,
    recommended_fill_factor INT,
    score DECIMAL(5,2), -- puntuación multidimensional
    reasoning NVARCHAR(MAX),
    generated_at DATETIME DEFAULT GETDATE(),
    applied BIT DEFAULT 0
);

-- Tabla de configuraciones de alertas
CREATE TABLE alert_configs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    table_id INT FOREIGN KEY REFERENCES table_metadata(id),
    threshold_fragmentation DECIMAL(5,2) DEFAULT 30.0,
    threshold_page_count INT DEFAULT 1000,
    enabled BIT DEFAULT 1,
    notify_email NVARCHAR(100),
    notify_whatsapp NVARCHAR(20)
);

-- Tabla de historial de análisis (para auditoría)
CREATE TABLE analysis_history (
    id INT IDENTITY(1,1) PRIMARY KEY,
    table_id INT FOREIGN KEY REFERENCES table_metadata(id),
    analysis_type NVARCHAR(50), -- 'manual', 'scheduled', 'auto'
    triggered_by NVARCHAR(50), -- usuario o job
    result_summary NVARCHAR(MAX),
    analyzed_at DATETIME DEFAULT GETDATE()
);

-- Tabla de logs de scripts generados
CREATE TABLE script_logs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    table_id INT FOREIGN KEY REFERENCES table_metadata(id),
    script_content NVARCHAR(MAX),
    executed BIT DEFAULT 0,
    execution_result NVARCHAR(MAX),
    generated_at DATETIME DEFAULT GETDATE(),
    executed_at DATETIME
);

-- Tabla de programación de mantenimiento
CREATE TABLE maintenance_schedules (
    id INT IDENTITY(1,1) PRIMARY KEY,
    table_id INT FOREIGN KEY REFERENCES table_metadata(id),
    schedule_type NVARCHAR(20), -- 'daily', 'weekly', 'monthly'
    schedule_time TIME,
    day_of_week INT NULL, -- 1-7
    enabled BIT DEFAULT 1,
    last_run DATETIME,
    next_run DATETIME
);

-- Insertar algunos datos de prueba (opcional)
INSERT INTO users (username, password_hash, email, role)
VALUES ('admin', 'pbkdf2:sha256:150000$...', 'admin@smartfill.com', 'admin');

-- Nota: La contraseña hash debería generarse con bcrypt o similar, pero para pruebas se puede usar texto plano (no recomendado).