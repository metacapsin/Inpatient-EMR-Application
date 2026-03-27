import React from 'react';
import { FaPaperPlane, FaLightbulb } from 'react-icons/fa';

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  placeholder?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = 'Type your question...',
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim() || disabled) return;
    onSubmit();
  };

  return (
    <div className="border-t border-white-light dark:border-dark bg-white dark:bg-black p-2">
  
      {/* Input Container */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 w-full bg-gray-50 dark:bg-dark/30 
        rounded-xl px-2 py-2 shadow-sm 
        focus-within:ring-1 focus-within:ring-[#97704f] focus-within:shadow-md transition"
      >
  
        {/* Textarea */}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={disabled ? 'Please wait...' : placeholder}
          disabled={disabled}
          rows={1}
          onInput={(e) => {
            e.currentTarget.style.height = "auto";
            e.currentTarget.style.height = e.currentTarget.scrollHeight + "px";
          }}
          className="flex-1 resize-none bg-transparent outline-none text-sm 
          text-gray-900 dark:text-white placeholder:text-gray-400 
          min-h-[36px] max-h-24 px-1"
        />
  
        {/* Send Button */}
        <button
          type="submit"
          disabled={!value.trim() || disabled}
          className="w-9 h-9 rounded-full bg-[#97704f] text-white 
          disabled:opacity-40 disabled:cursor-not-allowed 
          shrink-0 flex items-center justify-center 
          shadow-sm active:scale-95 transition hover:shadow-md"
        >
          <FaPaperPlane className="text-[11px]" />
        </button>
  
      </form>
  
      {/* Minimal Hint */}
      <p className="mt-1 text-[10px] text-gray-400 px-1">
        Ask about medications, diagnoses, vitals, or history
      </p>
  
    </div>
  );
};

export default ChatInput;
