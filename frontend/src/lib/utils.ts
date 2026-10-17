import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { toast as sonnerToast } from "sonner";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const toast = sonnerToast;