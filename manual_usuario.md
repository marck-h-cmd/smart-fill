# Manual de Usuario - Sistema SmartFill

## 1. Introducción

### 1.1. Propósito del Manual
El presente manual tiene como propósito describir el funcionamiento y guiar a los usuarios en la correcta utilización del **Sistema SmartFill**. Este documento detalla cada módulo, interfaz web, funcionalidades de monitoreo de base de datos SQL Server, y el funcionamiento del bot de WhatsApp integrado que permite realizar tareas de mantenimiento mediante comandos y consultas en lenguaje natural.

### 1.2. Alcance del Sistema
El sistema es una herramienta integral de administración y optimización para bases de datos SQL Server. Combina una interfaz gráfica moderna (React) con capacidades de Inteligencia Artificial (modelos Gemini / OpenAI) y un canal de comunicación conversacional (WhatsApp / OpenWA). 

Sus características principales incluyen:
- Monitoreo en tiempo real de la fragmentación de índices y del espacio disponible.
- Generación de recomendaciones inteligentes de *FillFactor* basadas en patrones de actualización y lectura.
- Ejecución manual y programada de planes de reindexación (`REBUILD` y `REORGANIZE`).
- Detección proactiva de salud de índices (identificación de índices redundantes/inútiles y sugerencia de índices faltantes).
- Un chatbot administrador que permite consultar el estado de la base de datos, recibir alertas críticas y ejecutar comandos de mantenimiento desde WhatsApp o desde un simulador integrado.

### 1.3. Audiencia
Este manual está dirigido a:
- Administradores de Bases de Datos (DBAs).
- Personal técnico de TI y Soporte.
- Desarrolladores encargados del mantenimiento de la infraestructura informática.

---

## 2. Acceso al Sistema

### 2.1. Requisitos Previos
Para acceder a la consola web y al servicio del chatbot de SmartFill, se requiere:
1. Un dispositivo con conexión a red local o Internet con acceso al servidor de la aplicación.
2. Un navegador web moderno (Google Chrome, Mozilla Firefox, Microsoft Edge o Safari).
3. Para la integración con WhatsApp, contar con una cuenta activa de WhatsApp en un dispositivo móvil con cámara funcional (para escanear el código QR).
4. El motor SQL Server de destino configurado para permitir conexiones TCP/IP en su respectivo puerto (usualmente `1433`).

### 2.2. Instalación y Puesta en Marcha
Para levantar y desplegar localmente el sistema completo, siga los siguientes pasos:

#### I. Configurar el Backend (Python)
1. Abra una terminal en el directorio del proyecto `backend`.
2. Cree y active un entorno virtual (`venv`):
   - **En Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **En macOS/Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
3. Instale las dependencias del archivo `requirements.txt`:
   ```bash
   pip install -r requirements.txt
   ```
4. Cree y configure el archivo de variables de entorno `.env` en la raíz de `backend` con las claves API requeridas y la URL de la base de datos interna SQLite:
   ```env
   DATABASE_URL=sqlite:///smartfill.db
   SECRET_KEY=dev-secret-key-default
   GEMINI_API_KEY=tu_clave_api_aquí
   ```
5. Inicie el servidor web de desarrollo:
   ```bash
   python run.py
   ```

#### II. Configurar el Frontend (React + Vite)
1. Abra una nueva terminal en el directorio del proyecto `frontend`.
2. Instale los módulos necesarios mediante `pnpm` o `npm`:
   ```bash
   pnpm install
   # o bien: npm install
   ```
3. Inicie el servidor de desarrollo local:
   ```bash
   pnpm run dev
   # o bien: npm run dev
   ```

### 2.3. Acceso a la Interfaz
1. Abra el navegador web e ingrese la URL de la plataforma (por defecto: `http://localhost:5173`).
2. Una vez cargada la página, visualizará de inmediato la interfaz de administración en el tema predeterminado (con la opción de alternar entre modo claro y oscuro desde la barra superior).
3. No se requiere autenticación de manera local por defecto, permitiendo un acceso rápido al Dashboard de control técnico.

---

## 3. Descripción General del Sistema

### 3.1. Pantalla de Inicio (Dashboard)
El panel principal ofrece un resumen ejecutivo y técnico del estado general de la base de datos activa. Proporciona visualizaciones rápidas para que el administrador evalúe la salud del servidor en segundos.

La pantalla de inicio incluye:
- **Tarjetas de KPI**:
  - **Índices Totales**: Cantidad de índices monitoreados.
  - **Fragmentación Promedio**: Porcentaje promedio de fragmentación de los índices de la base de datos.
  - **Índices Críticos**: Número de índices con fragmentación $\ge 30\%$ que requieren una reconstrucción inmediata (`REBUILD`).
  - **Índices Moderados**: Cantidad de índices con fragmentación entre $10\%$ y $30\%$ que requieren reorganización (`REORGANIZE`).
- **Selector de Base de Datos Activa**: Permite cambiar rápidamente entre las conexiones a bases de datos configuradas en el sistema.
- **Gráfico de Tendencias**: Gráfico de líneas que ilustra la evolución histórica de la fragmentación del índice seleccionado para rastrear la degradación a lo largo del tiempo.
- **Lista de Alertas Recientes**: Cuadro de notificaciones que expone problemas urgentes de almacenamiento o índices críticos.

### 3.2. Navegación Principal
La navegación a través de los diferentes módulos del sistema se realiza mediante un menú lateral izquierdo persistente:
- **Dashboard Principal**: Pantalla de inicio con métricas consolidadas.
- **Configuración**: Administración de las credenciales de conexión a las bases de datos.
- **Historial**: Bitácora de las operaciones y métricas recolectadas.
- **Reportes**: Generación de informes exportables en PDF.
- **Mantenimiento**: Programación de tareas automáticas y recomendaciones inteligentes.
- **Monitoreo**: Detalle exhaustivo de fragmentación y archivos de bases de datos.
- **Salud de Índices**: Vista especializada en la detección de índices inútiles y faltantes.
- **Puente OpenWA**: Administrador de sesiones del bot de WhatsApp.
- **Configuración IA**: Ajustes de modelos de lenguaje y claves de API.
- **Chat de Prueba**: Consola para simular conversaciones con el bot de IA.

---

## 4. Módulos del Sistema

A continuación, se describen detalladamente las vistas, ventanas y procedimientos paso a paso para interactuar con cada módulo del sistema web de SmartFill.

### 4.1. Módulo de Configuración de Bases de Datos
Esta ventana permite registrar y gestionar las credenciales de conexión TCP/IP para los servidores de SQL Server que se desean monitorear.

- **Procedimiento para Registrar una Nueva Conexión**:
  1. Haga clic en el botón **Configuración** en el menú de navegación lateral.
  2. En el panel derecho, visualice el formulario "Nueva Conexión". Rellene los siguientes campos:
     - **Nombre de la conexión**: Ingrese un alias descriptivo (ej. `Producción_Ventas`).
     - **Host / Servidor**: Ingrese la dirección IP del servidor o `localhost` si se encuentra en la misma máquina.
     - **Puerto**: Ingrese `1433` (puerto estándar de SQL Server) o el configurado.
     - **Base de Datos**: Escriba el nombre exacto de la base de datos a auditar.
     - **Usuario**: Ingrese la cuenta con permisos (ej. `sa`).
     - **Contraseña**: Ingrese la clave secreta del usuario SQL Server.
     - **Controlador ODBC**: Seleccione o escribe el driver correspondiente (ej. `ODBC Driver 17 for SQL Server`).
  3. Haga clic en el botón azul **Probar Conexión**. El sistema devolverá un mensaje verde si la comunicación es exitosa, o un mensaje detallado de error (firewall, TCP deshabilitado, credenciales inválidas) si falla.
  4. Si la prueba es satisfactoria, haga clic en el botón **Guardar Conexión**. La conexión aparecerá registrada en la tabla inferior.

- **Procedimiento para Activar una Conexión**:
  1. En la tabla "Conexiones Guardadas" (ubicada al final de la vista de Configuración), ubique la base de datos deseada.
  2. Haga clic en el botón verde **Activar** en la columna de acciones. 
  3. El sistema cambiará la base de datos objetivo en el backend de inmediato, actualizando las alertas y los datos del Dashboard.

---

### 4.2. Módulo de Monitoreo
Esta ventana se divide en dos secciones principales: el estado físico de fragmentación de índices y el almacenamiento en disco de los archivos de la base de datos activa.

- **Procedimiento de Inspección y Optimización de Fragmentación**:
  1. Seleccione **Monitoreo** en el menú de navegación lateral.
  2. Observe la tabla de índices en la parte superior. Esta lista muestra:
     - El nombre de la tabla y del índice.
     - El porcentaje de fragmentación física.
     - La recomendación automática (`REBUILD` si fragmentación $\ge 30\%$, `REORGANIZE` si $\ge 10\%$, u `OK`).
  3. Si un índice se encuentra en estado crítico, haga clic en el botón **Optimizar** al extremo derecho de la fila. El sistema ejecutará el comando SQL de mantenimiento y notificará del éxito mediante un banner emergente.

- **Procedimiento para Revisar Espacio de Almacenamiento**:
  1. Desplácese hasta la sección inferior de la vista **Monitoreo**.
  2. Visualice la lista de archivos de base de datos (`.mdf` de datos y `.ldf` de transacciones).
  3. Compruebe las columnas de **Tamaño Total (MB)**, **Espacio Usado (MB)** y **Espacio Libre (MB)**.
  4. Revise el indicador de **Autogrow (Crecimiento Automático)** para asegurar que el sistema no se quede bloqueado por falta de espacio en el disco físico.

---

### 4.3. Módulo de Salud de Índices
Esta ventana expone de forma proactiva problemas estructurales de los índices que impactan negativamente en las lecturas y escrituras del motor SQL Server.

- **Procedimiento para Identificar Índices Inútiles**:
  1. Haga clic en **Salud de Índices** en el menú lateral izquierdo.
  2. Ubique la tarjeta de la izquierda titulada **Índices Inútiles**.
  3. Revise el número total de índices inútiles detectados. Cada registro indica el nombre de la tabla, del índice y la cantidad de escrituras ejecutadas sin haber recibido nunca una sola lectura.
  4. Si decide remover el índice para optimizar la velocidad de escrituras en la tabla, copie el script sugerido (ej. `DROP INDEX index_name ON table_name`) o ejecútelo en su consola de administración.

- **Procedimiento para Agregar Índices Faltantes Recomendados**:
  1. En la misma ventana de **Salud de Índices**, ubique la tarjeta derecha **Índices Faltantes**.
  2. Ordene las recomendaciones según el **Porcentaje de Impacto** (entre mayor impacto, más se acelerarán las consultas de usuario).
  3. Lea las columnas recomendadas de igualdad, desigualdad y las incluidas.
  4. Copie el script sugerido en la caja de código (`CREATE INDEX IX_Auto_Missing_...`) para crearlo en el servidor de base de datos.
  5. *(Opcional)* También puede crear este índice directamente usando el comando del bot `/crear_indice <id>`.

---

### 4.4. Módulo de Mantenimiento y Recomendador de IA
Este módulo controla los parámetros del planificador automático diario y expone la optimización recomendada por la Inteligencia Artificial.

- **Procedimiento para Programar el Mantenimiento Automático**:
  1. Haga clic en **Mantenimiento** en el menú de navegación lateral.
  2. En el panel superior, configure los siguientes campos:
     - **Horario de ejecución diaria**: Ingrese la hora en formato militar (ej. `03:00` para ejecutar en horario no comercial).
     - **Umbral Crítico (REBUILD)**: Porcentaje de fragmentación mínimo para reconstruir índices (ej. `30`).
     - **Umbral Moderado (REORGANIZE)**: Porcentaje mínimo para reorganizar (ej. `10`).
  3. Haga clic en **Guardar Configuración**. El planificador en segundo plano (`APScheduler`) reprogramará el hilo de ejecución automáticamente.

- **Procedimiento para Obtener Recomendación Técnica con Inteligencia Artificial**:
  1. Desplácese a la sección de tablas en la ventana de **Mantenimiento**.
  2. Ubique la tabla que desea analizar.
  3. Haga clic en el botón de **Sugerencia IA / Experto**.
  4. Se abrirá una ventana modal de carga mientras el sistema envía el contexto y los contadores de la DMV a Gemini/OpenAI.
  5. Lea el diagnóstico generado en lenguaje natural por la IA, que justifica detalladamente por qué se recomienda un valor específico de *FillFactor* y la reindexación correspondiente.

---

### 4.5. Módulo de Historial y Reportes
Este módulo centraliza la auditoría de las acciones y permite generar resúmenes de estado.

- **Procedimiento para Auditar Tareas Realizadas**:
  1. Haga clic en **Historial** en el menú lateral.
  2. Visualice la bitácora cronológica de ejecuciones.
  3. Utilice la barra de filtros en la parte superior para buscar por nombre de tabla o filtrar por el emisor (por ejemplo, acciones disparadas por el bot de WhatsApp, manualmente por la web, o por la ejecución programada nocturna).
  4. Haga clic sobre una fila para desplegar el script SQL completo que se aplicó sobre el motor de base de datos.

- **Procedimiento para Generar un Reporte de Desempeño**:
  1. Haga clic en **Reportes** en el menú lateral.
  2. Seleccione la base de datos de origen y defina si desea incluir el reporte de espacio físico, fragmentación o salud de índices.
  3. Haga clic en el botón **Generar Reporte**.
  4. Una vez cargado el documento en pantalla, haga clic en el botón **Exportar PDF** para descargar el reporte a su almacenamiento local.

---

### 4.6. Módulo del Bot de WhatsApp (Puente OpenWA)
Este panel administra el ciclo de vida del canal de comunicación del chatbot.

- **Procedimiento para Conectar el Bot de WhatsApp**:
  1. Haga clic en **Puente OpenWA** en el menú lateral.
  2. En el campo "Nombre de Sesión", escriba un identificador único (ej. `db_bot`) y haga clic en **Crear Sesión**.
  3. Una vez listada en la tabla de sesiones, haga clic en el botón **Iniciar Sesión**.
  4. En la parte derecha, aparecerá un recuadro con un código QR dinámico.
  5. En su teléfono móvil con WhatsApp, vaya a **Ajustes > Dispositivos Vinculados** y seleccione **Vincular un dispositivo**.
  6. Escanee el código QR de la pantalla web con la cámara del celular.
  7. Espere unos segundos hasta que la sesión cambie a estado **Conectada** en la interfaz de SmartFill.
  8. Seleccione la sesión y haga clic en **Activar como Bot de Respuestas**.

- **Procedimiento para Autorizar al Administrador**:
  1. En la misma ventana de **Puente OpenWA**, busque la sección "Parámetros del Administrador".
  2. En el campo **Teléfono del Administrador**, ingrese su número de teléfono celular con el código de país (ej. `5491122334455`). El bot solo obedecerá comandos provenientes de este número.
  3. En el campo **Alias del Bot**, configure el nombre de invocación (ej. `@BotSmartfill`).
  4. Haga clic en **Guardar Configuración**.

---

### 4.7. Configuración de IA y Simulador (Chat de Prueba)
Este módulo permite parametrizar el cerebro del asistente y probarlo en un entorno aislado sin costos de red móvil.

- **Procedimiento para Configurar el Proveedor de Inteligencia Artificial**:
  1. Haga clic en **Configuración IA** en el menú lateral.
  2. Seleccione el proveedor de IA deseado (ej. `Gemini` o `OpenAI`).
  3. Escriba o pegue su **API Key** privada en el campo correspondiente.
  4. Ingrese el modelo específico (ej. `gemini-1.5-flash` o `gpt-4o`).
  5. Haga clic en **Guardar**.

- **Procedimiento para Simular Conversaciones**:
  1. Haga clic en **Chat de Prueba** en el menú lateral.
  2. En la parte inferior de la ventana, visualice el campo de texto del chat.
  3. Ingrese un comando rápido de mantenimiento, como `/estado`, `/indices` o `/espacio`, y presione Enter.
  4. Verifique la rapidez y el formato de respuesta simulada del bot.
  5. Escriba una consulta técnica libre en lenguaje natural, como *"@BotSmartfill ¿hay algún índice con mucha fragmentación que requiera atención urgente?"* para probar el comportamiento de análisis contextual de la IA.

---

---

## 5. El Chatbot de WhatsApp (Guía de Comandos)

Cuando la sesión de WhatsApp está vinculada y el alias configurado, el usuario autorizado puede controlar el servidor enviando mensajes directos.

### 5.1. Ejecución de Comandos Estructurados
El bot procesa comandos tradicionales que inician con `/` para ofrecer respuestas rápidas y de bajo consumo de tokens:

- **`/estado`**:
  - **Descripción**: Muestra el TOP 5 de las tablas más fragmentadas, su porcentaje de fragmentación actual y la acción sugerida.
- **`/recomendar [nombre_tabla]`**:
  - **Descripción**: Sugiere el *FillFactor* óptimo y la acción a tomar. Si no se especifica una tabla, arroja las recomendaciones de las tablas con fragmentación crítica del sistema.
- **`/optimizar [nombre_tabla]`**:
  - **Descripción**: Si se especifica una tabla, ejecuta el proceso de mantenimiento (`REBUILD` o `REORGANIZE`) sobre ella. Si se escribe `/optimizar` sin parámetros, el sistema ejecuta la optimización masiva de todas las tablas que requieran mantenimiento en la base de datos (límite de 50).
- **`/indices`**:
  - **Descripción**: Devuelve un informe con el conteo de índices inútiles e índices faltantes, mostrando el ID (`group_handle`) para permitir su creación rápida.
- **`/crear_indice <id>`**:
  - **Descripción**: Toma el ID proporcionado por el comando `/indices` y ejecuta el script `CREATE INDEX` recomendado por SQL Server.
- **`/espacio`**:
  - **Descripción**: Retorna un desglose de los archivos de la base de datos activa, detallando espacio total, usado, libre, porcentaje de uso y límites de crecimiento físico.
- **`/conexiones`**:
  - **Descripción**: Muestra la cantidad de conexiones activas en la base de datos, detalladas por estado (`Sleeping`, `Running`, `Runnable`, etc.).
- **`/historial`**:
  - **Descripción**: Retorna la lista de las últimas mediciones de fragmentación e índice de uso registradas en la base de datos.
- **`/alertas`**:
  - **Descripción**: Muestra los umbrales de fragmentación crítica y alerta configurados y el horario programado de mantenimiento diario.
- **`/alertar`**:
  - **Descripción**: Dispara una auditoría manual completa sobre la base de datos y notifica inmediatamente si se superan los límites saludables de fragmentación o espacio en disco.

### 5.2. Consultas en Lenguaje Natural
Además de comandos rápidos, al mencionar al bot con su alias (ej. `@BotSmartfill ¿hay problemas de almacenamiento?`), la IA procesará la pregunta, recopilará el contexto de las DMV del servidor y responderá detalladamente en español:

- **Ejemplo de consulta**: *"@BotSmartfill Revisa las tablas y optimiza la que esté peor"*
- **Respuesta de la IA**: El bot identificará cuál es la tabla con mayor fragmentación y ejecutará la optimización correspondiente, reportando el éxito de la operación.

---

## 6. Glosario de Términos

- **DBA (Database Administrator)**: Administrador de bases de datos. Profesional de TI responsable de la seguridad, integridad, rendimiento y mantenimiento de las bases de datos.
- **DMV (Dynamic Management Views)**: Vistas y funciones integradas en SQL Server que devuelven información sobre el estado del servidor para monitorear la salud y diagnosticar el rendimiento.
- **Fragmentación**: Degradación física del almacenamiento de los índices que ocurre cuando las páginas de datos no están ordenadas secuencialmente, causando lecturas de disco ineficientes.
- **REBUILD (Reconstrucción)**: Proceso físico que recrea un índice desde cero, eliminando por completo la fragmentación y aplicando el *FillFactor* especificado.
- **REORGANIZE (Reorganización)**: Proceso más liviano que limpia las páginas del índice y compacta los datos sin bloquear las tablas ni ocupar recursos excesivos del servidor.
- **FillFactor (Factor de Llenado)**: Configuración que determina el porcentaje de espacio libre que se dejará en cada página de índice durante la reconstrucción, para permitir futuras inserciones sin causar divisiones de página.
- **OpenWA**: Biblioteca o API que permite automatizar y controlar de forma programada una instancia del cliente web de WhatsApp.
- **Autogrow (Crecimiento Automático)**: Característica de SQL Server que permite que los archivos de base de datos aumenten de tamaño automáticamente en el disco duro cuando se agota el espacio inicial asignado.
