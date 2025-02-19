import os
import json
from datetime import datetime, timedelta
from flask import Flask, redirect, url_for, request, jsonify
from flask_cors import CORS
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import firebase_admin
from firebase_admin import credentials, firestore
from functools import wraps
from flask_jwt_extended import JWTManager, create_access_token, get_jwt_identity, jwt_required
import secrets

# Set up the Firebase service account credentials
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = "simul-3ba34-firebase-adminsdk-fbsvc-3902da270f.json"

# Initialize Firebase
cred = credentials.Certificate("simul-3ba34-firebase-adminsdk-fbsvc-3902da270f.json")
firebase_admin.initialize_app(cred)

# Initialize Firestore with the project ID from the service account
db = firestore.Client(project=cred.project_id)

# Flask and JWT setup
app = Flask(__name__)
app.config["JWT_SECRET_KEY"] = secrets.token_hex(32)
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)
jwt = JWTManager(app)

# CORS setup
CORS(app,
     supports_credentials=True,
     origins=["http://localhost:3000"])

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"  # Development only

# Google OAuth setup
CLIENT_SECRETS_FILE = "client_secret_712658023484-up5avbefkui0o4ptgt1rvtqvbv2bjq69.apps.googleusercontent.com.json"
SCOPES = ["https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/userinfo.email", "openid"]
flow = Flow.from_client_secrets_file(
    CLIENT_SECRETS_FILE,
    scopes=SCOPES,
    redirect_uri="http://127.0.0.1:5000/callback"
)

@app.route("/")
def home():
    return '<a href="/login">Login with Google</a>'

@app.route("/login")
def login():
    auth_url, state = flow.authorization_url(access_type="offline", include_granted_scopes="true")
    return redirect(auth_url)

@app.route("/callback")
def callback():
    flow.fetch_token(authorization_response=request.url)
    credentials = flow.credentials
    
    # Get user info and store in Firebase
    service = build("oauth2", "v2", credentials=credentials)
    user_info = service.userinfo().get().execute()
    user_email = user_info["email"]
    
    # Store user data in Firebase
    store_user_calendar_data(user_email, credentials)
    
    # Create JWT token
    access_token = create_access_token(identity={
        'email': user_email,
        'credentials': credentials_to_dict(credentials)
    })
    
    return redirect(f"http://localhost:3000?token={access_token}")

@app.route("/api/auth/verify")
@jwt_required()
def verify_token():
    current_user = get_jwt_identity()
    return jsonify({
        "isAuthenticated": True,
        "user": current_user
    })

def store_user_calendar_data(user_email, credentials):
    """Store user's calendar data in Firebase"""
    service = build("calendar", "v3", credentials=credentials)
    
    # Get events for next 30 days
    now = datetime.utcnow().isoformat() + 'Z'
    thirty_days = (datetime.utcnow() + timedelta(days=30)).isoformat() + 'Z'
    
    events_result = service.events().list(
        calendarId='primary',
        timeMin=now,
        timeMax=thirty_days,
        singleEvents=True,
        orderBy='startTime'
    ).execute()
    
    events = events_result.get('items', [])
    
    # Convert events to free/busy periods
    busy_periods = []
    for event in events:
        if 'dateTime' in event['start']:
            start = event['start']['dateTime']
            end = event['end']['dateTime']
            busy_periods.append({
                'start': start,
                'end': end
            })
    
    # Store in Firebase
    doc_ref = db.collection('users').document(user_email)
    doc_ref.set({
        'email': user_email,
        'last_updated': datetime.utcnow().isoformat(),
        'busy_periods': busy_periods
    }, merge=True)

@app.route("/list_events")
@jwt_required()
def list_events():
    current_user = get_jwt_identity()
    credentials = Credentials(**current_user['credentials'])
    service = build("calendar", "v3", credentials=credentials)
    
    # Get events for next 30 days
    now = datetime.utcnow().isoformat() + 'Z'
    thirty_days = (datetime.utcnow() + timedelta(days=30)).isoformat() + 'Z'
    
    events_result = service.events().list(
        calendarId='primary',
        timeMin=now,
        timeMax=thirty_days,
        singleEvents=True,
        orderBy='startTime'
    ).execute()
    
    events = events_result.get('items', [])
    formatted_events = []
    
    for event in events:
        start = event['start'].get('dateTime', event['start'].get('date'))
        end = event['end'].get('dateTime', event['end'].get('date'))
        formatted_events.append({
            'summary': event.get('summary', 'No title'),
            'start': start,
            'end': end,
            'description': event.get('description', '')
        })
    
    return jsonify(formatted_events)

@app.route("/add_friend", methods=["POST"])
@jwt_required()
def add_friend():
    current_user = get_jwt_identity()
    user_email = current_user['email']
    friend_email = request.json.get("friend_email")
    
    # Check if friend exists in system
    friend_ref = db.collection('users').document(friend_email)
    if not friend_ref.get().exists:
        return jsonify({"error": "Friend not found in system"}), 404
    
    # Add to friends list
    user_ref = db.collection('users').document(user_email)
    user_ref.update({
        'friends': firestore.ArrayUnion([friend_email])
    })
    
    return jsonify({"message": "Friend added successfully"})

@app.route("/find_free_time", methods=["POST"])
@jwt_required()
def find_free_time():
    current_user = get_jwt_identity()
    user_email = current_user['email']
    friend_email = request.json.get("friend_email")
    
    user_ref = db.collection('users').document(user_email)
    friend_ref = db.collection('users').document(friend_email)
    
    user_data = user_ref.get().to_dict()
    friend_data = friend_ref.get().to_dict()
    
    if not friend_data:
        return jsonify({"error": "Friend not found"}), 404
    
    mutual_free_times = find_mutual_free_periods(
        user_data.get('busy_periods', []),
        friend_data.get('busy_periods', [])
    )
    
    return jsonify(mutual_free_times)

def find_mutual_free_periods(user_busy, friend_busy):
    """Find mutual free periods between two users"""
    all_busy_periods = user_busy + friend_busy
    all_busy_periods.sort(key=lambda x: x['start'])
    
    merged_busy = []
    for period in all_busy_periods:
        if not merged_busy or period['start'] > merged_busy[-1]['end']:
            merged_busy.append(period)
        else:
            merged_busy[-1]['end'] = max(merged_busy[-1]['end'], period['end'])
    
    free_periods = []
    for i in range(len(merged_busy) - 1):
        free_periods.append({
            'start': merged_busy[i]['end'],
            'end': merged_busy[i + 1]['start']
        })
    
    return free_periods

@app.route("/logout")
def logout():
    return jsonify({"message": "Logged out successfully"}), 200

def credentials_to_dict(credentials):
    return {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret,
        'scopes': list(credentials.scopes)
    }

if __name__ == "__main__":
    app.run(debug=True)