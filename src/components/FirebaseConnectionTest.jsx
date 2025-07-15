import React, { useState, useEffect } from "react";
// cSpell:ignore Firestore
import { db, storage } from "../firebase/config";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { CheckCircle, XCircle, Loader, AlertTriangle } from "lucide-react";

export function FirebaseConnectionTest() {
  const [tests, setTests] = useState({
    firestore: { status: "pending", message: "Testing..." },
    storage: { status: "pending", message: "Testing..." },
  });

  useEffect(() => {
    runFirebaseTests();
  }, []);

  const runFirebaseTests = async () => {
    // Test Firestore
    try {
      // Try to read from a test collection
      const testCollection = collection(db, "connection-test");
      await getDocs(testCollection);

      // Try to write a test document
      await addDoc(testCollection, {
        test: true,
        timestamp: new Date(),
        message: "Firebase connection test",
      });

      setTests((prev) => ({
        ...prev,
        firestore: {
          status: "success",
          message: "Firestore connected successfully!",
        },
      }));
    } catch (error) {
      console.error("Firestore test failed:", error);
      setTests((prev) => ({
        ...prev,
        firestore: {
          status: "error",
          message: `Firestore error: ${error.message}`,
        },
      }));
    }

    // Test Storage
    try {
      // Create a small test file
      const testData = new Blob(["Firebase storage test"], {
        type: "text/plain",
      });
      const testRef = ref(storage, `test/connection-test-${Date.now()}.txt`);

      const snapshot = await uploadBytes(testRef, testData);
      const downloadURL = await getDownloadURL(snapshot.ref);

      if (downloadURL) {
        setTests((prev) => ({
          ...prev,
          storage: {
            status: "success",
            message: "Storage connected successfully!",
          },
        }));
      }
    } catch (error) {
      console.error("Storage test failed:", error);
      setTests((prev) => ({
        ...prev,
        storage: {
          status: "error",
          message: `Storage error: ${error.message}`,
        },
      }));
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "error":
        return <XCircle className="w-5 h-5 text-red-600" />;
      case "pending":
        return <Loader className="w-5 h-5 text-blue-600 animate-spin" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "success":
        return "bg-green-50 border-green-200";
      case "error":
        return "bg-red-50 border-red-200";
      case "pending":
        return "bg-blue-50 border-blue-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Firebase Connection Status
      </h3>

      <div className="space-y-3">
        <div
          className={`p-3 rounded-lg border ${getStatusColor(
            tests.firestore.status
          )}`}
        >
          <div className="flex items-center">
            {getStatusIcon(tests.firestore.status)}
            <div className="ml-3">
              <p className="font-medium text-gray-900">Firestore Database</p>
              <p className="text-sm text-gray-600">{tests.firestore.message}</p>
            </div>
          </div>
        </div>

        <div
          className={`p-3 rounded-lg border ${getStatusColor(
            tests.storage.status
          )}`}
        >
          <div className="flex items-center">
            {getStatusIcon(tests.storage.status)}
            <div className="ml-3">
              <p className="font-medium text-gray-900">Firebase Storage</p>
              <p className="text-sm text-gray-600">{tests.storage.message}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <div className="flex items-start">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div className="ml-3">
            <p className="text-sm font-medium text-yellow-800">
              Important Setup Notes:
            </p>
            <ul className="text-sm text-yellow-700 mt-1 space-y-1">
              <li>
                • Make sure Firestore Database is enabled in Firebase Console
              </li>
              <li>
                • Make sure Firebase Storage is enabled in Firebase Console
              </li>
              <li>
                • Security rules may need to be configured for production use
              </li>
              <li>
                • This test creates temporary data that can be safely deleted
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <button
          onClick={runFirebaseTests}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
        >
          Run Tests Again
        </button>
      </div>
    </div>
  );
}

export default FirebaseConnectionTest;
