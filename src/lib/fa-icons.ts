/**
 * Typed re-export of react-icons/fa so icon components are valid JSX elements.
 * Fixes: "Its return type 'ReactNode' is not a valid JSX element" with React 18 + strict TS.
 */
import type { FC } from 'react';
import type { IconBaseProps } from 'react-icons/lib';
import * as Real from 'react-icons-fa-real';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asIcon = (C: any): FC<IconBaseProps> => C as FC<IconBaseProps>;

export const FaBell = asIcon(Real.FaBell);
export const FaBolt = asIcon(Real.FaBolt);
export const FaBook = asIcon(Real.FaBook);
export const FaBriefcase = asIcon(Real.FaBriefcase);
export const FaCalendar = asIcon(Real.FaCalendar);
export const FaCalendarAlt = asIcon(Real.FaCalendarAlt);
export const FaCalendarCheck = asIcon(Real.FaCalendarCheck);
export const FaChartLine = asIcon(Real.FaChartLine);
export const FaCheckCircle = asIcon(Real.FaCheckCircle);
export const FaChevronDown = asIcon(Real.FaChevronDown);
export const FaChevronLeft = asIcon(Real.FaChevronLeft);
export const FaChevronRight = asIcon(Real.FaChevronRight);
export const FaClipboardList = asIcon(Real.FaClipboardList);
export const FaClock = asIcon(Real.FaClock);
export const FaCopy = asIcon(Real.FaCopy);
export const FaDollarSign = asIcon(Real.FaDollarSign);
export const FaDownload = asIcon(Real.FaDownload);
export const FaExclamationTriangle = asIcon(Real.FaExclamationTriangle);
export const FaEye = asIcon(Real.FaEye);
export const FaEyeSlash = asIcon(Real.FaEyeSlash);
export const FaFileMedical = asIcon(Real.FaFileMedical);
export const FaFlask = asIcon(Real.FaFlask);
export const FaHeartbeat = asIcon(Real.FaHeartbeat);
export const FaHistory = asIcon(Real.FaHistory);
export const FaInfoCircle = asIcon(Real.FaInfoCircle);
export const FaLightbulb = asIcon(Real.FaLightbulb);
export const FaList = asIcon(Real.FaList);
export const FaMapMarkerAlt = asIcon(Real.FaMapMarkerAlt);
export const FaMoon = asIcon(Real.FaMoon);
export const FaPaperPlane = asIcon(Real.FaPaperPlane);
export const FaPills = asIcon(Real.FaPills);
export const FaPlus = asIcon(Real.FaPlus);
export const FaPrescriptionBottle = asIcon(Real.FaPrescriptionBottle);
export const FaRobot = asIcon(Real.FaRobot);
export const FaRunning = asIcon(Real.FaRunning);
export const FaSearch = asIcon(Real.FaSearch);
export const FaShieldAlt = asIcon(Real.FaShieldAlt);
export const FaSmile = asIcon(Real.FaSmile);
export const FaStethoscope = asIcon(Real.FaStethoscope);
export const FaStickyNote = asIcon(Real.FaStickyNote);
export const FaSyringe = asIcon(Real.FaSyringe);
export const FaTags = asIcon(Real.FaTags);
export const FaThermometerHalf = asIcon(Real.FaThermometerHalf);
export const FaTimes = asIcon(Real.FaTimes);
export const FaTimesCircle = asIcon(Real.FaTimesCircle);
export const FaTint = asIcon(Real.FaTint);
export const FaUser = asIcon(Real.FaUser);
export const FaUserCheck = asIcon(Real.FaUserCheck);
export const FaUserShield = asIcon(Real.FaUserShield);
export const FaUtensils = asIcon(Real.FaUtensils);
export const FaVial = asIcon(Real.FaVial);
export const FaWeight = asIcon(Real.FaWeight);
