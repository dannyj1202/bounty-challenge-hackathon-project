import React from 'react';
import { Link } from 'react-router-dom';
import ParticleBackground from '../components/ParticleBackground';
import { auth } from '../api/client';

/**
 * Landing page: always light mode, no theme toggle (rest of app unchanged).
 */
export default function Landing() {
  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-[#0a0a0f] flex items-center justify-center transition-colors duration-200">
      <ParticleBackground />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(139, 92, 246, 0.06) 0%, transparent 60%)',
        }}
      />

      <div className="relative z-10 px-6 py-16 text-center max-w-4xl mx-auto">
        <img src="/ecstudy-logo.png" alt="ECStudy" className="w-24 h-24 sm:w-28 sm:h-28 mx-auto mb-6 opacity-0 animate-fade-slide-up object-contain" style={{ animationDelay: '0.05s', animationFillMode: 'both' }} />
        <h1
          className="text-5xl sm:text-6xl md:text-7xl font-bold text-white tracking-tight opacity-0 animate-fade-slide-up"
          style={{
            textShadow: '0 0 40px rgba(139, 92, 246, 0.15)',
            letterSpacing: '-0.02em',
            animationDelay: '0.1s',
            animationFillMode: 'both',
          }}
        >
          ECStudy
        </h1>
        <p
          className="mt-4 text-xl sm:text-2xl text-white font-medium tracking-wide opacity-0 animate-fade-slide-up"
          style={{
            letterSpacing: '0.02em',
            animationDelay: '0.25s',
            animationFillMode: 'both',
          }}
        >
          AI-powered study helper
        </p>
        <p
          className="mt-3 text-base sm:text-lg text-white max-w-xl mx-auto opacity-0 animate-fade-slide-up"
          style={{
            animationDelay: '0.4s',
            animationFillMode: 'both',
          }}
        >
          Helping students study smarter with intelligent assistance
        </p>

        <div
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0 animate-fade-slide-up"
          style={{
            animationDelay: '0.55s',
            animationFillMode: 'both',
          }}
        >
          <Link
            to="/login"
            className="group relative px-8 py-3.5 rounded-xl font-semibold text-white bg-violet-500 hover:bg-violet-600 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-[#0a0a0f]"
          >
            Sign in
          </Link>
          <a
            href={auth.getMicrosoftLoginUrlFirstTime()}
            className="group flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-white bg-[#1a1a24] border border-[#2d2d3a] hover:bg-[#252532] hover:border-violet-400 transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(139,92,246,0.2)] focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-[#0a0a0f]"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 23 23" fill="none" aria-hidden>
              <path fill="#F25022" d="M1 1h10v10H1z" />
              <path fill="#00A4EF" d="M12 1h10v10H12z" />
              <path fill="#7FBA00" d="M1 12h10v10H1z" />
              <path fill="#FFB900" d="M12 12h10v10H12z" />
            </svg>
            Sign in with Microsoft
          </a>
        </div>
      </div>
    </section>
  );
}
