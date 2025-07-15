// cSpell:ignore firestore Firestore
import React, { createContext, useContext, useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";

const AuthContext = createContext();

export { AuthContext };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Create user profile in Firestore
  const createUserProfile = async (user, additionalData = {}) => {
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      const { displayName, email, photoURL } = user;
      const profile = {
        displayName:
          displayName || additionalData.displayName || email.split("@")[0],
        email,
        photoURL: photoURL || null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        role: "user",
        plan: "free",
        settings: {
          emailNotifications: true,
          documentReminders: true,
          theme: "light",
        },
        onboardingCompleted: false,
        ...additionalData,
      };

      try {
        await setDoc(userRef, profile);
        setUserProfile(profile);
      } catch (error) {
        console.error("Error creating user profile:", error);
        throw error;
      }
    } else {
      setUserProfile({ id: userDoc.id, ...userDoc.data() });
    }
  };

  // Sign up with email and password
  const signUp = async (email, password, displayName) => {
    try {
      setAuthError(null);
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Update display name
      if (displayName) {
        await updateProfile(user, { displayName });
      }

      // Create user profile
      await createUserProfile(user, { displayName });

      return user;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  };

  // Sign in with email and password
  const signIn = async (email, password) => {
    try {
      setAuthError(null);
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      return user;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    try {
      setAuthError(null);
      const provider = new GoogleAuthProvider();
      const { user } = await signInWithPopup(auth, provider);
      await createUserProfile(user);
      return user;
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  };

  // Sign out
  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  };

  // Reset password
  const resetPassword = async (email) => {
    try {
      setAuthError(null);
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  };

  // Update user profile
  const updateUserProfile = async (updates) => {
    if (!user) return;

    try {
      const userRef = doc(db, "users", user.uid);
      const updatedData = {
        ...updates,
        updatedAt: serverTimestamp(),
      };

      await updateDoc(userRef, updatedData);
      setUserProfile((prev) => ({ ...prev, ...updatedData }));

      // Update Firebase Auth profile if display name or photo changed
      if (updates.displayName || updates.photoURL) {
        await updateProfile(user, {
          displayName: updates.displayName || user.displayName,
          photoURL: updates.photoURL || user.photoURL,
        });
      }
    } catch (error) {
      setAuthError(error.message);
      throw error;
    }
  };

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user);
        try {
          await createUserProfile(user);
        } catch (error) {
          console.error("Error loading user profile:", error);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    user,
    userProfile,
    loading,
    authError,
    signUp,
    signIn,
    signInWithGoogle,
    logout,
    resetPassword,
    updateUserProfile,
    createUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// Custom hook to use the AuthContext
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
