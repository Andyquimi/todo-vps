# Guía: VPS gratuito sin tarjeta con Azure for Students

## 1. Activar Azure for Students

1. Ve a https://azure.microsoft.com/es-es/free/students/
2. Clic en "Activar ahora" / "Start free".
3. Inicia sesión (o crea) una cuenta Microsoft personal.
4. Cuando pida verificación académica, elige **"Correo institucional"** e ingresa tu
   correo de UPSE (ej. `tu_usuario@upse.edu.ec`). Si UPSE no aparece en el listado de
   instituciones reconocidas automáticamente, sube tu carnet estudiantil o usa el
   formulario alternativo de verificación manual (SheerID) — no pedirá tarjeta.
5. Confirma el correo desde tu bandeja de UPSE.
6. Al activarse verás $100 USD de crédito válidos 12 meses, sin tarjeta registrada.

> Si tu correo no es aceptado, como alternativa puedes usar **GitHub Student Developer
> Pack** (github.com/education/students) con tu mismo correo institucional, que también
> desbloquea créditos de Azure/DigitalOcean sin tarjeta.

## 2. Crear la máquina virtual (VM)

1. En el portal de Azure, busca **"Máquinas virtuales"** → **Crear** → **Máquina virtual de Azure**.
2. Configuración recomendada:
   - **Imagen:** Ubuntu Server 22.04 LTS
   - **Tamaño:** `Standard_B1s` (1 vCPU, 1 GiB RAM) — incluido en el tier gratuito
   - **Autenticación:** clave SSH pública (genera un par nuevo o sube tu clave pública)
   - **Puertos de entrada:** permite solo SSH (22) por ahora
3. Crea el recurso. Azure te dará una **IP pública** — anótala, la usarás en todo el TP.
4. Guarda el archivo `.pem`/clave privada que descargues; la necesitarás para conectarte
   y también la usarás (o generarás otra específica) para el secreto `VPS_SSH_KEY` de
   GitHub Actions.

## 3. Conexión inicial y hardening básico

```bash
ssh -i tu-clave.pem azureuser@IP_PUBLICA

# Actualizar el sistema
sudo apt update && sudo apt upgrade -y

# Crear un usuario de despliegue dedicado (no usar root para el CI/CD)
sudo adduser deploy
sudo usermod -aG sudo deploy

# Copiar tu clave pública al nuevo usuario para que el pipeline se conecte con él
sudo mkdir -p /home/deploy/.ssh
sudo cp ~/.ssh/authorized_keys /home/deploy/.ssh/
sudo chown -R deploy:deploy /home/deploy/.ssh
sudo chmod 700 /home/deploy/.ssh && sudo chmod 600 /home/deploy/.ssh/authorized_keys
```

### Firewall (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

### Fail2ban (protección contra fuerza bruta SSH)

```bash
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
```

### Deshabilitar login por contraseña (solo SSH con clave)

Editar `/etc/ssh/sshd_config`:
```
PasswordAuthentication no
PermitRootLogin no
```
```bash
sudo systemctl restart ssh
```

## 4. Instalar el stack (Nginx, Node.js, PostgreSQL)

```bash
# Nginx
sudo apt install -y nginx

# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
```

### Configurar la base de datos

```bash
sudo -u postgres psql
```
```sql
CREATE USER todo_user WITH PASSWORD 'una_clave_fuerte_aqui';
CREATE DATABASE todo_db OWNER todo_user;
\q
```
Luego carga el esquema:
```bash
psql -U todo_user -h localhost -d todo_db -f deploy/schema.sql
```

## 5. Primer despliegue manual (antes de automatizar)

```bash
sudo mkdir -p /var/www/todo-app
sudo chown deploy:deploy /var/www/todo-app
# Copia el proyecto (o clónalo con git clone) a /var/www/todo-app
cd /var/www/todo-app/backend
cp .env.example .env
nano .env   # completa DB_USER, DB_PASSWORD, DB_NAME
npm install --omit=dev

sudo cp ../deploy/todo-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now todo-api
sudo journalctl -u todo-api -f   # revisar que arrancó bien
```

### Configurar Nginx

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/todo-app
sudo ln -s /etc/nginx/sites-available/todo-app /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Ya deberías poder abrir `http://IP_PUBLICA` desde cualquier dispositivo o red.

## 6. Configurar los "secrets" del repositorio para CI/CD

En GitHub → tu repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Nombre | Valor |
|---|---|
| `VPS_HOST` | IP pública del VM de Azure |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Contenido de la clave **privada** SSH (la pareja de la que autorizaste en `authorized_keys` del usuario `deploy`) |

Con esto, cada `git push` a `main` disparará `.github/workflows/deploy.yml`, que sincroniza
por `rsync` y reinicia el servicio automáticamente — sin intervención manual.

## 7. Respaldos automáticos

```bash
sudo mkdir -p /var/log/todo-api
chmod +x deploy/backup.sh
sudo crontab -e
# agregar:
0 3 * * * /var/www/todo-app/deploy/backup.sh >> /var/log/todo-api/backup.log 2>&1
```

Esto respalda `todo_db` todas las noches a las 3 a.m., comprimido, y borra respaldos con
más de 7 días. Para cumplir la estrategia 3-2-1 completa, copia periódicamente
`/var/backups/todo-db` a un almacenamiento externo (OneDrive/Azure Blob con `rclone`,
o simplemente descarga manual semanal).

## 8. Verificar accesibilidad pública

Desde otra red (datos móviles, otra casa, etc.) abre `http://IP_PUBLICA` — si carga la
lista de tareas, el sitio ya es accesible desde cualquier dispositivo o red, sin
depender de que tu computadora esté encendida.
