import { useState, useRef } from 'react'
import { useAuth } from '../lib/AuthContext.jsx'
import { Camera, User, FileText, Search, CreditCard, Shield, Save, CheckCircle } from 'lucide-react'
import styles from './ProfilePage.module.css'

export default function ProfilePage() {
  const { user, profile, stats, updateProfile, isAdmin, signOut } = useAuth()
  
  const [displayName, setDisplayName] = useState(profile.displayName || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl || '')
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  
  const fileInputRef = useRef()

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file.')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Image size must be less than 2MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result
      setAvatarUrl(base64)
      // Instant reload triggers for the user
      updateProfile({ avatarUrl: base64 }).catch(err => {
        console.error('Error saving uploaded image:', err)
      })
      setSuccessMsg('Profile picture updated immediately!')
      setTimeout(() => setSuccessMsg(''), 3000)
    }
    reader.onerror = () => {
      setErrorMsg('Failed to process image.')
    }
    reader.readAsDataURL(file)
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

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Researcher Portal</p>
        <h1 className={styles.title}>Account Profile</h1>
        <p className={styles.subtitle}>Manage your research identity, view usage statistics, and configure options.</p>
      </header>

      {successMsg && (
        <div className={styles.successBanner} id="profile-success-alert">
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className={styles.errorBanner} id="profile-error-alert">
          <span>⚠️ {errorMsg}</span>
        </div>
      )}

      <div className={styles.layout}>
        {/* Left Column: Avatar & Quick Info */}
        <div className={styles.leftCol}>
          <div className={styles.card}>
            <div className={styles.avatarSection}>
              <div 
                className={styles.avatarWrapper} 
                onClick={() => fileInputRef.current?.click()}
                title="Click to upload profile picture"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="User avatar" className={styles.avatarImage} />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    {displayName ? displayName[0]?.toUpperCase() : (user?.email ? user.email[0]?.toUpperCase() : 'U')}
                  </div>
                )}
                <div className={styles.avatarOverlay}>
                  <Camera size={18} />
                  <span>Upload</span>
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
              <p className={styles.profileRole}>
                {isAdmin ? (
                  <span className={styles.adminBadge}>
                    <Shield size={12} style={{ marginRight: '4px', display: 'inline' }} />
                    Admin
                  </span>
                ) : (
                  <span className={styles.researcherBadge}>Researcher</span>
                )}
              </p>
              <p className={styles.profileEmail}>{user?.email}</p>
            </div>

            <div className={styles.statsDivider} />

            {/* Quick Metrics */}
            <div className={styles.statsBox}>
              <h3 className={styles.statsSectionTitle}>Usage Metrics</h3>
              <div className={styles.metricRow}>
                <div className={styles.metricItem}>
                  <div className={styles.metricIconWrap} style={{ background: 'rgba(133, 72, 54, 0.08)' }}>
                    <Search size={15} style={{ color: '#854836' }} />
                  </div>
                  <div className={styles.metricContent}>
                    <span className={styles.metricValue}>{stats.searchesCount}</span>
                    <span className={styles.metricLabel}>Searches Run</span>
                  </div>
                </div>
                <div className={styles.metricItem}>
                  <div className={styles.metricIconWrap} style={{ background: 'rgba(255, 178, 44, 0.12)' }}>
                    <FileText size={15} style={{ color: '#854836' }} />
                  </div>
                  <div className={styles.metricContent}>
                    <span className={styles.metricValue}>{stats.pdfsCount}</span>
                    <span className={styles.metricLabel}>PDFs Chats</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.statsDivider} style={{ margin: '16px 0 12px 0' }} />
            <button
              type="button"
              onClick={() => signOut()}
              className={styles.logoutButton}
            >
              Sign Out of Account
            </button>
          </div>
        </div>

        {/* Right Column: Identity settings form */}
        <div className={styles.rightCol}>
          <div className={styles.card}>
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
                <p className={styles.fieldHelp}>This name is displayed in your workspace header and logs.</p>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Biography / Area of Expertise</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Describe your research discipline, materials of interest, or educational affiliations..."
                  className={styles.textarea}
                  rows={4}
                />
                <p className={styles.fieldHelp}>Brief bio describing what materials or aerospace branches you focus on.</p>
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
          </div>
        </div>
      </div>
    </div>
  )
}
