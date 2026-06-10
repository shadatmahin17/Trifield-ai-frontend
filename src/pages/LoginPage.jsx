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
    signIn 
  } = useAuth()

  // Auth States
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Feedback states
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [authLoading, setAuthLoading] = useState(false)

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setAuthLoading(true)

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
              {isRegistering ? 'Create Researcher Account' : 'Sign In to Workspace'}
            </h2>
          </div>

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

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Password
            </label>
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

          <button
            type="submit"
            disabled={authLoading}
            className={styles.primaryButton}
          >
            {authLoading ? (
              <div className={styles.spinner} />
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
        </form>
      </div>
    </div>
  )
}
