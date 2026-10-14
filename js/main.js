// Ensure section backgrounds are visible before DOM is fully loaded
(function() {
  // Make backgrounds visible immediately for hash navigation
  if (window.location.hash) {
    document.documentElement.style.scrollBehavior = 'auto';
    
    // Try to add a class to body as early as possible
    if (document.body) {
      document.body.classList.add('hash-navigation');
    } else {
      // If body isn't ready, use this trick
      document.addEventListener('DOMContentLoaded', () => {
        document.body.classList.add('hash-navigation');
      });
    }
  }
})();

const AlphaVideoSupport = (() => {
  if (typeof window !== 'undefined' && window.AlphaVideoSupport) {
    return window.AlphaVideoSupport;
  }

  let cachedShouldUseMov;

  const shouldUseMov = () => {
    if (cachedShouldUseMov !== undefined) {
      return cachedShouldUseMov;
    }

    if (typeof navigator === 'undefined') {
      cachedShouldUseMov = false;
      return cachedShouldUseMov;
    }

    const ua = navigator.userAgent || '';
    const vendor = navigator.vendor || '';

    const isIOS = /iP(?:hone|ad|od)/.test(ua);
    const isWebKit = /WebKit/.test(ua);
    const isChromeLike = /Chrome|CriOS|Chromium|Edg|OPR|FxiOS|EdgiOS/.test(ua);
    const isSafari = /Safari/.test(ua) && !isChromeLike;
    const isAppleVendor = /Apple/i.test(vendor);

    cachedShouldUseMov = (isIOS && isWebKit) || (isAppleVendor && isSafari);
    return cachedShouldUseMov;
  };

  const applySources = (root = document) => {
    const useMov = shouldUseMov();
    if (!root || typeof root.querySelectorAll !== 'function') {
      return;
    }

    root.querySelectorAll('video.alpha-video').forEach(video => {
      const movSrc = video.dataset.mov;
      const webmSrc = video.dataset.webm;
      const targetSrc = useMov ? movSrc || webmSrc : webmSrc || movSrc;

      if (!targetSrc) {
        return;
      }

      let sourceEl = video.querySelector('source.alpha-source');
      if (!sourceEl) {
        sourceEl = document.createElement('source');
        sourceEl.className = 'alpha-source';
        video.insertBefore(sourceEl, video.firstChild || null);
      }

      if (sourceEl.getAttribute('data-active-src') === targetSrc) {
        return;
      }

      const mimeType = useMov ? 'video/mp4; codecs="hvc1"' : 'video/webm';
      sourceEl.setAttribute('src', targetSrc);
      sourceEl.setAttribute('type', mimeType);
      sourceEl.setAttribute('data-active-src', targetSrc);

      // Reload to ensure the new source is used
      video.load();

      if (video.autoplay) {
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {});
        }
      }
    });
  };

  const api = {
    shouldUseMov,
    applySources
  };
  if (typeof window !== 'undefined') {
    window.AlphaVideoSupport = api;
  }
  return api;
})();

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, using hardcoded content for now...');
  
  // Check if we're loading with a hash in the URL
  if (window.location.hash) {
    document.body.classList.add('hash-navigation');
    
    // Force background visibility immediately
    document.querySelectorAll('.section').forEach(section => {
      section.classList.add('bg-visible');
    });
  }
  
  // Apply alpha video source handling for platforms without WebM alpha support
  AlphaVideoSupport.applySources();

  // Initialize GitHub stats directly without requiring content.json
  initGitHubStats();

  // Set up Intersection Observer for section fade-in
  setupIntersectionObserver();

  // Set up mobile navigation
  setupMobileNav();

  // Set up back-to-top button
  setupBackToTop();



  // Set up contact form
  setupContactForm();

  // Set up smooth scrolling for navigation links
  setupSmoothScrolling();

  // Handle URL hash on page load
  handleInitialHash();
  
  // Set up clickable videos
  setupClickableVideos();
  
  // Set up the sea-of-code wave animation
  initHeroCodeSea();
  
  // Set up interests carousel
  setupInterestsCarousel();
  
  // Add window resize handler to check for newly visible elements
  window.addEventListener('resize', debounce(checkForVisibleElements, 150));

  // Theme Toggle Functionality
  const themeToggleButton = document.getElementById('theme-toggle');
  const lightIcon = document.querySelector('.theme-icon-light');
  const darkIcon = document.querySelector('.theme-icon-dark');
  const htmlElement = document.documentElement; // Gets the <html> element

  // Reset when the embed reloads (theme switches rebuild the iframe src).
  let embedHasLiveHeight = false;

  const initializeTinyAudioEmbedResizer = () => {
    const iframe = document.getElementById('tiny-audio-diffusion-embed');
    if (!iframe) return;

    const iframeOrigin = 'https://crlandsc-tiny-audio-diffusion.hf.space';

    const getFallbackHeight = () => {
      const iframeWidth = iframe.clientWidth || window.innerWidth || 1200;
      if (iframeWidth >= 1000) return 760; // desktop two-column layout
      if (iframeWidth >= 700) return 860;  // tablet
      return 980; // phone single-column layout
    };

    const applyHeight = (height) => {
      const nextHeight = Number(height);
      // Gradio posts a tiny height while the app is still on the Loading
      // screen. Ignore those so we do not lock in 100px before hydration.
      if (!Number.isFinite(nextHeight) || nextHeight < 400) return;
      embedHasLiveHeight = true;
      iframe.style.height = `${Math.ceil(nextHeight)}px`;
    };

    const applyFallbackHeight = () => {
      if (embedHasLiveHeight) return;
      iframe.style.height = `${getFallbackHeight()}px`;
    };

    // The Space measures its own Gradio container and posts the height here,
    // because the embedded document cannot shrink itself once the iframe grows.
    window.addEventListener('message', (event) => {
      if (event.origin !== iframeOrigin) return;
      const data = event.data;
      if (!data || data.source !== 'tiny-audio-diffusion' || data.type !== 'resize') return;
      applyHeight(data.height);
    });

    applyFallbackHeight();
    iframe.addEventListener('load', applyFallbackHeight);
    window.addEventListener('resize', applyFallbackHeight);
  };

  const syncGradioEmbedTheme = (theme) => {
    const iframe = document.getElementById('tiny-audio-diffusion-embed');
    if (!iframe) return;

    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    const url = new URL(iframe.src);
    if (url.searchParams.get('__theme') === nextTheme) return;
    url.searchParams.set('__theme', nextTheme);
    embedHasLiveHeight = false;
    iframe.src = url.toString();
  };

  initializeTinyAudioEmbedResizer();

  const applyTheme = (theme) => {
    if (theme === 'dark') {
      htmlElement.setAttribute('data-theme', 'dark');
      if (themeToggleButton) themeToggleButton.setAttribute('aria-label', 'Switch to light mode');
      if (lightIcon) lightIcon.style.display = 'none';
      if (darkIcon) darkIcon.style.display = 'block';
    } else {
      htmlElement.removeAttribute('data-theme'); // Remove attribute instead of setting to light
      if (themeToggleButton) themeToggleButton.setAttribute('aria-label', 'Switch to dark mode');
      if (lightIcon) lightIcon.style.display = 'block';
      if (darkIcon) darkIcon.style.display = 'none';
    }
    syncGradioEmbedTheme(theme);
  };

  // Get system preference using media query
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)');
  
  // Always start with current system preference (no persistence)
  applyTheme(systemPrefersDark.matches ? 'dark' : 'light');

  // Add theme toggle button click handler for temporary override
  if (themeToggleButton) {
    themeToggleButton.addEventListener('click', () => {
      // Get current theme
      const currentTheme = htmlElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      // Set new theme to the opposite (temporary override)
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      // Apply the new theme (no localStorage storage)
      applyTheme(newTheme);
    });
  }

  // Always listen for system preference changes and apply them immediately
  systemPrefersDark.addEventListener('change', (e) => {
    // Always follow system changes (override any manual selection)
    applyTheme(e.matches ? 'dark' : 'light');
  });

  // Ensure fade-in elements are correctly handled on load/theme change
  // This might need adjustment depending on how your existing fade-in logic works
  const fadeInElements = document.querySelectorAll('.fade-in-element');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  fadeInElements.forEach(el => observer.observe(el));
});

/**
 * Debounce function to prevent excessive function calls
 */
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this;
    const args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * Check for elements that are visible in the viewport but haven't been animated
 */
function checkForVisibleElements() {
  const elements = document.querySelectorAll('.fade-in-element:not(.visible)');
  
  elements.forEach(element => {
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.top > -rect.height) {
      element.classList.add('visible');
    }
  });

  // Also check for any new .project-card elements that might have been added
  const projectCards = document.querySelectorAll('.project-card:not(.fade-in-element)');
  if (projectCards.length > 0) {
    projectCards.forEach(card => {
      card.classList.add('fade-in-element');
      
      // If the card is already in the viewport, make it visible immediately
      const rect = card.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.top > -rect.height) {
        card.classList.add('visible');
      } else if ('IntersectionObserver' in window) {
        // Otherwise observe it for when it comes into view
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              setTimeout(() => {
                entry.target.classList.add('visible');
              }, 100);
              observer.unobserve(entry.target);
            }
          });
        }, {
          threshold: 0.1,
          rootMargin: '0px 0px -10% 0px'
        });
        
        observer.observe(card);
      }
    });
  }
}

/**
 * Handles initial page load with hash in URL
 */
function handleInitialHash() {
  // If page loads with a hash in URL, scroll to that section with proper offset
  if (window.location.hash) {
    const targetId = window.location.hash;
    const targetElement = document.querySelector(targetId);
    
    if (targetElement) {
      // First ensure all sections have fade-in-element class applied to subcomponents
      document.querySelectorAll('.section').forEach(section => {
        // Make sure all h3 elements are included for animation
        const h3Elements = section.querySelectorAll('h3');
        h3Elements.forEach(elem => {
          elem.classList.add('fade-in-element');
        });
      });
      
      // Make all sections' backgrounds visible
      document.querySelectorAll('.section').forEach(section => {
        section.classList.add('bg-visible');
      });

      // Immediately scroll to target section (without waiting)
      const rect = targetElement.getBoundingClientRect();
      const offset = rect.top + window.pageYOffset;
      
      window.scrollTo({
        top: offset - 70, // Exact match to header height
        behavior: 'auto' // Use 'auto' instead of 'smooth' for initial load
      });
      
      // After scrolling to the target, determine which elements are visible
      setTimeout(() => {
        // Make sections visible (this is important for section layout)
        const allSections = document.querySelectorAll('.section');
        allSections.forEach(section => {
          const rect = section.getBoundingClientRect();
          // If section is in viewport or above it, make it visible
          if (rect.bottom > 0) { // Section is below the top of viewport
            section.classList.add('visible');
          }
        });
        
        // Find all fade-in elements
        const fadeElements = document.querySelectorAll('.fade-in-element');
        
        // Make only the visible elements "visible" immediately, let others animate normally
        fadeElements.forEach(element => {
          const elemRect = element.getBoundingClientRect();
          // If element is in viewport, make it visible immediately
          if (elemRect.top < window.innerHeight && elemRect.bottom > 0) {
            element.classList.add('visible');
          }
          // Elements below the viewport will animate normally when scrolled to
        });
        
        // Re-observe elements that aren't visible yet
        if ('IntersectionObserver' in window && 
            !matchMedia('(prefers-reduced-motion: reduce)').matches) {
          
          const elementObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
              if (entry.isIntersecting) {
                setTimeout(() => {
                  entry.target.classList.add('visible');
                }, 100);
                elementObserver.unobserve(entry.target);
              }
            });
          }, {
            threshold: 0.1,
            rootMargin: '0px 0px -10% 0px'
          });
          
          // Re-observe only elements that are not already visible
          document.querySelectorAll('.fade-in-element:not(.visible)').forEach(element => {
            elementObserver.observe(element);
          });
        }
      }, 50); // Small delay to ensure scroll is complete
    }
  }
}

/**
 * Sets up the Intersection Observer for section fade-in
 */
function setupIntersectionObserver() {
  const sections = document.querySelectorAll('.section');
  
  // Set background colors immediately by adding a class
  sections.forEach(section => {
    section.classList.add('bg-visible');
  });
  
  // Check if Intersection Observer is supported
  if ('IntersectionObserver' in window && 
      !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    
    // First, add the fade-in-element class to elements we want to animate
    sections.forEach(section => {
      // Get main elements to animate within each section
      const animatableElements = [
        ...section.querySelectorAll('h2'),
        ...section.querySelectorAll('h3'), // Include all h3 elements for animation
        ...section.querySelectorAll('.about-grid'),
        ...section.querySelectorAll('.experience-item'),
        ...section.querySelectorAll('.project-card'),
        ...section.querySelectorAll('.interactive-demo-container'),
        ...section.querySelectorAll('.education-row'),
        ...section.querySelectorAll('.skills-column'),
        ...section.querySelectorAll('.carousel-container'),
        ...section.querySelectorAll('#contact-form'),
        ...section.querySelectorAll('.research')
      ];
      
      // Add fade-in-element class to each element
      animatableElements.forEach(elem => {
        elem.classList.add('fade-in-element');
      });
    });
    
    // Create observer for sections (needed for layout purposes)
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          sectionObserver.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.1
    });
    
    // Observe all sections
    sections.forEach(section => {
      sectionObserver.observe(section);
    });
  } else {
    // Fallback for browsers without Intersection Observer or reduced motion preference
    document.querySelectorAll('.fade-in-element').forEach(element => {
      element.classList.add('visible');
    });
    sections.forEach(section => {
      section.classList.add('visible');
    });
  }
  
  // Initialize all sections above the fold as visible immediately
  sections.forEach(section => {
    const rect = section.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      section.classList.add('visible');
      // Also make the elements above the fold visible
      section.querySelectorAll('.fade-in-element').forEach(element => {
        element.classList.add('visible');
      });
    }
  });
}

/**
 * Sets up smooth scrolling for navigation links
 */
function setupSmoothScrolling() {
  const navLinks = document.querySelectorAll('a[href^="#"]:not([href="#"])');
  
  navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      
      const targetId = this.getAttribute('href');
      const targetElement = document.querySelector(targetId);
      
      if (targetElement) {
        // Get the element's position relative to the viewport
        const rect = targetElement.getBoundingClientRect();
        const offset = rect.top + window.pageYOffset;
        
        // Scroll with a slight adjustment for better visual positioning
        window.scrollTo({
          top: offset - 70, // Exact match to header height for clean alignment
          behavior: 'smooth'
        });
        
        // Update URL hash without scrolling
        window.history.pushState(null, null, targetId);
        
        // Remove focus after click to prevent persistent highlighting
        this.blur();
      }
    });
  });
}

/**
 * Sets up the mobile navigation toggle
 */
function setupMobileNav() {
  const mobileNav = document.querySelector('.mobile-nav');
  
  if (mobileNav) {
    // Close mobile menu when a link is clicked
    const mobileLinks = mobileNav.querySelectorAll('a');
    mobileLinks.forEach(link => {
      link.addEventListener('click', () => {
        mobileNav.removeAttribute('open');
        // Remove focus to prevent highlight persisting
        link.blur();
      });
    });

    // Close mobile menu when clicking outside
    document.addEventListener('click', (event) => {
      if (mobileNav.hasAttribute('open') && 
          !mobileNav.contains(event.target)) {
        mobileNav.removeAttribute('open');
      }
    });
  }
  
  // Add blur handling to all header links including external links
  const allHeaderLinks = document.querySelectorAll('header a');
  allHeaderLinks.forEach(link => {
    link.addEventListener('click', function() {
      // Short delay to ensure the navigation action completes first
      setTimeout(() => {
        this.blur();
      }, 100);
    });
  });
}

/**
 * Sets up the back-to-top button
 */
function setupBackToTop() {
  const toTopButton = document.querySelector('.to-top');
  
  if (toTopButton) {
    // Show button when scrolled down
    window.addEventListener('scroll', () => {
      if (window.scrollY > 400) {
        toTopButton.classList.add('visible');
      } else {
        toTopButton.classList.remove('visible');
      }
    });

    // Smooth scroll to top when clicked
    toTopButton.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
}

/**
 * Sets up the interests carousel
 */


/**
 * Sets up the GitHub stats fetch for projects
 */
function initGitHubStats() {
  const projectCards = document.querySelectorAll('.project-card');
  const delay = 500; // ms between requests to avoid rate limiting
  let requestCount = 0;
  const maxRequests = 10; // GitHub API has a rate limit
  
  projectCards.forEach((card, index) => {
    const repo = card.dataset.repo;
    if (!repo) {
      // For non-GitHub projects, check if we need to update the meta section
      const meta = card.querySelector('.meta');
      if (meta && meta.children.length === 1 && meta.querySelector('.platform')) {
        // This is a project with a platform tag (like SoundCloud), leave it as is
        return;
      }
      return; // Skip cards without repo attribute
    }

    // Delay requests to avoid rate limiting
    setTimeout(() => {
      if (requestCount < maxRequests) {
        fetchGitHubStats(repo, card);
        requestCount++;
      }
    }, index * delay);
  });
}

/**
 * Fetches GitHub stats for a specific repository
 */
function fetchGitHubStats(repo, card) {
  fetch(`https://api.github.com/repos/${repo}`)
    .then(response => {
      if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded');
      }
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      const stars = data.stargazers_count;
      const forks = data.forks_count;
      const cardContent = card.querySelector('.meta');
      cardContent.innerHTML = `
        <li class="stars">★ ${stars}</li>
        <li class="forks">⑂ ${forks}</li>
      `;
    })
    .catch(error => {
      console.error('Error fetching GitHub stats:', error);
    });
}

/**
 * Sets up the contact form mailto functionality
 */
function setupContactForm() {
  const form = document.getElementById('contact-form');
  
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      const name = encodeURIComponent(form.elements.name.value);
      const email = encodeURIComponent(form.elements.email.value);
      const subject = encodeURIComponent(form.elements.subject.value || `Message from ${form.elements.name.value}`);
      const message = encodeURIComponent(form.elements.message.value);
      
      // Create the mailto URL with all form data
      const mailtoUrl = `mailto:crlandschoot@gmail.com?subject=${subject}&body=Name: ${name}%0AEmail: ${email}%0A%0A${message}`;
      
      // Open the user's email client
      window.location.href = mailtoUrl;
    });
  }
}

/**
 * Sets up clickable videos behavior
 */
function setupClickableVideos() {
  const clickableVideos = document.querySelectorAll('.clickable-video');
  
  clickableVideos.forEach(video => {
    // Ensure video is muted so it can autoplay
    video.muted = true;
    
    // Add loading indicator
    const videoContainer = video.parentElement;
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'video-loading';
    loadingIndicator.innerHTML = '<span>Loading video...</span>';
    videoContainer.insertBefore(loadingIndicator, video);
    
    // Handle video loading success
    video.addEventListener('canplay', function() {
      // Remove loading indicator when video can play
      if (loadingIndicator && loadingIndicator.parentNode) {
        loadingIndicator.parentNode.removeChild(loadingIndicator);
      }
      console.log('Video loaded and ready to play');
    });
    
    // Handle video loading error
    video.addEventListener('error', function(e) {
      console.error('Error loading video:', e);
      if (loadingIndicator) {
        loadingIndicator.innerHTML = '<span>Error loading video. Click to try again.</span>';
      }
    });
    
    // Try to play videos after page load (needed for some browsers)
    try {
      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log('Auto-play prevented by browser, waiting for user interaction:', error);
          
          // Add click event to play video manually if autoplay fails
          video.parentElement.addEventListener('click', () => {
            video.play().catch(e => console.error('Error playing video on click:', e));
          }, { once: true });
        });
      }
    } catch (error) {
      console.error('Error playing video:', error);
    }
    
    // Add interaction visual feedback
    const videoLink = video.closest('.video-link');
    if (videoLink) {
      // For touch devices, add a class when touched to show the hover state
      videoLink.addEventListener('touchstart', () => {
        videoLink.classList.add('touch-active');
      });
      
      videoLink.addEventListener('touchend', () => {
        setTimeout(() => {
          videoLink.classList.remove('touch-active');
        }, 300);
      });
    }
  });
}

/**
 * Initializes and runs the sea-of-code wave animation with light/dark theme support.
 */
function initHeroCodeSea() {
  const canvas = document.getElementById('hero-code-canvas');
  if (!canvas) {
    console.error('Hero canvas element not found!');
    return;
  }
  const ctx = canvas.getContext('2d');

  /*====================================================================
    1. WAVE-ANIMATION CONTROLS – tweak these if you like
  ====================================================================*/
  const FONT_SIZE   = 15; //15;
  const WAVE_AMPL   = 6;
  const WAVE_LENGTH = .045;
  const WAVE_SPEED  = 0.0025;
  const WAVE_PHASE_Y= 1;

  // dynamic segment sizing thresholds
  const DEFAULT_SEGMENT_SIZE = 1;
  const LARGE_SEGMENT_SIZE = 2;
  const WIDTH_THRESHOLD = 2500; // px threshold for switching to larger segments on ultrawide
  let segmentSize = DEFAULT_SEGMENT_SIZE;
  // toggle framerate limiter on/off
  const USE_THROTTLE = false;
  const TARGET_FPS = 30;
  let lastFrameTime = 0;

  /*====================================================================
    2. RAW SOURCE CODE – define codeLines for the sea-of-code animation
  ====================================================================*/

  const codeLines = [
    'import torch; import torch.nn as nn; import torchaudio; from lightning import LightningModule; import torch.nn.functional as F',
    'class AudioModel(LightningModule): def __init__(self, n_fft=2048, lr=1e-3, hidden_dim=512, n_mels=128, sample_rate=44100):',
    '    super().__init__(); self.mel_transform = torchaudio.transforms.MelSpectrogram(sample_rate, n_fft, n_mels=n_mels)',
    '    self.encoder = nn.Conv2d(1, 64, 3, padding=1); self.decoder = nn.ConvTranspose2d(128, 1, 3, padding=1)',
    '    self.attention = nn.MultiheadAttention(hidden_dim, 8); self.dropout = nn.Dropout(0.1); self.lr = lr',
    '  def forward(self, x): mel_spec = self.mel_transform(x); encoded = self.encoder(mel_spec.unsqueeze(1))',
    '    attended, _ = self.attention(encoded.flatten(2).transpose(1, 2), encoded.flatten(2).transpose(1, 2))',
    '    return self.decoder(encoded); def training_step(self, batch, idx): x, y = batch; pred = self(x)',
    '    loss = F.mse_loss(pred, y); self.log("train_loss", loss); return loss',
    '  def configure_optimizers(self): return torch.optim.AdamW(self.parameters(), lr=self.lr, weight_decay=1e-4)',
    'dataloader = DataLoader(dataset, batch_size=32, shuffle=True, num_workers=4, pin_memory=True)',
    'trainer = Trainer(max_epochs=100, accelerator="gpu", precision=16, log_every_n_steps=50)',
    'checkpoint = torch.load("model.ckpt"); model.load_state_dict(checkpoint["state_dict"])',
    'spectrogram = torchaudio.transforms.Spectrogram(n_fft=2048, hop_length=512, power=2.0)',
    'mel_spectrogram = torchaudio.transforms.MelSpectrogram(sample_rate=44100, n_mels=128, fmax=8000)',
    'audio_data, sr = torchaudio.load("audio.wav"); resampler = torchaudio.transforms.Resample(sr, 22050)',
    'stft = torch.stft(waveform, n_fft=2048, hop_length=512, return_complex=True)',
    'magnitude = torch.abs(stft); phase = torch.angle(stft); power = magnitude ** 2',
    'class ResBlock(nn.Module): def __init__(self, channels): super().__init__(); self.conv1 = nn.Conv2d(channels, channels, 3, 1, 1)',
    '  def forward(self, x): return F.relu(self.conv1(x)) + x',
    'augmentations = Compose([AddGaussianNoise(p=0.5), TimeStretch(p=0.3), PitchShift(p=0.4)])',
    'optimizer = torch.optim.AdamW(model.parameters(), lr=1e-3); scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, 100)',
    'loss_fn = torch.nn.MSELoss(); model.train(); for batch in dataloader: loss = loss_fn(model(x), y); loss.backward()',
    'model.eval(); with torch.no_grad(): predictions = model(test_input); torchaudio.save("output.wav", predictions, 44100)',
    'class Attention(nn.Module): def __init__(self, dim): super().__init__(); self.scale = dim ** -0.5; self.to_qkv = nn.Linear(dim, dim * 3)'
  ];

  /*====================================================================
    3. CHARACTER GRID PRE-COMPUTATION
  ====================================================================*/
  // Flatten the code into one continuous stream
  const allText = codeLines.join(' ');
  const allChars = allText.replace(/\s+/g, ' ').split('');
  let cols, rows, charW, lineH;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = canvas.clientWidth  * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.font = `${FONT_SIZE}px monospace`;
    ctx.textBaseline = 'top';
    charW = ctx.measureText('M').width;
    lineH = FONT_SIZE * 1.25;
    // compute how many characters fit per row/column
    cols = Math.ceil(canvas.clientWidth / charW);
    rows = Math.ceil(canvas.clientHeight / lineH);
    // dynamically adjust segment size based on screen width
    segmentSize = canvas.clientWidth > WIDTH_THRESHOLD ? LARGE_SEGMENT_SIZE : DEFAULT_SEGMENT_SIZE;
  }

  function getColors() {
    const styles = getComputedStyle(document.documentElement);
    const bg = styles.getPropertyValue('--clr-background-primary').trim();
    const fg = styles.getPropertyValue('--clr-border-primary').trim(); // Use border-primary as subtle code color in both modes
    return { bg, fg };
  }

  function draw(ts) {
    if (USE_THROTTLE) {
      if (ts - lastFrameTime < 1000 / TARGET_FPS) {
        requestAnimationFrame(draw);
        return;
      }
      lastFrameTime = ts;
    }
    const { bg, fg } = getColors();
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    ctx.fillStyle = fg;
    for (let r = 0; r < rows; r++) {
      const yBase = r * lineH;
      for (let segX = 0; segX < cols; segX += segmentSize) {
        const count = Math.min(segmentSize, cols - segX);
        // build a substring of chars
        let segment = '';
        for (let j = 0; j < count; j++) {
          const idx = (r * cols + segX + j) % allChars.length;
          segment += allChars[idx];
        }
        const xPos = segX * charW;
        const xMid = xPos + (count * charW) * 0.5;
        const yOffset = Math.sin(ts * WAVE_SPEED + xMid * WAVE_LENGTH + r * WAVE_PHASE_Y) * WAVE_AMPL;
        ctx.fillText(segment, xPos, yBase + yOffset);
      }
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize, { passive: true });
  new MutationObserver(resize).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  resize();
  requestAnimationFrame(draw);
}

/**
 * Sets up the interests carousel with infinite horizontal scrolling
 */
function setupInterestsCarousel() {
  const carouselTrack = document.getElementById('carousel-track');
  if (!carouselTrack) return;

  const carouselContainer = carouselTrack.parentElement;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let originalWidth = 0;
  let originalItemCount = 0;
  let averageItemWidth = 0;
  let currentPosition = 0;
  let velocity = 0;
  let desiredVelocity = 0;
  let baseAutoVelocity = 0;
  let lastFrameTime = 0;
  let animationFrameId = null;

  // Pointer tracking
  let pointerId = null;
  let pointerLastX = 0;
  let pointerLastTime = 0;
  let isPointerActive = false;
  let resumePending = false;
  let arrowScrollRemaining = 0;
  let lastWheelTime = 0;
  let activePointerType = null;

  const computeBaseVelocity = () => (prefersReducedMotion.matches ? 0 : -window.innerWidth / 20000);
  const minVelocityThreshold = 0.02;

  const applyTransform = () => {
    carouselTrack.style.transform = `translateX(${currentPosition}px)`;
  };

  const wrapPosition = () => {
    if (!originalWidth) return;
    while (currentPosition <= -originalWidth) {
      currentPosition += originalWidth;
    }
    while (currentPosition > 0) {
      currentPosition -= originalWidth;
    }
  };

  const stopAutoScroll = () => {
    desiredVelocity = 0;
    baseAutoVelocity = computeBaseVelocity();
  };

  const scheduleAutoResume = () => {
    if (prefersReducedMotion.matches) return;
    resumePending = true;
  };

  const applyArrowImpulse = (direction) => {
    if (prefersReducedMotion.matches) return;
    stopAutoScroll();
    resumePending = true;
    velocity = 0;
    const distance = averageItemWidth || carouselContainer.clientWidth * 0.6;
    arrowScrollRemaining += direction * distance;
    if (!animationFrameId) {
      animationFrameId = requestAnimationFrame(animate);
    }
  };

  const createArrowButton = (direction) => {
    if (!carouselContainer || carouselContainer.querySelector(`.carousel-arrow--${direction}`)) {
      return null;
    }

    const button = document.createElement('button');
    const isLeft = direction === 'left';
    button.type = 'button';
    button.className = `carousel-arrow carousel-arrow--${direction}`;
    button.setAttribute('aria-label', isLeft ? 'Scroll interests backward' : 'Scroll interests forward');
    button.innerHTML = isLeft ? '&#8249;' : '&#8250;';

    button.addEventListener('click', (event) => {
      event.stopPropagation();
      applyArrowImpulse(isLeft ? 1 : -1);
    });

    button.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        applyArrowImpulse(isLeft ? 1 : -1);
      }
    });

    carouselContainer.appendChild(button);
    return button;
  };

  const onPointerDown = (event) => {
    if (!carouselContainer || isPointerActive || event.button > 1) return;
    if (event.target && event.target.closest('.carousel-arrow')) {
      return;
    }
    carouselContainer.setPointerCapture(event.pointerId);
    pointerId = event.pointerId;
    pointerLastX = event.clientX;
    pointerLastTime = event.timeStamp;
    activePointerType = event.pointerType;
    isPointerActive = true;
    stopAutoScroll();
    velocity = 0;
    resumePending = false;
    event.preventDefault();
  };

  const onPointerMove = (event) => {
    if (!isPointerActive || event.pointerId !== pointerId) return;

    const deltaX = event.clientX - pointerLastX;
    const now = event.timeStamp;
    const deltaTime = Math.max(now - pointerLastTime, 1);

    const useNaturalDirection = activePointerType === 'touch';
    const appliedDelta = useNaturalDirection ? deltaX : -deltaX;
    const isMouse = activePointerType === 'mouse';
    const effectiveDelta = isMouse ? deltaX : appliedDelta;

    currentPosition += effectiveDelta;
    wrapPosition();
    applyTransform();

    velocity = effectiveDelta / deltaTime;

    pointerLastX = event.clientX;
    pointerLastTime = now;

    event.preventDefault();
  };

  const onPointerUp = (event) => {
    if (!isPointerActive || event.pointerId !== pointerId) return;

    carouselContainer.releasePointerCapture(pointerId);
    pointerId = null;
    isPointerActive = false;
    pointerLastX = 0;
    pointerLastTime = 0;
    activePointerType = null;
    scheduleAutoResume();
  };

  const onWheel = (event) => {
    if (!carouselContainer) return;

    // Ignore pure vertical scrolls; allow diagonal gestures to influence carousel.
    const hasHorizontalComponent = Math.abs(event.deltaX) >= Math.abs(event.deltaY) * 0.3;
    if (!hasHorizontalComponent && event.deltaMode === 0) {
      return;
    }

    stopAutoScroll();
    resumePending = true;

    let deltaXRaw = event.deltaX;
    if (event.deltaMode === 1) {
      deltaXRaw *= 16; // lines -> pixels approximation
    } else if (event.deltaMode === 2) {
      deltaXRaw *= carouselContainer.clientWidth;
    }

    const deltaX = (event.deltaMode === 0 ? -deltaXRaw : deltaXRaw);

    currentPosition += deltaX;
    wrapPosition();
    applyTransform();

    const now = event.timeStamp;
    const deltaTime = Math.max(now - lastWheelTime, 1);
    velocity = deltaX / deltaTime;
    lastWheelTime = now;

    event.preventDefault();
  };

  const attachInteractionHandlers = () => {
    if (!carouselContainer) return;
    carouselContainer.style.touchAction = 'pan-y';
    carouselContainer.addEventListener('pointerdown', onPointerDown);
    carouselContainer.addEventListener('pointermove', onPointerMove);
    carouselContainer.addEventListener('pointerup', onPointerUp);
    carouselContainer.addEventListener('pointercancel', onPointerUp);
    carouselContainer.addEventListener('pointerleave', (event) => {
      if (isPointerActive && event.pointerId === pointerId) {
        onPointerUp(event);
      }
    });
    carouselContainer.addEventListener('wheel', onWheel, { passive: false });
  };

  const removeAnimation = () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  };

  const animate = (timestamp) => {
    animationFrameId = requestAnimationFrame(animate);

    if (!lastFrameTime) {
      lastFrameTime = timestamp;
      return;
    }

    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if (isPointerActive) {
      return;
    }

    if (Math.abs(arrowScrollRemaining) > 0.5) {
      const duration = 220; // ms to traverse one item when average width is known
      const effectiveDuration = averageItemWidth > 0 ? duration : 300;
      const maxStep = (averageItemWidth > 0 ? averageItemWidth : carouselContainer.clientWidth) * (deltaTime / effectiveDuration);
      const step = Math.max(-maxStep, Math.min(maxStep, arrowScrollRemaining));
      currentPosition += step;
      arrowScrollRemaining -= step;
      if (Math.abs(arrowScrollRemaining) <= 0.5) {
        currentPosition += arrowScrollRemaining;
        arrowScrollRemaining = 0;
      }
      wrapPosition();
      applyTransform();
      return;
    }

    if (resumePending) {
      const friction = Math.exp(-deltaTime / 250);
      velocity *= friction;
      if (Math.abs(velocity) < minVelocityThreshold) {
        resumePending = false;
        desiredVelocity = baseAutoVelocity;
      }
    } else {
      const easingFactor = Math.min(deltaTime / 180, 0.15);
      velocity += (desiredVelocity - velocity) * easingFactor;
    }

    currentPosition += velocity * deltaTime;
    wrapPosition();
    applyTransform();
  };

  const updateMeasurements = () => {
    originalWidth = carouselTrack.scrollWidth / 2;
    originalItemCount = carouselTrack.children.length / 2;
    if (originalItemCount > 0) {
      averageItemWidth = originalWidth / originalItemCount;
    } else {
      const firstItem = carouselTrack.firstElementChild;
      averageItemWidth = firstItem ? firstItem.getBoundingClientRect().width : 0;
    }
    wrapPosition();
    applyTransform();
  };

  const startAnimation = () => {
    removeAnimation();
    lastFrameTime = 0;
    baseAutoVelocity = computeBaseVelocity();
    desiredVelocity = baseAutoVelocity;
    animationFrameId = requestAnimationFrame(animate);
  };

  const initialize = () => {
    updateMeasurements();
    attachInteractionHandlers();
    createArrowButton('left');
    createArrowButton('right');

    if (!prefersReducedMotion.matches) {
      startAnimation();
    } else {
      applyTransform();
    }
  };

  const assetPromises = Array.from(carouselTrack.querySelectorAll('img')).map((img) => new Promise((resolve) => {
    if (img.complete) {
      resolve();
    } else {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    }
  }));

  Promise.all(assetPromises).then(() => initialize());

  window.addEventListener('resize', debounce(() => {
    baseAutoVelocity = computeBaseVelocity();
    if (!isPointerActive && !resumePending) {
      desiredVelocity = baseAutoVelocity;
    }
    updateMeasurements();
  }, 250));

  prefersReducedMotion.addEventListener('change', () => {
    baseAutoVelocity = computeBaseVelocity();
    desiredVelocity = baseAutoVelocity;
    if (prefersReducedMotion.matches) {
      removeAnimation();
      velocity = 0;
      applyTransform();
    } else {
      startAnimation();
    }
  });
}
