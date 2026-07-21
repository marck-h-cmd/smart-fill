-- ========================================================================================
-- SCRIPT DE DEMOSTRACIÓN PARA SMARTFILL (VERSIÓN: SISTEMA DE VENTAS REAL)
-- Este script crea una base de datos de ventas ("SmartFill_VentasDB") y genera 
-- escenarios artificiales técnicos (fragmentación, índices faltantes, índices inútiles) 
-- simulando operaciones reales de un negocio (inserts, updates, queries) para probar
-- todas las funcionalidades de SmartFill.
--
-- INSTRUCCIONES:
-- Ejecute este script completo en SQL Server Management Studio (SSMS).
-- Dependiendo del rendimiento de su PC, puede tardar entre 10 y 30 segundos.
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
-- ESCENARIO 1: TABLA MUY FRAGMENTADA (Para probar /optimizar y REBUILD)
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
PRINT 'Generando miles de Pedidos (Fragmentación Alta)...';
DECLARE @i INT = 0;
WHILE @i < 5000
BEGIN
    INSERT INTO Pedidos (ClienteId, VendedorId, Estado, Comentarios) 
    VALUES (
        ABS(CHECKSUM(NEWID())) % 5000 + 1, 
        ABS(CHECKSUM(NEWID())) % 50 + 1, 
        CHOOSE((@i % 4) + 1, 'Pendiente', 'Enviado', 'Entregado', 'Cancelado'),
        REPLICATE('A', 150) -- Relleno para hacer la fila pesada
    );
    SET @i = @i + 1;
END
GO

-- ========================================================================================
-- ESCENARIO 2: TABLA CON FRAGMENTACIÓN MODERADA (Para probar REORGANIZE)
-- Tabla: Clientes
-- Técnica: ID secuencial (sin fragmentación inicial), pero luego los clientes actualizan
-- su perfil y añaden direcciones muy largas, expandiendo el tamaño de la fila y causando
-- fragmentación por "Forwarded Records" y "Page Splits" secundarios.
-- ========================================================================================
CREATE TABLE Clientes (
    ClienteId INT IDENTITY(1,1) PRIMARY KEY CLUSTERED,
    NombreCompleto NVARCHAR(100),
    Email NVARCHAR(100),
    Telefono NVARCHAR(20),
    DireccionEnvio NVARCHAR(500)
);
GO

PRINT 'Registrando Clientes (Fragmentación Moderada por Updates)...';
DECLARE @j INT = 0;
WHILE @j < 3000
BEGIN
    INSERT INTO Clientes (NombreCompleto, Email, Telefono, DireccionEnvio) 
    VALUES ('Cliente Generico ' + CAST(@j AS NVARCHAR), 'cliente' + CAST(@j AS NVARCHAR) + '@mail.com', '555-0000', 'Direccion Corta');
    SET @j = @j + 1;
END
GO

-- Los clientes completan sus perfiles con direcciones larguísimas (causa expansión de la fila)
UPDATE Clientes
SET DireccionEnvio = REPLICATE('X', 450)
WHERE ClienteId % 3 = 0; 
GO

-- ========================================================================================
-- ESCENARIO 3: TABLA SALUDABLE
-- Tabla: Productos
-- Técnica: Catálogo de productos. Inserciones puramente secuenciales, sin actualizaciones
-- masivas que cambien el tamaño de fila. La fragmentación se mantendrá cerca al 0%.
-- ========================================================================================
CREATE TABLE Productos (
    ProductoId INT IDENTITY(1,1) PRIMARY KEY CLUSTERED,
    CodigoSKU NVARCHAR(50),
    NombreProducto NVARCHAR(150),
    Precio DECIMAL(18,2),
    StockActual INT
);
GO

PRINT 'Poblando Catálogo de Productos (Tabla Saludable)...';
DECLARE @k INT = 0;
WHILE @k < 1000
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

-- ========================================================================================
-- ESCENARIO 4: ÍNDICES INÚTILES (Para probar la sección "Salud de Índices")
-- Tabla: Vendedores
-- Técnica: Creamos un par de índices en una tabla donde frecuentemente registramos
-- asistencias o ventas (puras inserciones) pero NUNCA consultamos por esos campos.
-- ========================================================================================
CREATE TABLE Vendedores (
    VendedorId INT IDENTITY(1,1) PRIMARY KEY CLUSTERED,
    Nombre NVARCHAR(100),
    Region NVARCHAR(50),
    VentasTotales DECIMAL(18,2) DEFAULT 0
);
GO

-- El DBA inexperto creó estos índices pensando que se usarían, pero no es así.
CREATE NONCLUSTERED INDEX IX_Vendedores_Nombre ON Vendedores(Nombre);
CREATE NONCLUSTERED INDEX IX_Vendedores_Region ON Vendedores(Region);

PRINT 'Simulando trabajo de Vendedores (Generando Índices Inútiles)...';
-- Insertamos datos masivos simulando contrataciones y actualizaciones de ventas (pura escritura)
DECLARE @l INT = 0;
WHILE @l < 1000
BEGIN
    INSERT INTO Vendedores (Nombre, Region, VentasTotales) 
    VALUES ('Vendedor ' + CAST(@l AS NVARCHAR), CHOOSE((@l % 3) + 1, 'Norte', 'Sur', 'Centro'), RAND() * 50000);
    SET @l = @l + 1;
END
GO

-- ========================================================================================
-- ESCENARIO 5: ÍNDICES FALTANTES (Missing Indexes)
-- Tabla: Detalle_Pedidos
-- Técnica: Simulamos que los analistas de negocio están haciendo reportes costosos
-- constantemente filtrando por ProductoId y Cantidad, pero el DBA olvidó ponerle un índice.
-- Esto forzará a SQL Server a pedir un Missing Index.
-- ========================================================================================
CREATE TABLE Detalle_Pedidos (
    DetalleId INT IDENTITY(1,1) PRIMARY KEY CLUSTERED,
    PedidoId UNIQUEIDENTIFIER, -- Simula llave foránea
    ProductoId INT,            -- Simula llave foránea
    Cantidad INT,
    PrecioUnitario DECIMAL(18,2)
);
GO

PRINT 'Generando Detalles de Pedidos y simulando reportes lentos (Missing Indexes)...';
DECLARE @m INT = 0;
WHILE @m < 5000
BEGIN
    INSERT INTO Detalle_Pedidos (PedidoId, ProductoId, Cantidad, PrecioUnitario) 
    VALUES (
        NEWID(), 
        ABS(CHECKSUM(NEWID())) % 10000 + 1, 
        ABS(CHECKSUM(NEWID())) % 20 + 1, 
        (RAND() * 500) + 5
    );
    SET @m = @m + 1;
END
GO

-- Limpiar el caché de planes para asegurar que el motor registre el missing index limpiamente
DBCC FREEPROCCACHE;
GO

-- Ejecutar consultas de "Reportes de Ventas" repetidas veces para generar "User Seeks" perdidos
DECLARE @n INT = 0;
WHILE @n < 50
BEGIN
    DECLARE @TotalVendido DECIMAL(18,2);
    -- ¡Reporte pesado sin índice!
    SELECT @TotalVendido = SUM(Cantidad * PrecioUnitario)
    FROM Detalle_Pedidos 
    WHERE ProductoId = 1500 AND Cantidad > 5;
    
    SET @n = @n + 1;
END
GO

-- ========================================================================================
-- FIN DEL SCRIPT.
-- RECOMENDACIÓN FINAL: 
-- 1. Ve a SmartFill > Bases de Datos > Conéctate a "SmartFill_VentasDB"
-- 2. Ve a WhatsApp o a tu dashboard web y corre los comandos:
--    /estado, /optimizar, /indices, /espacio
-- ========================================================================================
PRINT '==========================================================';
PRINT 'Base de datos de ventas "SmartFill_VentasDB" creada con exito.';
PRINT 'Lista para probar TODAS las funciones de SmartFill.';
PRINT '==========================================================';
