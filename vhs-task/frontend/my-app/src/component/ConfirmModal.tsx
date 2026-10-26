// File: src/components/common/ConfirmModal.tsx
"use client";
import React from 'react';
import { X, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type?: 'success' | 'danger'; // Chấp nhận kiểu success hoặc danger
  confirmText?: string;        // Chấp nhận chữ hiển thị trên nút tùy biến
  isLoading?: boolean;
}

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  type = 'success', 
  confirmText = 'Xác nhận', 
  isLoading 
}: ConfirmModalProps) {
  if (!isOpen) return null;

  // Cấu hình màu sắc dựa trên type
  const isDanger = type === 'danger';
  const themeClass = isDanger 
    ? {
        bg: 'bg-red-50',
        border: 'border-red-100',
        icon: 'text-red-500',
        button: 'bg-red-600 hover:bg-red-700 shadow-red-900/10'
      }
    : {
        bg: 'bg-green-50',
        border: 'border-green-100',
        icon: 'text-green-500',
        button: 'bg-slate-900 hover:bg-green-600 shadow-slate-900/10'
      };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Nền mờ (Backdrop) */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" 
        onClick={onClose} 
      />
      
      {/* Nội dung Modal */}
      <div className="relative w-full max-w-sm bg-white rounded-3xl p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center">
          
          {/* Icon thay đổi theo type */}
          <div className={`p-4 rounded-full mb-5 border ${themeClass.bg} ${themeClass.border}`}>
            {isDanger ? (
              <AlertTriangle className={`w-10 h-10 ${themeClass.icon}`} />
            ) : (
              <CheckCircle2 className={`w-10 h-10 ${themeClass.icon}`} />
            )}
          </div>
          
          <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">{message}</p>

          <div className="flex gap-3 w-full">
            <button 
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-100 text-slate-600 text-[10px] font-black uppercase hover:bg-slate-200 transition-all disabled:opacity-50"
            >
              Hủy
            </button>
            
            <button 
              onClick={onConfirm}
              disabled={isLoading}
              className={`flex-1 px-4 py-3 rounded-xl text-white text-[10px] font-black uppercase transition-all shadow-lg disabled:opacity-50 ${themeClass.button}`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                   <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                   Đang xử lý
                </div>
              ) : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}