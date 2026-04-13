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
    bg-[#F6F6FA] text-[#8B5E3C]
    hover:bg-[#8B5E3C] hover:text-white
    border border-transparent
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