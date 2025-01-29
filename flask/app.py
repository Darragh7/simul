import os
import json
import sqlite3
from flask import Flask, redirect, url_for, session, request
from flask_session import Session
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"     ''' OAuth 2.0 requires HTTPS for security
                                                        This tells oauthlib to allow HTTP connections for local development.'''

app = Flask(__name__)

# Flask session configuration
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

# Load Google OAuth credentials
CLIENT_SECRETS_FILE = "client_secret_284638410667-qo1g3rrs79cfnb463sv6renb22h4r15p.apps.googleusercontent.com.json"     # The client secret here is mine (Stephen's)
SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

# Initialize OAuth flow
flow = Flow.from_client_secrets_file(
    CLIENT_SECRETS_FILE, scopes=SCOPES, redirect_uri="http://127.0.0.1:5000/callback"
)


@app.route("/")
def home():
    return '<a href="/login">Login with Google</a>'


@app.route("/login")
def login():
    auth_url, state = flow.authorization_url(access_type="offline", include_granted_scopes="true")
    session["state"] = state
    return redirect(auth_url)


@app.route("/callback")
def callback():
    flow.fetch_token(authorization_response=request.url)

    credentials = flow.credentials
    session["credentials"] = credentials_to_dict(credentials)

    return redirect(url_for("calendar"))


@app.route("/calendar")
def calendar():
    if "credentials" not in session:
        return redirect(url_for("login"))

    credentials = Credentials(**session["credentials"])

    service = build("calendar", "v3", credentials=credentials)
    events_result = service.events().list(calendarId="primary", maxResults=10).execute()
    events = events_result.get("items", [])

    return json.dumps(events, indent=2)


@app.route("/logout")
def logout():
    session.pop("credentials", None)
    return redirect(url_for("home"))


def credentials_to_dict(credentials):
    return {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": credentials.scopes,
    }


if __name__ == "__main__":
    app.run(debug=True)