"use client";

import React from 'react';
import { Mail, Phone, ExternalLink } from 'lucide-react';

export default function ExpirationDisplay() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl transform transition-all animate-in fade-in zoom-in duration-500">
        <div className="flex justify-center mb-6">
          <div className="bg-red-500/10 p-4 rounded-full">
            <svg 
              className="w-12 h-12 text-red-500" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" 
              />
            </svg>
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-white text-center mb-4 tracking-tight">
          System Access Expired
        </h1>
        
        <div className="space-y-4 text-center">
          <p className="text-slate-400 text-lg leading-relaxed">
            Your plan has expired. Please contact the developer to extend your access.
          </p>
          
          <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
            <p className="text-sm font-medium text-slate-300 mb-3 uppercase tracking-wider">
              Contact Developer
            </p>
            <div className="space-y-2">
              <p className="text-white font-semibold mb-2">Mukesh Patidar</p>
              <div className="flex items-center justify-center gap-2 text-slate-200">
                <Mail className="w-4 h-4 text-blue-400" />
                <span>patidarmukesh123@gmail.com</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-slate-200">
                <Phone className="w-4 h-4 text-blue-400" />
                <span>+91 96024 84680</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-8 pt-6 border-t border-slate-800 flex justify-center">
          <p className="text-slate-500 text-xs text-center">
            Reference ID: {new Date().getTime().toString(36).toUpperCase()}
          </p>
        </div>
      </div>
    </div>
  );
}
