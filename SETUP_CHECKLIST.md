# Firebase Setup Checklist for signet-e-signature

## ✅ Completed Steps

- [x] Firebase project created: `signet-e-signature`
- [x] Firebase configuration added to app
- [x] Environment variables configured
- [x] Firebase SDK integrated

## 🔧 Required Firebase Console Setup

### 1. Enable Firestore Database

1. Go to [Firebase Console](https://console.firebase.google.com/project/signet-e-signature)
2. Navigate to "Firestore Database"
3. Click "Create database"
4. Choose "Start in test mode" (we'll deploy production rules later)
5. Select your preferred location (e.g., us-central1)

### 2. Enable Firebase Storage

1. In Firebase Console, go to "Storage"
2. Click "Get started"
3. Start in test mode
4. Use the same location as Firestore

### 3. Enable Firebase Authentication (Optional for Phase 1)

1. Go to "Authentication"
2. Click "Get started"
3. In "Sign-in method" tab, enable "Email/Password"

### 4. Enable Firebase Hosting (Optional)

1. Go to "Hosting"
2. Click "Get started"
3. Follow setup instructions

## 🚀 Deploy Security Rules

Once you've enabled the services, deploy the security rules:

```bash
# Install Firebase CLI if not already installed
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init

# Deploy security rules
firebase deploy --only firestore:rules
firebase deploy --only storage
```

## 🧪 Test Your Setup

1. Start the development server:

   ```bash
   npm run dev
   ```

2. Open the app and check the "Firebase Connection Status" section on the dashboard

3. The connection test will verify:
   - ✅ Firestore read/write operations
   - ✅ Storage upload operations

## 🔒 Security Rules (Already Configured)

Your project includes production-ready security rules:

- **`firestore.rules`**: Controls database access
- **`storage.rules`**: Controls file access
- **`firestore.indexes.json`**: Optimizes query performance

## 📋 Quick Setup Commands

```bash
# 1. Enable services in Firebase Console (see steps above)

# 2. Install Firebase CLI
npm install -g firebase-tools

# 3. Login and initialize
firebase login
firebase init

# 4. Deploy rules
firebase deploy --only firestore:rules,storage

# 5. Start development
npm run dev
```

## 🚨 Common Issues & Solutions

### "Missing or insufficient permissions"

- ✅ Enable Firestore Database in console
- ✅ Deploy security rules: `firebase deploy --only firestore:rules`

### "Storage: User does not have permission"

- ✅ Enable Firebase Storage in console
- ✅ Deploy storage rules: `firebase deploy --only storage`

### "FirebaseError: 7 PERMISSION_DENIED"

- ✅ Check that services are enabled in Firebase Console
- ✅ Verify security rules are deployed
- ✅ Make sure you're using the correct project ID

## 🎯 Next Steps After Setup

1. **Test Document Upload**: Create a signature request to test file uploads
2. **Test Signing Flow**: Complete a document signing to test the full workflow
3. **Review Security Rules**: Customize rules for your specific needs
4. **Add Authentication**: Implement user login for production use
5. **Deploy to Production**: Use Firebase Hosting for live deployment

## 📞 Support

- **Firebase Documentation**: https://firebase.google.com/docs
- **Firebase Console**: https://console.firebase.google.com/project/signet-e-signature
- **Project Settings**: https://console.firebase.google.com/project/signet-e-signature/settings/general
