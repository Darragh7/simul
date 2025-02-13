import os
import json
from datetime import datetime, timedelta
from flask import Flask, redirect, url_for, session, request, jsonify
from flask_session import Session
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import firebase_admin
from firebase_admin import credentials, firestore
from functools import wraps

'''
To run this code you must have your own client secret file and service key file in the same directory as this file.
'''

# Initialize Firebase
cred = credentials.Certificate('simul-3ba34-firebase-adminsdk-fbsvc-3902da270f.json')
firebase_admin.initialize_app(cred)

# Initialize Firestore with the project ID from the service account
db = firestore.Client(project=cred.project_id)

# Flask and OAuth setup
app = Flask(__name__)
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
Session(app)

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"  # Development only

CLIENT_SECRETS_FILE = "client_secret_712658023484-up5avbefkui0o4ptgt1rvtqvbv2bjq69.apps.googleusercontent.com.json"     # Your client secret JSON file
SCOPES = ["https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/userinfo.email", "openid"]
flow = Flow.from_client_secrets_file(
    CLIENT_SECRETS_FILE,
    scopes=SCOPES,
    redirect_uri="http://127.0.0.1:5000/callback"
)

# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "credentials" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function

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
    
    # Get user info and store in Firebase
    service = build("oauth2", "v2", credentials=credentials)
    user_info = service.userinfo().get().execute()
    user_email = user_info["email"]
    session["user_email"] = user_email
    
    # Store user data in Firebase
    store_user_calendar_data(user_email, credentials)
    
    return redirect(url_for("dashboard"))

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
        if 'dateTime' in event['start']:  # Only process events with specific times
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

@app.route("/dashboard")
@login_required
def dashboard():
    user_email = session.get("user_email")
    user_ref = db.collection('users').document(user_email)
    user_data = user_ref.get().to_dict()
    
    return f"""
    <h1>Welcome {user_email}</h1>
    <h2>Add Friend</h2>
    <form action="/add_friend" method="POST">
        <input type="email" name="friend_email" placeholder="Friend's email">
        <button type="submit">Add Friend</button>
    </form>
    <h2>Find Mutual Free Time</h2>
    <form action="/find_free_time" method="POST">
        <input type="email" name="friend_email" placeholder="Friend's email">
        <button type="submit">Find Free Time</button>
    </form>
    <h2>Calendar Events</h2>
    <a href="/list_events"><button type="button">View Calendar Events</button></a>
    <br><br>
    <a href="/logout">Logout</a>
    """
    
@app.route("/list_events")
@login_required
def list_events():
    credentials = Credentials(**session["credentials"])
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
    
    # Format events for display
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
    
    # Create HTML display
    events_html = "<h1>Your Calendar Events</h1>"
    events_html += "<a href='/dashboard'>Back to Dashboard</a><br><br>"
    
    if not formatted_events:
        events_html += "<p>No upcoming events found.</p>"
    else:
        events_html += "<ul>"
        for event in formatted_events:
            events_html += f"""
                <li>
                    <strong>{event['summary']}</strong><br>
                    Start: {event['start']}<br>
                    End: {event['end']}<br>
                    {event['description'] if event['description'] else ''}
                </li>
                <br>
            """
        events_html += "</ul>"
    
    return events_html

@app.route("/add_friend", methods=["POST"])
@login_required
def add_friend():
    user_email = session.get("user_email")
    friend_email = request.form.get("friend_email")
    
    # Check if friend exists in system
    friend_ref = db.collection('users').document(friend_email)
    if not friend_ref.get().exists:
        return "Friend not found in system"
    
    # Add to friends list
    user_ref = db.collection('users').document(user_email)
    user_ref.update({
        'friends': firestore.ArrayUnion([friend_email])
    })
    
    return redirect(url_for("dashboard"))

@app.route("/find_free_time", methods=["POST"])
@login_required
def find_free_time():
    user_email = session.get("user_email")
    friend_email = request.form.get("friend_email")
    
    # Get both users' busy periods
    user_ref = db.collection('users').document(user_email)
    friend_ref = db.collection('users').document(friend_email)
    
    user_data = user_ref.get().to_dict()
    friend_data = friend_ref.get().to_dict()
    
    if not friend_data:
        return "Friend not found"
    
    # Find mutual free periods
    mutual_free_times = find_mutual_free_periods(
        user_data.get('busy_periods', []),
        friend_data.get('busy_periods', [])
    )
    
    return jsonify(mutual_free_times)

def find_mutual_free_periods():
    """Find mutual free periods between two users"""

    """Aggregate all free periods mutual to all group members """
    mutual_free_periods = []

    """Fetch List of group members from database"""
    # Group ID is known because the user will press a button to find mutual free periods with their group.
    # In other words the button will be pressed from within the specific group calender UI
    group_members = db.collection('users').where('group', '==', 'group_id').stream()

    """For each user, iterate through their calender slots, adding the free period to the list of free periods"""
    # Initialize a list to store the availability for each member
    all_user_slots = []

    # For each group member, fetch their calendar slots
    for member in group_members:
        user_calendar = db.collection('calendar_slots').where('user_id', '==', member.id).stream()

        # Store the user's free slots (assuming `free` is stored as a boolean)
        user_free_slots = []
        for slot in user_calendar:
            if slot.get('selected') == False:  # Assuming 'selected' is a flag for whether the user is busy
                user_free_slots.append(slot.get('hour'))
        
        # Add the user's free slots to the list
        all_user_slots.append(user_free_slots)
    
    """When the free periods for each user are aggregated, find the mutual free periods between all users"""
    # Iterate through all the hours (assuming 8 AM - 9 PM, adjust as needed)
    hours = list(range(8, 22))  # Hours from 8 AM to 9 PM, ARBITRARY 
    
    # For each hour, check if it's free for all users
    for hour in hours:
        is_free_for_all = True
        
        for user_slots in all_user_slots:
            if hour not in user_slots:
                is_free_for_all = False
                break

    """Return the mutual free periods"""
    return mutual_free_periods

@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("home"))

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