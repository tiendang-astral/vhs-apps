
"use client";
import React from 'react';
import { CheckCircle2 } from 'lucide-react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}

export default function SuccessModal({ 
  isOpen, 
  onClose, 
  title = "Thành công!", 
  message 
}: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Nội dung Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center">
          
          <div className="p-4 rounded-full mb-5 border bg-green-50 border-green-100">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
          </div>
          
          <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">{title}</h3>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed font-medium">{message}</p>

          <button 
            onClick={onClose}
            className="w-full px-4 py-4 rounded-2xl bg-[#1F3864] text-white text-[11px] font-black uppercase tracking-[2px] hover:bg-slate-800 transition-all shadow-xl shadow-blue-900/10 active:scale-95"
          >
            Đóng thông báo
          </button>
        </div>
      </div>
    </div>
  );
}