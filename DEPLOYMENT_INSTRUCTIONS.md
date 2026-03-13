# Instrucciones de Despliegue para reserva.wgsoft.com.co

Este documento describe cómo desplegar la aplicación en tu VPS con el dominio `reserva.wgsoft.com.co`.

## Requisitos Previos

1. Una VPS con Ubuntu 22.04+ (recomendado)
2. Acceso SSH a la VPS
3. Dominios `reserva.wgsoft.com.co` y `api.reserva.wgsoft.com.co` apuntando a la IP de tu VPS
4. Clave SSH privada local para conexiones a la VPS

## Pasos para el Despliegue

### 1. Configuración Inicial de la VPS

Primero, configura tu VPS con los requisitos necesarios:

```bash
./setup-vps.sh --vps-host TU_IP_VPS --vps-user root
```

Esto:

- Actualiza el sistema
- Crea un usuario `deploy`
- Instala Docker
- Configura firewall
- Configura Fail2Ban
- Prepara la estructura de directorios

### 2. Preparar Variables de Entorno Seguras

Antes de desplegar, debes crear un archivo `.env.secure` en la VPS con tus variables de entorno sensibles:

Conéctate a tu VPS como usuario `deploy`:

```bash
ssh deploy@TU_IP_VPS
```

Crea el archivo de variables seguras:

```bash
nano ~/sistema-reservas/.env.secure
```

Agrega tus variables sensibles:

```env
# Database
DB_PASSWORD=tu_contraseña_segura_aqui

# JWT Secrets (genera claves fuertes con: openssl rand -base64 48)
JWT_SECRET=tu_clave_jwt_segura
JWT_REFRESH_SECRET=tu_clave_refresh_segura

# Servicios externos (según necesites)
RESEND_API_KEY=tu_clave_resend
STRIPE_SECRET_KEY=tu_clave_stripe
```

### 3. Desplegar la Aplicación

Una vez que la VPS esté configurada y tengas tus variables de entorno seguras, puedes desplegar la aplicación:

```bash
./deploy-vps.sh --vps-host TU_IP_VPS --vps-user deploy --domain reserva.wgsoft.com.co
```

### 4. Verificar el Despliegue

Después del despliegue, verifica que todo esté funcionando:

```bash
# Verificar estado de contenedores
ssh deploy@TU_IP_VPS "cd ~/sistema-reservas && docker compose -f docker-compose.prod.yml ps"

# Verificar logs del backend
ssh deploy@TU_IP_VPS "docker logs sistema-reservas-backend"

# Verificar logs del frontend
ssh deploy@TU_IP_VPS "docker logs sistema-reservas-frontend"

# Verificar logs del proxy
ssh deploy@TU_IP_VPS "docker logs sistema-reservas-proxy"
```

## Configuración Adicional

### SSL con Let's Encrypt

El sistema utiliza Traefik para gestionar automáticamente los certificados SSL de Let's Encrypt. Asegúrate de que:

1. Tus dominios (`reserva.wgsoft.com.co`, `api.reserva.wgsoft.com.co`) apunten a la IP de tu VPS
2. Los puertos 80 y 443 estén abiertos en el firewall (ya configurados por el script)

### Configuración de DNS

Asegúrate de tener los siguientes registros DNS apuntando a la IP de tu VPS:

```
A    reserva.wgsoft.com.co    -> TU_IP_VPS
A    api.reserva.wgsoft.com.co -> TU_IP_VPS
A    traefik.reserva.wgsoft.com.co -> TU_IP_VPS (opcional, para dashboard)
```

### Scripts de Utilidad

Se han copiado los siguientes scripts útiles a la VPS:

- `~/sistema-reservas/scripts/health-check.sh` - Verificación del estado del sistema
- `~/sistema-reservas/scripts/backup-db.sh` - Backup de la base de datos
- `~/sistema-reservas/scripts/restore-db.sh` - Restauración de la base de datos
- `~/sistema-reservas/scripts/deploy-manual.sh` - Despliegue manual alternativo

## Troubleshooting

### Si el dominio no responde

1. Verifica que los registros DNS estén correctamente configurados
2. Verifica que los puertos 80 y 443 estén abiertos
3. Verifica el estado de los contenedores:
   ```bash
   docker compose -f ~/sistema-reservas/docker-compose.prod.yml ps
   ```

### Si no se generan certificados SSL

1. Verifica que Traefik tenga acceso al puerto 80 para el desafío HTTP
2. Verifica los logs de Traefik:
   ```bash
   docker logs sistema-reservas-proxy
   ```

### Si hay problemas con la base de datos

1. Verifica que el contenedor PostgreSQL esté corriendo y saludable:
   ```bash
   docker inspect sistema-reservas-db | grep -A 10 Health
   ```

## Mantenimiento

### Backups

Configura backups automáticos editando el crontab:

```bash
crontab -e
```

Agrega una entrada para ejecutar backups diarios:

```bash
# Backup diario a las 2 AM
0 2 * * * cd /home/deploy/sistema-reservas && ./scripts/backup-db.sh
```

### Actualizaciones

Para actualizar la aplicación después de cambios:

1. Sube los cambios al repositorio
2. En la VPS, en el directorio `~/sistema-reservas`:
   ```bash
   git pull origin main
   docker compose -f docker-compose.prod.yml build --parallel
   docker compose -f docker-compose.prod.yml up -d
   docker exec sistema-reservas-backend npx prisma migrate deploy
   ```

¡Tu aplicación debería estar disponible en https://reserva.wgsoft.com.co!
