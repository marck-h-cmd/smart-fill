CREATE DATABASE SmartFillTest;
GO
USE SmartFillTest;
GO

-- Creamos una tabla que se fragmentará a propósito muy rápido
-- (Usar un UNIQUEIDENTIFIER como clave primaria clusterizada causa fragmentación brutal por los Page Splits)
CREATE TABLE Ventas (
    Id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY CLUSTERED,
    Monto DECIMAL(10,2),
    Fecha DATETIME DEFAULT GETDATE(),
    Comentarios VARCHAR(500)
);
GO

-- Insertamos 20,000 registros desordenados para forzar la fragmentación
SET NOCOUNT ON;
DECLARE @i INT = 0;
WHILE @i < 20000
BEGIN
    INSERT INTO Ventas (Monto, Comentarios) 
    VALUES (RAND() * 1000, REPLICATE('A', CAST(RAND() * 400 AS INT)));
    SET @i = @i + 1;
END
GO
