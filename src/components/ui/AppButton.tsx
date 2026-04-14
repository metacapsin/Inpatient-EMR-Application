import React from "react";

type AppButtonProps = {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  className?: string;
};

const AppButton = ({
  children,
  onClick,
  type = "button",
  disabled = false,
  className = "",
}: AppButtonProps) => {
  const baseStyle = `
    inline-flex items-center gap-2 text-sm font-medium
    px-4 py-2 rounded-md transition-all duration-200
    border border-transparent
    bg-[#F6F6FA] text-[#8B5E3C]
    hover:bg-[#8B5E3C] hover:text-white
    dark:border-gray-600 dark:bg-gray-900 dark:text-amber-100/90
    dark:hover:border-amber-800 dark:hover:bg-[#8B5E3C] dark:hover:text-white
    disabled:opacity-50 dark:disabled:opacity-50
  `;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${baseStyle} ${className}`}
    >
      {children}
    </button>
  );
};

export default AppButton;