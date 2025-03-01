import os
import json
from datetime import datetime, timedelta
from flask import Flask, redirect, url_for, session, request, jsonify, render_template
from flask_session import Session
from flask_cors import CORS
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import firebase_admin
from firebase_admin import credentials, firestore
from functools import wraps

# Initialize Flask app
app = Flask(__name__)
CORS(app, supports_credentials=True)  # Enable CORS for frontend integration
app.config["SESSION_PERMANENT"] = False
app.config["SESSION_TYPE"] = "filesystem"
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "your-secret-key")  # Set a secret key for session
Session(app)

# Set environment variables for OAuth (remove in production)
os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"  # For development only

# Firebase setup
try:
    # Initialize Firebase if not already initialized
    if not firebase_admin._apps:
        cred = credentials.Certificate('servicekey.json')
        firebase_admin.initialize_app(cred)
    
    # Get Firestore database
    db = firestore.client()
except Exception as e:
    print(f"Firebase initialization error: {e}")

# Google OAuth configuration
CLIENT_SECRETS_FILE = "client_secret.json"  # Your OAuth client secrets
SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid"
]

# Create OAuth flow
def create_flow(redirect_uri):
    return Flow.from_client_secrets_file(
        CLIENT_SECRETS_FILE,
        scopes=SCOPES,
        redirect_uri=redirect_uri
    )

# Authentication decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "credentials" not in session:
            return jsonify({"error": "Not authenticated", "redirect": "/auth/google"}), 401
        return f(*args, **kwargs)
    return decorated_function

# Routes for authentication
@app.route("/auth/google")
def auth_google():
    # Create the flow using the client secrets file
    flow = create_flow(url_for('oauth2callback', _external=True))
    
    # Generate URL for request to Google's OAuth 2.0 server
    authorization_url, state = flow.authorization_url(
        access_type='offline',
        include_granted_scopes='true',
        prompt='consent'  # Force to always show the consent screen
    )
    
    # Store the state in the session for later validation
    session['state'] = state
    
    return redirect(authorization_url)

@app.route("/auth/callback")
def oauth2callback():
    # Verify state matches
    state = session.get('state')
    if state is None or state != request.args.get('state'):
        return jsonify({"error": "State mismatch"}), 400
    
    # Create the flow using the client secrets file
    flow = create_flow(url_for('oauth2callback', _external=True))
    
    # Use the authorization server's response to fetch the OAuth 2.0 tokens
    flow.fetch_token(authorization_response=request.url)
    
    # Store credentials in the session
    credentials = flow.credentials
    session['credentials'] = credentials_to_dict(credentials)
    
    # Get user information
    user_info = get_user_info(credentials)
    session['user_email'] = user_info.get('email')
    session['user_id'] = user_info.get('id')
    
    # Sync calendar data with Firebase
    sync_calendar_data(credentials, user_info.get('email'))
    
    # Redirect to frontend with success parameter
    return redirect(f"/calendar-connected?success=true&email={user_info.get('email')}")

@app.route("/calendar-connected")
def calendar_connected():
    success = request.args.get('success', 'false')
    email = request.args.get('email', '')
    return render_template('calendar_connected.html', success=success, email=email)

# Helper function to get user info
def get_user_info(credentials):
    try:
        service = build('oauth2', 'v2', credentials=credentials)
        user_info = service.userinfo().get().execute()
        return user_info
    except Exception as e:
        print(f"Error getting user info: {e}")
        return {}

# API routes for calendar operations
@app.route("/api/sync-calendar", methods=["POST"])
@login_required
def api_sync_calendar():
    credentials = Credentials(**session['credentials'])
    user_email = session.get('user_email')
    
    if not user_email:
        return jsonify({"error": "User email not found in session"}), 400
    
    try:
        sync_calendar_data(credentials, user_email)
        return jsonify({"success": True, "message": "Calendar synced successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@app.route("/api/last-sync-time")
@login_required
def api_last_sync_time():
    user_email = session.get('user_email')
    if not user_email or not db:
        return jsonify({"error": "Not authenticated or database unavailable"}), 401
    
    try:
        user_ref = db.collection('users').document(user_email)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            return jsonify({"lastCalendarSync": None})
            
        user_data = user_doc.to_dict()
        return jsonify({"lastCalendarSync": user_data.get('lastCalendarSync')})
    except Exception as e:
        print(f"Error getting last sync time: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/user-status", methods=["GET"])
def api_user_status():
    if 'user_email' in session and 'credentials' in session:
        return jsonify({
            "authenticated": True,
            "email": session.get('user_email'),
            "calendar_connected": True
        })
    return jsonify({
        "authenticated": False,
        "calendar_connected": False
    })

@app.route("/api/calendar-events", methods=["GET"])
@login_required
def api_calendar_events():
    credentials = Credentials(**session['credentials'])
    
    # Get time range parameters
    days = int(request.args.get('days', 30))
    start_date_str = request.args.get('start_date')
    
    if start_date_str:
        try:
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
        except ValueError:
            return jsonify({"error": "Invalid start_date format"}), 400
    else:
        start_date = datetime.utcnow()
    
    end_date = start_date + timedelta(days=days)
    
    try:
        events = fetch_calendar_events(credentials, start_date, end_date)
        return jsonify({
            "success": True,
            "events": events
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/update-group-availability", methods=["POST"])
@login_required
def api_update_group_availability():
    data = request.json
    if not data or 'groupId' not in data:
        return jsonify({"error": "Group ID required"}), 400
    
    group_id = data['groupId']
    user_email = session.get('user_email')
    
    try:
        update_user_availability_in_group(user_email, group_id)
        return jsonify({"success": True, "message": f"Availability updated for group {group_id}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/find-free-time", methods=["POST"])
@login_required
def api_find_free_time():
    data = request.json
    if not data or 'groupId' not in data:
        return jsonify({"error": "Group ID required"}), 400
    
    group_id = data['groupId']
    start_date_str = data.get('startDate')
    days = int(data.get('days', 7))
    
    if start_date_str:
        try:
            start_date = datetime.fromisoformat(start_date_str.replace('Z', '+00:00'))
        except ValueError:
            return jsonify({"error": "Invalid start_date format"}), 400
    else:
        start_date = datetime.utcnow()
    
    end_date = start_date + timedelta(days=days)
    
    try:
        free_slots = find_group_free_time(group_id, start_date, end_date)
        return jsonify({
            "success": True,
            "freeSlots": free_slots
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/disconnect-calendar", methods=["POST"])
@login_required
def api_disconnect_calendar():
    user_email = session.get('user_email')
    
    try:
        # Update user record to mark calendar as disconnected, but keep the busy periods
        user_ref = db.collection('users').document(user_email)
        user_ref.update({
            'googleCalendarConnected': False,
            'calendarDisconnectedAt': datetime.utcnow().isoformat()
        })
        
        # Remove credentials from session
        if 'credentials' in session:
            session.pop('credentials')
        
        return jsonify({
            "success": True,
            "message": "Calendar disconnected successfully"
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/logout", methods=["POST"])
def logout():
    """Logout user and disconnect their Google Calendar"""
    try:
        # Get user email from session before clearing it
        user_email = session.get('user_email')
        
        # If user is logged in, revoke Google Calendar access
        if user_email:
            # First, check if credentials exist in session
            if 'credentials' in session:
                try:
                    # We don't actually revoke the token since that would require
                    # an API call to Google and the user would need to re-authorize
                    # the next time. Instead, we just mark it as disconnected in our DB.
                    user_ref = db.collection('users').document(user_email)
                    user_ref.update({
                        'googleCalendarConnected': False,
                        'lastCalendarSync': firestore.SERVER_TIMESTAMP
                    })
                    print(f"Marked Google Calendar as disconnected for user {user_email}")
                except Exception as e:
                    print(f"Error disconnecting calendar on logout: {e}")
        
        # Clear the session regardless of whether calendar disconnect succeeded
        session.clear()
        
        return jsonify({"success": True, "message": "Logged out successfully and calendar disconnected"})
    except Exception as e:
        print(f"Error during logout: {e}")
        # Still try to clear the session even if there was an error
        session.clear()
        return jsonify({"success": True, "message": "Logged out but there was an issue with calendar disconnection"})

# Helper functions
def credentials_to_dict(credentials):
    """Convert credentials to a dictionary for session storage"""
    return {
        'token': credentials.token,
        'refresh_token': credentials.refresh_token,
        'token_uri': credentials.token_uri,
        'client_id': credentials.client_id,
        'client_secret': credentials.client_secret,
        'scopes': credentials.scopes
    }

def fetch_calendar_events(credentials, start_date, end_date):
    """Fetch calendar events from Google Calendar API"""
    try:
        service = build('calendar', 'v3', credentials=credentials)
        
        # Format dates for API
        time_min = start_date.isoformat() + 'Z'
        time_max = end_date.isoformat() + 'Z'
        
        # Fetch events
        events_result = service.events().list(
            calendarId='primary',
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        
        # Process events to a simpler format
        processed_events = []
        for event in events:
            # Skip declined events
            attendees = event.get('attendees', [])
            is_declined = False
            for attendee in attendees:
                if attendee.get('self', False) and attendee.get('responseStatus') == 'declined':
                    is_declined = True
                    break
            
            if is_declined:
                continue
                
            # Extract start and end times
            start = event['start'].get('dateTime', event['start'].get('date'))
            end = event['end'].get('dateTime', event['end'].get('date'))
            
            # Create a simplified event object
            processed_events.append({
                'id': event.get('id'),
                'summary': event.get('summary', 'Busy'),  # Default to "Busy" if no summary
                'start': start,
                'end': end,
                'isAllDay': 'date' in event['start']
            })
        
        return processed_events
    except Exception as e:
        print(f"Error fetching calendar events: {e}")
        raise

def sync_calendar_data(credentials, user_email):
    """Sync user's calendar data with Firebase - ensuring persistence"""
    try:
        if not db:
            print("Warning: Firestore database unavailable, skipping calendar sync")
            return True
            
        # Fetch events for the next 90 days
        now = datetime.utcnow()
        end_date = now + timedelta(days=90)
        
        events = fetch_calendar_events(credentials, now, end_date)
        
        # Convert events to busy periods
        busy_periods = []
        for event in events:
            # Parse start and end times
            if 'T' in event['start']:  # Has time component
                busy_periods.append({
                    'start': event['start'],
                    'end': event['end'],
                    'title': "Busy",  # Privacy-focused title
                    'source': "google",
                    'lastUpdated': datetime.utcnow().isoformat()
                })
        
        # Update user record in Firebase with busy periods
        # Use merge=True to ensure we don't overwrite other fields
        user_ref = db.collection('users').document(user_email)
        
        # Check if the user document already exists
        user_doc = user_ref.get()
        if user_doc.exists:
            # Update the document with merge to preserve other fields
            user_ref.update({
                'googleCalendarConnected': True,
                'busyPeriods': busy_periods,
                'lastCalendarSync': datetime.utcnow().isoformat()
            })
        else:
            # Create a new document
            user_ref.set({
                'email': user_email,
                'googleCalendarConnected': True,
                'busyPeriods': busy_periods,
                'lastCalendarSync': datetime.utcnow().isoformat(),
                'createdAt': datetime.utcnow().isoformat()
            })
        
        # Get all groups the user is a member of
        user_groups_ref = db.collection('user_groups').document(user_email)
        user_groups_doc = user_groups_ref.get()
        
        groups = []
        if user_groups_doc.exists:
            user_groups_data = user_groups_doc.to_dict()
            groups = user_groups_data.get('groups', [])
        
        # Log debug information
        print(f"User {user_email} is a member of {len(groups)} groups")
        print(f"Synced {len(busy_periods)} busy periods for user {user_email}")
        
        return True
    except Exception as e:
        print(f"Error syncing calendar data: {e}")
        raise

def update_all_group_availability(user_email):
    """Update user's availability in all groups they belong to"""
    try:
        if not db:
            print("Warning: Firestore database unavailable, skipping group availability update")
            return
        
        # Get groups from the user_groups collection instead of collection group query
        user_groups_ref = db.collection('user_groups').document(user_email)
        user_groups_doc = user_groups_ref.get()
        
        groups = []
        if user_groups_doc.exists:
            user_groups_data = user_groups_doc.to_dict()
            groups = user_groups_data.get('groups', [])
        
        # Update availability for each group
        for group_id in groups:
            try:
                update_user_availability_in_group(user_email, group_id)
            except Exception as e:
                print(f"Error updating availability for group {group_id}: {e}")
                
    except Exception as e:
        print(f"Error updating all group availability: {e}")

def update_user_availability_in_group(user_email, group_id):
    """
    This function is simplified in Option 1 since we don't store busy periods in groups
    Just ensure the user is a member of the group
    """
    try:
        # Check if user exists
        user_ref = db.collection('users').document(user_email)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            raise Exception(f"User {user_email} not found")
        
        # Ensure user is in the group members collection
        # but don't duplicate the busy periods
        member_ref = db.collection(f'groups/{group_id}/members').document(user_email)
        member_ref.set({
            'email': user_email,
            'displayName': user_doc.to_dict().get('displayName', user_email),
            'lastUpdated': datetime.utcnow().isoformat()
        }, merge=True)
        
        return True
    except Exception as e:
        print(f"Error updating user in group: {e}")
        raise

def find_group_free_time(group_id, start_date, end_date):
    """Find free time slots when all group members are available - Option 1 implementation"""
    try:
        # Get all members in the group
        group_ref = db.collection('groups').document(group_id)
        group_doc = group_ref.get()
        
        if not group_doc.exists:
            raise Exception(f"Group {group_id} not found")
            
        group_data = group_doc.to_dict()
        members = group_data.get('members', [])
        
        # Generate all possible time slots within date range (business hours)
        all_slots = {}
        current_date = start_date
        
        while current_date < end_date:
            date_key = f"{current_date.year}-{current_date.month}-{current_date.day}"
            all_slots[date_key] = {}
            
            # Generate slots for business hours (9 AM to 5 PM)
            for hour in range(9, 17):
                time_slot = f"{hour}:00 - {hour + 1}:00"
                all_slots[date_key][time_slot] = {
                    'free': True,
                    'busyMembers': []
                }
            
            current_date += timedelta(days=1)
        
        # Query each user's busy periods directly from user collection
        for member in members:
            user_id = member.get('userId')
            if not user_id:
                continue
                
            user_ref = db.collection('users').document(user_id)
            user_doc = user_ref.get()
            
            if not user_doc.exists:
                continue
                
            user_data = user_doc.to_dict()
            busy_periods = user_data.get('busyPeriods', [])
            
            # Check each busy period against our time slots
            for period in busy_periods:
                if 'T' not in period['start']:  # Skip all-day events
                    continue
                    
                # Parse the start and end times
                start = period['start'].split('+')[0].split('Z')[0].split('.')[0]
                end = period['end'].split('+')[0].split('Z')[0].split('.')[0]
                start_time = datetime.fromisoformat(start)
                end_time = datetime.fromisoformat(end)
                
                # Round to the nearest hour slots
                current_hour = datetime(
                    start_time.year, start_time.month, start_time.day,
                    start_time.hour, 0, 0
                )
                
                # Mark slots as busy
                while current_hour < end_time:
                    date_key = f"{current_hour.year}-{current_hour.month}-{current_hour.day}"
                    time_slot = f"{current_hour.hour}:00 - {current_hour.hour + 1}:00"
                    
                    if date_key in all_slots and time_slot in all_slots[date_key]:
                        # Add this user to the list of busy members
                        all_slots[date_key][time_slot]['busyMembers'].append(user_id)
                        
                    # Move to next hour
                    current_hour += timedelta(hours=1)
        
        # Filter to only free slots (where no members are busy)
        free_slots = {}
        for date_key, slots in all_slots.items():
            free_slots[date_key] = {}
            for time_slot, slot_info in slots.items():
                if not slot_info['busyMembers']:  # No busy members
                    free_slots[date_key][time_slot] = {
                        'free': True
                    }
        
        return free_slots
    except Exception as e:
        print(f"Error finding group free time: {e}")
        raise
    
@app.route("/api/join-group", methods=["POST"])
@login_required
def api_join_group():
    data = request.json
    if not data or 'groupId' not in data:
        return jsonify({"error": "Group ID required"}), 400
    
    group_id = data['groupId']
    user_email = session.get('user_email')
    
    if not user_email:
        return jsonify({"error": "User not authenticated"}), 401
    
    try:
        # Add user to the group members
        member_ref = db.collection(f'groups/{group_id}/members').document(user_email)
        member_ref.set({
            'email': user_email,
            'joinedAt': datetime.utcnow().isoformat()
        }, merge=True)
        
        # Update the user_groups collection
        user_groups_ref = db.collection('user_groups').document(user_email)
        
        # Use arrayUnion to add to the groups array without duplicates
        user_groups_ref.set({
            'email': user_email,
            'groups': firestore.ArrayUnion([group_id])
        }, merge=True)
        
        # Try to update availability in this group
        try:
            update_user_availability_in_group(user_email, group_id)
        except Exception as e:
            print(f"Warning: Could not update availability: {e}")
        
        return jsonify({"success": True, "message": f"Joined group {group_id}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/leave-group", methods=["POST"])
@login_required
def api_leave_group():
    data = request.json
    if not data or 'groupId' not in data:
        return jsonify({"error": "Group ID required"}), 400
    
    group_id = data['groupId']
    user_email = session.get('user_email')
    
    if not user_email:
        return jsonify({"error": "User not authenticated"}), 401
    
    try:
        # Remove user from the group members
        member_ref = db.collection(f'groups/{group_id}/members').document(user_email)
        member_ref.delete()
        
        # Update the user_groups collection
        user_groups_ref = db.collection('user_groups').document(user_email)
        
        # Get current groups
        user_groups_doc = user_groups_ref.get()
        if user_groups_doc.exists:
            user_groups_data = user_groups_doc.to_dict()
            groups = user_groups_data.get('groups', [])
            
            # Remove the group
            if group_id in groups:
                groups.remove(group_id)
                
                # Update the document
                user_groups_ref.update({
                    'groups': groups
                })
        
        return jsonify({"success": True, "message": f"Left group {group_id}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Run the application
if __name__ == "__main__":
    app.run(debug=True)