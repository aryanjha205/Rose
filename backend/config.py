import os
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "webcall-super-secret-key-pink-2026-production")
    JWT_SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "webcall-jwt-secret-token-key-pink-2026")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)
    
    # Neon Serverless PostgreSQL (Strict - No SQLite Fallback)
    raw_db_url = os.environ.get("DATABASE_URL")
    if not raw_db_url:
        raise ValueError("DATABASE_URL is not set. Please provide your Neon PostgreSQL connection string.")

    if raw_db_url.startswith("postgres://"):
        raw_db_url = raw_db_url.replace("postgres://", "postgresql+psycopg2://", 1)
    elif raw_db_url.startswith("postgresql://") and not raw_db_url.startswith("postgresql+"):
        raw_db_url = raw_db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

    SQLALCHEMY_DATABASE_URI = raw_db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "pool_recycle": 300,
    }
    
    # Cloudinary configuration
    CLOUDINARY_CLOUD_NAME = os.environ.get("CLOUDINARY_CLOUD_NAME", "")
    CLOUDINARY_API_KEY = os.environ.get("CLOUDINARY_API_KEY", "")
    CLOUDINARY_API_SECRET = os.environ.get("CLOUDINARY_API_SECRET", "")
    CLOUDINARY_URL = os.environ.get("CLOUDINARY_URL", "")
    
    # CORS
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")
    
    # STUN/TURN configuration
    ICE_SERVERS = [
        {"urls": "stun:stun.l.google.com:19302"},
        {"urls": "stun:stun1.l.google.com:19302"},
        {"urls": "stun:stun2.l.google.com:19302"},
        {"urls": "stun:stun3.l.google.com:19302"},
        {"urls": "stun:stun4.l.google.com:19302"},
    ]
