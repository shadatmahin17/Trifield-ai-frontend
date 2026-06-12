import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../lib/AuthContext.jsx'
import { motion } from 'motion/react'
import { Camera, User, FileText, Search, Shield, Save, CheckCircle, LogOut } from 'lucide-react'
import styles from './ProfilePage.module.css'

export default function ProfilePage() {
  const { user, profile, stats, updateProfile, isAdmin, signOut, changePassword } = useAuth()
  
  const [displayName, setDisplayName] = useState(profile?.displayName || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || '')
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  
  const fileInputRef = useRef()

  // Sync state when profile loads asynchronously from Firestore
  useEffect(() => {
    if (profile) {
      if (profile.displayName !== undefined) setDisplayName(profile.displayName)
      if (profile.bio !== undefined) setBio(profile.bio)
      if (profile.avatarUrl !== undefined) setAvatarUrl(profile.avatarUrl)
    }
  }, [profile])

  const compressAndSaveImage = (file) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const maxDim = 320 // Ideal resolution for an exquisite circular avatar
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height)
          // 0.8 quality produces incredibly crisp, optimized results well under 40KB
          const base64 = canvas.toDataURL('image/jpeg', 0.8)
          setAvatarUrl(base64)
          
          updateProfile({ avatarUrl: base64 })
            .then(() => {
              setSuccessMsg('Profile picture updated immediately!')
              setTimeout(() => setSuccessMsg(''), 3000)
            })
            .catch(err => {
              console.error('Error saving uploaded image:', err)
              setErrorMsg('Failed to save profile picture to server.')
            })
        } else {
          // Fallback if canvas context is unavailable
          setAvatarUrl(event.target.result)
          updateProfile({ avatarUrl: event.target.result })
            .then(() => {
              setSuccessMsg('Profile picture updated immediately!')
              setTimeout(() => setSuccessMsg(''), 3000)
            })
            .catch(err => {
              console.error('Error saving uploaded image:', err)
              setErrorMsg('Failed to save profile picture.')
            })
        }
      }
      img.onerror = () => {
        setErrorMsg('Failed to read image structure.')
      }
      img.src = event.target.result
    }
    reader.onerror = () => {
      setErrorMsg('Failed to read selected file.')
    }
    reader.readAsDataURL(file)
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file.')
      return
    }

    // Since we compress the image client-side to < 40KB, we can safely allow users
    // to pick files up to 10MB in size and seamlessly downscale them!
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Image file is too large (maximum 10MB allowed).')
      return
    }

    setErrorMsg('')
    setSuccessMsg('Processing and optimizing your image...')
    compressAndSaveImage(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      await updateProfile({
        displayName,
        bio,
        avatarUrl
      })
      setSuccessMsg('Profile information saved successfully!')
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred while saving.')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (!newPassword || !confirmPassword) {
      setErrorMsg('Please specify values for all password input fields.')
      return
    }
    if (newPassword.length < 6) {
      setErrorMsg('The new password must contain at least 6 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please verify correct matching entries.')
      return
    }

    setPasswordSaving(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      await changePassword(newPassword)
      setSuccessMsg('Your security credentials have been updated successfully!')
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setSuccessMsg(''), 4500)
    } catch (err) {
      console.error(err)
      setErrorMsg(err.message || 'Unable to update password. Please check your active session.')
    } finally {
      setPasswordSaving(false)
    }
  }

  // Animation Variant Declarations
  const listContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemFadeUp = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "tween", duration: 0.4 } }
  }

  return (
    <div className={styles.container}>
      {/* Animating Header Section */}
      <motion.header 
        className={styles.header}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <p className={styles.eyebrow}>Researcher Portal</p>
        <h1 className={styles.title}>Account Profile</h1>
        <p className={styles.subtitle}>
          Manage your research profile, view usage metrics, and change security credentials with terracotta design cues.
        </p>
      </motion.header>

      {/* Elegant pop-in banners for system alerts */}
      {successMsg && (
        <motion.div 
          className={styles.successBanner} 
          id="profile-success-alert"
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25 }}
        >
          <CheckCircle size={18} strokeWidth={2.5} />
          <span>{successMsg}</span>
        </motion.div>
      )}

      {errorMsg && (
        <motion.div 
          className={styles.errorBanner} 
          id="profile-error-alert"
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.25 }}
        >
          <span>⚠️ {errorMsg}</span>
        </motion.div>
      )}

      {/* Main Grid Deck */}
      <motion.div 
        className={styles.layout}
        variants={listContainer}
        initial="hidden"
        animate="show"
      >
        {/* Left Hand: Avatar Spotlight Card */}
        <motion.div className={styles.leftCol} variants={itemFadeUp}>
          <div className={styles.card}>
            <div className={styles.avatarSection}>
              <div className={styles.avatarContainer}>
                <div 
                  className={styles.avatarWrapper} 
                  onClick={() => fileInputRef.current?.click()}
                  title="Click to upload a profile picture"
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="User Avatar" className={styles.avatarImage} />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {displayName ? displayName[0]?.toUpperCase() : (user?.email ? user.email[0]?.toUpperCase() : 'U')}
                    </div>
                  )}
                  <div className={styles.avatarOverlay}>
                    <Camera size={20} />
                    <span>Upload Image</span>
                  </div>
                </div>
                <div className={styles.cameraIndicator}>
                  <Camera size={14} />
                </div>
              </div>

              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                style={{ display: 'none' }} 
              />

              <h2 className={styles.profileName}>{displayName || user?.email?.split('@')[0]}</h2>
              
              <div className={styles.profileRole}>
                {isAdmin ? (
                  <span className={styles.adminBadge}>
                    <Shield size={12} strokeWidth={2.5} />
                    WORKSPACE ADMIN
                  </span>
                ) : (
                  <span className={styles.researcherBadge}>FELLOW RESEARCHER</span>
                )}
              </div>
              <p className={styles.profileEmail}>{user?.email}</p>
            </div>

            <div className={styles.statsDivider} />

            {/* Premium Usage Analytics Bento Blocks */}
            <div className={styles.statsBox}>
              <h3 className={styles.statsSectionTitle}>Portal Access Metrics</h3>
              <div className={styles.metricRow}>
                <div className={styles.metricItem}>
                  <div className={styles.metricIconWrap} style={{ background: 'rgba(133, 72, 54, 0.08)' }}>
                    <Search size={16} style={{ color: '#854836' }} />
                  </div>
                  <div className={styles.metricContent}>
                    <span className={styles.metricValue}>{stats?.searchesCount ?? 0}</span>
                    <span className={styles.metricLabel}>Queries</span>
                  </div>
                </div>
                <div className={styles.metricItem}>
                  <div className={styles.metricIconWrap} style={{ background: 'rgba(255, 178, 44, 0.12)' }}>
                    <FileText size={16} style={{ color: '#854836' }} />
                  </div>
                  <div className={styles.metricContent}>
                    <span className={styles.metricValue}>{stats?.pdfsCount ?? 0}</span>
                    <span className={styles.metricLabel}>PDF Chats</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.statsDivider} />

            <button
              type="button"
              onClick={() => signOut()}
              className={styles.logoutButton}
            >
              <LogOut size={14} />
              <span>Sign Out of Portal</span>
            </button>
          </div>
        </motion.div>

        {/* Right Hand: Workspace Form Controls */}
        <div className={styles.rightCol}>
          <motion.div className={styles.card} variants={itemFadeUp} style={{ marginBottom: '24px' }}>
            <form onSubmit={handleSubmit} className={styles.form}>
              <h3 className={styles.formSectionTitle}>Identity Settings</h3>

              <div className={styles.formGroup}>
                <label className={styles.label}>Profile Display Name</label>
                <div className={styles.inputWrapper}>
                  <User size={16} className={styles.inputIcon} />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Dr. Mahin Aur"
                    className={styles.input}
                  />
                </div>
                <p className={styles.fieldHelp}>This name is displayed in your team logs, summaries, and greeting headers.</p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Biography / Area of Expertise</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Describe your research discipline, materials of interest, or aerospace affiliations..."
                  className={styles.textarea}
                  rows={4}
                />
                <p className={styles.fieldHelp}>Describe the branch of aerospace, physics, or physical chemistry you study.</p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className={styles.primaryButton}
              >
                <Save size={16} />
                {saving ? 'Saving changes...' : 'Save Profile Details'}
              </button>
            </form>
          </motion.div>

          {/* Security details configuration segment */}
          <motion.div className={styles.card} variants={itemFadeUp}>
            <form onSubmit={handlePasswordChange} className={styles.form}>
              <h3 className={styles.formSectionTitle}>Security Credentials</h3>

              <div className={styles.formGroup}>
                <label className={styles.label}>New Guard Password</label>
                <div className={styles.inputWrapper}>
                  <Shield size={16} className={styles.inputIcon} />
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Must contain at least 6 characters"
                    className={styles.input}
                  />
                </div>
                <p className={styles.fieldHelp}>Secure your active research credentials with a robust pattern.</p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Confirm Guard Password</label>
                <div className={styles.inputWrapper}>
                  <Shield size={16} className={styles.inputIcon} />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat the new password exactly"
                    className={styles.input}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={passwordSaving}
                className={styles.primaryButton}
              >
                <Shield size={16} />
                {passwordSaving ? 'Updating guards...' : 'Change Password'}
              </button>
            </form>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
