/* ===================================================
   BEA ANGEL J. SUGUE — 18TH BIRTHDAY INVITATION
   Cinematic Autoplay + Interactive Effects
   =================================================== */

(function () {
    'use strict';

    const preloader = document.getElementById('preloader');
    const particlesCanvas = document.getElementById('particles-canvas');
    const sparklesContainer = document.getElementById('sparkles-container');
    const bokehContainer = document.getElementById('bokeh-container');
    const musicToggle = document.getElementById('music-toggle');
    const musicIconOn = document.getElementById('music-icon-on');
    const musicIconOff = document.getElementById('music-icon-off');
    const replayBtn = document.getElementById('replay-btn');
    const cinemaFlash = document.getElementById('cinema-flash');
    const cinemaElements = document.querySelectorAll('.cinema-el');

    // ===================================================
    // CINEMATIC TIMELINE
    // Each step: [delay_ms, cinema_index]
    // ===================================================
    const CINEMA_TIMELINE = [
        { step: 0,  delay: 0 },     // Page border
        { step: 1,  delay: 400 },    // Crown drops in
        { step: 2,  delay: 900 },    // "She's Turning" fades
        { step: 3,  delay: 1500 },   // "18" scales in with flash
        { step: 4,  delay: 2800 },   // Flourish expands + Photo reveals
        { step: 5,  delay: 3800 },   // Name appears
        { step: 6,  delay: 4600 },   // Tagline fades in
        { step: 7,  delay: 5400 },   // Detail row 1 slides
        { step: 8,  delay: 5700 },   // Detail row 2 slides
        { step: 9,  delay: 6000 },   // Detail row 3 slides
        { step: 10, delay: 6600 },   // Footer fades in
    ];

    const TOTAL_CINEMA_DURATION = 7500;

    // ---- Init ----
    window.addEventListener('load', () => {
        setTimeout(() => {
            preloader.classList.add('hidden');
            setTimeout(() => {
                initParticles();
                initSparkles();
                initBokeh();
                initParallax();
                initSlideshow();
                initMouseGlow();
                playCinematic();
            }, 400);
        }, 2200);
    });

    // ===================================================
    // CINEMATIC PLAYBACK
    // ===================================================
    let cinemaTimeouts = [];

    function playCinematic() {
        // Reset all cinema elements
        cinemaElements.forEach(el => {
            el.classList.remove('cinema-active');
            el.style.opacity = '';
            el.style.visibility = '';
            el.style.animation = 'none';
            // Force reflow
            void el.offsetHeight;
            el.style.animation = '';
        });

        // Clear previous timeouts
        cinemaTimeouts.forEach(t => clearTimeout(t));
        cinemaTimeouts = [];

        // Schedule each cinema step
        CINEMA_TIMELINE.forEach(({ step, delay }) => {
            const t = setTimeout(() => {
                // Find elements with this cinema step
                cinemaElements.forEach(el => {
                    if (parseInt(el.dataset.cinema) === step) {
                        el.classList.add('cinema-active');
                    }
                });

                // Flash on the "18" reveal
                if (step === 3) {
                    cinemaFlash.classList.add('active');
                    setTimeout(() => cinemaFlash.classList.remove('active'), 900);
                }
            }, delay);
            cinemaTimeouts.push(t);
        });
    }

    // ---- Replay Button ----
    replayBtn.addEventListener('click', () => {
        playCinematic();
    });

    // ===================================================
    // PARTICLE SYSTEM (Gold + Red)
    // ===================================================
    function initParticles() {
        const ctx = particlesCanvas.getContext('2d');
        let width, height;
        const particles = [];
        const PARTICLE_COUNT = 70;

        function resize() {
            width = particlesCanvas.width = window.innerWidth;
            height = particlesCanvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        class Particle {
            constructor() { this.reset(); }

            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.size = Math.random() * 2.8 + 0.3;
                this.speedX = (Math.random() - 0.5) * 0.4;
                this.speedY = (Math.random() - 0.5) * 0.3 - 0.2;
                this.opacity = Math.random() * 0.5 + 0.1;
                this.opacitySpeed = (Math.random() - 0.5) * 0.008;
                this.life = 0;
                this.maxLife = 400 + Math.random() * 300;
                if (Math.random() < 0.8) {
                    this.hue = 38 + Math.random() * 18;
                    this.saturation = 65 + Math.random() * 20;
                    this.lightness = 55 + Math.random() * 20;
                } else {
                    this.hue = 350 + Math.random() * 15;
                    this.saturation = 50 + Math.random() * 20;
                    this.lightness = 40 + Math.random() * 15;
                }
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                this.opacity += this.opacitySpeed;
                this.life++;
                if (this.opacity <= 0.03 || this.opacity >= 0.6) this.opacitySpeed *= -1;
                if (this.life > this.maxLife || this.x < -20 || this.x > width + 20 || this.y < -20 || this.y > height + 20) {
                    this.reset();
                    this.y = height + 10;
                }
            }

            draw() {
                ctx.save();
                ctx.globalAlpha = this.opacity;
                ctx.fillStyle = `hsl(${this.hue}, ${this.saturation}%, ${this.lightness}%)`;
                ctx.shadowBlur = 10;
                ctx.shadowColor = `hsla(${this.hue}, ${this.saturation}%, ${this.lightness}%, 0.6)`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

        function animate() {
            ctx.clearRect(0, 0, width, height);
            particles.forEach(p => { p.update(); p.draw(); });

            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 90) {
                        ctx.save();
                        ctx.globalAlpha = (1 - dist / 90) * 0.07;
                        ctx.strokeStyle = '#C9A84C';
                        ctx.lineWidth = 0.4;
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                        ctx.restore();
                    }
                }
            }
            requestAnimationFrame(animate);
        }
        animate();
    }

    // ===================================================
    // SPARKLES
    // ===================================================
    function initSparkles() {
        for (let i = 0; i < 25; i++) createSparkle();
        setInterval(() => {
            if (sparklesContainer.children.length < 35) createSparkle();
        }, 1500);
    }

    function createSparkle() {
        const sparkle = document.createElement('div');
        sparkle.classList.add('sparkle');
        const left = Math.random() * 100;
        const duration = 6 + Math.random() * 14;
        const delay = Math.random() * 8;
        const size = 2 + Math.random() * 5;
        sparkle.style.left = `${left}%`;
        sparkle.style.width = `${size}px`;
        sparkle.style.height = `${size}px`;
        sparkle.style.animationDuration = `${duration}s`;
        sparkle.style.animationDelay = `${delay}s`;
        sparklesContainer.appendChild(sparkle);
        setTimeout(() => sparkle.remove(), (duration + delay) * 1000);
    }

    // ===================================================
    // BOKEH LIGHTS
    // ===================================================
    function initBokeh() {
        const colors = [
            { bg: 'rgba(201,168,76,0.08)', shadow: 'rgba(201,168,76,0.15)' },
            { bg: 'rgba(139,0,0,0.06)', shadow: 'rgba(139,0,0,0.12)' },
            { bg: 'rgba(212,175,55,0.06)', shadow: 'rgba(212,175,55,0.1)' },
            { bg: 'rgba(183,110,121,0.05)', shadow: 'rgba(183,110,121,0.1)' },
            { bg: 'rgba(255,215,0,0.04)', shadow: 'rgba(255,215,0,0.08)' },
        ];

        for (let i = 0; i < 12; i++) {
            const bokeh = document.createElement('div');
            bokeh.classList.add('bokeh-light');
            const color = colors[Math.floor(Math.random() * colors.length)];
            const size = 30 + Math.random() * 120;
            bokeh.style.cssText = `
                left: ${Math.random() * 100}%; top: ${Math.random() * 100}%;
                width: ${size}px; height: ${size}px;
                background: ${color.bg}; box-shadow: 0 0 ${size * 0.5}px ${color.shadow};
                animation-duration: ${8 + Math.random() * 12}s;
                animation-delay: ${Math.random() * 6}s;
                filter: blur(${size * 0.3}px);
            `;
            bokehContainer.appendChild(bokeh);
        }
    }

    // ===================================================
    // MOUSE GLOW
    // ===================================================
    function initMouseGlow() {
        if (window.innerWidth < 900) return;

        const glow = document.createElement('div');
        glow.style.cssText = `
            position: fixed; width: 250px; height: 250px; border-radius: 50%;
            background: radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%);
            pointer-events: none; z-index: 3;
            transform: translate(-50%,-50%); transition: left 0.3s ease, top 0.3s ease;
            mix-blend-mode: screen;
        `;
        document.body.appendChild(glow);
        document.addEventListener('mousemove', (e) => {
            glow.style.left = e.clientX + 'px';
            glow.style.top = e.clientY + 'px';
        });
    }

    // ===================================================
    // PARALLAX
    // ===================================================
    function initParallax() {
        const ageNumber = document.getElementById('age-number');
        const slideshow = document.getElementById('slideshow-container');
        if (!ageNumber || !slideshow || window.innerWidth < 900) return;

        let mouseX = 0, mouseY = 0, currentX = 0, currentY = 0;
        document.addEventListener('mousemove', (e) => {
            mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
            mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
        });

        function update() {
            currentX += (mouseX - currentX) * 0.04;
            currentY += (mouseY - currentY) * 0.04;
            ageNumber.style.transform = `perspective(1000px) rotateX(${currentY * -4}deg) rotateY(${currentX * 4}deg)`;
            slideshow.style.transform = `translate(${currentX * -5}px, ${currentY * -5}px)`;
            requestAnimationFrame(update);
        }
        update();
    }

    // ===================================================
    // SLIDESHOW (60+ Images)
    // ===================================================
    const SLIDESHOW_IMAGES = [
        "assets/birthday-photo.jpg",
        "assets/Debutant/20260801_133157.jpg",
        "assets/Debutant/20260801_133619.jpg", "assets/Debutant/20260801_133934.jpg",
        "assets/Debutant/20260801_134003.jpg", "assets/Debutant/20260801_134048.jpg", "assets/Debutant/20260801_134928.jpg", "assets/Debutant/20260801_134932.jpg",
        "assets/Debutant/20260801_135559.jpg", "assets/Debutant/20260801_135607.jpg",
        "assets/Debutant/20260801_135831.jpg", "assets/Debutant/20260801_140034.jpg", "assets/Debutant/20260801_141720.jpg", "assets/Debutant/20260801_141746.jpg",
        "assets/Debutant/20260801_141816.jpg", "assets/Debutant/20260801_141825.jpg", "assets/Debutant/20260801_141829.jpg", "assets/Debutant/20260801_141857.jpg",
        "assets/Debutant/20260801_142005.jpg", "assets/Debutant/20260801_142053.jpg", "assets/Debutant/20260801_142056.jpg",
        "assets/Debutant/20260801_142828.jpg", "assets/Debutant/20260801_143255.jpg", "assets/Debutant/20260801_143322.jpg", "assets/Debutant/20260801_143328.jpg",
        "assets/Debutant/20260801_143506.jpg", "assets/Debutant/20260801_143507.jpg", "assets/Debutant/20260801_143510.jpg", "assets/Debutant/20260801_143638.jpg",
        "assets/Debutant/20260801_144240.jpg", "assets/Debutant/20260801_144818.jpg", "assets/Debutant/20260801_144825.jpg", "assets/Debutant/20260801_144832.jpg",
        "assets/Debutant/20260801_144834.jpg", "assets/Debutant/20260801_145537.jpg", "assets/Debutant/20260801_161208.jpg", "assets/Debutant/20260801_161257.jpg",
        "assets/Debutant/20260801_161325.jpg", "assets/Debutant/20260801_161330.jpg", "assets/Debutant/20260801_161333.jpg", "assets/Debutant/20260801_161411.jpg",
        "assets/Debutant/20260801_161507.jpg", "assets/Debutant/20260801_161543.jpg", "assets/Debutant/20260801_162045.jpg"
    ];

    const TRANSITIONS = [
        'trans-zoom-in', 'trans-zoom-out', 'trans-blur', 'trans-pan-right', 'trans-pan-left',
        'trans-swipe-left', 'trans-swipe-right', 'trans-window-expand', 'trans-circle-reveal'
    ];

    function initSlideshow() {
        const slideA = document.getElementById('slide-a');
        const slideB = document.getElementById('slide-b');
        if (!slideA || !slideB || SLIDESHOW_IMAGES.length < 2) return;
        
        let currentIndex = 0;
        let isAActive = true;

        slideB.src = SLIDESHOW_IMAGES[1]; // Preload next
        slideA.classList.add('trans-zoom-in'); // initial state

        setInterval(() => {
            currentIndex = (currentIndex + 1) % SLIDESHOW_IMAGES.length;
            const nextIndex = (currentIndex + 1) % SLIDESHOW_IMAGES.length;
            const randomTransition = TRANSITIONS[Math.floor(Math.random() * TRANSITIONS.length)];

            if (isAActive) {
                slideB.className = `hero-portrait slide ${randomTransition}`;
                void slideB.offsetWidth; // trigger reflow
                slideB.classList.add('active');
                slideA.classList.remove('active');
                setTimeout(() => { slideA.src = SLIDESHOW_IMAGES[nextIndex]; }, 2500);
            } else {
                slideA.className = `hero-portrait slide ${randomTransition}`;
                void slideA.offsetWidth; // trigger reflow
                slideA.classList.add('active');
                slideB.classList.remove('active');
                setTimeout(() => { slideB.src = SLIDESHOW_IMAGES[nextIndex]; }, 2500);
            }
            isAActive = !isAActive;
        }, 5000);
    }

    // ===================================================
    // MUSIC
    // ===================================================
    let audioCtx = null, isPlaying = false, gainNode = null;

    function createAmbientMusic() {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        gainNode = audioCtx.createGain();
        gainNode.gain.value = 0;
        gainNode.connect(audioCtx.destination);

        [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const oscGain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = freq;
            oscGain.gain.value = 0.035;
            const lfo = audioCtx.createOscillator();
            const lfoGain = audioCtx.createGain();
            lfo.frequency.value = 0.25 + i * 0.08;
            lfoGain.gain.value = 1.2;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            lfo.start();
            osc.connect(oscGain);
            oscGain.connect(gainNode);
            osc.start();
        });
        gainNode.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 2.5);
    }

    musicToggle.addEventListener('click', () => {
        if (!isPlaying) {
            if (!audioCtx) createAmbientMusic();
            else { audioCtx.resume(); gainNode.gain.linearRampToValueAtTime(0.25, audioCtx.currentTime + 1); }
            isPlaying = true;
            musicToggle.classList.add('playing');
            musicIconOn.style.display = 'block';
            musicIconOff.style.display = 'none';
        } else {
            gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
            setTimeout(() => audioCtx.suspend(), 600);
            isPlaying = false;
            musicToggle.classList.remove('playing');
            musicIconOn.style.display = 'none';
            musicIconOff.style.display = 'block';
        }
    });

    // ===================================================
    // CLICK BURST
    // ===================================================
    document.addEventListener('click', (e) => {
        if (e.target.closest('.music-btn') || e.target.closest('.replay-btn')) return;

        for (let i = 0; i < 8; i++) {
            const burst = document.createElement('div');
            const angle = (Math.PI * 2 * i) / 8;
            const distance = 25 + Math.random() * 30;
            const size = 2 + Math.random() * 4;
            const isGold = Math.random() > 0.3;
            burst.style.cssText = `
                position: fixed; left: ${e.clientX}px; top: ${e.clientY}px;
                width: ${size}px; height: ${size}px;
                background: ${isGold ? '#FFD700' : '#C41E3A'}; border-radius: 50%;
                pointer-events: none; z-index: 9999;
                box-shadow: 0 0 8px ${isGold ? '#FFD700' : '#C41E3A'};
                transition: all 0.7s cubic-bezier(0.22,1,0.36,1);
            `;
            document.body.appendChild(burst);
            requestAnimationFrame(() => {
                burst.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px) scale(0)`;
                burst.style.opacity = '0';
            });
            setTimeout(() => burst.remove(), 800);
        }

        const star = document.createElement('div');
        star.style.cssText = `
            position: fixed; left: ${e.clientX}px; top: ${e.clientY}px;
            font-size: 12px; color: #FFD700; pointer-events: none; z-index: 9999;
            text-shadow: 0 0 8px #FFD700;
            transform: translate(-50%,-50%) scale(1); transition: all 0.5s ease-out;
        `;
        star.textContent = '✦';
        document.body.appendChild(star);
        requestAnimationFrame(() => {
            star.style.transform = 'translate(-50%,-50%) scale(2.5) rotate(90deg)';
            star.style.opacity = '0';
        });
        setTimeout(() => star.remove(), 600);
    });

})();
