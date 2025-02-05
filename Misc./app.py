# app.py

from flask import Flask, redirect, url_for, session, request
import os
from google_auth_oauthlib.flow import Flow
from google.oauth2 import id_token
import google.auth.transport.requests
import google.oauth2.credentials

# SQLAlchemy imports
from models import init_db, SessionLocal, Event
from datetime import datetime

from googleapiclient.discovery import build

import os
from flask import Flask, redirect, url_for, session, request
from google_auth_oauthlib.flow import Flow
from google.oauth2 import id_token
import google.auth.transport.requests
import google.oauth2.credentials

from models import init_db, SessionLocal, Event  # Ensure these are defined properly
from datetime import datetime
from googleapiclient.discovery import build

app = Flask(__name__)
app.secret_key = 'REPLACE_WITH_SOME_SECURE_RANDOM_KEY'

# Google OAuth Client details
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '48039502476-il4ijecp8rgj5oaf7eeut0i18ga9rtgg.apps.googleusercontent.com')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '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')

# This must match the redirect URI you set in your Google Cloud project
REDIRECT_URI = 'http://127.0.0.1:5000/callback'


@app.route('/')
def index():
    return "Hello! <a href='/login'>Login with Google</a>"


@app.route('/login')
def login():
    # Create the Google OAuth Flow object
    flow = Flow.from_client_config(
        client_config={
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token"
            }
        },
        scopes=[
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/calendar.readonly"
        ],
        redirect_uri=REDIRECT_URI
    )

    authorization_url, state = flow.authorization_url(
        access_type='offline',  # Offline for refresh token
        include_granted_scopes='true'
    )
    session['state'] = state
    return redirect(authorization_url)


@app.route('/callback')
def callback():
    # Verify the state to protect against CSRF
    state = session.get('state', None)
    if not state:
        return "State missing, potential CSRF attack!", 400

    flow = Flow.from_client_config(
        client_config={
            "web": {
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token"
            }
        },
        scopes=[
            "openid",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/calendar.readonly"
        ],
        redirect_uri=REDIRECT_URI,
        state=state
    )

    # Exchange authorization code for access token
    flow.fetch_token(authorization_response=request.url)
    credentials = flow.credentials

    # Retrieve user info from ID token
    request_session = google.auth.transport.requests.Request()
    id_info = id_token.verify_oauth2_token(
        credentials._id_token, request_session, GOOGLE_CLIENT_ID
    )

    # Store user info in session
    session['google_id'] = id_info.get('sub')  # unique ID
    session['email'] = id_info.get('email')
    session['credentials'] = {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret,
        'scopes': credentials.scopes
    }

    # Redirect to fetch calendar events
    return redirect(url_for('fetch_calendar_events'))


@app.route('/fetch_calendar_events')
def fetch_calendar_events():
    # Ensure user is logged in and we have credentials
    if 'credentials' not in session:
        return redirect(url_for('login'))

    creds_info = session['credentials']
    creds = google.oauth2.credentials.Credentials(**creds_info)

    # Use the credentials to build the calendar service
    service = build('calendar', 'v3', credentials=creds)

    # Fetch the upcoming 10 events
    events_result = service.events().list(
        calendarId='primary',
        maxResults=10,
        singleEvents=True,
        orderBy='startTime'
    ).execute()
    events = events_result.get('items', [])

    # Store fetched events in the database
    db_session = SessionLocal()

    for event in events:
        summary = event.get('summary', 'No Title')
        start = event['start'].get('dateTime') or event['start'].get('date')
        end = event['end'].get('dateTime') or event['end'].get('date')
        google_event_id = event['id']

        # Convert ISO 8601 string to datetime if dateTime is present
        try:
            start_dt = datetime.fromisoformat(start)
        except ValueError:
            # If it's just a date (YYYY-MM-DD), parse accordingly
            start_dt = datetime.strptime(start, '%Y-%m-%d')

        try:
            end_dt = datetime.fromisoformat(end)
        except ValueError:
            end_dt = datetime.strptime(end, '%Y-%m-%d')

        # Check if event already exists in the DB (to avoid duplicates)
        existing = db_session.query(Event).filter_by(google_event_id=google_event_id).first()
        if not existing:
            new_event = Event(
                google_event_id=google_event_id,
                summary=summary,
                start_time=start_dt,
                end_time=end_dt,
                user_email=session['email']
            )
            db_session.add(new_event)

    db_session.commit()
    db_session.close()

    return f"Stored {len(events)} events for {session['email']} in the local SQLite DB!"


if __name__ == '__main__':
    # Initialize the database once at startup
    init_db()
    app.run(debug=True)
