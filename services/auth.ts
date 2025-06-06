import { supabase, checkNetworkConnection } from './supabase';
import { retryOperation } from '@/utils/retryOperation';
import * as SecureStore from 'expo-secure-store';
import { useClerk, useSignIn, useSignUp } from '@clerk/clerk-expo';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

export async function signUp(email: string, password: string, name: string) {
  try {
    const isConnected = await checkNetworkConnection();
    if (!isConnected) {
      throw new Error('No internet connection available');
    }

    const { signUp } = useSignUp();
    const { data: clerkUser, error: clerkError } = await signUp.create({
      emailAddress: email,
      password,
      firstName: name
    });

    if (clerkError) throw clerkError;

    await signUp.prepareEmailAddressVerification();

    const { data: { user }, error: signUpError } = await retryOperation(() => 
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            name: name,
          },
          emailRedirectTo: Platform.select({
            web: window.location.origin,
            default: 'expense-tracker://auth/callback',
          }),
        },
      })
    );

    if (signUpError) throw signUpError;
    if (!user) throw new Error('No user data returned');

    return { user, error: null };
  } catch (error: any) {
    console.error('SignUp error:', error);
    return { 
      user: null, 
      error: error.message || 'An unexpected error occurred during signup' 
    };
  }
}

export async function signIn(email: string, password: string) {
  try {
    const isConnected = await checkNetworkConnection();
    if (!isConnected) {
      throw new Error('No internet connection available');
    }

    const { signIn } = useSignIn();
    const { data: clerkSession, error: clerkError } = await signIn.create({
      identifier: email,
      password,
    });

    if (clerkError) throw clerkError;

    const { data, error } = await retryOperation(() =>
      supabase.auth.signInWithPassword({
        email,
        password,
      })
    );
    
    return { data, error };
  } catch (error: any) {
    console.error('SignIn error:', error);
    return { 
      data: null, 
      error: error.message || 'An unexpected error occurred during sign in' 
    };
  }
}

export async function signInWithGoogle() {
  try {
    const { signIn } = useSignIn();
    if (!signIn) throw new Error('Sign in not initialized');

    const { data, error } = await signIn.authenticateWithRedirect({
      strategy: "oauth_google",
      redirectUrl: Platform.select({
        web: `${window.location.origin}/auth/callback`,
        default: 'expense-tracker://oauth-callback'
      }),
      redirectUrlComplete: Platform.select({
        web: `${window.location.origin}/auth/callback-complete`,
        default: 'expense-tracker://oauth-callback-complete'
      }),
    });

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    console.error('Google SignIn error:', error);
    return {
      data: null,
      error: error.message || 'Failed to sign in with Google'
    };
  }
}

export async function signOut() {
  try {
    const isConnected = await checkNetworkConnection();
    if (!isConnected) {
      throw new Error('No internet connection available');
    }

    const { signOut } = useClerk();
    await signOut();
    return await retryOperation(() => supabase.auth.signOut());
  } catch (error: any) {
    console.error('SignOut error:', error);
    return { error: error.message || 'Failed to sign out' };
  }
}

export async function resetPassword(email: string) {
  try {
    const isConnected = await checkNetworkConnection();
    if (!isConnected) {
      throw new Error('No internet connection available');
    }

    const { signIn } = useSignIn();
    const { data, error } = await signIn.create({
      strategy: "reset_password_email_code",
      identifier: email,
    });
    
    return { data, error };
  } catch (error: any) {
    console.error('ResetPassword error:', error);
    return { data: null, error: error.message };
  }
}