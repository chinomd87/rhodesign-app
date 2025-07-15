# RhodeSign - E-Signature Platform

<!-- cSpell:ignore rhodesign Firestore -->

RhodeSign is a modern, secure e-signature platform built with React and Firebase. It allows users to upload documents, add signers, place signature fields, and manage the entire signing workflow with real-time updates and comprehensive audit trails.

## 🚀 Features

### Phase 1 (Current Implementation)

- **Firebase Integration** - Full Firebase backend with Firestore, Storage, and real-time updates
- **Document Upload & Processing** - Secure PDF/document upload with Firebase Storage
- **Real-time Document Dashboard** - Live document status updates with Firebase listeners
- **Multi-step Signature Workflow** - Intuitive 4-step process for creating signature requests
- **Signature Capture** - Canvas-based signature drawing with secure storage
- **Signer Management** - Add multiple signers with proper validation
- **Document Status Tracking** - Real-time status updates (Draft, Out for Signature, Completed)
- **Comprehensive Audit Trail** - Complete logging of all document actions with timestamps
- **Secure Document Signing** - Protected signing links with validation
- **Responsive Design** - Modern UI built with Tailwind CSS and React components

### Recently Completed ✅

- **Fine-Grained Authorization (FGA)** - Externalized authorization system combining RBAC, ReBAC, and ABAC
- **Advanced Permission Management** - Role-based access control with relationship and attribute-based policies
- **Security Enhancements** - Policy-driven security with comprehensive audit trails
- **Admin Dashboard** - FGA management interface for policies and permissions
- **Code Quality Improvements** - ESLint/SonarQube compliance and accessibility fixes

### In Development 🔄

- **Enhanced User Management** - User profiles, organization management, team structures
- **Template System** - Save and reuse documents with pre-configured fields
- **Advanced PDF Processing** - Interactive PDF viewer with drag-and-drop field placement

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS
- **Backend**: Firebase (Firestore, Storage, Functions, Auth)
- **Real-time Data**: Firestore real-time listeners
- **UI Components**: Lucide React icons
- **PDF Processing**: pdf-lib, react-pdf
- **Routing**: React Router DOM
- **State Management**: React hooks and context
- **State Management**: React Hooks

## 📋 Prerequisites

- Node.js 18+
- npm or yarn
- Firebase project with Firestore and Storage enabled

## 🔧 Installation

1. Clone the repository:

```bash
git clone https://github.com/your-username/rhodesign-app.git
cd rhodesign-app
```

1. Install dependencies:

```bash
npm install
```

1. Configure Firebase:

   - Copy `.env.example` to `.env` and fill in your Firebase configuration
   - Follow the detailed setup guide in `FIREBASE_SETUP.md`
   - Ensure Firestore and Storage are enabled in your Firebase console

1. Start the development server:

```bash
npm run dev
```

## 🏗️ Project Structure

```text
src/
├── components/          # Reusable UI components
│   ├── MainApp.jsx     # Main application layout
│   ├── UploadFlowModal.jsx  # Multi-step upload wizard
│   └── SignatureCanvas.jsx # Signature capture component
├── pages/              # Page components
│   └── SigningPage.jsx # Document signing interface
├── services/           # Business logic and API calls
│   ├── documentService.js  # Document CRUD operations
│   └── signingService.js   # Signature workflow management
├── models/             # Data models and types
│   └── index.js       # Document, Signer, and Field models
├── firebase/           # Firebase configuration
│   └── config.js      # Firebase app initialization
└── AppRouter.jsx      # Application routing configuration
```

## 🔥 Firebase Setup

1. Create a new Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable Firestore Database
3. Enable Firebase Storage
4. Enable Firebase Authentication (for future phases)
5. Update the Firebase configuration in `src/firebase/config.js`

## 🚦 Usage

### Creating a Signature Request

1. Click "New Request" or "Upload & Send" on the dashboard
2. **Step 1**: Upload your document (PDF, DOC, DOCX, PNG, JPG)
3. **Step 2**: Add recipient information (name and email)
4. **Step 3**: Place signature fields (auto-placement in Phase 1)
5. **Step 4**: Review details and send the document

### Signing a Document

1. Open the signing link sent via email
2. Review the document and signing fields
3. Complete required signature fields by drawing or typing
4. Submit the signed document

## 🛣️ Development Roadmap

- **Phase 1**: ✅ Core Foundation (Complete)
- **Phase 2**: 🔄 Advanced Features & Security (60% Complete)
- **Phase 3**: 📋 Enterprise Security & Compliance (Planned Q4 2025)
- **Phase 4**: 🚀 Platform & Integrations (Planned Q2 2026)
- **Phase 5**: 💰 Monetization & Growth (Planned Q4 2026)

See [ROADMAP.md](ROADMAP.md) for detailed timeline and features.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support, email [support@rhodesign.com](mailto:support@rhodesign.com) or create an issue in this repository.

---

Built with ❤️ by Matthew D.ign

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
