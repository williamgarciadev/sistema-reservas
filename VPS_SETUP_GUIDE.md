# Guía de Configuración de VPS para reserva.wgsoft.com.co

Esta guía detalla todos los pasos necesarios para configurar tu VPS con IP `173.249.49.68` para alojar la aplicación en `reserva.wgsoft.com.co`.

## Requisitos Previos

- VPS con IP: `173.249.49.68`
- Sistema operativo: Ubuntu 22.04+ (recomendado)
- Acceso SSH como root
- Dominios: `reserva.wgsoft.com.co` y `api.reserva.wgsoft.com.co` apuntando a `173.249.49.68`

## Paso 1: Configurar el Servidor VPS

### 1.1 Conectar al servidor

```bash
ssh root@173.249.49.68
```

### 1.2 Configurar el firewall (UFW)

```bash
# Permitir SSH
ufw allow 22/tcp

# Permitir HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Habilitar firewall
ufw --force enable

# Verificar estado
ufw status verbose
```

### 1.3 Instalar Docker

```bash
# Instalar Docker usando el script oficial
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Verificar instalación
docker --version
docker compose version

# Configurar Docker daemon
mkdir -p /etc/docker
cat > /etc/docker/daemon.json << 'EOF'
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "live-restore": true
}
EOF

# Reiniciar Docker
systemctl restart docker
systemctl enable docker
```

### 1.4 Crear usuario deploy

```bash
# Crear usuario deploy
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
echo "deploy ALL=(ALL) NOPASSWD:ALL" | tee -a /etc/sudoers

# Agregar usuario deploy al grupo docker
usermod -aG docker deploy
```

### 1.5 Configurar estructura de proyecto

```bash
# Cambiarse al usuario deploy
sudo -iu deploy

# Crear directorio del proyecto
mkdir -p ~/sistema-reservas
cd ~/sistema-reservas

# Crear subdirectorios
mkdir -p traefik/dynamic
mkdir -p traefik/logs
mkdir -p backups
mkdir -p scripts

# Crear directorio para logs de Traefik
sudo mkdir -p /var/log/traefik
sudo chown deploy:deploy /var/log/traefik
```

## Paso 2: Configurar GitHub Secrets

Accede a la configuración de tu repositorio en GitHub:
https://github.com/williamgarciadev/sistema-reservas/settings/secrets/actions/new

Agrega los siguientes secrets:

### VPS Access

- `VPS_HOST`: `173.249.49.68`
- `VPS_USER`: `deploy`
- `VPS_SSH_PRIVATE_KEY`: (contenido de tu clave SSH privada)
- `VPS_PORT`: `22`

### Production

- `PRODUCTION_DOMAIN`: `reserva.wgsoft.com.co`
- `API_DOMAIN`: `api.reserva.wgsoft.com.co`
- `PROD_DB_USER`: `postgres`
- `PROD_DB_PASSWORD`: (contraseña segura generada con `openssl rand -base64 32`)
- `PROD_DB_NAME`: `sistema_reservas`
- `JWT_SECRET`: (generar con `openssl rand -base64 48`)
- `JWT_REFRESH_SECRET`: (generar con `openssl rand -base64 48`)
- `ACME_EMAIL`: `contacto@wgsoft.com.co`
- `PRODUCTION_API_URL`: `https://api.reserva.wgsoft.com.co/api`

## Paso 3: Configurar DNS

Asegúrate de tener los siguientes registros DNS apuntando a `173.249.49.68`:

```
A    reserva.wgsoft.com.co          -> 173.249.49.68
A    api.reserva.wgsoft.com.co      -> 173.249.49.68
A    traefik.reserva.wgsoft.com.co  -> 173.249.49.68 (opcional)
```

## Paso 4: Preparar Variables de Entorno en la VPS

Conéctate a tu VPS como usuario `deploy`:

```bash
ssh deploy@173.249.49.68
```

Crea el archivo de variables seguras:

```bash
nano ~/sistema-reservas/.env.secure
```

Agrega tus variables sensibles:

```env
# Database
DB_PASSWORD=tu_contraseña_segura_aqui

# JWT Secrets
JWT_SECRET=tu_clave_jwt_segura
JWT_REFRESH_SECRET=tu_clave_refresh_segura

# Servicios externos (según necesites)
RESEND_API_KEY=tu_clave_resend
STRIPE_SECRET_KEY=tu_clave_stripe
```

## Paso 5: Desplegar la Aplicación

Una vez que hayas completado los pasos anteriores, puedes desplegar la aplicación usando el workflow de GitHub Actions o manualmente.

### Opción A: GitHub Actions (recomendado)

1. Ve a la pestaña "Actions" en tu repositorio de GitHub
2. Selecciona "CD - Deploy to VPS"
3. Haz clic en "Run workflow"
4. Selecciona "production" como entorno
5. Haz clic en "Run workflow"

### Opción B: Despliegue manual

Si prefieres desplegar manualmente, copia los archivos del repositorio a la VPS y ejecuta:

```bash
cd ~/sistema-reservas

# Construir imágenes locales
docker compose -f docker-compose.prod.yml build --parallel

# Iniciar servicios
docker compose -f docker-compose.prod.yml up -d

# Ejecutar migraciones de Prisma
docker exec sistema-reservas-backend npx prisma migrate deploy
```

## Paso 6: Verificar el Despliegue

Después del despliegue, verifica que todo esté funcionando:

```bash
# Verificar estado de contenedores
docker compose -f ~/sistema-reservas/docker-compose.prod.yml ps

# Verificar logs del backend
docker logs sistema-reservas-backend

# Verificar logs del frontend
docker logs sistema-reservas-frontend

# Verificar logs del proxy
docker logs sistema-reservas-proxy
```

## Verificación Final

Una vez completado el despliegue, deberías poder acceder a:

- Frontend: https://reserva.wgsoft.com.co
- Backend/API: https://api.reserva.wgsoft.com.co
- Health check frontend: https://reserva.wgsoft.com.co/health
- Health check backend: https://api.reserva.wgsoft.com.co/health

## Scripts Disponibles

Los siguientes scripts están disponibles en la VPS en `~/sistema-reservas/scripts/`:

- `health-check.sh` - Verificación del estado del sistema
- `backup-db.sh` - Backup de la base de datos
- `restore-db.sh` - Restauración de la base de datos
- `deploy-manual.sh` - Despliegue manual alternativo

## Solución de Problemas

### Si el dominio no responde

1. Verifica que los registros DNS estén correctamente configurados
2. Verifica que los puertos 80 y 443 estén abiertos en el firewall
3. Verifica el estado de los contenedores con `docker compose ps`

### Si no se generan certificados SSL

1. Verifica que Traefik tenga acceso al puerto 80 para el desafío HTTP
2. Verifica los logs de Traefik con `docker logs sistema-reservas-proxy`
3. Verifica que los dominios apunten correctamente a la IP del servidor

### Si hay problemas con la base de datos

1. Verifica que el contenedor PostgreSQL esté corriendo y saludable:
   ```bash
   docker inspect sistema-reservas-db | grep -A 10 Health
   ```
2. Verifica la conexión desde el backend:
   ```bash
   docker exec sistema-reservas-backend ping sistema-reservas-db
   ```

¡Tu aplicación debería estar disponible en https://reserva.wgsoft.com.co cuando completes todos los pasos!
