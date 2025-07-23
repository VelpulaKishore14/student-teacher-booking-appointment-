# 🚨 EMERGENCY FIX - Permission Denied Error

## **IMMEDIATE SOLUTION:**

### **Step 1: Go to Firebase Console**
1. Open: https://console.firebase.google.com/
2. Select project: `appointment-hub-516ec`
3. Go to: **Firestore Database** → **Rules**

### **Step 2: Replace ALL Rules**
**DELETE everything** and paste this:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### **Step 3: Publish**
Click **"Publish"** button

## **What This Does:**
- ✅ Allows ALL operations (read/write) for everyone
- ✅ Fixes the permission error immediately
- ✅ Lets your app work right now

## **Why This Works:**
The error happens because your current rules are too restrictive. This simple rule allows everything temporarily.

## **After App Works:**
You can make rules more secure later, but this will get your app running immediately.

**DO THIS NOW - Your app will work in 30 seconds!** 🚀 