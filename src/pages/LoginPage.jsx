import React, { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  ArrowRight,
  LogIn,
  UserPlus
} from 'lucide-react'
import logoUrl from '../../logo.png'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const { 
    signUp, 
    signIn,
    signInWithGoogle,
    resetPassword
  } = useAuth()

  // Auth States
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Feedback states
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setError('')
    setSuccess('')
    setAuthLoading(true)
    try {
      await signInWithGoogle()
      setSuccess('Successfully signed in with Google! Preparing workspace...')
    } catch (err) {
      console.error(err)
      setError(err.message || 'Google Sign-In failed. Please try again.')
    } finally {
      setAuthLoading(false)
    }
  }

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setAuthLoading(true)

    if (isResettingPassword) {
      if (!email) {
        setError('Please enter your email address to reset your password.')
        setAuthLoading(false)
        return
      }

      try {
        await resetPassword(email)
        setSuccess('A secure password reset link has been dispatched to your email address!')
      } catch (err) {
        console.error(err)
        setError(err.message || 'Unable to execute password reset. Please verify registration.')
      } finally {
        setAuthLoading(false)
      }
      return
    }

    if (!email || !password) {
      setError('Please fill in both email and password fields.')
      setAuthLoading(false)
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      setAuthLoading(false)
      return
    }

    try {
      if (isRegistering) {
        await signUp(email, password)
        setSuccess('Account created successfully! You can now log in.')
        setEmail('')
        setPassword('')
        setIsRegistering(false)
      } else {
        await signIn(email, password)
        setSuccess('Welcome back! Logging you in...')
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Authentication failed. Please check your credentials.')
    } finally {
      setAuthLoading(false)
    }
  }

  return (
    <div className={styles.loginScreen}>
      <div className={styles.glowingBackground} />
      
      <div className={styles.card}>
        {/* Header with App Logo */}
        <div className={styles.header}>
          <div className={styles.logoContainer}>
            <img src={logoUrl} alt="TriField AI" className={styles.brandLogo} />
          </div>
          <p className={styles.brandSubtitle}>
            Research Intelligence Workspace
          </p>
        </div>

        {/* Global Feedback Banners */}
        {error && (
          <div className={styles.errorBanner} id="login-error-alert">
            <AlertCircle className={styles.feedbackIcon} size={18} />
            <span className={styles.feedbackText}>{error}</span>
          </div>
        )}

        {success && (
          <div className={styles.successBanner} id="login-success-alert">
            <CheckCircle2 className={styles.feedbackIcon} size={18} />
            <span className={styles.feedbackText}>{success}</span>
          </div>
        )}

        <form onSubmit={handleAuthSubmit} className={styles.form}>
          <div className={styles.formTitleRow}>
            <h2 className={styles.formTitle}>
              {isResettingPassword 
                ? 'Reset Your Password' 
                : isRegistering 
                  ? 'Create Researcher Account' 
                  : 'Sign In to Workspace'}
            </h2>
          </div>

          {isResettingPassword && (
            <p className={styles.infoText}>
              Enter your registered email address below, and we will send you secure instructions to reset your password.
            </p>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Email Address
            </label>
            <div className={styles.inputWrapper}>
              <Mail className={styles.inputIcon} size={18} />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="scientist@trifield.edu"
                className={styles.input}
              />
            </div>
          </div>

          {!isResettingPassword && (
            <div className={styles.formGroup}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className={styles.label}>
                  Password
                </label>
                {!isRegistering && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsResettingPassword(true)
                      setError('')
                      setSuccess('')
                    }}
                    className={styles.forgotLink}
                  >
                    Forgot?
                  </button>
                )}
              </div>
              <div className={styles.inputWrapper}>
                <Lock className={styles.inputIcon} size={14} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={styles.input}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className={styles.passwordToggle}
                  tabIndex="-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={authLoading}
            className={styles.primaryButton}
          >
            {authLoading ? (
              <div className={styles.spinner} />
            ) : isResettingPassword ? (
              <span>Send Reset Link</span>
            ) : isRegistering ? (
              <>
                <UserPlus size={16} /> 
                <span>Create Account</span>
              </>
            ) : (
              <>
                <span>Enter Workspace</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          {isResettingPassword ? (
            <footer className={styles.footerRow}>
              <button
                type="button"
                onClick={() => {
                  setIsResettingPassword(false)
                  setError('')
                  setSuccess('')
                }}
                className={styles.toggleBtn}
              >
                Back to Sign In
              </button>
            </footer>
          ) : (
            <footer className={styles.footerRow}>
              <span>
                {isRegistering ? 'Already have an account?' : 'New researcher?'}
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering)
                  setError('')
                  setSuccess('')
                }}
                className={styles.toggleBtn}
              >
                {isRegistering ? 'Sign In' : 'Create Credentials'}
              </button>
            </footer>
          )}

          {!isResettingPassword && (
            <>
              <div className={styles.dividerRow}>or</div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className={styles.googleButton}
              >
                <svg className={styles.googleIcon} viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                <span>Sign In with Google</span>
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  )
}
