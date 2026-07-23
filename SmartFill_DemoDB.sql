-- ========================================================================================
-- SCRIPT DE DEMOSTRACIÓN PARA SMARTFILL (VERSIÓN: SISTEMA DE VENTAS AVANZADO)
-- Este script crea una base de datos de ventas ("SmartFill_VentasDB") y genera 
-- escenarios artificiales técnicos (fragmentación, índices faltantes, índices inútiles) 
-- simulando operaciones reales de un negocio (inserts, updates, queries) para probar
-- TODAS las funcionalidades del software SmartFill.
--
-- INSTRUCCIONES:
-- Ejecute este script completo en SQL Server Management Studio (SSMS).
-- Dependiendo del rendimiento de su PC, puede tardar entre 15 y 40 segundos.
-- ========================================================================================

USE master;
GO

-- 1. Crear Base de Datos de Prueba
IF DB_ID('SmartFill_VentasDB') IS NOT NULL
BEGIN
    ALTER DATABASE SmartFill_VentasDB SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE SmartFill_VentasDB;
END
GO

CREATE DATABASE SmartFill_VentasDB;
GO

USE SmartFill_VentasDB;
GO

-- ========================================================================================
-- ESCENARIO 1: TABLA MUY FRAGMENTADA (Para probar /optimizar y REBUILD, Nivel Crítico)
-- Tabla: Pedidos
-- Técnica: Usamos un Clustered Index sobre un UNIQUEIDENTIFIER (GUID aleatorio).
-- Al simular la entrada de miles de pedidos con IDs desordenados, forzamos 
-- "Page Splits" masivos que elevarán la fragmentación al 80%-99%.
-- ========================================================================================
CREATE TABLE Pedidos (
    PedidoId UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY CLUSTERED,
    ClienteId INT NOT NULL,
    VendedorId INT NOT NULL,
    FechaPedido DATETIME DEFAULT GETDATE(),
    Estado NVARCHAR(50),
    Comentarios NVARCHAR(300)
);
GO

SET NOCOUNT ON;
PRINT 'Generando miles de Pedidos (Fragmentación CRÍTICA > 30%)...';
DECLARE @i INT = 0;
WHILE @i < 8000
BEGIN
    INSERT INTO Pedidos (ClienteId, VendedorId, Estado, Comentarios) 
    VALUES (
        ABS(CHECKSUM(NEWID())) % 5000 + 1, 
        ABS(CHECKSUM(NEWID())) % 50 + 1, 
        CHOOSE((@i % 4) + 1, 'Pendiente', 'Enviado', 'Entregado', 'Cancelado'),
        REPLICATE('A', 200) -- Relleno para hacer la fila pesada
    );
    SET @i = @i + 1;
END
GO

-- ========================================================================================
-- ESCENARIO 2: TABLA CON FRAGMENTACIÓN MODERADA (Para probar REORGANIZE)
-- Tabla: Clientes
-- Técnica: ID secuencial (sin fragmentación inicial), pero luego los clientes actualizan
-- su perfil y añaden direcciones muy largas, expandiendo el tamaño de la fila y causando
-- fragmentación por "Forwarded Records" y "Page Splits" secundarios al 15%-25%.
-- ========================================================================================
CREATE TABLE Clientes (
    ClienteId INT IDENTITY(1,1) PRIMARY KEY CLUSTERED,
    NombreCompleto NVARCHAR(100),
    Email NVARCHAR(100),
    Telefono NVARCHAR(20),
    DireccionEnvio NVARCHAR(500)
);
GO

PRINT 'Registrando Clientes (Fragmentación MODERADA 10%-30%)...';
DECLARE @j INT = 0;
WHILE @j < 5000
BEGIN
    INSERT INTO Clientes (NombreCompleto, Email, Telefono, DireccionEnvio) 
    VALUES ('Cliente Generico ' + CAST(@j AS NVARCHAR), 'cliente' + CAST(@j AS NVARCHAR) + '@mail.com', '555-0000', 'Direccion Corta');
    SET @j = @j + 1;
END
GO

-- Los clientes completan sus perfiles con direcciones larguísimas (causa expansión de la fila)
UPDATE Clientes
SET DireccionEnvio = REPLICATE('X', 450)
WHERE ClienteId % 2 = 0; 
GO

-- ========================================================================================
-- ESCENARIO 3: TABLA SALUDABLE Y VARIOS ÍNDICES INÚTILES
-- Tabla: Productos y Auditoria_Log
-- Técnica: Inserciones puramente secuenciales, fragmentación < 10%.
-- Además, creamos MUCHOS índices en columnas que nunca usamos en filtros (WHERE).
-- ========================================================================================
CREATE TABLE Productos (
    ProductoId INT IDENTITY(1,1) PRIMARY KEY CLUSTERED,
    CodigoSKU NVARCHAR(50),
    NombreProducto NVARCHAR(150),
    Precio DECIMAL(18,2),
    StockActual INT
);
GO

-- Índice inútil (nadie busca productos por nombre exacto en este sistema backend)
CREATE NONCLUSTERED INDEX IX_Productos_Nombre ON Productos(NombreProducto);

PRINT 'Poblando Catálogo de Productos (Tabla SALUDABLE < 10%)...';
DECLARE @k INT = 0;
WHILE @k < 3000
BEGIN
    INSERT INTO Productos (CodigoSKU, NombreProducto, Precio, StockActual) 
    VALUES (
        'SKU-' + CAST(@k AS NVARCHAR), 
        'Producto de Ventas ' + CAST(@k AS NVARCHAR), 
        (RAND() * 1000) + 10, 
        ABS(CHECKSUM(NEWID())) % 500
    );
    SET @k = @k + 1;
END
GO

-- Tabla Auditoria_Log (Pura escritura, cero lectura. Ideal para cazar índices inútiles)
CREATE TABLE Auditoria_Log (
    LogId INT IDENTITY(1,1) PRIMARY KEY CLUSTERED,
    Usuario NVARCHAR(50),
    Accion NVARCHAR(100),
    FechaLog DATETIME DEFAULT GETDATE()
);
GO
CREATE NONCLUSTERED INDEX IX_Log_User ON Auditoria_Log(Usuario);
CREATE NONCLUSTERED INDEX IX_Log_Action ON Auditoria_Log(Accion);
CREATE NONCLUSTERED INDEX IX_Log_Date ON Auditoria_Log(FechaLog);

PRINT 'Generando Logs de Auditoría (Generando ÍNDICES INÚTILES masivos)...';
DECLARE @log INT = 0;
WHILE @log < 8000
BEGIN
    INSERT INTO Auditoria_Log (Usuario, Accion) 
    VALUES ('Admin', 'Acción de sistema ' + CAST(@log AS NVARCHAR));
    SET @log = @log + 1;
END
GO

-- ========================================================================================
-- ESCENARIO 4: ÍNDICES FALTANTES (Missing Indexes Complejos)
-- Tabla: Detalle_Pedidos y Facturas
-- Técnica: Realizar consultas pesadas (agrupaciones, filtros) repetidas veces en columnas
-- sin indexar. SQL Server detectará que falta un índice para mejorar el rendimiento.
-- ========================================================================================
CREATE TABLE Detalle_Pedidos (
    DetalleId INT IDENTITY(1,1) PRIMARY KEY CLUSTERED,
    PedidoId UNIQUEIDENTIFIER, 
    ProductoId INT,            
    Cantidad INT,
    PrecioUnitario DECIMAL(18,2)
);
GO

CREATE TABLE Facturas (
    FacturaId INT IDENTITY(1,1) PRIMARY KEY CLUSTERED,
    PedidoId UNIQUEIDENTIFIER,
    EstadoFactura NVARCHAR(50),
    FechaVencimiento DATETIME
);
GO

PRINT 'Generando Detalles de Pedidos y Facturas (Para crear ÍNDICES FALTANTES)...';
DECLARE @m INT = 0;
WHILE @m < 15000
BEGIN
    INSERT INTO Detalle_Pedidos (PedidoId, ProductoId, Cantidad, PrecioUnitario) 
    VALUES (
        NEWID(), 
        ABS(CHECKSUM(NEWID())) % 3000 + 1, 
        ABS(CHECKSUM(NEWID())) % 20 + 1, 
        (RAND() * 500) + 5
    );
    
    INSERT INTO Facturas (PedidoId, EstadoFactura, FechaVencimiento)
    VALUES (
        NEWID(),
        CHOOSE((@m % 3) + 1, 'Pagada', 'Pendiente', 'Vencida'),
        DATEADD(day, (@m % 30) - 15, GETDATE())
    );
    
    SET @m = @m + 1;
END
GO

-- Limpiar el caché de planes para asegurar que el motor registre los missing indexes limpiamente
DBCC FREEPROCCACHE;
GO

PRINT 'Ejecutando reportes pesados para simular lentitud...';
DECLARE @n INT = 0;
WHILE @n < 70
BEGIN
    DECLARE @TotalVendido DECIMAL(18,2);
    
    -- Reporte 1: Falta índice en Detalle_Pedidos (ProductoId, Cantidad)
    SELECT @TotalVendido = SUM(Cantidad * PrecioUnitario)
    FROM Detalle_Pedidos 
    WHERE ProductoId = 1500 AND Cantidad > 5;
    
    -- Reporte 2: Falta índice en Facturas (EstadoFactura, FechaVencimiento)
    DECLARE @TotalFacturas INT;
    SELECT @TotalFacturas = COUNT(FacturaId)
    FROM Facturas
    WHERE EstadoFactura = 'Vencida' AND FechaVencimiento < GETDATE();
    
    -- Reporte 3: Falta índice en Detalle_Pedidos (PedidoId)
    DECLARE @TempID UNIQUEIDENTIFIER = NEWID();
    SELECT @TotalVendido = SUM(PrecioUnitario)
    FROM Detalle_Pedidos
    WHERE PedidoId = @TempID;

    SET @n = @n + 1;
END
GO

-- ========================================================================================
-- FIN DEL SCRIPT.
-- RECOMENDACIÓN FINAL: 
-- 1. Ve a SmartFill > Bases de Datos > Conéctate a "SmartFill_VentasDB" (si ya estabas, actualiza)
-- 2. Ve al Chat de Prueba o Dashboard y maravíllate viendo cómo detecta:
--    - Múltiples fragmentaciones (Críticas y Moderadas)
--    - Más de 4 índices inútiles para borrar (Log y Productos)
--    - Hasta 3 índices faltantes para crear (Detalle_Pedidos, Facturas)
-- ========================================================================================
PRINT '==========================================================';
PRINT 'Base de datos de ventas "SmartFill_VentasDB" RECREADA con exito.';
PRINT 'Lista para probar TODAS las funciones AVANZADAS de SmartFill.';
PRINT '==========================================================';
