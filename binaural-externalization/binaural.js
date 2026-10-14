// Binaural Externalization Page JavaScript
// This script handles the interactive functionality for the binaural externalization demonstration page

document.addEventListener('DOMContentLoaded', () => {
  console.log('Binaural Externalization page loaded');
  
  // Initialize all functionality
  // Note: Theme toggle is handled by main.js to avoid conflicts
  initializeIntersectionObserver();
  initializeAudioPlayers(); // Initialize existing audio players first
  initializeComparisonGrid(); // This will create new ones and initialize them
  
  // Handle initial hash navigation
  handleInitialHash();

  if (window.AlphaVideoSupport && typeof window.AlphaVideoSupport.applySources === 'function') {
    window.AlphaVideoSupport.applySources();
  }
});



/**
 * Initialize custom audio players
 */
function initializeAudioPlayers() {
  const audioPlayers = document.querySelectorAll('.custom-audio-player:not([data-initialized])');
  
  audioPlayers.forEach(player => {
    const audio = player.querySelector('audio');
    const playPauseBtn = player.querySelector('.play-pause-btn');
    const playIcon = player.querySelector('.play-icon');
    const pauseIcon = player.querySelector('.pause-icon');
    const progressBar = player.querySelector('.audio-progress-bar');
    const progressFill = player.querySelector('.audio-progress-fill');
    const currentTimeSpan = player.querySelector('.current-time');
    const totalTimeSpan = player.querySelector('.total-time');
    
    if (!audio || !playPauseBtn) return;
    
    // Mark as initialized to avoid double-initialization
    player.setAttribute('data-initialized', 'true');
    
    // Ensure all other audio players are paused when one starts playing
    const pauseOtherPlayers = () => {
      document.querySelectorAll('.custom-audio-player audio').forEach(otherAudio => {
        if (otherAudio !== audio && !otherAudio.paused) {
          otherAudio.pause();
        }
      });
    };
    
    // Update play/pause button states
    const updatePlayPauseButtons = () => {
      document.querySelectorAll('.custom-audio-player').forEach(otherPlayer => {
        const otherAudio = otherPlayer.querySelector('audio');
        const otherPlayIcon = otherPlayer.querySelector('.play-icon');
        const otherPauseIcon = otherPlayer.querySelector('.pause-icon');
        
        if (otherAudio && otherAudio.paused) {
          if (otherPlayIcon) otherPlayIcon.style.display = 'block';
          if (otherPauseIcon) otherPauseIcon.style.display = 'none';
        } else if (otherAudio && !otherAudio.paused) {
          if (otherPlayIcon) otherPlayIcon.style.display = 'none';
          if (otherPauseIcon) otherPauseIcon.style.display = 'block';
        }
      });
    };
    
    // Play/Pause button click handler
    const playPauseHandler = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (audio.paused) {
        pauseOtherPlayers();
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error('Audio play failed:', error);
          });
        }
      } else {
        audio.pause();
      }
    };
    
    playPauseBtn.addEventListener('click', playPauseHandler);
    
    // Audio event listeners
    audio.addEventListener('play', () => {
      updatePlayPauseButtons();
    });
    
    audio.addEventListener('pause', () => {
      updatePlayPauseButtons();
    });
    
    audio.addEventListener('timeupdate', () => {
      if (audio.duration && !isNaN(audio.duration)) {
        const progress = (audio.currentTime / audio.duration) * 100;
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (currentTimeSpan) currentTimeSpan.textContent = formatTime(audio.currentTime);
      }
    });
    
    audio.addEventListener('loadedmetadata', () => {
      if (totalTimeSpan && audio.duration && !isNaN(audio.duration)) {
        totalTimeSpan.textContent = formatTime(audio.duration);
      }
    });
    
    audio.addEventListener('durationchange', () => {
      if (totalTimeSpan && audio.duration && !isNaN(audio.duration)) {
        totalTimeSpan.textContent = formatTime(audio.duration);
      }
    });
    
    // Progress bar click handler
    if (progressBar) {
      progressBar.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (audio.duration && !isNaN(audio.duration)) {
          const rect = progressBar.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          audio.currentTime = percent * audio.duration;
        }
      });
    }
    
    // Audio ended handler
    audio.addEventListener('ended', () => {
      updatePlayPauseButtons();
      if (progressFill) progressFill.style.width = '0%';
      if (currentTimeSpan) currentTimeSpan.textContent = '00:00';
    });
    
    // Handle loading errors
    audio.addEventListener('error', (e) => {
      console.error('Audio loading error:', e, 'Source:', audio.src);
      console.error('Error details:', audio.error);
    });
    
    audio.addEventListener('loadstart', () => {
      console.log('Audio loading started:', audio.src);
    });
    
    audio.addEventListener('canplaythrough', () => {
      console.log('Audio can play through:', audio.src);
    });
    
    // Try to load metadata immediately
    if (audio.readyState >= 1) {
      console.log('Audio ready state >= 1:', audio.src, 'Duration:', audio.duration);
      if (totalTimeSpan && audio.duration && !isNaN(audio.duration)) {
        totalTimeSpan.textContent = formatTime(audio.duration);
      }
    } else {
      console.log('Loading audio:', audio.src);
      audio.load();
    }
  });
}

/**
 * Format time in MM:SS format
 */
function formatTime(seconds) {
  if (isNaN(seconds)) return '00:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
}

/**
 * Initialize Intersection Observer for fade-in effects
 */
function initializeIntersectionObserver() {
  const fadeElements = document.querySelectorAll('.fade-in-element');
  
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });
    
    fadeElements.forEach(element => {
      observer.observe(element);
    });
  } else {
    // Fallback for browsers without IntersectionObserver
    fadeElements.forEach(element => {
      element.classList.add('visible');
    });
  }
}

/**
 * Initialize simple grid comparison layout with audio samples
 */
function initializeComparisonGrid() {
  const comparisonGrid = document.querySelector('.comparison-grid');
  if (!comparisonGrid) return;
  
  const audio_dir = "../assets/binaural-externalization/audio/240622 - Tom's Diner";

  // Clear existing content and set up simple grid layout
  comparisonGrid.innerHTML = '';
  comparisonGrid.className = 'comparison-grid comparison-container';

  // Define the panel data for 3x5 grid layout
  const gridPanels = [
    // First: Rotating source (center of grid)
    { angle: 'rotating', label: 'Rotating Source (Clockwise)', isRotating: true },
    // Then all the static angles in the order they appear in the grid
    { angle: 0, label: 'Front 0°' },
    { angle: 30, label: '+30°' },
    { angle: 45, label: '+45°' },
    { angle: 90, label: '+90°' },
    { angle: 135, label: '+135°' },
    { angle: 150, label: '+150°' },
    { angle: 180, label: 'Behind 180°' },
    { angle: 210, label: '-150°' },
    { angle: 225, label: '-135°' },
    { angle: 270, label: '-90°' },
    { angle: 315, label: '-45°' },
    { angle: 330, label: '-30°' }
  ];

  // Create all panels
  gridPanels.forEach(item => {
    const panel = document.createElement('div');
    panel.className = `comparison-panel fade-in-element ${item.isRotating ? 'rotating' : ''}`;
    panel.setAttribute('data-angle', item.angle);
    
    let stereoUrl, binauralUrl, externalizedUrl;
    
    if (item.isRotating) {
      // Rotating source has different file names
      stereoUrl = `${audio_dir}/Tom_s Diner (loop) rotating.wav`;
      binauralUrl = `${audio_dir}/Tom_s Diner (loop) rotating, binaural.wav`;
      externalizedUrl = `${audio_dir}/Tom_s Diner (loop) rotating, binaural, externalized.wav`;
    } else {
      // Static angles use degree-based file names
      stereoUrl = `${audio_dir}/Tom_s Diner (loop) ${String(item.angle).padStart(3, '0')}_deg.wav`;
      binauralUrl = `${audio_dir}/Tom_s Diner (loop) ${String(item.angle).padStart(3, '0')}_deg, binaural.wav`;
      externalizedUrl = `${audio_dir}/Tom_s Diner (loop) ${String(item.angle).padStart(3, '0')}_deg, binaural, externalized.wav`;
    }
    
    panel.innerHTML = createAudioPlayerSection(item.label, stereoUrl, binauralUrl, externalizedUrl);
    comparisonGrid.appendChild(panel);
  });
  
  // Wait for DOM to be fully updated before initializing audio players
  setTimeout(() => {
    initializeAudioPlayers();
    if (window.AlphaVideoSupport && typeof window.AlphaVideoSupport.applySources === 'function') {
      window.AlphaVideoSupport.applySources(comparisonGrid);
    }
  }, 50);
  
  // Re-initialize intersection observer for new elements with a small delay
  setTimeout(() => {
    const newFadeElements = comparisonGrid.querySelectorAll('.fade-in-element');
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, {
        threshold: 0.05,
        rootMargin: '50px 0px 50px 0px'
      });
      
      newFadeElements.forEach(element => {
        observer.observe(element);
      });
    } else {
      // Fallback for browsers without IntersectionObserver
      newFadeElements.forEach(element => {
        element.classList.add('visible');
      });
    }
  }, 100);
}

/**
 * Create audio player section HTML for comparison panels
 */
function createAudioPlayerSection(title, stereoUrl, binauralUrl, externalizedUrl) {
  const titleTag = title.includes('Rotating') ? 'h4' : 'h5';
  
  // Debug: Creating audio section
  console.log('Creating audio section for:', title);
  
  return `
    <${titleTag}>${title}</${titleTag}>
    <div class="comparison-audio-players">
      <div class="comparison-player">
        <h6>Traditional Stereo (No Processing)</h6>
        <div class="custom-audio-player">
          <div class="audio-controls">
            <button class="play-pause-btn" aria-label="Play stereo audio" type="button">
              <svg class="play-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              <svg class="pause-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="display: none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <div class="audio-progress-container">
              <div class="audio-progress-bar">
                <div class="audio-progress-fill"></div>
              </div>
            </div>
            <div class="audio-time-display">
              <span class="current-time">00:00</span> / <span class="total-time">00:00</span>
            </div>
          </div>
          <audio preload="metadata" crossorigin="anonymous">
            <source src="${stereoUrl}" type="audio/wav">
            <source src="${stereoUrl}" type="audio/mpeg">
            Your browser does not support the audio element.
          </audio>
        </div>
      </div>
      <div class="comparison-player">
        <h6>Binaural Processing</h6>
        <div class="custom-audio-player">
          <div class="audio-controls">
            <button class="play-pause-btn" aria-label="Play binaural audio" type="button">
              <svg class="play-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              <svg class="pause-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="display: none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <div class="audio-progress-container">
              <div class="audio-progress-bar">
                <div class="audio-progress-fill"></div>
              </div>
            </div>
            <div class="audio-time-display">
              <span class="current-time">00:00</span> / <span class="total-time">00:00</span>
            </div>
          </div>
          <audio preload="metadata" crossorigin="anonymous">
            <source src="${binauralUrl}" type="audio/wav">
            <source src="${binauralUrl}" type="audio/mpeg">
            Your browser does not support the audio element.
          </audio>
        </div>
      </div>
      <div class="comparison-player">
        <h6>Externalized</h6>
        <div class="custom-audio-player">
          <div class="audio-controls">
            <button class="play-pause-btn" aria-label="Play externalized audio" type="button">
              <svg class="play-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              <svg class="pause-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="display: none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <div class="audio-progress-container">
              <div class="audio-progress-bar">
                <div class="audio-progress-fill"></div>
              </div>
            </div>
            <div class="audio-time-display">
              <span class="current-time">00:00</span> / <span class="total-time">00:00</span>
            </div>
          </div>
          <audio preload="metadata" crossorigin="anonymous">
            <source src="${externalizedUrl}" type="audio/wav">
            <source src="${externalizedUrl}" type="audio/mpeg">
            Your browser does not support the audio element.
          </audio>
        </div>
      </div>
    </div>
  `;
}

/**
 * Handle initial hash navigation
 */
function handleInitialHash() {
  if (window.location.hash) {
    const targetId = window.location.hash.substring(1);
    const targetElement = document.getElementById(targetId);
    
    if (targetElement) {
      // Smooth scroll to target after a short delay to ensure page is fully loaded
      setTimeout(() => {
        const headerHeight = 70; // Account for fixed header - matches main site
        const elementPosition = targetElement.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerHeight;
        
        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }, 100);
    }
  }
}

// Handle page visibility changes to pause audio when page is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Pause all audio when page becomes hidden
    document.querySelectorAll('audio').forEach(audio => {
      if (!audio.paused) {
        audio.pause();
      }
    });
  }
});

// Handle window resize to update layout-dependent functionality
window.addEventListener('resize', debounce(() => {
  // Update navigation highlighting
  const event = new Event('scroll');
  window.dispatchEvent(event);
}, 150)); 