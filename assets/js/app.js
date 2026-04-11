function appState() {
  return {
    // UI
    tabs: ['Journal', 'Spark', 'Progress', 'Share'],
    iconMap: {
      'Journal': '/assets/icons/icons8-edit-pencil-50.png',
      'Spark': '/assets/icons/icons8-plus-50.png',
      'Progress': '/assets/icons/icons8-scroll-50.png',
      'Share': '/assets/icons/icons8-image-file-50.png'
    },
    activeTab: 'Journal',
    showPremiumModal: false,

    // State
    user: null,
    isPremium: false,
    logText: '',
    mood: null,
    saving: false,
    recentLogs: [],
    challenge: { text: '', done: false },
    monthSummary: '',
    summarizing: false,
    generating: false,
    analyzing: false,
    deferredPrompt: null,
    selectedTheme: 'default',
    customChallenges: [],
    // Toast
    showToast: false,
    toastMessage: '',
    toastType: 'info',


    get todayLabel() { return dayjs().format('MMM D, YYYY'); },
    get remaining() { return Math.max(0, 280 - (this.logText?.length || 0)); },
    get shareTitle() { return `Streak: ${this.recentLogs.length} days`; },
    get shareSubtitle() { return this.mood ? `Mood today: ${this.mood.label}` : 'Log daily • Tiny wins'; },
    get yearInReview() { return this.isPremium ? this.generateYearReview() : 'Upgrade to Premium for Year-in-Review'; },

    getMoodEmoji(mood) {
      if (!mood) return '';
      if (mood.emoji) return mood.emoji;
      // Fallback for old logs without emoji
      const emojiMap = {
        'positive': '😊',
        'negative': '😔',
        'neutral': '😐'
      };
      return emojiMap[mood.label] || '😐';
    },

    getChallengeType() {
      const text = (this.challenge.text || '').toLowerCase();
      if (text.includes('breath') || text.includes('meditate') || text.includes('calm')) return 'breathe';
      if (text.includes('walk') || text.includes('step') || text.includes('move')) return 'walk';
      if (text.includes('stretch') || text.includes('flex')) return 'stretch';
      if (text.includes('drink') || text.includes('water')) return 'drink';
      if (text.includes('call') || text.includes('message') || text.includes('contact')) return 'call';
      if (text.includes('jump') || text.includes('dance')) return 'jump';
      if (text.includes('smile') || text.includes('laugh')) return 'smile';
      return 'default'; // generic motion
    },

    async init() {
      // Capture install prompt
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt = e;
      });

      // Load saved theme
      const savedTheme = localStorage.getItem('selectedTheme');
      if (savedTheme) {
        this.selectedTheme = savedTheme;
        // Apply theme colors
        const themes = {
          'blue': { primary: '#0ea5e9', secondary: '#06b6d4', accent: '#0369a1' },
          'purple': { primary: '#a855f7', secondary: '#d946ef', accent: '#7e22ce' },
          'pink': { primary: '#ec4899', secondary: '#f43f5e', accent: '#be185d' },
          'green': { primary: '#10b981', secondary: '#14b8a6', accent: '#047857' }
        };
        const colors = themes[savedTheme] || themes['blue'];
        document.documentElement.style.setProperty('--color-primary', colors.primary);
        document.documentElement.style.setProperty('--color-secondary', colors.secondary);
        document.documentElement.style.setProperty('--color-accent', colors.accent);
      }

      // Listen for HF token saved event
      this._listenForHfToken();

      // Firebase auth listener
      onAuthChanged(async (u) => {
        this.user = u;
        if (u) {
          await this.loadRecent();
          this.renderStreak();
          await this.checkPremiumStatus();
          await this.loadCustomChallenges();
        } else {
          this.recentLogs = [];
          this.isPremium = false;
        }
      });
    },


    promptInstall() {
      if (this.deferredPrompt) {
        this.deferredPrompt.prompt();
        this.deferredPrompt = null;
      } else {
        this.showMessage('Install prompt not available yet. Try again from Chrome menu.', 'info');
      }
    },

    showMessage(msg, type = 'error', timeout = 6000) {
      console.log(`[Toast:${type}] ${msg}`);
      this.toastMessage = msg;
      this.toastType = type;
      this.showToast = true;
      if (timeout > 0) setTimeout(() => { this.showToast = false; }, timeout);
    },

    // Listen for HF token saved events to show a toast
    _listenForHfToken() {
      window.addEventListener('hf:tokenSaved', (e) => {
        const masked = e?.detail?.masked || 'saved';
        this.showMessage(`Hugging Face token saved (${masked}).`, 'info', 4000);
      });
    },


    async enableNotifications() {
      if (!this.user) { this.showMessage('Please sign in first.', 'warning'); return; }
      try {
        const token = await requestNotificationPermission();
        if (token) {
          this.showMessage('Notifications enabled! You\'ll get daily reminders.', 'info');
          // Track event
          if (window.firebase && window.firebase.analytics) {
            firebase.analytics().logEvent('notifications_enabled');
          }
        } else {
          this.showMessage('Notification permission denied.', 'warning');
        }
      } catch (e) {
        console.error(e);
        this.showMessage('Failed to enable notifications.', 'error');
      }
    },


    async signInAnon() { await signInAnonymously(); },
    async signOut() { await signOutUser(); },

    // Optional: Add Google Sign-In
    async signInWithGoogle() {
        try {
            await signInWithGoogle();
        } catch (error) {
            console.error('Google sign-in error:', error);
            alert('Google sign-in failed: ' + error.message);
        }
    },

    // Optional: Add Email/Password Sign-In
    async signInWithEmail() {
        const email = prompt('Enter your email:');
        const password = prompt('Enter your password:');
        if (email && password) {
            try {
                await signInWithEmailPassword(email, password);
            } catch (error) {
                console.error('Email sign-in error:', error);
                alert('Sign-in failed: ' + error.message);
            }
        }
    },

    async signUpWithEmail() {
        const email = prompt('Enter your email:');
        const password = prompt('Enter your password:');
        if (email && password) {
            try {
                await signUpWithEmailPassword(email, password);
            } catch (error) {
                console.error('Sign-up error:', error);
                alert('Sign-up failed: ' + error.message);
            }
        }
    },

    async analyzeMood() {
      this.analyzing = true;
      try {
        const res = await analyzeSentiment(this.logText);
        // Add emoji based on sentiment label
        const emojiMap = {
          'positive': '😊',
          'negative': '😔', 
          'neutral': '😐'
        };
        this.mood = {
          ...res,
          emoji: emojiMap[res.label] || '😐'
        };
        // Track event
        if (window.firebase && window.firebase.analytics) {
          firebase.analytics().logEvent('mood_analyzed', { label: res.label });
        }
      } catch (e) {
        console.error(e);
        // Show user-friendly message and use fallback
        this.showMessage('AI service unavailable — using fallback detection. Set HF token or use server proxy for full AI features.', 'warning');
        this.mood = { label: 'neutral', score: '0.50', emoji: '😐' };
      } finally {
        this.analyzing = false;
      }
    },

    async saveLog() {
      if (!this.user) {
        try {
          const cred = await signInAnonymously();
          // Ensure local state reflects auth result from credential
          this.user = cred.user || _auth?.currentUser;
          if (!this.user) { this.showMessage('Sign-in failed. Please try again.', 'error'); return; }
        } catch (e) {
          console.error('Sign-in error:', e);
          this.showMessage('Please sign in (anonymous is fine).', 'error');
          return;
        }
      }
      if (!this.logText || !this.logText.trim()) {
        this.showMessage('Please write something first.', 'warning');
        return;
      }
      this.saving = true;
      try {
        const timestamp = Date.now();
        await saveUserLog(this.user.uid, {
          text: this.logText,
          date: dayjs().format('YYYY-MM-DD'),
          mood: this.mood || null,
          createdAt: timestamp
        });
        // Track event
        if (window.firebase && window.firebase.analytics) {
          firebase.analytics().logEvent('log_saved', { has_mood: !!this.mood });
        }
        this.logText = '';
        this.mood = null;
        await this.loadRecent();
        this.renderStreak();
        this.showMessage('Entry saved!', 'info');
      } catch (e) {
        console.error(e);
        const msg = (e?.message || '').toLowerCase();
        if (msg.includes('permission-denied') || msg.includes('firestore')) {
          this.showMessage('Save failed: Firestore permission or network issue. Check Firebase configuration and internet connection.', 'error');
        } else {
          this.showMessage('Save failed. Check Firebase config or network.', 'error');
        }
      } finally {
        this.saving = false;
      }
    },


    async loadRecent() {
      try {
        if (!this.user) {
          console.warn('loadRecent called but user is not set');
          this.recentLogs = [];
          return;
        }
        this.recentLogs = await getRecentLogs(this.user.uid);
        console.log('Recent logs loaded:', this.recentLogs.length);
      } catch (e) {
        console.error('loadRecent failed', e);
        this.recentLogs = [];
        this.showMessage('Unable to load recent entries: Firestore offline or permission denied.', 'warning');
      }
    },

    async deleteLog(logId) {
      console.log('deleteLog called with ID:', logId);
      if (!this.user) {
        this.showMessage('Please sign in first.', 'warning');
        return;
      }
      if (!confirm('Are you sure you want to delete this entry?')) return;
      try {
        console.log('Starting delete for user:', this.user.uid);
        await deleteUserLog(this.user.uid, logId);
        console.log('Delete successful, reloading logs');
        await this.loadRecent();
        this.renderStreak();
        this.showMessage('Entry deleted.', 'info');
      } catch (e) {
        console.error('Delete error:', e);
        this.showMessage('Failed to delete: ' + (e.message || 'Unknown error'), 'error');
      }
    },

    async generateChallenge() {
      this.generating = true;
      try {
        const c = await generateChallenge();
        this.challenge = { text: c, done: false };
      } catch (e) {
        console.error(e);
        this.showMessage('Challenge generation failed — using fallback. Set HF token or use server proxy for full AI generation.', 'warning');
        // fallback handled by ai.js
      } finally {
        this.generating = false;
      }
    },

    async completeChallenge() {
      if (!this.challenge.text) return;
      if (!this.user) {
        try {
          const cred = await signInAnonymously();
          this.user = cred.user || _auth?.currentUser;
          if (!this.user) { this.showMessage('Please sign in to save challenge completion.', 'error'); return; }
        } catch (e) {
          this.showMessage('Please sign in to save challenge completion.', 'error');
          return;
        }
      }
      try {
        await saveChallengeCompletion(this.user.uid, {
          date: dayjs().format('YYYY-MM-DD'),
          text: this.challenge.text,
          completedAt: Date.now()
        });
        this.challenge.done = true;
        // Track event
        if (window.firebase && window.firebase.analytics) {
          firebase.analytics().logEvent('challenge_completed');
        }
        this.showMessage('Challenge saved!', 'info');
      } catch (e) {
        console.error(e);
        this.showMessage('Failed to save challenge. Check Firebase and network.', 'error');
      }
    },


    async summarizeMonth() {
      this.summarizing = true;
      try {
        const items = this.recentLogs; // simple for MVP
        this.monthSummary = await summarizeText(items.map(i => i.text).join('\n'));
      } catch (e) {
        console.error(e);
        this.showMessage('Summary failed — using fallback. Set HF token or use server proxy for better summaries.', 'warning');
      } finally {
        this.summarizing = false;
      }
    },


    renderStreak() {
      const el = document.getElementById('streakChart');
      if (!el) return;
      const days = [...Array(7)].map((_, i) => dayjs().subtract(6 - i, 'day').format('MM/DD'));
      const vals = days.map(d => this.recentLogs.some(r => dayjs(r.date).format('MM/DD') === d) ? 1 : 0);
      // Destroy previous chart instance if present
      if (this._streakChart) {
        try { this._streakChart.destroy(); } catch (e) { /* ignore */ }
      }
      this._streakChart = new Chart(el, {
        type: 'bar',
        data: { labels: days, datasets: [{ label: 'Logged', data: vals, backgroundColor: '#38bdf8' }] },
        options: { scales: { y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, max: 1 } } }
      });
    },


    async exportShareCard() {
      const node = document.getElementById('share-card');
      try {
        let canvas;
        try {
          canvas = await html2canvas(node, { backgroundColor: null, useCORS: true });
        } catch (e) {
          // retry with allowTaint if CORS issues
          canvas = await html2canvas(node, { backgroundColor: null, allowTaint: true });
        }
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url; a.download = 'dailyspark-card.png'; a.click();
        // Track event
        if (window.firebase && window.firebase.analytics) {
          firebase.analytics().logEvent('share_exported');
        }
      } catch (e) {
        console.error(e);
        this.showMessage('Export failed due to canvas restrictions. Try in production or take a screenshot as a workaround.', 'error');
      }
    },


    async upgradeToPremium() {
      if (!this.user) { this.showMessage('Please sign in first.', 'warning'); return; }
      // Initialize Stripe
      const stripe = Stripe('pk_test_51StmsxB81JvVxFdWCVBZz57Y8La3o9FBGQkUH0Kso3Y2Cez699o6zIctvbd2jXFACiH1QfjnlsPfsE1sqkf7CH9L00jpVxQWod');
      
      try {
        // Call Cloud Function to create Stripe session with user metadata
        const createSession = firebase.functions().httpsCallable('createCheckoutSession');
        const result = await createSession({ 
          userId: this.user.uid,
          priceId: 'price_1Stn9OB81JvVxFdWztWs0Hln'
        });
        
        // Redirect to Stripe Checkout
        const { sessionId } = result.data;
        await stripe.redirectToCheckout({ sessionId });
      } catch (e) {
        console.error('Upgrade error:', e);
        this.showMessage('Payment setup failed: ' + (e.message || 'Unknown error'), 'error');
      }
    },

    async checkPremiumStatus() {
      // Check if user has premium subscription
      const doc = await _db.collection('users').doc(this.user.uid).get();
      this.isPremium = doc.data()?.isPremium || false;
    },

    async loadCustomChallenges() {
      if (!this.isPremium) return;
      const snap = await _db.collection('users').doc(this.user.uid).collection('customChallenges').get();
      this.customChallenges = snap.docs.map(d => d.data());
    },

    generateYearReview() {
      const year = dayjs().year();
      const yearLogs = this.recentLogs.filter(log => dayjs(log.date).year() === year);
      const positiveDays = yearLogs.filter(log => log.mood?.label === 'positive').length;
      const totalDays = yearLogs.length;
      return `In ${year}, you logged ${totalDays} days with ${positiveDays} positive moods. Keep sparking!`;
    },

    async recoverStreak() {
      if (!this.isPremium) { this.showMessage('Premium feature', 'warning'); return; }
      if (!this.user) { this.showMessage('Please sign in first.', 'warning'); return; }
      
      try {
        // Create a recovery entry for yesterday
        const yesterday = dayjs().subtract(1, 'day');
        const recoveryLog = {
          text: '🔄 Streak recovery - missed day',
          date: yesterday.format('YYYY-MM-DD'),
          mood: { label: 'neutral', score: '0.50', emoji: '😐' },
          isRecovery: true,
          createdAt: Date.now()
        };
        
        await saveUserLog(this.user.uid, recoveryLog);
        await this.loadRecent();
        this.renderStreak();
        this.showMessage('Streak recovered! 🎉', 'info');
      } catch (e) {
        console.error('Streak recovery failed:', e);
        this.showMessage('Could not recover streak. Try again.', 'error');
      }
    },

    changeTheme(theme) {
      if (!this.isPremium) { this.showMessage('Premium feature', 'warning'); return; }
      this.selectedTheme = theme;
      
      // Apply theme by setting CSS variables
      const themes = {
        'blue': { primary: '#0ea5e9', secondary: '#06b6d4', accent: '#0369a1' },
        'purple': { primary: '#a855f7', secondary: '#d946ef', accent: '#7e22ce' },
        'pink': { primary: '#ec4899', secondary: '#f43f5e', accent: '#be185d' },
        'green': { primary: '#10b981', secondary: '#14b8a6', accent: '#047857' }
      };
      
      const colors = themes[theme] || themes['blue'];
      document.documentElement.style.setProperty('--color-primary', colors.primary);
      document.documentElement.style.setProperty('--color-secondary', colors.secondary);
      document.documentElement.style.setProperty('--color-accent', colors.accent);
      
      // Save preference
      localStorage.setItem('selectedTheme', theme);
      this.showMessage(`Theme changed to ${theme}! 🎨`, 'info');
    }
  }
}

// Alpine placeholder for [[ ... ]] interpolation
document.addEventListener('alpine:init', () => {
  Alpine.magic('state', () => appState());
});

// Simple helper to set HF token from UI if needed
window.setHfToken = function () {
  const current = localStorage.getItem('HF_TOKEN') || '';
  const token = prompt('Enter your Hugging Face token (starts with hf_)', current);
  if (token) {
    localStorage.setItem('HF_TOKEN', token.trim());
    // Mask first/last chars for console confirmation only
    const masked = token.trim().slice(0, 6) + '...' + token.trim().slice(-4);
    console.log('HF token saved:', masked);
    // Notify app state if available for user-friendly toast
    try { window.dispatchEvent(new CustomEvent('hf:tokenSaved', { detail: { masked } })); } catch (e) {}
    // Reload to pick up token immediately
    location.reload();
    return true;
  }
  return false;
}
