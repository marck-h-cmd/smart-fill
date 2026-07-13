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
* Node.js v18+ y pnpm
* Python 3.12+ (recomendado `pyenv`)
* Contenedor de SQL Server corriendo localmente (Docker)

### 1. Levantar la Base de Datos
Asegúrate de que tu contenedor de SQL Server esté ejecutándose e inyecta la base de datos de prueba:
```bash
# Ejemplo usando sqlcmd dentro del contenedor
/opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P 'TuPasswordFuerte' -i northwind.sql
```

### 2. Configuración del Backend (Python)
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
Configura tu archivo `.env` con tus claves de IA:
```env
OPENAI_API_KEY=tu_clave
GROQ_API_KEY=tu_clave
TRANSFORMERS_OFFLINE=1
LITELLM_TELEMETRY=False
```
Inicia el servidor de Flask:
```bash
python run.py
```

### 3. Configuración del Frontend (React/Vite)
```bash
cd frontend
pnpm install
pnpm run dev
```

## 🧠 Flujo de Trabajo del Agente IA (AI_Service)
El módulo de inteligencia artificial no es un simple bot conversacional; es un **Agente Reactivo**.
1. **Razonamiento**: Evalúa el prompt del usuario en la base de datos seleccionada.
2. **Uso de Herramientas (Tool Calling)**: Si necesita extraer información, el modelo emite un comando `<function=ejecutar_sql_lectura>`.
3. **Intercepción y Ejecución**: El backend intercepta el comando, ejecuta la query segura en SQL Server, e inyecta el resultado de nuevo al prompt de la IA.
4. **Streaming Final**: La IA formula una conclusión en base a la data real y la transfiere al frontend por *Server-Sent Events* (SSE).

## 📄 Licencia y Autores
Este proyecto fue desarrollado como parte del Proyecto Final del ciclo VII de Administración de Bases de Datos. 
