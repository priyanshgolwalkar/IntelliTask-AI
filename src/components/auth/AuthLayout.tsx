import React from 'react';
import { Workflow, Shield, Zap, Lock } from 'lucide-react';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-indigo-500/20 selection:text-indigo-200">
      {/* Background radial glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-indigo-600/20 blur-[120px] rounded-full" />
      </div>

      <div className="relative w-full max-w-md space-y-6">
        {/* Brand Lockup */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
            <Workflow className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-mono tracking-widest text-indigo-400 uppercase font-semibold block">
              IntelliTask AI
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1">
              {title}
            </h1>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Card Container */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          {children}
        </div>

        {/* Quiet Trust Footnote */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-neutral-500 font-mono">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-neutral-400" />
            <span>Zero-Trust Auth</span>
          </div>
          <span aria-hidden="true">·</span>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-neutral-400" />
            <span>Isolated Cloud Store</span>
          </div>
          <span aria-hidden="true">·</span>
          <span>v1.2</span>
        </div>
      </div>
    </div>
  );
}
