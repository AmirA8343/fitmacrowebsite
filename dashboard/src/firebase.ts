import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
// Public Firebase web configuration from the existing mobile app.
// Authentication only: this dashboard does not upload meals, profiles, or images.
const app = initializeApp({
  apiKey: 'AIzaSyBh4CLbH5Hwlnse29MhVTN9-6AhTR7pH9M',
  authDomain: 'fitmacro-e0d48.firebaseapp.com',
  projectId: 'fitmacro-e0d48',
  appId: '1:902658105073:web:92576145a0990a080e5350',
});
export const auth = getAuth(app);
