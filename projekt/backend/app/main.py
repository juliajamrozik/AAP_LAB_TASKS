import hashlib
import math
import os
import re
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import requests
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from argon2 import PasswordHasher
from cryptography.fernet import Fernet
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Password Security Checker & Vault")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "http://localhost:5174", 
        "http://127.0.0.1:5174"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = "sqlite:///./vault.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
ph = PasswordHasher()
key_str = os.getenv("SECRET_CRYPTO_KEY")
SECRET_CRYPTO_KEY = key_str.encode()
fernet = Fernet(SECRET_CRYPTO_KEY)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class UserDB(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)

class CredentialDB(Base):
    __tablename__ = "credentials"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    site_name = Column(String)
    login_name = Column(String)
    encrypted_password = Column(String)

Base.metadata.create_all(bind=engine)

class PasswordCheckRequest(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)

class PasswordCheckResponse(BaseModel):
    entropy: float
    strength: str
    pwned_count: int
    is_pwned: bool

class UserAuthRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)

class AddCredentialRequest(BaseModel):
    user_id: int
    site_name: str
    login_name: str
    password_to_encrypt: str

class CredentialResponse(BaseModel):
    id: int
    site_name: str
    login_name: str
    decrypted_password: str

def calculate_entropy(password: str) -> float:
    if not password: return 0.0
    pool_size = 0
    if re.search(r'[a-z]', password): pool_size += 26
    if re.search(r'[A-Z]', password): pool_size += 26
    if re.search(r'[0-9]', password): pool_size += 10
    if re.search(r'[^a-zA-Z0-9]', password): pool_size += 32
    if pool_size == 0: return 0.0
    return round(len(password) * math.log2(pool_size), 2)

def check_pwned_api(password: str) -> int:
    sha1_hash = hashlib.sha1(password.encode('utf-8')).hexdigest().upper()
    prefix, suffix = sha1_hash[:5], sha1_hash[5:]
    try:
        response = requests.get(f"https://api.pwnedpasswords.com/range/{prefix}", timeout=5)
        if response.status_code != 200: return 0
    except requests.RequestException: return 0
    for target_suffix, count in (line.split(':') for line in response.text.splitlines()):
        if target_suffix == suffix: return int(count)
    return 0

@app.post("/api/check-password", response_model=PasswordCheckResponse)
def check_password(payload: PasswordCheckRequest):
    entropy = calculate_entropy(payload.password)
    pwned_count = check_pwned_api(payload.password)
    strength = "Weak" if entropy < 40 else "Medium" if entropy < 65 else "Strong"
    return {"entropy": entropy, "strength": strength, "pwned_count": pwned_count, "is_pwned": pwned_count > 0}

@app.post("/api/register")
def register_user(payload: UserAuthRequest, db: Session = Depends(get_db)):
    existing_user = db.query(UserDB).filter(UserDB.username == payload.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists.")
    hashed_master = ph.hash(payload.password)
    new_user = UserDB(username=payload.username, hashed_password=hashed_master)
    db.add(new_user)
    db.commit()
    return {"message": "User registered successfully!"}

@app.post("/api/login")
def login_user(payload: UserAuthRequest, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.username == payload.username).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid username or password.")
    try:
        ph.verify(user.hashed_password, payload.password)
    except:
        raise HTTPException(status_code=400, detail="Invalid username or password.")
    return {"message": "Logged in successfully!", "user_id": user.id}

@app.post("/api/vault/add")
def add_credential(payload: AddCredentialRequest, db: Session = Depends(get_db)):
    encrypted_bytes = fernet.encrypt(payload.password_to_encrypt.encode())
    encrypted_string = encrypted_bytes.decode()
    new_cred = CredentialDB(
        user_id=payload.user_id,
        site_name=payload.site_name,
        login_name=payload.login_name,
        encrypted_password=encrypted_string
    )
    db.add(new_cred)
    db.commit()
    return {"message": "Password successfully encrypted and stored in vault!"}

@app.get("/api/vault/{user_id}", response_model=list[CredentialResponse])
def get_vault(user_id: int, db: Session = Depends(get_db)):
    credentials = db.query(CredentialDB).filter(CredentialDB.user_id == user_id).all()
    response_list = []
    for cred in credentials:
        try:
            decrypted_bytes = fernet.decrypt(cred.encrypted_password.encode())
            decrypted_string = decrypted_bytes.decode()
        except:
            decrypted_string = "[DECRYPTION ERROR]"
        response_list.append({
            "id": cred.id,
            "site_name": cred.site_name,
            "login_name": cred.login_name,
            "decrypted_password": decrypted_string
        })
    return response_list