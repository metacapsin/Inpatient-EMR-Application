/**
 * Typed re-export of react-icons/fa6 so icon components are valid JSX elements.
 * Fixes: "Its return type 'ReactNode' is not a valid JSX element" with React 18 + strict TS.
 */
import type { FC } from 'react';
import type { IconBaseProps } from 'react-icons/lib';
import * as Real from 'react-icons-fa6-real';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asIcon = (C: any): FC<IconBaseProps> => C as FC<IconBaseProps>;

export const FaBook = asIcon(Real.FaBook);
export const FaMoon = asIcon(Real.FaMoon);
export const FaPlus = asIcon(Real.FaPlus);
export const FaUtensils = asIcon(Real.FaUtensils);
export const FaWandMagicSparkles = asIcon(Real.FaWandMagicSparkles);
export const FaSmile = asIcon(Real.FaFaceSmile);
export const FaRunning = asIcon(Real.FaPersonRunning);
export const FaTint = asIcon(Real.FaDroplet);
