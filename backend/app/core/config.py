"""Application settings (pydantic-settings), mirroring the platform backend's pattern."""
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_HERE = Path(__file__).resolve().parent.parent.parent
_ENV_FILE = _HERE / ".env"
_PLATFORM_ENV = _HERE.parent / "backend" / ".env"  # reuse platform LLM creds


def _read_env_value(path: Path, key: str) -> str:
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            if k.strip().upper() == key.upper():
                return v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return ""


class Settings(BaseSettings):
    app_name: str = "Inventory Optimization API"
    api_v1_prefix: str = "/api/v1"
    cors_origins: list[str] = ["*"]

    # Postgres in production (postgresql+asyncpg://user:pass@host/db).
    # Defaults to SQLite (aiosqlite) for zero-config local dev — same async
    # SQLAlchemy code path, so the switch is just this env var.
    database_url: str = "sqlite+aiosqlite:///./inventory.db"

    # Seed the deterministic demo dataset on first startup when tables are empty.
    seed_on_startup: bool = True

    # LLM (Sage agent) — Claude via Azure AI Foundry. Falls back to the
    # platform backend's .env so creds live in one place.
    anthropic_foundry_key: str = ""
    anthropic_foundry_url: str = ""
    anthropic_agent_model: str = "claude-haiku-4-5"

    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), extra="ignore")

    def hydrate_llm(self) -> "Settings":
        if not self.anthropic_foundry_key:
            self.anthropic_foundry_key = _read_env_value(_PLATFORM_ENV, "ANTHROPIC_FOUNDRY_KEY")
        if not self.anthropic_foundry_url:
            self.anthropic_foundry_url = _read_env_value(_PLATFORM_ENV, "ANTHROPIC_FOUNDRY_URL")
        return self

    @property
    def llm_enabled(self) -> bool:
        return bool(self.anthropic_foundry_key and self.anthropic_foundry_url)


settings = Settings().hydrate_llm()
