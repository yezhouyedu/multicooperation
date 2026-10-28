const { ssh, write } = require('./lib.cjs');
const result = ssh(`set -euo pipefail
stamp=$(date +%Y%m%dT%H%M%S%z)
backup="/var/backups/multi-cooperation/capacity_$stamp"
sudo install -d -m 700 "$backup"
docker exec multi_cooperation_postgres_prod pg_dump -U postgres -d multi_cooperation -Fc | sudo tee "$backup/database.dump" >/dev/null
docker exec multi_cooperation_server_prod tar -C /app/storage -czf - . | sudo tee "$backup/server_storage.tar.gz" >/dev/null
sudo tar --exclude='./00_start_materials' --exclude='./storage' --exclude='./apps/server/storage' --exclude='./.env.production' --exclude='./backups' -C /opt/multi-cooperation -czf "$backup/source.tar.gz" .
sudo cp /opt/multi-cooperation/.env.production "$backup/environment.production"
sudo chmod 600 "$backup/database.dump" "$backup/server_storage.tar.gz" "$backup/source.tar.gz" "$backup/environment.production"
sudo sh -c 'cd "$1" && sha256sum database.dump server_storage.tar.gz source.tar.gz environment.production > SHA256SUMS && chmod 600 SHA256SUMS && sha256sum -c SHA256SUMS' sh "$backup"
sudo cat "$backup/database.dump" | docker exec -i multi_cooperation_postgres_prod sh -ec 'pg_restore --list >/dev/null; cat >/dev/null'
docker tag $(docker inspect --format '{{.Image}}' multi_cooperation_server_prod) multi-cooperation-server:rollback-capacity-20261028
docker tag $(docker inspect --format '{{.Image}}' multi_cooperation_web_prod) multi-cooperation-web:rollback-capacity-20261028
echo "BACKUP=$backup"
`, 600000);
write('backup-receipt.json', { at: new Date().toISOString(), receipt: result });
console.log(result);
