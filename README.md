# SmartFill - Sistema de Administración de Base de Datos y Asistente Agéntico

SmartFill es una plataforma avanzada diseñada para la **monitorización, optimización y administración proactiva** de bases de datos SQL Server. Combina un Dashboard interactivo con herramientas de inteligencia artificial (IA Agéntica) para automatizar el mantenimiento de índices, analizar datos en tiempo real y emitir reportes ejecutivos.

## 🚀 Características Principales

* **Dashboard Analítico**: Visualización en tiempo real de métricas críticas de bases de datos, incluyendo mapas de calor (HeatMaps) y gráficos de tendencia de fragmentación de índices y `FillFactor`.
* **IA Agéntica (Chat Test)**: Un asistente inteligente integrado (soportado por modelos como Gemini, Claude, Llama a través de `litellm`) capaz de razonar, escribir y ejecutar consultas SQL de forma autónoma utilizando *Function Calling*, ofreciendo respuestas renderizadas en Markdown de forma fluida (Server-Sent Events).
* **Mantenimiento Automatizado**: Panel para configurar ventanas de mantenimiento automático, umbrales de fragmentación crítica (ej. ≥30%) y reestructuración de índices.
* **Puente OpenWA**: Módulo integrado para la comunicación y notificaciones vía WhatsApp con soporte multicountry (a través de `open-wa`).
* **Arquitectura Moderna**:
  * **Frontend**: React + Vite, Tailwind CSS, diseño responsivo, Dark/Light Mode, estructura modular limpia.
  * **Backend**: Python (Flask) con soporte asíncrono y streaming SSE, conexión directa con SQL Server.

## 🛠️ Tecnologías Utilizadas

* **Frontend**: React, Vite, Tailwind CSS, Lucide React, Axios, Streamdown (renderizado de Markdown en tiempo real).
* **Backend**: Python 3.12, Flask, LiteLLM (LLM Routing), PyODBC (Driver SQL Server).
* **Base de Datos**: Microsoft SQL Server (Compatible con contenedores Docker, incluye base de datos de prueba *Northwind*).
* **Control de Versiones**: Git & GitHub.

## 📁 Estructura del Proyecto

El proyecto está diseñado siguiendo buenas prácticas de separación de responsabilidades:

```text
smart-fill/
├── backend/                  # API RESTful en Python (Flask)
│   ├── app/
│   │   ├── api/routes/       # Endpoints de la API (WhatsApp, IA, SQL, etc.)
│   │   └── services/         # Servicios CORE (ai_service.py con Tool Calling)
│   └── requirements.txt
├── frontend/                 # Aplicación SPA en React (Vite)
│   └── src/
│       ├── components/       # Componentes reusables (Layout, Chat, Dashboard)
│       ├── constants/        # Variables estáticas (Paises, configs)
│       ├── pages/            # Vistas principales separadas de forma modular
│       └── services/         # Clientes de API y WebSockets
└── database/                 # Scripts SQL (Northwind.sql)
```

## ⚙️ Instalación y Configuración Local

### Prerrequisitos
* **Node.js**: v18 o superior y `npm` / `pnpm`
* **Python**: 3.10 o superior (recomendado 3.12)
* **SQL Server**: Instancia local o remota de Microsoft SQL Server (2017+)
* **Git**: Para clonar los repositorios

---

### 1. Configuración de la Base de Datos (SQL Server)
Ejecute el script de demostración `SmartFill_DemoDB.sql` en SQL Server Management Studio (SSMS) o mediante `sqlcmd` para crear la base de datos de pruebas con escenarios de fragmentación e índices:
```bash
sqlcmd -S localhost -U SA -P 'TuPasswordFuerte' -i SmartFill_DemoDB.sql
```

---

### 2. Configuración del Backend (Python / Flask)
Navegue a la carpeta `backend`, cree el entorno virtual e instale las dependencias:
```bash
cd backend
python -m venv venv

# En Windows:
.\venv\Scripts\activate
# En Linux/macOS:
# source venv/bin/activate

pip install -r requirements.txt
```

Cree un archivo `.env` dentro de la carpeta `backend/` con la siguiente configuración:
```env
DATABASE_URL="mssql+pyodbc:///?odbc_connect=DRIVER={ODBC Driver 17 for SQL Server};SERVER=localhost;DATABASE=SmartFillDB;UID=SA;PWD=TuPassword;Encrypt=no"
SECRET_KEY=tu_clave_secreta
GEMINI_API_KEY=tu_api_key_gemini
WA_API_URL=http://localhost:2785
WA_WEBHOOK_URL=http://localhost:5000/api/whatsapp/webhook
```

Inicie el servidor Flask:
```bash
python run.py
```

---

### 3. Configuración del Frontend (React / Vite)
En una nueva terminal, instale las dependencias del frontend e inicie el servidor de desarrollo:
```bash
cd frontend
npm install
# o con pnpm: pnpm install

npm run dev
# o con pnpm: pnpm run dev
```
La aplicación web estará disponible en `http://localhost:5173`.

---

### 4. Configuración del Servidor WhatsApp (OpenWA)
Para habilitar el chatbot y la recepción de alertas automáticas vía WhatsApp:

1. **Clonar e instalar OpenWA**:
   ```bash
   git clone https://github.com/rmyndharis/OpenWA.git
   cd OpenWA
   npm install
   ```

2. **Configurar el archivo `.env` en OpenWA**:
   Cree o modifique el archivo `.env` en la raíz de `OpenWA`:
   ```env
   PORT=2785
   WEBHOOK_URL=http://localhost:5000/api/whatsapp/webhook
   ```

3. **Iniciar OpenWA**:
   ```bash
   npm run dev
   ```

4. **Autenticación en el Dashboard de OpenWA**:
   * Al iniciar OpenWA, la consola imprimirá un **Secret Token** (Token de Acceso).
   * Abra su navegador en `http://localhost:2886`.
   * Ingrese el Secret Token para iniciar sesión en la consola de OpenWA.
   * Cree una nueva sesión de WhatsApp y escanee el código QR generado con la cámara de su celular (*WhatsApp > Dispositivos vinculados*).

---

### 5. Inicio Rápido Automático (Windows)
Para levantar el Backend y Frontend de SmartFill simultáneamente con un solo clic, ejecute el script en la raíz del proyecto:
```cmd
start.bat
```

## 🧠 Flujo de Trabajo del Agente IA (AI_Service)
El módulo de inteligencia artificial no es un simple bot conversacional; es un **Agente Reactivo**.
1. **Razonamiento**: Evalúa el prompt del usuario en la base de datos seleccionada.
2. **Uso de Herramientas (Tool Calling)**: Si necesita extraer información, el modelo emite un comando `<function=ejecutar_sql_lectura>`.
3. **Intercepción y Ejecución**: El backend intercepta el comando, ejecuta la query segura en SQL Server, e inyecta el resultado de nuevo al prompt de la IA.
4. **Streaming Final**: La IA formula una conclusión en base a la data real y la transfiere al frontend por *Server-Sent Events* (SSE).

## 📄 Licencia y Autores
Este proyecto fue desarrollado como parte del Proyecto Final del ciclo VII de Administración de Bases de Datos. 
