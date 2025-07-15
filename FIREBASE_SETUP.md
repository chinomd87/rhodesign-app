# Firebase Setup Guide for RhodeSign App

<!-- cSpell:ignore rhodesign Firestore firebaseapp appspot signup myapp -->

## Prerequisites

- Node.js (v18 or higher)
- Firebase CLI installed globally: `npm install -g firebase-tools`
- A Google account for Firebase

## Firebase Project Setup

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project"
3. Name your project (e.g., `rhodesign-app`)
4. Choose whether to enable Google Analytics (optional)
5. Wait for project creation to complete

### 2. Enable Firebase Services

#### Firestore Database

1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in test mode" (we'll deploy security rules later)
4. Select a location for your database

#### Firebase Storage

1. Go to "Storage" in Firebase Console
2. Click "Get started"
3. Start in test mode
4. Choose the same location as your Firestore database

#### Firebase Authentication (Optional for Phase 1)

1. Go to "Authentication"
2. Click "Get started"
3. In the "Sign-in method" tab, enable desired providers (Email/Password recommended)

#### Firebase Hosting

1. Go to "Hosting" in Firebase Console
2. Click "Get started"
3. Follow the setup instructions

### 3. Get Firebase Configuration

1. In Firebase Console, go to Project Settings (gear icon)
2. Scroll down to "Your apps" section
3. Click "Add app" and select "Web" (</>)
4. Register your app with a nickname
5. Copy the configuration object

### 4. Configure Environment Variables

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Fill in your Firebase configuration values in `.env`:

   ```env
   VITE_FIREBASE_API_KEY=your-api-key-here
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   VITE_FIREBASE_APP_ID=your-app-id-here
   ```

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Login to Firebase CLI

```bash
firebase login
```

### 3. Initialize Firebase in your project

```bash
firebase init
```

Select the following services:

- Firestore
- Storage
- Hosting
- Functions (optional)

Choose your existing project and use default settings.

### 4. Deploy Security Rules

```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage
```

### 5. Start Development Server

```bash
npm run dev
```

## Production Deployment

### 1. Build the Application

```bash
npm run build
```

### 2. Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

### 3. Deploy Everything (Full Deploy)

```bash
firebase deploy
```

## Security Configuration

### Firestore Security Rules

The app includes production-ready Firestore security rules in `firestore.rules`:

- Users can only access documents they created or are assigned to sign
- Proper authentication checks
- Write restrictions for sensitive operations

### Storage Security Rules

Storage rules in `storage.rules` ensure:

- Authenticated access to documents and signatures
- User-specific document folders
- Public read access where appropriate

## Database Indexes

The app includes optimized Firestore indexes in `firestore.indexes.json` for:

- Efficient document queries by user and status
- Sorting by creation and update dates
- Signer-based queries

## Testing Firebase Integration

### 1. Test Document Upload

1. Start the dev server: `npm run dev`
2. Click "New Request"
3. Upload a document and add signers
4. Check Firebase Console > Firestore to see the document created
5. Check Firebase Console > Storage to see the uploaded file

### 2. Test Signing Flow

1. Create a document with signers
2. Note the document ID from Firestore
3. Navigate to `/sign/{documentId}/{signerId}`
4. Complete the signing process
5. Verify signature data is saved in Firestore

### 3. Test Document Dashboard

1. Navigate to the Documents tab
2. Verify real-time updates when documents change
3. Test filtering by document status

## Environment Variables Reference

| Variable                            | Description          | Example                 |
| ----------------------------------- | -------------------- | ----------------------- |
| `VITE_FIREBASE_API_KEY`             | Firebase API key     | `AIzaSyC...`            |
| `VITE_FIREBASE_AUTH_DOMAIN`         | Firebase auth domain | `myapp.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID`          | Firebase project ID  | `myapp-12345`           |
| `VITE_FIREBASE_STORAGE_BUCKET`      | Storage bucket       | `myapp.appspot.com`     |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID  | `123456789`             |
| `VITE_FIREBASE_APP_ID`              | Firebase app ID      | `1:123:web:abc123`      |

## Common Issues and Solutions

### 1. "FirebaseError: Missing or insufficient permissions"

- Check your Firestore security rules
- Ensure user is properly authenticated
- Verify the user has access to the requested document

### 2. "Storage Error: User does not have permission to access"

- Check storage security rules
- Ensure file paths match the allowed patterns
- Verify user authentication

### 3. "Firebase Configuration Error"

- Double-check all environment variables
- Ensure `.env` file is in the project root
- Restart the dev server after changing environment variables

### 4. "Network Error"

- Check Firebase project status
- Verify internet connection
- Ensure Firebase services are enabled in console

## Next Steps

After basic Firebase integration:

1. **Add Authentication**: Implement user login/signup
2. **Email Notifications**: Add email service for signing requests
3. **PDF Processing**: Integrate PDF viewing and field placement
4. **Cloud Functions**: Add server-side processing for enhanced security
5. **Analytics**: Add Firebase Analytics for usage tracking

## Support

For Firebase-specific issues:

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase Support](https://firebase.google.com/support)

For RhodeSign app issues:

- Check the console for error messages
- Verify Firebase configuration
- Review security rules and permissions
