# Arquitectura del Proyecto SmartFill (Cliente-Servidor)

El proyecto **SmartFill** está dividido en dos grandes ecosistemas (Backend y Frontend) siguiendo las mejores prácticas de separación de responsabilidades (Arquitectura Cliente-Servidor).

## 📁 Directorio Raíz (`C:\...\smart-fill\`)
Aquí se encuentran los cimientos del proyecto y las utilidades generales.

* **`backend/`**: Contiene todo el "cerebro" del sistema (Python, Flask, IA, conexión a SQL Server).
* **`frontend/`**: Contiene el código de la aplicación web visual (React, Vite, Tailwind CSS).
* **`SmartFill_DemoDB.sql`**: Script en SQL para desplegar la base de datos de prueba con los diferentes niveles de fragmentación e índices inútiles.
* **`start.bat`**: Script autoejecutable que levanta tanto el Backend como el Frontend y los servicios de red con un solo clic.
* **`manual_usuario.md`** y **`README.md`**: Documentación central del sistema.
* **`docker-compose.yml`**: Configuración para desplegar el ecosistema mediante contenedores (Docker).

---

## 🧠 1. El Backend (`/backend/`)
Desarrollado en **Python 3 con Flask**, utiliza una **Arquitectura en Capas** (Rutas -> Servicios -> Modelos).

* **`run.py`**: El archivo principal que inicializa y enciende el servidor.
* **`init_mock_db.py` / `init_db.py`**: Scripts que se encargan de crear las tablas internas la primera vez que se ejecuta el proyecto.
* **`.env`**: Archivo (oculto) de variables de entorno donde se guarda la cadena de conexión real a SQL Server. En tu caso particular, SmartFill está utilizando una base de datos propia en SQL Server llamada **`SmartFillDB`** para almacenar las configuraciones de la web, la sesión del bot y el historial (en lugar del SQLite por defecto).

### Dentro del corazón del backend (`/backend/app/`):
* 📂 **`api/routes/`**: Son los controladores (Endpoints REST). Aquí llega la petición de la web o de WhatsApp.
  * *Ejemplo:* `whatsapp.py` (recibe los mensajes), `dashboard.py` (envía los datos a los gráficos web), `monitoring.py` (ejecuta diagnósticos).
* 📂 **`services/`**: Es la capa más pesada. Contiene la "Lógica de Negocio".
  * *Ejemplo:* `ai_service.py` (conexión con Gemini/OpenAI), `fragmentation_service.py` (consultas crudas a SQL Server para leer métricas), `optimization_service.py` (ejecuta los REBUILD), `trend_service.py` (calcula el historial evolutivo).
* 📂 **`models/`**: Definen la estructura de la base de datos interna con SQLAlchemy (ej. `Configuracion`, `TablaMetricas`, `DatabaseConnection`).
* 📂 **`jobs/`**: Contiene las tareas automáticas en segundo plano (como `alert_job.py` que se levanta de madrugada para revisar si la BD está sana y mandar alertas por WhatsApp).

---

## 💻 2. El Frontend (`/frontend/`)
Desarrollado con **React, Vite y Tailwind CSS**, es una SPA (Single Page Application) enfocada en ser ultra rápida y tener una estética premium.

* **`vite.config.js`**: Configuración del motor Vite que hace que la web cargue casi instantáneamente.
* **`tailwind.config.js`**: Configura las reglas de diseño, los colores de la marca (brand, surface, border) y tipografías.
* **`package.json`**: Administra todas las librerías de interfaz gráfica instaladas (como Chart.js para los gráficos, Lucide-react para los íconos).

### Dentro del código fuente visual (`/frontend/src/`):
* 📄 **`App.jsx`**: Es el enrutador. Decide qué pantalla mostrar dependiendo de si entras a `/dashboard`, `/historial`, `/configuracion`, etc.
* 📄 **`index.css`**: Contiene las variables globales de color (glassmorfismo, dark mode) y animaciones personalizadas.
* 📂 **`pages/`**: Cada archivo es una pantalla completa del sistema.
  * *Ejemplo:* `DashboardPage.jsx`, `HistoryPage.jsx`, `ConfigurationPage.jsx`.
* 📂 **`components/`**: Los bloques de lego reutilizables con los que se arman las pantallas. Están organizados por contexto:
  * `dashboard/`: Componentes como `HeatMap.jsx`, `TrendChart.jsx` o las tarjetas numéricas (`KPICard.jsx`).
  * `chat/`: Toda la interfaz del simulador del chatbot que aparece en la barra lateral web.
  * `layout/`: Componentes estructurales (menú lateral, barra superior de navegación).
* 📂 **`services/`**: Archivos puente que hacen las peticiones web (`fetch` o `axios`) hacia los endpoints del `/backend/api/...` para traer los datos y pintarlos en los componentes.
