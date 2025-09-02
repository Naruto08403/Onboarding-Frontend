const admin = require('firebase-admin');
const { getStorage } = require('firebase-admin/storage');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');
require('dotenv').config();

// Firebase configuration
let firebaseApp = null;
let firestore = null;
let storage = null;
let auth = null;

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  try {
    if (firebaseApp) {
      return firebaseApp;
    }

    // Check if service account key is provided
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        
        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
          projectId: process.env.FIREBASE_PROJECT_ID
        });
      } catch (parseError) {
        console.warn('⚠️ Firebase service account key parsing failed:', parseError.message);
        console.warn('⚠️ Firebase integration not available');
        return null;
      }
    } else if (process.env.FIREBASE_PROJECT_ID) {
      // Use default credentials (for Google Cloud environments)
      firebaseApp = admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET
      });
    } else {
      console.warn('⚠️ Firebase not configured. Set FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID');
      console.warn('⚠️ Firebase integration not available');
      return null;
    }

    // Initialize services
    firestore = getFirestore(firebaseApp);
    storage = getStorage(firebaseApp);
    auth = getAuth(firebaseApp);

    console.log('✅ Firebase initialized successfully');
    return firebaseApp;
  } catch (error) {
    console.warn('⚠️ Firebase initialization failed:', error.message);
    console.warn('⚠️ Firebase integration not available');
    return null;
  }
};

// Firebase Authentication Service
class FirebaseAuthService {
  // Verify Firebase ID token
  static async verifyIdToken(idToken) {
    try {
      if (!auth) {
        throw new Error('Firebase not initialized');
      }

      const decodedToken = await auth.verifyIdToken(idToken);
      return {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        phoneNumber: decodedToken.phone_number,
        displayName: decodedToken.name,
        photoURL: decodedToken.picture,
        claims: decodedToken.claims || {}
      };
    } catch (error) {
      console.error('Firebase token verification failed:', error.message);
      throw new Error('Invalid Firebase token');
    }
  }

  // Create custom token
  static async createCustomToken(uid, claims = {}) {
    try {
      if (!auth) {
        throw new Error('Firebase not initialized');
      }

      const customToken = await auth.createCustomToken(uid, claims);
      return customToken;
    } catch (error) {
      console.error('Firebase custom token creation failed:', error.message);
      throw error;
    }
  }

  // Set custom user claims
  static async setCustomUserClaims(uid, claims) {
    try {
      if (!auth) {
        throw new Error('Firebase not initialized');
      }

      await auth.setCustomUserClaims(uid, claims);
      return true;
    } catch (error) {
      console.error('Firebase set custom claims failed:', error.message);
      throw error;
    }
  }

  // Get user by UID
  static async getUser(uid) {
    try {
      if (!auth) {
        throw new Error('Firebase not initialized');
      }

      const userRecord = await auth.getUser(uid);
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        phoneNumber: userRecord.phoneNumber,
        displayName: userRecord.displayName,
        photoURL: userRecord.photoURL,
        disabled: userRecord.disabled,
        customClaims: userRecord.customClaims,
        metadata: {
          creationTime: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime
        }
      };
    } catch (error) {
      console.error('Firebase get user failed:', error.message);
      throw error;
    }
  }

  // Create user
  static async createUser(userData) {
    try {
      if (!auth) {
        throw new Error('Firebase not initialized');
      }

      const userRecord = await auth.createUser({
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
        phoneNumber: userData.phoneNumber,
        emailVerified: userData.emailVerified || false,
        disabled: userData.disabled || false
      });

      return {
        uid: userRecord.uid,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        phoneNumber: userRecord.phoneNumber,
        displayName: userRecord.displayName,
        photoURL: userRecord.photoURL,
        disabled: userRecord.disabled,
        metadata: {
          creationTime: userRecord.metadata.creationTime
        }
      };
    } catch (error) {
      console.error('Firebase create user failed:', error.message);
      throw error;
    }
  }

  // Update user
  static async updateUser(uid, updateData) {
    try {
      if (!auth) {
        throw new Error('Firebase not initialized');
      }

      const userRecord = await auth.updateUser(uid, updateData);
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        phoneNumber: userRecord.phoneNumber,
        displayName: userRecord.displayName,
        photoURL: userRecord.photoURL,
        disabled: userRecord.disabled,
        metadata: {
          creationTime: userRecord.metadata.creationTime,
          lastSignInTime: userRecord.metadata.lastSignInTime
        }
      };
    } catch (error) {
      console.error('Firebase update user failed:', error.message);
      throw error;
    }
  }

  // Delete user
  static async deleteUser(uid) {
    try {
      if (!auth) {
        throw new Error('Firebase not initialized');
      }

      await auth.deleteUser(uid);
      return true;
    } catch (error) {
      console.error('Firebase delete user failed:', error.message);
      throw error;
    }
  }

  // Send email verification
  static async sendEmailVerification(uid) {
    try {
      if (!auth) {
        throw new Error('Firebase not initialized');
      }

      const actionCodeSettings = {
        url: process.env.FRONTEND_URL + '/verify-email',
        handleCodeInApp: true
      };

      const link = await auth.generateEmailVerificationLink(
        (await auth.getUser(uid)).email,
        actionCodeSettings
      );

      return { link };
    } catch (error) {
      console.error('Firebase send email verification failed:', error.message);
      throw error;
    }
  }

  // Send password reset email
  static async sendPasswordResetEmail(email) {
    try {
      if (!auth) {
        throw new Error('Firebase not initialized');
      }

      const actionCodeSettings = {
        url: process.env.FRONTEND_URL + '/reset-password',
        handleCodeInApp: true
      };

      const link = await auth.generatePasswordResetLink(email, actionCodeSettings);
      return { link };
    } catch (error) {
      console.error('Firebase send password reset email failed:', error.message);
      throw error;
    }
  }
}

// Firebase Storage Service
class FirebaseStorageService {
  // Upload file to Firebase Storage
  static async uploadFile(fileBuffer, fileName, contentType, folder = 'uploads') {
    try {
      if (!storage) {
        throw new Error('Firebase not initialized');
      }

      const bucket = storage.bucket();
      const filePath = `${folder}/${Date.now()}_${fileName}`;
      const file = bucket.file(filePath);

      await file.save(fileBuffer, {
        metadata: {
          contentType: contentType
        }
      });

      // Make file publicly readable (optional)
      await file.makePublic();

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
      
      return {
        fileName: fileName,
        filePath: filePath,
        publicUrl: publicUrl,
        contentType: contentType,
        size: fileBuffer.length,
        bucket: bucket.name
      };
    } catch (error) {
      console.error('Firebase storage upload failed:', error.message);
      throw error;
    }
  }

  // Delete file from Firebase Storage
  static async deleteFile(filePath) {
    try {
      if (!storage) {
        throw new Error('Firebase not initialized');
      }

      const bucket = storage.bucket();
      const file = bucket.file(filePath);
      
      await file.delete();
      return true;
    } catch (error) {
      console.error('Firebase storage delete failed:', error.message);
      throw error;
    }
  }

  // Get file metadata
  static async getFileMetadata(filePath) {
    try {
      if (!storage) {
        throw new Error('Firebase not initialized');
      }

      const bucket = storage.bucket();
      const file = bucket.file(filePath);
      
      const [metadata] = await file.getMetadata();
      return metadata;
    } catch (error) {
      console.error('Firebase storage get metadata failed:', error.message);
      throw error;
    }
  }

  // Generate signed URL for private files
  static async generateSignedUrl(filePath, expirationMinutes = 60) {
    try {
      if (!storage) {
        throw new Error('Firebase not initialized');
      }

      const bucket = storage.bucket();
      const file = bucket.file(filePath);
      
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + (expirationMinutes * 60 * 1000)
      });

      return signedUrl;
    } catch (error) {
      console.error('Firebase storage generate signed URL failed:', error.message);
      throw error;
    }
  }
}

// Firebase Firestore Service
class FirebaseFirestoreService {
  // Add document to collection
  static async addDocument(collection, data) {
    try {
      if (!firestore) {
        throw new Error('Firebase not initialized');
      }

      const docRef = await firestore.collection(collection).add({
        ...data,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        id: docRef.id,
        ...data
      };
    } catch (error) {
      console.error('Firebase Firestore add document failed:', error.message);
      throw error;
    }
  }

  // Get document by ID
  static async getDocument(collection, docId) {
    try {
      if (!firestore) {
        throw new Error('Firebase not initialized');
      }

      const doc = await firestore.collection(collection).doc(docId).get();
      
      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data()
      };
    } catch (error) {
      console.error('Firebase Firestore get document failed:', error.message);
      throw error;
    }
  }

  // Update document
  static async updateDocument(collection, docId, data) {
    try {
      if (!firestore) {
        throw new Error('Firebase not initialized');
      }

      await firestore.collection(collection).doc(docId).update({
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('Firebase Firestore update document failed:', error.message);
      throw error;
    }
  }

  // Delete document
  static async deleteDocument(collection, docId) {
    try {
      if (!firestore) {
        throw new Error('Firebase not initialized');
      }

      await firestore.collection(collection).doc(docId).delete();
      return true;
    } catch (error) {
      console.error('Firebase Firestore delete document failed:', error.message);
      throw error;
    }
  }

  // Query documents
  static async queryDocuments(collection, queryOptions = {}) {
    try {
      if (!firestore) {
        throw new Error('Firebase not initialized');
      }

      let query = firestore.collection(collection);

      // Apply filters
      if (queryOptions.where) {
        queryOptions.where.forEach(condition => {
          query = query.where(condition.field, condition.operator, condition.value);
        });
      }

      // Apply ordering
      if (queryOptions.orderBy) {
        queryOptions.orderBy.forEach(order => {
          query = query.orderBy(order.field, order.direction || 'asc');
        });
      }

      // Apply limit
      if (queryOptions.limit) {
        query = query.limit(queryOptions.limit);
      }

      // Apply pagination
      if (queryOptions.startAfter) {
        query = query.startAfter(queryOptions.startAfter);
      }

      const snapshot = await query.get();
      const documents = [];

      snapshot.forEach(doc => {
        documents.push({
          id: doc.id,
          ...doc.data()
        });
      });

      return documents;
    } catch (error) {
      console.error('Firebase Firestore query documents failed:', error.message);
      throw error;
    }
  }
}

// Export services
module.exports = {
  initializeFirebase,
  FirebaseAuthService,
  FirebaseStorageService,
  FirebaseFirestoreService,
  getFirebaseApp: () => firebaseApp,
  getFirestore: () => firestore,
  getStorage: () => storage,
  getAuth: () => auth
}; 