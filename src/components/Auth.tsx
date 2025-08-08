import React from 'react'
import { Auth as SupabaseAuth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'

const Auth: React.FC = () => {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome to TLDW</h1>
          <p className="text-gray-600 text-sm">
            Sign in or create an account to access exercise extraction features
          </p>
        </div>
        
        <SupabaseAuth
          supabaseClient={supabase}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: '#10b981',
                  brandAccent: '#059669',
                  brandButtonText: 'white',
                  defaultButtonBackground: '#f9fafb',
                  defaultButtonBackgroundHover: '#f3f4f6',
                  defaultButtonBorder: '#d1d5db',
                  defaultButtonText: '#374151',
                  dividerBackground: '#e5e7eb',
                  inputBackground: 'transparent',
                  inputBorder: '#d1d5db',
                  inputBorderHover: '#9ca3af',
                  inputBorderFocus: '#10b981',
                  inputText: '#1f2937',
                  inputLabelText: '#374151',
                  inputPlaceholder: '#9ca3af',
                  messageText: '#374151',
                  messageTextDanger: '#dc2626',
                  anchorTextColor: '#10b981',
                  anchorTextHoverColor: '#059669',
                }
              }
            },
            className: {
              container: 'auth-container',
              button: 'auth-button',
              input: 'auth-input',
              label: 'auth-label',
            }
          }}
          providers={['google', 'github']}
          redirectTo={`${window.location.origin}`}
          onlyThirdPartyProviders={false}
          magicLink={true}
          showLinks={true}
          view="sign_in"
          localization={{
            variables: {
              sign_in: {
                email_label: 'Email address',
                password_label: 'Password',
                button_label: 'Sign In',
                loading_button_label: 'Signing In...',
                social_provider_text: 'Sign in with {{provider}}',
                link_text: "Don't have an account? Sign up",
              },
              sign_up: {
                email_label: 'Email address',
                password_label: 'Password',
                button_label: 'Sign Up',
                loading_button_label: 'Signing Up...',
                social_provider_text: 'Sign up with {{provider}}',
                link_text: 'Already have an account? Sign in',
                confirmation_text: 'Check your email for the confirmation link',
              },
              magic_link: {
                email_input_label: 'Email address',
                button_label: 'Send Magic Link',
                loading_button_label: 'Sending Magic Link...',
                link_text: 'Send a magic link email',
                confirmation_text: 'Check your email for the magic link',
              },
            },
          }}
        />
        
        <div className="mt-4 text-center text-xs text-gray-500">
          <p className="mb-2">
            By signing in or creating an account, you agree to our Terms of Service and Privacy Policy
          </p>
          <div className="pt-2 border-t border-gray-200">
            <p className="font-medium text-gray-600">
              🎯 New to TLDW? Click "Don't have an account? Sign up" to get started!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Auth