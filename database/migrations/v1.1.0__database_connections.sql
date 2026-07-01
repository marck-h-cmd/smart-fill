-- Migration: Add DatabaseConnections table
-- Version: v1.1.0
-- Description: Adds support for managing multiple SQL Server database connections

CREATE TABLE IF NOT EXISTS database_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    host VARCHAR(255) NOT NULL,
    port INTEGER DEFAULT 1433,
    database VARCHAR(100) NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_encrypted VARCHAR(500) NOT NULL,
    driver VARCHAR(100) DEFAULT 'ODBC Driver 17 for SQL Server',
    is_active BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
