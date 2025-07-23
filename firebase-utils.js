// Firebase Utilities - Modern Firebase v9+ Functions
// This file contains utility functions using the modular Firebase SDK

// Note: These functions are for reference and can be used if you upgrade to Firebase v9+
// Currently the app uses Firebase v8 compat mode for simplicity

import { getFirestore, collection, addDoc, Timestamp, doc, updateDoc, query, where, getDocs, orderBy } from "firebase/firestore";

const db = getFirestore();

// Book appointment with modern Firebase v9+ syntax
export const bookAppointment = async (studentId, teacherId, slotTime, additionalData = {}) => {
  try {
    const appointmentData = {
      studentId,
      teacherId,
      slotTime,
      status: "pending",
      createdAt: Timestamp.now(),
      ...additionalData
    };
    
    const docRef = await addDoc(collection(db, "appointments"), appointmentData);
    return docRef.id;
  } catch (error) {
    console.error('Error booking appointment:', error);
    throw error;
  }
};

// Respond to appointment (approve or reject)
export const respondToAppointment = async (appointmentId, decision, teacherData = {}) => {
  try {
    const updateData = {
      status: decision, // "approved" or "rejected"
      updatedAt: Timestamp.now(),
      ...teacherData
    };
    
    await updateDoc(doc(db, "appointments", appointmentId), updateData);
  } catch (error) {
    console.error(`Error ${decision} appointment:`, error);
    throw error;
  }
};

// Get student appointments
export const getStudentAppointments = async (studentId) => {
  try {
    const q = query(
      collection(db, "appointments"),
      where("studentId", "==", studentId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting student appointments:', error);
    throw error;
  }
};

// Get teacher appointments
export const getTeacherAppointments = async (teacherId) => {
  try {
    const q = query(
      collection(db, "appointments"),
      where("teacherId", "==", teacherId),
      orderBy("createdAt", "desc")
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting teacher appointments:', error);
    throw error;
  }
};

// Check if time slot is available
export const checkTimeSlotAvailability = async (teacherId, date, time) => {
  try {
    const q = query(
      collection(db, "appointments"),
      where("teacherId", "==", teacherId),
      where("date", "==", date),
      where("time", "==", time),
      where("status", "in", ["pending", "approved"])
    );
    const snapshot = await getDocs(q);
    return snapshot.empty; // Returns true if slot is available
  } catch (error) {
    console.error('Error checking time slot availability:', error);
    throw error;
  }
}; 