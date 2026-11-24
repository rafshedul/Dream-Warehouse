"""Create a private PostgreSQL custom-format backup using pg_dump."""

from datetime import datetime, timezone
import os
from pathlib import Path
import shutil
import subprocess
import sys

from dotenv import load_dotenv
from sqlalchemy.engine import make_url


def main() -> int:
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL is missing. Configure it in .env first.", file=sys.stderr)
        return 1

    url = make_url(database_url)
    if url.get_backend_name() != "postgresql":
        print("This backup script supports PostgreSQL DATABASE_URL values only.", file=sys.stderr)
        return 1

    pg_dump = shutil.which("pg_dump")
    if pg_dump is None:
        print("pg_dump is not installed or is not on PATH.", file=sys.stderr)
        return 1

    backup_dir = Path(os.getenv("BACKUP_DIR", "backups"))
    os.umask(0o077)
    backup_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(backup_dir, 0o700)
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup_file = backup_dir / f"inventory_erp_{timestamp}.dump"

    command = [pg_dump, "--format=custom", "--no-password", "--file", str(backup_file)]
    if url.host:
        command.extend(["--host", url.host])
    if url.port:
        command.extend(["--port", str(url.port)])
    if url.username:
        command.extend(["--username", url.username])
    if url.database:
        command.extend(["--dbname", url.database])

    environment = os.environ.copy()
    if url.password:
        environment["PGPASSWORD"] = url.password
    for option, value in url.query.items():
        environment[f"PG{option.upper()}"] = str(value)

    try:
        subprocess.run(command, env=environment, check=True)
    except subprocess.CalledProcessError:
        backup_file.unlink(missing_ok=True)
        print("pg_dump failed; no backup was retained.", file=sys.stderr)
        return 1

    os.chmod(backup_file, 0o600)
    print(f"Database backup created: {backup_file}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
