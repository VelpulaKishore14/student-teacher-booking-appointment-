# 🚀 Quick Start Guide - Get Your App Running in 5 Minutes

## ⚡ **Step 1: Test Your Firebase Setup (2 minutes)**

1. **Open the test page**: Open `firebase-test.html` in your browser
2. **Click "Run All Tests"** to check your Firebase configuration
3. **Fix any errors** that appear in the test results

## ⚡ **Step 2: Update Firebase Security Rules (1 minute)**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `appointment-hub-516ec`
3. Go to **Firestore Database** → **Rules**
4. **DELETE** all existing rules
5. **PASTE** this rule:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```
6. Click **Publish**

## ⚡ **Step 3: Create Collections (1 minute)**

In Firebase Console → Firestore Database → **Start collection**:
- `users`
- `teacherSchedules`
- `appointments`
- `messages`
- `logs`

## ⚡ **Step 4: Enable Services (1 minute)**

1. **Authentication**: Firebase Console → Authentication → Get started → Enable Email/Password
2. **Firestore**: Firebase Console → Firestore Database → Create database → Start in test mode

## ✅ **Test Your App**

1. Open `index.html` in your browser
2. Try to register a new user
3. Try to login
4. Test teacher search
5. Test appointment booking

## 🎯 **Expected Results**

After completing these steps:
- ✅ No permission denied errors
- ✅ No collection not found errors
- ✅ No network timeout errors
- ✅ App loads without console errors
- ✅ Users can register and login
- ✅ Teacher search works
- ✅ Appointment booking works

## 🆘 **If You Still Get Errors**

### **Permission Denied**
- Make sure security rules are published
- Check if you're logged in to the app
- Verify Authentication is enabled

### **Collection Not Found**
- Manually create all 5 collections
- Add a test document to each collection
- Check if Firestore is enabled

### **Network Errors**
- Check internet connection
- Try refreshing the page
- Clear browser cache
- Check [Firebase Status](https://status.firebase.google.com/)

## 📞 **Need Help?**

1. **Run the test page** (`firebase-test.html`) to identify specific issues
2. **Check the console** for error messages
3. **Follow the detailed guides**:
   - `FIREBASE_ERROR_FIXES.md` - Complete error solutions
   - `firebase-setup-guide.md` - Detailed setup instructions
   - `firebase-security-rules.txt` - Security rules reference

## 🎉 **Success!**

Once everything works:
- Test all app features
- Create test users (student, teacher, admin)
- Deploy to Firebase Hosting (optional)

**Your Student-Teacher Booking System is now ready to use!** 🚀 