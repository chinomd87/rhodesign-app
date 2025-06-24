# RhodeSign - E-Signature Platform

RhodeSign is a modern, secure e-signature platform built with React and Firebase. It allows users to upload documents, add signers, place signature fields, and manage the entire signing workflow.

## 🚀 Features

### Phase 1 (Current Implementation)
- **Document Upload & Processing** - Secure PDF upload with Firebase Storage
- **Multi-step Signature Workflow** - Intuitive 4-step process for creating signature requests
- **Signature Capture** - Canvas-based signature drawing with real-time preview
- **Signer Management** - Add multiple signers with email notifications
- **Document Status Tracking** - Real-time status updates (Draft, Out for Signature, Completed)
- **Audit Trail** - Comprehensive logging of all document actions
- **Responsive Design** - Modern UI built with Tailwind CSS

### Planned Features (Phase 2+)
- **Template System** - Save and reuse documents with pre-placed fields
- **Multi-Signer Sequential Workflows** - Advanced signing order management
- **Advanced Field Placement** - Drag-and-drop field positioning on PDF preview
- **Identity Verification** - Multi-factor authentication for signers
- **API Integration** - RESTful API for third-party integrations
- **Team Management** - Organization and role-based access control

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS
- **Backend**: Firebase (Firestore, Storage, Functions, Auth)
- **UI Components**: Lucide React icons
- **PDF Processing**: pdf-lib
- **Routing**: React Router DOM
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

2. Install dependencies:
```bash
npm install
```

3. Configure Firebase:
   - Update `src/firebase/config.js` with your Firebase project credentials
   - Ensure Firestore and Storage are enabled in your Firebase console

4. Start the development server:
```bash
npm run dev
```

## 🏗️ Project Structure

```
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

- **Phase 1**: ✅ Core signing workflow (Current)
- **Phase 2**: 🔄 Advanced features & user management
- **Phase 3**: 📋 Security, compliance & production readiness
- **Phase 4**: 💰 Monetization & team features

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

For support, email support@rhodesign.com or create an issue in this repository.

---

Built with ❤️ by Matthew D.ign

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
