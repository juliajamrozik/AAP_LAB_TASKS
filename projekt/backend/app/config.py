from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Password Vault"
    DEBUG: bool = True

    class Config:
        env_file = ".env"

settings = Settings()