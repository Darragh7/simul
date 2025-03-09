# Simul

Simul is a collaborative scheduling and group activity management application that helps friends coordinate events and find free time slots across their busy schedules.

## Features

- **Group Management**: Create and manage groups of friends for different activities.
- **Calendar Integration**: Connect with Google Calendar to automatically sync your schedule.
- **Event Coordination**: Find mutually available time slots across group members.
- **Bucket List**: Propose, vote on, and schedule group activities.
- **Friend System**: Build your network and easily create groups with your friends.
- **Notifications**: Stay updated with group events and friend requests.

## Tech Stack

### Frontend
- React.js
- Firebase Auth for user authentication
- Firestore for real-time data storage
- CSS for styling

### Backend
- Flask Python server for Google Calendar integration
- Firebase Admin SDK for server-side operations
- Google OAuth 2.0 for secure calendar access

## Project Structure

### Frontend Components

- **Authentication**: User login and signup handled by Firebase Authentication
- **Group Management**: Create, join, and manage groups
- **Calendar View**: View group schedules and events
- **Bucket List**: Propose and vote on group activities
- **Find Free Times**: Automatically find when all group members are available
- **Friend System**: Add friends and invite them to groups
- **Inbox**: Manage notifications, friend requests, and group invitations

### Backend Services

- **Google Calendar Integration**: Connect and sync with users' Google Calendars
- **Availability Calculation**: Determine when group members are mutually available
- **User Management**: Handle user authentication and profile data
- **Notification System**: Generate and manage notifications for group activities

## Getting Started

### Prerequisites

- Node.js and npm
- Python 3.7+
- Firebase account
- Google Cloud Platform account with Calendar API enabled

### Installation

1. **Clone the repository**
   ```
   git clone https://github.com/yourusername/simul.git
   cd simul
   ```

2. **Install frontend dependencies**
   ```
   npm install
   ```

3. **Install backend dependencies**
   ```
   pip install -r requirements.txt
   ```

4. **Configure Firebase**
   - Create a new Firebase project
   - Enable Authentication with Email/Password
   - Set up Firestore database
   - Add your Firebase configuration to `src/firebase/firebase.js`

5. **Configure Google Calendar API**
   - Create OAuth credentials in Google Cloud Console
   - Download client_secret.json and place it in the root directory
   - Configure the OAuth consent screen

6. **Start the backend server**
   ```
   python app.py
   ```

7. **Start the frontend development server**
   ```
   npm start
   ```

## Firebase Data Structure

- **users**: User profiles and availability information
  - Email, displayName, friends list, busyPeriods

- **groups**: Group information
  - Name, members, pendingMembers, createdBy

- **events**: Calendar events for each group
  - Organized by date with time slots

- **inbox**: Notifications and requests
  - Friend requests, group invites, event notifications

- **user_groups**: Quick lookup for user's group memberships
  - Email, list of group IDs

## Usage

1. **Sign up or log in** to your Simul account
2. **Connect your Google Calendar** for automatic scheduling
3. **Add friends** by sending friend requests via email
4. **Create a group** with your friends
5. **Add events to your group calendar** or propose activities in the bucket list
6. **Find free times** to schedule group activities when everyone is available
7. **Vote on proposed activities** in the bucket list
8. **Schedule events** based on group availability and preferences

## License

This project is licensed under the MIT License - see the LICENSE file for details.