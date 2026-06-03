import json
import secrets

from fastapi import FastAPI, Depends, HTTPException, status, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from mangum import Mangum

from app.s3_env import read_env, write_env, backup_env
from app.auth import create_cookie, verify_cookie, get_current_username

app = FastAPI()
app.mount("/static", StaticFiles(directory="app/static"), name="static")


@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    if not verify_cookie(request.cookies.get("session_token")):
        return RedirectResponse(url="/login", status_code=302)
    with open("app/templates/index.html") as f:
        return f.read()


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    if verify_cookie(request.cookies.get("session_token")):
        return RedirectResponse(url="/", status_code=302)
    with open("app/templates/login.html") as f:
        return f.read()


@app.post("/api/login")
def login_api(payload: dict, response: Response):
    username = payload.get("username", "")
    password = payload.get("password", "")
    
    correct_username = secrets.compare_digest(username, "admin")
    correct_password = secrets.compare_digest(password, "satidoc@6202")
    
    if not (correct_username and correct_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
        
    cookie_val = create_cookie(username)
    response.set_cookie(key="session_token", value=cookie_val, httponly=True)
    return {"message": "Success"}


@app.get("/env")
def get_env(username: str = Depends(get_current_username)):
    return read_env()


@app.post("/env")
def update_env(payload: dict, username: str = Depends(get_current_username)):
    backup_env()
    write_env(payload)
    return {
        "message": "updated",
        "updated_keys": list(payload.keys())
    }


handler = Mangum(app)